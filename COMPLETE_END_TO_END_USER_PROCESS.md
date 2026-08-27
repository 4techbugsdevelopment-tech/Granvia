# Granvia Complete End-to-End User Process

> Superseded for user-flow planning by [ROLE_WISE_COMPLETE_USER_FLOW.md](./ROLE_WISE_COMPLETE_USER_FLOW.md), which organizes the complete journey by role, portal menu, page, action, result, and next-role handoff. This file remains the cross-role business-rule reference.

## 1. Purpose of this document

This document defines the complete Granvia business process in simple, point-to-point language. It starts when a new user enters the platform and continues through Employer onboarding, company and site creation, job posting, Associate verification, job discovery, application, hiring, attendance, payment, wallet settlement, withdrawal, and job closure.

This is the target business process. Development, testing, operations, and user acceptance testing should use this document as the common functional reference.

## 2. Roles

### 2.1 Associate

The Associate is the person who creates a profile, completes verification, searches for work, applies for a job, accepts an offer, signs the required agreement, marks attendance, receives payment, and withdraws earnings.

The internal system role may continue to use `guard` for technical compatibility. All user-facing screens should display **Associate** or **Associate Partner**.

### 2.2 Employer

The Employer creates and manages a company, adds work sites, posts jobs, reviews applications, conducts interviews, selects Associates, issues offers and agreements, verifies attendance, and makes payments.

### 2.3 Super Admin

The Super Admin has platform-wide control. The Super Admin reviews Employer companies, approves or rejects jobs, reviews Associate verification evidence, approves or rejects Associate profiles, manages users, reviews audit history, monitors attendance and payments, and resolves exceptions.

### 2.4 Sub Admin

The Sub Admin works only within an assigned branch, company, location, or operational scope. The Sub Admin can review only those Associates and documents explicitly assigned to that scope.

### 2.5 Sales Executive

The Sales Executive may assist an Employer, create a job on the Employer's behalf, and apply an approved discount. A job created by a Sales Executive must be confirmed by the Employer through OTP or another approved confirmation method before it is submitted for Super Admin approval.

## 3. Important verification definitions

### 3.1 Aadhaar status

Aadhaar status represents only the Aadhaar KYC check. It does not represent the Associate's complete profile verification.

Aadhaar can be marked verified only by:

1. An authorised Aadhaar/OTP verification provider after successful verification; or
2. A Super Admin after reviewing acceptable uploaded Aadhaar evidence while the authorised API is unavailable.

An Employer must never be able to change the Associate's global Aadhaar status.

### 3.2 Overall profile status

Overall profile status represents whether the Associate is ready for hiring and deployment.

The system automatically calculates the overall status from all mandatory checks:

1. Required profile fields are complete.
2. Aadhaar is verified.
3. Required ID proof is verified.
4. Police verification is verified.
5. Required onboarding agreement and consent are completed.

The normal calculated statuses are:

- `pending`: One or more mandatory requirements are missing or under review.
- `verified`: Every mandatory requirement is complete and verified.
- `rejected`: A mandatory item or the complete profile has been rejected and user action is required.
- `blocked`: The account has been administratively blocked and cannot use protected platform functions.

### 3.3 Employer Identity Checked

**Identity Checked** is an Employer action for one specific job application.

It means the Employer checked the Associate's identity during an interview, document sighting, site visit, or joining process for that application.

Identity Checked:

- belongs only to the selected job application;
- stores the Employer user, date, time, remarks, and method of checking;
- does not verify Aadhaar globally;
- does not change any document status;
- does not change the overall profile status; and
- cannot replace platform KYC or Super Admin approval.

## 4. Employer registration and onboarding

### 4.1 Employer opens the application

1. The Employer opens the Granvia application or Employer portal.
2. The Employer selects **Employer Sign Up**.
3. The system displays the Employer registration form.

### 4.2 Employer enters registration details

The Employer enters the required information:

1. Full name.
2. Business email address.
3. Mobile number.
4. Password and password confirmation.
5. Required terms, privacy, and consent acceptance.

Optional or business-configured information may include designation and referral details.

### 4.3 Registration validation

Before creating the account, the system validates:

1. Email format is valid.
2. Mobile number format is valid.
3. Email is not already registered.
4. Mobile number is not already registered where mobile uniqueness is required.
5. Password meets the security rules.
6. Required consent is accepted.

