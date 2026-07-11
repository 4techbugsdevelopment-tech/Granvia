import { apiClient } from '../lib/apiClient';

// ── Guard documents ───────────────────────────────────────────────────────────

export type GuardDocumentType = 'id_proof' | 'police_verification' | 'bank_proof' | 'other';

export const GUARD_DOCUMENT_LABELS: Record<GuardDocumentType, string> = {
  id_proof: 'ID Proof',
  police_verification: 'Police Verification',
  bank_proof: 'Bank Proof',
  other: 'Other',
};

export async function listMyDocuments() {
  const { data } = await apiClient.get('/guard/documents');
  return data ?? [];
}

export async function uploadMyDocument(documentType: GuardDocumentType, file: File) {
  const form = new FormData();
  form.append('document_type', documentType);
  form.append('file', file);
  const { data } = await apiClient.post('/guard/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Admin side
export async function listGuardDocuments(guardUserId: string) {
  const { data } = await apiClient.get(`/admin/guards/${guardUserId}/documents`);
  return data ?? [];
}

export async function reviewGuardDocument(documentId: string, status: 'verified' | 'rejected' | 'pending', remarks?: string) {
  const { data } = await apiClient.patch(`/admin/guard-documents/${documentId}`, {
    status,
    admin_remarks: remarks,
  });
  return data;
}

// ── Guard Aadhaar (email-OTP interim; same contract for the real API later) ──

export async function getMyAadhaarStatus() {
  const { data } = await apiClient.get('/guard/aadhaar');
  return data;
}

/** Mock instant Aadhaar verification — enter number, approved immediately. */
export async function verifyAadhaarInstant(aadhaarNumber: string) {
  const { data } = await apiClient.post('/guard/aadhaar/verify-instant', { aadhaar_number: aadhaarNumber });
  return data as { aadhaar_status: string; aadhaar_last_four: string; verified_at: string };
}

export async function sendAadhaarOtp(aadhaarNumber: string) {
  const { data } = await apiClient.post('/guard/aadhaar/send-otp', { aadhaar_number: aadhaarNumber });
  return data as { sent_to: string; verification_id: string; dev_otp?: string };
}

export async function verifyAadhaarOtp(otp: string) {
  const { data } = await apiClient.post('/guard/aadhaar/verify-otp', { otp });
  return data;
}
