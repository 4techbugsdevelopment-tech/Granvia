import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/prisma';

const PREFIX = 'API_SMOKE_';
const LOWER_PREFIX = PREFIX.toLowerCase();
const outputDir = path.resolve(process.cwd(), 'api-smoke-artifacts');
const smokeStart = new Date('2026-08-13T08:28:00.000Z');
const demoEmails = ['employer@granvia.test', 'guard@granvia.test'];

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

async function main() {
  const [users, companies, sites, jobs, tickets, notifications] = await Promise.all([
    prisma.user.findMany({ where: { email: { contains: LOWER_PREFIX } }, select: { id: true, email: true, role: true, createdAt: true } }),
    prisma.employerCompany.findMany({ where: { companyName: { startsWith: PREFIX } }, select: { id: true, employerUserId: true, companyName: true, createdAt: true } }),
    prisma.companySite.findMany({ where: { siteName: { startsWith: PREFIX } }, select: { id: true, companyId: true, siteName: true, createdAt: true } }),
    prisma.jobPost.findMany({ where: { title: { startsWith: PREFIX } }, select: { id: true, employerUserId: true, companyId: true, siteId: true, title: true, createdAt: true } }),
    prisma.supportTicket.findMany({ where: { subject: { startsWith: PREFIX } }, select: { id: true, userId: true, subject: true, createdAt: true } }),
    prisma.notification.findMany({ where: { title: { startsWith: PREFIX } }, select: { id: true, userId: true, title: true, createdAt: true } }),
  ]);

  const jobIds = jobs.map(row => row.id);
  const companyIds = companies.map(row => row.id);
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true, email: true },
  });
  const demoUserIds = demoUsers.map(row => row.id);
  const [applications, attendance, interviews, offers, agreements, payments, companyDocuments] = await Promise.all([
    prisma.jobApplication.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.attendanceRecord.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.interviewRequest.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.jobOffer.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.agreement.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.payment.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true, guardUserId: true, createdAt: true } }),
    prisma.companyDocument.findMany({ where: { companyId: { in: companyIds } }, select: { id: true, companyId: true, filePath: true, createdAt: true } }),
  ]);

  const artifactFiles = fs.existsSync(outputDir)
    ? fs.readdirSync(outputDir).filter(name => /^API_SMOKE_\d+\.json$/.test(name)).sort()
    : [];
  const artifactData = artifactFiles.map(name => JSON.parse(fs.readFileSync(path.join(outputDir, name), 'utf8')));
  const reportedGuardDocumentIds = new Set<string>();
  for (const report of artifactData) {
    for (const row of report.created_records ?? []) {
      if (row.type === 'guard_document' && row.id) reportedGuardDocumentIds.add(row.id);
    }
  }
  const guardDocuments = reportedGuardDocumentIds.size
    ? await prisma.guardDocument.findMany({ where: { id: { in: [...reportedGuardDocumentIds] } }, select: { id: true, guardUserId: true, filePath: true, createdAt: true } })
    : [];

  const [employerAadhaarVerifications, guardAadhaarVerifications, emailOtps, emailDeliveryLogs, modifiedEmployerProfiles, modifiedGuardProfiles] = await Promise.all([
    prisma.employerAadhaarVerification.findMany({
      where: { employerUserId: { in: demoUserIds }, createdAt: { gte: smokeStart } },
      select: { id: true, employerUserId: true, verificationStatus: true, providerName: true, createdAt: true },
    }),
    prisma.guardAadhaarVerification.findMany({
      where: { guardUserId: { in: demoUserIds }, createdAt: { gte: smokeStart } },
      select: { id: true, guardUserId: true, verificationStatus: true, providerName: true, createdAt: true },
    }),
    prisma.emailOtp.findMany({
      where: {
        createdAt: { gte: smokeStart },
        OR: [
          { email: { in: demoEmails } },
          { email: { contains: LOWER_PREFIX } },
          { referenceId: { in: payments.map(row => row.id) } },
        ],
      },
      select: { id: true, email: true, userId: true, purpose: true, referenceId: true, createdAt: true },
    }),
    prisma.emailDeliveryLog.findMany({
      where: {
        createdAt: { gte: smokeStart },
        OR: [{ toEmail: { in: demoEmails } }, { toEmail: { contains: LOWER_PREFIX } }],
      },
      select: { id: true, kind: true, status: true, toEmail: true, subject: true, createdAt: true },
    }),
    prisma.employerProfile.findMany({
      where: { userId: { in: demoUserIds }, updatedAt: { gte: smokeStart } },
      select: { id: true, userId: true, isAadhaarVerified: true, aadhaarVerificationStatus: true, aadhaarLastFour: true, updatedAt: true },
    }),
    prisma.guardProfile.findMany({
      where: { userId: { in: demoUserIds }, updatedAt: { gte: smokeStart } },
      select: { id: true, userId: true, aadhaarStatus: true, avatarUrl: true, updatedAt: true },
    }),
  ]);

  const uploadedFiles = [path.resolve('storage', 'app'), path.resolve('storage', 'public')]
    .flatMap(walkFiles)
    .filter(file => fs.statSync(file).mtime >= smokeStart)
    .map(file => path.relative(process.cwd(), file).replace(/\\/g, '/'));

  const inventory = {
    generated_at: new Date().toISOString(),
    prefix: PREFIX,
    warning: 'Read-only inventory. Delete dependent records before parent jobs, companies, or users. Review pre-existing demo profile state before restoring fields.',
    artifact_reports: artifactFiles,
    records: { users, companies, sites, jobs, applications, attendance, interviews, offers, agreements, payments, companyDocuments, guardDocuments, tickets, notifications, employerAadhaarVerifications, guardAadhaarVerifications, emailOtps, emailDeliveryLogs },
    pre_existing_demo_profiles_modified_during_smoke_window: { employerProfiles: modifiedEmployerProfiles, guardProfiles: modifiedGuardProfiles },
    uploaded_files_created_during_smoke_window: uploadedFiles,
    counts: {
      database_records: [users, companies, sites, jobs, applications, attendance, interviews, offers, agreements, payments, companyDocuments, guardDocuments, tickets, notifications, employerAadhaarVerifications, guardAadhaarVerifications, emailOtps, emailDeliveryLogs].reduce((sum, rows) => sum + rows.length, 0),
      pre_existing_demo_profiles_to_review: modifiedEmployerProfiles.length + modifiedGuardProfiles.length,
      uploaded_files: uploadedFiles.length,
    },
  };
  const output = path.join(outputDir, 'cleanup-inventory.json');
  fs.writeFileSync(output, JSON.stringify(inventory, null, 2));
  console.log(JSON.stringify({ output, ...inventory.counts }, null, 2));
}

main().finally(() => prisma.$disconnect());
