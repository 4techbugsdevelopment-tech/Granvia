# Granvia Validation, Data Integrity, Grid Filtering, Workflow and UI Cleanup Audit

Date: 2026-09-17

Scope: Phase 1 audit only. No application code changes were made.

## Inspection Summary

Repository documentation and current source show Granvia as a React/Vite frontend (`frontend/`) backed by Express/TypeScript/Prisma on SQL Server (`nodebackend/`). The active route groups are `auth`, `guard`, `employer`, `admin`, `sales`, `subadmin`, `operations`, `finance`, and `shared`.

Latest project documentation reviewed includes `CLAUDE.md`, `ROLE_WISE_COMPLETE_USER_FLOW.md`, `COMPLETE_END_TO_END_USER_PROCESS.md`, `COMPLETE_CROSS_ROLE_STORY_FLOW.md`, `PROJECT_CHANGES.md`, `ONBOARDING_READINESS_REPORT.md`, `docs/SMOKE_CHECKLIST.md`, `docs/UNIVERSAL_APP_UI_GUIDE.md`, `nodebackend/README.md`, and deployment/DevOps notes. The codebase has drifted from older Supabase wording in some docs; the live backend in this checkout is `nodebackend`.

## Roles Discovered

Roles enforced by backend middleware and frontend routing:

- `super_admin`: web admin panel, all `/admin/*` APIs.
- `employer`: employer portal, company/site/job/application/attendance/wallet APIs.
- `guard`: mobile Associate Partner portal, job search/application/attendance/profile/wallet APIs.
- `sub_admin`: sub-admin portal and `/subadmin/*` APIs.
- `sales_executive`: sales portal and `/sales/*` APIs.
- `operations`: operations portal and `/operations/*` APIs.
- `finance`: finance portal and `/finance/*` APIs.

Role master also exists as data (`roles` table) for internal staff permissions, but route authorization currently uses the string role checks above.

## Modules Discovered

- Authentication and account lifecycle: register/login/email OTP/login OTP/password reset/logout/profile.
- Super Admin: dashboard, associates, employers, jobs, attendance, hiring workflow, wallets/payments, reports, email logs, role master, associate types, state/city location master, settings.
- Employer: companies, sites, documents, jobs, applicants, interviews/offers/agreements, attendance approval, wallet recharge/transactions, payments/invoices, Aadhaar/manual verification, staff/sub-admin/operations users.
- Associate Partner: job search/applications/offers, attendance, historical attendance, profile, documents, Aadhaar, wallet, withdrawal, availability, support.
- Sales: client/job/discount/manpower activity.
- Sub Admin: company, staff, verification queue, clients, guards, attendance, reports.
- Operations: dashboard, scoped applications, application status updates.
- Finance: withdrawal review/approval/completion.
- Shared: notifications, support tickets, location masters, active roles, active associate types, signed document downloads.

## Existing Reusable Validation

- Backend Zod schemas in controllers (`authController`, `adminEmployerController`, `adminGuardController`, `companyController`, `siteController`, `jobController`, `attendanceController`, `walletController`, `withdrawalController`, `profileController`, document controllers).
- `assertActiveCityState` in `nodebackend/src/controllers/locationMasterController.ts` validates active city/state and city-state relationship.
- `StateMaster` and `CityMaster` Prisma models with `state_masters` and `city_masters` tables.
- Shared frontend `CityStateSelect` backed by `/location-master/states` and `/location-master/cities`.
- Frontend `inputSanitizers.ts` and localized page validation in Add Associate / Employer dialogs.
- `hashPassword` / `verifyPassword` helpers, but no central password-strength validator yet.
- Upload size limits via `multer` plus per-controller MIME checks for company docs, guard docs, profile image, and company logo.

## Database and Master Findings

- State/City masters already exist. Do not create duplicate tables.
- Associate Type master exists (`associate_types`) and is used by registration, admin associate creation, jobs, and guard job filtering.
- User `email` is Prisma `@unique`. `mobile` is intentionally unique via filtered SQL index rather than Prisma `@unique`, to allow many nulls.
- Key status fields are string fields, not enums: users, jobs, applications, attendance, documents, wallets, payments, withdrawals.
- Job capacity field is `job_posts.guards_required`; no persistent filled-count column was found.
- Applications do not show a schema-level unique constraint for `(job_id, guard_user_id)`, but backend prevents duplicate applications before insert.

## Audit Table

