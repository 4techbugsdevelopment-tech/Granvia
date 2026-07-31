import 'dotenv/config';
import { prisma } from '../src/prisma';
import { hashPassword } from '../src/utils/password';

type LegacyEmployerRow = {
  id: string;
  company_name: string;
  contact_person_name: string;
  designation: string | null;
  mobile: string | null;
  email: string;
  password: string | null;
  company_address: string | null;
  billing_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  business_type: string | null;
  gst_number: string | null;
  pan_number: string | null;
  website: string | null;
  logo: string | null;
  description: string | null;
  verification_status: string | null;
  account_status: string | null;
  role: string | null;
  created_from: string | null;
  profile_status: string | null;
  is_aadhaar_verified: boolean | number | null;
  aadhaar_verification_status: string | null;
  aadhaar_verified_at: Date | string | null;
  aadhaar_last_four: string | null;
  admin_remarks: string | null;
  rejection_reason: string | null;
  created_at: Date | string | null;
};

type Summary = {
  scanned: number;
  createdUsers: number;
  updatedUsers: number;
  createdProfiles: number;
  updatedProfiles: number;
  createdCompanies: number;
  updatedCompanies: number;
  skipped: number;
  conflicts: number;
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asLower(value: unknown): string | null {
  return asString(value)?.toLowerCase() ?? null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d\d\$/.test(value);
}

function normalizePassword(password: string | null): Promise<string> {
  if (!password) {
    return hashPassword(`legacy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  }
  if (isBcryptHash(password)) {
    return Promise.resolve(password);
  }
  return hashPassword(password);
}

function normalizeAccountStatus(value: unknown): 'active' | 'inactive' | 'blocked' | 'pending' {
  switch (asLower(value)) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'blocked':
      return 'blocked';
    case 'pending':
    case 'pending_verification':
      return 'pending';
    default:
      return 'active';
  }
}

function normalizeProfileStatus(value: unknown): string {
  const status = asLower(value);
  if (!status) return 'complete';
  if (status === 'complete' || status === 'incomplete' || status === 'pending') return status;
  return status;
}

function normalizeVerificationStatus(value: unknown): string {
  const status = asLower(value);
  if (!status) return 'pending';
  return status;
}

function normalizeCreatedFrom(value: unknown): 'app' | 'super_admin' {
  return asLower(value) === 'super_admin' ? 'super_admin' : 'app';
}

function shouldCreateCompany(row: LegacyEmployerRow): boolean {
  return Boolean(asString(row.company_name));
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const legacyTableExists = await prisma.$queryRawUnsafe<Array<{ exists_flag: number }>>(
    "SELECT CASE WHEN OBJECT_ID('dbo.employers', 'U') IS NULL THEN 0 ELSE 1 END AS exists_flag"
  );

  if (!legacyTableExists[0]?.exists_flag) {
    console.log('Legacy table dbo.employers does not exist. Nothing to backfill.');
    return;
  }

  const legacyRows = await prisma.$queryRawUnsafe<LegacyEmployerRow[]>(
    `SELECT
       id,
       company_name,
       contact_person_name,
       designation,
       mobile,
       email,
       password,
       company_address,
       billing_address,
       city,
       state,
       pincode,
       business_type,
       gst_number,
       pan_number,
       website,
       logo,
       description,
       verification_status,
       account_status,
       role,
       created_from,
       profile_status,
       is_aadhaar_verified,
       aadhaar_verification_status,
       aadhaar_verified_at,
       aadhaar_last_four,
       admin_remarks,
       rejection_reason,
       created_at
     FROM dbo.employers
     ORDER BY created_at ASC`
  );

  const summary: Summary = {
    scanned: legacyRows.length,
    createdUsers: 0,
    updatedUsers: 0,
    createdProfiles: 0,
    updatedProfiles: 0,
    createdCompanies: 0,
    updatedCompanies: 0,
    skipped: 0,
    conflicts: 0,
  };

  for (const row of legacyRows) {
    const email = asString(row.email);
    const legacyRole = asLower(row.role);
    if (!email) {
      summary.skipped++;
      console.log(`[skip] ${row.id}: missing email`);
      continue;
    }

    if (legacyRole && legacyRole !== 'employer') {
      summary.skipped++;
      console.log(`[skip] ${email}: legacy role is "${legacyRole}"`);
      continue;
    }

    const contactPersonName = asString(row.contact_person_name) ?? asString(row.company_name) ?? email;
    const mobile = asString(row.mobile);
    const accountStatus = normalizeAccountStatus(row.account_status);
    const profileStatus = normalizeProfileStatus(row.profile_status);
    const verificationStatus = normalizeVerificationStatus(row.verification_status);
    const createdFrom = normalizeCreatedFrom(row.created_from);
    const companyName = asString(row.company_name);
    const companyAddress = asString(row.company_address);
    const billingAddress = asString(row.billing_address);
    const city = asString(row.city);
    const state = asString(row.state);
    const pincode = asString(row.pincode);
    const businessType = asString(row.business_type);
    const designation = asString(row.designation);
    const website = asString(row.website);
    const logoUrl = asString(row.logo);
    const description = asString(row.description);
    const adminRemarks = asString(row.admin_remarks);
    const rejectionReason = asString(row.rejection_reason);
    const aadhaarLastFour = asString(row.aadhaar_last_four);
    const aadhaarVerificationStatus = normalizeVerificationStatus(row.aadhaar_verification_status);
    const aadhaarVerifiedAt = asDate(row.aadhaar_verified_at);
    const createdAt = asDate(row.created_at) ?? new Date();
    const emailVerifiedAt = accountStatus === 'active' ? createdAt : null;
    const passwordHash = await normalizePassword(asString(row.password));

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email } });

      if (existingUser && existingUser.role !== 'employer') {
        summary.conflicts++;
        console.log(`[conflict] ${email}: existing user role is "${existingUser.role}"`);
        return null;
      }

      let userId = existingUser?.id ?? null;

      if (!existingUser) {
        if (dryRun) {
          userId = `(dry-run:${email})`;
        } else {
          const created = await tx.user.create({
            data: {
              fullName: contactPersonName,
              email,
              mobile,
              password: passwordHash,
              role: 'employer',
              profileType: 'employer',
              accountStatus,
              emailVerifiedAt,
            },
          });
          userId = created.id;
          summary.createdUsers++;
        }
      } else {
        const userUpdates: Record<string, unknown> = {};
        if (existingUser.fullName !== contactPersonName) userUpdates.fullName = contactPersonName;
        if (mobile !== null && (existingUser.mobile ?? null) !== mobile) userUpdates.mobile = mobile;
        if (existingUser.role !== 'employer') userUpdates.role = 'employer';
        if (existingUser.profileType !== 'employer') userUpdates.profileType = 'employer';
        if (existingUser.accountStatus !== accountStatus) userUpdates.accountStatus = accountStatus;
        if (emailVerifiedAt && !existingUser.emailVerifiedAt) userUpdates.emailVerifiedAt = emailVerifiedAt;
        if (!existingUser.password || existingUser.password !== passwordHash) userUpdates.password = passwordHash;

        if (!dryRun && Object.keys(userUpdates).length) {
          await tx.user.update({ where: { id: existingUser.id }, data: userUpdates });
          summary.updatedUsers++;
        }
      }

      if (!userId) {
        return null;
      }

      const existingProfile = existingUser
        ? await tx.employerProfile.findUnique({ where: { userId: existingUser.id } })
        : null;

      if (!existingProfile) {
        if (!dryRun) {
          await tx.employerProfile.create({
            data: {
              userId: userId,
              contactPersonName,
              designation,
              city,
              state,
              pincode,
              profileStatus,
              verificationStatus,
              isAadhaarVerified: Boolean(row.is_aadhaar_verified),
              aadhaarVerificationStatus,
              aadhaarVerifiedAt,
              aadhaarLastFour,
              adminRemarks,
              rejectionReason,
              createdFrom,
            },
          });
          summary.createdProfiles++;
        }
      } else {
        const profileUpdates: Record<string, unknown> = {};
        if ((existingProfile.contactPersonName ?? null) !== contactPersonName) profileUpdates.contactPersonName = contactPersonName;
        if (designation !== null && (existingProfile.designation ?? null) !== designation) profileUpdates.designation = designation;
        if (city !== null && (existingProfile.city ?? null) !== city) profileUpdates.city = city;
        if (state !== null && (existingProfile.state ?? null) !== state) profileUpdates.state = state;
        if (pincode !== null && (existingProfile.pincode ?? null) !== pincode) profileUpdates.pincode = pincode;
        if (existingProfile.profileStatus !== profileStatus) profileUpdates.profileStatus = profileStatus;
        if (existingProfile.verificationStatus !== verificationStatus) profileUpdates.verificationStatus = verificationStatus;
        if (existingProfile.isAadhaarVerified !== Boolean(row.is_aadhaar_verified)) {
          profileUpdates.isAadhaarVerified = Boolean(row.is_aadhaar_verified);
        }
        if (existingProfile.aadhaarVerificationStatus !== aadhaarVerificationStatus) {
          profileUpdates.aadhaarVerificationStatus = aadhaarVerificationStatus;
        }
        if ((existingProfile.aadhaarVerifiedAt ?? null) !== aadhaarVerifiedAt) profileUpdates.aadhaarVerifiedAt = aadhaarVerifiedAt;
        if (aadhaarLastFour !== null && (existingProfile.aadhaarLastFour ?? null) !== aadhaarLastFour) profileUpdates.aadhaarLastFour = aadhaarLastFour;
        if (adminRemarks !== null && (existingProfile.adminRemarks ?? null) !== adminRemarks) profileUpdates.adminRemarks = adminRemarks;
        if (rejectionReason !== null && (existingProfile.rejectionReason ?? null) !== rejectionReason) profileUpdates.rejectionReason = rejectionReason;
        if ((existingProfile.createdFrom ?? null) !== createdFrom) profileUpdates.createdFrom = createdFrom;

        if (!dryRun && Object.keys(profileUpdates).length) {
          await tx.employerProfile.update({ where: { userId: existingProfile.userId }, data: profileUpdates });
          summary.updatedProfiles++;
        }
      }

      if (shouldCreateCompany(row)) {
        const existingCompany = existingUser
          ? await tx.employerCompany.findFirst({ where: { employerUserId: existingUser.id } })
          : null;

        if (!existingCompany) {
          if (!dryRun) {
            await tx.employerCompany.create({
              data: {
                employerUserId: userId,
                companyName: companyName!,
                businessType,
                gstNumber: asString(row.gst_number),
                panNumber: asString(row.pan_number),
                companyEmail: email,
                companyPhone: mobile,
                website,
                logoUrl,
                description,
                registeredAddress: companyAddress,
                billingAddress,
                city,
                state,
                pincode,
                verificationStatus,
                accountStatus,
                adminRemarks,
                rejectionReason,
              },
            });
            summary.createdCompanies++;
          }
        } else {
          const companyUpdates: Record<string, unknown> = {};
          if ((existingCompany.companyName ?? null) !== companyName) companyUpdates.companyName = companyName;
          if (businessType !== null && (existingCompany.businessType ?? null) !== businessType) companyUpdates.businessType = businessType;
          if (asString(row.gst_number) !== null && (existingCompany.gstNumber ?? null) !== asString(row.gst_number)) companyUpdates.gstNumber = asString(row.gst_number);
          if (asString(row.pan_number) !== null && (existingCompany.panNumber ?? null) !== asString(row.pan_number)) companyUpdates.panNumber = asString(row.pan_number);
          if ((existingCompany.companyEmail ?? null) !== email) companyUpdates.companyEmail = email;
          if (mobile !== null && (existingCompany.companyPhone ?? null) !== mobile) companyUpdates.companyPhone = mobile;
          if (website !== null && (existingCompany.website ?? null) !== website) companyUpdates.website = website;
          if (logoUrl !== null && (existingCompany.logoUrl ?? null) !== logoUrl) companyUpdates.logoUrl = logoUrl;
          if (description !== null && (existingCompany.description ?? null) !== description) companyUpdates.description = description;
          if (companyAddress !== null && (existingCompany.registeredAddress ?? null) !== companyAddress) companyUpdates.registeredAddress = companyAddress;
          if (billingAddress !== null && (existingCompany.billingAddress ?? null) !== billingAddress) companyUpdates.billingAddress = billingAddress;
          if (city !== null && (existingCompany.city ?? null) !== city) companyUpdates.city = city;
          if (state !== null && (existingCompany.state ?? null) !== state) companyUpdates.state = state;
          if (pincode !== null && (existingCompany.pincode ?? null) !== pincode) companyUpdates.pincode = pincode;
          if (existingCompany.verificationStatus !== verificationStatus) companyUpdates.verificationStatus = verificationStatus;
          if (existingCompany.accountStatus !== accountStatus) companyUpdates.accountStatus = accountStatus;
          if (adminRemarks !== null && (existingCompany.adminRemarks ?? null) !== adminRemarks) companyUpdates.adminRemarks = adminRemarks;
          if (rejectionReason !== null && (existingCompany.rejectionReason ?? null) !== rejectionReason) companyUpdates.rejectionReason = rejectionReason;

          if (!dryRun && Object.keys(companyUpdates).length) {
            await tx.employerCompany.update({ where: { id: existingCompany.id }, data: companyUpdates });
            summary.updatedCompanies++;
          }
        }
      }

      return userId;
    });

    if (result) {
      console.log(
        `${dryRun ? '[dry-run]' : '[ok]'} ${email} -> role=employer status=${accountStatus} company=${companyName ?? '(none)'}`
      );
    }
  }

  console.log('');
  console.log(
    [
      `scanned=${summary.scanned}`,
      `createdUsers=${summary.createdUsers}`,
      `updatedUsers=${summary.updatedUsers}`,
      `createdProfiles=${summary.createdProfiles}`,
      `updatedProfiles=${summary.updatedProfiles}`,
      `createdCompanies=${summary.createdCompanies}`,
      `updatedCompanies=${summary.updatedCompanies}`,
      `skipped=${summary.skipped}`,
      `conflicts=${summary.conflicts}`,
      `mode=${dryRun ? 'dry-run' : 'apply'}`,
    ].join('  ')
  );
}

main()
  .catch((error) => {
    console.error('Employer backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
