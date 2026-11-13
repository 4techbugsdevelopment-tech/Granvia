# Granvia Platform — Client Knowledge Transfer and Operations Manual

**Document purpose:** Complete, simple-English handover guide for business owners, administrators, employers, staff, and Associate Partners  
**Prepared from:** Granvia source code and current project documents  
**Source review date:** 12 November 2026  
**Audience:** A reader with no technical background  
**Document status:** Client handover copy. Read the “Important readiness notes” before using the system for live money, statutory compliance, or government verification.

---

## 1. What Granvia does

Granvia connects Employers who need workers with Associate Partners who want work. It keeps the complete journey in one system:

1. An Employer or Associate Partner creates an account.
2. Identity, profile, and documents are completed and reviewed.
3. An Employer creates a company, work site, and job.
4. Granvia checks the job’s wage information and a Super Admin approves the job.
5. Eligible Associate Partners find and apply for the job.
6. The Employer or Operations team reviews, interviews, selects, offers, and onboards a person.
7. The Associate Partner records attendance.
8. The Employer approves attendance and completes payment or payroll.
9. The Associate Partner sees earnings and can request withdrawal.
10. Reports retain the history for the authorised people.

The system has separate work areas for Super Admin, Granvia Admin Employee, Employer, Associate Partner, Sub Admin, Sales Executive, Operations, and Finance. A user sees only the work allowed for that account and role.

---

## 2. How to read this manual

Every function is explained using the same five questions requested for handover:

- **Function / detail:** What the feature is.
- **Accessible by:** Who can open or operate it.
- **How to use it:** The simple steps.
- **Where it is shown / impact:** What screen, data, balance, status, or other user is affected.
- **How it ends:** The clear completion point of that activity.

### Feature readiness labels

| Label | Meaning for the client |
|---|---|
| **Operational** | Connected to the application database and intended for normal use after deployment and user acceptance testing. |
| **Configuration-dependent** | Operational only when the related email, SMS, Aadhaar, e-sign, maps, legal-policy, or storage setting is correctly configured. |
| **Read-only** | Shows information but does not change business records. |
| **Demo / do not rely on** | Displays sample or temporary behaviour. It must not be used as proof of a live business transaction. |
| **Estimate** | A calculated indication, not an accounting or statutory ledger entry. |

### Important readiness notes

1. This manual describes the current source code. The client’s live server, database migrations, provider keys, approved legal rates, email/SMS setup, and uploaded files must be checked separately before go-live acceptance.
2. No government wage or LWF rate should be invented. Only a legally verified, effective-dated rule approved by an authorised person should be activated.
3. A wallet credit or “mock recharge” is not proof that money reached a bank account. Keep bank/gateway evidence outside or linked to the system as required by finance policy.
4. The application records LWF remittance details; it does not send the statutory payment to the government.
5. Employer deletion is an archival access-removal process. Associate job, application, agreement, attendance, payment, and work-history records are retained.
6. Associate deletion from the Super Admin Associate screen is different: the screen warns that it permanently removes the Associate and related records. Use Block for temporary access removal and delete only under an approved data-deletion procedure.

---

## 3. Roles and access summary

| Role | Main responsibility | Normal entry point | Data scope |
|---|---|---|---|
| **Super Admin** | Controls the whole Granvia platform | `/admin` | Platform-wide |
| **Granvia Admin Employee** | Performs only the Super Admin modules assigned in the employee’s role | `/admin` | Assigned modules; Company departments are limited to assigned Employers/companies |
| **Employer** | Manages own companies, sites, jobs, hiring, attendance, payroll, wallet, and reports | `/employer` or Universal App | Own Employer account and companies |
| **Associate Partner** | Completes profile, finds work, applies, attends, receives earnings, and requests withdrawal | `/guard` or Universal App | Own profile and own work records |
| **Sub Admin** | Manages an assigned branch/portfolio, staff, verification work, and branch reports | `/sub-admin` or Universal App | Assigned branch and Employers |
| **Sales Executive** | Manages assigned clients, client-authorised job posting, discounts, and manpower view | `/sales` or Universal App | Assigned client portfolio |
| **Operations** | Processes assigned applications, interviews, selection, and onboarding stages | `/operations` or Universal App | Explicit active assignments |
| **Finance** | Reviews withdrawal requests and records payout completion | `/finance` or Universal App | Withdrawal and payout scope |

**Universal App:** `/universal-app` accepts all supported non-Super-Admin roles and automatically opens the correct workspace. Super Admin must use the secure web Admin portal.

---

## 4. Common account operations

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Sign in | Every active user | Open the correct portal, enter email and password, then enter an emailed login code if two-step login is enabled. | Opens the workspace for the account’s actual role. A blocked, inactive, deleted, or wrong-role account is refused. | The user reaches their dashboard. |
| Universal App sign in | Employer, Associate, Sales, Sub Admin, Operations, Finance | Open Universal App and sign in once. | The app reads the account role and opens only that role’s workspace. | The correct role home screen opens. |
| Employer self-registration | New Employer | Select Register, enter company/contact/location details, verify the mobile number when enabled, set a strong password, submit, and verify the email code when enforced. | Creates an Employer account, Employer profile, and initial company information. Full Employer operations remain dependent on verification. | Account is created and the user can sign in after required verification. |
| Associate self-registration | New Associate Partner through Universal App | Select Associate Partner, enter name, type, mobile, email, location, and strong password; verify mobile and email where enabled. | Creates an Associate account and profile. Job eligibility still depends on completing required profile, documents, Aadhaar, and agreement. | Account is created; onboarding continues inside the Associate app. |
| Internally created account | Super Admin or authorised Employer/Sub Admin | Create the employee, Associate, staff, Operations, Finance, Sales, or Sub Admin account in the relevant management screen. Assign a role and scope. | Gives access only to the assigned role and records. | The new user receives login details and signs in successfully. |
| Forgot password | Any login user | Select **Forgot password**, request the email code, enter the code, and choose a new strong password. | Revokes existing server login tokens and clears the current local session. | User signs in again with the new password. |
| Strong password rule | All accounts | Use at least 6 characters with uppercase, lowercase, number, and special character. | Applied to registration, password reset, Associate creation, Employer staff, and Granvia employees. | Password is accepted and saved. |
| Logout | Every signed-in user | Select **Logout** from the menu. | Removes the local login token; the Android/Universal App uses session-only login storage. | Login screen is shown. |

