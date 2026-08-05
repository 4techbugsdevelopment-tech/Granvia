# Granvia — Onboarding Readiness Report

**Date:** 2026-08-03
**Backend:** Node + Express + Prisma (SQL Server), port 8000 — verified running & healthy
**Scope:** Registration, login, and all functionality per role. Status is derived from the *actually wired* code path (frontend service → API route → controller → DB), not from UI mockups.

**Legend:** ✅ Live (real API + DB) · 🟡 Partial / read-only / gap · 🔴 Demo-only (static `demoData.ts`, no backend) · ⛔ Missing

---

## 0. Cross-cutting auth facts (apply to every role)

| Area | Status | Detail |
|------|--------|--------|
| Login (all roles) | ✅ | `POST /auth/login` — password verified, token issued. Portal logins pass a `role` and it is enforced (403 if mismatch). |
| Blocked/inactive gate | ✅ | Login rejects `accountStatus = blocked / inactive` with 403. |
| Public registration | 🟡 | Only **employer** and **guard** can self-register (`/auth/register/employer`, `/auth/register/guard`). |
| **super_admin / sub_admin / sales_executive creation** | ⛔ | **No API or UI creates these accounts.** They exist only via the seed script or a direct DB insert. This is the single biggest onboarding blocker (see §7). |
| Email verification | 🟡 | Registration sends a signed verification email and `GET /email/verify/:id/:hash` works. **But login does NOT require a verified email** — gating is by `accountStatus`, not `emailVerifiedAt`. |
| Password rules | ✅ | Min 8 chars on registration, hashed (bcrypt-style) via `utils/password`. |

---

## 1. Super Admin (`super_admin`) — portal: `web-admin/`

| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ | Works. |
| Dashboard (stats) | ✅ | `GET /admin/reports/counts` — live counts. |
| Guard list + block/unblock | ✅ | `GET/POST/PATCH /admin/guards`, `setGuardAccountStatus`. |
| Add guard | ✅ | `POST /admin/guards`. |
| Guard document review | ✅ | `GET /admin/guards/:id/documents`, `PATCH /admin/guard-documents/:id`. |
| Job approvals | ✅ | `GET /admin/jobs/pending`, `PATCH approve/reject`, delete. |
| Employer management (full CRUD) | ✅ | `adminEmployerService` → `GET/POST/PATCH/DELETE /admin/employers`. |
| Hiring Workflow page | 🔴 | `HiringWorkflow.tsx` renders `demoHiringPipeline` / `demoRecentHires` — **static demo, no backend**. (The real hiring loop lives in the employer portal.) |
| Reports (area/skills/commission) | 🔴 | `Reports.tsx` uses `demoAreaAvailability`, `demoCommissionByMonth` — static. |
| Wallet & Payments page | 🔴 | `WalletPayments.tsx` uses `demoPlatformPayments/Transactions` — static. |
| Attendance (admin view) | 🔴 | `AttendanceAdmin.tsx` — static, no service call. |
| Create sub_admin / sales_executive | ⛔ | Not possible from admin panel (see §0/§7). |

## 2. Employer (`employer`) — portal: `employer/`

| Feature | Status | Notes |
|---------|--------|-------|
| Register / Login | ✅ | Self-registration + email verify + login all live. |
| Company create/edit + logo | ✅ | `GET/POST/PATCH /employer/companies`, logo upload. |
| Site create/edit | ✅ | `POST/PATCH /employer/sites`. |
| Company documents | ✅ | `GET/POST /employer/companies/:id/documents`. |
| Job posting (CRUD) | ✅ | `GET/POST/PATCH/DELETE /employer/jobs`. |
| View applicants | ✅ | `GET /employer/applications`. |
| Select / reject applicant | ✅ | `PATCH /employer/applications/:id/status` (+ status log). |
| Interview request | ✅ | `POST/PATCH /employer/interview-requests`. |
| Job offer | ✅ | `POST/PATCH /employer/job-offers`. |
| Agreement / onboarding | ✅ | `POST/PATCH /employer/agreements`, auto `AGR-` number, confirm flow. |
| Attendance review/verify | ✅ | `GET /employer/attendance`, `PATCH .../status`. |
| Aadhaar KYC (employer) | ✅ | `GET/POST /employer/aadhaar` (SurePass instant + OTP). |
| Wallet (view) | 🟡 | `GET /employer/wallet` + transactions — **read-only**. No top-up / add-funds endpoint. |
| Payments | 🟡 | `GET/POST /employer/payments`, `GET /employer/invoices` exist, but **no payment-gateway integration** (no SDK). |
| Available Guards page | 🔴 | `AvailableGuardsPage.tsx` — demo data. |
| **Cash Payment + OTP** | 🔴 | `CashPaymentPage.tsx` — demo only. The Phase-2 "OTP confirmation for cash payment" is **not wired to backend**. |
| Feedback page | 🔴 | `FeedbackPage.tsx` — demo data. |

## 3. Guard (`guard`) — portal: `mobile-guard/`

