# Company Employee and Granvia Employee Access Guide

## Purpose

This guide explains how to give a company employee access to one company and how to give a Granvia employee access to several companies.

Both employee types use the same protected company workspace. Their role decides which departments they can open. Their assignment decides which companies they can open.

## Access summary

| Employee type | Login page | Company access | Who creates the account |
|---|---|---|---|
| Employer company employee | `/employer` | One assigned company | Employer from **Manage Team** |
| Granvia employee | `/admin` | One or more explicitly selected companies | Super Admin from **Granvia Employees** |

An employee never receives access because they know or change a company ID in the browser. The server checks the employee account, role, company assignment, Employer status and company status on every request.

## Available Granvia employee modules

Granvia Employee Roles assign each menu independently. A Super Admin can combine any of these modules in one role:

Platform modules:

- **Dashboard**
- **Manage Associates**
- **Manage Employers**
- **Manage Platform Jobs**
- **Attendance**
- **Hiring Workflow**
- **Wallet & Payments**
- **Reports**
- **Email Logs**
- **Granvia Employee Access**
- **Employer Company Roles**
- **Associate Types**
- **City & State Master**
- **LWF Master**
- **Minimum Wage**
- **Settings**

Assigned-company modules:

- **Company Profile**: view and update the selected company's permitted profile fields.
- **Manage Jobs**: create, view, edit, publish, close and delete jobs. Wage-checked jobs archive instead of losing compliance history.
- **Hired / Current Associates**: review applicants, schedule interviews and complete hiring actions.
- **Manage Sites**: create, view, edit, activate, deactivate and delete sites while preserving operational history.
- **Attendance Verification**: review and decide attendance using existing settlement rules.
- **Billing Details**: view and update company GST and billing details.
- **Invoices / Receipts**: view company-linked invoices and their current payment status.

Every platform API is checked against the selected module on the server. A hidden menu or a changed URL does not grant access. **Granvia Employee Access** may delegate role and employee administration, but the delegated employee cannot create, assign, edit or remove access broader than their own role.

“Manage” means the employee can perform the available create, view, update and delete/lifecycle actions for that assigned company. It does not bypass the platform's business-record safeguards: invoices are system-generated, attendance is decided rather than deleted, and statutory or financial history is retained.

Employer wallet balances and employer-wide payment functions require the separate **Wallet & Payments** platform module because they can cover more than one company.

## Part 1: Create company roles

Login role required: **Super Admin**.

1. Sign in at `/admin`.
2. Open **Employer Company Roles**.
3. Select **Add Role**.
4. Enter a clear role name, for example:
   - Company Sales Executive
   - Company HR Executive
   - Company Operations Executive
   - Company Accounts Executive
5. Select any combination of company modules required by this role. Each menu is independent.
6. Set the role to **Active**.
7. Select **Save**.

Only roles containing at least one Company permission can be assigned to a company employee login.

## Part 2: Create an Employer company employee

Login role required: **Employer**.

1. Sign in at `/employer` using the Employer account.
2. Open **Manage Team**.
3. Open the **Staff** tab.
4. Select **Add Staff**.
5. Enter the employee name, email and mobile number.
6. Select an active **Employer Company Role**.
7. Select exactly one company.
8. Enter a strong password, or leave it blank to generate a temporary password.
9. Set Status to **Active**.
10. Select **Save**.
11. Copy the temporary password immediately and share it securely with the employee.

The employee signs in at `/employer`. The system opens **Company Employee Workspace** instead of the Employer owner's full portal.

The company selector is locked because an Employer company employee has only one assigned company. The employee sees only the departments included in the selected role.

## Part 3: Create a Granvia employee with company access

Login role required: **Super Admin**.

### Create the Granvia employee role

1. Sign in at `/admin`.
2. Open **Granvia Employee Roles**.
3. Select **Add Role**.
4. Enter a role name, for example **Granvia Sales Executive**.
5. Select the exact platform and/or assigned-company modules required by the role.
6. You may combine platform and company-work permissions in one role.
7. If any assigned-company module is selected, assign the allowed companies on the employee account.
8. Set the role to **Active** and save it.

### Create the employee and assign companies

1. Open **Granvia Employees**.
2. Select **Add Employee**.
3. Enter name, login email, mobile and password.
4. Select the Granvia role created above.
5. If the role contains assigned-company modules, select every company the employee may manage. Platform-only roles do not need a company assignment.
6. Set the account to **Active**.
7. Select **Save Employee**.
8. Share the `/admin` login details securely.

The selected company list is explicit. Adding a new company later does not automatically grant it to the Granvia employee.

## Part 4: Work as a Granvia employee

1. Sign in at `/admin`.
2. For assigned-company work, use the single **Working Company** selector in the top header.
3. Select the required assigned company.
4. Use only the company menu links individually selected on the Granvia Employee Role.
5. Complete the required work.
6. Select another assigned company when required.

Platform-wide functions appear only when their exact platform module is enabled on the employee role.

The selected company is remembered only for the current browser session. If access to that company is removed, the system automatically selects another allowed company or shows that no company is available.

Always check the company name and selected department before saving a change.

## Part 5: Change or revoke access

### Employer company employee

1. Employer signs in at `/employer`.
2. Open **Manage Team** and edit the staff member.
3. Change the role, assigned company or Status.
4. Setting Status to **Inactive** immediately revokes active login sessions.
5. Selecting **Remove** archives the staff access and revokes login. The staff record is retained for history.

### Granvia employee

1. Super Admin signs in at `/admin`.
2. Open **Granvia Employees** and edit the employee.
3. Add or remove companies, change the role or change account status.
4. Saving the company list replaces the previous company assignments.
5. Removing a Company permission from the role revokes that department on the next request.
6. Setting the employee or role to Inactive blocks access.

## Access rules and safety

- Role permission and company assignment are both required.
- An inactive employee, inactive role, inactive Employer or inactive company blocks access.
- Company employees cannot switch to another company.
- Granvia employees can switch only among explicitly assigned companies.
- Direct API requests to an unassigned company are rejected.
- Department actions retain the real employee identity.
- Delegated changes are recorded in the company access audit log with actor, company, department, record and result.
- The separate `/sales` portal is the legacy Granvia client-sales CRM. It is not the Employer company employee workspace and should not be used for these new accounts.

## Troubleshooting

### No company appears

Check that:

1. The employee account is Active.
2. The assigned role is Active.
3. The role contains at least one assigned-company module.
4. The company is Active.
5. The Employer account is Active.
6. The company is selected in the employee assignment.

### A department does not appear

Edit the employee's role and enable the matching Company permission. Signing out and signing in again refreshes the visible menu immediately.

### Login says the role is unavailable

The employee, role, Employer or company may have been made inactive, or a legacy staff record may not yet have been activated as a login. Ask the Employer or Super Admin to review the assignment.

### The wrong company was selected

Do not save the change. Use **Working Company** to select the correct company and confirm the company name above the department workspace.

## Deployment checklist for the system administrator

Before sharing this guide with users:

1. Apply migration `20261113120000_company_employee_access` through the reviewed production migration process.
2. Rebuild the Node backend so Prisma Client includes the new staff and audit fields.
3. Restart every backend worker or application instance.
4. Publish the new frontend build.
5. Create one test Employer company employee and one Granvia employee.
6. Confirm allowed access for an assigned company.
7. Confirm an unassigned company returns Forbidden.
8. Confirm changing status to Inactive revokes the existing session.
9. Confirm a delegated write creates a `delegated_company_audits` record.

Do not run a general production migration deployment until existing Prisma migration-ledger drift has been reviewed.