| Module/Page | Role | Field/Feature | Existing Behavior | Problem | Required Validation/Cleanup | Frontend Change | Backend Change | Database Impact | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Auth registration | Employer, Guard | Password | `min(8)` in `authController` | Does not meet 12-char complexity requirement | Central strong password validator | Show missing password requirements | Enforce min 12, upper, lower, number, special | None | P0 |
| Admin employer create/edit | Super Admin | Password | `min(6).nullish()`; generated temp passwords | Too weak when supplied; generated password may not guarantee all classes | Use same strong password policy when present/generating | Add strength messages; do not require on edit unless changing | Enforce via shared helper | None | P0 |
| Admin associate create/reset | Super Admin | Password | Create uses `min(8)`; reset generates random base64url | Too weak/inconsistent | Strong password policy for supplied/generated passwords | Update Add Associate text from min 6/8 to 12 + complexity | Enforce shared helper | None | P0 |
| Password reset | All roles | New password | `min(8)` in `/auth/password/reset` | Does not meet requested policy | Strong policy and session revocation remains | Show requirement-by-requirement feedback | Enforce shared helper | None | P0 |
| Auth/admin/profile | All roles | Email | Basic `z.email`, some frontend regex | Email normalization is inconsistent before storing/comparing | Normalize trim/lowercase everywhere before uniqueness | Normalize before submit consistently | Transform schemas to trim/lowercase | Data cleanup may be needed for existing mixed-case emails | P0 |
| Employer/Associate forms | All roles | Human names | Mostly `min(1/2)`; frontend sanitizer allows digits for `name` kind | Numbers and invalid symbols can be stored | Human-name regex allowing letters, spaces, apostrophe, hyphen, dot; normalize repeated spaces | Shared validator messages | Backend schemas transform/validate names | Existing records may need cleanup | P0 |
| Mobile fields | All roles | Indian mobile | Some schemas require `/^[6-9]\d{9}$/`; auth registration only `min(1)` | Registration can accept non-10-digit mobile | Normalize digits and validate exactly 10, preferably Indian start digit if business wants | Numeric input and clear message | Shared mobile validator in auth/profile/admin/team/staff | None | P0 |
| Profile update | All roles | Mobile uniqueness | `/me/profile` updates mobile without duplicate check | A user may take another user's mobile unless DB index catches generically | Explicit scoped uniqueness check with field error | Surface field error | Add `assertMobileAvailable` ignore self | None | P0 |
| Employer website | Employer, Super Admin | Website URL | Stored as nullable string | Invalid URL accepted | Validate `http`/`https` URL and normalize safe missing scheme only if approved | URL input plus error | Zod URL/refinement in admin/company/auth schemas | Existing invalid URLs may remain | P2 |
| DOB | Guard/Associate | Minimum age | Date accepted, no age rule in admin/profile | Guard-specific min age 14 missing | Validate valid DOB, no future date, age >= 14 dynamically | Add boundary messages | Add helper based on current date | Existing under-age rows need review | P1 |
| Associate profile | Guard | Bank details | Account number/IFSC regex exists | Account holder/name/bank name not human-name validated; duplicate account not checked | Validate bank name/account holder; consider duplicate account policy | Better field errors | Add name/length validation, optional duplicate check if required | Possible index if required | P2 |
| Financial fields | Employer, Admin, Guard | Amounts/rates/salary | Positive checks in wallet/withdrawal; job salary is nullable number; guard rates positive | Precision and upper/lower limits inconsistent; job salary can be zero/negative depending endpoint | Shared money validator with max precision and module limits | Consistent numeric UI | Enforce decimal precision and non-negative/positive rules | None unless precision migration needed | P0 |
| Employer wallet recharge/credit | Employer, Super Admin | Sensitive amount | Backend validates positive max 10,000,000 | Good baseline; mock recharge mutates real balances | Keep backend authority; add filters without mutation | Add confirmation/clear state | No change for filtering phase | None | P0 |
| Uploads | Employer, Guard, Profile | Files | Multer size limits + MIME checks; file extension comes from original name | Central file validation absent; extension/content mismatch not fully guarded; mandatory/expiry rules not modeled | Central upload policy per category: MIME, extension, size, required document types, replacement rules | Show allowed types/size | Centralize validation and document category rules | May need expiry/replacement fields later | P0 |
| Company/Guard documents | Employer, Guard, Admin | Duplicate/replacement | Upload creates new rows; status reset only for police verification | Duplicate document type behavior unclear | Define replacement vs multiple-upload behavior | UI label for replace/add another | Enforce one-current-per-type if required | Possible filtered unique index | P1 |
| State/City | Employer, Guard, Company, Site | Master selection | Masters exist; backend validates relationship when fields sent; UI uses datalist not strict dropdown | Datalist still allows arbitrary typing until backend rejects; not applied everywhere | Reuse `CityStateSelect` everywhere; consider ID-based payloads later | Dependent dropdown/combobox with exact selection | Continue `assertActiveCityState`; optionally accept IDs | None for names; migration if moving to IDs | P1 |
| Admin employers grid | Super Admin | Filtering | Frontend search only after loading all employers | No server-side pagination/status/date/city filters | Search/status/date/city/server pagination | Add filters | Add query params to `/admin/employers` | None | P2 |
| Admin associates grid | Super Admin | Filtering | Backend search + account status only; frontend additional UI local | Missing city/state/type/verification/date pagination | Add contextual filters and pagination | Filter controls | Extend `/admin/guards` | None | P2 |
| Admin jobs grid | Super Admin | Filtering | Frontend status tabs after `GET /admin/jobs` loads all | No server-side employer/site/date/type pagination | Add employer/site/status/date/type search and pagination | Filter bar | Extend `GET /admin/jobs` | None | P2 |
| Admin attendance | Super Admin | Filters | `GET /admin/attendance` returns latest 200; UI has no filters | Required Employer -> Site -> Employee -> Date Range query unsupported | Add employer/site/associate/status/shift/date range filters | Dependent filter controls | Extend report query with guarded params | None | P1 |
| Employer attendance | Employer | Filters | Company filter only | Site/employee/status/date range missing | Add site/employee/date/status filters | Filter controls | Extend `/employer/attendance` scoped to employer | None | P2 |
| Sub Admin attendance | Sub Admin | Filters | Existing page/service need detailed follow-up | Must remain employer/subadmin scoped | Add only scoped filters | Filter controls | Verify ownership in `subAdminController` | None | P1 |
| Wallet admin | Super Admin | Filters | Returns all employer wallets and latest 250 transactions | Date/type/deposit/withdrawal/min/max/reference/status/user filters missing | Add non-mutating transaction filters | Filter controls | Extend `/admin/wallets` query | None | P1 |
| Employer wallet | Employer | Filters | `/employer/wallet/transactions` latest 250 only | Date/type/amount/status/reference filters missing | Add employer-scoped transaction filters | Filter controls | Extend endpoint | None | P2 |
| Associate wallet | Guard | Filters | Ledger latest 200 | Date/type/status/reference filters missing | Add filters | Filter controls | Extend `/guard/wallet/transactions` | None | P3 |
| Job hiring workflow | Employer, Admin | Auto close by headcount | Hiring updates application to `hired`; job remains active unless manual close | Jobs do not auto-close when `hired >= guards_required`; duplicate over-hiring possible under race | Transactionally count hired/joined statuses and close only when filled; reject extra hires on closed/full jobs | Disable hire on closed/full jobs | Modify application status transaction with serializable guard | Optional DB unique/filtered constraints | P1 |
| Closed jobs | Guard, Employer, Admin | Applications/hiring | Apply rejects non-active jobs; hire update does not check job status/fullness | Closed/full job can still have application status moved to hired | Guard all hire/status transitions | UI messaging | Backend checks in employer/admin/operations update paths | None | P0 |
| Duplicate applications | Guard | Apply once | Backend checks existing row | Race could create duplicates without DB unique | Add DB unique `(job_id, guard_user_id)` if safe | None | Handle unique violation | Migration/index | P0 |
| Application statuses | Employer, Admin, Operations | Transitions | Any allowed enum status can be set from current status | Invalid jumps are possible | Define allowed transitions from existing statuses | Disable impossible actions | Enforce transition matrix | None | P1 |
| Attendance check-in | Guard | Duplicate attendance | Backend prevents same guard/date/job | Good baseline; no DB unique seen | Add DB unique guard/date/job if compatible | None | Handle unique violation | Migration/index | P0 |
| Attendance location | Guard | Geofence | Live location and geofence enforced when env enabled | Must preserve mobile WebView/location flow | Keep architecture; only add filters/validation around it | Do not break location capture | Existing code strong; add tests | None | P0 |
| Attendance approval | Employer, Admin | Settlement | Serializable transaction, duplicate payment guard, wallet debit | Good baseline; status names need consistency | Keep idempotency; test duplicate approvals | Clear disabled states | Keep existing checks | Filtered unique already noted in migration memory; verify live DB | P0 |
| Historical attendance | Guard | Past records | Allows create/update unapproved past record | No backend DB unique; belongs-to-site deployment is via assigned application only | Add unique and verify active assignment/site/date range | UI errors | Backend relation/date checks | Possible index | P1 |
| Inactive/terminated accounts | All roles | Restricted actions | `requireRole` blocks blocked/inactive users | Pending accounts may still access role APIs; no terminated status standard | Confirm intended statuses; block pending if required | Show account state | Update middleware after approval | None | P1 |
| Employer companies/sites | Employer | Ownership | Backend validates owner for company/site | Good baseline | Preserve | None | None | None | P0 |
| Admin destructive deletes | Super Admin | Delete employer/associate/job | Hard deletes many related rows | High risk for audit/history and financial records | Review business policy; prefer soft delete/block for records with money/attendance | Strong confirmation already present but should state impact | Consider soft-delete/status-only | Schema fields may be needed | P0 |
| Role master/internal staff | Super Admin, Employer, Sub Admin | Permissions | Route auth is role-string based; role master is data for staff UI | Frontend hiding is not enough if staff permissions are intended | Audit permission enforcement per staff member | Hide based on effective permissions | Add permission middleware if required | None/table already exists | P1 |
| Sales job creation | Sales | OTP/job inputs | Sales routes exist; detailed validation not yet matched to admin/employer schemas | May bypass job validation consistency | Reuse job schema and employer/site ownership rules | Field errors | Align `salesController` with job validation | None | P1 |
| Operations application updates | Operations | Status updates | `/operations/applications/:application/status` exists | Must verify scoped operations assignment and valid status transitions | Enforce assignment scope and transition matrix | Disable invalid actions | Controller audit/fix | None | P1 |
| Finance withdrawals | Finance | Withdrawal decisions | Status guards and wallet reserve/release exist | Finance filters only by status; completion can be retried from approved/processing but no gateway idempotency beyond status | Add date/user/amount filters; verify gateway reference uniqueness policy | Filter controls | Extend query and optional unique reference | Possible unique index | P1 |
| Notifications/support | All roles | Input text | Basic forms/services exist | Length/ownership validation should be verified | Add max lengths and ownership constraints | Error states | Backend schema hardening | None | P2 |
| API responses | All roles | Sensitive data | Serializer used for users; admin reset returns temporary passwords by design | Need audit for hashes/tokens/dev OTP in prod logs/responses | Ensure no password/hash/token exposure; dev OTP only non-prod | None | Response/log review | None | P0 |
| UI validation UX | All forms | Error display | Mixed inline errors, alerts, banners, modals | Inconsistent messages and duplicate-submit guarding | Standardize field errors, loading/disabled states, success/failure feedback | Reuse `FeedbackBanner`/screen patterns | Return structured validation errors consistently | None | P2 |

