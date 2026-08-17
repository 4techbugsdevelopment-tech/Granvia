# Granvia AWS Deployment Requirements

Prepared from the repository as of 14 August 2026. This is the handoff document for DevOps. Values in angle brackets must be decided or supplied during deployment. Do not copy credentials from developer `.env` files.

## 1. Application inventory

| Layer | Current technology | Production runtime |
|---|---|---|
| Web frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3, Axios, React Router 7, Leaflet/React-Leaflet, Three.js/React Three Fiber | Static files produced in `frontend/dist`; no Node process is needed after build |
| API/backend | Node.js, Express 4, TypeScript, Prisma 7 with `@prisma/adapter-mssql`, Zod, bcryptjs, Multer, Nodemailer | Long-running Node process, entry point `nodebackend/dist/index.js`, default port 8000 |
| Database | Microsoft SQL Server through Prisma's `sqlserver` provider | Amazon RDS for SQL Server is recommended |
| File storage | Files currently written below `nodebackend/storage/public` and `nodebackend/storage/app` | Must be migrated to S3 before horizontal scaling; an EBS workaround is documented below |
| Android app | Expo 51 / React Native 0.74 WebView wrapper | The APK/AAB loads `https://granvia.llc/universal-app`; it depends on the web and API deployments |
| Email | Nodemailer with username/password SMTP today | Outlook/Microsoft 365 with OAuth/Graph is the required production direction |
| External APIs | SurePass DigiLocker sandbox, OpenStreetMap tiles/Nominatim, `api.pincodeapi.in` | Outbound HTTPS (TCP 443) required |
| Authentication | Opaque bearer tokens stored in SQL Server and browser `localStorage`; optional email OTP | No Redis/session server is currently required |

There are approximately 137 Express route registrations and 30 Prisma models. Supabase, PostgreSQL and MySQL are **not** application runtime dependencies. The `MYSQL_*` settings and `mysql2` package are only for the one-time legacy data import. The frontend's old Supabase variables are not referenced by current frontend source.

## 2. Recommended AWS production architecture

```text
Users / Android WebView
        |
Route 53 (or existing DNS) + ACM TLS certificate
        |
CloudFront + optional AWS WAF
        |-- /*      -> private S3 frontend bucket (Origin Access Control)
        |-- /api/*  -> ALB -> Node API on EC2/ECS in private subnets
        `-- uploads -> private/public S3 application bucket via the API
                          |
                          `-> RDS for Microsoft SQL Server in private DB subnets

API -> Microsoft Graph/Outlook, SurePass, pincode API, Nominatim over HTTPS
API/worker -> SQS + DLQ (recommended for email, future SMS and payment events)
Logs/metrics -> CloudWatch; secrets -> Secrets Manager or encrypted SSM parameters
```

Use one public application hostname where possible, for example `https://granvia.llc`, and route `/api/*` to the ALB through CloudFront. This avoids browser CORS entirely and lets the frontend keep `VITE_API_URL=/api`. If a separate API hostname is required, use `https://api.granvia.llc` consistently and configure exact CORS origins as described in section 6.

AWS recommends a private S3 origin with CloudFront Origin Access Control for secure static sites: [AWS secure static website guidance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/getting-started-secure-static-website-cloudformation-template.html).

## 3. AWS resources required

### Networking and edge

- One VPC across at least two Availability Zones.
- Public subnets only for the Application Load Balancer and NAT gateway(s). Keep API compute and RDS in private subnets.
- ALB listener on 443 with an ACM certificate; redirect port 80 to 443.
- Route 53 records, or equivalent DNS records at the current registrar, for `granvia.llc` and the chosen API hostname.
- CloudFront distribution with a private S3 frontend origin. Configure SPA fallback so non-file routes such as `/admin`, `/guard`, `/employer`, `/sales`, `/subadmin`, and `/universal-app` return `/index.html`.
- Forward `/api/*` methods, query strings, `Authorization`, `Content-Type`, and `Origin` to the API origin. Do not cache authenticated API responses. Health check: `GET /api/health`, expected HTTP 200.
- Security groups: internet to CloudFront/ALB on 443; ALB to API port 8000 only; API security group to RDS port 1433 only. RDS must not be publicly accessible.
- API needs outbound TCP 443 and Outlook TCP 587 only if SMTP is retained. No inbound SSH should be open to the internet; use AWS Systems Manager Session Manager.

