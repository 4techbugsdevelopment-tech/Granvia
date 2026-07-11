# Project Changes — SRS Re-Audit (2026-07-10)

> Audit of the Granvia codebase against the updated SRS (Security Guard Provider App).
> **No code was modified in this pass.** This file is the working task list for the next development phase.

---

## 1. Audit Summary

**Tech stack found:**

| Layer | Reality in repo |
|---|---|
| Backend | **Laravel** (`backend/`) — Sanctum bearer-token auth, UUID keys, 20 domain migrations, role middleware (`EnsureRole`), controllers per domain. This replaced Supabase. |
| Frontend | React 18 + TypeScript (Vite) SPA (`frontend/`) — three portals: `/admin` (web-admin), `/guard` (mobile-guard), `/employer` |
| DB schema | `backend/database/migrations/` — users, guard_profiles, employer_profiles, employer_companies, company_sites, company_documents, job_posts, job_applications, interview_requests, job_offers, agreements, attendance_records, employer_wallets, wallet_transactions, payments, invoices, notifications, support_tickets, aadhaar verifications |
| Legacy | `supabase/` folder + `frontend/src/lib/storage.ts` (localStorage mock) still present. **Several live screens still render mock localStorage data** (see §3) |
| Deploy | Netlify config for frontend; Laravel run via `artisan serve` locally (`DEPLOYMENT.md` predates Laravel move) |

**Panels that exist in code:** Guard, Employer, Admin.
**Panels with zero code:** Sales Executive, Sub Admin (the `users.role` enum is only `super_admin | employer | guard` — `backend/database/migrations/0001_01_01_000000_create_users_table.php`).

**Supabase → Laravel migration status:** All 19 frontend service files (`frontend/src/services/*.ts`) now call the Laravel API via `frontend/src/lib/apiClient.ts` (axios + Bearer token). Zero remaining Supabase imports. **However**, 7 UI screens were never rewired and still read the localStorage mock:

- Guard: `MobileDashboard.tsx`, `AttendanceScreen.tsx`, `ApplicationsScreen.tsx`, `ProfileScreen.tsx`
- Admin: `Dashboard.tsx`, `GuardList.tsx`, `AddGuard.tsx`

**Third-party integrations status:**

| Integration | Status |
|---|---|
| Aadhaar verification API (client-provided) | **Mocked.** Real flow is a self-generated 6-digit OTP emailed via Laravel SMTP (`AadhaarVerificationController.php`, `AadhaarOtpMail`). Returns `dev_otp` in debug mode. Employer-only; no guard Aadhaar flow. No external Aadhaar provider called. |
| Google Maps API (client-provided) | **Not wired.** Map system uses Leaflet (`VITE_MAP_PROVIDER=leaflet`); Google branch in `frontend/src/components/map/MapView.tsx` is a commented stub. `VITE_GOOGLE_MAPS_API_KEY` is an empty placeholder in `frontend/.env.example`. |
| Payment Gateway (client-provided) | **Absent.** `VITE_PAYMENT_GATEWAY_PUBLIC_KEY` placeholder only; no gateway SDK in either `package.json` or `composer.json`; no charge/withdraw endpoints. |
| SMS OTP API (client-provided) | **Absent.** No SMS provider anywhere. Email works (Laravel mailer: Aadhaar OTP, welcome mail, email verification). |

**Overall completion vs this SRS: roughly 40%.** The employer panel and the auth/job/application core are solid; the guard panel is half mock; wallet/payments/coins, availability, feedback, all reports, and two entire panels (Sales Executive, Sub Admin) do not exist.

---

## 2. Already Implemented (No Action Needed)

### Cross-cutting / Auth
- [x] Multi-portal login with role check + portal mismatch rejection — `backend/app/Http/Controllers/Auth/AuthController.php`, `backend/routes/api/auth.php`
- [x] Guard + Employer registration with email verification links — `AuthController::registerGuard/registerEmployer/verifyEmail`
- [x] Blocked/inactive accounts rejected at login (`account_status !== 'active'` → 403) — `AuthController::login`
- [x] Token auth + auto-logout on 401 — `frontend/src/lib/apiClient.ts`, `frontend/src/context/AuthContext.tsx`
- [x] Notifications (list / mark read) — `NotificationController.php`, `frontend/src/services/notificationService.ts`
- [x] Support tickets — `SupportTicketController.php`, `frontend/src/services/supportService.ts`
- [x] File storage + signed download URLs — `backend/app/Services/FileStorageService.php`, `FileDownloadController.php`