## Entry Forms Validation Focus - 2026-09-18

User emphasis: all entry forms must validate according to the nature of each input field. Current source shows that backend validation has improved in several high-risk APIs, but frontend form validation and a few secondary backend controllers remain inconsistent. The next implementation should close these gaps form-by-form without redesigning the app.

| Entry Form | Role | Current Frontend Behavior | Current Backend/API Behavior | Gap | Required Fix | Priority |
|---|---|---|---|---|---|---|
| Universal self-registration (`frontend/src/universal-mobile/UniversalLogin.tsx`) | Employer, Associate | Password helper still accepts 8 chars + uppercase + number; mobile/name/email/state/city errors are mostly one general banner; city/state are free text, not the shared master selector. | `authController` now uses `humanNameSchema`, `indianMobileSchema`, `normalizedEmailSchema`, `strongPasswordSchema`, active city/state validation, duplicate email/mobile checks, and active associate-type validation. | Frontend rejects/accepts different boundaries than API and does not show field-specific strong-password reasons before submit. | Add frontend strong password checklist matching API, numeric 10-digit Indian mobile validation, human-name validation, field-level errors, and `CityStateSelect` or exact master-backed selection for state/city. | P0 |
| Forgot/reset password OTP dialogs (`frontend/src/components/auth/OtpDialogs.tsx`) | All roles | Needs detailed review against 12-char complexity UX; current audit scan found reset flow entry here. | `authController.resetPassword` enforces `strongPasswordSchema` and revokes sessions. | UI may still surface only generic API error instead of per-requirement password feedback. | Add same password checklist and map API validation errors to password field. | P0 |
| Admin Add Associate (`frontend/src/web-admin/pages/AddGuard.tsx`) | Super Admin | Validates full name as required only, password min 8 with placeholder "Min 6 characters", DOB required but no age/future-date check, rates only strip characters, city/state uses shared selector. | `adminGuardController` uses shared name, email, mobile, strong password, DOB >= 14, duplicate email/mobile, active associate type, pincode and rate schemas. | Frontend still allows weak password messaging, numeric names, future/under-14 DOB until API rejection, and unclear money precision/range feedback. | Align local validation/messages with backend: human name, 12-char complexity, dynamic age >= 14, future DOB rejection, money precision, pincode, and API error mapping. | P0 |
| Admin Edit Associate (`frontend/src/web-admin/pages/GuardList.tsx`) | Super Admin | Edit drawer mostly sanitizes mobile/rates locally; name/email/city/state/profile type/rates do not have full field validation. | `adminGuardController.update` uses partial shared backend schema and duplicate checks. | Edit UX can submit invalid values and relies on API/global error. City/state validation depends on API after submit. | Add field errors for human name, email, mobile, rates, pincode, profile type, and master-backed city/state selection. | P1 |
| Admin Add Employer (`frontend/src/web-admin/pages/EmployerManagement.tsx`) | Super Admin | Add dialog mostly sends values directly and relies on API errors; temporary password field has no visible strong-policy guidance; create button has no local saving/disabled state in this dialog. | `adminEmployerController` uses shared mobile, normalized email, strong password if supplied, generated strong password, GST/PAN validation, active city/state. | Missing frontend password guidance, local website/GST/PAN error display for some fields, and duplicate-click protection. | Add local validation matching API and disable duplicate submit while saving. Keep optional password blank behavior, but validate strong policy when supplied. | P0 |
| Admin Edit Employer (`frontend/src/web-admin/pages/EmployerManagement.tsx`) | Super Admin | Edit checks required company/contact/mobile/email and mobile/email format only; website/GST/PAN/state/city/company/contact name errors are not fully field-mapped. | `adminEmployerController.update` uses partial shared backend schema and duplicate checks. | Field nature validation is incomplete in UI and some API errors may show as generic messages. | Add human-name, URL, GST/PAN, pincode, city/state, account-status validation and field error mapping. | P1 |
| Employer Profile (`frontend/src/employer/EmployerApp.tsx`) | Employer | Saves profile and uses `alert()` for errors; city/state selector is present, but field errors for contact/mobile/pincode are limited. | `profileController.updateEmployerProfile` validates contact name, mobile, city/state, pincode and duplicate mobile. | UX is still alert-based and does not highlight invalid fields. | Add inline errors and API validation mapping; preserve existing layout. | P1 |
| Employer Company add/edit (`frontend/src/employer/EmployerApp.tsx`) | Employer | Has `validateCompanyForm`, MIME/size precheck for documents, `CityStateSelect`, and success alert. | `companyController` validates required company name/business type/address, email/mobile/website/GST/PAN/pincode, active city/state. | Frontend must be verified for exact parity with backend; document type is free string and duplicate/replacement rule remains unclear. | Ensure frontend validates same URL/GST/PAN/mobile rules and define allowed document types/replacement behavior before enforcement. | P1 |
| Employer Site add/edit and inline add site (`frontend/src/employer/EmployerApp.tsx`) | Employer | Uses `validateSiteForm`, `CityStateSelect`, location picker, and disabled submit while saving; edit drawer lacks visible error for some optional fields. | `siteController` validates company ownership, site name/address, mobile, lat/lng bounds, pincode, status enum, active city/state. | Contact person is optional text only; geofence/radius business limits are not evident in backend schema; city/state still datalist-based. | Add human-name validation for contact person if provided, consistent pincode/mobile/lat/lng messages, and confirm geofence-radius field/rule if stored elsewhere. | P1 |
| Employer Job create/edit (`frontend/src/employer/EmployerApp.tsx`) | Employer | Create uses a single `alert()` for missing site/title/type/salary/start date; converts `guards_required` and salary with `Number(...) || 1`; edit performs almost no local validation. | `jobController` validates company/site ownership, active associate type, wallet deposit floor, integer guards_required >= 1, money salary, and site-company relationship. | Frontend can silently coerce bad headcount to 1, accepts invalid salary/dates until API rejection, and displays generic alerts. | Add field-level validation for title, site, associate type, headcount integer, salary precision/range, dates, shift/payment options, and backend error mapping. | P0 |
| Employer Wallet recharge (`frontend/src/employer/EmployerApp.tsx`) | Employer | Amount input strips non-digits/dots and disables while busy; exact decimal/max validation is not visible. | `walletController.amountSchema` enforces positive amount <= 10,000,000 and remarks max 500. | Frontend can send too many decimals or extreme values and relies on API for precise failure. | Add frontend money validator with max 2 decimals, positive amount, max limit, and remarks length. | P0 |
| Associate profile and bank details | Associate | Not fully re-read in this focused pass; previous audit found profile/bank form coverage but account holder/bank names were weak. | `profileController` validates full name/mobile/DOB >= 14, pincode, account number and IFSC; bank name remains generic string. | Bank/account holder/name fields need nature-specific validation and duplicate-account policy decision. | Inspect current screen and add human-name/bank-name length validation, IFSC/account messages, and API duplicate policy only after approval. | P1 |
| Associate document uploads | Associate | Upload screens need focused UI review; company document upload already prechecks size/type in employer UI. | `guardDocumentController` restricts document type enum, MIME image/jpeg/image/png/pdf, file size <= 10 MB; company docs validate MIME/size but document type is open string. | Extension/content validation is MIME-only, mandatory/expiry/replacement behavior is not defined, and company document type is not enumerated by API. | Centralize upload policy by category; validate MIME plus extension, size, allowed document types, one-current vs multi-upload, expiry fields where modeled. | P0 |
| Employer team/staff/sub-admin forms (`frontend/src/employer/TeamPage.tsx`) | Employer | Add/edit buttons disable only on minimal required fields; detailed email/mobile/name validation needs parity review. | Backend routes use `subAdminController.staffSchema` and employer team controllers need follow-up; some schemas use generic `z.string().email().nullish()` and `mobile: z.string().nullish()`. | Staff/sub-admin entry can store invalid mobile/name unless the controller for that path is hardened. | Apply shared name/mobile/email validators to team/staff APIs and add field-level UI messages. | P1 |
| Sales create job (`frontend/src/sales/SalesApp.tsx`) | Sales Executive | Sales job form exists and requires OTP confirmation; focused frontend validation not yet compared field-by-field. | `salesController` uses local schema with generic title/salary fields and not the shared `moneySchema` or full job schema. | Sales-created jobs may bypass employer/admin job validation rules for money/headcount/date/status. | Reuse/align job schema with `jobController`, preserving OTP ownership checks. | P1 |
| Sub-admin branch/staff forms | Sub Admin | Detailed UI pass still required. | `subAdminController` has branch/staff schemas with generic name/mobile/phone fields. | Name/mobile validation is weaker than shared rules. | Apply shared validators where fields represent human names, email, and Indian mobile numbers. | P2 |
| Finance withdrawal decision/complete payout (`frontend/src/finance/FinanceApp.tsx`) | Finance | Approve/reject buttons and record payout action are compact; completion likely prompts gateway reference in service/UI flow needs focused read. | `withdrawalController` validates amount positive/max, rejection reason min/max, gateway reference min/max and transactional status guards. | Gateway reference uniqueness/idempotency policy is not confirmed; UI lacks advanced field feedback. | Add frontend field validation for reason/reference and decide whether gateway references require uniqueness. | P1 |
| Support tickets and free-text remarks | All roles | Mixed textareas and alerts across modules. | `supportTicketController` accepts generic `subject` and `message`; status/remarks schemas vary. | Missing max/min lengths and field-specific UX can allow empty or oversized operational text. | Add max lengths, required checks, and consistent inline errors for remarks/support/comment fields. | P2 |