If validation fails, the system keeps the entered information and shows a clear field-level error.

### 4.4 Email/mobile verification

1. The system creates the Employer account in a pending onboarding state.
2. The system sends an email verification link or OTP according to the configured verification method.
3. The Employer completes the verification.
4. The system records the verification result and timestamp.
5. If verification is mandatory for login, the Employer cannot proceed until it succeeds.
6. If verification is temporarily not enforced, the portal must clearly show that verification remains incomplete.

### 4.5 Employer profile setup

After the first login, the Employer completes the Employer profile:

1. Contact person name.
2. Designation.
3. Business contact number.
4. Business address.
5. Billing information.
6. Required Employer KYC information.

The system shows an onboarding checklist until all required items are complete.

## 5. Employer company creation and verification

### 5.1 Employer adds a company

1. The Employer selects **Companies**.
2. The Employer selects **Add Company**.
3. The system displays the company form.
4. The Employer enters company details:
   - Legal company name.
   - Trading name, if applicable.
   - Company type.
   - Registered address.
   - Contact details.
   - GST, CIN, PAN, or other required registration details.
   - Billing address.
5. The Employer uploads the company logo if desired.
6. The Employer uploads all mandatory company documents.
7. The Employer submits the company for verification.

### 5.2 Company status

The company follows this status process:

```text
draft -> pending_verification -> verified
                              -> rejected -> resubmitted
```

1. `draft`: The Employer is still entering information.
2. `pending_verification`: The company has been submitted and is waiting for review.
3. `verified`: The Super Admin has approved the company.
4. `rejected`: The Super Admin rejected the company and provided mandatory remarks.

### 5.3 Company review

1. The Super Admin opens the company verification queue.
2. The Super Admin reviews company details and documents.
3. The Super Admin selects **Approve** or **Reject**.
4. Remarks are mandatory for rejection and should also be recorded for approval when an exception was reviewed.
5. The system records an immutable audit entry.
6. The Employer receives a notification.
7. If rejected, the Employer corrects the information and resubmits the company.

### 5.4 Company business rule

A company must be active and verified before a new site can become operational or a new job can be submitted. If the business allows draft site preparation, the site must remain non-operational until company verification is complete.

## 6. Employer site creation

### 6.1 Employer adds a site

1. The Employer opens the verified company.
2. The Employer selects **Add Site**.
3. The Employer enters:
   - Site name.
   - Complete site address.
   - PIN code.
   - Site contact person.
   - Site contact number.
   - Latitude and longitude using the map/location picker.
   - Operational instructions.
   - Default geofence radius.
4. The Employer saves the site.

### 6.2 Site validation

The system validates:

1. The company belongs to the logged-in Employer.
2. The company is active and verified.
3. The address and contact information are complete.
4. Valid latitude and longitude are present.
5. The geofence radius is within the platform's allowed range.

### 6.3 Site status

The normal site statuses are:

- `draft`: Information is incomplete.
- `active`: The site can be used for job posting.
- `inactive`: The site cannot be used for new jobs.
- `blocked`: The platform has administratively blocked the site.

## 7. Employer job posting

### 7.1 Employer starts a job post

1. The Employer selects **Post Job**.
2. The Employer selects the verified company.
3. The Employer selects an active site belonging to that company.
4. The system displays the job form.

### 7.2 Employer enters job information

The Employer enters all required job details:

1. Job title.
2. Job category or role.
3. Number of Associates required.
4. Job description and responsibilities.
5. Required skills.
6. Required languages.
7. Minimum experience.
8. Minimum qualification, if applicable.
9. Duty date or start and end date.
10. Shift start time and end time.
11. Shift type, such as day or night.
12. Duration, such as 4, 8, or 12 hours.
13. Rate, wage, or payment terms.
14. Whether police verification is mandatory.
15. Whether any additional document or certification is mandatory.
16. Reporting instructions.
17. Application closing date.

### 7.3 Job validation

Before submission, the system validates:

1. Employer account is active.
2. Company is active and verified.
3. Site is active and belongs to the selected company.
4. Site has valid coordinates.
5. Required fields are complete.
6. Required manpower count is greater than zero.
7. Shift timing and dates are valid.
8. Wage values are valid and comply with platform rules.
9. Employer has satisfied any wallet/minimum-funding rule required before publishing.

