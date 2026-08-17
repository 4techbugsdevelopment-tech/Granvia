import { apiClient } from '../lib/apiClient';

export interface AgreementEligibility {
  eligible: boolean;
  profile_complete: boolean;
  documents_complete: boolean;
  kyc_complete: boolean;
  missing_profile_fields: string[];
  missing_documents: string[];
}

export interface AssociateAgreement {
  id: string;
  agreement_number: string;
  agreement_version: string;
  template_version: string;
  status: string;
  agreement_generated_at: string;
  original_document_hash: string;
  signed_document_hash: string | null;
  consent_given: boolean;
  consent_given_at: string | null;
  esign_provider: string | null;
  esign_transaction_id: string | null;
  esign_initiated_at: string | null;
  esign_completed_at: string | null;
  signature_verified_at: string | null;
  production_verified: boolean;
  failure_code: string | null;
  failure_reason: string | null;
  locked_at: string | null;
}

export interface AgreementState {
  status: string;
  agreement: AssociateAgreement | null;
  eligibility: AgreementEligibility;
  sandbox_mode: boolean;
}

export async function getAgreement(): Promise<AgreementState> {
  const { data } = await apiClient.get('/guard/agreement');
  return data;
}

export async function generateAgreement(): Promise<AgreementState> {
  const { data } = await apiClient.post('/guard/agreement/generate');
  return data;
}

export async function giveAgreementConsent(agreementId: string): Promise<AgreementState> {
  const { data } = await apiClient.post('/guard/agreement/consent', { consent: true, agreement_id: agreementId });
  return data;
}

export async function initiateAgreementEsign() {
  const { data } = await apiClient.post('/guard/agreement/esign/initiate');
  return data as { status: string; transaction_id: string; signing_url: string | null; sandbox_mode: boolean; reused?: boolean };
}

export async function completeSandboxEsign(): Promise<AgreementState> {
  const { data } = await apiClient.post('/guard/agreement/esign/sandbox-complete');
  return data;
}

export async function fetchAgreementPdf(): Promise<Blob> {
  const { data } = await apiClient.get('/guard/agreement/download', { responseType: 'blob' });
  return data;
}
