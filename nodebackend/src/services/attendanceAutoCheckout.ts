import { prisma } from '../prisma';

const AUTO_CHECKOUT_INTERVAL_MS = 60_000;

export function parseDutyHours(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  return Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : null;
}

export function scheduledCheckout(inTime: Date, dutyHours: string | null | undefined): Date | null {
  const hours = parseDutyHours(dutyHours);
  return hours == null ? null : new Date(inTime.getTime() + hours * 3_600_000);
}

export async function autoCheckoutExpiredAttendance(): Promise<number> {
  const now = new Date();

  // Backfill a planned checkout for open legacy records created before this feature.
  const unscheduled = await prisma.attendanceRecord.findMany({
    where: { outTime: null, scheduledOutTime: null, inTime: { not: null }, jobId: { not: null } },
    include: { job: { select: { dutyHours: true } } },
    take: 500,
  });

  for (const record of unscheduled) {
    if (!record.inTime) continue;
    const planned = scheduledCheckout(record.inTime, record.job?.dutyHours);
    if (planned) {
      await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { scheduledOutTime: planned },
      });
    }
  }

  const expired = await prisma.attendanceRecord.findMany({
    where: { outTime: null, scheduledOutTime: { lte: now } },
    select: { id: true, inTime: true, scheduledOutTime: true },
    take: 500,
  });

  let updated = 0;
  for (const record of expired) {
    if (!record.inTime || !record.scheduledOutTime) continue;
    const totalHours = Math.round(
      ((record.scheduledOutTime.getTime() - record.inTime.getTime()) / 3_600_000) * 100
    ) / 100;
    const result = await prisma.attendanceRecord.updateMany({
      where: { id: record.id, outTime: null },
      data: {
        outTime: record.scheduledOutTime,
        totalHours,
        checkoutMethod: 'automatic',
      },
    });
    updated += result.count;
  }

  return updated;
}

export function startAttendanceAutoCheckout() {
  const run = () => {
    void autoCheckoutExpiredAttendance().catch((error) => {
      console.error('Attendance auto-checkout failed', error);
    });
  };

  run();
  const timer = setInterval(run, AUTO_CHECKOUT_INTERVAL_MS);
  timer.unref();
}
