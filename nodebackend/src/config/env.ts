import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 8000);

export const env = {
  port,
  databaseUrl: required('DATABASE_URL'),
  appUrl: process.env.APP_URL ?? `http://127.0.0.1:${port}`,
  fileSigningSecret: process.env.FILE_SIGNING_SECRET ?? 'granvia-dev-file-secret',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  tokenExpiryDays: Number(process.env.TOKEN_EXPIRY_DAYS ?? 0),
  // Opt-in (default OFF): login requires a second-factor email OTP before a
  // token is issued. Enable only once the two-step UI is wired in every portal.
  loginOtpEnabled: /^(1|true|yes|on)$/i.test(process.env.AUTH_LOGIN_2FA ?? ''),
  // Opt-in (default OFF): users must verify their email (OTP) before login.
  // Enable (AUTH_ENFORCE_EMAIL_VERIFICATION=true) once the verify-code screen
  // is wired — otherwise new registrants get a code with nowhere to enter it.
  enforceEmailVerification: /^(1|true|yes|on)$/i.test(process.env.AUTH_ENFORCE_EMAIL_VERIFICATION ?? ''),
  // Opt-in (default OFF): automated/self-service Aadhaar verification (SurePass
  // sandbox + email-OTP self-verify). While OFF, Aadhaar is declared manually by
  // admins/employers. Turn on when the real Aadhaar API is integrated.
  aadhaarApiEnabled: /^(1|true|yes|on)$/i.test(process.env.AADHAAR_API_ENABLED ?? ''),
  surepass: {
    baseUrl: (process.env.SUREPASS_BASE_URL ?? 'https://sandbox.surepass.app').replace(/\/+$/, ''),
    bearerToken: process.env.SUREPASS_BEARER_TOKEN?.trim() ?? '',
    timeoutMs: Number(process.env.SUREPASS_TIMEOUT_MS ?? 15_000),
  },
};
