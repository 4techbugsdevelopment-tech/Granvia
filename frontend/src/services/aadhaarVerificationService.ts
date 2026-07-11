import { apiClient } from '../lib/apiClient';

const AADHAAR_FORMAT = /^\d{12}$/;
const OTP_FORMAT = /^\d{6}$/;

export async function getAadhaarStatus() {
  try {
    const { data } = await apiClient.get('/employer/aadhaar');
    return data;
  } catch {
    return null;
  }
}

/** Mock instant Aadhaar verification — enter number, approved immediately. */
export async function verifyAadhaarInstant(aadhaarNumber: string) {
  if (!AADHAAR_FORMAT.test(aadhaarNumber.trim())) {
    throw new Error('Enter a valid 12-digit Aadhaar number.');
  }
  const { data } = await apiClient.post('/employer/aadhaar/verify-instant', { aadhaar_number: aadhaarNumber.trim() });
  return data;
}

export async function sendAadhaarOtp(aadhaarNumber: string): Promise<{ sentTo: string; devOtp?: string }> {
  if (!AADHAAR_FORMAT.test(aadhaarNumber.trim())) {
    throw new Error('Enter a valid 12-digit Aadhaar number.');
  }

  const { data } = await apiClient.post('/employer/aadhaar/send-otp', { aadhaar_number: aadhaarNumber.trim() });

  return { sentTo: data.sent_to, devOtp: data.dev_otp };
}

export async function verifyAadhaarOtp(otp: string) {
  if (!OTP_FORMAT.test(otp.trim())) {
    throw new Error('Enter a valid 6-digit OTP.');
  }

  const { data } = await apiClient.post('/employer/aadhaar/verify-otp', { otp: otp.trim() });
  return data;
}
