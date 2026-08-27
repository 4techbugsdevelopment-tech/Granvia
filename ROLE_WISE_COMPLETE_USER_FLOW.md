# Granvia Complete Role-Wise User Flow

> For the requested chronological, multi-character storytelling version, use [COMPLETE_CROSS_ROLE_STORY_FLOW.md](./COMPLETE_CROSS_ROLE_STORY_FLOW.md). This file remains the per-role operating manual.

## 1. How to read this document

This document explains the complete Granvia process separately for each role. Every role section explains:

1. Where the user enters the application.
2. Which menu or page the user opens.
3. What the user sees on that page.
4. Which button the user selects.
5. What information the user enters.
6. What the system validates.
7. What happens after submission.
8. Which role receives the work next.

User-facing terminology must use **Associate** or **Associate Partner**. The internal role and older source files may continue to use `guard` for technical compatibility.

---

# ROLE 1 — EMPLOYER COMPLETE FLOW

## 2. Employer entry and signup

### 2.1 Employer opens the application

1. Employer opens the Granvia application.
2. Employer selects **Employer** from the role selection screen.
3. System opens the Employer Login page.
4. A new Employer selects **Create Employer Account**.
5. System opens the Employer Signup page.

### 2.2 Employer completes signup

On the Employer Signup page, Employer enters:

1. Full name.
2. Business email address.
3. Mobile number.
4. Password.
5. Confirm password.
6. Required terms and privacy consent.

Employer selects **Create Account**.

System checks:

1. All required information is entered.
2. Email format is correct.
3. Mobile number format is correct.
4. Email is not already registered.
5. Mobile number is not already registered where uniqueness is required.
6. Password meets security requirements.
7. Required consent is accepted.

If any check fails, Employer stays on the Signup page and sees the exact error beside the relevant field.

If all checks pass:

1. System creates the Employer account.
2. System sends the configured email verification link or OTP.
3. Employer sees the Verify Contact page.
4. Employer verifies the email or mobile number.
5. System records the verification date and time.
6. Employer is taken to Employer Login or signed in according to the approved login policy.

### 2.3 Employer logs in

1. Employer opens the Employer Login page.
2. Employer enters email/mobile and password.
3. Employer selects **Login**.
4. System confirms the account belongs to the Employer role.
5. System confirms the account is active and not blocked.
6. System opens the Employer Dashboard.

If the account is blocked, inactive, or belongs to another role, access is rejected with a clear message.

## 3. Employer dashboard and onboarding checklist

On the Employer Dashboard, Employer sees:

1. Employer profile completion status.
2. Company verification status.
3. Total companies and sites.
4. Draft, pending, active, and rejected jobs.
5. New applications.
6. Interviews and offers requiring action.
7. Attendance requiring approval.
8. Pending payments.
9. Employer wallet balance.
10. Notifications.

The dashboard also shows a persistent wallet warning whenever the available Employer wallet balance is below **₹10,000**. The warning links to **Add Funds** and explains that a new job cannot be submitted until the minimum balance is restored.

For a new Employer, the dashboard shows this onboarding order:

```text
Complete Employer Profile
-> Add Company
-> Upload Company Documents
-> Wait for Company Approval
-> Add Site
-> Post Job
```

## 4. Employer completes Employer profile

1. Employer selects **Profile** from the Employer menu.
2. System opens the Employer Profile page.
3. Employer selects **Edit Profile**.
4. Employer enters required contact person, designation, business address, billing information, and other required Employer details.
5. Employer selects **Save Profile**.
6. System validates the form and saves it.
7. Dashboard checklist changes the Employer Profile item to completed.

If information is missing, the page names every missing field.

## 5. Employer adds and verifies a company

### 5.1 Employer opens Companies

1. Employer selects **Companies** from the menu.
2. System opens the Company List page.
3. Employer sees every company belonging to the Employer and its status.
4. Employer selects **Add Company**.

### 5.2 Employer enters company details

On the Add Company page, Employer enters:

1. Legal company name.
2. Trading name, if applicable.
3. Company type.
4. Registered address.
5. Contact name, email, and mobile.
6. GST, CIN, PAN, or other required registration information.
7. Billing address.
8. Company logo, if required.

Employer can select **Save Draft** to continue later.

### 5.3 Employer uploads company documents

1. Employer opens the company.
2. Employer selects the **Documents** tab.
3. Employer selects **Upload Document**.
4. Employer selects the document type.
5. Employer selects the file.
6. Employer selects **Upload**.
7. System validates file size and type.
8. Uploaded document is stored privately.
9. Document status becomes `pending` or `under review`.

Employer repeats this process until all mandatory company documents are uploaded.

### 5.4 Employer submits company for verification

1. Employer opens the company summary.
2. System displays missing company information or documents.
3. When everything is complete, Employer selects **Submit for Verification**.
4. Company status changes from `draft` to `pending verification`.
5. Company becomes read-only except for permitted corrections.
6. Super Admin receives the company in the Company Verification Queue.
7. Employer sees `Company pending — Awaiting Super Admin review`.

### 5.5 Employer receives company decision

If Super Admin approves:

1. Employer receives a notification.
2. Company status becomes `verified`.
3. Employer can add operational sites and submit jobs.

If Super Admin rejects:

1. Employer receives a notification.
2. Company status becomes `rejected`.
3. Employer opens the company and sees Super Admin remarks.
4. Employer selects **Edit and Resubmit**.
5. Employer corrects information or replaces documents.
6. Employer selects **Resubmit for Verification**.
7. Company returns to `pending verification`.

## 6. Employer adds a site

### 6.1 Employer opens Sites

1. Employer selects **Sites** from the menu.
2. System opens the Site List page.
3. Employer selects **Add Site**.
4. System asks Employer to select a verified company.

An unverified, rejected, inactive, or blocked company cannot be used for an operational site.

### 6.2 Employer enters site details

Employer enters:

1. Site name.
2. Complete address.
3. PIN code.
4. Site contact person.
5. Site contact number.
6. Location using the map or location picker.
7. Latitude and longitude.
8. Geofence radius.
9. Reporting and entry instructions.

Employer selects **Save Site**.

System validates:

1. Selected company belongs to Employer.
2. Company is active and verified.
3. Address is complete.
4. Latitude and longitude are valid.
5. Geofence radius is within the permitted limit.

If valid, site becomes `active` and can be selected during job posting.

## 7. Employer posts a job

### 7.1 Employer opens Jobs

1. Employer selects **Jobs** from the menu.
2. System opens the Job List page.
3. Employer sees jobs grouped as Draft, Pending Approval, Active, Filled, Completed, Rejected, and Closed.
4. Employer selects **Post New Job**.