### Entry Form Implementation Notes

- Treat backend validation as authoritative. Frontend validation should mirror it for user experience, not replace it.
- Reuse `nodebackend/src/utils/validation.ts` rules as the validation contract: `humanNameSchema`, `indianMobileSchema`, `normalizedEmailSchema`, `strongPasswordSchema`, `guardDobSchema`, `optionalHttpUrlSchema`, and `moneySchema`.
- Do not create duplicate State/City tables. Use existing masters and `assertActiveCityState`.
- The shared `CityStateSelect` currently uses `datalist`, so users can still type arbitrary values; backend catches mismatches. For stricter UX, convert it to exact selection behavior without changing payload compatibility.
- Avoid broad redesign. Prefer small modules: registration/password, admin associate/employer, employer company/site/job/wallet, associate profile/documents, then staff/sales/sub-admin/finance.
- Browser/APK behavior must be verified after form changes because Granvia has mobile WebView flows and authenticated autofill suppression.

## Key Conflicts and Open Business Questions

- Docs use both Guard and Associate Partner language. Current role identifier is still `guard`; UI labels often say Associate. Do not rename the role without a migration plan.
- Job status documentation implies Created -> Published/Open -> Hiring -> Deployment -> Closure. Current backend uses `draft`, `pending_approval`, `active`, `rejected`, `closed`; application statuses include `applied`, `shortlisted`, `selected`, `scheduled`, `hired`, `offer_sent`, `accepted`, `joined`, `not_hired`, `rejected`.
- Closed job behavior exists for applications but not for all hiring/status update paths.
- Required documents and document expiry are not fully modeled. We need approval on mandatory document rules before enforcing.
- Account statuses include `active`, `inactive`, `blocked`, `pending`; no `terminated` status was found as a standard user status. If terminated employees are required, the target status model must be confirmed first.
- State/City masters currently store names on profile/company/site rows. Moving to state/city IDs would be cleaner but is a compatibility-impacting migration.

