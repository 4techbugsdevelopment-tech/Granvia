import 'dotenv/config';
import { prisma } from '../src/prisma';
import { hashPassword, verifyPassword } from '../src/utils/password';

type DemoAccount = {
  role: 'super_admin' | 'employer' | 'guard' | 'sales_executive' | 'sub_admin';
  email: string;
  password: string;
  fullName: string;
  mobile: string;
};

const demoAccounts: DemoAccount[] = [
  {
    role: 'super_admin',
    email: process.env.DEMO_SUPERADMIN_EMAIL || process.env.VITE_DEMO_SUPERADMIN_EMAIL || 'admin@granvia.test',
    password: process.env.DEMO_SUPERADMIN_PASSWORD || process.env.VITE_DEMO_SUPERADMIN_PASSWORD || 'password',
    fullName: 'Super Admin',
    mobile: '9000000000',
  },
  {
    role: 'employer',
    email: process.env.DEMO_EMPLOYER_EMAIL || process.env.VITE_DEMO_EMPLOYER_EMAIL || 'employer@granvia.test',
    password: process.env.DEMO_EMPLOYER_PASSWORD || process.env.VITE_DEMO_EMPLOYER_PASSWORD || 'password',
    fullName: 'Demo Employer',
    mobile: '9111111111',
  },
  {
    role: 'guard',
    email: process.env.DEMO_GUARD_EMAIL || process.env.VITE_DEMO_GUARD_EMAIL || 'guard@granvia.test',
    password: process.env.DEMO_GUARD_PASSWORD || process.env.VITE_DEMO_GUARD_PASSWORD || 'password',
    fullName: 'Demo Guard',
    mobile: '9222222222',
  },
  {
    role: 'sales_executive',
    email: process.env.DEMO_SALES_EMAIL || process.env.VITE_DEMO_SALES_EMAIL || 'sales@granvia.test',
    password: process.env.DEMO_SALES_PASSWORD || process.env.VITE_DEMO_SALES_PASSWORD || 'password',
    fullName: 'Demo Sales Executive',
    mobile: '9333333333',
  },
  {
    role: 'sub_admin',
    email: process.env.DEMO_SUBADMIN_EMAIL || process.env.VITE_DEMO_SUBADMIN_EMAIL || 'subadmin@granvia.test',
    password: process.env.DEMO_SUBADMIN_PASSWORD || process.env.VITE_DEMO_SUBADMIN_PASSWORD || 'password',
    fullName: 'Demo Sub Admin',
    mobile: '9444444444',
  },
];

function asBool(value: unknown): boolean {
  return Boolean(value);
}

