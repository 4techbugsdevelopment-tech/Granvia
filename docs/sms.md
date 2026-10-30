# Granvia SMS Gateway and Registration OTP

Status: implemented and locally validated on 2026-10-30; not deployed; no live SMS sent  
Provider: PowerText HTTP API, with a mock provider for development and automated tests  
Phase 1: mobile OTP verification before Associate Partner registration

Provider-account update on 2026-10-30: the Sender ID, transactional route ID,
DLT entity ID, and DLT template ID supplied by the account owner were added to
the ignored backend `.env` only. The reported SMS balance was 50 messages; this
is an informational snapshot, not a live balance check. SMS remains disabled.

## 1. Repository audit

Granvia uses a React/Vite/TypeScript application in `frontend` and an Express/TypeScript API in `nodebackend`. The backend uses Prisma 7 with SQL Server, Zod request validation, the shared `HttpError` response convention, Express authentication middleware, a process-local rate limiter, Prisma-backed notifications, and an existing email delivery/OTP system.

Registration is implemented in:

- `frontend/src/universal-mobile/UniversalLogin.tsx` for the shared Employer/Associate Partner registration form.
- `frontend/src/services/authService.ts` for API calls.
- `nodebackend/src/controllers/authController.ts` for `/api/auth/register/employer` and `/api/auth/register/guard`.
- `nodebackend/prisma/schema.prisma` for `User`, `GuardProfile`, and related models.

Before this implementation, registration created the account and then sent an email OTP. Email OTP persistence was already hashed and single-use, but there was no pre-registration mobile verification or mobile-bound registration grant. Other OTP uses (email signup, password reset, login 2FA, Aadhaar flows, and cash confirmation) remain unchanged.

## 2. Implemented architecture

The provider-independent entry point is:

```ts
await smsService.sendTemplate({
  to: '+919876543210',
  templateKey: 'registration_otp',
  variables: { otp: '123456', ttl_minutes: 5 },
  correlationId: challengeId,
  purpose: 'registration',
});
```

Stored delivery state can be read internally with:

```ts
await smsService.getDeliveryStatus({ messageId });
```

Core files:

- `nodebackend/src/services/sms/types.ts`: provider-independent contracts and safe errors.
- `nodebackend/src/services/sms/config.ts`: readiness checks and production safeguards.
- `nodebackend/src/services/sms/templateManager.ts`: approved template mapping and variable rendering.
- `nodebackend/src/services/sms/providers/powerTextProvider.ts`: PowerText adapter.
- `nodebackend/src/services/sms/providers/mockProvider.ts`: non-network adapter.
- `nodebackend/src/services/sms/smsService.ts`: central send/status service.
- `nodebackend/src/services/sms/smsRepository.ts`: Prisma delivery-log persistence.
- `nodebackend/src/services/sms/registrationOtpService.ts`: OTP/grant workflow.
- `nodebackend/src/services/sms/registrationOtpRepository.ts`: atomic SQL Server operations.
- `nodebackend/src/services/sms/crypto.ts`: HMAC digests, constant-time comparison, and masking.
- `nodebackend/src/controllers/registrationSmsController.ts`: public registration OTP endpoints.

The PowerText adapter uses backend-only configuration, URL-encoded requests, a bounded timeout, and configurable retries. It retries only explicit HTTP 429 throttling responses. It does not automatically retry timeouts or transport failures because provider acceptance is ambiguous and a retry could deliver a duplicate OTP. Ambiguous results are stored as `unknown`; explicit rejection is stored as `failed`.

No message body, OTP, full mobile number, provider credential, or raw provider response is persisted in `sms_messages`.

## 3. Database migration

Migration:

`nodebackend/prisma/migrations/20261030190000_sms_registration_otp/migration.sql`

Tables:

- `sms_messages`: masked recipient, recipient digest, template, provider reference, status, attempts, correlation, and sanitized error.
- `sms_otp_challenges`: HMAC-protected OTP, mobile/IP digests, session binding, expiry, cooldown, attempts, consumed/invalidated state.
- `sms_verification_grants`: HMAC-protected short-lived grant, mobile/session binding, and single-use state.

