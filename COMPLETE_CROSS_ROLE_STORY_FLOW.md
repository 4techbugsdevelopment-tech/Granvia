# Granvia Complete Cross-Role Story Flow

## 1. Purpose

This document explains the complete Granvia process as one continuous story involving multiple characters. Each character performs an action and passes the process to the next character.

The story begins when an Employer joins Granvia. It continues through company approval, site creation, job publishing, Associate onboarding, job matching, application, selection, joining, attendance, payment, withdrawal, and final job closure.

## 2. Characters in the story

1. **Employer** — creates the company, site, and job; hires Associates; verifies attendance; and pays for completed work.
2. **Associate** — completes verification, searches for nearby jobs, applies, accepts work, marks attendance, and receives payment.
3. **Super Admin** — verifies companies, approves jobs, reviews Associate verification, approves/rejects profiles, and monitors the complete platform.
4. **Sub Admin** — helps review assigned Associates and documents within a limited branch or company scope.
5. **Sales Executive** — may help an assigned Employer create a job, subject to Employer OTP confirmation and Super Admin approval.
6. **Granvia System** — performs automatic checks, matching, notifications, status calculations, audit recording, and financial transactions.

---

# THE COMPLETE STORY

## Scene 1 — Employer joins Granvia

1. Employer opens the Granvia application.
2. Employer selects the Employer role.
3. Employer selects **Create Account**.
4. Employer enters name, business email, mobile number, password, and required consent.
5. Granvia System checks that the email and mobile number are valid and not already registered.
6. Granvia System sends the configured email verification link or OTP.
7. Employer completes verification.
8. Granvia System creates an active Employer login and opens the Employer Dashboard.
9. Employer Dashboard tells the Employer what must happen next:

```text
Complete Employer Profile
-> Add Company
-> Upload Company Documents
-> Submit Company for Approval
```

If the Employer's contact verification fails, the Employer remains on the verification page and can request a new link or OTP.

## Scene 2 — Employer completes the business profile

1. Employer opens **Profile**.
2. Employer enters contact person, designation, business address, billing details, and all mandatory Employer information.
3. Employer selects **Save**.
4. Granvia System checks the information.
5. If something is missing, the System tells the Employer exactly which field is incomplete.
6. When the Employer profile is complete, the System marks the first onboarding step complete.
7. Employer now moves to company creation.

## Scene 3 — Employer creates a company

1. Employer opens **Companies**.
2. Employer selects **Add Company**.
3. Employer enters the legal company name, company type, registered address, contact details, GST/CIN/PAN or other required registration details, and billing address.
4. Employer uploads the company logo where required.
5. Employer opens the Company Documents section.
6. Employer uploads every mandatory company document.
7. Each uploaded document initially shows `Under review`.
8. Employer selects **Submit Company for Verification**.
9. Company status becomes `Pending verification`.
10. Employer now sees:

`Company pending — Awaiting Super Admin review`

11. At the same time, the company appears in the Super Admin's Company Verification Queue.

## Scene 4 — Super Admin reviews the company

1. Super Admin logs in to the Super Admin portal.
2. Super Admin sees a new company waiting for review.
3. Super Admin opens the Employer and company details.
4. Super Admin reviews the company registration information and uploaded documents.
5. Super Admin chooses one of two actions.

### If the company is correct

1. Super Admin selects **Approve Company**.
2. Super Admin enters approval remarks where required.
3. Company status becomes `Verified`.
4. Granvia System records the reviewer, date, time, decision, and remarks in audit history.
5. Employer receives `Your company has been verified`.
6. Employer can now create an operational site.

### If the company is not correct

1. Super Admin selects **Reject Company**.
2. Super Admin must enter the rejection reason.
3. Company status becomes `Rejected`.
4. Employer receives the rejection notification.
5. Employer opens the company and reads the Super Admin remarks.
6. Employer corrects the details or replaces the rejected documents.
7. Employer selects **Resubmit for Verification**.
8. The company returns to the Super Admin queue.
9. This review cycle continues until the company is verified or the Employer abandons it.

