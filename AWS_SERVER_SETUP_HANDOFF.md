# Granvia AWS Server Setup Handoff

Prepared for the AWS/server team so the Granvia project can be hosted and started without missing runtime dependencies.

## 1. Project Runtime Summary

| Layer | Technology | Production runtime |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, Axios, React Router, Google Maps JavaScript API | Static files from `frontend/dist` |
| Backend/API | Node.js 22 LTS, Express 4, TypeScript, Prisma 7, SQL Server adapter, Multer, Nodemailer, PDFKit | Long-running Node process from `nodebackend/dist/index.js` |
| Database | Microsoft SQL Server through Prisma `sqlserver` provider | Amazon RDS for SQL Server 2022 |
| File uploads | Current code writes under `nodebackend/storage` | S3 required for production/horizontal scaling |
| Android app | Expo / React Native WebView wrapper | Loads deployed HTTPS web URL |
| Authentication | Bearer tokens stored in SQL Server and browser localStorage | No Redis session server currently required |

Supabase, PHP, Laravel, Apache, MySQL, PostgreSQL, and the Vite dev server are not required for the production runtime. MySQL settings/packages are only for one-time legacy import tooling.

## 2. Recommended AWS Architecture

```text
Users / Android WebView
        |
Route 53 or existing DNS + ACM TLS certificate
        |
CloudFront + optional AWS WAF
        |-- /*      -> private S3 frontend bucket with Origin Access Control
        |-- /api/*  -> ALB -> Node.js backend on port 8000
        `-- files   -> S3 application upload bucket through backend/API
                          |
                          `-> RDS for Microsoft SQL Server in private DB subnet

Backend outbound:
- Microsoft Graph or Outlook SMTP
- Google Maps / geocoding
- SurePass
- pincode API
- future payment/SMS providers
```

Preferred public URL model:

```text
Frontend: https://granvia.llc
API:      https://api.granvia.llc
```

This same-origin setup avoids browser CORS issues. CloudFront should route `/api/*` to the backend ALB.


## 3. AWS Services Required

- VPC across at least two Availability Zones.
- Public subnets for ALB and NAT gateway.
- Private subnets for backend compute and RDS.
- Application Load Balancer.
- EC2, ECS/Fargate, or Auto Scaling Group for backend.
- Amazon RDS for Microsoft SQL Server 2022.
- Amazon S3 private frontend bucket.
- Amazon S3 application upload bucket.
- Amazon CloudFront.
- CloudFront Origin Access Control for private S3 frontend hosting.
- AWS Certificate Manager certificate.
- Route 53 or external DNS provider.
- AWS Secrets Manager or encrypted SSM Parameter Store.
- IAM roles for runtime and deployment.
- CloudWatch Logs and Alarms.
- AWS Backup.
- AWS WAF recommended.
- AWS Systems Manager Session Manager for server access.
- SQS with DLQ recommended for email, SMS, payment/webhook jobs.

## 4. Server Size and OS

Initial backend server baseline:

```text
OS: Ubuntu Server 24.04 LTS
Architecture: x86_64
CPU: 2 vCPU minimum
RAM: 4 GB minimum
Disk: 30 GB encrypted gp3 root volume
Application port: 8000
```

Use x86_64 for the first deployment to reduce native package compatibility risk.

Do not use the root disk for permanent uploaded documents. Use S3 for production uploads. If S3 migration is not ready, use a temporary encrypted EBS volume mounted to the backend storage directory, backed up by AWS Backup, and run only one backend instance.

## 5. Software to Install on Backend Server

Install:

- Node.js 22 LTS.
- npm.
- Git.
- systemd service or supervised process manager.
- Nginx only if ALB does not connect directly to Node.js.
- AWS CLI and SSM agent if required by operations policy.

Do not install:

- Apache.
- PHP.
- Laravel.
- MySQL server.
- PostgreSQL server.
- SQL Server on the app server.
- Supabase runtime.
- Vite dev server for production.

## 6. Network, Ports, and Protocols

Inbound:

| Source | Target | Port | Purpose |
| --- | --- | --- | --- |
| Internet | CloudFront/ALB | 443 | HTTPS application traffic |
| Internet | HTTP listener | 80 | Redirect to HTTPS only |
| ALB | Backend service | 8000 | Node.js API |
| Backend security group | RDS SQL Server | 1433 | Database connection |

