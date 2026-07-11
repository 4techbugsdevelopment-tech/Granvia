# Granvia — Project Progress

_Last updated: 2026-07-10_

A running status of the Granvia Security Manpower Platform. For the detailed
SRS gap analysis and per-requirement task list, see
[`PROJECT_CHANGES.md`](./PROJECT_CHANGES.md). This file is the higher-level
"what's done / what's left" snapshot.

---

## 1. Status at a Glance

| Area | Status | Notes |
|------|--------|-------|
| **Backend platform (Laravel + Sanctum)** | ✅ Live | UUID keys, role middleware, 20 domain migrations |
| **Supabase → Laravel migration** | ✅ Done | All 19 frontend services call the Laravel API; 0 Supabase imports |
| **Auth (multi-portal, block/unblock)** | ✅ Done | Role check + portal-mismatch + inactive-account rejection |
| **Guard panel (core)** | ✅ Wired to API | Profile, applications, attendance, dashboard now use live data |
| **Employer panel (core)** | ✅ Done | Companies, sites, jobs, applicants, interviews, offers, wallet (read) |
| **Admin panel (core)** | ✅ Done | Job approvals, employer + guard management, live dashboard |
| **Sub Admin panel** | 🟡 Frontend UI (demo) | Full UI built this session; **no backend role/API yet** |
| **Sales Executive panel** | 🟡 Frontend UI (demo) | Demo shell only; **no backend role/API yet** |
| **Money (wallets, gateway, coins, commission)** | ❌ Not built | Blocked on client payment gateway + business rules |
| **Client integrations (Aadhaar / Maps / Payment / SMS)** | ❌ Placeholder/mock | Awaiting client-provided credentials |

**Overall completion vs. current SRS: ~45%** (core marketplace + admin solid;
money flows, two backend roles, and most integrations still outstanding).

---

## 2. Completed Work

### 2.1 Platform & Auth
- ✅ Laravel backend with Sanctum bearer-token auth, `EnsureRole` middleware, per-domain controllers.
- ✅ Full Supabase → Laravel migration of all frontend service files (`frontend/src/lib/apiClient.ts` = axios + Bearer token, auto-logout on 401).
- ✅ Multi-portal login with role verification and portal-mismatch rejection.
- ✅ Guard + Employer registration with email verification.
- ✅ Blocked/inactive accounts rejected at login (403).
- ✅ Notifications, support tickets, file storage + signed download URLs.

### 2.2 Guard Panel (Milestone 1 — done 2026-07-10)
- ✅ Guard profile API + rewired `ProfileScreen.tsx` (personal, skills, languages, bank details).
- ✅ Applications screen wired to `GET /api/guard/applications`.
- ✅ Attendance logging API (check-in / check-out) + rewired `AttendanceScreen.tsx` (verified end-to-end).
- ✅ Guard dashboard wired to real data.
- ✅ Job search (text + shift filter) + apply-for-job with duplicate guard, Leaflet map with radius circle.

### 2.3 Employer Panel
- ✅ Multiple companies CRUD + logo upload.
- ✅ Multiple sites per company (with lat/lng via `LocationPicker`).
- ✅ Company KYC document upload.
- ✅ Job posting CRUD (guards required, experience, skills, languages, duty hours, shift, duration type).
- ✅ View applicants + accept/reject; interview ("Call") request workflow.
- ✅ Job offers + agreements.
- ✅ Attendance verification (view + status/remarks).
- ✅ Payments + invoices listing; wallet balance + statement (read-only).
- ✅ Employer Aadhaar OTP flow (email-OTP simulation).

### 2.4 Admin Panel
- ✅ Job approval workflow (pending / approve / reject / delete).
- ✅ Employer CRUD (create with temp password, edit, cascade delete) + block/unblock end-to-end.
- ✅ Admin guards API (`GET/POST/PATCH /api/admin/guards`) + rewired `GuardList.tsx` / `AddGuard.tsx`.
- ✅ Admin stats endpoint + live dashboard (KPIs, area stats, activity, map).

### 2.5 This Session's Work (2026-07-10)

**A. Removed all "demo" warning banners** across the frontend (yellow "Demo data" / "Demo panel — any credentials will sign you in" notices and the landing-page "Demo" badges):
- Admin pages: `Reports`, `WalletPayments`, `HiringWorkflow`, `AttendanceAdmin`, `SettingsPage`, shared `_adminUi` (`DemoNote` removed).
- Sales panel: `SalesApp`, `SalesAuth`. Sub Admin: `SubAdminApp`, `SubAdminAuth`.
- Guard screens: `AvailabilityScreen`, `WalletScreen`, `SupportScreen`, `NotificationsScreen`.
- Employer pages: `AvailableGuardsPage`, `FeedbackPage`, `CashPaymentPage`.
- Landing (`App.tsx`) "Demo" corner badges + dead `DEMO_BANNER` constant.

