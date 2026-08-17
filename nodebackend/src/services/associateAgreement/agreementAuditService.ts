import { Request } from 'express';
import { prisma } from '../../prisma';

type AuditContext = { ip?: Request['ip']; get(name: string): string | undefined };

export async function recordAgreementEvent(input: {
  agreementId: string;
  associatePartnerId: string;
  eventType: string;
  transactionId?: string | null;
  request?: AuditContext;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return prisma.associatePartnerAgreementAudit.create({
    data: {
      agreementId: input.agreementId,
      associatePartnerId: input.associatePartnerId,
      eventType: input.eventType,
      transactionId: input.transactionId ?? null,
      ipAddress: input.request?.ip ?? null,
      userAgent: input.request?.get('user-agent')?.slice(0, 1000) ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