---

## 5. Super Admin — complete function guide

The Super Admin has platform-wide access. It should be given only to trusted Granvia owners or senior administrators.

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Dashboard | Super Admin; Admin Employee with **Dashboard** permission | Open **Dashboard** and review user, job, site, payment, and status indicators. Use cards to open the related module. | Platform summary, maps, charts, and recent activity. Use the dedicated reports—not dashboard cards—as the complete audit/history source. | Review ends when required exceptions are opened or recorded for follow-up. |
| Add Associate | Super Admin; Admin Employee with **Associate Management** | Open **Manage Associates > Add New Associate**. Enter identity, Associate type, gender, DOB, rates, contact, password, location, skills, language, and status. | Creates the user login and Associate profile. Rates can affect attendance settlement, so use only approved values. | Associate appears in Manage Associates and can sign in. |
| Manage Associate | Same as above | Search; View or Edit profile; change Associate type; Block/Unblock; reset password; review documents; declare Aadhaar; set overall profile status. | Changes account access, verification, eligibility, and what Employers see. | The saved status is visible and the Associate receives the resulting access. |
| Associate document review | Same as above | Open an Associate, review each uploaded file, select Verify or Reject, and record a reason where required. | Updates the document status and the Associate’s onboarding checklist. | Document becomes Verified or Rejected; replacement returns through review. |
| Associate agreement review | Same as above | Open the Associate’s agreement details, view/download the PDF, and review consent, e-sign, version, and production-verification status. Supersede only when a new approved agreement is required. | Retains a versioned onboarding agreement and its audit details. | A production-verified agreement is active, or an older agreement is superseded by a new process. |
| Block Associate | Same as above | Use **Block** when access must stop temporarily without erasing history. | Login is stopped; historical records remain. | Ends when unblocked or moved to an approved permanent-deletion procedure. |
| Delete Associate | Super Admin only in normal governance | Select Delete only after confirming legal/data-retention approval. | Permanently removes the Associate and related application, attendance, verification, and agreement records according to the current delete operation. | Record is deleted and cannot be used for historical work reporting. |
| Manage Employers | Super Admin; Admin Employee with **Employer Management** | Add an Employer when authorised; search, view, edit, approve/reject verification, declare Aadhaar, block/unblock, reset password, upload Employer/company logos, or open the Employer account in a new tab. | Affects Employer login, branding, companies, and ability to operate. Direct access keeps the Super Admin login and records the selected Employer context. | Employer is created and active/verified, rejected with reason, blocked, or archived. |
| Archive/Delete Employer | Super Admin | Select Delete and confirm. The system closes open jobs, inactivates companies/sites, blocks wallet use, and revokes delegated access. | Employer can no longer sign in or operate. Associate applications, agreements, attendance, payments, and work history remain for reporting. | Employer status is deleted/archived and all future access is removed. |
| Manage Jobs | Super Admin; Admin Employee with **Job Management** | Open **Manage Jobs**, inspect the Employer, site, job terms, salary structure, and minimum-wage result. Approve, reject with reason, or delete where authorised. | Pending jobs are not available to Associates. Approval publishes the job; rejection returns it for correction. | Job is Active, Rejected, Closed, or deleted under policy. |
| Minimum-wage approval check | Super Admin with job/minimum-wage responsibility | Review the wage resolution and compliance result before approving a job. Do not approve a missing, ambiguous, stale, or non-compliant result without an authorised exception. | Stores a compliance snapshot on the job and controls publication. | Job has a defensible compliant result or remains blocked for correction. |
| Attendance control | Super Admin; Admin Employee with **Attendance** | Filter by Employer, site, Associate, job, status, and date. Review location/time and Approve or Reject. Review exception requests separately. | Approval can trigger the configured settlement path; rejection prevents payment for that attendance. | Attendance becomes Approved/Verified or Rejected with the next action clear. |
| Hiring workflow | Super Admin; Admin Employee with **Hiring Workflow** | Use the operational application/job screens for real decisions. Do not rely on any legacy sample hiring tiles if sample names are displayed. | Application statuses are visible to Employers, Operations, and Associates according to scope. | Candidate reaches rejected, selected, hired, joined, released, or other final status. |
| Wallet recharge requests | Super Admin; Admin Employee with **Wallet & Payments** | Open **Wallet & Payments**, review a pending Employer request and independent proof of funds, then Complete/Allocate the exact approved amount. | Atomically increases Employer wallet/deposit totals, creates a ledger entry, completes the request, and notifies the Employer. | Request status is Completed and balances/transaction history match. |
| Wallet and payment monitoring | Same as above | Filter by owner, type, status, reference, date, amount, or source. Review Employer balances and transaction rows. | Read-only operational monitoring; mock/admin credits are not bank proof. | Exception is reconciled or escalated with the reference retained. |
| Reports | Super Admin; Admin Employee with **Reports** | Select Master Trackers, Operational, Financial, or Legacy views. Filter, refresh, page, and export CSV. Read warnings before using totals. | Platform-wide read-only reporting. Exports contain all matching rows up to the stated limit. | Report is reviewed/exported; no business record changes. |
| Email Logs | Super Admin; Admin Employee with **Email Logs** | Search and review sent/failed email activity. | Helps investigate registration, OTP, notification, and delivery issues. | Delivery issue is confirmed, retried through the proper process, or escalated. |
| Super Admin Roles | Super Admin only | Add/edit a role, choose any combination of platform modules and Company department permissions, set Active/Inactive, and save. | Controls what Granvia Admin Employees can open. Inactivating a role blocks employees using it. | Role is saved and assigned employees receive the new permissions. |
| Super Admin Employees | Super Admin only | Add/edit employee details, strong password, role, account status, and assigned Employers. Share the login link through WhatsApp if approved. | Creates an `admin_employee` login. Employer assignment limits Company department scope; module permissions stay separately enforced. | Employee signs in and sees only allowed modules. |
| Company Staff Allocation | Super Admin only | Select Employer, Company, department, and an eligible Granvia employee whose role contains that department. Save or remove the assignment. | Grants scoped HR, Sales, Operations, or Accounts workspace access. “All Employers” is only a list filter, not a permission grant. | Active assignment appears and the employee can open that department. |
| Employer Staff Roles | Super Admin | Create shared role definitions and permissions for Employer/Sub Admin staff. Activate/inactivate as needed. | Determines roles available in Employer and Sub Admin team screens. | Role is saved and available for assignment. |
| Associate Type Master | Super Admin; Admin Employee with **Associate Types** | Add/edit a type and description; set Active/Inactive. Avoid deleting a type still used by profiles or jobs. | Active types appear during Associate registration, Admin creation, job requirements, and reports. | Type is available, inactive, or safely removed. |
| City & State Master | Super Admin; Admin Employee with **City & State Master** | Add/edit State and City records and statuses. | Used by addresses, jurisdiction matching, filters, wage/LWF policies, and reporting. | Location is active and selectable, or inactive without damaging history. |
| LWF Master | Super Admin only | Maintain verified State policy versions, contribution amounts, schedule, eligibility, establishment scope, legal reference, and effective dates. Keep unverified entries Draft. Close active versions instead of rewriting history. | Used in salary/payroll LWF resolution and liability records. Legacy STANDARD values are separate compatibility settings, not State law. | A legally verified version is Active for its dates, or Draft/Closed. |
| Minimum Wage Management | Super Admin; Admin Employee with **Minimum Wage Compliance** | Import an official notification and rates for review; approve/reject/revoke it; map Granvia roles/skills; review India coverage, job compliance, and audit history. | Only approved, effective, mapped rules are used for compliance. Nothing becomes active just because it was imported. | Coverage and mapping are approved and compliant jobs can proceed. |
| Admin Settings | Super Admin | View the current Settings screen only. | Current settings controls are demo/non-persistent. They must not be used as proof that a platform setting changed. | No production change is complete until a real persisted setting is implemented and verified. |