### 7.4 Job submission and approval

1. The Employer submits the job.
2. The backend always creates it as `pending_approval`; the browser cannot force an active status.
3. The job appears in the Super Admin pending-job queue.
4. The job is not visible to Associates while pending.
5. The Super Admin reviews the Employer, company, site, job details, wage, and requirements.
6. The Super Admin approves or rejects the job.
7. Rejection requires remarks.
8. Every decision is stored in audit history.
9. The Employer receives the decision notification.

The normal job status flow is:

```text
draft -> pending_approval -> active -> filled/completed -> closed
                          -> rejected -> edited -> pending_approval
```

## 8. Associate registration and onboarding

### 8.1 Associate signs up

1. The Associate opens the Granvia application.
2. The Associate selects **Associate Sign Up**.
3. The Associate enters name, mobile number, email where required, password, and consent.
4. The system validates uniqueness and required formats.
5. The system verifies the configured email or mobile OTP.
6. The Associate account is created.

### 8.2 Associate completes the profile

The Associate completes all mandatory profile sections:

1. Full legal name.
2. Date of birth.
3. Gender where lawfully required.
4. Mobile number and email.
5. Current residential address.
6. PIN code.
7. Residential latitude and longitude.
8. Profile photograph.
9. Qualification.
10. Experience.
11. Skills.
12. Languages.
13. Bank details required for withdrawal.
14. Emergency contact where required.
15. Search radius.
16. Availability dates and shifts.

The system calculates profile-field completeness automatically. A missing mandatory field must be shown by name in the onboarding checklist.

### 8.3 Associate completes Aadhaar verification

Normal provider flow:

1. The Associate enters Aadhaar details through the protected Aadhaar verification screen.
2. The backend sends the request to the authorised Aadhaar provider.
3. The authorised provider sends OTP to the Aadhaar-linked mobile number.
4. The Associate enters the OTP.
5. The backend verifies the OTP with the provider.
6. On confirmed provider success, Aadhaar status becomes `verified`.
7. Provider reference, safe response metadata, verification time, and audit details are stored without exposing sensitive Aadhaar data.

API-unavailable fallback:

1. The system reports that automated verification is unavailable.
2. The Associate uploads permitted evidence.
3. Only the Super Admin can review the evidence.
4. The Super Admin approves or rejects it with mandatory remarks.
5. The decision and evidence reference are stored in audit history.

The Employer cannot perform either Aadhaar verification path.

### 8.4 Associate uploads documents

The Associate uploads each required document separately. At minimum this includes:

1. Required ID proof.
2. Police verification evidence.
3. Any job-category-specific certificate.
4. Bank proof where required for settlement.

For every upload:

1. The system validates file type and size.
2. The system stores the document privately.
3. The document status becomes `pending` or `under_review`.
4. The previous verified status no longer satisfies the requirement when a replacement document is uploaded.
5. The overall profile status is recalculated immediately.
6. The document enters the appropriate Admin verification queue.

### 8.5 Document review

1. The authorised Admin opens the document.
2. The Admin confirms the document belongs to the Associate and is readable, valid, and current.
3. The Admin selects **Verify** or **Reject**.
4. Rejection requires remarks.
5. The system records reviewer, timestamp, remarks, old status, new status, and document version.
6. The Associate receives a notification.
7. The overall profile status is recalculated immediately.

If rejected:

1. The profile becomes `rejected` or `pending`, according to the approved status policy.
2. The screen displays the exact rejected item and remarks.
3. The Associate uploads a corrected document.
4. The new document returns to `pending`.
5. The profile remains non-verified until approval.

### 8.6 Associate onboarding agreement and consent

1. When the Associate meets the agreement eligibility requirements, the system generates the current agreement version.
2. The Associate views or downloads the original agreement.
3. The system records document integrity information.
4. The Associate provides the required consent.
5. The Associate starts eSign.
6. The authorised eSign provider completes and verifies signing.
7. The signed agreement is stored privately and locked against alteration.
8. The system records the agreement audit history.

Only a production-verified signed agreement satisfies the mandatory agreement check. A sandbox agreement must never satisfy production profile verification.