An unverified or rejected company cannot publish an operational job.

## Scene 5 — Employer adds a work site

1. After company approval, Employer opens **Sites**.
2. Employer selects **Add Site**.
3. Employer selects the verified company.
4. Employer enters the site name, full address, PIN code, contact person, contact number, and reporting instructions.
5. Employer selects the exact site location on the map.
6. Granvia System stores the site's latitude and longitude.
7. Employer selects the permitted attendance geofence radius.
8. Employer selects **Save Site**.
9. Granvia System checks that the company is verified, the site belongs to the Employer, the address is complete, and the coordinates are valid.
10. The site becomes `Active`.
11. Employer can now use that site while creating a job.

## Scene 6 — Employer creates a job

1. Employer opens **Jobs**.
2. Employer selects **Post New Job**.
3. Employer selects the verified company and active site.
4. Employer enters:
   - Job title and category.
   - Number of Associates required.
   - Duties and responsibilities.
   - Required skills and languages.
   - Required experience and qualification.
   - Start date, end date, and application closing date.
   - Shift start time and end time.
   - Day shift or night shift.
   - Duration such as 4, 8, or 12 hours.
   - Wage or shift rate.
   - Police verification requirement.
   - Any additional document, licence, or certificate requirement.
   - Reporting instructions.
5. Employer selects **Submit Job**.
6. Granvia System checks the Employer, company, site, dates, shift, manpower count, wage, and all required fields.
7. Granvia System always creates the submitted job as `Pending approval`.
8. Employer cannot directly make the job active.
9. The pending job is not shown to Associates.
10. Super Admin receives the job in the Pending Job Queue.

## Scene 7 — Super Admin reviews the job

1. Super Admin opens **Pending Jobs**.
2. Super Admin reviews the Employer, verified company, active site, map location, job description, manpower count, shift, wage, dates, and Associate requirements.

### If the job is valid

1. Super Admin selects **Approve Job**.
2. Job status becomes `Active`.
3. Employer receives `Your job has been approved and published`.
4. Granvia System starts matching the job with Associates.

### If the job is not valid

1. Super Admin selects **Reject Job**.
2. Super Admin enters mandatory rejection remarks.
3. Employer receives the rejection reason.
4. Employer edits the job and submits it again.
5. Corrected job returns to the Super Admin queue.

## Scene 8 — Associates join and prepare before searching for jobs

While Employers are creating jobs, Associates join Granvia and prepare their profiles.

1. Associate opens Granvia and selects the Associate role.
2. Associate selects **Create Account**.
3. Associate enters legal name, mobile number, email where required, password, and required consent.
4. Associate completes contact verification.
5. Granvia System opens the Associate Dashboard.
6. Dashboard displays this onboarding journey:

```text
Complete Profile
-> Set Location and Search Radius
-> Verify Aadhaar
-> Upload ID Proof
-> Upload Police Verification
-> Complete Onboarding Agreement and Consent
-> Obtain Profile Approval
-> Search and Apply for Jobs
```

## Scene 9 — Associate completes the profile and location

1. Associate opens **Profile**.
2. Associate enters legal personal information, date of birth, address, PIN code, qualification, experience, skills, languages, bank details, emergency contact, and other mandatory information.
3. Associate uploads a profile photograph.
4. Associate selects the residential/search location on the map.
5. Associate selects a job search radius, for example walking distance, 1 km, 5 km, 10 km, or 15 km and above.
6. Associate selects **Save Profile**.
7. Granvia System calculates profile-field completion.
8. Any missing required field is shown by name.

## Scene 10 — Associate completes Aadhaar verification

1. Associate opens **Profile > Verification > Aadhaar**.
2. Associate selects **Verify Aadhaar**.
3. Associate enters the required Aadhaar information through the protected form and provides consent.
4. Granvia backend sends the request to an authorised Aadhaar/OTP provider.
5. The provider sends OTP to the Aadhaar-linked mobile number.
6. Associate enters the OTP.
7. The provider confirms whether verification succeeded.
8. Only after confirmed provider success does Aadhaar status become `Verified`.
9. Granvia System records safe provider reference and audit details without exposing sensitive Aadhaar data.