**B. Built the Sub Admin panel UI** (branch-scoped, demo data, brand-themed — Navy `#1A2B56` / Burgundy `#7A2621` / Earth Brown `#4B2E2A`). Verified in-browser, no console errors:
- New structure: `subadmin/theme.ts`, `subadmin/ui.tsx` (reusable `SlideOver` "Information Sliding" panel, `GlassStat` glassmorphism widget, `TapButton` scale-on-tap, `Pill`, `Table`, `Field`).
- **Dashboard** — glassmorphism stat widgets + **Recharts** area-wise manpower availability bar chart + commission trend area chart.
- **Staff Management** — full CRUD (Add / Edit / Delete-with-confirm) via slide-over, Status toggle, Access-Permission chips.
- **Manual Verification Desk** — slide-over document viewer (Aadhaar / Police / Bank), per-document Navy **Approve** / Burgundy **Reject-with-reason**, real-time status updates.
- **Company Details** (info + sites, editable), **My Clients**, **Service Partners**, **Reports** (manpower skills filterable by English proficiency & qualification + branch commission chart).
- Added `recharts@^3.9.2` dependency.
- Extended `frontend/src/lib/demoData.ts` with branch-scoped fixtures (keyed by `SUB_ADMIN_BRANCH_ID`): staff+permissions, verification queue, availability, manpower skills, commission.

> ⚠️ The Sub Admin (and Sales Executive) panels are **frontend demo UI only**. They read mock data from `demoData.ts`; there is no `sub_admin` / `sales_executive` role in the backend (`users.role` enum = `super_admin | employer | guard`) and no scoped API.

---

## 3. Partially Implemented — Needs Finishing

_(Full detail in [`PROJECT_CHANGES.md` §3](./PROJECT_CHANGES.md).)_

- 🟡 **Guard verification & profile completeness** — no `qualification` column; no guard document upload (ID / police / bank) or admin review; Aadhaar flow is employer-only email-OTP simulation.
- 🟡 **Location & radius** — radius slider draws a map circle but does **not** filter the job list; no guard UI to save residential location/radius.
- 🟡 **Job filters** — missing duration (4/6/8/12hr) and type (Regular/Monthly/Weekly/Daily) filters; no skill-match check on apply.
- 🟡 **Employer billing** — no per-**site** billing filter; no billing summary grouped by site/company.
- 🟡 **Wallet operations** — read-only; no top-up/withdraw, no way for balances to change (`wallet_transactions` never written).
- 🟡 **Sub Admin / Sales Executive** — UIs exist but are unbacked (see §2.5 warning).

---

## 4. Remaining Work (Not Started)

### Guard
- ❌ Availability posting (duration + frequency) — `guard_availabilities` model + screen (SRS 3.1.5).
- ❌ Guard wallet + coin ledger + withdrawal to bank (SRS 3.1.7) — needs payment gateway.

### Employer
- ❌ Wallet charging / daily clearing job (SRS 3.2.5) — needs payment gateway.
- ❌ In-cash payment with guard OTP confirmation (SRS 3.2.5) — needs SMS/Email OTP.
- ❌ Feedback form + admin listing (SRS 3.2.7).
- ❌ "View available guards" browse screen (depends on availability posting).

### Sales Executive (backend)
- ❌ `sales_executive` role (enum migration, middleware, portal auth) + scoped API.
- ❌ View client profiles; post job on behalf of client with OTP; apply discounts to billing.

### Sub Admin (backend)
- ❌ `sub_admin` role + scoped API to back the existing UI.
- ❌ Data-ownership model (which guards/clients "belong" to a branch) — **see open question Q5**.
- ❌ Persist staff, company edits, and document approve/reject to real endpoints.

### Admin Reports
- ❌ Area-wise guard availability (needs availability + guard location).
- ❌ English-proficiency report; commission earnings report (needs a commission model).

### Client Integrations (all placeholder/mock)
- ❌ Real Aadhaar API (replace email-OTP simulation; extend to guards).
- ❌ Google Maps provider (Leaflet works today; Google branch is a stubbed switch).
- ❌ Payment Gateway (blocks all money flows).
- ❌ SMS OTP API (for cash-payment + sales OTP).

---

## 5. Blockers / Client Dependencies

These gate the remaining money and integration work — details and full question
list in [`PROJECT_CHANGES.md` §5](./PROJECT_CHANGES.md):

1. **Payment gateway account + credentials** — blocks wallets, coins, daily clearing, commission.
2. **Coin economics** — coin↔INR rate, who mints, minimum withdrawal, fees.
3. **Commission rules** — basis (job value / wage / txn), flat vs %, per-employer config.
4. **Sub Admin semantics (Q5)** — platform staff with limited rights, **or** an agency managing its own guards/clients? This decides the ownership data model before backend work can start.
5. **Discount rules** for the Sales Executive panel.
6. **Integration credentials** — Aadhaar API, Google Maps key, SMS OTP provider.

---

## 6. Suggested Next Steps (short-term)

1. Decide Sub Admin semantics (Q5) → add `sub_admin` role + scoped API to back the UI built this session.
2. Finish guard verification: `qualification` column, guard document upload + admin review.
3. Close the radius/job-filter gaps (client-side `distanceKm()` filtering + duration/type filters).
4. Feedback form (small, unblocked) and English-proficiency report (small, unblocked).
5. Once the client delivers the payment gateway → start Milestone 5 (wallets/coins/commission).

_Milestone breakdown: see [`PROJECT_CHANGES.md` §6](./PROJECT_CHANGES.md)._