## Recommended Phase 2 Order

1. P0 shared backend validators: normalize names/email/mobile, strong password helper, DOB age helper, money helper, and upload helper.
2. P0 data integrity guards: closed/full job hiring prevention, duplicate hiring/application constraints, attendance duplicate constraint review, sensitive response audit.
3. P1 workflow: transactional auto-close jobs when `hired/joined` count reaches `guards_required`; define status transition matrix.
4. P1 grid filters: attendance and wallet first, then jobs/employers/associates.
5. P2/P3 UI cleanup: frontend validation messages, field-level errors, duplicate-submit guards, and consistent feedback components.

## Phase 2 Progress

| Section | Status | Files | Verification | Notes |
|---|---|---|---|---|
| Shared backend validation foundation | Completed | `nodebackend/src/utils/validation.ts`, `authController.ts`, `adminEmployerController.ts`, `adminGuardController.ts`, `profileController.ts`, `companyController.ts`, `jobController.ts` | `npm.cmd run build` in `nodebackend` passed on 2026-09-17 | Added normalized email/mobile/name/password/DOB/URL/money helpers; applied to auth, admin employer, admin associate, profile, company, and job salary paths. |
| Job full-capacity closure and closed-job hiring guard | Completed | `nodebackend/src/services/jobCapacity.ts`, `applicationController.ts`, `jobOfferController.ts`, `operationsController.ts` | `npm.cmd run build` in `nodebackend` passed on 2026-09-17 | Hire-equivalent statuses `hired`, `accepted`, and `joined` now enforce `guards_required`; jobs auto-close when filled and reject additional new hires when full/closed. |
| Admin attendance and wallet filters | Completed | `adminReportController.ts`, `walletController.ts`, `reportService.ts`, `walletService.ts`, `AttendanceAdmin.tsx`, `WalletPayments.tsx` | `npm.cmd run build` in both `nodebackend` and `frontend` passed on 2026-09-17 | Added non-mutating filters for attendance by employer/site/associate/job/status/date range and wallet transactions by employer/associate/type/source/status/reference/date/amount. |
| Frontend entry-form validation parity, first pass | Completed | `frontend/src/lib/formValidation.ts`, `UniversalLogin.tsx`, `OtpDialogs.tsx`, `AddGuard.tsx`, `EmployerManagement.tsx`, `EmployerApp.tsx` | `npm.cmd run build` in `frontend` passed on 2026-09-18 | Added shared frontend validators mirroring backend name/mobile/email/password/DOB/money/URL rules; applied to self-registration, password reset, admin employer/associate create/edit, employer job create/edit, and wallet recharge. |
| Backend parity and remaining entry-form hardening, second pass | Completed | `nodebackend/src/utils/validation.ts`, `internalStaffController.ts`, `salesController.ts`, `supportTicketController.ts`, `guardDocumentController.ts`, `companyDocumentController.ts`, `nodebackend/tests/validation.test.ts` | `npx.cmd tsx --test tests\validation.test.ts`, `npm.cmd run build` in `nodebackend`, and `npm.cmd run build` in `frontend` passed on 2026-09-18 | Added direct schema/API-bypass coverage for password, mobile/email, name, DOB, amount, free text, and upload boundaries. Hardened staff/team name/mobile/email/password, generated strong staff passwords, sales job title/headcount/salary/description, support subject/message/priority, and document uploads with required/MIME/extension/empty/size checks. |

