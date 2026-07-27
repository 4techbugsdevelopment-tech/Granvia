import { Request, Response } from 'express';
import { env } from '../config/env';
import { initializeDigilockerSession } from '../services/surepassDigilockerService';

/** POST /guard/aadhaar/mock-session */
export async function createMockSession(_req: Request, res: Response) {
  const testPageUrl = `${env.frontendUrl.replace(/\/+$/, '')}/guard/aadhaar/mock-test`;
  const response = await initializeDigilockerSession({
    redirectUrl: `${testPageUrl}?surepass_return=1`,
    signupFlow: true,
    skipMainScreen: false,
    logoUrl: `${env.frontendUrl.replace(/\/+$/, '')}/granvia-logo.png`,
  });

  return res.json({
    provider: 'surepass',
    environment: 'sandbox',
    request: {
      endpoint: `${env.surepass.baseUrl}/api/v1/digilocker/initialize`,
      redirect_url: `${testPageUrl}?surepass_return=1`,
    },
    response,
  });
}