| Feature | Status | Notes |
|---------|--------|-------|
| Register / Login | ✅ | Self-registration + login live. |
| Dashboard | ✅ | Live (jobs/applications/attendance services). |
| Job search | ✅ | `GET /jobs` + apply. Radius/geo filtering still basic (see §7). |
| Apply for job | ✅ | `POST /guard/jobs/:id/apply`. |
| Applications list | ✅ | `GET /guard/applications`. |
| Attendance check-in/out | ✅ | Live; **but guard UI sends no `job_id`/location** — marks generic daily attendance (backend supports job-tied check-in). |
| Profile view/edit + avatar | ✅ | `profileService`, `guardVerificationService`. |
| Document upload | ✅ | `GET/POST /guard/documents`. |
| Aadhaar verification | ✅ | `GET /guard/aadhaar`, instant/OTP verify (SurePass). |
| Notifications | 🔴 | `NotificationsScreen.tsx` uses `demoNotifications` — **backend `/me/notifications` exists but UI not wired**. |
| Support tickets | 🔴 | `SupportScreen.tsx` uses `demoTickets` — **backend `/me/support-tickets` exists but UI not wired**. |
| Wallet | 🔴 | `WalletScreen.tsx` — demo; no guard-wallet backend. |
| Availability | 🔴 | `AvailabilityScreen.tsx` — demo. |

## 4. Sub Admin (`sub_admin`) — portal: `subadmin/`

| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ | Works — **but account can't be created via UI/API** (§7). |
| Dashboard counts | ✅ | `GET /subadmin/reports/counts`. |
| Company view/edit | ✅ | `GET/PATCH /subadmin/company`. |
| Staff CRUD | ✅ | `GET/POST/PATCH/DELETE /subadmin/staff` (staff = records, not login users). |
| Verification queue + doc review | ✅ | `GET /subadmin/verification`, `PATCH /subadmin/guard-documents/:id`. |
| Clients / Guards lists | ✅ | `GET /subadmin/clients`, `/subadmin/guards`. |
| Skills report | ✅ | `GET /subadmin/reports/skills`. |
| Commission report | ✅ | `GET /subadmin/reports/commission`. |

*All 7 sub-admin pages are wired to `subadminService` (live).*

## 5. Sales Executive (`sales_executive`) — portal: `sales/`

| Feature | Status | Notes |
|---------|--------|-------|
| Login | ✅ | Works — **but account can't be created via UI/API** (§7). |
| Dashboard counts + activity | ✅ | `GET /sales/reports/counts`, `/sales/activity`. |
| Clients list + detail | ✅ | `GET /sales/clients`, `/sales/clients/:id`. |
| Create job on behalf of client (+ OTP) | ✅ | `POST /sales/jobs/request-otp`, `POST /sales/jobs`. |
| Discounts CRUD | ✅ | `GET/POST/PATCH/DELETE /sales/discounts`. |
| Manpower availability | ✅ | `GET /sales/manpower`. |

*`SalesApp.tsx` wired to `salesService` (live).*

---

## 6. Verified working end-to-end (live runtime test, 15/15 passed)

- **Hiring:** apply → employer sees → select → interview request → job offer → accept → agreement (draft, `AGR-` no.) → confirm.
- **Attendance:** job-tied check-in (hired-status enforced) → duplicate blocked (422) → check-out (`total_hours` auto) → employer sees → verify.

---

## 7. What's remaining before real onboarding (prioritised)

1. **⛔ BLOCKER — No way to create super_admin / sub_admin / sales_executive accounts.** No API/UI. Needs an admin endpoint (e.g. `POST /admin/staff-users`) + UI, or the accounts must be seeded/DB-inserted per client. Deleting the demo admin without a replacement path locks you out of the admin panel.
2. **🔴 Guard Notifications & Support** — backend endpoints exist; wire the two screens off `demoData` onto `notificationService` / `supportService`.
3. **🔴 Cash Payment + OTP (employer)** — Phase-2 requirement, currently demo-only.
4. **🟡 Payment gateway + wallet top-up** — no gateway SDK, wallet is read-only. Needed for the employer→platform→guard money flow.
5. **🔴 Admin Hiring / Reports / Wallet / Attendance pages** — cosmetic demo; wire to existing backend counts/reads or build the missing report endpoints (area/skills/commission at admin level).
6. **🟡 Guard attendance not job/geo-tied in UI** — backend ready; pass `job_id` + geolocation from `AttendanceScreen`.
7. **🟡 Email verification not enforced at login** — decide if real onboarding should block unverified users.
8. **🔴 Guard Wallet / Availability, Employer Available-Guards / Feedback** — demo screens with no backend.
9. **⚠️ `seed-demo-auth-users.ts` crashes on the sub_admin account** (`SubAdminProfileWhereUniqueInput needs 'id'`) — fix if you rely on it.

---

## 8. Demo data currently in the database (removal candidates)

7 accounts — **all are test/demo**, none are genuine end-users:

| Role | Email | Note |
|------|-------|------|
| super_admin | admin@granvia.test | DEMO — **only admin account; see blocker #1 before deleting** |
| employer | employer@granvia.test | DEMO |
| employer | lalit.sharma@4techbugs.com | Test (dev agency), not `@granvia.test` |
| guard | guard@granvia.test | DEMO |
| guard | uipartner1@example.com | Test, blocked, not `@granvia.test` |
| sales_executive | sales@granvia.test | DEMO |
| sub_admin | subadmin@granvia.test | DEMO |

Related demo rows: employerProfiles 2, guardProfiles 2, subAdminProfiles 1, employerCompanies 2, employerWallets 1, staffMembers 3, attendanceRecords 3. Everything else is empty (0 jobs, applications, offers, agreements, payments, invoices, documents, notifications, tickets).

> **Note on frontend `demoData.ts`:** the 🔴 screens above read from `src/lib/demoData.ts`. That is placeholder *UI code*, not database data — removing DB rows will not clear those screens. They keep showing demo content until each screen is wired to its service.
