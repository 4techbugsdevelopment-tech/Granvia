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
  location_name: z.string().trim().max(500).nullish(),
});

const checkOutSchema = z.object({
  guard_remarks: z.string().nullish(),
  latitude: latitude.nullish(),
  longitude: longitude.nullish(),
  location_name: z.string().trim().max(500).nullish(),
});

const attendanceExceptionRequestSchema = z.object({
  request_type: z.enum(['check_in', 'check_out']),
  job_id: z.string().uuid().nullish(),
  attendance_record_id: z.string().uuid().nullish(),
  message: z.string().trim().min(5, 'Please enter a short message for the employer.').max(2000),
  latitude: latitude.nullish(),
  longitude: longitude.nullish(),
  location_name: z.string().trim().max(500).nullish(),
});

const attendanceExceptionDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  employer_remarks: z.string().trim().max(2000).nullish(),
});

type AttendanceAuditDelegate = NonNullable<typeof prisma.attendanceAuditEvent>;
type AttendanceAuditDb = { attendanceAuditEvent?: AttendanceAuditDelegate };
type AttendanceExceptionDelegate = NonNullable<typeof prisma.attendanceExceptionRequest>;

type AttendanceAuditInput = {
  eventType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  attendanceRecordId?: string | null;
  exceptionRequestId?: string | null;
  guardUserId?: string | null;
  employerUserId?: string | null;
  jobId?: string | null;
  siteId?: string | null;
  attendanceDate?: Date | null;
  deviceLatitude?: Prisma.Decimal | number | string | null;
  deviceLongitude?: Prisma.Decimal | number | string | null;
  deviceLocationName?: string | null;
  siteLatitude?: Prisma.Decimal | number | string | null;
  siteLongitude?: Prisma.Decimal | number | string | null;
  distanceMeters?: Prisma.Decimal | number | string | null;
  radiusMeters?: number | null;
  remarks?: string | null;
  metadata?: Record<string, unknown> | null;
  requestContext?: { ipAddress?: string | null; userAgent?: string | null; origin?: string | null; referer?: string | null };
};

function requestAuditContext(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  return {
    ipAddress: (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() || req.ip || null,
    userAgent: req.get('user-agent') || null,
    origin: req.get('origin') || null,
    referer: req.get('referer') || null,
  };
}

function attendanceExceptionRequestsDelegate(): AttendanceExceptionDelegate | null {
  return (prisma as unknown as { attendanceExceptionRequest?: AttendanceExceptionDelegate }).attendanceExceptionRequest ?? null;
}

function attendanceExceptionRequestsUnavailable() {
  return new HttpError(503, 'Attendance requests are unavailable because the server is missing the latest attendance exception update. Please contact support.');
}

function isMissingAttendanceSchemaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code);
}

