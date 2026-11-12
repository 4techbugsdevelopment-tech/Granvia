# Minimum Wage Existing System Audit

Status: Phase A0 complete on 2026-11-10. This document describes the source tree only; no production database or deployment was changed.

## 1. Existing architecture

Granvia has a React/Vite frontend and an Express/TypeScript backend. Prisma targets SQL Server. Protected employer routes use bearer authentication plus the `employer` role. Super Admin routes use the existing admin-panel middleware, which also supports explicitly permitted Admin Employees.

The source salary and compliance flow is split across:

- `JobPost`, `JobSalaryStructure`, `JobSalaryComponent`, salary templates, statutory rules, and salary audit events.
- `EmployerCompany` and `CompanySite`, whose state/city text is the current job-location source.
- `StateMaster` and `CityMaster`, which provide controlled location masters but are not yet foreign keys on job sites.
- State-aware LWF policy versions and separate legacy Super Admin/employer LWF compatibility settings.
- Payroll periods, runs, immutable result lines, LWF liabilities, payments, and audit events.
- Attendance settlement, which intentionally rejects monthly gross as a daily settlement amount when an approved daily rate is missing.

## 2. Relevant source files and functions

- `nodebackend/prisma/schema.prisma`: database models and relationships.
- `nodebackend/src/controllers/jobController.ts`: employer/admin job create, edit, approval, and status changes.
- `nodebackend/src/services/salaryStructureService.ts`: decimal-safe salary validation, calculation, LWF injection, and salary snapshots.
- `nodebackend/src/services/lwfService.ts`: effective-dated state LWF resolution.
- `nodebackend/src/services/payrollService.ts`: full-period monthly payroll and immutable payroll lines.
- `nodebackend/src/controllers/attendanceController.ts`: hourly/daily settlement and monthly safety boundary.
- `nodebackend/src/routes/adminRoutes.ts` and `employerRoutes.ts`: authenticated API registration.
- `frontend/src/employer/EmployerApp.tsx`: Employer Add/Edit Job workflow.
- `frontend/src/web-admin/pages/JobApprovals.tsx`: Super Admin job workflow.
- `frontend/src/components/salary/SalaryStructurePanel.tsx`: salary bifurcation UI and client preview.
- `frontend/src/web-admin/AdminApp.tsx` and `Sidebar.tsx`: admin routing and menu.

## 3. Existing database relationships

A job belongs to an employer and can reference a company and site. A job has at most one current salary structure and many salary components/audit events. Company and site hold state/city as text. `StateMaster` is already used by LWF policy versions. Current salary structures do not contain a minimum-wage policy reference, and no minimum-wage notification, rate, coverage, snapshot, or compliance-audit tables exist.

## 4. Existing salary calculation flow

Employer or Super Admin submits salary components with a Monthly or Daily payment type. The backend validates decimal amounts, calculates gross, deductions, net pay, employer contributions, employer cost, and annual CTC, resolves managed LWF where applicable, then saves the structure and copies its gross to `JobPost.salaryAmount` for compatibility. Current validation only requires positive gross and deductions not exceeding gross. It does not enforce a statutory wage floor.

## 5. Integration points

Minimum-wage resolution belongs in a separate backend service. Job create/edit must resolve after the job and salary structure are available inside the same transaction, save an immutable decision snapshot, and block publication/approval unless the decision is verified and compliant. Draft records may remain review-required. Employer and Super Admin job forms should request a read-only preview whenever location, category, start date, payment frequency, or salary components change. Payroll may display the saved decision but must not invent monthly-to-daily conversion.

## 6. Regression risks

- Treating gross, net, or total CTC as legally qualifying wages without an approved component definition.
- Guessing a state from incomplete free-text location data.
- Treating a generic state rate as applicable when district, zone, scheduled employment, skill, or occupation is unresolved.
- Changing an approved notification or historical job snapshot in place.
- Mixing LWF and minimum-wage applicability rules.
- Introducing an arbitrary monthly/daily conversion.
- Publishing a job while policy data is missing, stale, conflicting, or unverified.
- Deploying schema changes before reconciling the existing Prisma migration state.

## 7. Recommended architecture

Add isolated, effective-dated jurisdiction, notification, rate, role-mapping, coverage, job-snapshot, and audit models. Store flexible applicability and qualifying-component definitions as validated JSON text while retaining indexed first-class fields for state, district/city, zone, employment category, occupation, skill, unit, and dates. Only approved notifications/rates can resolve as verified. Ambiguous matches must fail closed. A dedicated minimum-wage service performs resolution and compliance comparison using Prisma Decimal values.

## 8. Missing information and dependencies

No government rates are bundled or inferred. Verified legal notifications, scheduled-employment mappings, zone definitions, skill mappings, qualifying wage components, and conversion rules must be entered and approved by an authorized compliance administrator. Existing free-text site state/city values may need controlled mapping. India-wide geographic representation is not the same as verified rate coverage.

## 9. Migration strategy

Use one additive SQL Server migration. Do not alter or backfill historical salaries, payments, wallets, or payroll results. Create new tables and indexes, add only optional relations to current models, and populate the coverage registry separately. Apply the migration only through the normal reviewed deployment process; this implementation does not deploy it to production.

## 10. Phased implementation plan

1. A1: Add additive Prisma models and SQL migration.
2. A2: Add the resolver, compliance comparison, snapshots, and unit tests.
3. A3: Add Super Admin notification/rate/coverage management and approval APIs/UI.
4. A4: Add Employer and Super Admin job previews and server-side publish/approval blocking.
5. A5: Reuse existing salary results for qualifying-wage comparison without replacing salary calculation.
6. A6: Add coverage, notification, job-compliance, and audit views.
7. A7: Record monitoring/discovery candidates for review; never auto-approve.
8. A8: Build, run focused regressions, validate the migration, and publish the implementation/usage guide.