Filtered unique indexes allow only one active challenge and one active grant per mobile/purpose/registration session. Prisma transactions use serializable isolation for challenge creation, OTP consumption/grant creation, and Associate Partner registration.

The migration has been generated and the Prisma client/build have been validated locally. The migration has not been applied to any database.

## 4. API endpoints

All endpoints are under the existing `/api` prefix.

### Read public OTP policy

`GET /api/auth/registration/mobile-otp/config`

Response:

```json
{
  "enabled": true,
  "otp_expires_in": 300,
  "resend_cooldown": 60
}
```

### Request or resend OTP

`POST /api/auth/registration/mobile-otp/request`

First request:

```json
{
  "mobile": "9876543210"
}
```

Resend uses the returned session:

```json
{
  "mobile": "9876543210",
  "registration_session_id": "96fbd970-e36a-4f25-8375-9315ba2c4f04"
}
```

Success (`201`):

```json
{
  "message": "Verification code sent to +91******3210.",
  "registration_session_id": "96fbd970-e36a-4f25-8375-9315ba2c4f04",
  "masked_mobile": "+91******3210",
  "expires_in": 300,
  "resend_after": 60
}
```

`dev_otp` is returned only when all of the following are true: provider is `mock`, `SMS_MOCK_EXPOSE_OTP=true`, and `NODE_ENV` is not `production`.

### Verify OTP and issue registration grant

`POST /api/auth/registration/mobile-otp/verify`

```json
{
  "mobile": "9876543210",
  "registration_session_id": "96fbd970-e36a-4f25-8375-9315ba2c4f04",
  "otp": "123456"
}
```

Success (`200`):

```json
{
  "message": "Mobile number verified.",
  "mobile_verification_grant": "opaque-single-use-token",
  "grant_expires_in": 600
}
```

### Complete Associate Partner registration

The existing endpoint remains `POST /api/auth/register/guard`. When the feature flag is enabled, the existing payload must additionally contain:

```json
{
  "registration_session_id": "96fbd970-e36a-4f25-8375-9315ba2c4f04",
  "mobile_verification_grant": "opaque-single-use-token"
}
```

The backend validates that the grant is unexpired, unconsumed, and bound to the same normalized mobile and registration session. It consumes the grant inside the same serializable transaction that creates the user/profile. Frontend state manipulation cannot bypass this check.

When `SMS_REGISTRATION_OTP_ENABLED=false`, these two new registration fields remain optional and the previous Associate Partner registration behavior is preserved. Employer registration is not changed.

## 5. OTP and abuse policy

- OTP: cryptographically generated six digits.
- OTP lifetime: 300 seconds by default.
- Resend cooldown: 60 seconds by default.
- Incorrect verification attempts: maximum five.
- Verification grant lifetime: 600 seconds by default.
- Resend invalidates the previous active OTP and any unconsumed grant for that session.
- Successful verification consumes the challenge atomically.
- Registration consumes the grant atomically.
- Limits are enforced by mobile digest and IP digest in SQL Server, with an additional process-local route limiter.
- Concurrent request/verify/register operations use conditional writes, filtered unique indexes, and serializable transactions.
- API errors never include OTP values, secrets, raw provider responses, or full recipient numbers.

The process-local limiter is defense in depth only. In a multi-instance deployment, the SQL-backed limits remain shared; the reverse proxy/WAF should also enforce request limits.

## 6. Environment variables

All values belong only in the backend environment. Never add them to `VITE_*` frontend variables.

