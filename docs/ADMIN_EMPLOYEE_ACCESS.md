# Super Admin roles and employees

2026-10-26 extension: [Granvia managed company departments](GRANVIA_MANAGED_COMPANY_DEPARTMENTS.md) adds Company HR/Sales/Operations/Accounts permissions, per-company staff allocations and a scoped department workspace. These permissions must use separate roles from the platform-wide modules described below. The extension adds its own migration and has not been installed in the configured database.

Implemented locally on 2026-10-23. The configured database tables and list queries are now verified. Deployed backend restart and real-account browser acceptance remain unverified.

## Web flow

1. Super Admin opens **Super Admin Roles** (`/admin/employee-roles`), creates a named role, selects modules and sets its status.
2. Super Admin opens **Super Admin Employees** (`/admin/employees`), enters name, email, mobile, role, password and account status.
3. Employees sign in at `/admin` using email and password. Existing configured login OTP behavior still applies. Their persisted account role is `admin_employee`, separate from `super_admin`.
4. Only assigned modules appear in the employee menu. Direct page access is checked too. At the admin root, employees without Dashboard access start at their first assigned module. With no assigned modules they see an access message.
5. Employee list supports View, Edit, Delete and WhatsApp Share. Edit can change role/status and optionally reset password. Password reset and blocking/inactivation revoke existing tokens. Deletion transactionally removes tokens, the employee assignment and login user.

## Permissions and ownership

- New `admin_employee_roles` and `admin_employees` tables isolate these definitions from the existing employer/sub-admin `roles` and `staff_members` flow. Existing Role Master is labelled **Employer Staff Roles** in the admin menu.
- Each Super Admin manages their own roles and employees. Backend queries scope both by the authenticated Super Admin ID. An employee can only be assigned an active role owned by the same Super Admin.
- Modules: Dashboard, Associate Management, Employer Management, Job Management, Attendance, Hiring Workflow, Wallet & Payments, Reports, Email Logs, Associate Types, City & State Master.
- A selected module grants the existing module's viewing and management operations. These are not separate View/Add/Edit/Delete grants. Reports include the platform reports and exports exposed by that module; Dashboard includes platform summary counts.
- Employees cannot manage Super Admin roles/employees, employer staff role definitions, internal staff accounts, or platform Settings. These remain Super Admin functions.
- Every admin API request checks the stored account status, active assigned role, active owning Super Admin, ownership consistency and current module permissions. Unknown API resource groups fail closed. Permission edits apply to the next API request. Menu changes appear after a session/profile refresh.
- Only after this check does the `/admin` guard project the employee's role to the existing admin handlers' expected `super_admin` value for that request. The database/session login role stays `admin_employee`. Other portals are not granted access.
- Job Management has a minimal read-only company/site options API so it does not require access to Employer Management's full records/wallets. Applicant actions embedded in Job Management accept Job Management or Hiring Workflow permission. Employer wallet credit requires Wallet & Payments permission.
- Assigned roles cannot be deleted until employees are reassigned. Inactivating a role blocks employee access, including existing sessions.

## Passwords and WhatsApp

Passwords use the existing bcrypt hashing and strong-password policy (12 characters, uppercase, lowercase, number, symbol). Employee list responses select only public account fields and never return a password/hash. Passwords cannot be retrieved later.

After creation or password reset, the password just entered is kept only in component state for a share dialog and cleared when the dialog closes. WhatsApp Share prepares a `wa.me` message with the login URL, email and role; a freshly saved password is included when available. Otherwise the message refers to the current password or Forgot Password. The Super Admin reviews and sends the message in WhatsApp. No WhatsApp API or automatic sending was added.

## API and release

- `GET/POST /admin/employee-roles`; `PATCH/DELETE /admin/employee-roles/:role`.
- `GET/POST /admin/employees`; `PATCH/DELETE /admin/employees/:employee`.
- `GET /admin/jobs/options`: minimal job-form company/site choices.
- Migration: `nodebackend/prisma/migrations/20261023120000_super_admin_employees/migration.sql`.

From `nodebackend`, `npm.cmd run setup:admin-employees` checks only this feature's delegates, tables and list queries. `npm.cmd run setup:admin-employees -- --apply` installs only its missing additive tables, refusing a partial/incompatible schema. It does not run unrelated pending migrations, seed users, reset data, or modify the Prisma migration ledger. The feature migration SQL now tolerates already-created tables so a later controlled migration deployment can record it without duplicate-table errors. Review unrelated pending migrations before using the general migration-deploy command.

The earlier Prisma CLI `migrate status` attempt failed with `P1011`, TLS connection setup: "No credentials are available in the security package (os error -2146893042)". Follow-up diagnosis of `/admin/employee-roles` confirmed that a fresh local generated client has both delegates, while both feature tables were absent. The runtime MSSQL adapter could connect successfully. The targeted setup command created both tables in the configured database; subsequent role and employee-relation reads passed. No employee accounts or existing records were written. No running local Granvia API process was identified for restart, and the reported serving environment has not been confirmed.

Local verification: Prisma schema validation, backend/frontend production builds, `npm.cmd run test:admin-employees` (19 focused tests), and `npm.cmd run test:reports` (60 existing regression tests). Follow-up backend build passed and configured-database list queries passed after targeted setup. Controller/session/HTTP guard tests use mocked database delegates; they do not prove authenticated API CRUD or browser behavior. The full frontend typecheck reports existing errors in other employer/attendance files and no errors in the new feature files.

For the reported `undefined.findMany` deployment failure, rebuild the actual deployed backend (`npm run build`, which regenerates Prisma Client) and restart its existing API service. Generating on disk does not update a long-running Node process. `npm run dev` now generates the client before starting the watcher. Employee-management endpoints return a clear 503 for stale delegates or missing schema rather than a TypeError or a misleading empty list; these guards are not a substitute for deployment and schema setup.

Release acceptance still needs real Super Admin role/employee CRUD, employee login including configured OTP, menu refresh, direct API denial, role inactivation, password reset, deletion and WhatsApp message review on the target environment. This work does not implement login or permission enforcement for the existing employer staff records.