### 8.7 Automatic overall profile calculation

After every profile, Aadhaar, document, or agreement change, the system recalculates the overall profile.

Examples displayed to the user and Employer include:

- `Profile pending — Aadhaar verification required`
- `Profile pending — Required profile fields incomplete`
- `Profile pending — ID proof under review`
- `Profile pending — Police verification required`
- `Profile pending — Agreement consent required`
- `Profile rejected — Police document rejected`
- `Profile verified`

If several requirements are incomplete, the Associate sees the complete checklist. Employer lists may show the highest-priority reason and allow a safe summary view.

### 8.8 Super Admin profile decision

The calculated status supports the process, but the Super Admin must also have an explicit profile decision action where the business requires final approval.

1. The Super Admin opens the Associate profile.
2. The screen displays every mandatory check and its evidence.
3. The Super Admin selects **Approve Profile** or **Reject Profile**.
4. Remarks are mandatory for both actions.
5. Approval is allowed only when all mandatory calculated checks pass, unless a formally authorised override policy exists.
6. A rejection records the reason and returns the profile to an action-required state.
7. Every decision is stored in immutable audit history.

## 9. Associate job discovery

### 9.1 Associate sets location and radius

1. The Associate allows location access or selects a residential/search location.
2. The Associate selects a search radius, for example walking distance or 1 km to 15 km and above.
3. The system stores the latest permitted search location and radius.

### 9.2 System finds visible jobs

The system displays a job only when:

1. Job status is `active`.
2. Application closing date has not passed.
3. Vacancies remain available.
4. Company and site are active and verified.
5. Site coordinates are valid.
6. Distance between the Associate and site is within the selected radius.
7. Job visibility rules permit the Associate to see it.

The system calculates distance on trusted coordinates. The map circle and the job list must use the same radius rule.

### 9.3 Associate reviews a job

The job card and details show:

1. Job title and category.
2. Company and site information permitted for display.
3. Approximate distance.
4. Shift date and timing.
5. Duration.
6. Wage/payment information.
7. Number of vacancies.
8. Required skills, languages, experience, and qualification.
9. Required KYC and document conditions.
10. Application closing date.

## 10. Conditions for the Associate to apply

When the Associate selects **Apply**, the backend must check all rules again. The frontend button alone is not a security control.

### 10.1 Account conditions

1. Associate is authenticated.
2. Account is active.
3. Account is not blocked or suspended.

### 10.2 Job conditions

1. Job exists.
2. Job is active.
3. Job has not expired.
4. Job still has an available vacancy.
5. Company and site remain active and verified.

### 10.3 Profile and verification conditions

1. Required profile fields are complete.
2. Aadhaar is verified.
3. Required ID proof is verified.
4. Police verification is verified when required by platform policy or the job.
5. Required onboarding agreement and consent are completed.
6. Overall profile status is `verified` where the job requires a fully verified profile.
7. Any job-specific licence, skill, experience, language, or certificate requirement is satisfied.

### 10.4 Application conditions

1. The Associate has not already applied for the same job.
2. The Associate does not have a conflicting accepted job or shift.
3. The Associate is available for the required dates and shift.
4. The job falls within the allowed location/radius rule if radius is a mandatory eligibility rule.

### 10.5 Failed eligibility response

If any rule fails:

1. The application is not created.
2. The system returns a structured list of failed requirements.
3. The application shows a direct action where possible.

Examples:

- `Complete your required profile fields before applying.`
- `Aadhaar verification is required.`
- `Police verification is still under review.`
- `Your ID proof was rejected. Upload a new document.`
- `You have already applied for this job.`
- `This job is no longer accepting applications.`
- `This shift conflicts with an accepted assignment.`

## 11. Associate submits the application

1. The Associate reviews the job details and conditions.
2. The Associate confirms the application.
3. The backend runs every eligibility check.
4. The backend creates one application with status `applied`.
5. A database uniqueness rule prevents a second application for the same Associate and job.
6. The application stores a snapshot or references the relevant profile and verification state at application time.
7. The Associate sees an application success message.
8. The application appears in **My Applications**.
9. The Employer receives an applicant notification.
10. The application appears in the Employer's applicant list.
11. The platform records the application event in status history.

## 12. Employer reviews the application

