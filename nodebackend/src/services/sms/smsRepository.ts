import { prisma } from '../../prisma';
import { SmsDeliveryStatus } from './types';

export type SmsMessageCreate = {
  id: string;
  recipientMasked: string;
  recipientDigest: string;
  templateKey: string;
  provider: string;
  status: SmsDeliveryStatus;
  correlationId?: string;
  purpose?: string;
};

export interface SmsMessageRepository {
  create(data: SmsMessageCreate): Promise<void>;
  complete(id: string, data: {
    status: Exclude<SmsDeliveryStatus, 'pending'>;
    providerMessageId?: string;
    attemptCount: number;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void>;
  findStatus(id: string): Promise<{
    id: string;
    status: SmsDeliveryStatus;
    providerMessageId?: string;
    attemptCount: number;
  } | null>;
}

export class PrismaSmsMessageRepository implements SmsMessageRepository {
  async create(data: SmsMessageCreate) {
    await prisma.smsMessage.create({ data });
  }

  async complete(id: string, data: {
    status: Exclude<SmsDeliveryStatus, 'pending'>;
    providerMessageId?: string;
    attemptCount: number;
    errorCode?: string;
    errorMessage?: string;
  }) {
    await prisma.smsMessage.update({ where: { id }, data });
  }

  async findStatus(id: string) {
    const message = await prisma.smsMessage.findUnique({
      where: { id },
      select: { id: true, status: true, providerMessageId: true, attemptCount: true },
    });
    return message ? {
      id: message.id,
      status: message.status as SmsDeliveryStatus,
      providerMessageId: message.providerMessageId ?? undefined,
      attemptCount: message.attemptCount,
    } : null;
  }
}