### When the Aadhaar API is unavailable

1. Associate sees that automated verification is temporarily unavailable.
2. Associate uploads the permitted Aadhaar evidence for manual review.
3. The evidence goes only to Super Admin.
4. Super Admin reviews the evidence.
5. Super Admin approves or rejects it with mandatory remarks.
6. The decision is recorded in audit history.

An Employer can never change the Associate's global Aadhaar status.

## Scene 11 — Associate uploads required documents

1. Associate opens **Profile > Documents**.
2. Associate uploads the required ID proof.
3. Associate uploads police verification evidence.
4. Associate uploads any other mandatory licence or certificate.
5. Each new document becomes `Under review`.
6. Granvia System stores the files privately.
7. The documents appear in the authorised Admin verification queue.

If a Sub Admin is assigned to that Associate's branch, the document may appear in the Sub Admin's scoped queue. A Sub Admin cannot see or review Associates outside the assigned scope.

## Scene 12 — Admin reviews Associate documents

1. Super Admin or an authorised scoped Sub Admin opens the document queue.
2. Admin opens the Associate and the protected document.
3. Admin confirms that the document is readable, belongs to the Associate, is valid, and is current.

### If the document is valid

1. Admin selects **Verify Document**.
2. Document status becomes `Verified`.
3. Associate receives an approval notification.
4. Granvia System recalculates the overall profile.

### If the document is invalid

1. Admin selects **Reject Document**.
2. Admin must enter rejection remarks.
3. Associate receives the rejection reason.
4. Associate opens the rejected document and selects **Upload New Document**.
5. The replacement becomes `Under review`.
6. The profile remains non-verified until the replacement is approved.

If an Associate replaces a previously verified required document, Granvia immediately returns that requirement to `Under review` and recalculates the profile.

## Scene 13 — Associate completes the onboarding agreement

1. Associate opens **Agreement**.
2. Associate generates and views the current onboarding agreement.
3. Associate provides the required consent.
4. Associate starts the authorised eSign process.
5. The eSign provider handles the signature.
6. Granvia backend independently verifies the provider result.
7. On successful production verification, agreement status becomes `Signed`.
8. A sandbox or test signature does not satisfy the production requirement.

This onboarding agreement is different from the later job-specific Employer agreement.

## Scene 14 — Granvia calculates overall Associate profile status

Granvia System checks all mandatory requirements together:

1. Required profile fields completed.
2. Aadhaar verified.
3. Required ID proof verified.
4. Police verification verified.
5. Required onboarding agreement and consent completed.

The Associate sees a meaningful status:

- `Profile pending — Aadhaar verification required`
- `Profile pending — ID proof under review`
- `Profile pending — Police verification required`
- `Profile pending — Agreement consent required`
- `Profile rejected — Police document rejected`
- `Profile verified`

Whenever Aadhaar, profile information, a required document, or agreement changes, Granvia recalculates this status automatically.

Where final Admin approval is required:

1. Completed profile appears in the Super Admin Profile Approval Queue.
2. Super Admin reviews every mandatory check.
3. Super Admin selects **Approve Profile** or **Reject Profile**.
4. Remarks are mandatory.
5. Decision is stored in audit history.
6. Associate receives the result.

## Scene 15 — Granvia publishes the job to matching Associates

Now return to the Employer's approved job.

1. Job status is `Active`.
2. Granvia reads the job site's latitude and longitude.
3. Granvia checks each Associate's selected location and job search radius.
4. Granvia calculates the distance between the Associate and the job site.
5. The job appears to an Associate when the job site falls inside that Associate's selected circle and other visibility rules allow it.
6. Associates outside the selected radius do not see the job in their normal nearby-job results.
7. The map circle and the job list use the same distance calculation.
8. All eligible nearby Associates can view the job; it is not reserved for one Associate at publication time.

Example:

1. Employer publishes a job at Site A.
2. Associate Sandesh has selected a 5 km search radius.
3. Site A is 3 km from Sandesh's search location.
4. Sandesh can see the job.
5. Another Associate has selected a 2 km radius and is 3 km away.
6. That Associate does not see the job unless the search radius is increased.

## Scene 16 — Associate finds and opens the job

1. Associate opens **Find Jobs**.
2. Associate sees the Employer's job in the nearby job list.
3. Associate sees job title, company/site information allowed for display, distance, shift, dates, wage, vacancies, and requirements.
4. Associate opens the Job Details page.
5. Associate reads duties, skills, experience, language, qualification, Aadhaar, police verification, document, and agreement conditions.
6. Associate selects **Apply**.

## Scene 17 — Granvia checks whether the Associate can apply

Before creating the application, Granvia checks again:

1. Associate account is active and not blocked.
2. Job is still active.
3. Application closing date has not passed.
4. Vacancy remains.
5. Employer company and site remain active and verified.
6. Required profile fields are complete.
7. Aadhaar is verified.
8. ID proof is verified.
9. Police verification is verified when required.
10. Onboarding agreement and consent are complete.
11. Overall profile is verified where required.
12. Job-specific skills, language, experience, qualification, licence, and certificate conditions are met.
13. Associate is available for the shift.
14. Associate has no conflicting accepted shift.
15. Associate has not already applied for this job.
16. Location/radius condition remains satisfied where it is an application rule.

### If any condition fails

1. Granvia does not create the application.
2. Associate sees the exact missing condition.
3. Associate receives a direct action such as **Complete Profile**, **Verify Aadhaar**, **Upload Document**, or **View Existing Application**.

### If all conditions pass

1. Associate selects **Confirm Application**.
2. Granvia creates one application with status `Applied`.
3. Database prevents a duplicate application for the same job and Associate.
4. Associate sees `Application submitted successfully`.
5. Employer receives a New Application notification.
6. The story now passes back to the Employer.

## Scene 18 — Employer sees all applicants

1. Employer opens the New Application notification.
2. Granvia opens the applicant list for the job.
3. Employer sees every Associate who successfully applied.
4. For each Associate, Employer sees permitted profile information, skills, languages, experience, qualification, application date, and overall profile status.
5. Instead of only `Profile: pending`, Employer sees the actual reason:

- `Profile pending — Police verification required`
- `Profile pending — ID proof under review`
- `Profile verified`

6. Employer opens one application for detailed review.

## Scene 19 — Employer may record Identity Checked

1. Employer speaks with or meets the Associate.
2. Employer may check the Associate's visible identity during a video call, physical interview, document sighting, or site visit.
3. Employer opens that specific job application.
4. Employer selects **Identity Checked**.
5. Employer selects the checking method and enters mandatory remarks.
6. Granvia records the Employer user, date, time, method, and remarks against that application only.

This action does not:

1. Verify Aadhaar globally.
2. Approve an ID or police document.
3. Change overall profile status.
4. Apply to another job application.

## Scene 20 — Employer shortlists Associates

For each application, Employer chooses one of the following paths.

### Shortlist path

1. Employer selects **Shortlist**.
2. Application changes from `Applied` to `Shortlisted`.
3. Associate receives `You have been shortlisted`.

### Rejection path

1. Employer selects **Reject Application**.
2. Employer enters or selects an appropriate reason.
3. Application becomes `Rejected`.
4. Associate receives the permitted rejection notification.
5. The hiring story ends for that application.

### No-decision path

Application stays `Applied` until Employer acts, the job closes, or an expiry policy changes its status.

## Scene 21 — Employer requests an interview

1. Employer opens a shortlisted application.
2. Employer selects **Request Interview/Call**.
3. Employer chooses Phone, Video, or Physical Interview.
4. Employer enters the proposed date, time, and instructions.
5. Interview becomes `Requested`.
6. Associate receives the request.
7. Associate opens the request and selects **Accept**, **Request Reschedule**, or **Decline**.
8. Employer receives the Associate's response.
9. Both parties participate in the scheduled interview.
10. Employer records the interview as `Completed`, `Cancelled`, or `No show` and enters remarks.