### 7.2 Employer selects company and site

1. Employer selects a verified company.
2. Employer selects an active site belonging to that company.
3. System displays the selected site's address and map location.

### 7.3 Employer enters job details

Employer enters:

1. Job title.
2. Job category.
3. Required Associate Type or permitted Types.
4. Required Associate Category or permitted Categories, filtered by the selected Type.
5. Number of Associates required.
6. Job description and responsibilities.
7. Required skills.
8. Required languages.
9. Minimum experience.
10. Minimum qualification.
11. Start and end date.
12. Application closing date.
13. Shift start and end time.
14. Day or night shift.
15. Duration such as 4, 8, or 12 hours.
16. Wage, hourly rate, or fixed shift rate.
17. Police verification requirement.
18. Additional licence, document, or certificate requirements.
19. Reporting instructions.

Employer selects **Save Draft** or **Submit Job**.

### 7.4 System validates the job

Before submission, system checks:

1. Employer account is active.
2. Employer profile is complete.
3. Company is active and verified.
4. Site is active and has valid coordinates.
5. Dates and shift times are valid.
6. Manpower count is greater than zero.
7. Wage information is valid.
8. Required fields are complete.
9. Available Employer wallet balance is at least **₹10,000** at the time of submission.
10. Every selected Associate Type and Category is active and every Category belongs to a selected Type.

If the balance is below ₹10,000:

1. The page shows `Maintain a minimum wallet balance of ₹10,000 to post a job. Please recharge your wallet.`
2. Employer can continue editing or save the job as a draft.
3. **Submit Job** is blocked by both the frontend and backend.
4. Direct API submission returns a validation error and does not create a pending job.

### 7.5 Job goes to Super Admin

1. Employer selects **Submit Job**.
2. Backend creates the job as `pending approval`.
3. Employer cannot force the job to become active.
4. Job does not appear to Associates yet.
5. Super Admin receives the job in the Pending Job Queue.
6. Employer sees `Job pending — Awaiting Super Admin approval`.

### 7.6 Employer receives the job decision

If Super Admin approves:

1. Job status becomes `active`.
2. Employer receives a notification.
3. Eligible Associates can see the job based on location and other visibility rules.

If Super Admin rejects:

1. Job status becomes `rejected`.
2. Employer receives the rejection remarks.
3. Employer opens the rejected job.
4. Employer selects **Edit and Resubmit**.
5. Corrected job returns to `pending approval`.

## 8. Employer receives and reviews applications

When an Associate applies, the application is routed first to the Operations queue assigned to the Employer/job. It is also immediately visible to the Employer, who may review and process it without waiting for Operations. Operations and Employer work on the same authoritative application record, timeline, messages, interview, onboarding, and status history.

### 8.1 Employer opens Applications

1. Employer receives a New Application notification.
2. Employer selects the notification or opens **Applications** from the menu.
3. Employer selects the relevant job.
4. System opens the Applicant List page.

Each applicant row shows:

1. Associate name and photograph.
2. Associate Type and Associate Category.
3. Skills, languages, experience, and qualification.
4. Application date.
5. Application status.
6. Overall profile status and exact reason.

Employer and Operations can filter and group applicants by Associate Type and Category. Eligibility checks compare the Associate's stored classification IDs with the job's permitted classification IDs.

Examples:

- `Profile verified`
- `Profile pending — Police verification required`
- `Profile pending — ID proof under review`
- `Profile rejected — Police document rejected`

### 8.2 Employer opens one application

1. Employer selects **View Application**.
2. System opens the Application Detail page.
3. Employer sees job-relevant Associate information and verification summary.
4. Employer cannot globally verify Aadhaar or any platform document.

### 8.3 Employer records Identity Checked

If Employer checks the Associate's identity during a call, interview, document sighting, or joining:

1. Employer opens the Application Detail page.
2. Employer selects **Identity Checked**.
3. Employer selects the method: Video Call, Physical Check, Document Sighted, or Site Joining Check.
4. Employer enters mandatory remarks.
5. Employer selects **Confirm Identity Checked**.
6. System stores it only against that application.
7. System stores Employer user, date, time, method, and remarks.
8. Associate's global Aadhaar status does not change.
9. Associate's overall profile status does not change.

### 8.4 Employer shortlists or rejects

To shortlist:

1. Employer selects **Shortlist**.
2. System changes application from `applied` to `shortlisted`.
3. Associate receives a shortlist notification.

To reject:

1. Employer selects **Reject Application**.
2. Employer selects or enters the reason.
3. Employer confirms rejection.
4. Application becomes `rejected`.
5. Associate receives a suitable rejection notification.

## 9. Employer schedules an interview

1. Employer opens a shortlisted application.
2. Employer selects **Request Interview/Call**.
3. Employer chooses Phone, Video, or Physical Interview.
4. Employer enters proposed date, time, and instructions.
5. Employer selects **Send Request**.
6. Interview becomes `requested`.
7. Associate receives the interview request.
8. Employer sees accepted, reschedule-requested, declined, or pending response.
9. After the interview, Employer opens the interview record.
10. Employer selects **Mark Completed**, **Cancelled**, or **No Show**.
11. Employer enters interview remarks.

The assigned Operations user can perform the same interview actions. Employer and Operations can both see who scheduled or updated the interview, the latest response, and the complete audited history.

## 10. Employer selects an Associate and sends an offer

After the interview, either an authorised Employer user or the Employer's assigned Operations user may record the hiring decision. The backend applies the same eligibility checks and writes the acting user, role, timestamp, reason/remarks, and old/new status to the audit trail. Both roles see the result immediately and cannot create conflicting final decisions from stale screens.

### 10.1 Employer selects the Associate

1. Employer opens the shortlisted application.
2. Employer selects **Select Associate**.
3. Backend rechecks profile verification and all job requirements.
4. If a required check is pending or rejected, selection is blocked and Employer sees the exact reason.
5. If eligible, application becomes `selected`.
6. Associate receives a selection notification.

### 10.2 Employer creates an offer

1. Employer selects **Create Offer**.
2. Employer reviews job, site, joining date, shift, wage, payment terms, offer expiry, and special conditions.
3. Employer selects **Send Offer**.
4. Offer becomes `sent`.
5. Associate receives an Offer notification.

### 10.3 Employer sees Associate's offer response

If Associate accepts:

1. Offer becomes `accepted`.
2. Employer receives a notification.
3. Employer proceeds to the job agreement.

If Associate rejects:

1. Offer becomes `rejected`.
2. Employer receives the Associate's response.
3. Employer may return to the Applicant List and select another eligible Associate.

If the offer expires, Employer may issue a new offer only if the job remains open and the Associate remains eligible.