async function ensureDemoAccount(account: DemoAccount, dryRun: boolean) {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    include: {
      employerProfile: true,
      employerWallet: true,
      guardProfile: true,
    },
  });

  const canonicalPasswordHash = await hashPassword(account.password);
  const passwordMatches = existing ? await verifyPassword(account.password, existing.password) : false;
  const needsUserCreate = !existing;
  const needsUserUpdate =
    Boolean(existing) &&
    (
      existing!.fullName !== account.fullName ||
      (existing!.mobile ?? null) !== account.mobile ||
      existing!.role !== account.role ||
      existing!.profileType !== account.role ||
      existing!.accountStatus !== 'active' ||
      !existing!.emailVerifiedAt ||
      !passwordMatches
    );

  if (dryRun) {
    console.log(
      [
        `[dry-run] ${account.email}`,
        needsUserCreate ? 'create-user' : 'user-exists',
        needsUserUpdate ? 'update-user' : 'user-ok',
        account.role === 'employer'
          ? existing?.employerProfile
            ? 'employer-profile-ok'
            : 'create-employer-profile'
          : '',
      ]
        .filter(Boolean)
        .join('  ')
    );
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { email: account.email } });

    if (!current) {
      const created = await tx.user.create({
        data: {
          fullName: account.fullName,
          email: account.email,
          mobile: account.mobile,
          password: canonicalPasswordHash,
          role: account.role,
          profileType: account.role,
          accountStatus: 'active',
          emailVerifiedAt: new Date(),
        },
      });
      return created;
    }

    const userUpdates: Record<string, unknown> = {};
    if (current.fullName !== account.fullName) userUpdates.fullName = account.fullName;
    if ((current.mobile ?? null) !== account.mobile) userUpdates.mobile = account.mobile;
    if (current.role !== account.role) userUpdates.role = account.role;
    if (current.profileType !== account.role) userUpdates.profileType = account.role;
    if (current.accountStatus !== 'active') userUpdates.accountStatus = 'active';
    if (!current.emailVerifiedAt) userUpdates.emailVerifiedAt = new Date();
    if (!passwordMatches) userUpdates.password = canonicalPasswordHash;

    if (Object.keys(userUpdates).length) {
      await tx.user.update({ where: { email: account.email }, data: userUpdates });
    }

    return tx.user.findUniqueOrThrow({ where: { email: account.email } });
  });

  if (account.role === 'employer') {
    await prisma.$transaction(async (tx) => {
      const employerProfile = await tx.employerProfile.findUnique({ where: { userId: user.id } });
      if (!employerProfile) {
        await tx.employerProfile.create({
          data: {
            userId: user.id,
            contactPersonName: account.fullName,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            profileStatus: 'complete',
            verificationStatus: 'verified',
            createdFrom: 'super_admin',
            isAadhaarVerified: false,
            aadhaarVerificationStatus: 'pending',
          },
        });
      } else {
        const profileUpdates: Record<string, unknown> = {};
        if ((employerProfile.contactPersonName ?? null) !== account.fullName) profileUpdates.contactPersonName = account.fullName;
        if (employerProfile.profileStatus !== 'complete') profileUpdates.profileStatus = 'complete';
        if (employerProfile.verificationStatus !== 'verified') profileUpdates.verificationStatus = 'verified';
        if ((employerProfile.createdFrom ?? null) !== 'super_admin') profileUpdates.createdFrom = 'super_admin';
        if (Object.keys(profileUpdates).length) {
          await tx.employerProfile.update({ where: { userId: user.id }, data: profileUpdates });
        }
      }

      const company = await tx.employerCompany.findFirst({ where: { employerUserId: user.id } });
      if (!company) {
        await tx.employerCompany.create({
          data: {
            employerUserId: user.id,
            companyName: 'Demo Security Services',
            businessType: 'Private Limited',
            companyEmail: account.email,
            companyPhone: account.mobile,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            verificationStatus: 'verified',
            accountStatus: 'active',
          },
        });
      } else {
        const companyUpdates: Record<string, unknown> = {};
        if (company.companyName !== 'Demo Security Services') companyUpdates.companyName = 'Demo Security Services';
        if ((company.businessType ?? null) !== 'Private Limited') companyUpdates.businessType = 'Private Limited';
        if ((company.companyEmail ?? null) !== account.email) companyUpdates.companyEmail = account.email;
        if ((company.companyPhone ?? null) !== account.mobile) companyUpdates.companyPhone = account.mobile;
        if (company.verificationStatus !== 'verified') companyUpdates.verificationStatus = 'verified';
        if (company.accountStatus !== 'active') companyUpdates.accountStatus = 'active';
        if (Object.keys(companyUpdates).length) {
          await tx.employerCompany.update({ where: { id: company.id }, data: companyUpdates });
        }
      }
    });
  }

  if (account.role === 'guard') {
    await prisma.guardProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: account.fullName,
        mobile: account.mobile,
        city: 'Mumbai',
        state: 'Maharashtra',
        latitude: 19.076,
        longitude: 72.8777,
        skills: JSON.stringify(['CCTV Monitoring', 'Patrolling']),
        languages: JSON.stringify(['Hindi', 'English', 'Marathi']),
        experience: '5 years',
        qualification: 'Graduate',
        verificationStatus: 'verified',
      },
      update: {
        fullName: account.fullName,
        mobile: account.mobile,
        city: 'Mumbai',
        state: 'Maharashtra',
        verificationStatus: 'verified',
      },
    });
  }

  if (account.role === 'sub_admin') {
    const profileData = {
      userId: user.id,
      branchName: 'Granvia Regional Office - West',
      registrationNo: 'U74999MH2019PTC000000',
      gstNumber: '27AABCG1234K1Z5',
      address: '4th Floor, Nariman Point, Mumbai 400021',
      contactEmail: 'west@granvia.com',
      phone: '+91 22 4000 1200',
    };

    const existingProfile = await prisma.subAdminProfile.findFirst({ where: { userId: user.id } });
    if (!existingProfile) {
      await prisma.subAdminProfile.create({ data: profileData });
    } else {
      await prisma.subAdminProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
      });
    }
  }

  if (account.role === 'sales_executive') {
    // Sales auth only needs the user row for login; related sales data can be seeded separately.
  }

  console.log(`[ok] ${account.email} (${account.role})`);
}

async function main() {
  const dryRun = !process.argv.includes('--apply');

  console.log(dryRun ? 'Demo auth seeding in dry-run mode.' : 'Demo auth seeding applying changes.');
  for (const account of demoAccounts) {
    await ensureDemoAccount(account, dryRun);
  }
}

main()
  .catch((error) => {
    console.error('Demo auth seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