### Frontend hosting

- Private, versioned S3 bucket with Block Public Access enabled and CloudFront OAC.
- Build in CI, not on the web server: Node.js 22 LTS, `npm ci`, then `npm run build` from `frontend`.
- Upload `frontend/dist` to S3 and invalidate CloudFront after deployment.
- Cache hashed `/assets/*` for one year with `immutable`; cache `index.html` briefly or with revalidation.
- Build-time environment must contain only public values. Every `VITE_*` value is embedded in browser JavaScript and must never contain a private key or server secret.

### Backend compute

Preferred: ECS/Fargate or an Auto Scaling Group behind the ALB. A first release may use one EC2 instance, but it has no high availability.

Initial EC2 baseline for moderate/unknown traffic:

- Ubuntu Server 24.04 LTS, x86_64.
- 2 vCPU, 4 GiB RAM (`t3.medium`/`t4g.medium` only after confirming native package architecture compatibility; use x86_64 for the least deployment risk).
- 30 GiB encrypted gp3 root disk. This is not intended for permanent uploaded files.
- Node.js 22 LTS and npm; `npm ci` must be used from `nodebackend/package-lock.json`.
- Build steps: `npm ci`, `npx prisma generate`, `npm run build`.
- Run `npm start` with `NODE_ENV=production`, working directory `nodebackend`, using `systemd`, ECS, or another supervised process. Do not use `tsx watch`, Vite, or PM2 development mode in production.
- Graceful restart, automatic restart on failure, and deployment rollback are required. ALB deregistration/draining should precede process termination.
- Nginx is optional when an ALB routes directly to port 8000. If Nginx is installed, preserve the original scheme/host headers and set upload body limit to at least 11 MiB.

Do not install SQL Server, MySQL, PostgreSQL, Apache, PHP, Laravel, Supabase, or the Vite dev server on the production API machine.

### Database

- Amazon RDS for Microsoft SQL Server 2022 is recommended. Select Web vs Standard edition only after checking licensing, Multi-AZ requirements, and expected workload. RDS provides encryption, backups, point-in-time restore and managed failover; see [RDS for SQL Server](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_SQLServer.html) and [SQL Server Multi-AZ](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_SQLServerMultiAZ.html).
- Development/staging may start Single-AZ. Production handling real users should use Multi-AZ, encrypted storage, automated backups, deletion protection, and a final-snapshot policy.
- Start sizing at 2 vCPU / 4-8 GiB only as a test baseline; select final class, IOPS/storage, retention, and connection limits after load testing and measuring the source database.
- Database name: `<granvia production DB>`; application login must be a least-privilege SQL login, not the RDS master account.
- `DATABASE_URL` must use `encrypt=true` and production certificate validation (`trustServerCertificate=false` where supported/tested). Keep it only in Secrets Manager/SSM.
- The repository does **not** contain a complete migration history: only two incremental migration directories exist while the schema has roughly 30 models. DevOps must not run an unreviewed `prisma db push` against production. Before cutover, developers/DBA must create and test a baseline migration or restore/import a verified database, then apply the two incremental migrations.
- After schema creation, apply `nodebackend/prisma/filtered-indexes.sql`. It creates the required unique-when-not-null mobile index that Prisma cannot express correctly for SQL Server.
- Required validation: row counts, foreign keys, login for every role, backup restore test, and the API smoke suite. Keep the old database read-only until business acceptance and rollback expiry.

### Uploaded documents and images

Current code synchronously writes up to 10 MiB per document to local paths. Public profile/company images are exposed at `/storage`; company/guard documents, invoices and agreements use application-signed download URLs.

Mandatory production solution:

- Refactor the storage service to use an encrypted S3 bucket with Block Public Access, object versioning, lifecycle rules, malware scanning/quarantine, and least-privilege access through the API task/instance IAM role.
- Use S3 presigned URLs for private downloads. Public images should be exposed through CloudFront, not a public bucket.
- Preserve or migrate all existing files and update stored URLs. Set `APP_URL` to the externally reachable HTTPS API/base URL while the current URL-generation code remains.