## 11. Employer creates the job agreement and confirms joining

1. Employer opens **Offers & Agreements**.
2. Employer selects the accepted offer.
3. Employer selects **Create Agreement**.
4. System creates the job-specific agreement as `draft`.
5. Employer reviews terms and sends it to the Associate.
6. Associate reviews and confirms/signs it.
7. Employer sees agreement status as `confirmed` or `signed`.
8. System synchronizes the application to `accepted`.
9. On the joining date, Employer opens the assignment.
10. Employer selects **Confirm Joined** where manual confirmation is required.
11. Application/assignment becomes `joined`.
12. Job vacancy count is updated.
13. When all positions are filled, job becomes `filled` and stops accepting applications.

An authorised Operations user may also prepare, request, upload, review, send, or complete the onboarding documents and job agreement for the same Employer/job. Employer retains the same ability. Every document action, agreement action, and joining confirmation records which role and user performed it.

## 12. Employer reviews attendance

### 12.1 Employer opens Attendance

1. Employer receives check-in/check-out notifications.
2. Employer selects **Attendance** from the menu.
3. Employer filters by company, site, job, Associate, date, or status.
4. Employer selects an attendance record.

### 12.2 Employer verifies the attendance record

Employer sees:

1. Associate and job.
2. Check-in date and time.
3. Check-in GPS distance from site.
4. Check-out date and time.
5. Check-out GPS distance from site.
6. Total calculated hours.
7. Geofence warnings or exception reasons.

Employer selects one action:

1. **Approve Attendance**.
2. **Reject Attendance**.
3. **Request Correction**.

System does not allow normal approval when checkout is missing or total payable duration is zero or invalid. An authorised exception requires mandatory remarks and audit history.

Only approved attendance moves to payment.

## 13. Employer wallet settlement

### 13.1 Employer opens Payments

1. Employer selects **Payments** from the menu.
2. System shows approved unpaid attendance.
3. Employer selects an attendance item.
4. System shows payable hours, rate, adjustments, commission, and total amount.

### 13.2 System settles each approved daily shift from the Employer wallet

1. Associate completes the daily shift and checks out.
2. Employer or an authorised Operations user approves the valid attendance.
3. Backend calculates the payable per-day/shift amount from the agreed shift rate, approved adjustments, and configured commission/tax rules.
4. Backend checks that the attendance/shift has not already been settled.
5. In one atomic, idempotent transaction, backend debits the Employer wallet, records fees/commission, and credits the Associate wallet.
6. Payment and attendance become `completed`/`paid` only after every ledger entry succeeds.
7. Employer, Operations, and Associate receive the appropriate receipt or notification.
8. If the available Employer balance is insufficient for the shift, settlement becomes `funding_required`; no partial or negative wallet entry is allowed, and Employer is directed to **Add Funds**.
9. If settlement leaves the Employer wallet below ₹10,000, the existing job remains visible, but the low-balance warning appears and submission of any new job is blocked until recharge.

The ₹10,000 rule is a job-posting minimum-balance control. It must not cause a completed shift to be debited twice or cause a second Employer debit when the Associate later withdraws the already credited earnings.

### 13.3 Employer records cash payment

1. Employer selects **Cash Paid**.
2. Employer confirms Associate, attendance, and amount.
3. System creates a pending cash-payment request.
4. System sends a single-use OTP to the Associate through the configured verified channel.
5. System reports success only when OTP delivery succeeds.
6. Employer enters the OTP received by the Associate or follows the approved Associate-confirmation flow.
7. Employer selects **Confirm Cash Payment**.
8. Backend validates OTP, expiry, amount, parties, and duplicate-payment rules.
9. On success, cash payment becomes `completed` and the reconciliation ledger is recorded.

Employer cannot send `completed` as a payment status and cannot pay the same attendance twice.

## 14. Employer completes or closes the job

1. Employer opens **Jobs**.
2. Employer selects the filled/active job.
3. Employer confirms all shifts are completed.
4. Employer confirms all attendance is resolved.
5. Employer confirms all payable attendance is paid.
6. Employer selects **Complete Job**.
7. Job becomes `completed`.
8. After disputes and obligations are resolved, Employer or Super Admin selects **Close Job** according to policy.
9. Job becomes `closed`.
10. Employer may submit feedback and view historical records.

## 15. Employer regular account actions

From the Employer menu, Employer can also:

1. Open **Wallet** to view balance and transactions.
2. Open **Invoices** to view/download invoices.
3. Open **Notifications** and mark them read.
4. Open **Team/Staff** to manage permitted Employer staff roles.
5. Open **Support** to create and follow support tickets.
6. Open **Profile/Settings** to update permitted account information.
7. Select **Logout** to end the session.

---

# ROLE 2 — ASSOCIATE COMPLETE FLOW

## 16. Associate entry and signup

### 16.1 Associate opens the application

1. Associate opens the Granvia application.
2. Associate selects **Associate**.
3. System opens the Associate Login page.
4. A new Associate selects **Create Associate Account**.

### 16.2 Associate creates the account

Associate enters:

1. Full legal name.
2. Mobile number.
3. Email where required.
4. **Associate Type**, selected from the active Super Admin master.
5. **Associate Category**, selected from the active categories belonging to the chosen Associate Type.
6. Password and confirmation.
7. Required terms, privacy, Aadhaar/KYC, and platform consent.

Associate selects **Create Account**.

System validates all required fields, uniqueness, formats, password, consent, and that the selected Associate Type and Category are active and correctly related. The frontend list is not trusted as the backend rechecks both master IDs during registration. After successful contact verification, Associate enters the Associate Dashboard.

The registration stores stable master IDs, not only display text. This allows Super Admin to rename a Type or Category without breaking existing Associate classifications, filters, applications, or reports.

## 17. Associate dashboard and onboarding checklist

The dashboard shows:

1. Overall profile status.
2. Profile completion percentage.
3. Aadhaar status.
4. ID proof status.
5. Police verification status.
6. Onboarding agreement/consent status.
7. Available nearby jobs.
8. Active applications and offers.
9. Today's attendance.
10. Wallet summary.
11. Notifications.

For a new Associate, dashboard shows this order:

```text
Complete Personal Profile
-> Set Residential Location and Search Radius
-> Verify Aadhaar
-> Upload ID Proof
-> Upload Police Verification
-> Complete Onboarding Agreement and Consent
-> Wait for Profile Verification
-> Search and Apply for Jobs
```

## 18. Associate completes profile

1. Associate selects **Profile**.
2. Associate selects **Edit Profile**.
3. Associate reviews the selected Associate Type and Category and completes personal details, address, qualification, experience, skills, languages, bank details, emergency contact, and profile photo as required.
4. Associate selects the residential location on the map.
5. Associate selects a search radius.
6. Associate selects **Save Profile**.
7. System recalculates required profile-field completeness.
8. Missing fields are displayed by name.

