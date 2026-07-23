import nodemailer, { Transporter } from 'nodemailer';

// SMTP mail service (port of Laravel's Mail + send-email edge function).
// Reads SMTP_* env vars. When SMTP is not configured, sending is a no-op that
// logs — so dev works without a mail server (OTP endpoints return dev_otp).

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const fromEmail = process.env.SMTP_FROM_EMAIL ?? 'no-reply@granvia.local';
const fromName = process.env.SMTP_FROM_NAME ?? 'Granvia';

export const mailConfigured = Boolean(host && user && pass);

let transporter: Transporter | null = null;
if (mailConfigured) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
    auth: { user, pass },
  });
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.log(`[mail:skipped] to=${to} subject="${subject}" (SMTP not configured)`);
    return;
  }
  try {
    await transporter.sendMail({ from: `"${fromName}" <${fromEmail}>`, to, subject, html });
  } catch (err) {
    // Mail failures must never break the request flow (matches Laravel queue).
    // eslint-disable-next-line no-console
    console.error(`[mail:error] to=${to} subject="${subject}"`, (err as Error).message);
  }
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
     <h2 style="color:#166534">${title}</h2>${body}
     <p style="color:#888;font-size:12px;margin-top:32px">Granvia Associate Management</p>
   </div>`;

export function sendAadhaarOtp(to: string, otp: string): Promise<void> {
  return sendMail(
    to,
    'Your Granvia Aadhaar Verification OTP',
    wrap(
      'Aadhaar Verification',
      `<p>Your one-time verification code is:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otp}</p>
       <p>This code expires in 10 minutes.</p>`
    )
  );
}

export function sendEmployerWelcome(
  to: string,
  name: string,
  temporaryPassword: string | null,
  loginUrl: string
): Promise<void> {
  const creds = temporaryPassword
    ? `<p>You can sign in with:</p>
       <p><strong>Email:</strong> ${to}<br/><strong>Temporary password:</strong> ${temporaryPassword}</p>
       <p>Please change your password after your first login.</p>`
    : '';
  return sendMail(
    to,
    'Welcome to Granvia',
    wrap(
      `Welcome, ${name}`,
      `<p>Your employer account is ready.</p>${creds}
       <p><a href="${loginUrl}" style="color:#166534">Go to your dashboard</a></p>`
    )
  );
}

export function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
  return sendMail(
    to,
    'Verify your Granvia email address',
    wrap(
      `Hi ${name}`,
      `<p>Please confirm your email address to activate your Granvia account.</p>
       <p><a href="${verifyUrl}" style="display:inline-block;background:#166534;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>
       <p style="font-size:12px;color:#888">This link expires in 1 hour. If you didn't create an account, ignore this email.</p>`
    )
  );
}
