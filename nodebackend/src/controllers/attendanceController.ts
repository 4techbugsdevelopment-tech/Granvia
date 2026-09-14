import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';
import { snakeKeys } from '../utils/serialize';
import { attachGuardProfiles } from '../utils/enrich';
import { autoCheckoutExpiredAttendance, scheduledCheckout } from '../services/attendanceAutoCheckout';
import { env } from '../config/env';
import { debitEmployerWalletForPayment } from './walletController';

// Guard-facing attendance controller.

const jobInclude = {
  job: {
    select: {
      id: true,
      title: true,
      dutyHours: true,
      company: { select: { id: true, companyName: true, registeredAddress: true, billingAddress: true, city: true, state: true, pincode: true } },
      site: { select: { id: true, siteName: true, address: true, city: true, state: true, pincode: true, latitude: true, longitude: true } },
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

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.asin(Math.sqrt(h)) * 1000;
}

function siteAddress(job: {
  site?: { siteName?: string | null; address?: string | null; city?: string | null; state?: string | null; pincode?: string | null; latitude?: Prisma.Decimal | number | string | null; longitude?: Prisma.Decimal | number | string | null } | null;
  company?: { registeredAddress?: string | null; billingAddress?: string | null; city?: string | null; state?: string | null; pincode?: string | null } | null;
}) {
  const site = job.site;
  const company = job.company;
  return site?.address || [site?.siteName, site?.city, site?.state, site?.pincode].filter(Boolean).join(', ')
    || company?.registeredAddress || company?.billingAddress || [company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')
    || 'job location';
}

async function notifyEmployerLocationMismatch(params: {
  guardId: string;
  employerUserId?: string | null;
  jobTitle?: string | null;
  targetAddress: string;
  attemptType: 'check_in' | 'check_out';
  latitude: number;
  longitude: number;
  distance?: number | null;
  radius: number;
  reason: string;
}) {
  if (!params.employerUserId) return;
  const guard = await prisma.user.findUnique({ where: { id: params.guardId }, select: { fullName: true, email: true } });
  const distanceText = params.distance == null ? 'unknown distance' : `${Math.round(params.distance)} m away`;
  await prisma.notification.create({
    data: {
      userId: params.employerUserId,
      title: 'Attendance location blocked',
      message: `${guard?.fullName ?? guard?.email ?? 'An associate'} tried to ${params.attemptType === 'check_in' ? 'check in' : 'check out'} for ${params.jobTitle ?? 'a job'} at ${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)} (${distanceText}). Assigned location: ${params.targetAddress}. Allowed radius: ${params.radius} m.`,
      type: 'attendance_geofence',
    },
  });
}

async function enforceGeofence(params: {
  guardId: string;
  job: {
    id: string;
    title?: string | null;
    employerUserId?: string | null;
    companyId?: string | null;
    siteId?: string | null;
    site?: { latitude?: Prisma.Decimal | number | string | null; longitude?: Prisma.Decimal | number | string | null } | null;
    company?: { registeredAddress?: string | null; billingAddress?: string | null; city?: string | null; state?: string | null; pincode?: string | null } | null;
  };
  attemptType: 'check_in' | 'check_out';
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (!env.locationCaptureEnabled) return;
  requireLiveLocation(params);

  const radius = env.attendanceGeofenceRadiusMeters;
  const targetAddress = siteAddress(params.job);
  const siteLat = params.job.site?.latitude == null ? null : Number(params.job.site.latitude);
  const siteLng = params.job.site?.longitude == null ? null : Number(params.job.site.longitude);

  const createBlockedAttempt = async (reason: string, distance: number | null) => {
    await prisma.attendanceLocationAttempt.create({
      data: {
        guardUserId: params.guardId,
        employerUserId: params.job.employerUserId ?? null,
        companyId: params.job.companyId ?? null,
        jobId: params.job.id,
        siteId: params.job.siteId ?? null,
        attemptType: params.attemptType,
        status: 'blocked',
        deviceLatitude: params.latitude ?? null,
        deviceLongitude: params.longitude ?? null,
        siteLatitude: siteLat,
        siteLongitude: siteLng,
        distanceMeters: distance == null ? null : new Prisma.Decimal(distance.toFixed(2)),
        radiusMeters: radius,
        reason,
      },
    });
    await notifyEmployerLocationMismatch({
      guardId: params.guardId,
      employerUserId: params.job.employerUserId,
      jobTitle: params.job.title,
      targetAddress,
      attemptType: params.attemptType,
      latitude: params.latitude!,
      longitude: params.longitude!,
      distance,
      radius,
      reason,
    });
  };

  if (siteLat == null || siteLng == null || Number.isNaN(siteLat) || Number.isNaN(siteLng)) {
    const reason = 'Assigned job site is not configured with map coordinates.';
    await createBlockedAttempt(reason, null);
    throw new HttpError(422, 'Attendance cannot be marked because this job site does not have map coordinates configured. Ask the employer to update the site location.');
  }

  const distance = distanceMeters(
    { lat: params.latitude!, lng: params.longitude! },
    { lat: siteLat, lng: siteLng },
  );
  if (distance > radius) {
    const reason = `Device location is ${Math.round(distance)} m from the assigned job location; allowed radius is ${radius} m.`;
    await createBlockedAttempt(reason, distance);
    throw new HttpError(422, `You are not on the job location. You are ${Math.round(distance)} m away from ${targetAddress}; attendance is allowed within ${radius} m.`);
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

const editAttendanceSchema = z.object({
  in_time: z.string().datetime(),
  out_time: z.string().datetime(),
  guard_remarks: z.string().max(2000).nullish(),
});

const HIRED_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined', 'hired'];

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

  const jobWithLocation = await prisma.jobPost.findUnique({ where: { id: job.id }, include: { site: true, company: true } });
  if (!jobWithLocation) throw new HttpError(422, 'Assigned job was not found.');
  await enforceGeofence({ guardId, job: jobWithLocation, attemptType: 'check_in', latitude: data.latitude, longitude: data.longitude });

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
  const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.record }, include: jobInclude });
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
  if (!record.jobId || !record.job) throw new HttpError(422, 'Attendance is not linked to a job location.');
  const jobWithLocation = await prisma.jobPost.findUnique({ where: { id: record.jobId }, include: { site: true, company: true } });
  if (!jobWithLocation) throw new HttpError(422, 'Assigned job was not found.');
  await enforceGeofence({ guardId: record.guardUserId, job: jobWithLocation, attemptType: 'check_out', latitude: data.latitude, longitude: data.longitude });

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

/** PATCH /guard/attendance/:record — edit an unapproved attendance record. */
export async function updateOwnAttendance(req: Request, res: Response) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id: req.params.record }, include: jobInclude });
  if (!record) throw new HttpError(404, 'Not found.');
  if (record.guardUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  if (['approved', 'verified'].includes(record.status)) {
    throw new HttpError(422, 'Approved attendance cannot be changed. Contact the employer or Super Admin.');
  }

  const data = editAttendanceSchema.parse(req.body);
  const inTime = new Date(data.in_time);
  const outTime = new Date(data.out_time);
  if (indiaDateString(inTime) !== indiaDateString(record.attendanceDate)) {
    throw new HttpError(422, 'Check-in time must stay on the attendance date.');
  }
  if (outTime <= inTime || outTime > new Date()) {
    throw new HttpError(422, 'Check-out must be after check-in and cannot be in the future.');
  }

  const totalHours = Math.round(((outTime.getTime() - inTime.getTime()) / 3_600_000) * 100) / 100;
  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      inTime,
      outTime,
      scheduledOutTime: record.job?.dutyHours ? scheduledCheckout(inTime, record.job.dutyHours) : record.scheduledOutTime,
      totalHours,
      entryMode: record.entryMode === 'live' ? 'associate_edited' : record.entryMode,
      checkoutMethod: record.checkoutMethod ?? 'associate',
      status: 'pending_verification',
      guardRemarks: data.guard_remarks ?? record.guardRemarks,
      employerRemarks: null,
    },
    include: jobInclude,
  });

  return res.json(snakeKeys(updated));
}

