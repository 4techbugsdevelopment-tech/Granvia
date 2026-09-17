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

## Production Risks

- Password policy tightening can block existing weak test/demo credentials and any flows that generate temporary passwords.
- Email/mobile normalization may reveal existing duplicate records that differ only by case/format.
- Adding DB unique indexes for applications or attendance can fail if duplicate historical rows already exist.
- Auto-closing jobs changes employer/admin workflow and must account for all statuses considered "filled".
- Upload validation hardening can reject files that older clients currently upload.
- State/city strict master validation depends on seeded master completeness.
- Financial and attendance changes must be tested with direct API calls; build/lint alone is insufficient.

## Stop Point

Phase 1 audit is complete. Implementation should wait for review/approval and should be done incrementally by module with file list, current behavior, proposed behavior, and compatibility risk before each change.