Associate may change Type or Category while the profile is incomplete, using active master values only. After profile verification or joining an assignment, a classification change follows the configured reviewed-change process and is audited because it may affect job eligibility, workforce reporting, and active applications.

## 19. Associate verifies Aadhaar

### 19.1 Normal authorised-provider flow

1. Associate opens **Profile > Verification > Aadhaar**.
2. Associate selects **Verify Aadhaar**.
3. Associate enters Aadhaar information in the protected form.
4. Associate gives required consent.
5. Associate selects **Send OTP**.
6. Authorised Aadhaar provider sends OTP to the Aadhaar-linked mobile.
7. Associate enters OTP.
8. Associate selects **Verify OTP**.
9. Backend verifies with the authorised provider.
10. On confirmed success, Aadhaar status becomes `verified`.
11. Overall profile status recalculates automatically.

### 19.2 Aadhaar API unavailable

1. Associate sees `Aadhaar API temporarily unavailable`.
2. Associate selects **Upload Evidence for Admin Review**.
3. Associate uploads permitted evidence.
4. Aadhaar status becomes `under review`.
5. Super Admin receives the evidence.
6. Only Super Admin can approve or reject this fallback.
7. Associate receives the decision and remarks.

Employer cannot globally verify Associate Aadhaar.

## 20. Associate uploads ID proof and police verification

1. Associate opens **Profile > Documents**.
2. Associate sees required document cards.
3. Associate selects **Upload** on ID Proof.
4. Associate selects document type and file.
5. Associate submits the document.
6. ID Proof becomes `under review`.
7. Associate repeats the process for Police Verification.
8. Police Verification becomes `under review`.
9. Authorised Admin receives documents in the verification queue.

If a document is approved, its status becomes `verified`.

If a document is rejected:

1. Associate receives a rejection notification.
2. Associate opens the rejected document.
3. Associate reads mandatory Admin remarks.
4. Associate selects **Upload New Document**.
5. New document becomes `under review`.
6. Overall profile remains non-verified until the new document is approved.

Replacing an already verified required document immediately returns that requirement to `under review` and recalculates the profile.

## 21. Associate completes onboarding agreement

1. Associate opens **Agreement** from the dashboard or Profile menu.
2. If eligible, Associate selects **Generate Agreement**.
3. Associate opens/previews the agreement.
4. Associate selects the required consent checkbox.
5. Associate selects **Continue to eSign**.
6. Authorised eSign provider handles the signing process.
7. Associate returns to Granvia.
8. Backend independently verifies the provider result.
9. On success, agreement becomes `signed`.
10. Only a production-verified signed agreement satisfies the profile requirement.

## 22. Associate receives overall profile status

System recalculates the profile whenever profile data, Aadhaar, a required document, or the agreement changes.

Associate sees exact messages such as:

- `Profile pending — Required profile fields incomplete`
- `Profile pending — Aadhaar verification required`
- `Profile pending — ID proof under review`
- `Profile pending — Police verification required`
- `Profile pending — Agreement consent required`
- `Profile rejected — Police document rejected`
- `Profile verified`

When required by policy, Super Admin opens the completed profile and uses **Approve Profile** or **Reject Profile** with mandatory remarks.

## 23. Associate sets availability

1. Associate selects **Availability**.
2. Associate selects available dates or recurring days.
3. Associate selects available shift slots.
4. Associate selects preferred duration such as 4, 8, or 12 hours.
5. Associate selects **Save Availability**.
6. System uses this information for matching and shift-conflict checks.

## 24. Associate searches for jobs

1. Associate selects **Find Jobs**.
2. System reads the permitted current/residential location and selected radius.
3. System displays only active jobs whose sites are inside the selected circle, subject to visibility rules.
4. Associate can change radius and filters.
5. Map circle and job list use the same distance calculation.

Associate can filter by:

1. Distance.
2. Associate Type.
3. Associate Category.
4. Job category.
5. Date.
6. Day/night shift.
7. 4, 8, or 12-hour duration.
8. Wage range.
9. Required skills.

## 25. Associate views a job

1. Associate selects a Job Card.
2. System opens Job Details.
3. Associate sees company/site information permitted for display, required Associate Type/Category, distance, shift, dates, wage, vacancies, duties, skills, experience, language, qualification, KYC, and document requirements.
4. Associate selects **Apply**.

## 26. System checks whether Associate can apply

Before creating an application, backend checks:

1. Associate account is active and not blocked.
2. Job is active, not expired, and has a vacancy.
3. Company and site remain active and verified.
4. Required profile fields are complete.
5. Aadhaar is verified.
6. Required ID proof is verified.
7. Police verification is verified where required.
8. Required onboarding agreement and consent are completed.
9. Overall profile is verified where required.
10. Associate has a valid Type/Category classification and it matches the job's permitted Associate Type/Category requirements.
11. Job-specific skills, experience, language, qualification, licence, and certificate requirements are met.
12. Associate is available for the shift.
13. Accepted shifts do not conflict.
14. Associate has not already applied for the same job.
15. Location/radius rule is satisfied where it is an eligibility condition.

If a condition fails, application is not created. Associate sees the exact reason and a direct action, for example **Complete Profile**, **Verify Aadhaar**, **Upload Police Document**, or **View Existing Application**.

## 27. Associate submits the application

1. When all conditions pass, Associate reviews the confirmation.
2. Associate selects **Confirm Application**.
3. System creates one application as `applied`.
4. Database prevents a duplicate for the same Associate and job.
5. Associate sees `Application submitted successfully`.
6. Assigned Operations receives the workflow queue notification and Employer sees the application simultaneously.
7. Associate is taken to **My Applications**.

## 28. Associate follows the application

1. Associate selects **My Applications**.
2. Associate sees applications grouped by Applied, Shortlisted, Interview, Selected, Offer, Accepted, Joined, Rejected, Withdrawn, and Completed.
3. Associate opens an application to see its timeline.

Possible next events:

1. Employer shortlists Associate.
2. Employer rejects the application.
3. Employer sends an interview request.
4. Employer selects Associate.
5. Employer sends an offer.

Associate may select **Withdraw Application** before the permitted cut-off, enter a reason, and confirm withdrawal.

## 29. Associate responds to interview

1. Associate receives an Interview Request notification.
2. Associate opens **My Applications > Interview**.
3. Associate reviews method, date, time, and instructions.
4. Associate selects **Accept**, **Request Reschedule**, or **Decline**.
5. Employer receives the response.
6. Associate participates in the phone, video, or physical interview.
7. Interview result appears in the application timeline when recorded.