### 12.1 Employer sees the applicant

The Employer sees:

1. Associate name and permitted profile information.
2. Skills, languages, qualification, and experience.
3. Overall profile status with the reason.
4. Job-relevant verification badges.
5. Application date and current application status.
6. Previous application status history permitted by policy.

The Employer must see meaningful profile text, not only `Profile: pending`.

Examples:

- `Profile pending — Police verification required`
- `Profile pending — ID proof under review`
- `Profile rejected — Police document rejected`
- `Profile verified`

### 12.2 Employer Identity Checked action

1. The Employer may select **Identity Checked** for this application.
2. The Employer selects the checking method, such as video interview, physical document sighting, or site reporting.
3. The Employer enters mandatory remarks.
4. The system stores the action against the job application.
5. The application audit history records the Employer user and timestamp.
6. No global Aadhaar or profile verification value changes.

### 12.3 Employer application actions

The Employer can perform only approved transitions:

```text
applied -> shortlisted -> selected -> offered -> accepted -> joined
       -> rejected
       -> withdrawn by Associate
```

The exact stored statuses may be consolidated, but all screens must use one authoritative state machine.

For each decision:

1. The backend validates the old and new status.
2. The backend rechecks mandatory KYC before `selected`, `accepted`, and `joined`.
3. The system stores the decision and remarks in status history.
4. The Associate receives a notification.

## 13. Shortlisting and interview

### 13.1 Employer shortlists the Associate

1. The Employer selects **Shortlist**.
2. The application changes from `applied` to `shortlisted`.
3. The Associate receives a shortlist notification.

### 13.2 Employer requests an interview

1. The Employer selects **Request Interview/Call**.
2. The Employer selects interview type: phone, video, or physical.
3. The Employer enters proposed date, time, and instructions.
4. The interview status becomes `requested`.
5. The Associate receives the request.
6. The Associate accepts, requests rescheduling, or declines where supported.
7. The Employer records the interview as `completed`, `cancelled`, or `no_show`.
8. Interview remarks are stored in the application audit history where permitted.

### 13.3 Employer decision after interview

1. If unsuitable, the Employer rejects the application with a reason.
2. If suitable, the Employer selects the Associate.
3. Before selection, the backend rechecks the profile and all job requirements.
4. Selection fails if a mandatory requirement has become pending or rejected.

## 14. Job offer and Associate acceptance

### 14.1 Employer creates the offer

The offer includes:

1. Job and site.
2. Joining date.
3. Shift and duty hours.
4. Wage/rate.
5. Payment frequency.
6. Offer validity date.
7. Job-specific terms.

### 14.2 Offer process

1. Employer sends the offer.
2. Offer status becomes `sent`.
3. Associate receives a notification.
4. Associate opens and reviews the offer.
5. Associate accepts or rejects the offer before expiry.
6. If accepted, offer status becomes `accepted`.
7. If rejected, offer status becomes `rejected` and the Employer is notified.
8. If no action occurs before expiry, offer status becomes `expired`.

The system must prevent acceptance when the job is closed, capacity is full, the Associate is no longer eligible, or the shift conflicts with another accepted assignment.

## 15. Job-specific agreement and joining

### 15.1 Employer prepares the agreement

1. After offer acceptance, the Employer generates or creates the job-specific agreement.
2. The agreement starts as `draft`.
3. Both parties review the terms.
4. Required confirmation/signature is collected.
5. The agreement becomes `confirmed` or `signed` according to the approved agreement method.

### 15.2 Status synchronization

When the offer is accepted and required agreement is confirmed:

1. Application status automatically changes to `accepted` or the approved equivalent.
2. On the joining date, authorised confirmation changes it to `joined`.
3. Job vacancy count is updated transactionally.
4. When required capacity is filled, the job becomes `filled` and stops accepting applications.
5. Employer, Associate, attendance, and payment screens read the same authoritative assignment status.

## 16. Attendance process

### 16.1 Conditions before check-in

The Associate can check in only when:

1. Account is active.
2. Application/assignment is accepted or joined.
3. Current date and time are within the configured attendance window.
4. The assignment belongs to the Associate.
5. No open attendance record already exists for that assignment and shift.
6. Device location permission is available unless an authorised exception process is used.
7. Associate is within the permitted site geofence.

