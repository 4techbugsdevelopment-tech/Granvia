import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import { prisma } from '../src/prisma';
import { uploadCompanyLogo, uploadEmployerLogo } from '../src/controllers/adminEmployerController';
import { HttpError } from '../src/utils/http';

function mock(t: { after: (fn: () => void) => void }, object: any, key: string, implementation: any) {
  const previous = object[key];
  object[key] = implementation;
  t.after(() => { object[key] = previous; });
}

function responseCapture() {
  let body: any;
  const response = { json(value: any) { body = value; return response; } } as unknown as Response;
  return { response, body: () => body };
}

const image = { originalname: 'brand.png', mimetype: 'image/png', size: 4, buffer: Buffer.from('logo') };

test('delegated admin employees cannot upload employer branding', async t => {
  let writes = 0;
  mock(t, prisma.user, 'findUnique', async () => ({ role: 'admin_employee', accountStatus: 'active' }));
  mock(t, prisma.employerProfile, 'update', async () => { writes += 1; });
  await assert.rejects(
    () => uploadEmployerLogo({ user: { id: 'employee-1' }, params: { employer: 'employer-1' }, file: image } as unknown as Request, responseCapture().response),
    (error) => error instanceof HttpError && error.status === 403,
  );
  assert.equal(writes, 0);
});

test('Super Admin employer logo upload validates image type and size', async t => {
  mock(t, prisma.user, 'findUnique', async ({ where }: any) => where.id === 'admin-1'
    ? { role: 'super_admin', accountStatus: 'active' }
    : { id: 'employer-1', role: 'employer', employerProfile: { id: 'profile-1' } });
  await assert.rejects(
    () => uploadEmployerLogo({ user: { id: 'admin-1' }, params: { employer: 'employer-1' }, file: { ...image, mimetype: 'image/svg+xml' } } as unknown as Request, responseCapture().response),
    (error) => error instanceof HttpError && error.status === 422,
  );
});

test('Super Admin can store an employer logo against the employer profile', async t => {
  let updateData: any; let attemptedDirectory = false; let attemptedWrite = false;
  mock(t, prisma.user, 'findUnique', async ({ where }: any) => where.id === 'admin-1'
    ? { role: 'super_admin', accountStatus: 'active' }
    : { id: 'employer-1', role: 'employer', employerProfile: { id: 'profile-1' } });
  mock(t, prisma.employerProfile, 'update', async ({ data }: any) => { updateData = data; return { id: 'profile-1', userId: 'employer-1', ...data }; });
  mock(t, fs, 'mkdirSync', () => { attemptedDirectory = true; });
  mock(t, fs, 'writeFileSync', () => { attemptedWrite = true; });
  const captured = responseCapture();
  await uploadEmployerLogo({ user: { id: 'admin-1' }, params: { employer: 'employer-1' }, file: image } as unknown as Request, captured.response);
  assert.equal(attemptedDirectory, true);
  assert.equal(attemptedWrite, true);
  assert.match(updateData.logoUrl, /\/storage\/employer-logos\/employer-1\//);
  assert.equal(captured.body().logo_url, updateData.logoUrl);
});

test('company logo upload rejects a company outside the selected employer', async t => {
  mock(t, prisma.user, 'findUnique', async () => ({ role: 'super_admin', accountStatus: 'active' }));
  mock(t, prisma.employerCompany, 'findFirst', async ({ where }: any) => {
    assert.deepEqual(where, { id: 'company-1', employerUserId: 'employer-1' });
    return null;
  });
  await assert.rejects(
    () => uploadCompanyLogo({ user: { id: 'admin-1' }, params: { employer: 'employer-1', company: 'company-1' }, file: image } as unknown as Request, responseCapture().response),
    (error) => error instanceof HttpError && error.status === 404,
  );
});

test('Super Admin can upload a logo for a company owned by the selected employer', async t => {
  let updateData: any;
  mock(t, prisma.user, 'findUnique', async () => ({ role: 'super_admin', accountStatus: 'active' }));
  mock(t, prisma.employerCompany, 'findFirst', async () => ({ id: 'company-1', employerUserId: 'employer-1' }));
  mock(t, prisma.employerCompany, 'update', async ({ data }: any) => { updateData = data; return { id: 'company-1', employerUserId: 'employer-1', ...data }; });
  mock(t, fs, 'mkdirSync', () => undefined);
  mock(t, fs, 'writeFileSync', () => undefined);
  const captured = responseCapture();
  await uploadCompanyLogo({ user: { id: 'admin-1' }, params: { employer: 'employer-1', company: 'company-1' }, file: image } as unknown as Request, captured.response);
  assert.match(updateData.logoUrl, /\/storage\/company-logos\/company-1\//);
  assert.equal(captured.body().logo_url, updateData.logoUrl);
});