### Granvia Admin Employee permission rule

An Admin Employee does not automatically become a Super Admin. Their role can combine permissions, but each permission keeps its own scope:

- Platform modules such as Associates, Jobs, Attendance, or Reports open only when included in the role.
- Company HR/Sales/Operations/Accounts applies only to assigned Employer/company scope.
- Employee management, Super Admin role management, statutory master administration, and other unmapped Super Admin-only pages remain unavailable.
- An inactive employee account or inactive role blocks access.

### Granvia Admin Employee — Company department workspace

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| My Company Departments | Admin Employee with at least one Company permission and an active Employer/company assignment | Open the assigned company and department. HR can process scoped applicants; Sales can review jobs/client information; Operations can maintain permitted site/contact details; Accounts can maintain permitted billing details. | Changes only the selected assigned company. Both the employee’s role permission and assignment must be valid. | Permitted change is saved, or access ends immediately when the assignment/permission is removed. |
| Department assignment visibility | Same user | Review the company and department rows shown. Contact Super Admin if an expected company is missing. | Missing access normally means inactive account/role, missing department permission, missing Employer assignment, inactive company, or removed allocation. | Correct Super Admin assignment appears; no user should bypass the scope. |

---

## 6. Employer — complete function guide

Before Aadhaar verification, the Employer can normally use Dashboard, Profile, Aadhaar, and Team. Other pages redirect to verification until the account is allowed to continue.

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Employer Dashboard | Active Employer | Review company/job/site/application/attendance/payment/wallet cards and recent items. Select a company from the top selector. | All counts are limited to the Employer account and selected company where applicable. | Employer opens the item requiring action. |
| Profile | Employer | Update contact name, mobile, city/state/pincode, and save. Upload verification documents for the active company. | Changes Employer contact/profile and document review queue. | Save confirmation appears; documents move to review. |
| Aadhaar Verification | Employer; Super Admin for manual declaration | Follow the Aadhaar screen if the provider is enabled. If disabled, wait for authorised Admin declaration. | Controls access to most Employer operations. | Status is Verified or Rejected; pending remains restricted. |
| Manage Team | Employer | Add/edit Employer staff and Sub Admin accounts, choose only active Super-Admin-defined roles, set status, and save. | Gives staff access inside the Employer’s authorised scope. | Staff account is active with the correct role, or inactive/removed. |
| Manage Companies | Verified Employer | Add company identity, registration type, GST/PAN where applicable, email, phone, website, State/City, addresses, and pincode. Switch active company, edit, activate/inactivate, or delete safely. | Company is the parent for sites, jobs, documents, reports, and statutory location. | Company is saved and selected; required verification/status rules are satisfied. |
| Company Documents | Verified Employer with selected company | Upload PDF/JPG/PNG documents, edit the document record, or delete and replace it. | Super Admin/Sub Admin review queue and company verification readiness. | Each required document is Verified or replaced after Rejection. |
| Manage Sites | Verified Employer with selected company | Add site name/type, State/City/pincode, contact, mobile, address, map location, shift details, notes, and geofence coordinates. Edit, activate/inactivate, or delete where safe. | Site location is used by jobs, distance search, attendance geofence, reports, and jurisdiction. | Site is Active and ready for a job, or inactive/removed. |
| Post New Job | Verified Employer with company and site | Enter title, Associate type, openings, shift/duty details, experience, qualification, language, instructions, dates, salary/payment frequency, and salary structure. Resolve minimum wage and submit. | Creates a Pending Approval job. The Employer’s deposited wallet balance must meet the configured posting requirement; current UI warns below ₹10,000. | Job reaches Pending Approval; it is not visible to Associates yet. |
| Salary Structure | Employer while creating/editing a job | Choose Daily, Weekly, or Monthly frequency and enter approved earnings/deductions. Review calculated gross/net and LWF/minimum-wage panels. | Saved on the job and later used in attendance or payroll. Client-side figures are rechecked by the server. | Structure saves without validation or compliance error. |
| Manage Jobs | Employer | Search/view job detail; edit allowed jobs; close/delete where permitted; re-initiate a corrected or recurring job. | Changes job content and may return it to approval. Closing stops new applications but retains history. | Job is Active, Filled, Completed, Closed, Rejected, or resubmitted. |
| Hired / Current Associates | Employer | Select a job, review applications and profile/verification details, shortlist/reject/select, request interview, send proposal, review leave request, or release. | Updates the Associate’s application timeline and notifications. The current mobile-number button only shows a paid-feature notice; it does not complete a purchase or reveal workflow. | Associate is hired/joined, rejected/not hired, released, or remains in a clear pending stage. |
| Available Associates | Employer | The current screen can be viewed for layout demonstration only. | **Demo data. Discovery API is not connected to this screen.** Do not contact, hire, or report using these sample rows. | No real business process ends here until the screen is connected to live data. |
| Call / Interview Requests | Employer | Create an interview request with method/date/remarks; update it as scheduled, completed, cancelled, or rejected. | Associate and hiring records show the interview stage. | Interview is completed or cancelled/rejected with remarks. |
| Agreements / Onboarding | Employer | Create/review the job agreement after selection/offer; update the agreement status and keep documents. | Connects the selected Associate to agreed job terms. This is separate from the Associate’s platform onboarding agreement. | Agreement is Signed/Active/Completed or Cancelled. |
| Attendance Verification | Employer | Review submitted attendance and exception requests; verify time/location; Approve or Reject. | Approved Daily attendance can create payment and wallet movement. Monthly/Weekly work must use payroll. | Attendance is Approved/Verified or Rejected; exception is decided. |
| Payments | Employer | For legacy/unclassified payment frequency, create a wallet payment, request the Associate’s emailed OTP, enter it, and confirm. Daily jobs point to attendance settlement; Weekly/Monthly jobs point to Payroll. | On valid OTP, Employer wallet is debited, Associate wallet is credited, and payment becomes Completed. | Payment history shows Completed once and duplicate settlement is prevented. |
| Payroll & LWF | Employer | Create an exact 7-day Weekly period or complete calendar Monthly period. Select it, confirm it is a full period with no proration, preview, complete/finalise the run, review payslips, and pay from Employer wallet. | Creates immutable payroll results, earning/deduction lines, LWF liability, payment record, and Associate payslip. Partial-period proration is blocked. | Run is Completed and each payslip payment is Completed or has an explicit failure/retry state. |
| LWF Liability and Remittance | Employer | Filter the State liability register. When the external government payment is actually made, record amount, reference, challan, and date. | Reduces recorded outstanding liability and retains reconciliation/audit details. Granvia does not send the payment. | Liability is Partially or Fully Remitted and evidence matches the external payment. |
| Wallet | Employer | Review available, deposit, and credit balances. Enter an amount and note to submit a recharge request. Track request status and balance statement. | Submission creates Pending only. Super Admin allocation updates the balance after verification. | Request becomes Completed or is otherwise resolved; ledger and balance match. |
| Invoices / Receipts | Employer | View recorded invoice/receipt rows for the selected company. | Read-only billing evidence; report ageing may show Draft/Sent/Paid/Overdue according to stored records. | Invoice status reaches Paid/Closed or remains in a documented exception state. |
| Reports | Employer | Choose company Operational reports, Financial reports, or Master Trackers. Apply dates/status/site/job/Associate filters and export CSV. | Only own Employer records are returned. Reports do not trigger payment or checkout. | Report is reviewed/exported with warnings understood. |
| Feedback | Employer | Current screen accepts sample feedback interactions only. | **Demo only; no production feedback API persistence.** | No real support case or feedback record is completed here. |
| Support / Help | Employer | Current Employer menu falls back to a simple information page. Use the client-approved external support channel until a connected Employer ticket screen is implemented. | No guaranteed database ticket is created from this Employer page. | Ends when the issue is logged and resolved through the approved support process. |
| LWF Settings | Employer | View applicable State versions. Use the legacy Employer override only for state-less legacy salary records and only under approved policy. | State statutory policy has priority when jurisdiction is known. An Employer override affects only that Employer. | Effective source is shown as State policy, Employer override, Super Admin legacy master, or Not Configured. |