Outbound from backend:

| Destination | Port | Purpose |
| --- | --- | --- |
| Internet HTTPS | 443 | Graph, SurePass, pincode API, Google/geocoding, payment/SMS providers |
| Outlook SMTP, if retained | 587 | Email through STARTTLS |

Access:

- No public SSH should be open.
- Use AWS Systems Manager Session Manager.
- RDS must not be publicly accessible.

## 7. Frontend Build and Hosting

Build in CI or a controlled build runner:

```bash
cd frontend
npm ci
npm run build
```

Deploy:

- Upload `frontend/dist` to the private S3 frontend bucket.
- Invalidate CloudFront after deployment.
- Cache hashed `/assets/*` for a long duration with immutable caching.
- Cache `index.html` briefly or with revalidation.
- Configure SPA fallback to `/index.html`.

SPA routes that must reload correctly:

```text
/
/admin
/employer
/guard
/subadmin
/sales
/operations
/finance
/universal-app
```

Frontend production build variables:

```text
VITE_API_URL=/api
VITE_SITE_URL=https://granvia.llc
VITE_EMAIL_CONFIRMATION_REDIRECT_URL=https://granvia.llc/employer
VITE_EMPLOYER_LOGIN_REDIRECT_URL=https://granvia.llc/employer
VITE_MAP_PROVIDER=google
VITE_GOOGLE_MAPS_API_KEY=<browser-restricted-google-maps-key>
```

Never put private keys or backend secrets into any `VITE_*` variable. Vite embeds them in browser JavaScript.

## 8. Backend Build and Deployment

Build:

```bash
cd nodebackend
npm ci
npx prisma generate
npm run build
```

Start:

```bash
cd nodebackend
npm start
```

`npm start` runs:

```bash
node dist/index.js
```

Backend health check:

```text
GET /api/health
Expected: HTTP 200
```

Use systemd, ECS/Fargate, or another supervised production runner. The service must restart on failure and send stdout/stderr logs to CloudWatch.

Do not run `tsx watch`, `npm run dev`, or Vite preview in production.

## 9. Backend Environment Variables

Store values in AWS Secrets Manager or encrypted SSM Parameter Store. Do not store secrets in AMIs, source control, user-data scripts, frontend variables, or CI logs.

Required production values:

```text
NODE_ENV=production
PORT=8000
DATABASE_URL=<sqlserver-connection-string>
APP_URL=https://granvia.llc
PUBLIC_API_URL=https://granvia.llc
FRONTEND_URL=https://granvia.llc
CORS_ORIGINS=https://granvia.llc,https://www.granvia.llc
FILE_SIGNING_SECRET=<strong-random-secret-minimum-32-bytes>
TOKEN_EXPIRY_DAYS=30
LOCATION_CAPTURE_ENABLED=true
ATTENDANCE_GEOFENCE_RADIUS_METERS=250
AUTH_LOGIN_2FA=false
AUTH_ENFORCE_EMAIL_VERIFICATION=false
AADHAAR_API_ENABLED=false
SUREPASS_BASE_URL=<surepass-production-or-sandbox-url>
SUREPASS_BEARER_TOKEN=<secret>
SUREPASS_TIMEOUT_MS=15000
ADMIN_NOTIFICATION_EMAIL=<operations-email>
EMAIL_DEBUG_LOGS=false
GOOGLE_MAPS_API_KEY=<server-side-key-if-needed>
```

Temporary SMTP variables if SMTP is retained:

```text
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=<mailbox>
SMTP_PASSWORD=<secret>
SMTP_FROM_EMAIL=no-reply@granvia.llc
SMTP_FROM_NAME=Granvia
SMTP_SECURE=false
SMTP_ALLOW_INVALID_CERTS=false
```

Production must not allow invalid SMTP TLS certificates.