```dotenv
SMS_ENABLED=false
SMS_PROVIDER=mock
SMS_REGISTRATION_OTP_ENABLED=false
SMS_MOCK_EXPOSE_OTP=false
SMS_OTP_HASH_SECRET=<at-least-32-random-characters>
SMS_OTP_TTL_SECONDS=300
SMS_OTP_GRANT_TTL_SECONDS=600
SMS_OTP_RESEND_COOLDOWN_SECONDS=60
SMS_OTP_MAX_ATTEMPTS=5
SMS_OTP_MAX_SENDS_PER_HOUR=5
SMS_OTP_MAX_REQUESTS_PER_IP_PER_HOUR=20
SMS_OTP_MAX_VERIFY_REQUESTS_PER_IP_PER_15_MIN=30
SMS_TIMEOUT_MS=10000
SMS_MAX_RETRIES=2
SMS_RETRY_BASE_DELAY_MS=250

POWERTEXT_BASE_URL=https://bulk.powerstext.in
POWERTEXT_SEND_PATH=<confirmed-account-send-path>
POWERTEXT_HTTP_METHOD=POST
POWERTEXT_AUTH_KEY=<secret>
POWERTEXT_SENDER_ID=<approved-sender-id>
POWERTEXT_ROUTE_ID=<approved-transactional-route>
POWERTEXT_DLT_ENTITY_ID=<approved-entity-id>
POWERTEXT_OTP_TEMPLATE_ID=<approved-template-id>
SMS_TEMPLATE_REGISTRATION_OTP=<exact-approved-DLT-text-with-{{otp}}-and-supported-variables>
```

Production refuses to use the mock provider for registration OTP. Registration OTP also refuses to start unless SMS is enabled, the HMAC secret is sufficiently long, the OTP placeholder exists, and all required PowerText/DLT settings are present.

## 7. PowerText and DLT requirements

The current adapter maps the supplied PowerText contract to these URL-encoded fields:

- `authentic-key`
- `senderid`
- `route`
- `number`
- `message`
- `templateid`
- `entityid`

Before staging or production activation, confirm the exact base host, send path, HTTP method, parameter names, route value, entity ID, sender ID, template ID, and success/error response format in the Granvia PowerText account documentation. The original supplied material did not establish the exact send path, so live provider compatibility is not claimed yet.

The value of `SMS_TEMPLATE_REGISTRATION_OTP` must exactly match the approved DLT template, including punctuation, spacing, brand name, and variable positions. Only the transactional route approved for that template may be configured.

## 8. Frontend behavior

Associate Partner registration now:

1. Loads the backend feature policy.
2. Validates and normalizes the Indian mobile number.
3. Requests the OTP and displays only the masked number.
4. Shows the 60-second resend countdown.
5. Accepts a six-digit code with loading/error/success states.
6. Stores the opaque grant only in component memory.
7. Clears verification if the mobile number or registration role changes.
8. Submits the session/grant with the existing registration payload.
9. Continues the existing post-registration email verification flow.

If the policy endpoint cannot be loaded, Associate Partner registration fails closed and asks the user to refresh. Employer registration remains available.

## 9. Tests and local validation

Automated SMS tests use fake/in-memory components and never call PowerText.

Command:

```powershell
cd C:\reactprojects\granvia\nodebackend
npm.cmd run test:sms
```

Result on 2026-10-30: 13 passed, 0 failed. Coverage includes:

- successful request/verification;
- template rendering, masked message logs, and stored status lookup;
- safe handling of ambiguous provider failures;
- malformed mobile numbers;
- incorrect code and five-attempt lockout;
- expiry;
- resend cooldown and previous-code invalidation;
- per-mobile rate limit;
- replay prevention;
- concurrent request and concurrent verification races;
- provider failure invalidation;
- mobile/session-bound grant and registration bypass attempts;
- flag-off regression for the existing registration flow.

Additional results:

- `nodebackend`: `npm.cmd run build` passed (Prisma generate + TypeScript build).
- `frontend`: `npm.cmd run build` passed.
- `frontend`: broad `npm.cmd run typecheck` still reports unrelated pre-existing errors in Employer/Admin modules; no error was reported in the changed SMS/registration files.
- No database migration was applied, no deployment was performed, and no live SMS was sent.

On this Windows host, `tsx` can fail before tests start with `uv_os_get_passwd returned ENOMEM`. The successful run used a temporary `NODE_OPTIONS` test shim for `os.userInfo`; the shim was removed immediately afterward and is not part of the implementation.

## 10. Deployment procedure

Keep both feature flags false until the migration and provider configuration are complete.