---

## 7. Associate Partner — complete function guide

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Home Dashboard | Signed-in Associate | Review profile readiness, current jobs, nearby jobs, attendance, wallet, and alerts. Open the card requiring action. | Own information only. | Required action is opened or acknowledged. |
| Profile | Associate | Edit personal/contact/address details, Type, skills, languages, qualification, experience, bank details, and location. | Affects job matching, verification, payment destination, and reports. Sensitive classification changes after verification may require review. | Profile saves and readiness checklist updates. |
| Documents | Associate | Open Profile > Documents, select document type, upload the file, and wait for review. Replace a rejected item. | Appears in Admin/Sub Admin verification queue. | Required document becomes Verified. |
| Aadhaar | Associate; authorised Admin fallback | Complete provider OTP verification when enabled. If provider is disabled/unavailable, use the approved manual Admin process. | Affects profile readiness and job eligibility. | Aadhaar status becomes Verified or Rejected with a correction path. |
| Platform Agreement | Associate | Generate the onboarding agreement, give consent, start e-sign if provider is configured, return to the app, and download the final agreement. | Stores version, consent, transaction, signature, and production-verification evidence. Sandbox signed is not the same as production verified. | Agreement becomes production verified/active or remains pending for correction. |
| Job Search | Eligible Associate | Allow location when required; choose radius/filters; open a job card; review salary, shift, location, requirements, and apply. | Only active jobs that match server rules are shown. Application is tied to the job and Associate. | Application is created once, or the system shows the exact eligibility reason. |
| My Applications | Associate | Review application status and hiring proposals. Open details. Accept or decline a sent offer/proposal. Request leave where eligible and view release attachments. | Employer and Operations see the decision; accepted proposal advances hiring. | Application reaches hired/joined, rejected/declined, released, or another clear final stage. |
| Accepted Jobs | Associate | Review accepted/hired assignments and job details. | Used as the work list for attendance and ongoing assignment. | Job is completed, closed, or the Associate is released. |
| Availability | Associate | Add/edit/delete available dates or shifts. | Availability data can support matching and reporting where connected. | Correct future availability is saved. |
| Attendance | Hired/Joined Associate | Select the current job. Use live Check In within the allowed site geofence. Check Out after the shift. If live capture is impossible, submit an exception or allowed historical record with the true reason/time. | Stores date, times, hours, GPS/location name, entry mode, checkout method, and approval status. | Employer/Admin approves or rejects; approved record moves to settlement. |
| Attendance correction | Associate before/under allowed status | Edit an allowed own record or submit a check-in/check-out exception request. | Creates a visible exception and audit trail; does not silently overwrite approved history. | Employer/Admin approves or rejects the request. |
| Wallet | Associate | Review available balance, pending information, transactions, and work-linked details. Enter a valid withdrawal amount after bank details are complete. | Creates a withdrawal request and shows its status/reason. | Finance records Completed payout, or request is Rejected/Failed and corrected. |
| Payslips | Associate | Open Payslips to review finalised Weekly/Monthly payroll result, earning/deduction lines, net pay, and payment status. | Read-only immutable salary snapshot. | Payslip remains as history; payment shows Completed or a clear pending/failure state. |
| Reports & Statements | Associate | Select wallet balances, earnings/statement, withdrawals, or applications/work history; filter and export CSV. | Own records only. | Report is reviewed/exported; no data changes. |
| Notifications | Associate | Open and mark relevant notices as read; use Employer details shown in authorised hiring notifications. | Uses the connected notification service in the current screen. | Notice is read and the user completes the linked action. |
| Help & Support | Associate | Create a ticket with subject/category/message; review Open, In Progress, Resolved, or Closed tickets and FAQs. | Creates a support ticket for the signed-in user. | Ticket becomes Resolved/Closed. |

