import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { snakeKeys } from '../utils/serialize';

// Port of App\Http\Controllers\InvoiceController.

/** GET /employer/invoices */
export async function index(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const invoices = await prisma.invoice.findMany({
    where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(invoices));
}