## 30. Associate responds to job offer

1. Associate receives an Offer notification.
2. Associate opens **My Applications > Offer**.
3. Associate reviews job, site, joining date, shift, wage, payment terms, expiry, and conditions.
4. Associate selects **Accept Offer** or **Reject Offer**.

Before acceptance, system rechecks eligibility and shift conflicts.

If accepted:

1. Offer becomes `accepted`.
2. Employer receives a notification.
3. Associate is directed to the job-specific agreement.

If rejected, offer becomes `rejected` and Employer may select another applicant.

## 31. Associate confirms job agreement and joins

1. Associate opens the job-specific agreement sent by Employer.
2. Associate reviews job terms.
3. Associate confirms/signs according to the configured process.
4. Agreement becomes `confirmed` or `signed`.
5. Application becomes `accepted`.
6. On the joining date, Associate opens the active assignment.
7. Employer or system confirms joining.
8. Assignment becomes `joined`.

The job-specific agreement is separate from the Associate onboarding/eSign agreement.

## 32. Associate checks in

Live attendance location enforcement is controlled globally by backend environment variable `LOCATION_CAPTURE_ENABLED`:

- `true` (safe default): check-in and check-out require fresh valid device coordinates.
- `false`: attendance remains available without coordinates and records are labelled `live_location_disabled` for audit/reporting.

The backend value is authoritative and is exposed to the client through public runtime configuration, so changing the switch does not require a separate frontend build-time flag. A backend restart or redeployment is required after changing the environment value.

1. On the duty date, Associate opens **Attendance**.
2. Associate selects the active assignment.
3. Associate selects **Check In**.
4. Application requests location permission.
5. Application captures current GPS coordinates and timestamp.
6. Backend calculates distance from the site.
7. Backend checks date, time window, assignment, duplicate/open attendance, and geofence.
8. If valid, check-in is recorded.
9. Associate sees `Checked in successfully`.
10. Employer receives a check-in notification.

If outside the geofence, Associate sees the distance/geofence error or an approved exception-request option.

## 33. Associate checks out

1. At shift end, Associate opens the active attendance record.
2. Associate selects **Check Out**.
3. Application captures current GPS and timestamp.
4. Backend validates location and shift rules.
5. Backend records checkout and calculates total hours.
6. Attendance is sent to Employer for approval.
7. Associate sees `Attendance awaiting Employer approval`.

## 34. Associate receives attendance decision

If Employer approves:

1. Associate receives an approval notification.
2. Attendance moves to Approved/Payment Pending.

If Employer rejects or requests correction:

1. Associate receives a notification.
2. Associate opens the attendance record.
3. Associate sees Employer remarks.
4. Associate submits the permitted correction or raises a support/dispute request.

## 35. Associate receives payment

1. Associate completes the daily shift and Employer or Operations approves the attendance.
2. System automatically debits the calculated per-day/shift amount from the Employer wallet and credits the Associate wallet once.
3. If settlement requires Employer recharge, Associate sees the payment as pending without receiving a duplicate credit.
4. If cash OTP is used, Associate receives the single-use OTP through the verified channel.
5. Associate follows the approved confirmation process.
6. After successful payment, Associate receives a Payment Completed notification.
7. Associate selects **Wallet**.
8. Associate sees credited amount, job, attendance, payment reference, date, and available/pending status.

## 36. Associate withdraws earnings

1. Associate opens **Wallet**.
2. Associate selects **Withdraw**.
3. System checks verified bank details and available balance.
4. Associate enters amount.
5. System shows limits, fee, and net amount.
6. Associate selects **Confirm Withdrawal**.
7. System reserves the requested amount so it cannot be spent or requested again.
8. Withdrawal becomes `requested` and Finance receives a notification.
9. Associate follows `requested`, `approved`, `rejected`, `processing`, `completed`, or `failed` status in Withdrawal History.
10. If Finance rejects the request, Associate sees the mandatory reason and the reserved amount returns to available balance.
11. If Finance approves the request, backend sends an idempotent payout instruction to the configured payment gateway for the Associate's verified bank account.
12. Withdrawal becomes `completed` only after verified gateway success/webhook confirmation.
13. On gateway failure, withdrawal becomes `failed` or enters an audited retry/reconciliation state, and funds are released only according to the approved reconciliation policy.

## 37. Associate completes the assignment

1. Associate completes all scheduled shifts.
2. All attendance is approved or resolved.
3. All payable work is settled.
4. Assignment becomes `completed`.
5. Associate can view it in Work History.
6. Associate may submit Employer/job feedback.
7. Associate becomes available for another non-conflicting job.

## 38. Associate regular account actions

Associate can also:

1. Open **Notifications**.
2. Open **Support** and create a ticket.
3. Open **Profile** and update permitted information.
4. Upload a replacement document, understanding that required verification returns to under review.
5. Change location, search radius, and availability.
6. Open **Work History**, **Attendance History**, **Wallet**, and **Agreements**.
7. Select **Logout**.

---

# ROLE 3 — SUPER ADMIN COMPLETE FLOW

## 39. Super Admin login and dashboard

1. Super Admin opens the Super Admin portal.
2. Super Admin enters authorised credentials.
3. Super Admin completes additional authentication if configured.
4. System confirms the `super_admin` role and active account.
5. System opens the Super Admin Dashboard.

Dashboard shows:

1. Companies awaiting verification.
2. Jobs awaiting approval.
3. Associate documents awaiting review.
4. Associate profiles awaiting final decision.
5. Aadhaar fallback reviews.
6. Attendance exceptions.
7. Payment and OTP failures.
8. Withdrawals/disputes requiring action.
9. User/account alerts.
10. Platform counts and operational reports.

## 40. Super Admin reviews companies

1. Super Admin opens **Employers > Company Verification Queue**.
2. Super Admin selects a pending company.
3. Super Admin reviews Employer profile, company details, and documents.
4. Super Admin opens each protected document.
5. Super Admin selects **Approve Company** or **Reject Company**.
6. Rejection requires remarks.
7. System records actor, timestamp, old/new status, and remarks.
8. Employer receives the decision.

## 41. Super Admin reviews jobs

1. Super Admin opens **Jobs > Pending Approval**.
2. Super Admin selects a job.
3. Super Admin reviews Employer, verified company, active site, location, manpower, shift, wage, dates, and requirements.
4. Super Admin selects **Approve Job** or **Reject Job**.
5. Rejection requires remarks.
6. Approval changes job to `active`.
7. Rejection changes job to `rejected`.
8. Employer receives the decision.
9. Audit history is recorded.

## 42. Super Admin reviews Associate documents

