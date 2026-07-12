import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut, toPrismaData } from '../utils/serialize';

// Port of App\Http\Controllers\SiteController.

const JSON_FIELDS = ['address'];

const siteFields = {
  code: z.string().nullish(),
  address: z.array(z.any()).or(z.record(z.any())).nullish(),
  latitude: z.coerce.number().nullish(),
  longitude: z.coerce.number().nullish(),
  site_type: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().nullish(),
  contact_person: z.string().nullish(),
  contact_mobile: z.string().nullish(),
  shift_details: z.string().nullish(),
  notes: z.string().nullish(),
};

const createSchema = z.object({
  company_id: z.string().uuid(),
  site_name: z.string(),
  ...siteFields,
});

const updateSchema = z.object({ site_name: z.string(), status: z.string(), ...siteFields }).partial();

/** GET /employer/companies/:company/sites */
export async function index(req: Request, res: Response) {
  const company = await prisma.employerCompany.findUnique({ where: { id: req.params.company } });
  if (!company) throw new HttpError(404, 'Not found.');
  if (company.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const sites = await prisma.companySite.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(sites, JSON_FIELDS));
}

/** POST /employer/sites */
export async function store(req: Request, res: Response) {
  const data = createSchema.parse(req.body);

  const company = await prisma.employerCompany.findFirst({
    where: { id: data.company_id, employerUserId: req.user!.id },
  });
  if (!company) {
    throw new HttpError(404, 'Company not found or does not belong to you.');
  }

  const site = await prisma.companySite.create({
    data: {
      ...toPrismaData(data, JSON_FIELDS),
      employerUserId: req.user!.id,
      status: 'draft',
    } as never,
  });
  return res.status(201).json(serializeOut(site, JSON_FIELDS));
}

/** PATCH /employer/sites/:site */
export async function update(req: Request, res: Response) {
  const site = await prisma.companySite.findUnique({ where: { id: req.params.site } });
  if (!site) throw new HttpError(404, 'Not found.');
  if (site.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  const updated = await prisma.companySite.update({
    where: { id: site.id },
    data: toPrismaData(data, JSON_FIELDS) as never,
  });
  return res.json(serializeOut(updated, JSON_FIELDS));
}