### 16.2 Check-in

1. Associate opens **Attendance**.
2. Associate selects the active assignment.
3. Application captures current GPS coordinates and timestamp.
4. Backend calculates distance from the site.
5. If within the geofence, check-in is created.
6. Attendance status becomes `pending_verification` or `checked_in`.
7. Employer receives a check-in notification.
8. Distance and device/request audit information are stored safely.

If outside the geofence, the system rejects check-in or sends it through an approved exception process requiring a reason and Employer/Admin review.

### 16.3 Check-out

1. Associate opens the active attendance record.
2. Associate selects **Check Out**.
3. Application captures current GPS coordinates and timestamp.
4. Backend validates geofence and shift rules.
5. Backend calculates total worked time.
6. Attendance is submitted to the Employer for approval.

### 16.4 Employer attendance decision

1. Employer reviews check-in, check-out, GPS distance, total hours, and exceptions.
2. Employer approves, rejects, or requests correction.
3. Approval requires a completed check-out and positive valid duration.
4. An exceptional zero/short/long duration requires an authorised override and mandatory remarks.
5. The decision is recorded in attendance audit history.
6. Associate receives the decision notification.

Only approved attendance is payable.

## 17. Payment and settlement

### 17.1 Payable amount calculation

1. The system reads approved attendance.
2. The system calculates payable hours using server-stored shift and attendance data.
3. The system applies the agreed rate.
4. The system applies authorised adjustments, deductions, or overtime rules.
5. The system records platform commission separately.
6. The system displays a payment breakdown to the Employer.

### 17.2 Digital wallet/payment flow

1. Employer must have sufficient cleared wallet balance or an approved payment method.
2. Employer confirms the payment.
3. Backend creates the payment as `pending`; the client cannot create a completed payment.
4. Backend locks or transactionally validates the payable attendance and wallet balance.
5. Backend confirms the attendance has not already been settled.
6. Employer wallet is debited.
7. Platform commission is recorded.
8. Associate wallet is credited.
9. Payment becomes `completed`.
10. All ledger entries and payment status changes commit in one database transaction.
11. Employer and Associate receive payment notifications.

If any step fails, the transaction rolls back and no partial credit or debit remains.

### 17.3 Cash payment with OTP

1. Employer selects **Cash Paid** for an unpaid approved attendance item.
2. Backend creates a pending cash-payment request.
3. System sends a single-use OTP to the Associate through the configured verified channel.
4. Delivery must succeed before the UI reports that the OTP was sent.
5. Associate shares or enters the OTP according to the approved process.
6. Backend validates OTP, expiry, payment, Employer, Associate, and amount.
7. On success, the payment is marked completed and the reconciliation ledger is created.
8. The OTP is consumed and cannot be reused.
9. Repeated settlement for the same payable attendance is rejected.

### 17.4 Payment safeguards

The system must enforce:

1. One settlement per payable attendance item or approved settlement period.
2. Database uniqueness or an idempotency key.
3. No client-supplied completed status.
4. Sufficient Employer funds.
5. Atomic Employer debit and Associate credit.
6. Immutable payment status history.
7. Correct audit classification for OTP delivery.
8. No payment for rejected, incomplete, zero-hour, or already-paid attendance.

## 18. Associate wallet and withdrawal

### 18.1 Wallet credit

1. Completed payments appear in the Associate wallet.
2. The wallet displays available balance, pending balance, and transaction history.
3. Every credit links to the Employer, job, attendance, and payment reference permitted for display.

### 18.2 Holding period

1. If the business uses a 24-hour holding period, new earnings remain pending for 24 hours.
2. After the holding period and any dispute checks, the amount becomes available for withdrawal.

### 18.3 Withdrawal

1. Associate selects **Withdraw**.
2. System checks bank details and withdrawal eligibility.
3. Associate enters the amount.
4. System checks available balance, minimum amount, limits, and fees.
5. Associate confirms the request.
6. Withdrawal status becomes `requested` or `processing`.
7. Payment provider/Admin processes the withdrawal.
8. On success, status becomes `completed` and the wallet is debited.
9. On failure, status becomes `failed` and reserved funds return to available balance.
10. Every transition is audited and notified.

## 19. Job completion and closure