Variables used only for one-time legacy data import runner, not the steady-state application service:

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE
```

## 10. Database Setup

Use:

```text
Amazon RDS for Microsoft SQL Server 2022
Port: 1433
Private subnet only
Encryption: enabled
Automated backups: enabled
Production: Multi-AZ recommended
Deletion protection: enabled for production
```

Database requirements:

- Use a least-privilege SQL login for the application.
- Do not use the RDS master user in the application.
- `DATABASE_URL` must use encrypted connection settings.
- Do not run unreviewed `prisma db push` against production.
- Developers/DBA must provide or approve a baseline schema/migration before cutover.
- Apply current migration set in controlled order.
- Apply `nodebackend/prisma/filtered-indexes.sql` after schema creation/migration.
- Validate row counts, foreign keys, all role logins, and restore process.

Important Prisma commands:

```bash
cd nodebackend
npx prisma generate
```

Only run migrations/deploy steps after DBA approval and with the correct production `DATABASE_URL`.

## 11. File Uploads and Storage

Current behavior:

- Public profile/company images are written under `nodebackend/storage/public`.
- Private documents, agreements, invoices, and company/guard documents use signed download URLs.
- Uploads are handled by the backend.

Production requirement:

- Use encrypted S3 bucket for uploads.
- Enable Block Public Access.
- Enable versioning.
- Use lifecycle policy.
- Backend accesses S3 through IAM role.
- Private documents should be served through signed URLs.
- Public images should be served through CloudFront, not a public bucket.
- Add malware scanning/quarantine workflow if required by security policy.

Temporary exception:

- Dedicated encrypted EBS volume mounted at backend storage path.
- AWS Backup enabled.
- No multiple backend instances until S3 storage is implemented.

## 12. CORS and Reverse Proxy

Preferred same-origin setup:

```text
https://granvia.llc        -> frontend
https://api.granvia.llc/*  -> backend through CloudFront/ALB
```

CloudFront/ALB must forward:

- HTTP methods: `GET,POST,PUT,PATCH,DELETE,OPTIONS`.
- Headers: `Authorization`, `Content-Type`, `Accept`, `Origin`.
- Query strings.
- Request body.

Do not cache authenticated API responses.

If separate API domain is used:

```text
CORS_ORIGINS=https://granvia.llc,https://www.granvia.llc
Allowed methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Allowed headers: Authorization,Content-Type,Accept
```

Rules:

- Do not use `Access-Control-Allow-Origin: *`.
- Do not leave production CORS origin list empty.
- Do not serve frontend over HTTPS while API is HTTP; browsers/WebView will block mixed content.
- Ensure `OPTIONS` preflight requests reach the backend or are correctly handled by proxy.

## 13. Email Setup

Current code supports SMTP through Nodemailer. Production preferred direction:

- Dedicated Microsoft 365 sender mailbox, for example `no-reply@granvia.llc`.
- Microsoft Entra ID app registration.
- Microsoft Graph `Mail.Send` with certificate/client-secret authentication.
- SPF, DKIM, and DMARC configured for `granvia.llc`.
- CloudWatch alerting for failures.
- Queue email through SQS with retries and DLQ.

If SMTP is used temporarily:

- Use `smtp.office365.com`.
- Port `587`.
- STARTTLS.
- Certificate validation enabled.
- No invalid certificate override.
- No development OTP disclosure.

Before go-live:

- Remove hard-coded debug CC recipients.
- Protect or remove unauthenticated email test endpoints.
- Ensure production never returns OTP values in API responses.

## 14. Android WebView/APK

Production URL:

```text
https://granvia.llc/universal-app
```

Expo build variable:

```text
EXPO_PUBLIC_APP_URL=https://granvia.llc/universal-app
```

Requirements:

- HTTPS only.
- Disable Android cleartext traffic after HTTPS testing.
- WebView must be tested against the same production frontend and API URLs.
- Location permission and attendance flows must be tested on a real device.

## 15. External APIs and Future Providers

Required or currently referenced:

- Google Maps JavaScript API.
- Google Maps/geocoding key if server-side geocoding is enabled.
- SurePass DigiLocker API if Aadhaar API is enabled.
- Pincode API.
- Microsoft Graph or Outlook SMTP.

Future payment gateway:

- Razorpay, Cashfree, Stripe, PayU, HDFC, or selected provider.
- Store secret key server-side only.
- Use frontend public key only if provider SDK requires it.
- Public HTTPS webhook endpoint.
- Verify webhook signatures using raw body.
- Use idempotency and unique provider event IDs.
- Queue webhook processing through SQS + DLQ.
- Never mark payment successful from browser redirect alone.

Future SMS gateway:

- AWS End User Messaging SMS, Twilio, MSG91, Gupshup, or selected provider.
- Complete Indian DLT/entity/header/template registration.
- Store provider secrets server-side only.
- Rate-limit OTP flows.
- Use SQS + DLQ and delivery callbacks.

## 16. Security Requirements Before Go-Live

- Strong `FILE_SIGNING_SECRET`.
- Finite `TOKEN_EXPIRY_DAYS`.
- Production rate limits for login, OTP, registration, payment, and email endpoints.
- Security headers through app or proxy.
- Upload MIME/extension validation.
- Malware scanning for uploaded files if required.
- WAF managed rules and rate-based rules.
- KMS encryption for RDS, S3, EBS, backups, Secrets Manager, and logs.
- CloudTrail, GuardDuty, and security alerts per company policy.
- Redact logs: no passwords, bearer tokens, OTPs, Aadhaar data, payment secrets, documents, or database URLs.
- Define PII retention and deletion policy.

## 17. Monitoring and Backup

CloudWatch Logs:

- Backend stdout/stderr.
- Deployment logs.
- ALB access logs if enabled.

Alarms:

- ALB 5xx and unhealthy targets.
- API latency.
- Backend restarts.
- CPU/memory/disk.
- RDS CPU/storage/connections/deadlocks.
- SQS age and DLQ depth.
- Email/provider failures.

Backups:

- RDS automated backups and point-in-time restore.
- AWS Backup policy.
- S3 versioning/lifecycle.
- EBS snapshots only for the temporary local-storage exception.

Operational docs required:

- RPO/RTO.
- Rollback procedure.
- Restore drill.
- Certificate/domain renewal ownership.
- Patch window.
- Incident response owner.

## 18. Deployment Order

1. Provision AWS networking, DNS, TLS, CloudFront, S3, ALB, compute, RDS, secrets, IAM, and logging.
2. Prepare database baseline/restore/migration plan with DBA/developers.
3. Build backend and frontend in CI.
4. Apply database schema/migrations and `filtered-indexes.sql`.
5. Deploy backend.
6. Verify `GET /api/health`.
7. Verify database connectivity from backend.
8. Verify email provider.
9. Verify file upload/download storage.
10. Deploy frontend to S3 and invalidate CloudFront.
11. Run full smoke testing.
12. Switch DNS/cutover with rollback plan.

## 19. Smoke Test Checklist

Server team and application team should verify:

- `https://granvia.llc/` loads.
- Reload works on `/admin`, `/employer`, `/guard`, `/subadmin`, `/sales`, `/operations`, `/finance`, `/universal-app`.
- `GET https://granvia.llc/api/health` returns 200.
- Super Admin login.
- Employer login and company/job flow.
- Associate/Guard login and application flow.
- Sub Admin login.
- Sales login.
- Operations login.
- Finance login.
- Registration and email OTP.
- Document/image upload.
- Signed document download.
- Notification flow.
- Attendance check-in/check-out with location on real mobile/WebView.
- Google Maps loads with production key restrictions.
- RDS backup and restore tested.
- CloudWatch alarms active.

## 20. Final Acceptance Checklist

- [ ] Frontend private S3 + CloudFront is live.
- [ ] SPA fallback works for all app routes.
- [ ] HTTPS certificate is valid.
- [ ] HTTP redirects to HTTPS.
- [ ] `/api/*` routes correctly to backend.
- [ ] Backend is supervised and auto-restarts.
- [ ] `/api/health` passes.
- [ ] RDS SQL Server is private, encrypted, backed up, and restore-tested.
- [ ] Application uses least-privilege DB login.
- [ ] Reviewed baseline/migrations are applied.
- [ ] `filtered-indexes.sql` is applied.
- [ ] Secrets are only in Secrets Manager/SSM.
- [ ] No secret is in `VITE_*`.
- [ ] CORS is same-origin or exact-origin only.
- [ ] Upload storage is S3 or approved temporary encrypted EBS.
- [ ] Email sending works without exposing OTP values.
- [ ] Debug/test email routes are removed or protected.
- [ ] Google Maps works on production domain.
- [ ] Android WebView loads production HTTPS URL.
- [ ] Attendance/location works on real device.
- [ ] Rate limits and security headers are active.
- [ ] Logs are redacted.
- [ ] Backup, rollback, and incident process are documented.