Temporary single-instance exception: mount a dedicated encrypted EBS volume at the backend `storage` directory, back it up with AWS Backup, and prevent multiple API instances. EFS can enable multiple instances but is still inferior to the intended S3 design for this workload.

## 4. Runtime configuration and secrets

Store secret values in AWS Secrets Manager (preferred) or encrypted SSM Parameter Store and grant read access through an IAM role. Do not place secrets in AMIs, source control, frontend variables, user-data scripts, or CI logs.

### Backend variables

| Variable | Production requirement |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8000` unless the target definition/service uses another port |
| `DATABASE_URL` | Required SQL Server connection string; secret |
| `APP_URL` | Required: externally reachable HTTPS backend/base URL; currently missing from the example |
| `FRONTEND_URL` | Required: `https://granvia.llc` with no trailing slash preferred |
| `CORS_ORIGINS` | Exact comma-separated browser origins; blank is unsafe because current code then reflects any origin |
| `FILE_SIGNING_SECRET` | Required random secret of at least 32 bytes; current code has an insecure development fallback |
| `TOKEN_EXPIRY_DAYS` | Set a finite business-approved lifetime, for example 30; current value `0` means never expires |
| `AUTH_LOGIN_2FA` | `true` only after every portal's two-step login is acceptance-tested |
| `AUTH_ENFORCE_EMAIL_VERIFICATION` | `true` only after OTP/verification UI is acceptance-tested |
| `AADHAAR_API_ENABLED` | Keep `false` until real SurePass production approval and flow testing |
| `SUREPASS_BASE_URL` | Production SurePass URL when enabled; code currently defaults to sandbox |
| `SUREPASS_BEARER_TOKEN` | Server-side secret |
| `SUREPASS_TIMEOUT_MS` | `15000` initially |
| `SMTP_*` / future Graph vars | See section 7; all credentials/tokens are secrets |
| `ADMIN_NOTIFICATION_EMAIL` | Required explicit operations recipient |
| `EMAIL_DEBUG_LOGS` | `false` in production unless temporarily troubleshooting sanitized logs |

`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` are required only on a controlled one-time migration runner, never on the steady-state application service.

### Frontend build variables

Recommended same-origin build:

```text
VITE_API_URL=/api
VITE_SITE_URL=https://granvia.llc
VITE_EMAIL_CONFIRMATION_REDIRECT_URL=https://granvia.llc/employer
VITE_EMPLOYER_LOGIN_REDIRECT_URL=https://granvia.llc/employer
VITE_MAP_PROVIDER=leaflet
```

The repository currently uses `https://aip.granvia.llc/api`. Confirm whether `aip` is intentional; if it is a typo for `api`, correct DNS and `frontend/.env.production` before building. `VITE_GOOGLE_MAPS_API_KEY` is needed only after a real Google Maps implementation is selected and should be browser-restricted. A payment gateway **public** key can later be a `VITE_*` variable; the gateway secret must remain backend-only.

Expo production builds must set `EXPO_PUBLIC_APP_URL=https://granvia.llc/universal-app` or retain the matching `expo/app.json` value. Disable Android cleartext traffic for the production build after HTTPS-only device testing.

## 5. Deployment and release procedure

1. Provision infrastructure through Terraform, CloudFormation, CDK, or another reviewed IaC tool. Maintain separate production and staging environments.
2. Run CI checks. Backend build currently passes. Frontend Vite build passes, but `npm run typecheck` currently fails with many TypeScript errors; this must be fixed before making typecheck a required deployment gate. The frontend also has a roughly 1.09 MB uncompressed main chunk and should be performance-tested on mobile.
3. Back up the source database and source uploads; test restore/import to staging.
4. Apply the reviewed database baseline/migrations and filtered index as a single controlled release step. Never let every API replica run schema changes on startup.
5. Deploy the API, verify `/api/health`, DB connectivity, SMTP/Graph, S3, and outbound providers, then deploy the frontend.
6. Run smoke tests for employer, guard, admin, sales, and sub-admin login; registration and OTP; company/job/application flows; attendance; upload/download; notifications; cash-payment OTP; email logs; and APK WebView access.
7. Switch DNS with a documented rollback to the old application/database. Monitor errors, latency and business transactions.

## 6. CORS and reverse-proxy requirements

