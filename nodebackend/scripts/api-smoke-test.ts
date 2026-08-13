import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/prisma';

type Role = 'super_admin' | 'employer' | 'guard' | 'sales_executive' | 'sub_admin';
type Result = { method: string; route: string; status: number; outcome: 'pass' | 'expected' | 'fail' | 'skip'; detail?: string };

const baseUrl = (process.env.API_SMOKE_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const marker = `API_SMOKE_${stamp}`;
const password = 'SmokeTest123!';
const results: Result[] = [];
const created: Array<{ type: string; id?: string; marker?: string; deleted?: boolean; note?: string }> = [];
const tokens = {} as Record<Role, string>;
const mobile = (offset: number) => `98${String(Number(stamp.slice(-7)) + offset).padStart(8, '0').slice(-8)}`;

const demo: Record<Role, { email: string; password: string }> = {
  super_admin: { email: process.env.DEMO_SUPERADMIN_EMAIL || 'admin@granvia.test', password: process.env.DEMO_SUPERADMIN_PASSWORD || 'password' },
  employer: { email: process.env.DEMO_EMPLOYER_EMAIL || 'employer@granvia.test', password: process.env.DEMO_EMPLOYER_PASSWORD || 'password' },
  guard: { email: process.env.DEMO_GUARD_EMAIL || 'guard@granvia.test', password: process.env.DEMO_GUARD_PASSWORD || 'password' },
  sales_executive: { email: process.env.DEMO_SALES_EMAIL || 'sales@granvia.test', password: process.env.DEMO_SALES_PASSWORD || 'password' },
  sub_admin: { email: process.env.DEMO_SUBADMIN_EMAIL || 'subadmin@granvia.test', password: process.env.DEMO_SUBADMIN_PASSWORD || 'password' },
};

type CallOptions = {
  role?: Role;
  body?: unknown;
  form?: FormData;
  expected?: number[];
  expectedFailure?: boolean;
};

async function call(method: string, route: string, actualPath = route, options: CallOptions = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.role) headers.Authorization = `Bearer ${tokens[options.role]}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  let status = 0;
  let parsed: any = null;
  let text = '';
  try {
    const response = await fetch(`${baseUrl}${actualPath}`, {
      method,
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    text = await response.text();
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    const expected = options.expected ?? [200, 201, 204];
    const ok = expected.includes(status);
    results.push({
      method,
      route,
      status,
      outcome: ok ? (options.expectedFailure ? 'expected' : 'pass') : 'fail',
      ...(!ok || options.expectedFailure ? { detail: String(parsed?.message ?? text ?? '').slice(0, 240) } : {}),
    });
  } catch (error) {
    results.push({ method, route, status, outcome: 'fail', detail: error instanceof Error ? error.message : String(error) });
  }
  return { status, data: parsed };
}

function requireData<T = any>(response: { status: number; data: any }, label: string): T {
  if (response.status < 200 || response.status >= 300) throw new Error(`${label} dependency failed with HTTP ${response.status}`);
  return response.data as T;
}

function formWithFile(fields: Record<string, string>, filename: string, mime: string, bytes: Uint8Array) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('file', new Blob([bytes], { type: mime }), filename);
  return form;
}

function writeReport(aborted?: unknown) {
  const outputDir = path.resolve(process.cwd(), 'api-smoke-artifacts');
  fs.mkdirSync(outputDir, { recursive: true });
  const summary = {
    marker,
    base_url: baseUrl,
    generated_at: new Date().toISOString(),
    ...(aborted ? { aborted: aborted instanceof Error ? aborted.message : String(aborted) } : {}),
    counts: {
      total: results.length,
      pass: results.filter(r => r.outcome === 'pass').length,
      expected: results.filter(r => r.outcome === 'expected').length,
      fail: results.filter(r => r.outcome === 'fail').length,
      skip: results.filter(r => r.outcome === 'skip').length,
    },
    results,
    created_records: created,
  };
  const output = path.join(outputDir, `${marker}.json`);
  fs.writeFileSync(output, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ output, ...summary.counts, ...(aborted ? { aborted: summary.aborted } : {}) }, null, 2));
  if (summary.counts.fail || aborted) process.exitCode = 1;
}

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
const pdf = Uint8Array.from(Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'));

async function loginAll() {
  for (const role of Object.keys(demo) as Role[]) {
    const response = await call('POST', '/auth/login', '/auth/login', { body: { email: demo[role].email, password: demo[role].password, role } });
    const data = requireData(response, `${role} login`);
    if (!data.token) throw new Error(`${role} login did not return a token (2FA may be enabled)`);
    tokens[role] = data.token;
    await call('GET', '/auth/me', '/auth/me', { role });
  }
}

async function main() {
  console.log(`Starting ${marker} against ${baseUrl}`);
  await call('GET', '/jobs');
  await loginAll();

  const users = await prisma.user.findMany({ where: { email: { in: Object.values(demo).map(v => v.email) } } });
  const byRole = Object.fromEntries(users.map(u => [u.role, u])) as Record<Role, (typeof users)[number]>;
  const employerId = byRole.employer.id;
  const guardId = byRole.guard.id;
  const salesId = byRole.sales_executive.id;
  const subAdminId = byRole.sub_admin.id;

  // Shared profile, role, notification and support routes.
  await call('GET', '/me/profile', '/me/profile', { role: 'employer' });
  await call('PATCH', '/me/profile', '/me/profile', { role: 'employer', body: { full_name: byRole.employer.fullName, mobile: byRole.employer.mobile } });
  const avatar = await call('POST', '/me/avatar', '/me/avatar', { role: 'employer', form: formWithFile({}, `${marker}.png`, 'image/png', png) });
  if (avatar.data?.avatar_url) created.push({ type: 'uploaded_avatar', marker: avatar.data.avatar_url });
  await call('GET', '/me/employer-profile', '/me/employer-profile', { role: 'employer' });
  await call('PATCH', '/me/employer-profile', '/me/employer-profile', { role: 'employer', body: { city: 'Mumbai' } });
  await call('GET', '/me/guard-profile', '/me/guard-profile', { role: 'guard' });
  await call('PATCH', '/me/guard-profile', '/me/guard-profile', { role: 'guard', body: { city: 'Mumbai' } });
  await call('GET', '/me/roles', '/me/roles', { role: 'employer' });

  const notification = await prisma.notification.create({ data: { userId: employerId, type: 'api_smoke', title: marker, message: marker } });
  created.push({ type: 'notification', id: notification.id });
  await call('GET', '/me/notifications', '/me/notifications', { role: 'employer' });
  await call('PATCH', '/me/notifications/:notification/read', `/me/notifications/${notification.id}/read`, { role: 'employer' });

  const ticket = requireData(await call('POST', '/me/support-tickets', '/me/support-tickets', {
    role: 'employer', body: { subject: marker, priority: 'low', message: `${marker} endpoint verification` },
  }), 'support ticket');
  created.push({ type: 'support_ticket', id: ticket.id });
  await call('GET', '/me/support-tickets', '/me/support-tickets', { role: 'employer' });

  // Admin roles endpoint, also supplies a valid role for both staff modules.
  await call('GET', '/admin/roles', '/admin/roles', { role: 'super_admin' });
  const roleResponse = await call('POST', '/admin/roles', '/admin/roles', {
    role: 'super_admin', body: { name: `${marker}_Role`, description: marker, permissions: ['Dashboard'], status: 'active' },
  });
  const role = roleResponse.status === 201 ? roleResponse.data : null;
  if (role) {
    created.push({ type: 'role', id: role.id, marker: role.name });
    await call('PATCH', '/admin/roles/:role', `/admin/roles/${role.id}`, { role: 'super_admin', body: { description: `${marker} updated` } });
  } else {
    results.push({ method: 'PATCH', route: '/admin/roles/:role', status: 0, outcome: 'skip', detail: 'role create fixture failed' });
  }

  // Employer company/site/document/job chain.
  await call('GET', '/employer/companies', '/employer/companies', { role: 'employer' });
  const company = requireData(await call('POST', '/employer/companies', '/employer/companies', {
    role: 'employer', body: { company_name: `${marker} Company`, business_type: 'API Test', company_email: `${marker.toLowerCase()}@example.invalid`, company_phone: mobile(1), city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  }), 'company create');
  created.push({ type: 'company', id: company.id, marker: company.company_name });
  await call('PATCH', '/employer/companies/:company', `/employer/companies/${company.id}`, { role: 'employer', body: { description: `${marker} updated` } });
  await call('POST', '/employer/companies/:company/logo', `/employer/companies/${company.id}/logo`, { role: 'employer', form: formWithFile({}, `${marker}.png`, 'image/png', png) });

  const site = requireData(await call('POST', '/employer/sites', '/employer/sites', {
    role: 'employer', body: { company_id: company.id, site_name: `${marker} Site`, site_type: 'Office', address: 'API Smoke Test Address', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', contact_person: 'Smoke Tester', contact_mobile: mobile(2), latitude: 19.076, longitude: 72.8777, status: 'active' },
  }), 'site create');
  created.push({ type: 'site', id: site.id, marker: site.site_name });
  await call('GET', '/employer/companies/:company/sites', `/employer/companies/${company.id}/sites`, { role: 'employer' });
  await call('PATCH', '/employer/sites/:site', `/employer/sites/${site.id}`, { role: 'employer', body: { notes: `${marker} updated` } });

  const companyDoc = requireData(await call('POST', '/employer/companies/:company/documents', `/employer/companies/${company.id}/documents`, {
    role: 'employer', form: formWithFile({ document_type: 'other' }, `${marker}.pdf`, 'application/pdf', pdf),
  }), 'company document');
  created.push({ type: 'company_document', id: companyDoc.id, marker: companyDoc.file_path });
  await call('GET', '/employer/companies/:company/documents', `/employer/companies/${company.id}/documents`, { role: 'employer' });

  const jobPayload = { company_id: company.id, site_id: site.id, title: `${marker} Job`, guards_required: 1, salary_amount: 25000, payment_type: 'Monthly', duty_hours: '8 hours', shift_type: 'Day', start_date: new Date().toISOString(), required_skills: ['API Testing'], language_requirements: ['English'] };
  const job = requireData(await call('POST', '/employer/jobs', '/employer/jobs', { role: 'employer', body: jobPayload }), 'job create');
  created.push({ type: 'job', id: job.id, marker: job.title });
  await call('GET', '/employer/jobs', `/employer/jobs?company_id=${company.id}`, { role: 'employer' });
  await call('PATCH', '/employer/jobs/:job', `/employer/jobs/${job.id}`, { role: 'employer', body: { description: `${marker} updated` } });
  await call('GET', '/admin/jobs/pending', '/admin/jobs/pending', { role: 'super_admin' });
  await call('GET', '/admin/jobs', '/admin/jobs', { role: 'super_admin' });
  await call('PATCH', '/admin/jobs/:job/approve', `/admin/jobs/${job.id}/approve`, { role: 'super_admin' });
  await call('PATCH', '/admin/jobs/:job/status', `/admin/jobs/${job.id}/status`, { role: 'super_admin', body: { status: 'pending_approval' } });
  await call('PATCH', '/admin/jobs/:job/reject', `/admin/jobs/${job.id}/reject`, { role: 'super_admin', body: { reason: marker } });
  await call('PATCH', '/admin/jobs/:job/approve', `/admin/jobs/${job.id}/approve`, { role: 'super_admin' });

  const deleteJob = requireData(await call('POST', '/employer/jobs', '/employer/jobs', { role: 'employer', body: { ...jobPayload, title: `${marker} Delete Job` } }), 'delete job create');
  const deletedJobEntry = { type: 'job_delete_fixture', id: deleteJob.id, marker: deleteJob.title, deleted: false };
  created.push(deletedJobEntry);
  const deleteJobResponse = await call('DELETE', '/admin/jobs/:job', `/admin/jobs/${deleteJob.id}`, { role: 'super_admin' });
  if (deleteJobResponse.status === 200) deletedJobEntry.deleted = true;

  const employerDeleteJob = requireData(await call('POST', '/employer/jobs', '/employer/jobs', { role: 'employer', body: { ...jobPayload, title: `${marker} Employer Delete Job` } }), 'employer delete job create');
  const employerDeleteEntry = { type: 'employer_job_delete_fixture', id: employerDeleteJob.id, marker: employerDeleteJob.title, deleted: false };
  created.push(employerDeleteEntry);
  if ((await call('DELETE', '/employer/jobs/:job', `/employer/jobs/${employerDeleteJob.id}`, { role: 'employer' })).status === 200) employerDeleteEntry.deleted = true;

  // Guard application, documents and attendance; employer hiring workflow.
  const application = requireData(await call('POST', '/guard/jobs/:job/apply', `/guard/jobs/${job.id}/apply`, { role: 'guard', body: { cover_note: marker } }), 'application');
  created.push({ type: 'job_application', id: application.id });
  await call('GET', '/guard/applications', '/guard/applications', { role: 'guard' });
  await call('GET', '/guard/applications/job-ids', '/guard/applications/job-ids', { role: 'guard' });
  await call('GET', '/employer/applications', `/employer/applications?company_id=${company.id}`, { role: 'employer' });
  await call('PATCH', '/employer/applications/:application/status', `/employer/applications/${application.id}/status`, { role: 'employer', body: { status: 'selected', remarks: marker } });
  await call('PATCH', '/employer/associates/:guard/aadhaar', `/employer/associates/${guardId}/aadhaar`, { role: 'employer', body: { status: 'verified', remarks: marker } });

  const guardDoc = requireData(await call('POST', '/guard/documents', '/guard/documents', {
    role: 'guard', form: formWithFile({ document_type: 'other' }, `${marker}.pdf`, 'application/pdf', pdf),
  }), 'guard document');
  created.push({ type: 'guard_document', id: guardDoc.id, marker: guardDoc.file_path });
  await call('GET', '/guard/documents', '/guard/documents', { role: 'guard' });
  await call('GET', '/admin/guards/:guard/documents', `/admin/guards/${guardId}/documents`, { role: 'super_admin' });
  await call('PATCH', '/admin/guard-documents/:document', `/admin/guard-documents/${guardDoc.id}`, { role: 'super_admin', body: { status: 'verified', admin_remarks: marker } });
  if (guardDoc.file_url) await call('GET', '/files/download', guardDoc.file_url.replace(/^\/api/, ''));

  await call('GET', '/guard/attendance', '/guard/attendance', { role: 'guard' });
  const attendance = await call('POST', '/guard/attendance/check-in', '/guard/attendance/check-in', { role: 'guard', body: { job_id: job.id, guard_remarks: marker } });
  if (attendance.status === 201) {
    created.push({ type: 'attendance', id: attendance.data.id });
    await call('PATCH', '/guard/attendance/:record/check-out', `/guard/attendance/${attendance.data.id}/check-out`, { role: 'guard', body: { guard_remarks: `${marker} checkout` } });
    await call('PATCH', '/employer/attendance/:record/status', `/employer/attendance/${attendance.data.id}/status`, { role: 'employer', body: { status: 'verified', employer_remarks: marker } });
  } else {
    results.push({ method: 'PATCH', route: '/guard/attendance/:record/check-out', status: 0, outcome: 'skip', detail: 'check-in fixture failed' });
    results.push({ method: 'PATCH', route: '/employer/attendance/:record/status', status: 0, outcome: 'skip', detail: 'check-in fixture failed' });
  }
  await call('GET', '/employer/attendance', `/employer/attendance?company_id=${company.id}`, { role: 'employer' });

  const interview = requireData(await call('POST', '/employer/interview-requests', '/employer/interview-requests', { role: 'employer', body: { application_id: application.id, job_id: job.id, guard_user_id: guardId, company_id: company.id, request_type: 'interview', preferred_date: new Date().toISOString(), message: marker } }), 'interview');
  created.push({ type: 'interview_request', id: interview.id });
  await call('GET', '/employer/interview-requests', `/employer/interview-requests?company_id=${company.id}`, { role: 'employer' });
  await call('PATCH', '/employer/interview-requests/:interviewRequest', `/employer/interview-requests/${interview.id}`, { role: 'employer', body: { status: 'confirmed' } });

  const offer = requireData(await call('POST', '/employer/job-offers', '/employer/job-offers', { role: 'employer', body: { application_id: application.id, job_id: job.id, guard_user_id: guardId, company_id: company.id, site_id: site.id, offered_salary: 25000, duty_hours: '8 hours', shift_type: 'Day', start_date: new Date().toISOString(), terms_summary: marker } }), 'offer');
  created.push({ type: 'job_offer', id: offer.id });
  await call('GET', '/employer/job-offers', `/employer/job-offers?company_id=${company.id}`, { role: 'employer' });
  await call('PATCH', '/employer/job-offers/:jobOffer', `/employer/job-offers/${offer.id}`, { role: 'employer', body: { status: 'accepted' } });

  const agreement = requireData(await call('POST', '/employer/agreements', '/employer/agreements', { role: 'employer', body: { offer_id: offer.id, job_id: job.id, guard_user_id: guardId, site_id: site.id, title: `${marker} Agreement`, terms: { marker }, effective_from: new Date().toISOString() } }), 'agreement');
  created.push({ type: 'agreement', id: agreement.id });
  await call('GET', '/employer/agreements', `/employer/agreements?company_id=${company.id}`, { role: 'employer' });
  await call('PATCH', '/employer/agreements/:agreement', `/employer/agreements/${agreement.id}`, { role: 'employer', body: { status: 'active', employer_confirmation_status: 'confirmed' } });

  const payment = requireData(await call('POST', '/employer/payments', '/employer/payments', { role: 'employer', body: { guard_user_id: guardId, job_id: job.id, application_id: application.id, amount: 100, payment_method: 'cash', payment_status: 'pending' } }), 'payment');
  created.push({ type: 'payment', id: payment.id });
  await call('GET', '/employer/payments', `/employer/payments?company_id=${company.id}`, { role: 'employer' });
  const otpResponse = await call('POST', '/employer/payments/:payment/request-otp', `/employer/payments/${payment.id}/request-otp`, { role: 'employer', body: {} });
  if (otpResponse.status === 200 && otpResponse.data?.dev_otp) {
    await call('POST', '/employer/payments/:payment/confirm-otp', `/employer/payments/${payment.id}/confirm-otp`, { role: 'employer', body: { otp: otpResponse.data.dev_otp } });
  } else {
    results.push({ method: 'POST', route: '/employer/payments/:payment/confirm-otp', status: 0, outcome: 'skip', detail: 'No development OTP returned; no real mailbox access used' });
  }
  await call('GET', '/employer/invoices', `/employer/invoices?company_id=${company.id}`, { role: 'employer' });
  await call('GET', '/employer/wallet', '/employer/wallet', { role: 'employer' });
  await call('GET', '/employer/wallet/transactions', '/employer/wallet/transactions', { role: 'employer' });
  await call('GET', '/employer/reports/counts', `/employer/reports/counts?company_id=${company.id}`, { role: 'employer' });

  // Employer staff and sub-admin CRUD.
  await call('GET', '/employer/staff', '/employer/staff', { role: 'employer' });
  const employerStaffCall = await call('POST', '/employer/staff', '/employer/staff', { role: 'employer', body: { name: `${marker} Staff`, role_id: role?.id ?? '00000000-0000-0000-0000-000000000000', email: `${marker.toLowerCase()}.staff@example.invalid`, mobile: mobile(3), status: 'Active' } });
  if (employerStaffCall.status === 201) {
    const employerStaff = employerStaffCall.data;
    const employerStaffEntry = { type: 'employer_staff', id: employerStaff.id, deleted: false }; created.push(employerStaffEntry);
    await call('PATCH', '/employer/staff/:staff', `/employer/staff/${employerStaff.id}`, { role: 'employer', body: { status: 'Inactive' } });
    if ((await call('DELETE', '/employer/staff/:staff', `/employer/staff/${employerStaff.id}`, { role: 'employer' })).status === 200) employerStaffEntry.deleted = true;
  } else {
    results.push({ method: 'PATCH', route: '/employer/staff/:staff', status: 0, outcome: 'skip', detail: 'staff create fixture failed' });
    results.push({ method: 'DELETE', route: '/employer/staff/:staff', status: 0, outcome: 'skip', detail: 'staff create fixture failed' });
  }

  await call('GET', '/employer/subadmins', '/employer/subadmins', { role: 'employer' });
  const subFixtureCall = await call('POST', '/employer/subadmins', '/employer/subadmins', { role: 'employer', body: { full_name: `${marker} Subadmin`, email: `${marker.toLowerCase()}.sub@example.invalid`, mobile: mobile(4), password, branch_name: marker, status: 'active' } });
  if (subFixtureCall.status === 201) {
    const subFixture = subFixtureCall.data;
    const subFixtureEntry = { type: 'employer_subadmin', id: subFixture.id, deleted: false }; created.push(subFixtureEntry);
    await call('PATCH', '/employer/subadmins/:subAdmin', `/employer/subadmins/${subFixture.id}`, { role: 'employer', body: { status: 'inactive' } });
    if ((await call('DELETE', '/employer/subadmins/:subAdmin', `/employer/subadmins/${subFixture.id}`, { role: 'employer' })).status === 200) subFixtureEntry.deleted = true;
  } else {
    results.push({ method: 'PATCH', route: '/employer/subadmins/:subAdmin', status: 0, outcome: 'skip', detail: 'sub-admin create fixture failed' });
    results.push({ method: 'DELETE', route: '/employer/subadmins/:subAdmin', status: 0, outcome: 'skip', detail: 'sub-admin create fixture failed' });
  }

  // Admin dashboards, guard management and manual Aadhaar declarations.
  await call('GET', '/admin/guards', `/admin/guards?search=${encodeURIComponent(marker)}`, { role: 'super_admin' });
  const adminGuardResponse = requireData(await call('POST', '/admin/guards', '/admin/guards', { role: 'super_admin', body: { full_name: `${marker} Guard`, email: `${marker.toLowerCase()}.guard@example.invalid`, mobile: mobile(5), password, city: 'Mumbai', state: 'Maharashtra', pincode: '400001', skills: ['API Testing'], languages: ['English'], verification_status: 'pending', account_status: 'active' } }), 'admin guard');
  const adminGuardId = adminGuardResponse.user?.id;
  created.push({ type: 'admin_guard', id: adminGuardId, marker: `${marker.toLowerCase()}.guard@example.invalid`, note: 'No admin guard delete endpoint exists' });
  if (adminGuardId) {
    await call('PATCH', '/admin/guards/:guard', `/admin/guards/${adminGuardId}`, { role: 'super_admin', body: { experience: marker } });
    await call('PATCH', '/admin/guards/:guard/aadhaar', `/admin/guards/${adminGuardId}/aadhaar`, { role: 'super_admin', body: { status: 'verified', remarks: marker } });
  }
  await call('PATCH', '/admin/employers/:employer/aadhaar', `/admin/employers/${employerId}/aadhaar`, { role: 'super_admin', body: { status: 'verified', remarks: marker } });
  await call('GET', '/admin/reports/counts', '/admin/reports/counts', { role: 'super_admin' });
  await call('GET', '/admin/reports/analytics', '/admin/reports/analytics', { role: 'super_admin' });
  await call('GET', '/admin/attendance', '/admin/attendance', { role: 'super_admin' });
  await call('GET', '/admin/hiring', '/admin/hiring', { role: 'super_admin' });
  await call('GET', '/admin/email-logs', `/admin/email-logs?q=${encodeURIComponent(marker)}&limit=10`, { role: 'super_admin' });
  await call('GET', '/admin/employers', '/admin/employers', { role: 'super_admin' });

  const adminEmployerCall = await call('POST', '/admin/employers', '/admin/employers', { role: 'super_admin', body: { contact_person_name: `${marker} Employer`, mobile: mobile(6), email: `${marker.toLowerCase()}.employer@example.invalid`, password, city: 'Mumbai', state: 'Maharashtra', pincode: '400001', company_name: `${marker} Admin Company`, account_status: 'active' }, expected: [201, 502] });
  let adminEmployerId = adminEmployerCall.data?.employer?.id;
  if (!adminEmployerId) adminEmployerId = (await prisma.user.findUnique({ where: { email: `${marker.toLowerCase()}.employer@example.invalid` } }))?.id;
  if (adminEmployerId) {
    const entry = { type: 'admin_employer', id: adminEmployerId, deleted: false }; created.push(entry);
    await call('PATCH', '/admin/employers/:employer', `/admin/employers/${adminEmployerId}`, { role: 'super_admin', body: { designation: marker } });
    if ((await call('DELETE', '/admin/employers/:employer', `/admin/employers/${adminEmployerId}`, { role: 'super_admin' })).status === 200) entry.deleted = true;
  } else {
    results.push({ method: 'PATCH', route: '/admin/employers/:employer', status: 0, outcome: 'skip', detail: 'create fixture failed' });
    results.push({ method: 'DELETE', route: '/admin/employers/:employer', status: 0, outcome: 'skip', detail: 'create fixture failed' });
  }

  // Sales and sub-admin scope setup is temporary and restored in finally.
  const employerProfile = await prisma.employerProfile.findUniqueOrThrow({ where: { userId: employerId } });
  const guardProfile = await prisma.guardProfile.findUniqueOrThrow({ where: { userId: guardId } });
  const oldAssignments = { salesExecutiveId: employerProfile.salesExecutiveId, employerSubAdminId: employerProfile.subAdminId, guardSubAdminId: guardProfile.subAdminId };
  try {
    await prisma.employerProfile.update({ where: { userId: employerId }, data: { salesExecutiveId: salesId, subAdminId } });
    await prisma.guardProfile.update({ where: { userId: guardId }, data: { subAdminId } });

    await call('GET', '/sales/reports/counts', '/sales/reports/counts', { role: 'sales_executive' });
    await call('GET', '/sales/activity', '/sales/activity', { role: 'sales_executive' });
    await call('GET', '/sales/clients', '/sales/clients', { role: 'sales_executive' });
    await call('GET', '/sales/clients/:employer', `/sales/clients/${employerId}`, { role: 'sales_executive' });
    const salesOtp = await call('POST', '/sales/jobs/request-otp', '/sales/jobs/request-otp', { role: 'sales_executive', body: { employer_user_id: employerId } });
    if (salesOtp.status === 200) {
      const salesJob = await call('POST', '/sales/jobs', '/sales/jobs', { role: 'sales_executive', body: { otp_id: salesOtp.data.otp_id, otp: salesOtp.data.dev_otp, employer_user_id: employerId, company_id: company.id, site_id: site.id, title: `${marker} Sales Job`, duty_hours: '8 hours', guards_required: 1, salary_amount: 26000, description: marker } });
      if (salesJob.status === 201) created.push({ type: 'sales_job', id: salesJob.data.id, marker: salesJob.data.title });
    } else results.push({ method: 'POST', route: '/sales/jobs', status: 0, outcome: 'skip', detail: 'request OTP fixture failed' });
    await call('GET', '/sales/discounts', '/sales/discounts', { role: 'sales_executive' });
    const discount = requireData(await call('POST', '/sales/discounts', '/sales/discounts', { role: 'sales_executive', body: { employer_user_id: employerId, label: marker, discount_type: 'percentage', value: 5, status: 'Active' } }), 'discount');
    const discountEntry = { type: 'sales_discount', id: discount.id, deleted: false }; created.push(discountEntry);
    await call('PATCH', '/sales/discounts/:discount', `/sales/discounts/${discount.id}`, { role: 'sales_executive', body: { value: 6 } });
    if ((await call('DELETE', '/sales/discounts/:discount', `/sales/discounts/${discount.id}`, { role: 'sales_executive' })).status === 200) discountEntry.deleted = true;
    await call('GET', '/sales/manpower', '/sales/manpower?lat=19.076&lng=72.8777&radius=25', { role: 'sales_executive' });

    await call('GET', '/subadmin/reports/counts', '/subadmin/reports/counts', { role: 'sub_admin' });
    const subCompany = await call('GET', '/subadmin/company', '/subadmin/company', { role: 'sub_admin' });
    await call('PATCH', '/subadmin/company', '/subadmin/company', { role: 'sub_admin', body: { branch_name: subCompany.data?.profile?.branch_name || 'Granvia Regional Office - West' } });
    await call('GET', '/subadmin/staff', '/subadmin/staff', { role: 'sub_admin' });
    const subStaffCall = await call('POST', '/subadmin/staff', '/subadmin/staff', { role: 'sub_admin', body: { name: `${marker} Branch Staff`, role_id: role?.id ?? '00000000-0000-0000-0000-000000000000', email: `${marker.toLowerCase()}.branch@example.invalid`, mobile: mobile(7), status: 'Active' } });
    if (subStaffCall.status === 201) {
      const subStaff = subStaffCall.data;
      const subStaffEntry = { type: 'subadmin_staff', id: subStaff.id, deleted: false }; created.push(subStaffEntry);
      await call('PATCH', '/subadmin/staff/:staff', `/subadmin/staff/${subStaff.id}`, { role: 'sub_admin', body: { status: 'Inactive' } });
      if ((await call('DELETE', '/subadmin/staff/:staff', `/subadmin/staff/${subStaff.id}`, { role: 'sub_admin' })).status === 200) subStaffEntry.deleted = true;
    } else {
      results.push({ method: 'PATCH', route: '/subadmin/staff/:staff', status: 0, outcome: 'skip', detail: 'staff create fixture failed' });
      results.push({ method: 'DELETE', route: '/subadmin/staff/:staff', status: 0, outcome: 'skip', detail: 'staff create fixture failed' });
    }
    await call('GET', '/subadmin/verification', '/subadmin/verification', { role: 'sub_admin' });
    await call('PATCH', '/subadmin/guard-documents/:document', `/subadmin/guard-documents/${guardDoc.id}`, { role: 'sub_admin', body: { status: 'verified', admin_remarks: marker } });
    await call('GET', '/subadmin/clients', '/subadmin/clients', { role: 'sub_admin' });
    await call('GET', '/subadmin/guards', '/subadmin/guards', { role: 'sub_admin' });
    await call('GET', '/subadmin/reports/skills', '/subadmin/reports/skills', { role: 'sub_admin' });
    await call('GET', '/subadmin/reports/commission', '/subadmin/reports/commission', { role: 'sub_admin' });
  } finally {
    await prisma.employerProfile.update({ where: { userId: employerId }, data: { salesExecutiveId: oldAssignments.salesExecutiveId, subAdminId: oldAssignments.employerSubAdminId } });
    await prisma.guardProfile.update({ where: { userId: guardId }, data: { subAdminId: oldAssignments.guardSubAdminId } });
  }

  // Feature-gated and security-negative routes: the expected response proves routing/middleware behavior.
  await call('GET', '/employer/aadhaar', '/employer/aadhaar', { role: 'employer' });
  await call('POST', '/employer/aadhaar/verify-instant', '/employer/aadhaar/verify-instant', { role: 'employer', body: { aadhaar_number: '999999999999' }, expected: [403], expectedFailure: true });
  await call('POST', '/employer/aadhaar/send-otp', '/employer/aadhaar/send-otp', { role: 'employer', body: { aadhaar_number: '999999999999' }, expected: [403], expectedFailure: true });
  await call('POST', '/employer/aadhaar/verify-otp', '/employer/aadhaar/verify-otp', { role: 'employer', body: { otp: '000000' }, expected: [403], expectedFailure: true });
  await call('GET', '/guard/aadhaar', '/guard/aadhaar', { role: 'guard' });
  await call('POST', '/guard/aadhaar/mock-session', '/guard/aadhaar/mock-session', { role: 'guard', body: {}, expected: [403], expectedFailure: true });
  await call('POST', '/guard/aadhaar/verify-instant', '/guard/aadhaar/verify-instant', { role: 'guard', body: { aadhaar_number: '999999999999' }, expected: [403], expectedFailure: true });
  await call('POST', '/guard/aadhaar/send-otp', '/guard/aadhaar/send-otp', { role: 'guard', body: { aadhaar_number: '999999999999' }, expected: [403], expectedFailure: true });
  await call('POST', '/guard/aadhaar/verify-otp', '/guard/aadhaar/verify-otp', { role: 'guard', body: { otp: '000000' }, expected: [403], expectedFailure: true });
  await call('GET', '/files/download', '/files/download?path=invalid&expires=0&signature=invalid', { expected: [403], expectedFailure: true });
  await call('GET', '/email/verify/:id/:hash', `/email/verify/${employerId}/invalid?expires=0&signature=invalid`, { expected: [403], expectedFailure: true });
  await call('POST', '/auth/login/verify-otp', '/auth/login/verify-otp', { body: { email: 'nobody@example.invalid', otp: '000000' }, expected: [422], expectedFailure: true });
  await call('POST', '/auth/email/verify-otp', '/auth/email/verify-otp', { body: { email: 'nobody@example.invalid', otp: '000000' }, expected: [422], expectedFailure: true });
  await call('POST', '/auth/email/resend-otp', '/auth/email/resend-otp', { body: { email: 'nobody@example.invalid' } });
  await call('POST', '/auth/email/verification-notification', '/auth/email/verification-notification', { body: { email: 'nobody@example.invalid' } });
  await call('POST', '/auth/password/request-otp', '/auth/password/request-otp', { body: { email: 'nobody@example.invalid' } });
  await call('POST', '/auth/password/reset', '/auth/password/reset', { body: { email: 'nobody@example.invalid', otp: '000000', password }, expected: [422], expectedFailure: true });
  await call('POST', '/auth/test-email', '/auth/test-email', { body: { email: `${marker.toLowerCase()}@example.invalid` }, expected: [200, 502], expectedFailure: true });

  // Registration is deliberately last: mail delivery may fail after the DB transaction commits.
  const registrationInputs = [
    { route: '/auth/register/employer', email: `${marker.toLowerCase()}.registered-employer@example.invalid`, mobile: mobile(8), body: { contact_person_name: `${marker} Registered Employer`, city: 'Mumbai', state: 'Maharashtra', pincode: '400001', company_name: `${marker} Registered Company` } },
    { route: '/auth/register/guard', email: `${marker.toLowerCase()}.registered-guard@example.invalid`, mobile: mobile(9), body: { full_name: `${marker} Registered Guard`, city: 'Mumbai', state: 'Maharashtra', pincode: '400001' } },
  ];
  for (const item of registrationInputs) {
    await call('POST', item.route, item.route, { body: { ...item.body, email: item.email, mobile: item.mobile, password }, expected: [201, 500] });
    const registered = await prisma.user.findUnique({ where: { email: item.email } });
    if (registered) created.push({ type: 'registered_user', id: registered.id, marker: item.email, note: 'Registration endpoint fixture' });
  }

  // Soft-delete role endpoint and logout are valid mutations; record their final state.
  if (role && (await call('DELETE', '/admin/roles/:role', `/admin/roles/${role.id}`, { role: 'super_admin' })).status === 200) {
    const entry = created.find(item => item.type === 'role' && item.id === role.id); if (entry) entry.note = 'Soft-deleted/inactive';
  } else if (!role) {
    results.push({ method: 'DELETE', route: '/admin/roles/:role', status: 0, outcome: 'skip', detail: 'role create fixture failed' });
  }
  for (const roleName of Object.keys(tokens) as Role[]) await call('POST', '/auth/logout', '/auth/logout', { role: roleName, body: {} });

  writeReport();
}

main()
  .catch(error => {
    console.error('Smoke test aborted:', error);
    writeReport(error);
  })
  .finally(async () => prisma.$disconnect());
