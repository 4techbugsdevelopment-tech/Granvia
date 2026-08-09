import nodemailer, { Transporter } from 'nodemailer';

// SMTP mail service.
// Supports both explicit SMTP_* and legacy MAIL_* env vars. SMTP_* wins when
// both are present so local overrides stay predictable.

type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  allowInvalidCerts: boolean;
};

export type MailSendReport = {
  configured: boolean;
  to: string;
  subject: string;
  messageId?: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
  pending?: string[];
  envelope?: {
    from?: string;
    to?: string[];
  };
  error?: string;
  provider?: {
    host: string;
    port: number;
    secure: boolean;
    fromEmail: string;
    fromName: string;
  };
};

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function resolveMailConfig(): MailConfig | null {
  const host = firstEnv('SMTP_HOST', 'MAIL_HOST');
  const user = firstEnv('SMTP_USER', 'MAIL_USERNAME');
  const pass = firstEnv('SMTP_PASSWORD', 'MAIL_PASSWORD');
  const fromEmail = firstEnv('SMTP_FROM_EMAIL', 'MAIL_FROM_ADDRESS') ?? 'no-reply@granvia.local';
  const fromName = firstEnv('SMTP_FROM_NAME', 'MAIL_FROM_NAME') ?? 'Granvia';

  if (!host || !user || !pass) {
    return null;
  }

  const port = parsePort(firstEnv('SMTP_PORT', 'MAIL_PORT'), 587);
  const secureFlag = firstEnv('SMTP_SECURE');
  const encryption = firstEnv('MAIL_ENCRYPTION');
  const allowInvalidCerts = parseBoolean(firstEnv('SMTP_ALLOW_INVALID_CERTS', 'MAIL_ALLOW_INVALID_CERTS'), false);

  return {
    host,
    port,
    user,
    pass,
    fromEmail,
    fromName,
    secure: encryption ? encryption.toLowerCase() === 'ssl' : parseBoolean(secureFlag, port === 465),
    allowInvalidCerts,
  };
}

const mailConfig = resolveMailConfig();

export const mailConfigured = Boolean(mailConfig);

let transporter: Transporter | null = null;
if (mailConfig) {
  transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: { user: mailConfig.user, pass: mailConfig.pass },
    tls: mailConfig.allowInvalidCerts ? { rejectUnauthorized: false } : undefined,
  });
}

async function sendMailDetailed(
  to: string,
  subject: string,
  html: string
): Promise<MailSendReport> {
  if (!transporter || !mailConfig) {
    const report: MailSendReport = {
      configured: false,
      to,
      subject,
      error: 'SMTP/MAIL env vars are not fully configured.',
    };
    // eslint-disable-next-line no-console
    console.log(`[mail:skipped] to=${to} subject="${subject}"`, report.error);
    return report;
  }

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: `"${mailConfig.fromName}" <${mailConfig.fromEmail}>`,
      to,
      subject,
      html,
    });

    return {
      configured: true,
      to,
      subject,
      messageId: info.messageId,
      response: info.response,
      accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : undefined,
      rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : undefined,
      pending: Array.isArray(info.pending) ? info.pending.map(String) : undefined,
      envelope: info.envelope
        ? {
            from: info.envelope.from ?? undefined,
            to: Array.isArray(info.envelope.to) ? info.envelope.to.map(String) : undefined,
          }
        : undefined,
      provider: {
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        fromEmail: mailConfig.fromEmail,
        fromName: mailConfig.fromName,
      },
    };
  } catch (err) {
    const message = (err as Error)?.message ?? 'Unknown SMTP error';
    // eslint-disable-next-line no-console
    console.error(`[mail:error] to=${to} subject="${subject}"`, message);
    return {
      configured: true,
      to,
      subject,
      error: message,
      provider: {
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        fromEmail: mailConfig.fromEmail,
        fromName: mailConfig.fromName,
      },
    };
  }
}

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  await sendMailDetailed(to, subject, html);
}

const wrap = (title: string, body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
     <h2 style="color:#166534">${title}</h2>${body}
     <p style="color:#888;font-size:12px;margin-top:32px">Granvia Associate Management</p>
   </div>`;

const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || 'admin@granvia.llc';

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

const OTP_COPY: Record<string, { subject: string; title: string; intro: string }> = {
  signup_verification: {
    subject: 'Verify your Granvia email',
    title: 'Confirm your email',
    intro: 'Use this code to verify your email and activate your Granvia account.',
  },
  password_reset: {
    subject: 'Your Granvia password reset code',
    title: 'Reset your password',
    intro: 'Use this code to reset your Granvia password. If you did not request this, ignore this email.',
  },
  login_2fa: {
    subject: 'Your Granvia login code',
    title: 'Login verification',
    intro: 'Use this code to complete your sign-in to Granvia.',
  },
  cash_payment: {
    subject: 'Your Granvia cash payment code',
    title: 'Confirm cash payment',
    intro: 'Share this code to confirm receipt of your cash payment.',
  },
};

/** Generic email OTP for signup verification, password reset, login 2FA and cash payment. */
export function sendOtpEmail(to: string, otp: string, purpose: string): Promise<void> {
  const copy = OTP_COPY[purpose] ?? {
    subject: 'Your Granvia verification code',
    title: 'Verification code',
    intro: 'Use this one-time code to continue.',
  };
  return sendMail(
    to,
    copy.subject,
    wrap(
      copy.title,
      `<p>${copy.intro}</p>
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

export function sendNewUserRegistrationAlert(input: {
  role: string;
  name: string;
  email: string;
  mobile: string;
}): Promise<void> {
  const { role, name, email, mobile } = input;
  return sendMail(
    adminNotificationEmail,
    `New Granvia registration: ${role}`,
    wrap(
      'New user registered',
      `<p>A new ${role} account has been created in Granvia.</p>
       <p><strong>Name:</strong> ${name}<br/>
       <strong>Email:</strong> ${email}<br/>
       <strong>Mobile:</strong> ${mobile}</p>
       <p>Please review the account and verify Aadhaar manually.</p>`
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

export function sendSmtpTestEmail(to: string): Promise<MailSendReport> {
  return sendMailDetailed(
    to,
    'Granvia SMTP test email',
    wrap(
      'SMTP Test',
      `<p>This is a test email sent from the Granvia backend.</p>
       <p>If you received this message, SMTP is working for this account.</p>
       <p><strong>Time:</strong> ${new Date().toISOString()}</p>`
    )
  );
}