## Scene 22 — Employer selects the successful Associate

1. After the interview, Employer opens the shortlisted application.
2. Employer selects **Select Associate**.
3. Granvia rechecks all required profile and job conditions.
4. If a document was rejected, replaced, or expired after application, selection is blocked.
5. Employer sees the exact current reason.
6. Associate must correct the requirement and wait for verification before selection can continue.
7. If all requirements pass, application becomes `Selected`.
8. Associate receives `You have been selected`.

Employer may reject unsuccessful shortlisted Associates. Their applications become `Rejected` and they are notified.

## Scene 23 — Employer sends the job offer

1. Employer opens the selected application.
2. Employer selects **Create Offer**.
3. Employer confirms job, site, joining date, shift, wage, payment terms, offer validity, and special conditions.
4. Employer selects **Send Offer**.
5. Offer becomes `Sent`.
6. Associate receives the offer.

## Scene 24 — Associate accepts or rejects the offer

1. Associate opens **My Applications > Offer**.
2. Associate reads every offer term.
3. Associate chooses one of three paths.

### Accept path

1. Associate selects **Accept Offer**.
2. Granvia rechecks eligibility and shift conflicts.
3. Offer becomes `Accepted`.
4. Employer receives the acceptance notification.
5. Both parties move to the job-specific agreement.

### Reject path

1. Associate selects **Reject Offer**.
2. Offer becomes `Rejected`.
3. Employer is notified and may select another applicant.

### Expiry path

1. Associate takes no action before the deadline.
2. Offer becomes `Expired`.
3. Employer may issue a new valid offer or select another Associate.

## Scene 25 — Employer and Associate confirm the job agreement

1. Employer opens the accepted offer.
2. Employer creates the job-specific agreement.
3. Agreement starts as `Draft`.
4. Employer sends the agreement to Associate.
5. Associate opens and reviews the job terms.
6. Associate confirms/signs through the configured method.
7. Agreement becomes `Confirmed` or `Signed`.
8. Granvia automatically synchronizes the application/assignment to `Accepted`.
9. On the joining date, Employer or the approved process confirms joining.
10. Assignment becomes `Joined`.
11. Job vacancy count decreases.
12. When all required positions are filled, job becomes `Filled` and no longer accepts applications.

## Scene 26 — Associate reports to the site and checks in

1. On the duty date, Associate travels to the Employer's site.
2. Associate opens **Attendance**.
3. Associate selects the active assignment.
4. Associate selects **Check In**.
5. Granvia captures current GPS coordinates and timestamp.
6. Granvia calculates distance from the job site's stored coordinates.
7. Granvia checks assignment, shift date/time, existing open attendance, and site geofence.

### If Associate is inside the geofence

1. Check-in is recorded.
2. Attendance becomes `Checked in` or `Pending verification`.
3. Employer receives a check-in notification.

### If Associate is outside the geofence

1. Normal check-in is rejected.
2. Associate sees the distance/location reason.
3. If the business permits exceptions, Associate enters a reason and sends an exception request.
4. Employer or Super Admin reviews that request with an audited decision.

## Scene 27 — Associate completes the shift and checks out

1. At the end of the shift, Associate opens the active attendance record.
2. Associate selects **Check Out**.
3. Granvia captures checkout GPS coordinates and timestamp.
4. Granvia checks geofence and shift rules.
5. Granvia calculates total worked hours using server data.
6. Attendance becomes `Awaiting Employer approval`.
7. Employer receives the checkout/attendance notification.

## Scene 28 — Employer approves or rejects attendance

1. Employer opens **Attendance**.
2. Employer selects the record.
3. Employer sees check-in/out time, GPS distance, calculated hours, and any exception.

### Approval path

1. Employer selects **Approve Attendance**.
2. Granvia checks that checkout exists and payable hours are positive and valid.
3. Attendance becomes `Approved`.
4. Associate receives the approval notification.
5. Approved attendance moves to Employer Payments.

### Rejection/correction path