---

## 8. Sub Admin — complete function guide

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Dashboard | Active Sub Admin | Review active jobs, Associates, clients, staff, area manpower, and commission indication. | Assigned branch/Employer scope only. | Required queue or report is opened. |
| Company Details | Sub Admin | Edit branch name, registration/GST, address, email, and phone. Review client site addresses. | Updates the Sub Admin branch profile. | Saved values appear on the page. |
| Manage Staff | Sub Admin | Add/edit staff; select an active centrally defined role; enter contact and status; remove only when approved. | Staff inherits only modules in the selected master role and branch scope. | Staff is active with the intended role or removed/inactive. |
| Verification Desk | Sub Admin | Open an assigned Associate, inspect each downloadable document, Verify or Reject with reason. | Updates document status in the shared Associate profile. Aadhaar global verification remains an authorised provider/Super Admin responsibility unless policy changes. | All assigned documents have a clear verified/rejected result. |
| Manage Clients | Sub Admin | View Employers/clients assigned to the branch and their site/job counts. | Read-only branch portfolio. | Review ends; ownership changes require authorised assignment outside this page. |
| Manage Associates | Sub Admin | View assigned/deployed Associates, verification, account status, city, and experience. | Read-only scoped workforce list. | Review ends or verification action is opened in the Verification Desk. |
| Attendance | Sub Admin | Review attendance connected to assigned branch and Employers. | Read-only current page; Employer/Super Admin performs the approval action. | Exception is handed to the authorised approver. |
| Reports | Sub Admin | Use connected assigned registration/pipeline reports. The legacy skills/commission page may also be viewed. | Extended reports are scoped. Legacy commission is a calculated 10% estimate, not a posted commission ledger. | Report is exported/reviewed with estimate warning understood. |

---

## 9. Sales Executive — complete function guide

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Sales Dashboard | Active Sales Executive | Review assigned clients, active jobs, conversion rate, discounts, and recent activity. | Assigned Employer portfolio only. | Client/job requiring action is opened. |
| Manage Clients | Sales Executive | Open a client to review companies, sites, jobs, billing status, and rate information. | Read-only/client-scope view except specific Sales actions. | Review ends or a job/discount action starts. |
| Create Job for Client | Sales Executive | Select assigned Employer/company/site, enter job details, request Employer OTP, obtain the Employer’s consent code, and submit. | Job is created for that Employer as Pending Approval; Sales cannot publish it directly. | OTP is valid and job reaches Pending Approval, or request expires/fails without creation. |
| Manage Jobs | Sales Executive | View assigned-client jobs and open the Create Job flow. | Client job list and statuses. | Job is handed to Super Admin approval or remains unchanged. |
| Manage Discounts | Sales Executive | Create percentage/flat discount with label, value, scope, and Employer; edit status or delete if authorised. | Affects recorded client billing discount configuration. | Active/Expired discount is saved or removed. |
| Manpower Map | Sales Executive | Choose radius and review returned Associates and distance list. | The Associate list/count comes from the API around a fixed Mumbai-area centre, but the current map background/pins are a **demo visual skin**, not a navigational map. | Shortlist/research ends; do not use the picture as location proof or as a configurable live search location. |
| Reports | Sales Executive | Review assigned client registrations and hiring pipeline; filter and export. | Assigned portfolio only. | Report is reviewed/exported. |

---

## 10. Operations — complete function guide

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Operations Dashboard/Queue | Active Operations user with active assignments | Review new/all applications, interviews, onboarding counts, and assigned applications. Refresh when needed. | Only applications within active Employer/company/site/job assignments. Removing assignment stops future access but keeps audit history. | Required application is selected. |
| Application status handling | Operations | Choose Under Review, Contacted, Shortlisted, Interview Requested/Completed, Selected, Rejected, Onboarding, Accepted, or Joined. Add remarks; rejection reason is required. | Updates the shared application stage visible to authorised Employer/Associate/Admin users. Concurrent stale updates are refused. | Application reaches Joined/Rejected or is handed to the next owner with a clear stage. |
| Operations Reports | Operations | Open Reports and review assigned recruitment pipeline/ageing; filter/export. | Same authorised assignment scope. | Report is reviewed/exported. |