async function writeAttendanceAudit(db: AttendanceAuditDb, input: AttendanceAuditInput) {
  if (!db.attendanceAuditEvent) {
    console.warn('[attendance] audit event skipped; Prisma client is missing attendanceAuditEvent');
    return;
  }
  const context = input.requestContext;
  await db.attendanceAuditEvent.create({
    data: {
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      attendanceRecordId: input.attendanceRecordId ?? null,
      exceptionRequestId: input.exceptionRequestId ?? null,
      guardUserId: input.guardUserId ?? null,
      employerUserId: input.employerUserId ?? null,
      jobId: input.jobId ?? null,
      siteId: input.siteId ?? null,
      attendanceDate: input.attendanceDate ?? null,
      deviceLatitude: input.deviceLatitude ?? null,
      deviceLongitude: input.deviceLongitude ?? null,
      deviceLocationName: input.deviceLocationName ?? null,
      siteLatitude: input.siteLatitude ?? null,
      siteLongitude: input.siteLongitude ?? null,
      distanceMeters: input.distanceMeters ?? null,
      radiusMeters: input.radiusMeters ?? null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      origin: context?.origin ?? null,
      referer: context?.referer ?? null,
      remarks: input.remarks ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
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

function geofenceDetails(params: {
  job: {
    site?: { latitude?: Prisma.Decimal | number | string | null; longitude?: Prisma.Decimal | number | string | null } | null;
  };
  latitude?: number | null;
  longitude?: number | null;
}) {
  const radius = env.attendanceGeofenceRadiusMeters;
  const siteLat = params.job.site?.latitude == null ? null : Number(params.job.site.latitude);
  const siteLng = params.job.site?.longitude == null ? null : Number(params.job.site.longitude);

  if (params.latitude == null || params.longitude == null) {
    return {
      ok: false,
      reason: 'Device location was not captured. Attendance can be marked only from the assigned job location.',
      distance: null,
      radius,
      siteLat,
      siteLng,
    };
  }

  if (siteLat == null || siteLng == null || Number.isNaN(siteLat) || Number.isNaN(siteLng)) {
    return {
      ok: false,
      reason: 'Assigned job site is not configured with map coordinates. Request attendance for employer review.',
      distance: null,
      radius,
      siteLat,
      siteLng,
    };
  }

  const distance = distanceMeters(
    { lat: params.latitude, lng: params.longitude },
    { lat: siteLat, lng: siteLng },
  );
  return {
    ok: distance <= radius,
    reason: distance <= radius
      ? null
      : `You are not at the assigned job location. Device location is ${Math.round(distance)} m away; allowed radius is ${radius} m.`,
    distance,
    radius,
    siteLat,
    siteLng,
  };
}

function mapAttendanceDatabaseError(error: unknown): HttpError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (error.code === 'P2002') {
    return new HttpError(409, 'Attendance is already marked for this job and date.');
  }

  if (error.code === 'P2003') {
    return new HttpError(422, 'Attendance cannot be marked because the selected job, employer, company, or site is no longer valid.');
  }

  if (['P2021', 'P2022'].includes(error.code)) {
    return new HttpError(503, 'Attendance cannot be marked because the server database is missing the latest attendance update. Please contact support.');
  }

  return null;
}

function logAttendanceSideEffectFailure(step: string, error: unknown) {
  console.error(`[attendance] ${step} failed`, error);
}

async function notifyEmployerLocationMismatch(params: {
  guardId: string;
  employerUserId?: string | null;
  jobTitle?: string | null;
  targetAddress: string;
  attemptType: 'check_in' | 'check_out';
  latitude?: number | null;
  longitude?: number | null;
  distance?: number | null;
  radius: number;
  reason: string;
}) {
  if (!params.employerUserId) return;
  const guard = await prisma.user.findUnique({ where: { id: params.guardId }, select: { fullName: true, email: true } });
  const distanceText = params.distance == null ? 'unknown distance' : `${Math.round(params.distance)} m away`;
  const deviceText = params.latitude == null || params.longitude == null
    ? 'without captured device GPS'
    : `at ${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)}`;
  await prisma.notification.create({
    data: {
      userId: params.employerUserId,
      title: 'Attendance location needs review',
      message: `${guard?.fullName ?? guard?.email ?? 'An associate'} marked ${params.attemptType === 'check_in' ? 'check in' : 'check out'} for ${params.jobTitle ?? 'a job'} ${deviceText} (${distanceText}). Assigned location: ${params.targetAddress}. Allowed radius: ${params.radius} m. Please review before approval.`,
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

  const targetAddress = siteAddress(params.job);
  const details = geofenceDetails(params);

  const createReviewAttempt = async (reason: string, distance: number | null) => {
    try {
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
          siteLatitude: details.siteLat,
          siteLongitude: details.siteLng,
          distanceMeters: distance == null ? null : new Prisma.Decimal(distance.toFixed(2)),
          radiusMeters: details.radius,
          reason,
        },
      });
    } catch (error) {
      logAttendanceSideEffectFailure('location review audit', error);
    }

    try {
      await notifyEmployerLocationMismatch({
        guardId: params.guardId,
        employerUserId: params.job.employerUserId,
        jobTitle: params.job.title,
        targetAddress,
        attemptType: params.attemptType,
        latitude: params.latitude,
        longitude: params.longitude,
        distance,
        radius: details.radius,
        reason,
      });
    } catch (error) {
      logAttendanceSideEffectFailure('location review notification', error);
    }
  };

  if (!details.ok) {
    const reason = details.reason ?? 'Device location is outside the assigned job location.';
    await createReviewAttempt(reason, details.distance);
    throw new HttpError(422, reason, {
      attendance_location_error: {
        request_attendance_available: true,
        attempt_type: params.attemptType,
        job_id: params.job.id,
        device_latitude: params.latitude ?? null,
        device_longitude: params.longitude ?? null,
        site_latitude: details.siteLat,
        site_longitude: details.siteLng,
        distance_meters: details.distance == null ? null : Math.round(details.distance),
        radius_meters: details.radius,
        reason,
      },
    });
  }
}

const historicalSchema = z.object({
  job_id: z.string().uuid().nullish(),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  in_time: z.string().datetime(),
  out_time: z.string().datetime(),
  check_in_latitude: latitude.nullish(),
  check_in_longitude: longitude.nullish(),
  check_in_location_name: z.string().trim().max(500).nullish(),
  check_out_latitude: latitude.nullish(),
  check_out_longitude: longitude.nullish(),
  check_out_location_name: z.string().trim().max(500).nullish(),
  guard_remarks: z.string().max(2000).nullish(),
});

const editAttendanceSchema = z.object({
  in_time: z.string().datetime(),
  out_time: z.string().datetime(),
  guard_remarks: z.string().max(2000).nullish(),
});

const HIRED_STATUSES = ['selected', 'offer_sent', 'accepted', 'joined', 'hired', 'leave_requested'];
const normalizedHiredStatuses = new Set(HIRED_STATUSES);
const OFFER_ASSIGNMENT_STATUSES = ['accepted', 'joined', 'hired', 'confirmed'];
const normalizedOfferAssignmentStatuses = new Set(OFFER_ASSIGNMENT_STATUSES);

function assignmentDebugSummary(rows: Array<{
  status?: string | null;
  job?: { startDate?: Date | null; endDate?: Date | null } | null;
}>, attendanceDate?: Date) {
  if (!rows.length) return 'no rows';
  return rows.map((row) => {
    const status = String(row.status ?? 'blank').trim() || 'blank';
    const validStatus = normalizedHiredStatuses.has(status.toLowerCase()) || normalizedOfferAssignmentStatuses.has(status.toLowerCase());
    const inDateWindow = !attendanceDate || !row.job
      ? true
      : (!row.job.startDate || row.job.startDate <= attendanceDate) &&
        (!row.job.endDate || row.job.endDate >= attendanceDate);
    return `${status}:${validStatus ? 'status-ok' : 'status-no'}:${inDateWindow ? 'date-ok' : 'date-no'}`;
  }).join(', ');
}

function assignmentFailureReason(params: {
  requestedJobId?: string | null;
  applications: Array<{ status?: string | null; job?: { startDate?: Date | null; endDate?: Date | null } | null }>;
  offers: Array<{ status?: string | null; job?: { startDate?: Date | null; endDate?: Date | null } | null }>;
  attendanceDate?: Date;
}) {
  const dateText = params.attendanceDate ? indiaDateString(params.attendanceDate) : 'today';
  const rows = [...params.applications, ...params.offers];
  if (params.requestedJobId && rows.length === 0) {
    return 'No application or accepted offer was found for the submitted job and logged-in Associate.';
  }
  if (!params.requestedJobId && rows.length === 0) {
    return 'No assigned application or accepted offer was found for the logged-in Associate.';
  }

  const hasAllowedStatus = rows.some((row) => {
    const status = String(row.status ?? '').trim().toLowerCase();
    return normalizedHiredStatuses.has(status) || normalizedOfferAssignmentStatuses.has(status);
  });
  if (!hasAllowedStatus) {
    return `Assignment row exists, but status is not eligible for attendance. Allowed application statuses: ${HIRED_STATUSES.join(', ')}. Allowed offer statuses: ${OFFER_ASSIGNMENT_STATUSES.join(', ')}.`;
  }

  const hasDateMatch = rows.some((row) =>
    !params.attendanceDate || !row.job ||
    ((!row.job.startDate || row.job.startDate <= params.attendanceDate) &&
      (!row.job.endDate || row.job.endDate >= params.attendanceDate))
  );
  if (!hasDateMatch) {
    return `Assignment row exists, but the job start/end date does not include ${dateText}.`;
  }

  return 'Assignment row exists, but it did not match the submitted job, eligible status, and active date together.';
}

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
      ...(requestedJobId ? { jobId: requestedJobId } : {}),
    },
    include: { job: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const assignedApplications = applications.filter((application) =>
    normalizedHiredStatuses.has(String(application.status ?? '').trim().toLowerCase())
  );
  const application = attendanceDate
    ? assignedApplications.find(({ job }) =>
        (!job.startDate || job.startDate <= attendanceDate) &&
        (!job.endDate || job.endDate >= attendanceDate)
      ) ?? assignedApplications[0]
    : assignedApplications[0];

  if (!application) {
    const offers = await prisma.jobOffer.findMany({
      where: {
        guardUserId: guardId,
        jobId: { not: null },
        ...(requestedJobId ? { jobId: requestedJobId } : {}),
      },
      include: { job: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const assignedOffers = offers.filter((offer) =>
      offer.job &&
      normalizedOfferAssignmentStatuses.has(String(offer.status ?? '').trim().toLowerCase())
    );
    const offer = attendanceDate
      ? assignedOffers.find(({ job }) =>
          job &&
          (!job.startDate || job.startDate <= attendanceDate) &&
          (!job.endDate || job.endDate >= attendanceDate)
        ) ?? assignedOffers[0]
      : assignedOffers[0];

    if (offer?.job) {
      return offer.job;
    }

    const details = {
      submitted_job_id: requestedJobId ?? null,
      attendance_date: attendanceDate ? indiaDateString(attendanceDate) : null,
      application_rows_checked: applications.length,
      application_match_summary: assignmentDebugSummary(applications, attendanceDate),
      offer_rows_checked: offers.length,
      offer_match_summary: assignmentDebugSummary(offers, attendanceDate),
    };
    const reason = assignmentFailureReason({ requestedJobId, applications, offers, attendanceDate });
    throw new HttpError(422, requestedJobId
      ? `Attendance assignment failed: ${reason}`
      : `Attendance assignment failed: ${reason}`, {
        attendance_assignment_debug: details,
      });
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
  try {
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
    const geo = geofenceDetails({ job: jobWithLocation, latitude: data.latitude, longitude: data.longitude });

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
        checkInLocationName: data.location_name?.trim() || null,
        entryMode: env.locationCaptureEnabled ? 'live' : 'live_location_disabled',
        status: 'pending_verification',
        guardRemarks: data.guard_remarks ?? null,
      },
      include: jobInclude,
    });

    await writeAttendanceAudit(prisma, {
      eventType: 'check_in',
      actorUserId: guardId,
      actorRole: 'associate',
      attendanceRecordId: record.id,
      guardUserId: guardId,
      employerUserId: job.employerUserId,
      jobId: job.id,
      siteId: job.siteId,
      attendanceDate: today,
      deviceLatitude: data.latitude,
      deviceLongitude: data.longitude,
      deviceLocationName: data.location_name?.trim() || null,
      siteLatitude: geo.siteLat,
      siteLongitude: geo.siteLng,
      distanceMeters: geo.distance,
      radiusMeters: geo.radius,
      requestContext: requestAuditContext(req),
    });

    return res.status(201).json(snakeKeys(record));
  } catch (error) {
    const mapped = mapAttendanceDatabaseError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/** PATCH /guard/attendance/:record/check-out */
export async function checkOut(req: Request, res: Response) {
  try {
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
    const geo = geofenceDetails({ job: jobWithLocation, latitude: data.latitude, longitude: data.longitude });

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
        checkOutLocationName: data.location_name?.trim() || null,
        checkoutMethod: 'associate',
        guardRemarks: data.guard_remarks ?? record.guardRemarks,
      },
      include: jobInclude,
    });

    await writeAttendanceAudit(prisma, {
      eventType: 'check_out',
      actorUserId: req.user!.id,
      actorRole: 'associate',
      attendanceRecordId: updated.id,
      guardUserId: record.guardUserId,
      employerUserId: record.employerUserId,
      jobId: record.jobId,
      siteId: record.siteId,
      attendanceDate: record.attendanceDate,
      deviceLatitude: data.latitude,
      deviceLongitude: data.longitude,
      deviceLocationName: data.location_name?.trim() || null,
      siteLatitude: geo.siteLat,
      siteLongitude: geo.siteLng,
      distanceMeters: geo.distance,
      radiusMeters: geo.radius,
      requestContext: requestAuditContext(req),
    });

    return res.json(snakeKeys(updated));
  } catch (error) {
    const mapped = mapAttendanceDatabaseError(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/** POST /guard/attendance/exception-requests */
export async function requestAttendanceException(req: Request, res: Response) {
  const data = attendanceExceptionRequestSchema.parse(req.body);
  const guardId = req.user!.id;
  const today = todayDateOnly();
  const exceptionRequests = attendanceExceptionRequestsDelegate();
  if (!exceptionRequests) throw attendanceExceptionRequestsUnavailable();

  let jobId = data.job_id ?? null;
  let attendanceRecordId = data.attendance_record_id ?? null;
  let record: Awaited<ReturnType<typeof prisma.attendanceRecord.findUnique>> | null = null;

  if (data.request_type === 'check_out') {
    if (!attendanceRecordId) throw new HttpError(422, 'Attendance record is required for a check-out request.');
    record = await prisma.attendanceRecord.findUnique({ where: { id: attendanceRecordId } });
    if (!record || record.guardUserId !== guardId) throw new HttpError(404, 'Attendance record not found.');
    if (record.outTime) throw new HttpError(422, 'This attendance is already checked out.');
    if (!record.jobId) throw new HttpError(422, 'Attendance is not linked to a job.');
    jobId = record.jobId;
  }

  const assigned = await assignedJob(guardId, jobId, today);
  const jobWithLocation = await prisma.jobPost.findUnique({ where: { id: assigned.id }, include: { site: true, company: true } });
  if (!jobWithLocation) throw new HttpError(422, 'Assigned job was not found.');
  const geo = geofenceDetails({ job: jobWithLocation, latitude: data.latitude, longitude: data.longitude });
  if (geo.ok) {
    throw new HttpError(422, 'You are within the assigned job location. Please mark normal attendance instead of requesting an exception.');
  }

  const existing = await exceptionRequests.findFirst({
    where: {
      guardUserId: guardId,
      jobId: assigned.id,
      requestType: data.request_type,
      status: 'pending',
      createdAt: { gte: today },
    },
  });
  if (existing) {
    throw new HttpError(409, 'A pending attendance request already exists for this job today.');
  }

  const request = await exceptionRequests.create({
    data: {
      guardUserId: guardId,
      employerUserId: assigned.employerUserId,
      companyId: assigned.companyId,
      jobId: assigned.id,
      siteId: assigned.siteId,
      attendanceRecordId,
      requestType: data.request_type,
      message: data.message,
      deviceLatitude: data.latitude ?? null,
      deviceLongitude: data.longitude ?? null,
      deviceLocationName: data.location_name?.trim() || null,
      siteLatitude: geo.siteLat,
      siteLongitude: geo.siteLng,
      distanceMeters: geo.distance == null ? null : new Prisma.Decimal(geo.distance.toFixed(2)),
      radiusMeters: geo.radius,
      failureReason: geo.reason,
    },
    include: { job: { include: { company: true, site: true } } },
  });

  await writeAttendanceAudit(prisma, {
    eventType: 'request_attendance',
    actorUserId: guardId,
    actorRole: 'associate',
    exceptionRequestId: request.id,
    guardUserId: guardId,
    employerUserId: assigned.employerUserId,
    jobId: assigned.id,
    siteId: assigned.siteId,
    attendanceDate: today,
    deviceLatitude: data.latitude,
    deviceLongitude: data.longitude,
    deviceLocationName: data.location_name?.trim() || null,
    siteLatitude: geo.siteLat,
    siteLongitude: geo.siteLng,
    distanceMeters: geo.distance,
    radiusMeters: geo.radius,
    remarks: data.message,
    metadata: { request_type: data.request_type, failure_reason: geo.reason },
    requestContext: requestAuditContext(req),
  });

  if (assigned.employerUserId) {
    await prisma.notification.create({
      data: {
        userId: assigned.employerUserId,
        title: 'Attendance request',
        message: `An Associate requested ${data.request_type === 'check_in' ? 'check-in' : 'check-out'} attendance for ${assigned.title}.`,
        type: 'attendance_exception',
      },
    });
  }

  return res.status(201).json(snakeKeys(request));
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
    checkInLocationName: data.check_in_location_name?.trim() || null,
    checkOutLatitude: data.check_out_latitude ?? null,
    checkOutLongitude: data.check_out_longitude ?? null,
    checkOutLocationName: data.check_out_location_name?.trim() || null,
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

  await writeAttendanceAudit(prisma, {
    eventType: 'historical_manual',
    actorUserId: guardId,
    actorRole: 'associate',
    attendanceRecordId: record.id,
    guardUserId: guardId,
    employerUserId: job.employerUserId,
    jobId: job.id,
    siteId: job.siteId,
    attendanceDate,
    deviceLatitude: data.check_in_latitude,
    deviceLongitude: data.check_in_longitude,
    deviceLocationName: data.check_in_location_name?.trim() || null,
    remarks: data.guard_remarks ?? null,
    metadata: {
      check_out_latitude: data.check_out_latitude ?? null,
      check_out_longitude: data.check_out_longitude ?? null,
      check_out_location_name: data.check_out_location_name?.trim() || null,
      edited_existing: Boolean(existing),
    },
    requestContext: requestAuditContext(req),
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

  await writeAttendanceAudit(prisma, {
    eventType: 'associate_edit',
    actorUserId: req.user!.id,
    actorRole: 'associate',
    attendanceRecordId: updated.id,
    guardUserId: updated.guardUserId,
    employerUserId: updated.employerUserId,
    jobId: updated.jobId,
    siteId: updated.siteId,
    attendanceDate: updated.attendanceDate,
    remarks: data.guard_remarks ?? null,
    requestContext: requestAuditContext(req),
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

async function decideAttendance(recordId: string, actorId: string, actorRole: 'employer' | 'super_admin', data: z.infer<typeof updateAttendanceSchema>, requestContext?: ReturnType<typeof requestAuditContext>) {
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
      const rejected = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          status: 'rejected',
          employerRemarks: data.employer_remarks!.trim(),
        },
      });
      await writeAttendanceAudit(tx, {
        eventType: 'reject_attendance',
        actorUserId: actorId,
        actorRole: actorRole === 'super_admin' ? 'super_admin' : 'employer',
        attendanceRecordId: record.id,
        guardUserId: record.guardUserId,
        employerUserId: record.employerUserId,
        jobId: record.jobId,
        attendanceDate: record.attendanceDate,
        remarks: data.employer_remarks!.trim(),
        requestContext,
      });
      return rejected;
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

    const approved = await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        status: 'approved',
        employerRemarks: data.employer_remarks?.trim() || `Approved by ${actorRole === 'super_admin' ? 'Super Admin' : 'employer'}`,
      },
    });
    await writeAttendanceAudit(tx, {
      eventType: 'approve_attendance',
      actorUserId: actorId,
      actorRole: actorRole === 'super_admin' ? 'super_admin' : 'employer',
      attendanceRecordId: record.id,
      guardUserId: record.guardUserId,
      employerUserId: record.employerUserId,
      jobId: record.jobId,
      attendanceDate: record.attendanceDate,
      remarks: data.employer_remarks?.trim() || null,
      metadata: { settlement_created: true },
      requestContext,
    });
    return approved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (data.status === 'approved') {
    await notifyRole('super_admin', 'Associate transfer processing', 'A verified attendance settlement is ready for Associate payout review.');
  }

  return updated;
}

async function materializeExceptionAttendance(requestId: string, actorId: string) {
  const exceptionRequests = attendanceExceptionRequestsDelegate();
  if (!exceptionRequests) throw attendanceExceptionRequestsUnavailable();
  const request = await exceptionRequests.findUnique({
    where: { id: requestId },
    include: { job: true },
  });
  if (!request) throw new HttpError(404, 'Attendance request not found.');
  if (!request.employerUserId || request.employerUserId !== actorId) throw new HttpError(403, 'Forbidden.');
  if (request.status !== 'pending') throw new HttpError(422, 'This attendance request has already been decided.');

  const now = new Date();
  if (request.requestType === 'check_out') {
    if (!request.attendanceRecordId) throw new HttpError(422, 'Check-out request is not linked to an attendance record.');
    const record = await prisma.attendanceRecord.findUnique({ where: { id: request.attendanceRecordId } });
    if (!record || record.guardUserId !== request.guardUserId || record.jobId !== request.jobId) {
      throw new HttpError(422, 'Linked attendance record could not be found for this request.');
    }
    if (!record.inTime) throw new HttpError(422, 'Linked attendance does not have a check-in time.');
    const outTime = request.createdAt > record.inTime ? request.createdAt : now;
    if (outTime <= record.inTime) throw new HttpError(422, 'Request time is not after check-in time.');
    const totalHours = Math.round(((outTime.getTime() - record.inTime.getTime()) / 3_600_000) * 100) / 100;
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        outTime,
        totalHours,
        checkOutLatitude: request.deviceLatitude,
        checkOutLongitude: request.deviceLongitude,
        checkOutLocationName: request.deviceLocationName,
        checkoutMethod: 'exception_request',
        status: 'pending_verification',
        guardRemarks: request.message,
      },
    });
    return record.id;
  }

  const attendanceDate = new Date(`${indiaDateString(request.createdAt)}T00:00:00.000Z`);
  const existing = await prisma.attendanceRecord.findFirst({
    where: { guardUserId: request.guardUserId, jobId: request.jobId, attendanceDate },
  });
  if (existing && ['approved', 'verified'].includes(existing.status)) {
    throw new HttpError(422, 'Attendance for this job and date is already approved.');
  }
  const inTime = request.createdAt;
  const scheduled = scheduledCheckout(inTime, request.job.dutyHours);
  const outTime = scheduled ?? new Date(inTime.getTime() + 8 * 3_600_000);
  const totalHours = Math.round(((outTime.getTime() - inTime.getTime()) / 3_600_000) * 100) / 100;
  const values = {
    employerUserId: request.employerUserId,
    companyId: request.companyId,
    jobId: request.jobId,
    siteId: request.siteId,
    attendanceDate,
    inTime,
    outTime,
    scheduledOutTime: outTime,
    totalHours,
    checkInLatitude: request.deviceLatitude,
    checkInLongitude: request.deviceLongitude,
    checkInLocationName: request.deviceLocationName,
    entryMode: 'exception_request',
    checkoutMethod: 'exception_request',
    status: 'pending_verification',
    guardRemarks: request.message,
  } as const;
  const record = existing
    ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data: values })
    : await prisma.attendanceRecord.create({ data: { guardUserId: request.guardUserId, ...values } });
  return record.id;
}