Best solution: serve frontend and API under the same browser origin and proxy `/api/*`. Then set `VITE_API_URL=/api`; CORS is no longer involved in browser API calls.

If the API remains cross-origin:

- `CORS_ORIGINS=https://granvia.llc,https://www.granvia.llc` (include only hostnames actually used; origins have scheme and host, no path and normally no trailing slash).
- Never use `*`, reflected arbitrary origins, or leave the current allow-list empty in production.
- Permit `GET,POST,PUT,PATCH,DELETE,OPTIONS` and headers `Authorization,Content-Type,Accept`.
- The application uses bearer headers rather than cookies, so credentialed CORS is not currently necessary. If `credentials:true` remains, wildcard origins are invalid and caches/proxies must respect `Vary: Origin`.
- ALB/CloudFront must pass `OPTIONS` requests and must not cache one origin's preflight response for another.
- Only HTTPS URLs may be used by the frontend/APK; otherwise browsers/WebView will block mixed content.

## 7. Outlook/Microsoft 365 email

Current code uses Nodemailer SMTP username/password and calls `transporter.verify()` before every message. The configured development host is `smtp-mail.outlook.com`, port 587, and invalid TLS certificates are allowed. That setup is not acceptable for production.

Preferred Outlook solution:

- Create a dedicated Microsoft 365 sender/shared mailbox such as `no-reply@granvia.llc`; do not use a person's mailbox.
- Register an application in Microsoft Entra ID and use Microsoft Graph `Mail.Send` with certificate/client-secret authentication and the narrowest mailbox/application access policy available. This requires a backend code change and outbound HTTPS only.
- If SMTP must remain, use `smtp.office365.com:587`, STARTTLS, certificate validation, and OAuth 2.0. The current code supports only password auth, so OAuth support must be implemented before relying on it.
- Configure and validate SPF, DKIM and DMARC for `granvia.llc`; define bounce/complaint monitoring, sending limits, retention of the existing `email_delivery_logs`, and alerting on failures.
- Remove the hard-coded debug CC recipients from `mailService.ts` before production. They currently receive signup verification and password-reset messages.
- Protect or remove the unauthenticated `POST /api/auth/test-email` endpoint and the public `/smtp-test` frontend route.
- In production, an SMTP outage/missing config must fail safely; the API must never return `dev_otp` to a user.
- Move email sending to SQS with retries and a dead-letter queue so a slow provider does not hold open API requests.