---

## 11. Finance — complete function guide

| Function / detail | Accessible by | How to use it | Where shown / impact | How it ends |
|---|---|---|---|---|
| Withdrawal Queue | Active Finance user | Review Associate, bank destination, net amount, status, and supporting wallet request. Approve with optional remark or Reject with required reason. | Approved/Rejected result appears in Associate withdrawal history. | Request is Rejected or ready for payout processing. |
| Record Payout | Finance | After independently verifying the real transfer, enter the payment/gateway reference for an Approved/Processing request. | Marks withdrawal Completed and retains the payout reference. It does not itself prove bank settlement without external evidence. | Completed status and external reference match the actual payout. |
| Finance Reports | Finance | Review withdrawal register and ageing; filter/export. | Withdrawal scope only; no new general wallet power is granted. | Report is reviewed/exported. |

---

## 12. End-to-end business processes

### Process A — Employer onboarding

**Accessible by:** New Employer, Super Admin, optional Sub Admin reviewer.  
**How to use:**

1. Employer registers with contact, company, mobile, email, location, and password.
2. Mobile/email verification is completed where enabled.
3. Employer completes Profile and Aadhaar/manual verification.
4. Employer completes company details and uploads required documents.
5. Authorised reviewer verifies documents and Employer/company status.
6. Super Admin approves and activates the Employer.

**Where shown / impact:** Employer Management, company/document status, Employer portal access.  
**How it ends:** Employer and required company are Active/Verified and can create sites/jobs.

### Process B — Associate onboarding

**Accessible by:** Associate, Super Admin/Sub Admin reviewers.  
**How to use:**

1. Associate registers or is created by Admin.
2. Complete personal profile, Type, skills, language, qualification, location, and bank details.
3. Complete Aadhaar through enabled provider or approved Admin fallback.
4. Upload every required document.
5. Reviewer verifies/rejects each document; Associate replaces rejected items.
6. Generate, consent to, and e-sign the platform agreement when configured.
7. Overall profile status is reviewed.

**Where shown / impact:** Associate profile checklist, Admin/Sub Admin queue, Employer candidate details, job eligibility.  
**How it ends:** Profile is Verified/Active with exact evidence; otherwise it stays Pending/Rejected with a stated reason.

### Process C — Company and site setup

**Accessible by:** Verified Employer; Super Admin for review.  
**How to use:** Create company, upload documents, create site, pin accurate map coordinates, set contact and State/City.  
**Where shown / impact:** Employer company selector, job posting, distance search, geofence, wage/LWF jurisdiction, reports.  
**How it ends:** Active company and site are complete and usable.

### Process D — Job creation, wage check, and publication

**Accessible by:** Employer or client-authorised Sales; Super Admin approver.  
**How to use:**

1. Select active company and site.
2. Enter job requirements and salary frequency/structure.
3. Resolve minimum wage for the site/date/role/skill.
4. Submit; status becomes Pending Approval.
5. Super Admin reviews job, wallet condition, wage result, and supporting terms.
6. Approve or reject with reason.

**Where shown / impact:** Employer Jobs, Admin Jobs, Associate Job Search after approval.  
**How it ends:** Active job is visible to eligible Associates, or Rejected job returns for correction.

### Process E — Application to joining

**Accessible by:** Associate, Employer, Operations, Super Admin visibility.  
**How to use:**

1. Associate reviews and applies once.
2. Employer/Operations marks Under Review, Contacted, Shortlisted, or Rejected.
3. Interview is requested and completed.
4. Employer selects the person and sends offer/proposal.
5. Associate accepts or declines.
6. Job agreement/onboarding is completed.
7. Status becomes Hired/Joined.

**Where shown / impact:** My Applications, Hired/Current Associates, Operations queue, reports, notifications.  
**How it ends:** Joined/Hired or a clear Rejected/Declined/Cancelled outcome.

### Process F — Attendance and Daily settlement

**Accessible by:** Joined Associate; Employer/Admin approver.  
**How to use:** Check in at site within geofence, check out after work, review stored hours, then Employer/Admin approves. For a Daily job, approved attendance uses the configured structured daily net or an approved Associate daily rate. Monthly gross is never used as a one-day payment.  
**Where shown / impact:** Attendance history, Employer wallet debit, Associate wallet credit, payment and reports.  
**How it ends:** Attendance is Approved and paid once, or Rejected/corrected without payment.

### Process G — Weekly/Monthly payroll

**Accessible by:** Employer; Associate sees final payslip.  
**How to use:** Create exact full period, preview, confirm no proration, complete payroll, review LWF/wage lines, finalise payslips, and pay.  
**Where shown / impact:** Payroll runs/results/lines, Employer wallet, Associate wallet, payslips, LWF liability.  
**How it ends:** Full-period payroll and payment are Completed. Partial period is blocked until an approved proration rule exists.

### Process H — Employer wallet recharge

**Accessible by:** Employer requests; Super Admin completes.  
**How to use:** Employer submits amount/note. Finance/Admin verifies real funds externally. Super Admin completes the exact request.  
**Where shown / impact:** Employer request history, Admin queue, wallet balances, transaction ledger, notification.  
**How it ends:** Request is Completed exactly once and balances match evidence.

### Process I — Associate withdrawal

**Accessible by:** Associate requests; Finance decides/completes.  
**How to use:** Associate confirms bank data and amount, submits request; Finance reviews wallet and bank destination, approves/rejects, then records real payout reference.  
**Where shown / impact:** Wallet, withdrawal queue, reports, status/rejection reason.  
**How it ends:** Completed payout with reference, or Rejected/Failed request with corrective action.

### Process J — Leave and release