/** GET /employer/attendance/exception-requests */
export async function employerExceptionRequests(req: Request, res: Response) {
  const companyId = req.query.company_id as string | undefined;
  const exceptionRequests = attendanceExceptionRequestsDelegate();
  if (!exceptionRequests) {
    res.setHeader('X-Granvia-Warning', 'Attendance requests are unavailable because the server is missing the latest attendance exception update.');
    return res.json([]);
  }
  try {
    const rows = await exceptionRequests.findMany({
      where: { employerUserId: req.user!.id, ...(companyId ? { companyId } : {}) },
      include: { job: { include: { company: true, site: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const shaped = snakeKeys(rows) as Array<Record<string, unknown> & { guard_user_id?: string }>;
    return res.json(await attachGuardProfiles(shaped));
  } catch (error) {
    if (!isMissingAttendanceSchemaError(error)) throw error;
    console.warn('[employer/attendance/exception-requests] unavailable; attendance exception migration is not applied', error);
    res.setHeader('X-Granvia-Warning', 'Attendance requests are unavailable because the server database is missing the latest attendance exception update.');
    return res.json([]);
  }
}

/** PATCH /employer/attendance/exception-requests/:request/status */
export async function decideExceptionRequest(req: Request, res: Response) {
  const data = attendanceExceptionDecisionSchema.parse(req.body);
  const exceptionRequests = attendanceExceptionRequestsDelegate();
  if (!exceptionRequests) throw attendanceExceptionRequestsUnavailable();
  const request = await exceptionRequests.findUnique({ where: { id: req.params.request } });
  if (!request) throw new HttpError(404, 'Attendance request not found.');
  if (request.employerUserId !== req.user!.id) throw new HttpError(403, 'Forbidden.');
  if (request.status !== 'pending') throw new HttpError(422, 'This attendance request has already been decided.');
  if (data.status === 'rejected' && !data.employer_remarks?.trim()) {
    throw new HttpError(422, 'Reason is required when rejecting an attendance request.');
  }

  if (data.status === 'rejected') {
    const rejected = await exceptionRequests.update({
      where: { id: request.id },
      data: {
        status: 'rejected',
        employerRemarks: data.employer_remarks!.trim(),
        decidedAt: new Date(),
        decidedBy: req.user!.id,
      },
      include: { job: { include: { company: true, site: true } } },
    });
    await writeAttendanceAudit(prisma, {
      eventType: 'reject_exception_request',
      actorUserId: req.user!.id,
      actorRole: 'employer',
      exceptionRequestId: request.id,
      guardUserId: request.guardUserId,
      employerUserId: request.employerUserId,
      jobId: request.jobId,
      siteId: request.siteId,
      attendanceDate: request.createdAt,
      deviceLatitude: request.deviceLatitude,
      deviceLongitude: request.deviceLongitude,
      deviceLocationName: request.deviceLocationName,
      siteLatitude: request.siteLatitude,
      siteLongitude: request.siteLongitude,
      distanceMeters: request.distanceMeters,
      radiusMeters: request.radiusMeters,
      remarks: data.employer_remarks!.trim(),
      requestContext: requestAuditContext(req),
    });
    await prisma.notification.create({
      data: {
        userId: request.guardUserId,
        title: 'Attendance request rejected',
        message: data.employer_remarks!.trim(),
        type: 'attendance_exception',
      },
    });
    return res.json(snakeKeys(rejected));
  }

  const recordId = await materializeExceptionAttendance(request.id, req.user!.id);
  await decideAttendance(recordId, req.user!.id, 'employer', {
    status: 'approved',
    employer_remarks: data.employer_remarks?.trim() || 'Approved attendance exception request.',
  }, requestAuditContext(req));
  const approved = await exceptionRequests.update({
    where: { id: request.id },
    data: {
      status: 'approved',
      attendanceRecordId: recordId,
      employerRemarks: data.employer_remarks?.trim() || 'Approved attendance exception request.',
      decidedAt: new Date(),
      decidedBy: req.user!.id,
    },
    include: { job: { include: { company: true, site: true } } },
  });
  await writeAttendanceAudit(prisma, {
    eventType: 'approve_exception_request',
    actorUserId: req.user!.id,
    actorRole: 'employer',
    exceptionRequestId: request.id,
    attendanceRecordId: recordId,
    guardUserId: request.guardUserId,
    employerUserId: request.employerUserId,
    jobId: request.jobId,
    siteId: request.siteId,
    attendanceDate: request.createdAt,
    deviceLatitude: request.deviceLatitude,
    deviceLongitude: request.deviceLongitude,
    deviceLocationName: request.deviceLocationName,
    siteLatitude: request.siteLatitude,
    siteLongitude: request.siteLongitude,
    distanceMeters: request.distanceMeters,
    radiusMeters: request.radiusMeters,
    remarks: data.employer_remarks?.trim() || null,
    requestContext: requestAuditContext(req),
  });
  return res.json(snakeKeys(approved));
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
  const updated = await decideAttendance(req.params.record, req.user!.id, 'employer', data, requestAuditContext(req));
  return res.json(snakeKeys(updated));
}

/** PATCH /admin/attendance/:record/status */
export async function adminUpdateStatus(req: Request, res: Response) {
  const data = updateAttendanceSchema.parse(req.body);
  const updated = await decideAttendance(req.params.record, req.user!.id, 'super_admin', data, requestAuditContext(req));
  return res.json(snakeKeys(updated));
}
