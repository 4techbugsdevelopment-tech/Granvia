import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { registrationOtpService } from '../services/sms/registrationOtpService';
import { indianMobileSchema } from '../utils/validation';

export const requestRegistrationOtpSchema = z.object({
  mobile: indianMobileSchema,
  registration_session_id: z.string().uuid().optional(),
});

export const verifyRegistrationOtpSchema = z.object({
  mobile: indianMobileSchema,
  registration_session_id: z.string().uuid(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
});

export async function registrationOtpConfig(_req: Request, res: Response) {
  return res.json({
    enabled: env.sms.registrationOtpEnabled,
    otp_expires_in: env.sms.otpTtlSeconds,
    resend_cooldown: env.sms.resendCooldownSeconds,
  });
}

export async function requestRegistrationOtp(req: Request, res: Response) {
  const data = requestRegistrationOtpSchema.parse(req.body);
  const result = await registrationOtpService.request({
    mobile: data.mobile,
    sessionId: data.registration_session_id,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
  });
  return res.status(201).json({ message: `Verification code sent to ${result.masked_mobile}.`, ...result });
}

export async function verifyRegistrationOtp(req: Request, res: Response) {
  const data = verifyRegistrationOtpSchema.parse(req.body);
  return res.json(await registrationOtpService.verify({
    mobile: data.mobile,
    sessionId: data.registration_session_id,
    otp: data.otp,
  }));
}
