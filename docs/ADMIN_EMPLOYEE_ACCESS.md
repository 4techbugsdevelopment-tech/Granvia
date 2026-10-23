# Super Admin roles and employees

Implemented locally on 2026-10-23. Database migration and real-account browser acceptance remain pending.

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

Once database connectivity and the target environment are verified, use the normal migration deployment process (`npx.cmd prisma migrate deploy` from `nodebackend`) and restart the backend built with the regenerated Prisma Client. Check migration status first so unrelated pending migrations are reviewed before deployment.

The read-only `prisma migrate status` attempt failed with `P1011`, TLS connection setup: "No credentials are available in the security package (os error -2146893042)". No database migration or live account writes were performed for this feature.

Local verification: Prisma schema validation, backend/frontend production builds, `npm.cmd run test:admin-employees` (16 focused tests), and `npm.cmd run test:reports` (60 existing regression tests). Controller/session/HTTP guard tests use mocked database delegates; they do not prove live SQL Server CRUD or browser behavior. The full frontend typecheck reports existing errors in other employer/attendance files and no errors in the new feature files.

Release acceptance still needs real Super Admin role/employee CRUD, employee login including configured OTP, menu refresh, direct API denial, role inactivation, password reset, deletion and WhatsApp message review on the target environment. This work does not implement login or permission enforcement for the existing employer staff records.
