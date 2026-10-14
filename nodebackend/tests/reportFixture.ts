import { Prisma, PrismaClient } from '@prisma/client';

export type Row = Record<string, any>; // In-memory query interpreter for HTTP tests, not a production database adapter.
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const owner = { id: id(1), role: 'employer', accountStatus: 'active' };
export const company = id(2), site = id(3);
export function fixture() {
  const tables: Record<string, Row[]> = {
    associateType: [{ code: 'guard', name: 'Associate' }],
    employerWallet: [{ id: id(60), employerUserId: owner.id, status: 'active', currency: 'INR', createdAt: new Date('2026-09-01T00:00:00Z'), balance: new Prisma.Decimal('20012.65'), depositBalance: new Prisma.Decimal('19012.45'), creditBalance: new Prisma.Decimal('1000.20'), totalRecharged: new Prisma.Decimal('20000.10'), totalCredited: new Prisma.Decimal('1000.20'), totalDebited: new Prisma.Decimal('987.65') }],
    walletTransaction: [
      { id: id(70), walletId: id(60), employerUserId: owner.id, createdAt: new Date('2026-10-11T18:29:59.999Z'), transactionType: 'credit', source: 'mock_gateway_recharge', amount: new Prisma.Decimal('20000.10'), balanceAfter: new Prisma.Decimal('20000.10'), status: 'completed', referenceType: 'wallet_recharge', referenceId: id(60), purpose: 'Mock recharge', metadata: 'PRIVATE METADATA' },
      { id: id(71), walletId: id(60), employerUserId: owner.id, createdAt: new Date('2026-10-11T18:30:00Z'), transactionType: 'credit', source: 'admin_credit', amount: new Prisma.Decimal('1000.20'), balanceAfter: new Prisma.Decimal('21000.30'), status: 'completed', referenceType: 'admin_credit', referenceId: id(9000), purpose: 'Admin credit' },
      { id: id(72), walletId: id(60), employerUserId: owner.id, createdAt: new Date('2026-10-12T12:00:00Z'), transactionType: 'debit', source: 'job_payment', amount: new Prisma.Decimal('987.65'), balanceAfter: new Prisma.Decimal('20012.65'), status: 'completed', referenceType: 'payment', referenceId: id(2005), jobId: id(100), guardUserId: id(4), purpose: 'Attendance settlement' },
    ],
    associateWallet: [{ id: id(61), guardUserId: id(4), availableBalance: new Prisma.Decimal(0), reservedBalance: new Prisma.Decimal('987.65') }],
    associateWalletTransaction: [{ id: id(62), walletId: id(61), transactionType: 'credit', amount: new Prisma.Decimal('987.65'), status: 'processing', referenceType: 'payment', referenceId: id(2005) }],
    user: [{ ...owner, fullName: 'Employer A', createdAt: new Date('2026-10-11T18:30:00Z') }, { id: id(4), role: 'guard', profileType: 'guard', accountStatus: 'active', createdAt: new Date('2026-10-11T18:30:00Z'), fullName: 'Associate A', password: 'NEVER EXPOSE' }],
    employerProfile: [{ id: id(30), userId: owner.id, city: 'Mumbai', state: 'Maharashtra', profileStatus: 'complete', verificationStatus: 'verified', aadhaarVerificationStatus: 'verified' }],
    guardProfile: [{ id: id(31), userId: id(4), city: 'Mumbai', state: 'Maharashtra', verificationStatus: 'pending', aadhaarStatus: 'verified', policeVerificationStatus: 'pending', bankAccountNumber: 'PRIVATE BANK' }],
    companyDocument: [{ id: id(32), companyId: company, employerUserId: owner.id, documentType: 'registration', verificationStatus: 'verified', adminRemarks: 'Reviewed', createdAt: new Date('2026-10-11T18:30:00Z'), filePath: 'PRIVATE FILE' }],
    guardDocument: [{ id: id(33), guardUserId: id(4), documentType: 'police_verification', status: 'pending', createdAt: new Date('2026-10-11T18:30:00Z'), reviewedAt: null, reviewedBy: null, filePath: 'PRIVATE FILE' }],
    associatePartnerAgreement: [{ id: id(34), associatePartnerId: id(4), currentKey: id(4), agreementVersion: 'v1', status: 'SIGNED' }, { id: id(35), associatePartnerId: id(4), currentKey: null, agreementVersion: 'old', status: 'SUPERSEDED' }],
    attendanceAuditEvent: [{ id: id(36), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), siteId: site, actorUserId: owner.id, actorRole: 'employer', eventType: 'approve_attendance', eventAt: new Date('2026-10-11T18:30:00Z'), attendanceDate: new Date('2026-10-12T00:00:00Z'), deviceLatitude: 'PRIVATE GPS', ipAddress: 'PRIVATE IP', remarks: 'Reviewed', attendanceRecordId: id(2003), exceptionRequestId: null }],
    employerCompany: [{ id: company, employerUserId: owner.id, companyName: 'Company A' }, { id: id(20), employerUserId: id(21), companyName: 'Company B' }],
    companySite: [{ id: site, companyId: company, employerUserId: owner.id, siteName: 'Site A' }],
    jobPost: Array.from({ length: 301 }, (_, i) => ({ id: id(100 + i), employerUserId: owner.id, companyId: company, siteId: site, title: i === 0 ? '=Unsafe title' : `Job ${i}`, guardsRequired: 2, guardType: 'guard', status: 'active', createdAt: new Date('2026-10-11T18:30:00Z') })),
    jobApplication: ['hired', 'joined', 'leave_requested', 'selected', 'offer_sent'].map((status, i) => ({ id: id(1000 + i), jobId: id(100), employerUserId: owner.id, guardUserId: id(4), status, appliedAt: new Date('2026-09-01T00:00:00Z'), reviewedAt: null, reviewedBy: null })),
    interviewRequest: [{ id: id(2000), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), status: 'requested', requestType: 'Phone Call', preferredDate: null, createdAt: new Date('2026-10-11T18:30:00Z') }],
    jobOffer: [{ id: id(2001), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), status: 'sent', offeredSalary: new Prisma.Decimal('1234.50'), createdAt: new Date('2026-10-11T18:30:00Z'), startDate: new Date('2026-10-15T00:00:00Z') }],
    agreement: [{ id: id(2002), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), status: 'pending', agreementNumber: 'AGR-1', title: 'Agreement', employerConfirmationStatus: 'pending', guardConfirmationStatus: 'pending', platformConfirmationStatus: 'pending', signedAt: null, createdAt: new Date('2026-10-11T18:30:00Z') }],
    attendanceRecord: [{ id: id(2003), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), attendanceDate: new Date('2026-10-12T00:00:00Z'), inTime: new Date('2026-10-12T03:30:00Z'), outTime: new Date('2026-10-12T11:30:00Z'), totalHours: new Prisma.Decimal('8.00'), status: 'approved', entryMode: 'live', checkoutMethod: 'automatic', employerRemarks: 'Checked' }],
    attendanceExceptionRequest: [{ id: id(2004), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), status: 'pending', requestType: 'check_in', message: 'Please review', createdAt: new Date('2026-10-11T18:30:00Z'), decidedAt: null }],
    payment: [{ id: id(2005), employerUserId: owner.id, guardUserId: id(4), jobId: id(100), attendanceId: id(2003), applicationId: null, amount: new Prisma.Decimal('987.65'), paymentStatus: 'processing', paymentMethod: 'wallet_attendance', createdAt: new Date('2026-10-12T12:00:00Z'), paymentDate: new Date('2026-10-12T12:00:00Z') }],
  };
  const calls: string[] = [];
  function relation(row: Row, key: string) {
    if (key === 'user') return tables.user.find(u => u.id === (row.userId ?? row.employerUserId)) ?? null;
    if (key === 'employerProfile') return tables.employerProfile.find(p => p.userId === row.id) ?? null;
    if (key === 'guardProfile') return tables.guardProfile.find(p => p.userId === row.id) ?? null;
    if (key === 'employerWallet') return tables.employerWallet.find(w => w.employerUserId === row.id) ?? null;
    if (key === 'job') return tables.jobPost.find(j => j.id === row.jobId) ?? null;
    if (key === 'company') return tables.employerCompany.find(c => c.id === row.companyId) ?? null;
    if (key === 'site') return tables.companySite.find(s => s.id === row.siteId) ?? null;
    return row[key] ?? null;
  }
  function matches(row: Row | null, where: Row = {}): boolean {
    if (!row) return false;
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'AND') return (condition as Row[]).every(w => matches(row, w));
      if (key === 'OR') return (condition as Row[]).some(w => matches(row, w));
      const actual = relation(row, key);
      if (condition === null || typeof condition !== 'object' || condition instanceof Date) return actual === condition;
      if ('in' in condition) return condition.in.includes(actual);
      if ('not' in condition) return actual !== condition.not;
      if ('contains' in condition) return typeof actual === 'string' && actual.includes(condition.contains);
      if ('gte' in condition || 'lt' in condition || 'lte' in condition) {
        if (actual instanceof Prisma.Decimal) return (!condition.gte || actual.gte(condition.gte)) && (!condition.lt || actual.lt(condition.lt)) && (!condition.lte || actual.lte(condition.lte));
        return actual != null && (!condition.gte || actual >= condition.gte) && (!condition.lt || actual < condition.lt) && (!condition.lte || actual <= condition.lte);
      }
      return matches(actual, condition);
    });
  }
  function selected(row: Row, select?: Row): Row {
    if (!select) return row;
    return Object.fromEntries(Object.entries(select).map(([key, spec]) => {
      const actual = relation(row, key);
      return [key, spec === true ? actual : actual == null ? null : selected(actual, spec.select)];
    }));
  }
  const db: Row = {};
  for (const name of Object.keys(tables)) {
    db[name] = {
      findUnique: async (args: Row) => { calls.push(`${name}.findUnique`); const row = tables[name].find(r => matches(r, args.where)); return row ? selected(row, args.select) : null; },
      findFirst: async (args: Row) => { calls.push(`${name}.findFirst`); const row = tables[name].find(r => matches(r, args.where)); return row ? selected(row, args.select) : null; },
      findMany: async (args: Row) => {
        calls.push(`${name}.findMany`);
        const rows = tables[name].filter(r => matches(r, args.where));
        const order = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
        rows.sort((a, b) => { for (const entry of order) { const [key, direction] = Object.entries(entry)[0]; if (a[key] !== b[key]) return (a[key] > b[key] ? 1 : -1) * (direction === 'desc' ? -1 : 1); } return 0; });
        return rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length)).map(r => selected(r, args.select));
      },
      count: async (args: Row) => { calls.push(`${name}.count`); return tables[name].filter(r => matches(r, args.where)).length; },
      groupBy: async (args: Row) => {
        calls.push(`${name}.groupBy`);
        const groups = new Map<string, Row>();
        for (const row of tables[name].filter(r => matches(r, args.where))) {
          const values = Object.fromEntries(args.by.map((key: string) => [key, row[key]]));
          const key = JSON.stringify(values); const group = groups.get(key) ?? { ...values, _count: { _all: 0 } };
          group._count._all++;
          if (args._sum) for (const field of Object.keys(args._sum)) {
            group._sum ??= {};
            group._sum[field] = new Prisma.Decimal(group._sum[field] ?? 0).add(row[field] ?? 0);
          }
          groups.set(key, group);
        }
        return [...groups.values()];
      },
      aggregate: async (args: Row) => { calls.push(`${name}.aggregate`); return { _sum: Object.fromEntries(Object.keys(args._sum).map(key => [key, tables[name].filter(r => matches(r, args.where)).reduce((sum, r) => sum.add(r[key] ?? 0), new Prisma.Decimal(0))])) }; },
    };
  }
  db.$transaction = async (fn: (tx: Row) => unknown) => fn(db);
  return { db: db as PrismaClient, tables, calls };
}
