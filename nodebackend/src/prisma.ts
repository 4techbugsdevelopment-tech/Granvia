import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { env } from './config/env';

// Prisma 7 requires a database driver adapter for direct connections.
// PrismaMssql accepts the existing Prisma/JDBC-style SQL Server URL, so the
// DATABASE_URL used by local development and deployment remains unchanged.
const adapter = new PrismaMssql(env.databaseUrl);

// Single shared PrismaClient instance and connection pool.
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});
