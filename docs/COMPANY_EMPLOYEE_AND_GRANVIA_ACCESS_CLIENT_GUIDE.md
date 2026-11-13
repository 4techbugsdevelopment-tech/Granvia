# Company Employee and Granvia Employee Access Guide

## Purpose

This guide explains how to give a company employee access to one company and how to give a Granvia employee access to several companies.

Both employee types use the same protected company workspace. Their role decides which departments they can open. Their assignment decides which companies they can open.

## Access summary

| Employee type | Login page | Company access | Who creates the account |
|---|---|---|---|
| Employer company employee | `/employer` | One assigned company | Employer from **Manage Team** |
| Granvia employee | `/admin` | One or more explicitly selected companies | Super Admin from **Super Admin Employees** |

An employee never receives access because they know or change a company ID in the browser. The server checks the employee account, role, company assignment, Employer status and company status on every request.

## Available company departments

### Company HR

- View the selected company's jobs.
- View applicants for those jobs.
- Shortlist or reject an applicant.
- Send a hire proposal using the existing hiring rules.

### Company Sales

- View the selected company's contact information.
- Update company email, phone, website and description.

### Company Operations

- View company sites.
- Update site contact person, contact mobile and notes.
- View company attendance.
- Approve or reject attendance using the existing attendance and settlement rules.

### Company Accounts

- View company GST and billing details.
- Update the company billing address.
- View company-linked invoices and their current payment status.

Employer wallet balances and employer-wide payment functions are not included in a company department role because they can cover more than one company.

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
5. Select one or more Company permissions:
   - Company HR
   - Company Sales
   - Company Operations
   - Company Accounts
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

### Create the Granvia role

1. Sign in at `/admin`.
2. Open **Super Admin Roles**.
3. Select **Add Role**.
4. Enter a role name, for example **Granvia Sales Executive**.
5. Select the required Company permission, for example **Company Sales**.
6. You may combine several Company permissions in one role.
7. Add platform permissions only when the employee genuinely needs platform-wide access. Platform permissions are not limited to assigned companies.
8. Set the role to **Active** and save it.

### Create the employee and assign companies

1. Open **Super Admin Employees**.
2. Select **Add Employee**.
3. Enter name, login email, mobile and password.
4. Select the Granvia role created above.
5. In **Assign companies**, select every company the employee may manage.
6. Set the account to **Active**.
7. Select **Save Employee**.
8. Share the `/admin` login details securely.

The selected company list is explicit. Adding a new company later does not automatically grant it to the Granvia employee.

## Part 4: Switch companies as a Granvia employee

1. Sign in at `/admin`.
2. Open **My Company Departments**.
3. Use the **Working Company** selector in the top header or on the workspace page.
4. Select the required company.
5. Select one of the **Allowed Departments** shown below the selector.
6. Complete the required work.
7. Select another company when required.

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
2. Open **Super Admin Employees** and edit the employee.
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
3. The role contains at least one Company permission.
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
