# Granvia AWS Tech Stack Checklist

## Server

- Ubuntu Server 24.04 LTS, x86_64
- EC2: minimum 2 vCPU, 4 GB RAM, 30 GB encrypted gp3
- Node.js 22 LTS
- npm
- Git
- systemd or PM2
- Nginx (if ALB does not connect directly to Node.js)
- Application port: `8000`

## Frontend

- React 18
- TypeScript
- Vite 5
- Tailwind CSS 3
- Build command: `npm ci && npm run build`
- Build output: `frontend/dist`
- Amazon S3 private bucket
- Amazon CloudFront
- CloudFront Origin Access Control
- SPA fallback: all application routes to `/index.html`

## Backend/API

- Node.js 22 LTS
- Express 4
- TypeScript
- Prisma 7
- Prisma SQL Server adapter
- Build commands:

```bash
cd nodebackend
npm ci
npx prisma generate
npm run build
npm start
```

- Health check: `GET /api/health`
- API base path: `/api`
- Upload limit at proxy/load balancer: minimum 11 MB

## Database

- Amazon RDS for Microsoft SQL Server 2022
- SQL Server port: `1433`
- Private subnet only
- Encryption enabled
- Automated backups enabled
- Multi-AZ for production
- Apply `nodebackend/prisma/filtered-indexes.sql`
- Do not run `prisma db push` directly on production without an approved baseline migration

## File Storage

- Amazon S3 application-upload bucket
- S3 encryption
- S3 Block Public Access
- S3 versioning
- IAM role access from backend
- Presigned URLs for private documents
- CloudFront for public images

## AWS Services

- Amazon EC2 or ECS/Fargate
- Application Load Balancer
- Amazon RDS for SQL Server
- Amazon S3
- Amazon CloudFront
- AWS Certificate Manager
- Route 53 or existing DNS provider
- AWS Secrets Manager or SSM Parameter Store
- Amazon CloudWatch Logs and Alarms
- AWS Backup
- AWS WAF
- AWS Systems Manager Session Manager
- Amazon SQS with dead-letter queue for email and future SMS/payment jobs

## Domains and HTTPS

- Frontend: `https://granvia.llc`
- Preferred API: `https://granvia.llc/api` through CloudFront/ALB
- Alternative API: `https://api.granvia.llc/api`
- Confirm whether the current `aip.granvia.llc` hostname is intentional or a typo
- ACM TLS certificate
- Redirect HTTP port `80` to HTTPS port `443`

## CORS

Preferred configuration:

- Frontend and API on the same origin
- `VITE_API_URL=/api`

If using a separate API domain:

- Allowed origins: `https://granvia.llc,https://www.granvia.llc`
- Methods: `GET,POST,PUT,PATCH,DELETE,OPTIONS`
- Headers: `Authorization,Content-Type,Accept`
- Do not use wildcard `*`

## Outlook Email

- Microsoft 365 dedicated sender mailbox
- Microsoft Entra ID application registration
- Microsoft Graph API with `Mail.Send` preferred
- Alternative: SMTP OAuth 2.0
- SMTP host: `smtp.office365.com`
- SMTP port: `587`
- STARTTLS enabled
- TLS certificate validation enabled
- SPF
- DKIM
- DMARC

## Backend Environment Variables

```text
NODE_ENV
PORT
DATABASE_URL
APP_URL
FRONTEND_URL
CORS_ORIGINS
FILE_SIGNING_SECRET
TOKEN_EXPIRY_DAYS
AUTH_LOGIN_2FA
AUTH_ENFORCE_EMAIL_VERIFICATION
AADHAAR_API_ENABLED
SUREPASS_BASE_URL
SUREPASS_BEARER_TOKEN
SUREPASS_TIMEOUT_MS
ADMIN_NOTIFICATION_EMAIL
EMAIL_DEBUG_LOGS
```

For temporary SMTP usage:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_EMAIL
SMTP_FROM_NAME
SMTP_SECURE
SMTP_ALLOW_INVALID_CERTS
```

Set `SMTP_ALLOW_INVALID_CERTS=false` in production.

## Frontend Build Variables

```text
VITE_API_URL=/api
VITE_SITE_URL=https://granvia.llc
VITE_EMAIL_CONFIRMATION_REDIRECT_URL=https://granvia.llc/employer
VITE_EMPLOYER_LOGIN_REDIRECT_URL=https://granvia.llc/employer
VITE_MAP_PROVIDER=leaflet
```

## External API Access

- SurePass DigiLocker API: outbound HTTPS `443`
- OpenStreetMap/Leaflet map tiles: outbound HTTPS `443`
- Nominatim geocoding API: outbound HTTPS `443`
- `api.pincodeapi.in`: outbound HTTPS `443`
- Microsoft Graph: outbound HTTPS `443`
- Outlook SMTP, if used: outbound TCP `587`

## Android App

- Expo 51
- React Native 0.74
- React Native WebView
- EAS Build
- Production URL: `https://granvia.llc/universal-app`
- Environment variable: `EXPO_PUBLIC_APP_URL`
- HTTPS only; disable Android cleartext traffic in production

## Future Payment Gateway

- Razorpay, Cashfree, Stripe, PayU, or selected provider
- Backend secret key
- Frontend public key
- HTTPS webhook endpoint
- Webhook signature verification
- SQS and dead-letter queue
- EventBridge Scheduler for reconciliation
- No card or UPI credentials stored by Granvia

## Future SMS Gateway

- AWS End User Messaging SMS, Twilio, MSG91, Gupshup, or selected provider
- Indian DLT registration
- Approved sender ID and message templates
- SQS and dead-letter queue
- Delivery-status webhook
- OTP and per-number rate limiting

## Required Before Go-Live

- Move local uploads to S3
- Create approved SQL Server baseline migration
- Configure production CORS or same-origin `/api` proxy
- Configure `APP_URL` and strong `FILE_SIGNING_SECRET`
- Set finite `TOKEN_EXPIRY_DAYS`
- Remove development OTP responses
- Remove hard-coded debug email CC recipients
- Disable or protect SMTP test endpoint
- Enable API rate limiting and security headers
- Fix frontend TypeScript errors

