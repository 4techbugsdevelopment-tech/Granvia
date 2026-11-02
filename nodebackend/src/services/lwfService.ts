import { Prisma } from '@prisma/client';

export type EffectiveLwfSetting = {
  id: string;
  source: 'master' | 'employer';
  employeeAmount: Prisma.Decimal;
  employerAmount: Prisma.Decimal;
  status: string;
};

type LwfClient = Pick<Prisma.TransactionClient, 'lwfMasterSetting' | 'employerLwfSetting'>;

export async function resolveEffectiveLwfSetting(client: LwfClient, employerUserId: string): Promise<EffectiveLwfSetting | null> {
  const override = await client.employerLwfSetting.findUnique({ where: { employerUserId } });
  if (override) return { ...override, source: 'employer' };

  const master = await client.lwfMasterSetting.findUnique({ where: { scopeKey: 'STANDARD' } });
  return master ? { ...master, source: 'master' } : null;
}

type SalaryComponent = Record<string, unknown> & { code?: unknown };

export function applyEffectiveLwfSetting(raw: unknown, setting: EffectiveLwfSetting | null) {
  if (!raw || typeof raw !== 'object') return { input: raw, setting };
  const source = raw as { components?: unknown };
  if (!Array.isArray(source.components)) return { input: raw, setting };

  const managedCodes = new Set(['EMPLOYEE_LWF', 'EMPLOYER_LWF']);
  const components = source.components
    .filter(component => !managedCodes.has(String((component as SalaryComponent).code || '').toUpperCase()))
    .map(component => ({ ...(component as SalaryComponent) }));
  if (!setting) return { input: { ...(raw as Record<string, unknown>), components }, setting };

  const enabled = setting.status === 'active';
  const upsert = (code: string, name: string, category: 'deduction' | 'employer_contribution', fixedAmount: Prisma.Decimal, sortOrder: number) => {
    const normalized = {
      code,
      name,
      category,
      calculation_type: 'fixed' as const,
      fixed_amount: enabled ? fixedAmount.toFixed(2) : '0.00',
      percentage: null,
      percentage_basis: null,
      enabled,
      classification: 'mandatory' as const,
      statutory_code: code,
      applicability_min_gross: null,
      applicability_max_gross: null,
      monthly_cap: null,
      is_custom: false,
      sort_order: sortOrder,
    };
    const index = components.findIndex(component => String(component.code || '').toUpperCase() === code);
    if (index === -1) components.push(normalized);
    else components[index] = normalized;
  };

  upsert('EMPLOYEE_LWF', 'Employee Labour Welfare Fund (LWF)', 'deduction', setting.employeeAmount, 125);
  upsert('EMPLOYER_LWF', 'Employer Labour Welfare Fund (LWF)', 'employer_contribution', setting.employerAmount, 225);
  return { input: { ...(raw as Record<string, unknown>), components }, setting };
}