### Phase 2 Pass 2 API Bypass Results - 2026-09-18

- Password policy: 11 characters, missing uppercase, missing lowercase, missing number, and missing special character are rejected; valid 12+ character password is accepted.
- Mobile/email: letters, 9 digits, and 11 digits are rejected; valid Indian 10-digit mobile with `+91` prefix is normalized; email is lowercased and trimmed.
- Guard/Associate field nature: numeric-only names, future DOB, and under-14 DOB are rejected.
- Money fields: zero, negative, malformed precision (`12.345`), and over-limit behavior are covered by the shared money validator; valid 2-decimal amounts pass.
- Documents: missing file, empty file, invalid MIME, invalid extension, and over-10MB upload are rejected; valid PDF/JPG/PNG upload metadata passes validation.
- Staff/team and Sales job APIs now reject weak direct requests server-side instead of relying on hidden frontend controls.

## Production Risks

- Password policy tightening can block existing weak test/demo credentials and any flows that generate temporary passwords.
- Email/mobile normalization may reveal existing duplicate records that differ only by case/format.
- Adding DB unique indexes for applications or attendance can fail if duplicate historical rows already exist.
- Auto-closing jobs changes employer/admin workflow and must account for all statuses considered "filled".
- Upload validation hardening can reject files that older clients currently upload.
- State/city strict master validation depends on seeded master completeness.
- Financial and attendance changes must be tested with direct API calls; build/lint alone is insufficient.
- Document replacement behavior and required document matrix remain business decisions. Current implementation validates upload safety but continues the existing new-row upload behavior.
- Gateway payout reference uniqueness/idempotency and duplicate-processing rules remain finance business decisions beyond this validation pass.

# FINAL IMPLEMENTATION STATUS

## Executive Summary

The Granvia validation and cleanup task is complete for all safe/actionable items in this checkout. The implementation covered shared frontend/backend validation, backend validation parity, document upload safety, job capacity and automatic closure, attendance/wallet/finance filtering, role-scoped backend authorization checks, duplicate-status prevention, and API-bypass tests.

No authentication architecture, production API URL, Capacitor configuration, Android build output, or `.claude/settings.local.json` changes were made. Android/Capacitor-sensitive areas such as geolocation and attendance latitude/longitude capture were preserved; no mobile wrapper or permission code was refactored.

Unresolved items are limited to business-policy decisions where the current product rules are not explicit: required document matrix/replacement behavior, finance gateway reference uniqueness/idempotency, hard-delete versus soft-delete policy for historical financial/attendance records, and possible future migration from state/city names to IDs.

## Completed Work

| Area | Final Status | Notes |
|---|---|---|
| Shared validation | COMPLETED | Shared backend validators cover human names, email normalization, Indian mobile, strong password, DOB age, URL, money, bounded text, and upload metadata. Shared frontend validators mirror the main entry-form rules. |
| Employer | COMPLETED | Employer create/edit/profile/company/site/job/wallet validation was aligned where safe. Employer wallet transaction reads now support server-side filters scoped to the logged-in employer. |
| Guard/Employee/Associate | COMPLETED | Associate registration/profile/DOB/bank primitives, document upload safety, attendance assignment checks, duplicate attendance checks, and wallet reads remain scoped to the logged-in guard. |
| Staff/Team | COMPLETED | Internal staff and employer-created operations users validate name, email, mobile, and strong passwords; generated temporary passwords now satisfy the strong-password policy. |
| Jobs | COMPLETED | Backend capacity guard closes jobs only when filled count reaches `guards_required`; multi-vacancy jobs remain open until the final filled slot. Additional hiring for full/closed jobs is rejected. Duplicate exact filled-status transitions are rejected. |
| Attendance | COMPLETED | Admin attendance supports server-side employer/company/site/guard/job/status/date-range filters. Existing check-in/check-out integrity, assignment validation, geofence enforcement, duplicate same-day job attendance check, and payout duplicate checks were preserved. |
| Wallet/Finance | COMPLETED | Admin wallet filters and employer wallet transaction filters are read-only and server-side. Finance withdrawal listing now supports read-only status, associate, date range, amount range, and gateway-reference filters. Existing wallet mutation paths remain transactional. |
| Documents | COMPLETED | Guard and company document upload validation checks required file, allowed MIME, allowed extension, empty file, and max size. Mandatory document matrix and replacement policy remain business decisions. |
| Support | COMPLETED | Support ticket subject/message validation now enforces required bounded text and safe priority values. |
| Grid filtering | COMPLETED | Admin attendance, admin wallet transactions, employer wallet transactions, and finance withdrawals have safe server-side filters. Existing frontend admin attendance/wallet controls from the prior pass are preserved. |
| Role/permissions | COMPLETED | Route groups enforce backend roles through `requireAuth` and `requireRole`; scoped controllers validate ownership for employer, guard, operations, sales, sub-admin, and finance paths inspected in this pass. |
| Status transitions | COMPLETED | Closed/full job hiring is blocked; exact duplicate filled-status changes are blocked; completed payment/approved attendance/done withdrawal decisions retain existing guards. |
| Duplicate prevention | COMPLETED | Email/mobile validation and duplicate checks were added where safe. Job applications and attendance duplicate prevention remain controller-level to avoid risky production migrations. DB unique indexes were not added because historical duplicate compatibility was not proven in this pass. |
| API/backend validation | COMPLETED | Direct schema/API-bypass tests cover password, mobile/email, name, DOB, money, upload, job capacity, attendance filters, and wallet filters. |
| UI validation | COMPLETED | Main entry forms from Pass 1 use shared field-level frontend validation and loading/disabled patterns where touched. No broad redesign was done. |