1. Employer selects **Reject Attendance** or **Request Correction**.
2. Employer enters mandatory remarks.
3. Associate receives the reason.
4. Associate submits an allowed correction or raises a dispute/support request.
5. Employer or Super Admin resolves the issue through an audited action.

Zero-hour or invalid attendance cannot be approved normally. An authorised exception requires mandatory remarks and audit history.

## Scene 29 — Granvia calculates the payment

1. Granvia reads the approved attendance.
2. Granvia reads the agreed job rate.
3. Granvia calculates payable hours, base amount, overtime, approved adjustments, and platform commission.
4. Employer opens **Payments** and sees the calculation.
5. Employer selects the approved unpaid attendance.

## Scene 30 — Employer pays the Associate

### Wallet or digital payment path

1. Employer selects **Pay**.
2. Granvia checks Employer's cleared wallet balance or approved payment method.
3. If balance is insufficient, payment is blocked and Employer must add funds.
4. Backend creates payment as `Pending`.
5. Backend confirms the attendance has not already been paid.
6. In one database transaction, Granvia:
   - Debits Employer.
   - Records platform commission.
   - Credits Associate wallet.
   - Marks the payment completed.
7. If any part fails, all parts roll back.
8. Employer receives a payment receipt.
9. Associate receives a wallet-credit notification.

### Cash payment with OTP path

1. Employer gives cash to Associate.
2. Employer opens the payable attendance and selects **Cash Paid**.
3. Granvia creates a pending cash-payment request.
4. Granvia sends a single-use OTP to the Associate through the verified channel.
5. Granvia reports `OTP sent` only if delivery succeeds.
6. OTP is entered or confirmed through the approved process.
7. Granvia checks OTP, expiry, Employer, Associate, amount, attendance, and duplicate settlement.
8. Payment becomes `Completed` and the reconciliation ledger is recorded.
9. Used OTP cannot be reused.

Employer cannot directly create a completed payment, and the same payable attendance cannot be paid twice.

## Scene 31 — Associate sees earnings in the wallet

1. Associate receives `Payment completed`.
2. Associate opens **Wallet**.
3. Associate sees the credited amount, Employer/job reference, attendance reference, date, and transaction status.
4. If Granvia uses a holding period, the amount first appears as `Pending`.
5. After the holding period and dispute checks, it becomes `Available`.

## Scene 32 — Associate withdraws the earnings

1. Associate opens **Wallet > Withdraw**.
2. Granvia checks verified bank details and available balance.
3. Associate enters the withdrawal amount.
4. Granvia shows minimum/maximum limit, fee, and net amount.
5. Associate confirms the withdrawal.
6. Withdrawal becomes `Requested` or `Processing`.
7. The configured payment provider or authorised Admin processes it.

### Successful withdrawal

1. Withdrawal becomes `Completed`.
2. Associate wallet is debited.
3. Associate receives confirmation.

### Failed withdrawal

1. Withdrawal becomes `Failed`.
2. Reserved funds return to available balance.
3. Associate receives the failure reason and retry guidance.

## Scene 33 — The work continues for recurring shifts

1. For every scheduled shift, Associate repeats check-in and check-out.
2. Employer repeats attendance review.
3. Granvia creates payment only for approved, unpaid attendance.
4. Every payment remains linked to its attendance and assignment.
5. Both Employer and Associate can view complete history.

## Scene 34 — Employer completes and closes the job

1. Final scheduled shift is completed.
2. Employer confirms every attendance record is approved, rejected, or resolved.
3. Employer confirms every payable attendance record is settled.
4. Open disputes are resolved.
5. Employer selects **Complete Job**.
6. Each finished Associate assignment becomes `Completed`.
7. Job becomes `Completed`.
8. After all obligations are finished, Employer or Super Admin selects **Close Job** according to policy.
9. Job becomes `Closed`.
10. No new application, attendance, or payment can be created against the closed job except through an authorised audited correction.
11. Employer and Associate may submit feedback.
12. Records remain available in history according to retention policy.

---

