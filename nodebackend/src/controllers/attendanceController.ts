import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { autoCheckoutExpiredAttendance, scheduledCheckout } from '../services/attendanceAutoCheckout';
import { env } from '../config/env';

// Guard-facing attendance controller.

const jobInclude = {
  job: {
    select: {
      id: true,
      title: true,
      dutyHours: true,
      site: { select: { id: true, siteName: true } },
    },
  },
} as const;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

const checkInSchema = z.object({
  job_id: z.string().uuid().nullish(),
  guard_remarks: z.string().nullish(),
  latitude: latitude.nullish(),
  longitude: longitude.nullish(),
});

const checkOutSchema = z.object({
  guard_remarks: z.string().nullish(),
  latitude: latitude.nullish(),
  longitude: longitude.nullish(),
});

function requireLiveLocation(data: { latitude?: number | null; longitude?: number | null }) {
  if (!env.locationCaptureEnabled) return;
  if (data.latitude == null || data.longitude == null) {
    throw new HttpError(422, 'A fresh device location is required to mark attendance. Enable Location/GPS and try again.');
  }
}

const historicalSchema = z.object({
  job_id: z.string().uuid().nullish(),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  in_time: z.string().datetime(),
  out_time: z.string().datetime(),
  check_in_latitude: latitude.nullish(),
  check_in_longitude: longitude.nullish(),
  check_out_latitude: latitude.nullish(),
  check_out_longitude: longitude.nullish(),
  guard_remarks: z.string().max(2000).nullish(),
});

const HIRED_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined'];

function todayDateOnly(): Date {
  const iso = indiaDateString(new Date());
  return new Date(`${iso}T00:00:00.000Z`);
}

function indiaDateString(value: Date): string {
  return new Date(value.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

async function assignedJob(guardId: string, requestedJobId?: string | null, attendanceDate?: Date) {
  const applications = await prisma.jobApplication.findMany({
    where: {
      guardUserId: guardId,
      status: { in: HIRED_STATUSES },
      ...(requestedJobId ? { jobId: requestedJobId } : {}),
    },
    include: { job: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const application = attendanceDate
    ? applications.find(({ job }) =>
        (!job.startDate || job.startDate <= attendanceDate) &&
        (!job.endDate || job.endDate >= attendanceDate)
      )
    : applications[0];

  if (!application) {
    throw new HttpError(422, requestedJobId
      ? 'You are not assigned to this job.'
      : 'No assigned job was found. Attendance can only be marked for an active assignment.');
  }
  return application.job;
}

/** GET /guard/attendance */
export async function guardIndex(req: Request, res: Response) {
  await autoCheckoutExpiredAttendance();
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
  requireLiveLocation(data);
  const guardId = req.user!.id;
  const today = todayDateOnly();
  const job = await assignedJob(guardId, data.job_id, today);

  const existing = await prisma.attendanceRecord.findFirst({
    where: {
      guardUserId: guardId,
      attendanceDate: today,
      jobId: job.id,
    },
  });

  if (existing) {
    throw new HttpError(422, 'Attendance already marked for today.');
  }

  const inTime = new Date();
  const record = await prisma.attendanceRecord.create({
    data: {
      guardUserId: guardId,
      employerUserId: job.employerUserId,
      companyId: job.companyId,
      jobId: job.id,
      siteId: job.siteId,
      attendanceDate: today,
      inTime,
      scheduledOutTime: scheduledCheckout(inTime, job.dutyHours),
      checkInLatitude: data.latitude ?? null,
      checkInLongitude: data.longitude ?? null,
      entryMode: env.locationCaptureEnabled ? 'live' : 'live_location_disabled',
      status: 'pending_verification',
      guardRemarks: data.guard_remarks ?? null,
    },
    include: jobInclude,
  });

  return res.status(201).json(snakeKeys(record));
}

/** PATCH /guard/attendance/:record/check-out */
export async function checkOut(req: Request, res: Response) {
  await autoCheckoutExpiredAttendance();
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
  requireLiveLocation(data);

  const outTime = new Date();
  const totalHours = record.inTime
    ? Math.round(((outTime.getTime() - record.inTime.getTime()) / 3_600_000) * 100) / 100
    : null;

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      outTime,
      totalHours,
      checkOutLatitude: data.latitude ?? null,
      checkOutLongitude: data.longitude ?? null,
      checkoutMethod: 'associate',
      guardRemarks: data.guard_remarks ?? record.guardRemarks,
    },
    include: jobInclude,
  });

  return res.json(snakeKeys(updated));
}

/** POST /guard/attendance/history — create or correct an unapproved past record. */
export async function saveHistorical(req: Request, res: Response) {
  const data = historicalSchema.parse(req.body);
  const guardId = req.user!.id;
  const attendanceDate = new Date(`${data.attendance_date}T00:00:00.000Z`);
  const inTime = new Date(data.in_time);
  const outTime = new Date(data.out_time);
  const today = todayDateOnly();

  if (attendanceDate >= today) {
    throw new HttpError(422, 'Historical attendance must be for a past date.');
  }
  if (indiaDateString(inTime) !== data.attendance_date) {
    throw new HttpError(422, 'Check-in time must fall on the selected attendance date.');
  }
  if (outTime <= inTime || outTime > new Date()) {
    throw new HttpError(422, 'Check-out must be after check-in and cannot be in the future.');
  }

  const job = await assignedJob(guardId, data.job_id, attendanceDate);
  const existing = await prisma.attendanceRecord.findFirst({
    where: { guardUserId: guardId, attendanceDate, jobId: job.id },
  });
  if (existing && ['approved', 'verified'].includes(existing.status)) {
    throw new HttpError(422, 'Approved attendance cannot be changed. Contact the employer or Super Admin.');
  }

  const totalHours = Math.round(((outTime.getTime() - inTime.getTime()) / 3_600_000) * 100) / 100;
  const values = {
    employerUserId: job.employerUserId,
    companyId: job.companyId,
    jobId: job.id,
    siteId: job.siteId,
    attendanceDate,
    inTime,
    outTime,
    scheduledOutTime: scheduledCheckout(inTime, job.dutyHours),
    totalHours,
    checkInLatitude: data.check_in_latitude ?? null,
    checkInLongitude: data.check_in_longitude ?? null,
    checkOutLatitude: data.check_out_latitude ?? null,
    checkOutLongitude: data.check_out_longitude ?? null,
    entryMode: 'historical_manual',
    checkoutMethod: 'historical_manual',
    status: 'pending_verification',
    guardRemarks: data.guard_remarks ?? null,
  } as const;

  const record = existing
    ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data: values, include: jobInclude })
    : await prisma.attendanceRecord.create({
        data: { guardUserId: guardId, ...values },
        include: jobInclude,
      });

  return res.status(existing ? 200 : 201).json(snakeKeys(record));
}

// --- employer-facing ------------------------------------------------------

const updateAttendanceSchema = z.object({
  status: z.string(),
  employer_remarks: z.string().nullish(),
});

/** GET /employer/attendance */
export async function employerIndex(req: Request, res: Response) {
  await autoCheckoutExpiredAttendance();
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