1. Super Admin opens **Associates > Document Verification Queue**.
2. Super Admin filters by document type, age, branch, or status.
3. Super Admin selects an Associate/document.
4. Super Admin views the protected file and current profile requirements.
5. Super Admin selects **Verify Document** or **Reject Document**.
6. Rejection requires remarks.
7. System records document version and decision history.
8. System recalculates overall profile immediately.
9. Associate receives the decision.

## 43. Super Admin handles Aadhaar API fallback

1. Super Admin opens **Associates > Aadhaar Fallback Queue**.
2. Super Admin confirms automated provider outage/fallback eligibility.
3. Super Admin opens the permitted evidence.
4. Super Admin selects **Approve Aadhaar Evidence** or **Reject Aadhaar Evidence**.
5. Remarks are mandatory.
6. System records the fallback reason, evidence reference, reviewer, and timestamp.
7. Overall profile recalculates.
8. Associate receives the decision.

Only the authorised Aadhaar provider or this Super Admin fallback can verify Aadhaar. Employer and Sub Admin cannot globally verify Aadhaar unless a future policy explicitly authorises a compliant provider-backed action.

## 44. Super Admin approves or rejects the overall profile

1. Super Admin opens **Associates > Profile Approval Queue**.
2. Super Admin selects an Associate.
3. Screen shows:
   - Required profile fields.
   - Selected Associate Type and Category, including current master status.
   - Aadhaar status.
   - ID proof status.
   - Police verification status.
   - Required onboarding agreement and consent status.
   - Document and decision history.
4. Super Admin selects **Approve Profile** or **Reject Profile**.
5. Remarks are mandatory for both actions.
6. Normal approval is blocked unless every mandatory calculated check passes, including a valid Type and related Category classification.
7. System stores the decision in immutable audit history.
8. Associate receives the decision.
9. Employer applicant screens receive the updated reason/status automatically.

## 45. Super Admin manages Associates and Employers

1. Super Admin opens **User Management**.
2. Super Admin selects Employers or Associates.
3. Super Admin can search and open a user.
4. Super Admin can review profile, account, verification, jobs/applications, attendance, and permitted financial history.
5. Super Admin can activate, block, or unblock the account with mandatory remarks.
6. Blocking immediately prevents protected platform actions.
7. Every administrative action is audited.

### 45.1 Super Admin manages the Associate Type Master

1. Super Admin opens **Master Data > Associate Types**.
2. System shows Type code, Type name, description, display order, active/inactive status, number of Categories, and number of classified Associates.
3. Super Admin selects **Add Associate Type** or opens an existing Type.
4. Super Admin enters a unique stable code, user-facing name, optional description, display order, and status.
5. Super Admin saves the Type; the system records the actor, timestamp, and old/new values.
6. Only active Types appear during Associate registration, profile classification, job requirements, workforce search, and operational filters.
7. A Type already referenced by a Category, Associate, job, or historical record cannot be permanently deleted. Super Admin deactivates it instead.

### 45.2 Super Admin manages the Associate Category Master

1. Super Admin opens **Master Data > Associate Categories**.
2. System shows Category code, Category name, parent Associate Type, description, display order, status, and usage count.
3. Super Admin selects **Add Associate Category** or opens an existing Category.
4. Super Admin selects one active parent Associate Type and enters a unique stable code, user-facing name, optional description, display order, and status.
5. System prevents duplicate codes and prevents an active Category from belonging to an inactive or missing Type.
6. Only active Categories under the Associate's selected active Type appear during registration or profile editing.
7. A Category already used by an Associate, job, application snapshot, or historical record cannot be permanently deleted. Super Admin deactivates it instead.
8. Deactivation stops new selection but preserves existing records and reporting history. Existing affected Associates are flagged for review rather than silently reclassified.

### 45.3 Super Admin classifies and searches Associates

1. Super Admin can filter User Management, verification queues, hiring, attendance, payments, and reports by Associate Type and Category.
2. Super Admin can view the classification on the Associate profile and its change history.
3. An authorised correction or reclassification requires remarks and records old/new Type and Category IDs.
4. System re-evaluates impacted pending applications and job eligibility without changing completed historical records.

## 46. Super Admin monitors hiring and attendance

1. Super Admin opens **Hiring Workflow** to review application/offer/agreement status across the platform.
2. Super Admin opens **Attendance** to review attendance by Employer, company, site, job, Associate, and date.
3. Super Admin reviews geofence and duration exceptions.
4. Super Admin can resolve an authorised exception or dispute with mandatory remarks.
5. Super Admin cannot silently rewrite history; corrections use audited adjustment actions.

## 47. Super Admin monitors payments, wallet, and withdrawals

1. Super Admin opens **Payments & Wallet**.
2. Super Admin reviews pending, completed, failed, duplicate-blocked, and disputed payments.
3. Super Admin checks Employer debit, commission, Associate credit, and settlement references.
4. Super Admin reviews OTP delivery failures.
5. Finance owns the normal withdrawal approval queue; Super Admin monitors, audits, and handles authorised escalations or disputes.
6. Super Admin can review Finance decisions and gateway reconciliation without silently replacing the Finance audit record.
7. Any reversal/refund uses an authorised audited process; completed ledger history is not deleted.

## 48. Super Admin manages roles and staff

1. Super Admin opens **Role Master**.
2. Super Admin creates or edits permitted role definitions and module permissions.
3. Super Admin opens **Staff Users**.
4. Super Admin creates or manages authorised Sub Admin, Sales Executive, Operations, Finance, or other internal staff accounts.
5. Super Admin assigns branch/company scope where required.
6. System enforces permissions in both menus and backend APIs.

## 49. Super Admin backfills existing Associates

1. Super Admin opens the backfill/recalculation operation or runs the approved migration process.
2. System recalculates every existing Associate using current mandatory checks.
3. For a user such as Sandesh, system checks profile fields, a valid active Associate Type/Category classification, Aadhaar source, ID proof, police verification, and agreement/consent.
4. If all checks pass, profile becomes `verified`.
5. Otherwise profile remains pending/rejected and displays the exact reason.
6. Employer Identity Checked or a generic old profile flag is never treated as Aadhaar proof.
7. Backfill result is audited.

## 50. Super Admin reports and logout

Super Admin can open **Reports** for Associate Type/Category distribution, area availability, skills/languages, hiring, attendance, commission, payments, and operational exceptions according to implemented permissions.

Super Admin selects **Logout** to end the session.

---

# ROLE 4 — SUB ADMIN COMPLETE FLOW

## 51. Sub Admin login and scope

1. Sub Admin opens the Granvia application.
2. Sub Admin selects **Sub Admin**.
3. Sub Admin logs in.
4. System verifies role, account, permissions, and assigned scope.
5. System opens the Sub Admin Dashboard.