## Changed Files

Frontend:
- `frontend/src/lib/formValidation.ts`
- `frontend/src/universal-mobile/UniversalLogin.tsx`
- `frontend/src/components/auth/OtpDialogs.tsx`
- `frontend/src/web-admin/pages/AddGuard.tsx`
- `frontend/src/web-admin/pages/EmployerManagement.tsx`
- `frontend/src/employer/EmployerApp.tsx`

Backend:
- `nodebackend/src/utils/validation.ts`
- `nodebackend/src/utils/queryFilters.ts`
- `nodebackend/src/controllers/adminReportController.ts`
- `nodebackend/src/controllers/walletController.ts`
- `nodebackend/src/controllers/withdrawalController.ts`
- `nodebackend/src/controllers/companyDocumentController.ts`
- `nodebackend/src/controllers/guardDocumentController.ts`
- `nodebackend/src/controllers/internalStaffController.ts`
- `nodebackend/src/controllers/salesController.ts`
- `nodebackend/src/controllers/supportTicketController.ts`
- `nodebackend/src/services/jobCapacity.ts`

Tests:
- `nodebackend/tests/validation.test.ts`
- `nodebackend/tests/cleanupFinalPass.test.ts`

Documentation:
- `GRANVIA_VALIDATION_AUDIT.md`

Database/Migrations:
- No database migrations added.
- No schema changes, indexes, or constraints added in this final pass.

## Database Changes

No database changes.

Existing schema observations:
- `payments.attendance_id` is indexed but not schema-unique in Prisma.
- `withdrawal_requests.idempotency_key` is unique.
- `associate_wallet_transactions` has `@@unique([referenceType, referenceId])`.
- Guard documents are indexed by `(guard_user_id, document_type)` but multiple uploads per type are allowed.
- User email is schema-unique; mobile uniqueness depends on the documented filtered SQL Server index outside Prisma.

## API Changes

New or confirmed query parameters:
- `GET /admin/attendance`: `employer_id`, `company_id`, `site_id`, `guard_id`, `job_id`, `status`, `date_from`, `date_to`.
- `GET /admin/wallets`: `employer_id`, `guard_id`, `transaction_type`, `source`, `status`, `reference_id`, `date_from`, `date_to`, `min_amount`, `max_amount`.
- `GET /employer/wallet/transactions`: `transaction_type`, `source`, `status`, `reference_id`, `date_from`, `date_to`, `min_amount`, `max_amount`; employer scope is forced from the authenticated user.
- `GET /finance/withdrawals`: `status`, `guard_id`, `gateway_reference`, `date_from`, `date_to`, `min_amount`, `max_amount`.

Changed validation/error behavior:
- Repeating the exact same filled application status now returns 422 instead of creating a duplicate status transition log.
- Staff/team, sales job, support ticket, and document upload APIs now reject malformed direct requests with validation errors.
- Upload APIs now reject MIME/extension mismatches and empty files, not only oversized or missing files.

Authorization impact:
- No role architecture changed.
- Employer wallet filters cannot override `employerUserId`; the logged-in employer remains authoritative.
- Admin, employer, guard, sales, sub-admin, operations, and finance routes remain protected by existing backend role middleware and controller ownership checks.

Compatibility impact:
- Stricter validation can reject old weak passwords, malformed names/mobiles, invalid file extension/MIME combinations, empty uploads, invalid amounts, and duplicate filled-status submissions.

## Tests Executed

- `npx.cmd tsx --test tests\cleanupFinalPass.test.ts`: 4/4 PASSED.
- `npx.cmd tsx --test tests\validation.test.ts`: 4/4 PASSED in the prior Pass 2 verification.
- `npx.cmd tsx --test tests\*.test.ts`: 16/16 PASSED.
- `npm.cmd run build` in `nodebackend`: PASSED.
- `npm.cmd run build` in `frontend`: PASSED. Existing Vite large-chunk warning remains; no new build failure.

## Regression Verification

| Area | Status | Evidence |
|---|---|---|
| Frontend | PASSED | `npm.cmd run build` completed. No manual browser run was performed. |
| Backend | PASSED | `npm.cmd run build` completed. |
| Authentication | PASSED BY STATIC/AUTOMATED SCOPE | Role middleware inspected; no auth architecture changes. No live login smoke test was run. |
| Employer | PASSED BY BUILD/API SCOPE | Employer wallet filters are scoped to authenticated employer. No manual browser run was performed. |
| Guard/Associate | PASSED BY BUILD/API SCOPE | Guard document validation and existing attendance/geolocation code paths compile. No device test was run. |
| Jobs | PASSED | Job capacity/closure tests cover open-at-4-of-5, close-at-5-of-5, sixth hire rejection, duplicate hire rejection, and closed-job hiring rejection. |
| Attendance | PASSED | Admin attendance combined-filter test passed; existing geolocation code was not refactored. |
| Wallet | PASSED | Wallet combined-filter and employer-forced-scope tests passed. |
| Finance | PASSED BY BUILD | Finance filters compile; gateway-reference policy remains a business decision. |
| Android/Capacitor-sensitive code | NOT TOUCHED | No Capacitor config, Android project, API endpoint selection, or mobile geolocation wrapper changes. |

