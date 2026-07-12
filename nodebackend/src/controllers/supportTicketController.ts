import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';

// Port of App\Http\Controllers\SupportTicketController.

const createSchema = z.object({
  company_id: z.string().uuid().nullish(),
  subject: z.string(),
  priority: z.string().nullish(),
  message: z.string(),
});

function ticketNumber(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[bytes[i] % alphabet.length];
  return `TCK-${s}`;
}

/** GET /me/support-tickets */
export async function index(req: Request, res: Response) {
  const rows = await prisma.supportTicket.findMany({
    where: { userId: req.user!.id },
    include: { messages: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(rows));
}

/** POST /me/support-tickets */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        userId: req.user!.id,
        companyId: data.company_id ?? null,
        ticketNumber: ticketNumber(),
        subject: data.subject,
        description: data.message,
        priority: data.priority ?? 'medium',
        status: 'open',
      },
    });
    await tx.supportTicketMessage.create({
      data: { ticketId: created.id, senderId: req.user!.id, message: data.message },
    });
    return created;
  });

  const withMessages = await prisma.supportTicket.findUnique({
    where: { id: ticket.id },
    include: { messages: true },
  });
  return res.status(201).json(snakeKeys(withMessages));
}