### Guard panel
- [x] Job search (text + day/night shift filter) with live API data — `frontend/src/mobile-guard/screens/JobSearch.tsx`, `GET /api/jobs`
- [x] Apply for job + duplicate-application guard — `POST /api/guard/jobs/{job}/apply`, `ApplicationController::apply`
- [x] Map view of jobs with radius circle (Leaflet, visual) — `frontend/src/components/map/JobRadiusMap.tsx`

### Employer panel
- [x] Multiple companies CRUD + logo upload — `CompanyController.php`, `backend/routes/api/employer.php`
- [x] Multiple sites per company CRUD (with lat/lng via LocationPicker) — `SiteController.php`, `frontend/src/components/map/LocationPicker.tsx`
- [x] Company document upload (KYC docs) — `DocumentController.php`
- [x] Job posting CRUD (guards required, experience, skills, languages, duty hours, shift, duration type) — `JobController.php`, `job_posts` migration
- [x] View applicants + accept/reject (status update) — `ApplicationController::employerIndex/updateStatus`
- [x] Interview ("Call") requests: create / list / status workflow — `InterviewRequestController.php`, `InterviewsPage` in `frontend/src/employer/EmployerApp.tsx`
- [x] Job offers + agreements (create / list / update) — `JobOfferController.php`, `AgreementController.php`
- [x] Attendance verification (view records, update status + remarks) — `AttendanceController.php`
- [x] Payments records + invoices listing (filterable by company) — `PaymentController.php`, `InvoiceController.php`
- [x] Wallet balance + transaction statement (read-only) — `WalletController.php`
- [x] Employer Aadhaar OTP flow (as currently designed: email OTP) — `AadhaarVerificationController.php`
- [x] Dashboard counts (jobs/applications/attendance/payments) — `ReportController::counts`

### Admin panel
- [x] Job approval workflow (pending / approve / reject / delete) — `backend/routes/api/admin.php`, `frontend/src/web-admin/pages/JobApprovals.tsx`
- [x] Employer CRUD (create with temp password, edit, cascade delete) — `backend/app/Http/Controllers/Admin/EmployerController.php`, `frontend/src/web-admin/pages/EmployerManagement.tsx`
- [x] **Employer** block/unblock end-to-end (admin UI toggle → `account_status` → login rejection) — `EmployerManagement.tsx:153`, `EmployerController::update`

---

## 3. Partially Implemented — Needs Fixing

### Guard panel

