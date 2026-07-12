import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { storeFile, IncomingFile } from '../utils/fileStorage';

// Port of App\Http\Controllers\CompanyController.

const baseFields = {
  business_type: z.string().nullish(),
  registration_type: z.string().nullish(),
  gst_number: z
    .string()
    .regex(/^[0-9A-Z]{15}$/i, 'The gst number format is invalid.')
    .nullish(),
  pan_number: z
    .string()
    .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, 'The pan number format is invalid.')
    .nullish(),
  company_email: z.string().email('The company email must be a valid email address.').nullish(),
  company_phone: z.string().nullish(),
  website: z.string().nullish(),
  description: z.string().nullish(),
  registered_address: z.string().nullish(),
  billing_address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().regex(/^\d{6}$/, 'The pincode format is invalid.').nullish(),
};

const createSchema = z.object({ company_name: z.string(), ...baseFields });
const updateSchema = z
  .object({ company_name: z.string(), ...baseFields, account_status: z.string() })
  .partial();

function normalizeCodes<T extends { gst_number?: string | null; pan_number?: string | null }>(d: T): T {
  if (d.gst_number) d.gst_number = d.gst_number.toUpperCase();
  if (d.pan_number) d.pan_number = d.pan_number.toUpperCase();
  return d;
}

function toColumns(d: Record<string, unknown>) {
  const map: Record<string, string> = {
    company_name: 'companyName',
    business_type: 'businessType',
    registration_type: 'registrationType',
    gst_number: 'gstNumber',
    pan_number: 'panNumber',
    company_email: 'companyEmail',
    company_phone: 'companyPhone',
    website: 'website',
    description: 'description',
    registered_address: 'registeredAddress',
    billing_address: 'billingAddress',
    city: 'city',
    state: 'state',
    pincode: 'pincode',
    account_status: 'accountStatus',
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (k in map) out[map[k]] = v;
  }
  return out;
}

async function ownedCompanyOrFail(id: string, userId: string) {
  const company = await prisma.employerCompany.findUnique({ where: { id } });
  if (!company) throw new HttpError(404, 'Not found.');
  if (company.employerUserId !== userId) throw new HttpError(403, 'Forbidden.');
  return company;
}

/** GET /employer/companies */
export async function index(req: Request, res: Response) {
  const companies = await prisma.employerCompany.findMany({
    where: { employerUserId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(snakeKeys(companies));
}

/** POST /employer/companies */
export async function store(req: Request, res: Response) {
  const data = normalizeCodes(createSchema.parse(req.body));
  const company = await prisma.employerCompany.create({
    data: {
      ...toColumns(data),
      companyName: data.company_name,
      employerUserId: req.user!.id,
      verificationStatus: 'pending',
      accountStatus: 'active',
    } as never,
  });
  return res.status(201).json(snakeKeys(company));
}

/** PATCH /employer/companies/:company */
export async function update(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const data = normalizeCodes(updateSchema.parse(req.body));
  const company = await prisma.employerCompany.update({
    where: { id: req.params.company },
    data: toColumns(data) as never,
  });
  return res.json(snakeKeys(company));
}

/** POST /employer/companies/:company/logo */
export async function uploadLogo(req: Request, res: Response) {
  await ownedCompanyOrFail(req.params.company, req.user!.id);
  const file = req.file as IncomingFile | undefined;

  if (!file) {
    throw new HttpError(422, 'The file field is required.', {
      errors: { file: ['The file field is required.'] },
    });
  }
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(422, 'The file must be an image.', {
      errors: { file: ['The file must be an image.'] },
    });
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new HttpError(422, 'The file must not be greater than 5120 kilobytes.', {
      errors: { file: ['The file must not be greater than 5120 kilobytes.'] },
    });
  }

  const stored = storeFile('company-logos', req.params.company, file);
  const company = await prisma.employerCompany.update({
    where: { id: req.params.company },
    data: { logoUrl: stored.url },
  });
  return res.json(snakeKeys(company));
}