Microsoft has updated the Exchange Online timeline: basic SMTP AUTH remains unchanged until December 2026, becomes disabled by default for existing tenants at the end of December 2026, and OAuth is the supported path for new tenants; see the [Microsoft Exchange Team update](https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835) and [Microsoft SMTP AUTH configuration](https://learn.microsoft.com/en-us/Exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission).

If sending specifically "from Outlook" is not a business requirement, Amazon SES is operationally simpler on AWS, but it would also require adapting the mail configuration/provider and verifying the domain.

## 8. Security changes required before go-live

- Add API rate limits, especially login, registration, password OTP, verification OTP, cash-payment OTP, email resend and SMTP test endpoints. Use a shared Redis/ElastiCache counter if more than one API replica is deployed.
- Add secure HTTP headers (`helmet` or equivalent), explicit request body limits, upload MIME/extension allow-lists, and malware scanning. Multer currently buffers uploads in process memory.
- Remove hard-coded email CC addresses, development OTP disclosure, default signing secret, invalid-certificate allowance, and never-expiring production tokens.
- Review bearer tokens in browser `localStorage` and implement a defined token rotation/revocation policy. Add a Content Security Policy to reduce XSS risk.
- Add an ALB/CloudFront WAF managed ruleset and rate-based rules. Do not treat WAF as a replacement for application rate limiting.
- Encrypt S3, EBS, RDS, backups, Secrets Manager and log groups with approved KMS keys; enforce TLS in transit.
- Use separate IAM roles for CI deployment and application runtime, both least privilege. Enable CloudTrail, GuardDuty, AWS Config/security alerts according to the organization's standard.
- Do not log passwords, bearer tokens, OTP values, Aadhaar data, payment secrets, full documents, or database URLs. Define PII retention and deletion policies.

## 9. Observability, backup and operations

- Send API stdout/stderr to CloudWatch Logs as structured logs. Add request/correlation IDs and redact sensitive fields.
- CloudWatch alarms: ALB 5xx/4xx anomaly, unhealthy targets, API latency, process restarts, CPU/memory/disk, RDS CPU/storage/connections/deadlocks, SQS age/DLQ depth, and email/provider failures.
- Synthetic checks for `/`, `/api/health`, login, and one authenticated read-only API path.
- RDS automated backups plus AWS Backup policy; S3 versioning/lifecycle/replication policy as required; EBS snapshots only while the temporary local-storage design exists.
- Document RPO, RTO, on-call ownership, certificate/domain renewal, patch windows, restore drills, incident response and deployment rollback.
- Define at least staging and production. Use different databases, buckets, sender credentials, provider keys and domains; never test payment/SMS against production credentials.

## 10. Future payment gateway requirements

The current payment code only creates internal payment records and supports cash confirmation by emailed OTP. It does **not** integrate an online gateway.

Before adding Razorpay, Cashfree, Stripe, PayU or another gateway:

- Complete provider/KYC and settlement account setup; choose sandbox and production accounts.
- Add backend-only key/secret storage and a public browser key only where the provider SDK requires it.
- Create public HTTPS webhook endpoints behind ALB/API, verify provider signatures against the **raw request body**, enforce timestamps/replay protection, and store event IDs with unique constraints for idempotency.
- Model order/payment/refund/payout status transitions. Never mark a payment successful from the browser redirect alone; reconcile against signed webhook/API status.
- Queue webhook work in SQS, configure retry/DLQ and alerts, and implement reconciliation jobs with EventBridge Scheduler.
- Keep card/UPI credentials out of Granvia; use provider-hosted/tokenized checkout to minimize PCI scope. Complete privacy, refund, dispute, tax/invoice and audit requirements.
- Add WAF/rate limits without blocking valid signed provider webhook IPs/requests. Keep independent sandbox and live webhook secrets.

## 11. Future SMS gateway requirements

- Select an India-capable provider (for example AWS End User Messaging SMS, Twilio, MSG91, Gupshup, or approved alternative) after pricing/delivery review.
- Complete Indian DLT/entity/header/template registration and ensure every transactional OTP template matches the approved content. Obtain user consent and implement opt-out rules for non-transactional messages.
- Store provider secrets server-side, normalize numbers to E.164, never expose OTP values in production responses, and reuse the hashed, expiring, single-use OTP model.
- Send asynchronously through SQS with retries/DLQ, per-number/IP/purpose rate limits, attempt limits, cooldowns, spend caps and CloudWatch billing/delivery alerts.
- Add authenticated/signed delivery-status callbacks, idempotent event storage and provider failover rules. Redact phone numbers in general application logs.

## 12. DevOps acceptance checklist

- [ ] DNS, ACM, CloudFront SPA behavior, private frontend S3 bucket and optional WAF are working.
- [ ] API is supervised behind an ALB, private where practical, with `/api/health` passing.
- [ ] RDS SQL Server is private, encrypted, backed up, restore-tested, and accessed by a least-privilege user.
- [ ] Reviewed schema baseline and `filtered-indexes.sql` have been applied; migration and rollback are documented.
- [ ] Uploaded files are in S3, or the explicitly temporary single-instance encrypted EBS exception is backed up.
- [ ] Secrets are in Secrets Manager/SSM and the service uses an IAM role; no production secret is embedded in `VITE_*`.
- [ ] Same-origin `/api` proxy is used, or exact production CORS/preflight tests pass.
- [ ] `APP_URL`, `FRONTEND_URL`, finite token expiry, strong signing secret, production URLs and provider flags are correct.
- [ ] Outlook OAuth/Graph mail, SPF/DKIM/DMARC, retries and failure alerting pass; debug CC and SMTP test exposure are removed.
- [ ] Production never returns a development OTP and never accepts invalid SMTP TLS certificates.
- [ ] Rate limits, security headers, upload validation/scanning, log redaction and backup alarms are active.
- [ ] Frontend, backend, API smoke tests, all five role flows, uploads, OTP email and Android WebView pass on staging.
- [ ] Payment/SMS are marked future scope and no placeholder setting is treated as a working integration.

