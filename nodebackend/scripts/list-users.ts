import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      mobile: true,
      role: true,
      accountStatus: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTotal accounts: ${users.length}\n`);
  for (const u of users) {
    console.log(
      [
        (u.role ?? '').padEnd(15),
        (u.email ?? '').padEnd(32),
        (u.mobile ?? '').padEnd(12),
        `status=${u.accountStatus ?? '?'}`.padEnd(18),
        `verified=${u.emailVerifiedAt ? 'yes' : 'no'}`,
      ].join('  ')
    );
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('DB query failed:', e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