Sub Admin sees only the branch, company, clients, Associates, staff, documents, and reports assigned by Super Admin. Direct access to an out-of-scope record returns Access Denied.

## 52. Sub Admin dashboard

Dashboard shows scoped counts:

1. Assigned clients/companies.
2. Assigned Associates.
3. Documents awaiting review.
4. Staff.
5. Skill and operational reports.
6. Scoped commission/reporting information permitted by role.

## 53. Sub Admin verification queue

1. Sub Admin opens **Verification Queue**.
2. System lists only assigned Associates/documents.
3. Sub Admin selects a document.
4. Sub Admin reviews the protected evidence.
5. Sub Admin selects **Verify** or **Reject** where role permission permits.
6. Rejection requires remarks.
7. System records Sub Admin, scope, timestamp, and decision.
8. Overall profile recalculates.
9. Associate receives the decision.

Sub Admin cannot use an Employer-style action to verify Aadhaar and cannot review any Associate outside the assigned scope.

## 54. Sub Admin manages scoped clients, Associates, and staff

1. Sub Admin opens **Clients** to view assigned clients.
2. Sub Admin opens **Associates** to view assigned Associates and permitted status information.
3. Sub Admin opens **Staff** to create/edit/delete permitted non-login staff records or manage staff according to assigned permission.
4. Sub Admin opens **Company** to view/edit permitted assigned-company information.
5. All updates are scope-checked by the backend.

## 55. Sub Admin reports and logout

1. Sub Admin opens **Reports**.
2. Sub Admin views only scoped skills, availability, operational, and commission information allowed by role.
3. Sub Admin cannot view global platform data.
4. Sub Admin selects **Logout**.

---

# ROLE 5 — SALES EXECUTIVE COMPLETE FLOW

## 56. Sales Executive login and dashboard

1. Sales Executive opens the Granvia application.
2. Sales Executive selects **Sales Executive**.
3. Sales Executive logs in.
4. System verifies role, account status, permissions, and assigned clients/area.
5. System opens the Sales Dashboard.

Dashboard shows assigned clients, recent activity, jobs created for clients, confirmation status, discounts, and available manpower information permitted by scope.

## 57. Sales Executive views a client

1. Sales Executive opens **Clients**.
2. System lists assigned clients only.
3. Sales Executive selects a client.
4. Sales Executive sees permitted Employer, company, site, and job information.

## 58. Sales Executive creates a job for an Employer

1. Sales Executive opens the assigned client.
2. Sales Executive selects **Create Job for Client**.
3. Sales Executive selects the client's verified company and active site.
4. Sales Executive enters job requirements in the same job form used by Employer.
5. Sales Executive applies only an authorised discount, if permitted.
6. Sales Executive selects **Request Employer Confirmation OTP**.
7. System sends OTP to the authorised Employer contact.
8. Employer confirms the job details/OTP.
9. Sales Executive enters or completes the approved confirmation process.
10. Backend verifies OTP, client, job draft, expiry, and Sales Executive scope.
11. Job is submitted as `pending approval`.
12. Super Admin reviews the job.

The Sales Executive cannot directly publish an active job.

## 59. Sales Executive manages discounts

1. Sales Executive opens **Discounts**.
2. Sales Executive selects an assigned client.
3. Sales Executive creates or updates a discount within authorised limits.
4. System validates effective dates, value, approval rules, and scope.
5. Discount is audited and applied only to eligible billing calculations.

## 60. Sales Executive views manpower and activity

1. Sales Executive opens **Manpower Availability**.
2. System shows only permitted aggregate or scoped Associate information and supports Associate Type/Category filters.
3. Sales Executive must not gain access to private Aadhaar evidence or unrestricted documents.
4. Sales Executive opens **Activity** to see client/job/OTP actions.
5. Sales Executive selects **Logout** when finished.

---

# ROLE 6 — OPERATIONS COMPLETE FLOW

## 61. Operations login, assignment, and scope

1. Operations user opens the authorised staff portal and logs in.
2. System verifies the `operations` role, active account, and assigned Employer/company/site/job scope.
3. Operations sees only applications, Associate details, job details, messages, interviews, onboarding records, attendance, and agreements within that scope.
4. Direct access to another Employer's or unassigned job's data returns Access Denied.
5. Private identity or bank information is masked unless it is specifically required and permitted for onboarding.

The Employer or Super Admin assigns an Operations user to the relevant Employer, company, site, or job. Removal of an assignment immediately removes future access without deleting the historical audit trail.

## 62. Operations dashboard and application queue

Operations dashboard shows:

1. New applications for assigned jobs.
2. Applications awaiting contact or review.
3. Interviews awaiting scheduling, response, or outcome.
4. Selected Associates awaiting onboarding documents or agreements.
5. Joining and attendance actions requiring attention.
6. Messages, reminders, and notifications.

Operations can filter every permitted queue and manpower view by Associate Type and Category.

When an Associate submits an application:

1. The assigned Operations user receives the first workflow notification and queue item.
2. Employer receives the application notification and sees the same application simultaneously.
3. Operations opens the application and can view the job details and job-relevant Associate profile, eligibility, verification summary, documents permitted for onboarding, and full workflow timeline.
4. Operations records contact attempts, notes, and next actions without creating a duplicate application record.

## 63. Operations communication, status, and interview flow

1. Operations opens an assigned application.
2. Operations communicates with the Associate using the configured in-app messaging, call, email, or meeting workflow.
3. System stores communication metadata and permitted notes in the application timeline.
4. Operations may move the application through permitted statuses such as `under review`, `contacted`, `shortlisted`, `interview requested`, `interview completed`, `selected`, `rejected`, `onboarding`, and `joined`.
5. Every status change requires any configured reason/remarks and records actor, role, timestamp, and old/new value.
6. Operations can schedule, reschedule, cancel, or complete an interview and record the outcome.
7. Employer sees all Operations activity and may perform the same permitted processing actions.
8. Optimistic locking/status validation prevents Employer and Operations from overwriting each other's newer decision from a stale screen.

## 64. Operations hiring decision and onboarding

1. After the Associate interview, either an authorised Employer user or assigned Operations user may select or reject the Associate.
2. Backend rechecks Associate eligibility, job vacancy, job status, and conflicting assignments before selection.
3. The hiring decision becomes part of the shared authoritative application record and is visible to both roles.
4. Operations starts and tracks the onboarding checklist, including required information, documents, offer, agreement, joining instructions, and acknowledgements.
5. Employer and Operations may each prepare, upload, review, request correction for, send, or complete permitted onboarding documents and agreements.
6. Associate reviews and signs/confirms the agreement where required.
7. System records every document version, decision, signature/confirmation, and acting user.
8. Employer or Operations confirms joining; application/assignment becomes `joined` only when all mandatory prerequisites pass.