1. The final scheduled shift is completed.
2. All attendance records are approved or resolved.
3. All payable attendance is settled.
4. Open disputes are resolved.
5. Employer marks the assignment completed or the system completes it automatically after the configured rule.
6. Application/assignment status becomes `completed`.
7. When all selected Associates and obligations are complete, job status becomes `completed` or `closed`.
8. No new application, attendance, or payment can be created against a closed job except through an authorised correction process.
9. Employer and Associate may submit feedback.
10. Records remain available according to retention and audit policy.

## 20. Rejection, cancellation, and withdrawal paths

### 20.1 Associate withdraws an application

1. Associate may withdraw before the configured cut-off.
2. Associate selects a reason.
3. Application becomes `withdrawn`.
4. Employer is notified.
5. A withdrawn application cannot be silently reactivated; a new permitted workflow is required.

### 20.2 Employer rejects an application

1. Employer selects **Reject**.
2. Employer selects or enters a reason.
3. Application becomes `rejected`.
4. Associate is notified with an appropriate, non-discriminatory explanation permitted by policy.

### 20.3 Employer cancels a job

1. Employer requests cancellation and enters mandatory remarks.
2. System checks active offers, agreements, assignments, attendance, and payments.
3. If no commitment exists, the job can be cancelled.
4. If commitments exist, Super Admin approval and settlement rules apply.
5. All affected Associates are notified.

### 20.4 Associate cancels after acceptance

1. Associate submits a cancellation request with a reason.
2. Employer and Admin are notified.
3. Applicable notice, replacement, penalty, or dispute rules are applied.
4. Status history records the decision.

## 21. Notifications

The system should notify the relevant user when:

1. Registration or contact verification succeeds or fails.
2. Company is approved or rejected.
3. Job is approved, rejected, filled, cancelled, or closed.
4. Associate document is approved or rejected.
5. Associate profile becomes verified, pending, or rejected.
6. Application is submitted, shortlisted, rejected, withdrawn, or selected.
7. Interview is requested, changed, completed, or cancelled.
8. Offer is sent, accepted, rejected, or expired.
9. Agreement is ready, signed, failed, or superseded.
10. Check-in/check-out is recorded or rejected.
11. Attendance is approved, rejected, or corrected.
12. OTP delivery succeeds or fails.
13. Payment succeeds or fails.
14. Wallet credit becomes withdrawable.
15. Withdrawal succeeds or fails.

Notifications must not expose sensitive Aadhaar data, full document data, OTPs, passwords, or private financial information.

## 22. Audit history

The platform must maintain an audit history for all important actions, including:

1. Actor user and role.
2. Action date and time.
3. Record type and record ID.
4. Previous status and new status.
5. Mandatory remarks where required.
6. Safe request/device/IP information where legally permitted.
7. Evidence/document version reference.
8. Provider transaction/reference where applicable.

Audit history is required for:

- Aadhaar verification and fallback review.
- Document upload, replacement, approval, and rejection.
- Overall profile calculation and Super Admin decision.
- Employer Identity Checked action.
- Company and job approval.
- Application status transitions.
- Offers and agreements.
- Attendance and exceptions.
- Payments, OTP delivery, wallet entries, and withdrawals.

Audit records must not be silently edited or deleted.

## 23. Existing-record backfill

For existing Associates such as Sandesh:

1. Run the same overall-profile calculation used for new Associates.
2. Check required profile fields.
3. Check Aadhaar status from an authorised source or approved Super Admin fallback.
4. Check required ID proof.
5. Check police verification.
6. Check the required onboarding agreement and consent according to the approved legacy policy.
7. If all mandatory checks pass, set the calculated profile status to `verified`.
8. If any check is missing or pending, retain `pending` and store/display the exact missing requirement.
9. If a mandatory check is rejected, use the approved rejected/pending rule and display the rejected requirement.
10. Record the backfill run and result in audit history.

Backfill must never infer Aadhaar verification solely from an Employer action or a generic old profile flag.

## 24. Canonical status summary

### Employer/company

```text
draft -> pending_verification -> verified
                              -> rejected -> resubmitted
```

### Job

```text
draft -> pending_approval -> active -> filled -> completed -> closed
                          -> rejected -> edited -> pending_approval
                          -> cancelled
```

### Document

