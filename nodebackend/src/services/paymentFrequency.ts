import { HttpError } from '../utils/http';

export type PeriodPaymentFrequency = 'Weekly' | 'Monthly';

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export function payrollPeriodFrequency(periodStart: Date, periodEnd: Date): PeriodPaymentFrequency {
  const start = new Date(`${dateKey(periodStart)}T00:00:00.000Z`);
  const end = new Date(`${dateKey(periodEnd)}T00:00:00.000Z`);
  const inclusiveDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (inclusiveDays === 7) return 'Weekly';

  const lastOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  if (start.getUTCDate() === 1 && dateKey(end) === dateKey(lastOfMonth)) return 'Monthly';

  throw new HttpError(422, 'A payroll period must be exactly seven calendar days for Weekly jobs or one complete calendar month for Monthly jobs. Partial-period proration is not configured.');
}

export function assertPayrollPeriodClosed(periodEnd: Date, now = new Date()) {
  const todayInIndia = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  if (dateKey(periodEnd) >= todayInIndia) {
    throw new HttpError(422, 'The payroll period must be complete before preview or payout. Select a period ending before today.');
  }
}