**3.1.1 Profile management** ⚠️
- SRS: view/edit name, address, experience, **qualification**, skills; upload ID proof, police verification, bank details.
- Exists: `guard_profiles` table has address, skills, languages, experience, bank fields, avatar; avatar upload endpoint.
- Missing/broken:
  - `ProfileScreen.tsx` renders the **localStorage mock** (`lib/storage.ts`), not API data.
  - No API endpoint to update the guard profile — `ProfileController::update` only allows `full_name`/`mobile` on `users`; there is no `updateGuardProfile` (employer has one, guard doesn't).
  - **No `qualification` column** on `guard_profiles`.
  - **No guard document upload endpoint** (ID proof / police verification / bank proof). `FileStorageService` supports a `guard-documents` bucket concept but nothing calls it.
- Files: `frontend/src/mobile-guard/screens/ProfileScreen.tsx`, `backend/app/Http/Controllers/ProfileController.php`, `backend/database/migrations/2026_07_03_100002_create_guard_profiles_table.php`

**3.1.2 Verification (Aadhaar + police doc)** ⚠️
- SRS: Aadhaar API integration for guards; police verification via uploaded scan (manual review, no API).
- Exists: Aadhaar OTP flow **for employers only**, and it's an email-OTP simulation, not the client's Aadhaar API. `guard_profiles.aadhaar_status` / `police_verification_status` columns exist but nothing sets them.
- Missing: guard-facing Aadhaar flow; real Aadhaar API call; police-doc upload + admin review that flips `police_verification_status`.
- Files: `backend/app/Http/Controllers/AadhaarVerificationController.php`, `backend/routes/api/guard.php` (no verification routes)

**3.1.3 Location & radius** ⚠️
- SRS: set residential location via map or pin code; define search radius in km.
- Exists: `guard_profiles.latitude/longitude/pincode` columns; reusable `LocationPicker` component (used only in employer site form); radius slider in JobSearch.
- Missing: guard UI + API to set/save residential location; persisted radius preference (slider resets to 10 km each visit and is map-view-only).
- Files: `frontend/src/mobile-guard/screens/JobSearch.tsx:16`, `frontend/src/components/map/LocationPicker.tsx`

**3.1.4 Job search & application** ⚠️
- SRS: search within radius; filter by duration (4/6/8/12hr + overtime) and type (Regular/Monthly/Weekly/Daily); apply for jobs matching skill set.
- Exists: text search + Day/Night filter; apply works; job detail sheet shows duration/experience; `job_posts` already stores `duty_hours`, `duration_type`, `payment_type` so the data model supports the filters.
- Missing: **radius does not filter the job list** (only draws a circle on the map — `JobSearch.tsx:32-44` has no distance check, `geoUtils.distanceKm()` exists but is unused here); no duration/type filter UI; no skill-match check on apply (server accepts any application).
- Files: `frontend/src/mobile-guard/screens/JobSearch.tsx`, `frontend/src/lib/geoUtils.ts`, `backend/app/Http/Controllers/JobController.php`

**3.1.6 Job time logging (guard side)** ⚠️→❌ functionally
- SRS: guard inputs in-time and out-time per job.
- Exists: `attendance_records` has `in_time`, `out_time`, `total_hours`, `guard_remarks`; employer verification side works.
- Missing: **no guard API route** to create/log attendance (`backend/routes/api/guard.php` has only apply/applications); `AttendanceScreen.tsx` is a localStorage mock. Nothing in the live system ever creates an attendance record from the guard side.
- Files: `frontend/src/mobile-guard/screens/AttendanceScreen.tsx`, `backend/app/Http/Controllers/AttendanceController.php`, `backend/routes/api/guard.php`

**Guard screens on mock data** ⚠️ (blocks everything above)
- `MobileDashboard.tsx` and `ApplicationsScreen.tsx` also read `lib/storage.ts` even though real endpoints exist (`GET /api/guard/applications`). The deployed guard app shows fake data outside of Job Search.

### Employer panel

**3.2.1 Billing by site or company** ⚠️
- Exists: invoices/payments filterable by `company_id`; `billing_address` on companies.
- Missing: per-**site** billing filter (`invoices`/`payments` querying has no `site_id` param in `InvoiceController`/`PaymentController`), and no billing summary view grouped by site/company.

**3.2.2 Job posting — qualification** ⚠️
- Exists: guards required, experience, language skills, skills.
- Missing: **qualification** field (e.g., "12th pass") on `job_posts` and in the posting form.

**3.2.3 Guard interaction** ⚠️
- Exists: view applicants; accept/reject; "Call" interview request workflow (`request_type` defaults to `Phone Call`, has preferred date/time + status).
- Missing: **"View available guards"** — no endpoint or screen for employers to browse the guard pool (depends on availability posting, §4); no actual telephonic/video call integration (requests are tracked, calls happen off-platform — confirm if that's acceptable, see §5).

**3.2.4 Job time verification** ⚠️
- Employer verify flow is complete, but it verifies records that nothing creates (guard logging missing) — end-to-end flow is broken until 3.1.6 is fixed.

**3.2.6 Wallet operations** ⚠️
- Exists: view balance + statement.
- Missing: withdraw to bank (payment gateway), and any way for balance to change (no credit/debit endpoints — `WalletController` is read-only; `wallet_transactions` are never written).

### Admin panel

**3.4.2 Account management** ⚠️
- Exists: employer view/block/unblock fully working.
- Missing: **guard** account management — no `GET/PATCH /api/admin/guards` routes; `GuardList.tsx` and `AddGuard.tsx` are localStorage mocks. Admin cannot see or block real guards.

**Admin dashboard** ⚠️
- `web-admin/pages/Dashboard.tsx` reads the localStorage mock; `ReportController::counts` exists but is mounted under `employer/` routes only — admin has no stats endpoint.

---

## 4. Not Implemented — Net New Work

### Guard panel

1. **Availability posting (SRS 3.1.5)** — ❌ 🆕
   - SRS: "Set availability schedule: Duration 4hr/6hr/8hr/12hr; Frequency Regular/Weekly/Daily."
   - No table, route, or UI anywhere (`availab*` has zero matches in backend).
   - Approach: `guard_availabilities` table (guard_user_id, duration, frequency, days/dates, active flag) + guard CRUD routes + screen; feeds employer "view available guards" (3.2.3) and admin area-wise availability report (3.4.1).
   - Depends on: nothing external. **Complexity: Medium**
   - 🆕 Note: not present in the earlier project timeline (CLAUDE.md §18) — likely new in this SRS revision.

2. **Guard wallet + coin withdrawal (SRS 3.1.7)** — ❌
   - SRS: "Withdraw coins to bank account (Payment Gateway provided by client); view wallet statement."
   - Wallets are employer-only (`employer_wallets`). No coins concept, no guard wallet, no withdrawal.
   - Approach: generalize wallets to any user (or add `guard_wallets`), coin ledger in `wallet_transactions`, withdrawal request flow (request → admin/gateway payout → status), bank details already on `guard_profiles`.
   - Depends on: **Payment Gateway credentials (client)**; coin↔INR conversion rule (§5 Q1). **Complexity: Large**

### Employer panel

3. **Wallet charging / daily clearing (SRS 3.2.5)** — ❌
   - SRS: "Charge wallet before end of day; clear account daily."
   - Approach: wallet top-up via payment gateway + daily job-cost debit (scheduled command `php artisan schedule` + Laravel queue), transaction records per attendance-verified day.
   - Depends on: **Payment Gateway (client)**; clearing rules (§5 Q2). **Complexity: Large**

4. **In-cash payment with guard OTP confirmation (SRS 3.2.5)** — ❌
   - Approach: employer marks "paid in cash" on a payment → OTP sent to guard (SMS or in-app) → guard confirms receipt → payment marked confirmed. Reuse the OTP pattern from `AadhaarVerificationController`.
   - Depends on: **SMS/Email OTP API (client)** if SMS required. **Complexity: Medium**

5. **Feedback form (SRS 3.2.7)** — ❌ 🆕
   - No feedback table/route/UI (support tickets exist but are a different concept).
   - Approach: `feedbacks` table (employer_user_id, guard_user_id nullable, job_id nullable, rating, comments) + employer form + admin listing.
   - **Complexity: Small**

6. **View available guards (SRS 3.2.3)** — ❌
   - Approach: `GET /api/employer/guards/available` filtered by availability (item 1), location radius, skills; employer browse screen.
   - Depends on: item 1. **Complexity: Medium**

### Sales Executive panel — ❌ entire panel 🆕

7. **Sales Executive role + panel (SRS 3.3)** — nothing exists; `role` enum has no `sales_executive`.
   - 🆕 This panel appears nowhere in the earlier project timeline (CLAUDE.md §18 lists Guard/Employer/Admin/Sub-Admin only) — almost certainly a **new addition in this SRS revision**.
   - 3.3.1 View client profiles — new role + `GET /api/sales/clients` + minimal portal shell. **Medium** (includes role plumbing: enum migration, middleware, login portal)
   - 3.3.2 Post jobs on behalf of client **with OTP confirmation** — job form reusing employer job posting + OTP to the client (SMS/Email) before publishing. Depends on **SMS/Email API (client)**. **Medium**
   - 3.3.3 Apply discounts to employer billing — `discounts` table (or fields on invoices) + rules. Depends on discount rules (§5 Q4). **Medium**

### Admin panel

8. **Reports (SRS 3.4.1)** — ❌
   - Area-wise guard availability — needs items 1 + guard location (3.1.3). **Medium**
   - Guards with English proficiency — `guard_profiles.languages` exists; needs report endpoint + UI. **Small**
   - Commission earnings — **no commission concept exists anywhere** (no rate, no ledger). Needs commission model (rate config, per-payment commission record) before it can be reported. Depends on §5 Q3. **Large**

9. **Admin guard management API + real screens** — ❌ (backend) / mock (frontend)
   - `GET/POST/PATCH /api/admin/guards` incl. block/unblock via `account_status` (login check already enforces it); rewire `GuardList.tsx`, `AddGuard.tsx`. **Medium**

### Sub Admin panel — ❌ entire panel

10. **Sub Admin role + panel (SRS 3.5)** — no `sub_admin` role, no UI, no staff tables.
    - 3.5.1 Manage own company details
    - 3.5.2 Add/edit/delete staff members — needs a `staff` concept/table
    - 3.5.3 Manage own clients and own security guards — needs an ownership/assignment model (which guards/clients "belong" to a sub admin)
    - This was in the earlier timeline (pre-existing requirement, not new) but scope conflicts with the current marketplace model — see §5 Q5. **Complexity: Large**

### Integrations (client-provided — all currently placeholder/mock)

11. **Real Aadhaar API** — replace email-OTP simulation in `AadhaarVerificationController` with client's provider; extend to guards. Depends on **client API credentials + docs**. **Medium**
12. **Google Maps** — implement `google/GoogleMapView.tsx` + `GoogleLocationPicker.tsx` behind the existing provider switch (`MapView.tsx` — architecture already prepared, zero consumer changes needed); set `VITE_MAP_PROVIDER=google`. Depends on **API key (client)**. **Small–Medium** — note Leaflet already works; confirm whether Google is contractually required (§5 Q6).
13. **Payment Gateway** — pick/wire gateway (server-side SDK in Laravel + webhooks). Blocks items 2, 3. Depends on **client gateway account**. **Large**
14. **SMS OTP API** — provider wiring for items 4, 7. Depends on **client**. **Small**

---

## 5. Open Questions / Ambiguities

1. **Coin economics** — What is the coin↔INR conversion? Who mints coins (employer top-up only)? Minimum withdrawal? Fees? Nothing in code models "coins" (wallets are plain INR decimals).
2. **"Charge wallet before end of day" / "Clear account daily"** — Is this an automated nightly job that debits employer wallets for that day's verified attendance, or a manual employer action with a deadline? What happens on insufficient balance?
3. **Commission** — Commission on what (job value, guard wage, wallet transactions)? Flat or percentage? Configurable per employer? This defines the commission-report data model.
4. **Discount rules (Sales Executive)** — Percentage vs fixed, caps, admin approval needed? Applied to invoices, wallet charges, or job postings?
5. **Sub Admin semantics** — Is a Sub Admin (a) a platform staff member with limited admin rights, or (b) a security *agency* managing its own guards and clients? "Manage own security guards / own clients" suggests (b), which conflicts with the current direct guard↔employer marketplace model. This changes the data model significantly.
6. **Google Maps vs Leaflet** — Leaflet (free, no key) is fully working. Is Google Maps contractually required, or is the requirement just "map + radius search"?
7. **Telephonic/video conversation (3.2.3)** — Is the current "interview request with preferred date/time" (call happens off-platform) sufficient, or is in-app calling (Twilio/Agora/etc.) required? Big cost difference.
8. **OTP channel for cash confirmation** — SMS to guard's mobile, or in-app/email acceptable? SRS says SMS/Email API "provided by client, if required".
9. **Aadhaar for guards vs employers** — Current flow verifies *employers*. SRS 3.1.2 puts Aadhaar under the *guard* panel. Do employers still need Aadhaar KYC, or was that a first-build addition to keep?
10. **Qualification taxonomy** — Free text or fixed list (10th/12th/Graduate)? Needed for both guard profile and job posting filters.
11. **Sales Executive accounts** — Created by admin only? Do they belong to regions/territories?
12. **Deployment** — Frontend is Netlify-configured, but where should the Laravel API live in production? `DEPLOYMENT.md` predates the Laravel backend.

---

## 6. Suggested Build Order

### Milestone 1 — Finish the Laravel migration (fix what's silently broken in prod) — ✅ DONE 2026-07-10
- [x] Guard profile API (`GET/PATCH /api/me/guard-profile`) + rewired `ProfileScreen.tsx` with edit sheet (personal, skills, languages, bank details)
- [x] Guard applications screen → `GET /api/guard/applications` (now eager-loads job/company/site) + rewired `ApplicationsScreen.tsx`
- [x] Guard attendance logging API (`POST check-in`, `PATCH check-out`, `GET /api/guard/attendance`) + rewired `AttendanceScreen.tsx` — verified end-to-end in browser + DB
- [x] Guard dashboard → real data (rewired `MobileDashboard.tsx`)
- [x] Admin guards API (`GET/POST/PATCH /api/admin/guards` incl. block/unblock) + rewired `GuardList.tsx`, `AddGuard.tsx` — blocked guard login rejected with 403, verified
- [x] Admin stats endpoint (`GET /api/admin/reports/counts`) + rewired admin `Dashboard.tsx` (live KPIs, area stats, activity, map)
- [x] CORS: allow any localhost port in dev (`backend/config/cors.php` pattern) alongside `FRONTEND_URL`
- [ ] Remove/retire `frontend/src/lib/storage.ts` mock and dead `supabase/` artifacts once nothing imports them (types still used by `EmployerManagement.tsx` and legacy `lib/aadhaarService.ts`/`lib/employerService.ts` — those legacy files have pre-existing typecheck errors and appear unused; confirm and delete)

### Milestone 2 — Guard verification & profile completeness
- [ ] Add `qualification` to `guard_profiles` + profile UI
- [ ] Guard document upload (ID proof, police verification scan, bank proof) + admin review that sets `police_verification_status`
- [ ] Aadhaar flow for guards (email-OTP interim) — swap to real Aadhaar API when client delivers credentials (both employer + guard flows)

### Milestone 3 — Location, radius & job filters (closes SRS 3.1.3/3.1.4)
- [ ] Guard residential location set via map/pincode (reuse `LocationPicker`) + persist radius preference
- [ ] Radius filtering of the job **list** (client-side `distanceKm()` first; server-side later if needed)
- [ ] Duration (4/6/8/12hr) and type (Regular/Monthly/Weekly/Daily) filters in job search
- [ ] Add `qualification` to `job_posts` + posting form
- [ ] (If required — Q6) Google Maps provider implementation behind existing switch

### Milestone 4 — Availability & guard discovery
- [ ] `guard_availabilities` model + guard scheduling screen (SRS 3.1.5)
- [ ] Employer "view available guards" endpoint + screen (SRS 3.2.3)

### Milestone 5 — Money: wallets, gateway, payments (needs client gateway + answers to Q1–Q3)
- [ ] Payment gateway server-side integration (top-up + payout + webhooks)
- [ ] Employer wallet charging + daily clearing job
- [ ] Guard wallet + coin ledger + withdrawal flow
- [ ] In-cash payment with guard OTP confirmation
- [ ] Commission recording per transaction (enables M7 report)

### Milestone 6 — Sales Executive panel (needs Q4, Q11)
- [ ] `sales_executive` role (enum migration, middleware, portal shell + login)
- [ ] View client profiles
- [ ] Post job on behalf of client with client OTP confirmation
- [ ] Discounts on employer billing

### Milestone 7 — Admin reports & feedback
- [ ] Employer feedback form + admin listing (SRS 3.2.7)
- [ ] Report: area-wise guard availability (needs M3 + M4)
- [ ] Report: language proficiency (English) guards
- [ ] Report: commission earnings (needs M5)
- [ ] Per-site billing filter for invoices/payments

### Milestone 8 — Sub Admin panel (blocked on Q5)
- [ ] `sub_admin` role + portal
- [ ] Own company details management
- [ ] Staff management (add/edit/delete)
- [ ] Own clients + own guards management (data-ownership model per Q5 answer)