# ALTERNATE CHARACTER ENTRY — SALES EXECUTIVE

## Scene 35 — Sales Executive creates a job for an Employer

If an Employer asks a Sales Executive to create the job:

1. Sales Executive logs in.
2. Sales Executive opens an assigned client.
3. Sales Executive selects **Create Job for Client**.
4. Sales Executive selects the client's verified company and active site.
5. Sales Executive enters the complete job requirements.
6. Sales Executive applies only an authorised discount.
7. Sales Executive selects **Request Employer Confirmation OTP**.
8. Employer receives OTP and confirms that the job details are correct.
9. Granvia verifies OTP, expiry, client, job draft, and Sales Executive scope.
10. Job becomes `Pending approval`.
11. Super Admin reviews it in the normal job approval process.
12. After approval, matching Associates see it in the same way as any Employer-created job.

Sales Executive cannot directly publish an active job.

---

# EXISTING ASSOCIATE STORY

## Scene 36 — Granvia recalculates an existing profile such as Sandesh

1. Granvia runs the approved profile backfill/recalculation.
2. For Sandesh, Granvia checks required profile fields, valid Aadhaar verification source, verified ID proof, verified police verification, and required agreement/consent.
3. If every mandatory requirement passes, Sandesh becomes `Profile verified`.
4. Sandesh can then apply for eligible nearby jobs.
5. If something is missing, Sandesh remains pending and sees the exact requirement.
6. If a required item is rejected, Sandesh sees that rejection and the action required.
7. Employer application screens see the same current reason.
8. An old Employer identity check or generic old profile flag never counts as Aadhaar verification.
9. The backfill result is recorded in audit history.

---

# COMPLETE STORY IN ONE SHORT SEQUENCE

## Scene 37 — Start-to-end summary

```text
Employer signs up
-> Employer completes profile
-> Employer creates company and uploads documents
-> Super Admin verifies company
-> Employer creates site with map location
-> Employer posts job
-> Super Admin approves job
-> Granvia publishes job to Associates whose search circles include the site
-> Associate completes profile, Aadhaar, documents, and agreement
-> Admin verifies documents and profile
-> Associate opens nearby job
-> Granvia checks all application conditions
-> Associate applies
-> Employer receives and reviews application
-> Employer may record application-specific Identity Checked
-> Employer shortlists Associate
-> Employer schedules interview
-> Associate responds and attends interview
-> Employer selects Associate after verification recheck
-> Employer sends offer
-> Associate accepts offer
-> Employer and Associate confirm job agreement
-> Assignment becomes accepted/joined
-> Associate reaches site and checks in inside geofence
-> Associate completes shift and checks out
-> Employer approves attendance
-> Granvia calculates payment
-> Employer pays
-> Granvia debits Employer and credits Associate atomically
-> Associate sees wallet credit
-> Associate withdraws available earnings
-> Shifts repeat until the assignment is complete
-> Employer settles all work
-> Employer completes and closes the job
```

## 38. Rules that remain true throughout the story

1. Only an authorised Aadhaar provider or Super Admin fallback can verify Aadhaar.
2. Employer's **Identity Checked** action belongs only to one job application.
3. Overall Associate profile status is automatically calculated from mandatory checks.
4. A rejected, expired, replaced, or newly uploaded required document returns the profile to a non-verified state until approval.
5. Every approval or rejection requires the correct role and audit history.
6. Only active Super Admin-approved jobs are shown to Associates.
7. Job matching uses the Associate's location/search radius and the site's location.
8. Application eligibility is enforced by the backend, not only by the Apply button.
9. Duplicate applications are blocked.
10. Eligibility is checked again before selection, offer acceptance, and joining.
11. Application, offer, agreement, and assignment statuses remain synchronized.
12. Attendance is tied to the job, shift, time, and site geofence.
13. Only valid approved attendance can be paid.
14. Employer cannot directly mark a payment completed.
15. Employer cannot pay the same attendance twice.
16. Employer debit, commission, Associate credit, and payment completion occur as one transaction.
17. Every important status change notifies the next character and appears in audit history.