Operations does not gain global Aadhaar verification authority. Employer **Identity Checked** and Operations identity-sighting actions remain application-specific unless an authorised provider or Super Admin verification flow updates the global profile.

## 65. Operations attendance and settlement visibility

1. Operations can view check-in/check-out and attendance for assigned jobs.
2. Where permission is granted, Operations may approve, reject, or request correction using the same validity and audit rules as Employer.
3. Approval triggers the one-time daily shift settlement from Employer wallet to Associate wallet.
4. Operations can see settlement status and funding-required alerts but cannot alter wallet ledger entries or approve Associate bank withdrawals.
5. Operations selects **Logout** to end the session.

---

# ROLE 7 — FINANCE COMPLETE FLOW

## 66. Finance login and dashboard

1. Finance user opens the authorised staff portal and logs in.
2. System verifies the `finance` role, active account, permissions, and assigned financial scope.
3. Finance dashboard shows new withdrawal requests, approved/processing payouts, rejected requests, gateway failures, reconciliation exceptions, and ageing/SLA indicators.
4. Finance can view only the Associate identity, verified bank destination, wallet/ledger evidence, request details, and compliance information required for the payout decision.

## 67. Finance reviews and decides a withdrawal

1. Associate submits a withdrawal request and Finance receives an immediate notification.
2. Finance opens **Withdrawals > Requested** and selects the request.
3. System shows Associate, verified bank account, requested amount, fee/net amount, available and reserved balances, source ledger entries, prior withdrawal history, and risk/compliance flags.
4. Finance selects **Approve** or **Reject**.
5. Rejection requires a reason; request becomes `rejected`, Associate is notified, and the reserved amount returns to available balance in an audited transaction.
6. Approval records Finance user, timestamp, remarks, request snapshot, and an idempotency key; request becomes `approved`.
7. A Finance user cannot approve or reject the same request twice, approve a request already rejected, or change the requested amount.

## 68. Finance initiates and reconciles payout

1. After Finance approval, backend instructs the configured payment gateway to transfer the approved net amount to the Associate's verified bank account.
2. The instruction carries the Employer/job/shift source references for traceability, but does not debit the Employer a second time because the Employer wallet was already debited when the daily shift was settled.
3. Request becomes `processing` while awaiting a signed/verified gateway response or webhook.
4. On confirmed success, request becomes `completed`, the reserved Associate wallet amount is consumed, and Associate receives a payout confirmation.
5. On rejection or failure from the gateway, request becomes `failed` or enters the configured retry/reconciliation queue; Finance sees the gateway reason/reference.
6. Finance performs only authorised retry, reconciliation, or escalation actions. Ledger records and completed gateway references are never deleted or silently edited.
7. Every Finance decision, gateway request/response, webhook, retry, and balance movement is audited.
8. Finance selects **Logout** to end the session.

---

# ROLE HANDOFF SUMMARY

## 69. Who hands work to whom

### 69.1 Company onboarding

```text
Employer creates company and uploads documents
-> Super Admin reviews company
-> Employer receives approval/rejection
```

### 69.2 Job publishing

```text
Employer creates job
or Sales Executive creates job with Employer OTP
-> Super Admin approves/rejects job
-> Approved job becomes visible to eligible Associates
```

### 69.3 Associate verification

```text
Super Admin maintains active Associate Type and Category masters
-> Associate selects a valid Type and related Category during registration
-> Associate completes profile and uploads documents
-> Authorised provider verifies Aadhaar
-> Admin reviews required documents
-> Super Admin approves/rejects overall profile where required
-> Employer and Operations see classification, verified status, or exact pending reason
```

### 69.4 Hiring

```text
Associate applies
-> Operations receives the assigned Employer/job queue item
-> Operations or Employer reviews, communicates, and shortlists
-> Operations or Employer requests and records the interview
-> Associate responds and attends
-> Operations or Employer records the hiring decision
-> Operations or Employer sends the offer
-> Associate accepts
-> Operations or Employer completes onboarding and sends the job agreement
-> Associate confirms/signs
-> Assignment becomes accepted/joined
```

### 69.5 Attendance, wallet settlement, and withdrawal

```text
Associate checks in/out
-> Employer or authorised Operations user approves attendance
-> System automatically debits Employer wallet and credits Associate wallet once per approved shift
-> Associate requests withdrawal
-> Finance approves or rejects with reason
-> On approval, payment gateway transfers funds to Associate's verified bank account
-> Employer closes completed job
```

## 70. Mandatory handoff controls

1. Super Admin cannot approve an incomplete company without an authorised, audited exception.
2. Associate cannot see a pending/rejected job as an active job.
3. Associate cannot apply without satisfying mandatory application checks.
4. Employer cannot globally verify Associate Aadhaar.
5. Employer **Identity Checked** belongs only to one application.
6. Backend rechecks Associate eligibility before application, selection, offer acceptance, and joining.
7. Offer and agreement completion must update the authoritative application/assignment status.
8. Associate cannot check in without an eligible active assignment.
9. Employer or Operations cannot approve incomplete or invalid attendance without an audited exception.
10. Operations access is restricted to its assigned Employer/company/site/job scope.
11. Employer wallet balance below ₹10,000 blocks new job submission at both UI and API layers and displays a recharge message.
12. A valid approved shift cannot settle without sufficient Employer wallet funds.
13. One attendance/shift item cannot be paid twice.
14. A withdrawal amount is reserved when requested and cannot be withdrawn or spent twice.
15. Finance approval is required before a normal Associate bank payout is sent to the payment gateway.
16. Finance rejection requires a reason that is visible to the Associate.
17. Gateway callbacks are verified and idempotent; payout completion requires confirmed gateway success.
18. Associate withdrawal never creates a second debit against an Employer shift already settled to the Associate wallet.
19. Employer and Operations actions use one authoritative application record with concurrency protection and complete history.
20. Associate registration and profile verification require a valid Type and a valid related Category from the Super Admin master.
21. Inactive Type/Category values cannot be selected for new registrations, profiles, or job requirements, but historical references remain readable.
22. Master records already in use cannot be hard-deleted; deactivation and classification changes are audited.
23. Associate Type/Category IDs are used consistently for job eligibility, applicant/manpower filtering, operations queues, and reporting.
24. When `LOCATION_CAPTURE_ENABLED=true`, live attendance without both coordinates is rejected by the backend; when false, the no-location mode is explicitly recorded.
25. Every approval, rejection, override, status transition, master-data change, classification change, OTP action, payment, withdrawal, and gateway event is audited.
