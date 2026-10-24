import type { Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../utils/http';

export function assertAdminEmployeeClient() {
  const client = prisma as unknown as {
    adminEmployeeRole?: { findMany?: unknown };
    adminEmployee?: { findMany?: unknown };
  };
  if (typeof client.adminEmployeeRole?.findMany !== 'function' || typeof client.adminEmployee?.findMany !== 'function') {
    throw new HttpError(503, 'Super Admin employee management needs an updated backend Prisma Client. Build the backend (npm run build), then restart the API service.');
  }
}

/** A deployment failure is unavailable, never a successful empty role list. */
export function withAdminEmployeeStorage(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    assertAdminEmployeeClient();
    try { return await handler(req, res); }
    catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2021' || code === 'P2022') {
        throw new HttpError(503, 'Super Admin employee management database setup is incomplete. Apply the 20261023120000_super_admin_employees migration, then restart the API service.');
      }
      throw error;
    }
  };
}
