import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance (mirrors Laravel's singleton DB connection).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});
