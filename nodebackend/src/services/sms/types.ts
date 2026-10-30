export type SmsTemplateKey =
  | 'registration_otp'
  | 'registration_success'
  | 'associate_onboarding'
  | 'job_assignment'
  | 'attendance_update'
  | 'wallet_transaction'
  | 'payment_update';

export type SmsDeliveryStatus = 'pending' | 'accepted' | 'failed' | 'unknown';

export interface SmsProviderRequest {
  to: string;
  message: string;
  providerTemplateId: string;
  dltEntityId?: string;
  correlationId?: string;
}

export interface SmsProviderResult {
  status: Exclude<SmsDeliveryStatus, 'pending'>;
  providerMessageId?: string;
  attempts: number;
}

export interface SmsProvider {
  readonly name: string;
  send(request: SmsProviderRequest): Promise<SmsProviderResult>;
}

export class SmsProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly transient = false,
    public readonly attempts = 1,
    public readonly deliveryStatus: 'failed' | 'unknown' = 'failed',
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }
}

export class SmsDeliveryError extends Error {
  constructor(public readonly code = 'sms_delivery_failed') {
    super('The verification message could not be sent. Please try again shortly.');
    this.name = 'SmsDeliveryError';
  }
}
