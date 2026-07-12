import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';

// Guard-facing subset of Laravel's AttendanceController.

const jobInclude = { job: { select: { id: true, title: true } } };

const checkInSchema = z.object({
  job_id: z.string().uuid().nullish(),
  guard_remarks: z.string().nullish(),
});

const checkOutSchema = z.object({
  guard_remarks: z.string().nullish(),
});

const HIRED_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined'];

function todayDateOnly(): Date {
  const iso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return new Date(`${iso}T00:00:00.000Z`);
}

/** GET /guard/attendance */
export async function guardIndex(req: Request, res: Response) {
  const records = await prisma.attendanceRecord.findMany({
    where: { guardUserId: req.user!.id },
    include: jobInclude,
    orderBy: [{ attendanceDate: 'desc' }, { inTime: 'desc' }],
  });

  return res.json(snakeKeys(records));
}

/** POST /guard/attendance/check-in */
export async function checkIn(req: Request, res: Response) {
  const data = checkInSchema.parse(req.body);
  const guardId = req.user!.id;
  const today = todayDateOnly();

  const existing = await prisma.attendanceRecord.findFirst({
    where: {
      guardUserId: guardId,
      attendanceDate: today,
      ...(data.job_id ? { jobId: data.job_id } : {}),
    },
  });

  if (existing) {
    throw new HttpError(422, 'Attendance already marked for today.');
  }

  let job = null;
  if (data.job_id) {
    job = await prisma.jobPost.findUnique({ where: { id: data.job_id } });
    if (!job) {
      throw new HttpError(422, 'The selected job id is invalid.');
    }

    const isHired = await prisma.jobApplication.findFirst({
      where: { guardUserId: guardId, jobId: job.id, status: { in: HIRED_STATUSES } },
      select: { id: true },
    });

    if (!isHired) {
      throw new HttpError(422, 'You are not assigned to this job.');
    }
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      guardUserId: guardId,
      employerUserId: job?.employerUserId ?? null,
      companyId: job?.companyId ?? null,
      jobId: job?.id ?? null,
      siteId: job?.siteId ?? null,
      attendanceDate: today,
      inTime: new Date(),
      status: 'pending_verification',
      guardRemarks: data.guard_remarks ?? null,
    },
    include: jobInclude,
  });

  return res.status(201).json(snakeKeys(record));
}

/** PATCH /guard/attendance/:record/check-out */
export async function checkOut(req: Request, res: Response) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.record } });
  if (!record) {
    throw new HttpError(404, 'Not found.');
  }

  if (record.guardUserId !== req.user!.id) {
    throw new HttpError(403, 'Forbidden.');
  }

  if (record.outTime) {
    throw new HttpError(422, 'Already checked out for this record.');
  }

  const data = checkOutSchema.parse(req.body);

  const outTime = new Date();
  const totalHours = record.inTime
    ? Math.round(((outTime.getTime() - record.inTime.getTime()) / 3_600_000) * 100) / 100
    : null;

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      outTime,
      totalHours,
      guardRemarks: data.guard_remarks ?? record.guardRemarks,
    },
    include: jobInclude,
  });

  return res.json(snakeKeys(updated));
}

// --- employer-facing ------------------------------------------------------

const updateAttendanceSchema = z.object({
  status: z.string(),
  employer_remarks: z.string().nullish(),
});

/** GET /employer/attendance */
export async function employerIndex(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const records = await prisma.attendanceRecord.findMany({
    where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
    include: jobInclude,
    orderBy: { attendanceDate: 'desc' },
  });

  const rows = snakeKeys(records) as Array<Record<string, unknown> & { guard_user_id?: string }>;
  return res.json(await attachGuardProfiles(rows));
}

/** PATCH /employer/attendance/:record/status */
export async function updateStatus(req: Request, res: Response) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.record } });
  if (!record) throw new HttpError(404, 'Not found.');
  if (record.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');

  const data = updateAttendanceSchema.parse(req.body);
  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      status: data.status,
      ...(data.employer_remarks !== undefined ? { employerRemarks: data.employer_remarks } : {}),
    },
  });
  return res.json(snakeKeys(updated));
}