// --- employer-facing ------------------------------------------------------

const updateAttendanceSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  employer_remarks: z.string().max(2000).nullish(),
});

function payableAmount(record: {
  totalHours: Prisma.Decimal | number | null;
  job: { salaryAmount: Prisma.Decimal | null; paymentType: string | null } | null;
  guardProfile: { dailyRate: Prisma.Decimal | null; hourlyRate: Prisma.Decimal | null } | null;
}) {
  const paymentType = String(record.job?.paymentType ?? 'Daily').toLowerCase();
  if (paymentType.includes('hour')) {
    const rate = Number(record.guardProfile?.hourlyRate ?? record.job?.salaryAmount ?? 0);
    if (rate <= 0) throw new HttpError(422, 'Associate hourly rate or job hourly amount is required before attendance can be settled.');
    const hours = Number(record.totalHours ?? 0);
    return Math.round(rate * hours * 100) / 100;
  }
  const rate = Number(record.guardProfile?.dailyRate ?? record.job?.salaryAmount ?? 0);
  if (rate <= 0) throw new HttpError(422, 'Associate daily rate or job salary/payment amount is required before attendance can be settled.');
  return Math.round(rate * 100) / 100;
}

async function notifyRole(role: string, title: string, message: string, type = 'attendance_settlement') {
  const users = await prisma.user.findMany({ where: { role, accountStatus: 'active' }, select: { id: true } });
  if (!users.length) return;
  await prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, title, message, type })) });
}

