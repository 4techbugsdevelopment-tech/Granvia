# Granvia managed company departments

Implemented in source on 2026-10-26. Database installation, deployed service restart and real-account browser acceptance have not been performed for this extension.

## Main functionality

Granvia can manage selected departments of an employer's companies through its own Super Admin employees. An employee may manage several companies; a company may have different employees for HR, Sales, Operations and Accounts. Several employees may support the same department. Allocations are explicit, one company and department at a time; allocating ten companies to one HR employee requires ten allocations.

1. Open **Super Admin Roles**. Create any role name, such as HR Executive, Regional Sales or Accounts Assistant, and choose the appropriate **Company HR**, **Company Sales**, **Company Operations**, or **Company Accounts** permission(s).
2. Open **Super Admin Employees** and create or edit an employee using that role.
3. Open **Company Staff Allocation** (`/admin/company-allocations`). Select the employer, company, department and Granvia employee, then choose **Allocate Company**. Only active employees with an active role allowing the selected department can be assigned. Select the next company to repeat for the same employee. Duplicate allocations are harmless.
4. Employees sign in through the existing `/admin` login and open **My Company Departments** (`/admin/managed-companies`). It appears automatically for roles with Company permissions. Employees without Dashboard permission start at their first allowed page.
5. Open an allocated company department to view its records and perform its permitted actions. Use the allocation search to find companies, employers, employees or departments, and see allocation/company counts.
6. Remove an allocation to revoke access on the next request. Change a role permission to revoke that department across all the employee's allocated companies. Inactivation of the employee, role, owning Super Admin, company or employer also blocks workspace access.

Role names are custom; the four department capabilities have explicit implementations. Renaming a role does not change its capabilities. New department types require a capability implementation rather than deriving access from a free-text role name.

## Available department operations

| Department | Company records and actions |
|---|---|
| HR | View company jobs and applicants, shortlist/reject applicants, send hire proposals using existing hiring capacity, acceptance and conflict rules. Associate names are resolved only for the scoped applicants. |
| Sales | View and update the company's email, mobile, website and description using existing company validation. |
| Operations | View company sites, update site contacts/notes, view attendance and approve/reject completed records using existing attendance and settlement rules. Rejection requires a reason. |
| Accounts | View company-linked invoices and their totals/status/dates; view GST number and edit the company's billing address. |

This workspace exposes the operations above. It does not implement a new sales CRM, custom departmental fields, job creation, payroll engine, invoice editing, payment execution or full employer-portal delegation. Employer wallets and many payments apply to the entire employer account and cannot safely be treated as company-scoped records; they are not exposed to these department roles. No commercial managed-service billing or employer contract/consent flow is added.

## Authorization and attribution

- Effective access requires both the current role's Company department permission and the employee-company-department allocation. Neither the role name nor a company ID supplied by the browser grants access.
- Assignment administration uses the real authenticated Super Admin identity. Only employees owned by that Super Admin may be assigned or unassigned. Company selection is platform-wide for Super Admin, consistent with existing employer administration.
- Each workspace request verifies the stored employee, owning Super Admin, role status/owner, department permission, allocation, company status and actual employer status/role. Every record mutation also checks both company and employer ownership. HR applications additionally require their job to belong to that same company/employer.
- Company permissions provide no access to existing platform-wide admin modules. Saving a role that mixes Company permissions and platform permissions is rejected; separate roles preserve the distinction. Existing platform module roles keep their established behavior.
- Employee login identity remains `admin_employee`. The selected existing business controller receives the employer identity only after company/department/record authorization, within that request. This does not issue an employer token or grant the staff account general employer access.
- Hiring review/status-log records preserve the actual Granvia employee ID. Attendance audit records identify the actual employee actor when the existing audit delegate is available. Site/contact/billing actions emit `[managed-company-action]` server logs containing actor, employer, company, department, record and HTTP response status; those actions have no new durable database audit table.
- Employee deletion removes allocations in the same transaction as token/login removal. Company deletion cascades its allocations. Permission or employee-role changes retain historical allocations, which are ineffective unless the current role permits the department; restoring that permission makes retained allocations effective again.

## Database and release

New table: `admin_company_assignments`, unique on `(employee_id, company_id, department)`, with foreign keys to `admin_employees` and `employer_companies`, a company index, and a database check for the four department codes.

Apply `nodebackend/prisma/migrations/20261026120000_admin_company_assignments/migration.sql` through the target environment's reviewed migration process, after the existing Super Admin employee tables and employer companies exist. The previous `setup:admin-employees` command only installs the earlier employee feature; it does **not** install this new table. Review pending migrations before any general migration deployment. This change has not connected to or modified the configured database.

Build the backend (`npm.cmd run build`) to regenerate Prisma Client, restart the API service, and publish the frontend build. An absent generated assignment delegate or missing assignment schema returns a setup-related 503. Employee deletion also requires this extension's table once this source version is deployed.

APIs:

- Super Admin: `GET /company-allocations/options`, `GET/POST /company-allocations`, `DELETE /company-allocations/:assignment`.
- Granvia employee: `GET /managed-companies`, `GET /managed-companies/:company/:department`.
- Department actions: `PATCH /managed-companies/:company/:department/:resource/:record`. Only the implemented department/resource combinations are allowed.

## Local verification

- `npm.cmd run test:company-assignments`: 20 tests, including real HTTP authentication/authorization against mocked Prisma delegates, scoped HR/invoice reads, ownership checks, permission/assignment revocation, department action isolation, role separation and a successful Sales update through the existing company controller.
- Existing tests: 19 admin-employee, nine direct-employer-access and 60 reporting tests pass.
- Backend and frontend production builds pass. Full frontend typechecking still reports existing errors elsewhere; the new feature files have no remaining typecheck errors.

Tests do not prove live SQL Server migration execution, authenticated database CRUD, browser layout or real attendance money settlement. Target-environment acceptance should create two employees in different departments, allocate separate companies under the same employer, verify their allowed actions and forbidden direct API calls, revoke allocations/permissions, and confirm that employer login and the Super Admin's existing access continue to work.
