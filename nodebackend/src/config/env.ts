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
  surepass: {
    baseUrl: (process.env.SUREPASS_BASE_URL ?? 'https://sandbox.surepass.app').replace(/\/+$/, ''),
    bearerToken: process.env.SUREPASS_BEARER_TOKEN?.trim() ?? '',
    timeoutMs: Number(process.env.SUREPASS_TIMEOUT_MS ?? 15_000),
  },
};
