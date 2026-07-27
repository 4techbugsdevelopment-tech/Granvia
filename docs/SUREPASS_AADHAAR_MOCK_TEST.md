# Surepass Aadhaar mock test

This first integration phase creates a Surepass DigiLocker sandbox session and
shows the unmodified provider response. It does not yet mark an associate as
verified.

## Configuration

Add the account bearer token to `nodebackend/.env`:

```dotenv
SUREPASS_BASE_URL=https://sandbox.surepass.app
SUREPASS_BEARER_TOKEN=replace-with-a-current-sandbox-token
SUREPASS_TIMEOUT_MS=15000
```

Never put this token in a `VITE_*` variable or frontend source. Restart the
backend after changing `.env`.

## Test page

1. Start the backend and frontend.
2. Sign in through the Associate portal.
3. Open:

   `http://localhost:5173/guard/aadhaar/mock-test`

4. Select **Create mock session**.
5. Inspect **View complete response**, or select **Open hosted verification**.

The test page calls the authenticated Granvia endpoint:

`POST /api/guard/aadhaar/mock-session`

Only active users with the `guard` role can call it.

## Provider request

The backend calls:

`POST https://sandbox.surepass.app/api/v1/digilocker/initialize`

Expected success data includes a short-lived `client_id`, `token`, hosted
verification `url`, and `expiry_seconds`. Provider errors are returned by the
test endpoint under `upstream_response` so the sandbox response remains visible.

## Next phase

After the sandbox response and callback behavior are confirmed, replace the
associate's current instant-verification stub with this flow, validate the
Surepass completion server-side, persist the verification result, and make the
verification screen the post-login gate for unverified associates.
