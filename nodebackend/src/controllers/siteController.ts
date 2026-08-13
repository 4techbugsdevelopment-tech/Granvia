import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { serializeOut, toPrismaData } from '../utils/serialize';

// Port of App\Http\Controllers\SiteController.

// Older rows may contain a JSON-encoded address, so keep parsing it on output.
// New site forms send and store the address as a normal string.
const OUTPUT_JSON_FIELDS = ['address'];

const requiredText = (field: string) =>
  z.string({ required_error: `${field} is required.`, invalid_type_error: `${field} must be text.` })
    .trim()
    .min(1, `${field} is required.`);

const optionalText = (field: string) =>
  z.string({ invalid_type_error: `${field} must be text.` }).trim().nullish();

const mobile = z.string({
  required_error: 'Contact mobile is required.',
  invalid_type_error: 'Contact mobile must be text.',
}).trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10 digit Indian mobile number.');

const siteFields = {
  code: optionalText('Code'),
  address: requiredText('Site address'),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90.').max(90, 'Latitude must be between -90 and 90.').nullish(),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180.').max(180, 'Longitude must be between -180 and 180.').nullish(),
  site_type: optionalText('Site type'),
  city: optionalText('City'),
  state: optionalText('State'),
  pincode: z.string().trim().refine(value => value === '' || /^\d{6}$/.test(value), 'Enter a valid 6 digit pincode.').nullish(),
  contact_person: optionalText('Site contact'),
  contact_mobile: mobile,
  shift_details: optionalText('Shift details'),
  notes: optionalText('Notes'),
};

const createSchema = z.object({
  company_id: z.string({ required_error: 'Company is required.' }).uuid('The selected company is invalid.'),
  site_name: requiredText('Site name'),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  ...siteFields,
});

const updateSchema = z.object({
  site_name: requiredText('Site name'),
  status: z.enum(['draft', 'active', 'inactive']),
  ...siteFields,
}).partial();

/** GET /employer/companies/:company/sites */
export async function index(req: Request, res: Response) {
  const company = await prisma.employerCompany.findUnique({ where: { id: req.params.company } });
  if (!company) throw new HttpError(404, 'Not found.');
  if (company.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const sites = await prisma.companySite.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(serializeOut(sites, OUTPUT_JSON_FIELDS));
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
      ...toPrismaData(data),
      employerUserId: req.user!.id,
      status: data.status ?? 'draft',
    } as never,
  });
  return res.status(201).json(serializeOut(site, OUTPUT_JSON_FIELDS));
}

/** PATCH /employer/sites/:site */
export async function update(req: Request, res: Response) {
  const site = await prisma.companySite.findUnique({ where: { id: req.params.site } });
  if (!site) throw new HttpError(404, 'Not found.');
  if (site.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateSchema.parse(req.body);
  const updated = await prisma.companySite.update({
    where: { id: site.id },
    data: toPrismaData(data) as never,
  });
  return res.json(serializeOut(updated, OUTPUT_JSON_FIELDS));
}