```text
uploaded -> pending/under_review -> verified
                                 -> rejected -> newly_uploaded -> pending
```

### Overall Associate profile

```text
pending -> verified
pending -> rejected -> corrected -> pending -> verified
verified -> pending/rejected when a mandatory document is replaced, expires, or is rejected
any eligible status -> blocked by authorised administration
```

### Application and assignment

```text
applied -> shortlisted -> selected -> offered -> accepted -> joined -> completed
       -> rejected
       -> withdrawn
```

### Interview

```text
requested -> scheduled -> completed
                       -> cancelled
                       -> no_show
```

### Offer

```text
draft -> sent -> accepted
              -> rejected
              -> expired
              -> withdrawn
```

### Attendance

```text
checked_in/pending_verification -> checked_out -> approved -> paid
                                             -> rejected/correction_required
```

### Payment

```text
pending -> processing -> completed
                      -> failed
                      -> cancelled
                      -> refunded/reversed through authorised process
```

### Withdrawal

```text
requested -> processing -> completed
                        -> failed
                        -> rejected
                        -> cancelled
```

## 25. Non-negotiable system rules

1. Only an authorised provider or Super Admin fallback can verify Aadhaar.
2. Employer Identity Checked is application-specific and cannot change global Aadhaar or profile status.
3. Overall profile status is calculated from mandatory requirements.
4. Every mandatory document change triggers immediate profile recalculation.
5. A newly uploaded or rejected mandatory document removes verified readiness until re-approved.
6. Super Admin profile approval/rejection requires remarks and audit history.
7. Employer sees the reason for a pending or rejected profile.
8. Duplicate applications are rejected by both backend validation and a database constraint.
9. Verification is rechecked before application, selection, acceptance, and joining.
10. Application, offer, agreement, and assignment statuses stay synchronized.
11. Attendance is job-specific, time-valid, and geofence-validated.
12. Only approved, positive-duration attendance is payable.
13. Payment starts as pending and cannot be marked completed by the browser.
14. The same attendance cannot be paid twice.
15. Employer debit, commission, Associate credit, and payment completion are atomic.
16. OTP success is reported only after actual delivery succeeds.
17. Sensitive documents and agreements use protected storage and authenticated access.
18. All approval, rejection, override, payment, and verification actions are audited.

## 26. End-to-end acceptance scenario

A complete successful scenario is:

1. Employer signs up and verifies contact details.
2. Employer completes the Employer profile.
3. Employer creates a company and uploads company documents.
4. Super Admin verifies the company.
5. Employer creates an active site with valid coordinates and geofence.
6. Employer creates and submits a job.
7. Super Admin approves the job.
8. Associate signs up and completes all required profile fields.
9. Associate completes Aadhaar verification through the authorised provider.
10. Associate uploads ID proof and police verification.
11. Authorised Admin verifies the documents.
12. Associate completes the required onboarding agreement and consent.
13. System calculates `Profile verified`.
14. Associate selects a search radius.
15. Active job appears because the site is within the Associate's radius.
16. Associate opens the job and selects **Apply**.
17. Backend validates job, profile, documents, agreement, availability, distance, and duplicate rules.
18. Application is created once as `applied`.
19. Employer reviews the Associate and sees `Profile verified`.
20. Employer may record **Identity Checked** for that application.
21. Employer shortlists the Associate.
22. Employer requests and completes an interview.
23. Employer selects the Associate after eligibility is rechecked.
24. Employer sends a job offer.
25. Associate accepts the offer.
26. Employer and Associate confirm the job-specific agreement.
27. Application/assignment changes to accepted and then joined.
28. Associate arrives within the site geofence and checks in.
29. Associate completes the shift and checks out within the permitted rules.
30. Employer verifies and approves valid attendance.
31. System calculates the payable amount.
32. Employer confirms payment with sufficient funds or completes the approved cash-OTP flow.
33. System prevents duplicate settlement.
34. Employer is debited, commission is recorded, and Associate is credited atomically.
35. Associate sees the wallet credit and transaction history.
36. After the holding period, Associate requests withdrawal.
37. Withdrawal is processed and completed.
38. Final attendance and payments are reconciled.
39. Assignment becomes completed.
40. Job becomes completed or closed when all positions and obligations are finished.