**Accessible by:** Hired Associate requests leave; Employer decides and releases where appropriate.  
**How to use:** Associate submits request/reason. Employer reviews, approves/rejects, records release reason and attachments, and closes/re-initiates job requirement if needed.  
**Where shown / impact:** Application status, Associate history, Employer workforce list, release documents, job capacity.  
**How it ends:** Associate remains assigned, is Released with history retained, or request is rejected with reason.

### Process K — Employer archival

**Accessible by:** Super Admin only.  
**How to use:** Confirm business/legal reason, archive/delete Employer, then verify login, delegated access, jobs, sites, companies, and wallet are disabled.  
**Where shown / impact:** Employer disappears from active lists; Associate historic work remains in reports.  
**How it ends:** No future Employer access; historical evidence retained.

---

## 13. Main status meanings

| Area | Status | Simple meaning / next owner |
|---|---|---|
| Account | Active | User may sign in and use allowed functions. |
| Account | Inactive/Blocked | User cannot operate until authorised reactivation. |
| Account | Deleted | Future access is revoked; Employer history is retained according to archival rules. |
| Verification | Pending/Under Review | Evidence is missing or waiting for reviewer. |
| Verification | Verified | Required reviewer/provider accepted the evidence. |
| Verification | Rejected | Correction/replacement and a reason are required. |
| Job | Draft | Not submitted or incomplete. |
| Job | Pending Approval | Waiting for Super Admin; not visible as an active job. |
| Job | Active | Available to eligible Associates. |
| Job | Filled | Required positions reached; new hiring should stop. |
| Job | Completed/Closed | Work/hiring ended; history remains. |
| Application | Applied/Under Review | Employer/Operations action pending. |
| Application | Shortlisted/Interview | Candidate is progressing. |
| Application | Selected/Offer Sent | Associate decision/onboarding pending. |
| Application | Hired/Joined | Active workforce relationship. |
| Application | Leave Requested | Employer decision pending. |
| Application | Released/Rejected/Not Hired | Process ended; history remains. |
| Attendance | Pending Verification | Employer/Admin must review. |
| Attendance | Approved/Verified | Eligible for configured settlement. |
| Attendance | Rejected | No payment; correction/exception may be required. |
| Payment | Pending/OTP Sent/Processing | Not complete; do not count twice. |
| Payment | Completed | Ledger movement/payout record completed once. |
| Payment | Failed/Rejected | Correct issue or retry through authorised flow. |
| Payroll | Draft/Previewed | Not final and not payable yet. |
| Payroll | Completed/Finalised | Immutable result/payslip created. |
| Recharge | Pending | Request only; wallet not yet allocated. |
| Recharge | Completed | Admin allocation and wallet ledger completed. |
| Withdrawal | Requested | Finance decision pending. |
| Withdrawal | Approved/Processing | Real payout still needs completion/reference. |
| Withdrawal | Completed | Finance recorded payout reference. |
| Support | Open/In Progress | Support team action pending. |
| Support | Resolved/Closed | User issue has an outcome. |

---

## 14. Reports available by role

### Super Admin

- Employer registrations and growth; Employer master/workforce.
- Associate registrations, master, work/earnings history, and daily attendance/settlement history.
- Employer credits; Associate wallet balances/movements; withdrawals.
- Recruitment pipeline and ageing; invoice register and ageing.
- Operational verification, document, job, application, attendance, exception, and audit reports.
- Financial payments, wallet statements, wallets, movements, and settlements.

### Employer

- Associate master, work/earnings history, and daily attendance/settlement history.
- Employees/Sub Admins, companies, sites, jobs, recruitment pipeline, invoices, and credits.
- Company job/hiring, applications, interviews, offers, agreements, attendance, and exceptions.
- Payments, wallet statement, and settlements within own Employer scope.

### Associate

- Own wallet balance, earnings/wallet statement, withdrawals/payouts, applications, and work history.

### Sub Admin, Sales, Operations, and Finance

- Sub Admin: assigned Employer/Associate registrations and recruitment pipeline.
- Sales: assigned client registrations and hiring pipeline.
- Operations: assigned recruitment pipeline and ageing.
- Finance: withdrawal register and ageing.

### Safe report use

1. Confirm the role and scope shown at the top.
2. Choose correct date basis and filters.
3. Read every amber warning.
4. “No records” is different from “report unavailable” or “required database update missing.”
5. CSV export is read-only and may contain personal/financial data. Share it only through the client’s approved secure method.
6. Reports do not prove external bank settlement, government remittance, or legal compliance unless the corresponding evidence and approved policy are present.

---

## 15. Daily, weekly, and monthly operating checklist

### Every day

- Super Admin: check pending Employers/documents/jobs, attendance exceptions, recharge requests, and errors.
- Employer: check new applications, interviews/offers, attendance, payment failures, wallet balance, and active job capacity.
- Operations: clear ageing applications and record every contact/status change.
- Finance: review requested/approved withdrawals and reconcile completed references.
- Associate: check proposals/notifications, attendance status, and wallet history.

### Every week

- Review blocked/inactive users and remove unnecessary delegated assignments.
- Review failed email/SMS/provider activity.
- Compare wallet/recharge/payment reports with external finance evidence.
- Review jobs near end date, unfilled jobs, and long-pending applications.
- Run the exact 7-day payroll process for Weekly jobs.
- Export and securely retain required business reports.

### Every month

- Run full calendar-month payroll; never use an invented partial-period divisor.
- Review LWF liability, external challans, and outstanding amounts.
- Review minimum-wage notification review dates and jurisdiction gaps.
- Confirm backups, restore checks, storage capacity, certificate/domain renewal, and provider account health with the technical owner.
- Review Admin Employee, Employer staff, Sub Admin, Sales, Operations, and Finance access.
- Review data-retention/deletion requests with authorised legal/privacy owners.

---

## 16. Known limitations and “do not rely on” list

