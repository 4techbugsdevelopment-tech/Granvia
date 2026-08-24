# Granvia Complete Cycle Test Result — 24 August 2026

## 1. Test objective

Execute the existing Granvia workflow without changing application code:

1. Authenticate Super Admin, Employer, Associate Partner, and Sub Admin.
2. Create an employer company and site.
3. Post and approve a job.
4. Upload and verify Associate Partner documents.
5. Apply, shortlist, interview, select, offer, and create an agreement.
6. Check in/out and approve attendance.
7. Process an OTP-confirmed cash payment.
8. Verify the Associate Partner wallet and payment history.

## 2. Test scope and method

- Test date: 24 August 2026
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000/api`
- Database: configured SQL Server database used by the local backend
- Roles tested: Super Admin, Employer, Associate Partner, Sub Admin
- Test type: live end-to-end API workflow against the running application
- Source-code changes: none
- Workspace files created by this test: only this report

The frontend and backend both started successfully. The environment did not provide an interactive browser instance, so UI clicking and visual/responsive checks could not be executed. All business-flow steps below were executed against the same live APIs used by the UI. UI-only observations are listed separately under test limitations.

## 3. Accounts used

| Role | Account | Login result |
|---|---|---|
| Super Admin | `admin@granvia.test` | Passed — HTTP 200 |
| Employer | `employer@granvia.test` | Passed — HTTP 200 |
| Associate Partner | `guard@granvia.test` | Passed — HTTP 200 |
| Sub Admin | `subadmin@granvia.test` | Passed — HTTP 200 |

Initial prerequisite observations:

- Employer Aadhaar was already verified.
- Associate Aadhaar was already verified.
- Associate police verification was pending before the test upload/review.
- The demo Sub Admin had zero assigned clients and zero assigned Associate Partners.

## 4. Test records created

| Record | ID / identifying value |
|---|---|
| Company | `7d80662c-93c2-4260-85b0-f8518731cc5b` |
| Site | `1ff0d130-2d48-4b86-8e1e-37da9c23ee9c` |
| Job | `1265fdd7-9edb-4efc-b6f7-4c917cec698e` |
| Primary application | `7c635572-cd0b-4af6-adb1-079a50d9c1de` |
| Police-verification document | `053cd87b-9735-4d81-b146-b9bc5997ba04` |
| Attendance | `9363639f-4662-4b57-ba32-dc18e80642ce` |
| First OTP payment | created and completed for ₹1,000 |
| Duplicate OTP payment | `15a6df9b-055b-4207-96d0-14724a12b30f` |
| Direct-completed payment | `7348452d-b848-421a-a1b4-88011197bcf4` |

These records remain in the test database so the results can be inspected from the portals.

## 5. End-to-end execution result

### Step 1 — Role authentication

Result: **Passed**

All four roles authenticated with their correct role restrictions. Tokens were issued and role-specific profile endpoints were accessible.

### Step 2 — Employer company creation

Result: **Passed with issue**

- Company creation returned HTTP 201.
- New company status was `active`.
- Company verification status was `pending`.

Issue observed: a company whose verification status was still `pending` was allowed to create an active site and submit a job. See Finding F-06.

### Step 3 — Site creation

Result: **Passed**

- Site creation returned HTTP 201.
- Address, contact number, latitude, and longitude were stored.
- Site status was `active`.

### Step 4 — Job posting before approval

Result: **Passed**

- Employer job creation returned HTTP 201.
- The submitted client-side status was ignored and the backend correctly forced `pending_approval`.
- The pending job did not appear in the public active-jobs response.
- An attempt by the Associate Partner to apply before approval returned HTTP 422 with: `This job is not currently accepting applications.`

### Step 5 — Super Admin job approval

Result: **Passed**

- Job appeared in the Super Admin pending queue.
- Approval returned HTTP 200.
- Status changed from `pending_approval` to `active`.
- The job then appeared in the public active-jobs response.

### Step 6 — Associate application

Result: **Failed negative control**

- First application returned HTTP 201 and status `applied`.
- The application appeared in both Associate and Employer application lists.
- A second application by the same Associate Partner for the same job also returned HTTP 201.

Expected: the second request should be rejected as a duplicate.

See Finding F-01.

### Step 7 — Document upload

Result: **Passed**

- A PNG police-verification document was uploaded through the multipart endpoint.
- Upload returned HTTP 201.
- Initial document status was `pending`.
- The document appeared in the Associate Partner document list.

### Step 8 — Sub Admin document scope

Result: **Passed for authorization; blocked for normal branch workflow**

- The demo Sub Admin verification queue contained zero Associate Partners.
- Direct review of the test Associate Partner document returned HTTP 403 with: `This associate is not in your branch.`
- This confirms server-side branch scope protection is working.

Operational issue: there is no complete user-facing flow for assigning existing employers/associates to this demo Sub Admin, preventing a normal Sub Admin verification cycle. See Finding F-09.

### Step 9 — Super Admin document verification

Result: **Passed**

- Super Admin could list the Associate Partner documents.
- Document approval returned HTTP 200.
- Document status changed to `verified`.
- Associate police-verification profile status also changed to `verified`.

### Step 10 — KYC application gate

Result: **Failed**

The Associate Partner successfully applied while police verification was still pending and before the test document was approved.

Expected: when a job requires police verification, application or final selection should be blocked until the required verification is complete.

See Finding F-05.

### Step 11 — Employer hiring workflow

Result: **Passed with synchronization issue**

Successful transitions/actions:

- Application: `applied` → `shortlisted`
- Interview: created as `requested` → updated to `completed`
- Application: `shortlisted` → `selected`
- Offer: created as `sent` → updated to `accepted`
- Agreement: created as `draft` → updated to `confirmed`

Issue observed: after the offer was accepted and the agreement confirmed, the Associate application still remained `selected`. The related records do not automatically synchronize to `accepted` or `joined`. See Finding F-08.

### Step 12 — Associate check-in

Result: **Passed**

- Check-in returned HTTP 201.
- Status was `pending_verification`.
- Check-in coordinates were stored.
- The selected application was correctly accepted as an active assignment.

### Step 13 — Associate check-out and location validation

Result: **Failed geofence control**

- Check-out returned HTTP 200.
- A deliberately distant coordinate (`19.0760, 72.8777`) was accepted for a site at approximately (`18.9256, 72.8242`).
- The two points are roughly 17 km apart.
- No geofence warning or rejection was returned.

See Finding F-04.

### Step 14 — Employer attendance approval

Result: **Passed with validation issue**

- Attendance appeared in the Employer attendance list.
- Employer approval changed status to `approved`.
- The same record appeared in the Super Admin attendance overview.
- Because check-out followed almost immediately, total hours were `0`, but approval was still accepted.

See Finding F-07.

### Step 15 — Production-configured OTP request

Result: **Failed**

- OTP request returned HTTP 200 and reported the destination as `guard@granvia.test`.
- No development OTP was returned because SMTP was configured.
- SMTP rejected the reserved `.test` recipient with error `501 5.1.4 Recipient address reserved by RFC 2606`.
- The API still reported success, leaving the employer unable to complete the payment through the normal flow.

See Findings F-10 and F-11.

### Step 16 — OTP validation in isolated test mode

Result: **Passed**

To complete the test without changing code or environment files, a second backend process was started with SMTP values disabled only for that process.

- OTP request returned a development OTP.
- A wrong OTP (`000000`) returned HTTP 422: `Invalid verification code.`
- Correct OTP confirmation returned HTTP 200.
- Payment status changed to `completed`.
- Reusing the consumed OTP returned HTTP 422: `No verification code found. Please request a new one.`

### Step 17 — Wallet credit and payment history

Result: **Passed with critical reconciliation issue**

- The ₹1,000 payment appeared as `completed` in Employer payment history.
- Associate Partner wallet increased from ₹0/0 coins to ₹1,000/1,000 coins.
- The wallet transaction linked the payment to one approved attendance shift.
- The work summary showed one shift and zero total hours.
- Employer wallet balance remained ₹0 before and after payment.

Expected: payment must not complete when the Employer has insufficient balance, or a corresponding employer debit/funding ledger must exist.

See Finding F-03.

### Step 18 — Duplicate payment protection

Result: **Failed — critical**

- A second payment was created for the same application/job/associate.
- A second OTP was confirmed successfully.
- The Associate wallet increased from ₹1,000 to ₹2,000.

Expected: the same payable work item must not be settled twice.

See Finding F-02.

### Step 19 — OTP/payment-status bypass

Result: **Failed — critical**

- A new payment was created directly with `payment_status: completed`.
- The API accepted it with HTTP 201 without requesting or confirming an OTP.
- The Associate wallet immediately increased by another ₹111, reaching ₹2,111.
- Employer wallet remained ₹0.

Expected: payment creation must always be server-controlled as `pending`; only the OTP confirmation/settlement service may mark it `completed`.

See Finding F-12.

## 6. Findings and recommended solutions

### F-01 — Duplicate job applications are accepted

- Severity: High
- Step: Associate application
- Evidence: two POST requests for the same job and Associate Partner both returned HTTP 201.
- Impact: duplicate rows, inflated applicant counts, duplicate selection/payment opportunities.
- Possible solution:
  - Add a database unique constraint on `(job_id, guard_user_id)`.
  - Check for an existing application before insert.
  - Return HTTP 409 or 422 with `You have already applied for this job.`
  - Disable Apply based on server state, while keeping the database constraint as the final protection.

### F-02 — The same application can be paid repeatedly

- Severity: Critical
- Step: Payment settlement
- Evidence: two OTP-confirmed payments for the same application increased the wallet from ₹0 to ₹2,000.
- Impact: direct financial loss and incorrect Associate Partner balances.
- Possible solution:
  - Add a unique settlement key/constraint such as `(application_id, attendance_period)` or one payout per approved attendance record.
  - Use an idempotency key on payment creation and confirmation.
  - Before creating/confirming, reject an already completed settlement.
  - Perform duplicate check, employer debit, payment completion, and associate credit in one database transaction.

### F-03 — Payment succeeds with zero Employer wallet balance

- Severity: Critical
- Step: Payment confirmation
- Evidence: Employer balance was ₹0 before and after completed payments; Associate wallet was credited.
- Impact: unfunded payouts and no auditable double-entry reconciliation.
- Possible solution:
  - Require sufficient available Employer balance before confirmation.
  - Lock the wallet row during settlement.
  - Atomically debit Employer wallet, credit Associate ledger, record platform commission, and complete payment.
  - Reject payment with HTTP 422 when funds are insufficient.

### F-04 — Attendance geofence is not enforced

- Severity: High
- Step: Check-out
- Evidence: a checkout roughly 17 km from the site was accepted.
- Impact: attendance can be marked from any location.
- Possible solution:
  - Store a configurable site geofence radius.
  - Calculate server-side distance using site and submitted coordinates.
  - Reject or flag outside-geofence check-in/check-out.
  - Store calculated distance and override reason for audit.

### F-05 — Required KYC/police verification does not gate application

- Severity: High
- Step: Associate application
- Evidence: application succeeded before the police document was approved, even though the job required police verification.
- Impact: unverified associates enter the hiring pipeline and may be selected.
- Possible solution:
  - Validate required document and Aadhaar statuses in the application endpoint.
  - Return a structured list of missing requirements.
  - Recheck verification again before `selected`, `accepted`, or `joined` transitions.

### F-06 — Pending company can create an active site and submit a job

- Severity: High
- Step: Company/site/job setup
- Evidence: company verification remained `pending`, but active site creation and job submission succeeded.
- Impact: unverified organizations can enter the marketplace workflow.
- Possible solution:
  - Require verified, active Employer and Company records in site/job create endpoints.
  - Recheck company status during Super Admin job approval.
  - Return HTTP 403/422 with a clear verification requirement.

### F-07 — Zero-hour attendance can be approved

- Severity: Medium
- Step: Employer attendance approval
- Evidence: an attendance record with `total_hours: 0` was approved.
- Impact: invalid work records can be used as payment evidence.
- Possible solution:
  - Require check-out and positive duration before approval.
  - Define minimum/maximum shift duration thresholds.
  - Require an override reason for exceptional attendance.
  - Calculate payable hours server-side rather than trusting status alone.

### F-08 — Hiring records do not synchronize statuses

- Severity: Medium
- Step: Offer/agreement completion
- Evidence: offer became `accepted` and agreement became `confirmed`, but application remained `selected`.
- Impact: dashboards and attendance eligibility can disagree about the actual hiring stage.
- Possible solution:
  - Define one authoritative hiring state machine.
  - Update application status transactionally when offer/agreement milestones occur.
  - Restrict arbitrary status strings to approved transitions.

### F-09 — Sub Admin assignment workflow is incomplete

- Severity: Medium
- Step: Branch document verification
- Evidence: demo Sub Admin had zero clients and associates; foreign document review correctly returned HTTP 403, but no complete portal flow was available to assign existing records.
- Impact: Sub Admin verification cannot be operationally tested or used until scope is populated outside the current portal.
- Possible solution:
  - Add Super Admin/Employer assignment screens for clients and Associate Partners.
  - Show current branch ownership and reassignment history.
  - Seed a properly scoped Sub Admin test fixture.

### F-10 — OTP endpoint reports success even when email delivery fails

- Severity: High
- Step: Cash-payment OTP request
- Evidence: request returned HTTP 200, while SMTP logged recipient rejection.
- Impact: employer sees a successful OTP message but the Associate Partner never receives a code.
- Possible solution:
  - Return the delivery result from the mail service.
  - Do not report `sent` when SMTP rejects the message.
  - Return HTTP 502/503 with a retryable error, or support another verified channel.
  - Invalidate the OTP row if delivery fails.

### F-11 — OTP email audit records are classified as `unknown`

- Severity: Medium
- Step: Email delivery audit
- Evidence: seven logs for the test recipient were found only through free-text search; five errors and two skipped sends all had `kind: unknown`. Filtering by `cash_payment_otp` returned zero rows.
- Impact: Admin cannot reliably filter or report cash-payment OTP failures.
- Possible solution:
  - Pass audit context in the correct mail-service argument position when CC is absent.
  - Alternatively, make `sendMail` accept a single options object to remove ambiguous positional parameters.
  - Add a test asserting `kind = cash_payment_otp` for cash-payment emails.

### F-12 — Client can create an already-completed payment and bypass OTP

- Severity: Critical
- Step: Payment creation
- Evidence: POST payment with `payment_status: completed` returned HTTP 201 and immediately credited ₹111 without OTP.
- Impact: any authenticated Employer can manufacture completed payouts and Associate wallet credits.
- Possible solution:
  - Remove `payment_status` and `payment_date` from the Employer create-payment request schema.
  - Always set server-side status to `pending`.
  - Permit `completed` only inside the verified OTP/settlement service.
  - Add an immutable payment-status transition log and authorization tests.

## 7. Severity summary

| Severity | Count | Findings |
|---|---:|---|
| Critical | 3 | F-02, F-03, F-12 |
| High | 5 | F-01, F-04, F-05, F-06, F-10 |
| Medium | 4 | F-07, F-08, F-09, F-11 |

Note: F-02, F-03, and F-12 are separate financial controls but combine into one critical settlement risk: an Employer can create unfunded, duplicate, OTP-bypassed wallet credits.

## 8. Passed controls

- Role-specific authentication succeeded.
- Pending jobs were hidden from public job search.
- Applying to a pending job was rejected.
- Super Admin job approval correctly published the job.
- Document upload and Super Admin verification worked.
- Police status synchronized with police-document approval.
- Sub Admin branch authorization prevented cross-branch document review.
- Interview, offer, and agreement records were created and updated.
- Attendance required an assigned/selected job.
- GPS coordinates and timestamps were stored.
- Employer attendance approval and Super Admin overview worked.
- Wrong OTP was rejected.
- Correct OTP was single-use.
- Completed payment appeared in Employer history and Associate wallet transactions.
- Associate wallet maintained the configured 1 coin = ₹1 relationship.

## 9. UI and coverage limitations

The automated interactive browser was unavailable in the test environment. Therefore, the following require a separate manual/browser run:

- Visual portal navigation and responsive/mobile layout
- Button enable/disable states and success/error dialogs
- Map rendering, marker display, and radius-slider behavior
- Browser geolocation permission prompts
- File preview/download interaction
- Email inbox receipt using a real deliverable test address
- Associate-facing agreement/eSign visual workflow
- Company-document approval UI, because a dedicated review operation was not exposed in the tested flow
- Withdrawal UI, which is currently described in the application as a demo operation

## 10. Recommended fix order

1. Block client-supplied `completed` payment status (F-12).
2. Add payment idempotency and duplicate-settlement protection (F-02).
3. Implement atomic Employer debit and Associate credit with balance enforcement (F-03).
4. Fix OTP delivery failure handling and audit classification (F-10, F-11).
5. Add application uniqueness and KYC gates (F-01, F-05).
6. Enforce attendance geofence and positive payable hours (F-04, F-07).
7. Gate pending companies and synchronize hiring statuses (F-06, F-08).
8. Complete Sub Admin assignment workflow (F-09).

## 11. Overall conclusion

The operational flow from Employer setup through job approval, Associate application, document verification, hiring, attendance, payment history, and wallet display is connected and executable. However, the current payment implementation is not safe for production because completed payments can be created without OTP, the same work can be paid multiple times, and no Employer funds are debited. These critical settlement controls should be fixed before live financial use.