async function decideAttendance(recordId: string, actorId: string, actorRole: 'employer' | 'super_admin', data: z.infer<typeof updateAttendanceSchema>) {
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            salaryAmount: true,
            paymentType: true,
          },
        },
      },
    });
    if (!record) throw new HttpError(404, 'Not found.');
    if (actorRole === 'employer' && record.employerUserId !== actorId) throw new HttpError(403, 'Forbidden.');

    if (!record.inTime || !record.outTime || record.totalHours == null || Number(record.totalHours) <= 0) {
      throw new HttpError(422, 'Only completed attendance with valid hours can be approved or rejected.');
    }
    if (['approved', 'verified'].includes(record.status)) {
      throw new HttpError(422, 'This attendance is already approved.');
    }
    if (record.status === 'rejected') {
      throw new HttpError(422, 'This attendance is already rejected. Ask the associate to edit and resubmit it.');
    }
    if (data.status === 'rejected' && !data.employer_remarks?.trim()) {
      throw new HttpError(422, 'Remarks are required when rejecting attendance.');
    }

    if (data.status === 'rejected') {
      return tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          status: 'rejected',
          employerRemarks: data.employer_remarks!.trim(),
        },
      });
    }

    if (!record.employerUserId) throw new HttpError(422, 'Attendance is not linked to an employer.');
    if (!record.jobId || !record.job) throw new HttpError(422, 'Attendance is not linked to a payable job.');

    const existingPayment = await tx.payment.findFirst({
      where: { attendanceId: record.id, paymentStatus: { in: ['pending', 'otp_sent', 'processing', 'completed'] } } as never,
    });
    if (existingPayment) throw new HttpError(409, 'This attendance already has a settlement record.');

    const guardProfile = await tx.guardProfile.findUnique({
      where: { userId: record.guardUserId },
      select: { dailyRate: true, hourlyRate: true },
    });
    const amount = payableAmount({ ...record, guardProfile });
    const payment = await tx.payment.create({
      data: {
        guardUserId: record.guardUserId,
        employerUserId: record.employerUserId,
        jobId: record.jobId,
        attendanceId: record.id,
        amount,
        paymentMethod: 'wallet_attendance',
        paymentStatus: 'processing',
        paymentDate: new Date(),
      } as never,
    });

    await debitEmployerWalletForPayment(tx, {
      employerUserId: record.employerUserId,
      amount,
      paymentId: payment.id,
      jobId: record.jobId,
      guardUserId: record.guardUserId,
      purpose: `Attendance settlement - ${record.job.title}`,
      metadata: {
        attendance_id: record.id,
        attendance_date: record.attendanceDate.toISOString(),
        approved_by: actorId,
        approved_by_role: actorRole,
        payment_type: record.job.paymentType,
        total_hours: Number(record.totalHours),
      },
    });

    const associateWallet = await tx.associateWallet.upsert({
      where: { guardUserId: record.guardUserId },
      create: { guardUserId: record.guardUserId },
      update: {},
    });
    await tx.associateWallet.update({
      where: { id: associateWallet.id },
      data: { reservedBalance: { increment: amount } },
    });
    await tx.associateWalletTransaction.create({
      data: {
        walletId: associateWallet.id,
        transactionType: 'credit',
        amount,
        purpose: `Processing attendance settlement - ${record.job.title}`,
        status: 'processing',
        referenceType: 'payment',
        referenceId: payment.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: record.guardUserId,
        title: 'Attendance approved',
        message: `Rs ${amount.toLocaleString('en-IN')} is now processing for ${record.job.title}.`,
        type: 'attendance_settlement',
      },
    });
    await tx.notification.create({
      data: {
        userId: record.employerUserId,
        title: 'Wallet debited',
        message: `Rs ${amount.toLocaleString('en-IN')} was debited for approved attendance on ${record.job.title}.`,
        type: 'attendance_settlement',
      },
    });

    return tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: 'approved',
        employerRemarks: data.employer_remarks?.trim() || `Approved by ${actorRole === 'super_admin' ? 'Super Admin' : 'employer'}`,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (data.status === 'approved') {
    await notifyRole('super_admin', 'Associate transfer processing', 'A verified attendance settlement is ready for Associate payout review.');
  }

  return updated;
}

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
  const data = updateAttendanceSchema.parse(req.body);
  const updated = await decideAttendance(req.params.record, req.user!.id, 'employer', data);
  return res.json(snakeKeys(updated));
}

/** PATCH /admin/attendance/:record/status */
export async function adminUpdateStatus(req: Request, res: Response) {
  const data = updateAttendanceSchema.parse(req.body);
  const updated = await decideAttendance(req.params.record, req.user!.id, 'super_admin', data);
  return res.json(snakeKeys(updated));
}