| Item | Current condition | Client action |
|---|---|---|
| Employer Available Associates | Demo data screen | Do not use for real hiring until connected to live discovery API. |
| Employer Feedback | Demo/local behaviour | Use approved support channel; do not treat screen submission as a saved case. |
| Employer Support page | Static information fallback | Log issues through the approved external/Associate ticket process until connected. |
| Employer paid mobile-number view | Notice only; no completed purchase/reveal action | Do not promise contact-number access until pricing, debit, consent, audit, and reveal are implemented. |
| Admin Settings | Controls are not persistently saved | Do not use as proof of configuration. |
| Sales map picture/search centre | Demo visual skin over API results; fixed Mumbai-area centre | Use list/count only; not map/location evidence or a user-selected search origin. |
| Sub Admin header | Currently displays a fixed “West Branch” label | Use the loaded Company Details and assigned scope as the authority; correct the header before multi-branch production rollout. |
| Legacy commission analytics | 10% estimate | Do not book as revenue/commission ledger. |
| Mock recharge sources | Recorded wallet credit, not external collection | Require bank/gateway proof. |
| Payment gateway | No complete real gateway collection flow is guaranteed by this handover | Use recharge request + authorised allocation and external proof until gateway acceptance. |
| Aadhaar | Controlled by feature flag/provider; manual fallback exists | Confirm production provider, consent, and compliance before enabling. |
| SMS registration OTP | Provider and flags required; mock provider is forbidden in production | Complete PowerText/approved provider setup and live tests. |
| E-sign | Provider, callback, templates, and production verification required | Sandbox signature must not be accepted as production proof. |
| Minimum wage | Engine requires approved notifications, mappings, and deployed data | Compliance owner must load/approve authoritative rates and review coverage. |
| LWF/payroll | Requires policy/migration/provider data and approved legal rules | Validate on staging and live database before statutory use. |
| Uploaded files | Current backend may use local server storage | Back up/migrate to approved durable storage before scaling. |

---

## 17. Data protection and safe operating rules

1. Never share passwords, OTPs, Aadhaar numbers, bank details, bearer tokens, or database credentials through ordinary chat or spreadsheets.
2. Give every person their own account. Do not share Super Admin login.
3. Use Block/Inactive before delete when history may be needed.
4. Verify the exact Employer/company scope before assigning staff.
5. Downloaded CSV/PDF documents contain personal or financial information; store and send them only through approved secure channels.
6. Keep government notifications, legal references, challans, bank proofs, and payout references for the required retention period.
7. Do not edit historical salary/statutory snapshots to make new rules appear retroactive.
8. Before any production database change, take and test a backup. Never use destructive reset/fresh/seed commands on production.

---

## 18. Non-technical system ownership handover

The client should nominate one named owner for each line:

| Ownership item | What the owner must keep |
|---|---|
| Business/Product owner | Final process rules, role approvals, feature acceptance, escalation decisions |
| Super Admin owner | Master account, user/role review, Employer/job approvals, audit follow-up |
| HR/Operations owner | Verification standards, hiring stages, attendance correction rules |
| Finance owner | Recharge evidence, wallet reconciliation, payroll approval, withdrawals, statutory remittance evidence |
| Compliance/Legal owner | Minimum-wage notifications/mappings, LWF versions, agreement text, retention policy |
| Technical/DevOps owner | Domain, HTTPS, server, database, backups, storage, monitoring, releases, rollback |
| Provider owner | Email, SMS, Aadhaar/SurePass, Google Maps, e-sign, and future payment gateway contracts/keys |
| Support owner | Ticket response times, incident communication, user training, FAQs |

### Technical picture in plain English

- The web screens are a React application.
- The business API is Node.js/Express.
- The database is Microsoft SQL Server through Prisma.
- Uploaded images/documents are handled by backend storage and signed download links where private.
- The Android application is a WebView wrapper around the Universal App web route.
- Production changes normally require a frontend build and a backend build/restart. Database migrations must be reviewed and applied separately.
- Secrets belong on the server/secret manager, never in browser variables or this manual.

### Handover items the client must receive separately

- Production and staging URLs.
- Named Super Admin account transfer procedure (not the password inside this document).
- Domain/DNS and HTTPS certificate ownership.
- Server/cloud, SQL Server, backup, storage, and monitoring ownership.
- Email/SMS/Aadhaar/maps/e-sign/payment-provider account ownership and renewal dates.
- Deployment and rollback procedure with named technical contact.
- Latest tested release/version and database migration list.
- Backup restore evidence and retention schedule.
- Open issue list and signed user-acceptance results for every role.

---

## 19. Client acceptance checklist

The handover is complete only after the client checks each item in staging and then production:

- [ ] One valid account for every required role can sign in and log out.
- [ ] Wrong-role, inactive, blocked, deleted, and unassigned access is refused.
- [ ] Employer and Associate registration/verification work with live email/SMS settings.
- [ ] Employer/company/site/job creation and Super Admin approval work.
- [ ] Approved minimum-wage and LWF data are present for every operating State and date.
- [ ] Associate application, interview, offer, acceptance, agreement, and joining work end to end.
- [ ] Live and exception attendance work on actual mobile devices and site locations.
- [ ] Daily settlement and full Weekly/Monthly payroll are reconciled with test wallets.
- [ ] Recharge request/allocation and withdrawal/payout references are reconciled with external evidence.
- [ ] Reports return only authorised scope and CSV downloads are correct.
- [ ] Employer archival retains Associate history and revokes all Employer/delegated access.
- [ ] Demo-only screens are hidden from production or clearly labelled and excluded from operations.
- [ ] Backups, restore, monitoring, incident contact, and rollback are tested.
- [ ] Client signs the final role-wise user-acceptance record and open-limitations list.

---

## 20. One-page process summary

```text
Employer registers
  -> Admin verifies Employer/company
  -> Employer creates site and job
  -> Wage check passes
  -> Super Admin approves job
  -> Associate finds and applies
  -> Employer/Operations reviews and interviews
  -> Employer sends offer
  -> Associate accepts and completes agreement
  -> Associate joins and records attendance
  -> Employer/Admin approves attendance
  -> Daily settlement OR full Weekly/Monthly payroll
  -> Employer wallet debited / Associate wallet credited
  -> Associate requests withdrawal
  -> Finance approves and records real payout
  -> Reports retain the authorised history
```

**End of client handover manual.**
