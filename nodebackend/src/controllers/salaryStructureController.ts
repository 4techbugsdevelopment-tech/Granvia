import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { calculateSalaryStructure, salaryComponentSchema } from '../services/salaryStructureService';

const templateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).nullish(),
  components: z.array(salaryComponentSchema).min(1).max(50),
}).strict();

const ruleSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[A-Za-z][A-Za-z0-9_]*$/).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  category: z.enum(['deduction', 'employer_contribution']),
  percentage: z.union([z.string(), z.number()]).nullish(),
  percentage_basis: z.enum(['basic_salary', 'fixed_earnings', 'gross_salary']).nullish(),
  applicability_min_gross: z.union([z.string(), z.number()]).nullish(),
  applicability_max_gross: z.union([z.string(), z.number()]).nullish(),
  monthly_cap: z.union([z.string(), z.number()]).nullish(),
  enabled: z.boolean().default(true),
}).strict().superRefine((rule, context) => {
  const parsed = new Map<string, Prisma.Decimal>();
  for (const [key, raw] of [['percentage', rule.percentage], ['applicability_min_gross', rule.applicability_min_gross], ['applicability_max_gross', rule.applicability_max_gross], ['monthly_cap', rule.monthly_cap]] as const) {
    if (raw == null || raw === '') continue;
    try { const value = new Prisma.Decimal(raw); if (!value.isFinite() || value.isNegative()) throw new Error(); parsed.set(key, value); } catch { context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key.replace(/_/g, ' ')} must be non-negative.` }); }
  }
  if (parsed.get('percentage')?.greaterThan(100)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['percentage'], message: 'Percentage cannot exceed 100.' });
  if (rule.percentage != null && !rule.percentage_basis) context.addIssue({ code: z.ZodIssueCode.custom, path: ['percentage_basis'], message: 'Select a percentage calculation basis.' });
  const min = parsed.get('applicability_min_gross'), max = parsed.get('applicability_max_gross');
  if (min && max && min.greaterThan(max)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['applicability_max_gross'], message: 'Maximum applicable gross must be at least the minimum.' });
});

function templateComponents(components: z.infer<typeof salaryComponentSchema>[], templateId: string) {
  return components.map(component => ({ templateId, code: component.code, name: component.name, category: component.category, calculationType: component.calculation_type, fixedAmount: component.fixed_amount, percentage: component.percentage, percentageBasis: component.percentage_basis, enabled: component.enabled, classification: component.classification, statutoryCode: component.statutory_code, applicabilityMinGross: component.applicability_min_gross, applicabilityMaxGross: component.applicability_max_gross, monthlyCap: component.monthly_cap, isCustom: component.is_custom, sortOrder: component.sort_order }));
}

export async function templates(req: Request, res: Response) {
  const rows = await prisma.salaryStructureTemplate.findMany({ where: { employerUserId: req.user!.id }, include: { components: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } }, orderBy: { name: 'asc' } });
  return res.json(snakeKeys(rows));
}

export async function storeTemplate(req: Request, res: Response) {
  const data = templateSchema.parse(req.body);
  calculateSalaryStructure({ components: data.components });
  try {
    const row = await prisma.$transaction(async tx => {
      const template = await tx.salaryStructureTemplate.create({ data: { employerUserId: req.user!.id, name: data.name, description: data.description ?? null } });
      await tx.salaryTemplateComponent.createMany({ data: templateComponents(data.components, template.id) });
      return tx.salaryStructureTemplate.findUniqueOrThrow({ where: { id: template.id }, include: { components: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } });
    });
    return res.status(201).json(snakeKeys(row));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new HttpError(422, 'A salary template with this name already exists.');
    throw error;
  }
}

export async function updateTemplate(req: Request, res: Response) {
  const existing = await prisma.salaryStructureTemplate.findFirst({ where: { id: req.params.template, employerUserId: req.user!.id } });
  if (!existing) throw new HttpError(404, 'Salary template not found.');
  const data = templateSchema.parse(req.body); calculateSalaryStructure({ components: data.components });
  const row = await prisma.$transaction(async tx => {
    await tx.salaryStructureTemplate.update({ where: { id: existing.id }, data: { name: data.name, description: data.description ?? null } });
    await tx.salaryTemplateComponent.deleteMany({ where: { templateId: existing.id } });
    await tx.salaryTemplateComponent.createMany({ data: templateComponents(data.components, existing.id) });
    return tx.salaryStructureTemplate.findUniqueOrThrow({ where: { id: existing.id }, include: { components: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } });
  });
  return res.json(snakeKeys(row));
}

export async function deleteTemplate(req: Request, res: Response) {
  const result = await prisma.salaryStructureTemplate.deleteMany({ where: { id: req.params.template, employerUserId: req.user!.id } });
  if (!result.count) throw new HttpError(404, 'Salary template not found.');
  return res.json({ message: 'Salary template deleted.' });
}

export async function statutoryRules(req: Request, res: Response) {
  return res.json(snakeKeys(await prisma.salaryStatutoryRule.findMany({ where: { employerUserId: req.user!.id }, orderBy: { code: 'asc' } })));
}

export async function saveStatutoryRule(req: Request, res: Response) {
  const data = ruleSchema.parse(req.body);
  const payload = { name: data.name, category: data.category, percentage: data.percentage == null ? null : new Prisma.Decimal(data.percentage), percentageBasis: data.percentage_basis ?? null, applicabilityMinGross: data.applicability_min_gross == null ? null : new Prisma.Decimal(data.applicability_min_gross), applicabilityMaxGross: data.applicability_max_gross == null ? null : new Prisma.Decimal(data.applicability_max_gross), monthlyCap: data.monthly_cap == null ? null : new Prisma.Decimal(data.monthly_cap), enabled: data.enabled };
  const row = await prisma.salaryStatutoryRule.upsert({ where: { employerUserId_code: { employerUserId: req.user!.id, code: data.code } }, create: { employerUserId: req.user!.id, code: data.code, ...payload }, update: payload });
  return res.json(snakeKeys(row));
}