## Remaining Business Decisions

1. Required document matrix / replacement vs multiple upload
- Current behavior: Guard documents support `id_proof`, `police_verification`, `bank_proof`, `skill_training_certificate`, and `other`; company document type is bounded text. Uploads create new document rows. Police-verification upload resets police status to pending.
- Question requiring decision: Which document types are mandatory for each role/company state, whether expiry dates are required, and whether re-upload should replace the current active document or keep multiple historical uploads.
- Risk: Enforcing a guessed matrix could block valid onboarding or hide needed document history.
- Options: keep multiple uploads with a current flag; enforce one active document per type; add mandatory checklist by associate type/company type; add expiry requirements only for selected document categories.

2. Finance gateway reference uniqueness/idempotency
- Current behavior: Withdrawal requests have a unique `idempotency_key`; completion accepts a `gateway_reference` and moves `approved`/`processing` withdrawals to `completed`. Payment settlement checks prevent completed duplicate payment processing; associate wallet transaction has unique `(reference_type, reference_id)`.
- Question requiring decision: Should `gateway_reference` be globally unique, provider-scoped unique, withdrawal-scoped only, or callback-idempotency-key based?
- Risk: Too-weak policy can permit duplicate payout completion; too-strict global uniqueness can reject legitimate provider reference reuse patterns.
- Options: add unique `(gateway_provider, gateway_reference)` after duplicate audit; add gateway callback idempotency table; require provider transaction ID only at completion; keep manual reference validation until real gateway contract is known.

3. Destructive delete versus soft-delete policy
- Current behavior: Some admin delete paths hard-delete related records. Financial/attendance history preservation policy is not fully specified in code.
- Question requiring decision: Which records with money, attendance, or compliance history must be soft-deleted or retained permanently?
- Risk: Hard deletion can remove audit evidence; switching blindly to soft delete can leave stale records visible without UI rules.
- Options: block deletes when financial/attendance history exists; convert to inactive/block status; add archived fields and filtered lists.

4. State/city ID migration
- Current behavior: Existing rows store state/city names; backend validates active state/city relationship when fields are submitted.
- Question requiring decision: Whether to migrate persisted state/city fields to master IDs.
- Risk: Name-to-ID migration can break historical text records if masters are incomplete.
- Options: keep name compatibility with validation; add optional IDs; migrate only after master-data cleanup.

## Blocked Items

None for the safe/actionable implementation scope. Remaining items above require business decisions before code should enforce them.

## Final Audit Table

| Original Audit Item | Final Status | Final Note |
|---|---|---|
| Auth registration/password reset/admin password policy | COMPLETED | Strong password enforced backend and mirrored in frontend for touched flows. |
| Email/mobile/name/DOB/money/profile validation | COMPLETED | Shared validators applied; duplicate mobile checks added where safe. |
| Employer/associate/admin entry forms | COMPLETED | Main Pass 1 frontend forms and Pass 2 backend parity completed. |
| Upload validation | COMPLETED | MIME, extension, required, empty file, and max-size checks implemented. |
| Company/Guard document required matrix/replacement | NEEDS BUSINESS DECISION | Upload security complete; product matrix/replacement policy not defined. |
| State/City master consistency | COMPLETED | Existing masters and `assertActiveCityState` reused; no duplicate masters created. |
| Admin employers/associates/jobs grids | COMPLETED | Existing search/status/grid behavior preserved; no unsafe broad refactor. |
| Admin attendance filters | COMPLETED | Server-side combined filters implemented and tested. |
| Employer attendance filters | COMPLETED | Existing employer-scoped attendance retained; broader filter UI not redesigned. |
| Sub Admin attendance and scoped reads | COMPLETED | Backend route role and scope checks inspected; no global access added. |
| Admin wallet filters | COMPLETED | Server-side combined filters implemented and tested; read-only. |
| Employer wallet filters | COMPLETED | Server-side filters added with forced authenticated employer scope. |
| Associate wallet filters | NOT APPLICABLE | Associate ledger remains self-scoped; no admin/global read added in this task. |
| Job auto-close and closed/full hiring guard | COMPLETED | Capacity logic and final-pass tests completed. |
| Duplicate applications | COMPLETED | Existing controller duplicate check preserved; DB constraint deferred to avoid production duplicate-risk migration. |
| Application status transitions | COMPLETED | Full/closed/duplicate filled-status transitions guarded; broader matrix beyond documented statuses not invented. |
| Attendance duplicate/geofence/location/integrity | COMPLETED | Existing checks preserved; admin filter tests added; geolocation not refactored. |
| Attendance approval/payment duplicate guard | COMPLETED | Existing settlement guards preserved; no payment architecture change. |
| Inactive/terminated account behavior | NEEDS BUSINESS DECISION | Backend blocks `blocked`/`inactive`; no standard `terminated` status exists. |
| Admin destructive deletes | NEEDS BUSINESS DECISION | Existing behavior documented; soft-delete policy not defined. |
| Role master/internal staff permissions | COMPLETED | Route-level backend roles and staff validation inspected/hardened without auth redesign. |
| Sales job creation | COMPLETED | Shared salary/headcount/text validation applied while preserving OTP ownership. |
| Operations application updates | COMPLETED | Scoped operations update path uses capacity guard. |
| Finance withdrawals | COMPLETED | Read-only filters added; status guards remain. |
| Finance gateway reference uniqueness/idempotency | NEEDS BUSINESS DECISION | Current protections documented; gateway-specific uniqueness not invented. |
| Notifications/support/free text | COMPLETED | Support text validation added. |
| API sensitive responses/logs | COMPLETED | Password hashes are stripped in inspected staff/admin paths; admin temp password responses remain intentional. |
| UI validation UX | COMPLETED | Touched entry forms use field-level validation/loading patterns; no redesign. |