1. Back up the production SQL Server database and record the application release identifier.
2. Deploy the backend source.
3. Install, migrate, and build:

```powershell
cd C:\reactprojects\granvia\nodebackend
npm.cmd ci
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
npm.cmd run build
```

4. Restart the backend with Granvia's configured service manager and verify:

```powershell
curl.exe https://aip.granvia.llc/api/health
curl.exe https://aip.granvia.llc/api/auth/registration/mobile-otp/config
```

5. Deploy the frontend:

```powershell
cd C:\reactprojects\granvia\frontend
npm.cmd ci
npm.cmd run build
```

6. In staging, first set `SMS_ENABLED=true`, `SMS_PROVIDER=mock`, `SMS_REGISTRATION_OTP_ENABLED=true`, and keep `SMS_MOCK_EXPOSE_OTP` limited to an approved non-production test environment.
7. Complete a request, verify, registration, replay, cooldown, and provider-failure smoke test.
8. Confirm the exact PowerText contract and DLT approval. Set `SMS_PROVIDER=powertext`, configure secrets server-side, restart, and send to an explicitly approved test number only after authorization.
9. Enable `SMS_REGISTRATION_OTP_ENABLED=true` in production only after the migration, backend/frontend releases, DLT mapping, and controlled live smoke test are verified.

Do not use `prisma migrate reset`, `migrate fresh`, destructive rollback, or seed commands in production.

## 11. Rollback procedure

Fast, non-destructive rollback:

1. Set `SMS_REGISTRATION_OTP_ENABLED=false` and restart the backend.
2. Verify the config endpoint returns `"enabled": false`.
3. If needed, restore the previous frontend/backend release.
4. Leave the three SMS tables in place; they are inert while the flag is off and preserve audit data.

Database removal is not required for application rollback. If the SMS schema must later be removed, first back up and confirm retention/audit requirements, then drop in dependency-safe order:

```sql
DROP TABLE [sms_verification_grants];
DROP TABLE [sms_otp_challenges];
DROP TABLE [sms_messages];
```

That SQL is destructive and must not be run as part of a routine production rollback.

## 12. Future event integration

The following keys are reserved but intentionally inactive:

- `registration_success`
- `associate_onboarding`
- `job_assignment`
- `attendance_update`
- `wallet_transaction`
- `payment_update`

To activate a future event:

1. Obtain the approved DLT template ID, exact text, sender, route, and recipient policy.
2. Add a disabled-by-default feature flag.
3. Add its definition to `SmsTemplateManager`.
4. Call only `smsService.sendTemplate(...)` from the business workflow; never call PowerText directly.
5. Add mock-provider tests, idempotency rules, failure behavior, consent/legal review where applicable, and rollout documentation.
6. Do not activate the event until its DLT mapping and staging behavior are verified.

## 13. Implementation journal

| Date | Stage | Files/results | Status |
|---|---|---|---|
| 2026-10-30 | Audit | Registration, auth, Prisma, validation, rate limiting, logging, notifications, and existing OTP flows reviewed; original `docs/sms.md` read completely | Complete |
| 2026-10-30 | Persistence/config | Prisma models, SQL Server migration, backend-only environment configuration | Complete locally; migration not deployed |
| 2026-10-30 | SMS library | PowerText/mock providers, template manager, send/status service, masked logging, retries/timeouts/errors | Complete locally |
| 2026-10-30 | Registration OTP | Request/verify APIs, HMAC challenges, cooldown/rates, atomic grants, associate registration enforcement | Complete locally |
| 2026-10-30 | React integration | Associate OTP request/verify/countdown/loading/error/success states | Complete locally |
| 2026-10-30 | Validation | 13 focused tests plus backend and frontend production builds | Passed |
| 2026-10-30 | External activation | PowerText path/contract, exact DLT text, auth key, migration, deployment, controlled live SMS | Pending approval/configuration |
| 2026-10-30 | Provider account values | Sender, transactional route, DLT entity/template IDs stored in ignored backend `.env`; reported balance 50 | Recorded; SMS remains disabled |
