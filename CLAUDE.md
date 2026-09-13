# CLAUDE.md — Granvia Security Guard Management Platform

> Read this file first in every session. Use it to locate relevant files quickly without broad codebase scanning.

---

## 1. Project Overview

**Granvia** is a security guard workforce management platform with three distinct portals in a single React SPA:

| Portal | Path | Role | Purpose |
|--------|------|------|---------|
| Admin Panel | `/admin` | `super_admin` | Manage guards, employers, jobs, attendance, reports |
| Guard App | `/guard` | `guard` | Mobile-first: find jobs, mark attendance, manage profile |
| Employer Portal | `/employer` | `employer` | Post jobs, hire guards, manage payments/companies |

The landing page (`/`) lets users choose a portal. Role is stored in the `profiles` table and checked via `useAuth` hook.

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + TypeScript (Vite) |
| Routing | Path-based manual routing in `App.tsx` (no `react-router-dom` `<Routes>`) |
| Styling | Tailwind CSS v3 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Backend/DB | Supabase (Auth + Postgres + Storage) |
| Build | Vite 5 |
| Deploy | Netlify (`netlify.toml` present) |

---

## 3. Folder Structure Map

```
src/
├── App.tsx                    # Root: portal routing, mode/state machine
├── main.tsx                   # Entry: AuthProvider wraps App
├── context/
│   └── AuthContext.tsx        # Supabase auth state + profile, provides useAuth
├── hooks/
│   └── useAuth.ts             # Consumes AuthContext
├── lib/
│   ├── supabaseClient.ts      # Supabase client singleton + ephemeral client
│   ├── supabaseTypes.ts       # Shared TypeScript types (ProfileRow, UserRole, etc.)
│   ├── storage.ts             # Legacy local-storage layer (used in employer mock data)
│   ├── aadhaarService.ts      # Aadhaar verification helper
│   ├── employerService.ts     # Employer-specific helpers
│   └── inputSanitizers.ts     # Input sanitization utilities
├── services/                  # All Supabase data access — one file per domain
│   ├── authService.ts         # signIn, signUp, signOut, profiles table
│   ├── profileService.ts      # profiles, employer_profiles
│   ├── jobService.ts          # job_posts, company_sites
│   ├── applicationService.ts  # job_applications
│   ├── companyService.ts      # employer_companies
│   ├── siteService.ts         # company_sites
│   ├── attendanceService.ts   # attendance_records
│   ├── paymentService.ts      # payments, invoices
│   ├── walletService.ts       # employer_wallets, wallet_transactions
│   ├── reportService.ts       # aggregated reads: job_posts, applications, attendance, payments
│   ├── notificationService.ts # notifications
│   ├── supportService.ts      # support_tickets, support_ticket_messages
│   ├── roleService.ts         # roles table
│   ├── storageService.ts      # Supabase Storage uploads/signed URLs
│   ├── adminEmployerService.ts# Admin CRUD over employer ecosystem (many tables)
│   ├── aadhaarVerificationService.ts # employer_aadhaar_verifications, employer_profiles
│   └── supabaseErrors.ts      # Error parsing utilities
├── components/
│   ├── auth/
│   │   ├── AadhaarGate.tsx    # Aadhaar verification gate component
│   │   ├── ProtectedRoute.tsx # Route guard by auth state
│   │   └── RoleGuard.tsx      # Route guard by role
│   ├── FlipCard.tsx
│   ├── GranviaLogo.tsx
│   └── LogoImage.tsx
├── pages/
│   └── auth/
│       ├── AadhaarVerificationSlider.tsx
│       └── EmailVerificationPending.tsx
├── web-admin/                 # Admin portal (desktop UI)
│   ├── AdminApp.tsx           # Admin shell + page switcher
│   ├── LoginScreen.tsx        # Admin login form
│   ├── Sidebar.tsx            # Navigation sidebar
│   ├── SplashScreen.tsx       # Admin intro animation
│   └── pages/
│       ├── Dashboard.tsx      # Stats overview
│       ├── GuardList.tsx      # Guard roster
│       ├── AddGuard.tsx       # Create guard form
│       ├── EmployerManagement.tsx # Employer CRUD + approval
│       └── PlaceholderPage.tsx
├── mobile-guard/              # Guard portal (mobile-first UI)
│   ├── MobileApp.tsx          # Guard shell + bottom nav
│   ├── MobileLogin.tsx        # Guard login
│   ├── MobileSplash.tsx       # Guard intro screen
│   └── screens/
│       ├── MobileDashboard.tsx
│       ├── JobSearch.tsx
│       ├── ApplicationsScreen.tsx
│       ├── AttendanceScreen.tsx
│       ├── ProfileScreen.tsx
│       └── MobilePlaceholder.tsx
├── employer/                  # Employer portal
│   ├── EmployerApp.tsx        # Employer shell (uses local storage layer heavily)
│   └── EmployerAuth.tsx       # Employer login/signup (Supabase auth)
└── data/                      # Static/seed data (if any)

supabase/
└── migrations/
    ├── 202605280001_initial_schema.sql
    ├── 202605280002_add_roles_and_profile_role_id.sql
    └── 202605280003_admin_employer_management.sql

scripts/                       # Seeding/utility scripts
database/                      # Additional DB fixtures or helpers
```

---

## 4. Supabase Architecture

**Client file:** `src/lib/supabaseClient.ts`
- Exports `supabase` (persistent session) and `createEphemeralSupabaseClient()` (no session persistence — used for isolated operations)

**Auth usage:**
- `supabase.auth.signInWithPassword` / `signUp` / `signOut`
- `onAuthStateChange` listener in `AuthContext.tsx`
- Profile auto-created on first login via `buildProfilePayload` → upsert to `profiles`
- Role stored in `profiles.role` (string enum) and optionally `profiles.role_id` (UUID FK to `roles` table)

**Supabase tables detected:**

| Table | Used by |
|-------|---------|
| `profiles` | authService, profileService, AuthContext, adminEmployerService |
| `roles` | roleService |
| `employer_profiles` | profileService, aadhaarVerificationService, adminEmployerService |
| `employer_companies` | companyService, adminEmployerService |
| `employer_aadhaar_verifications` | aadhaarVerificationService |
| `company_sites` | siteService, jobService, adminEmployerService |
| `company_documents` | adminEmployerService |
| `job_posts` | jobService, applicationService, reportService, adminEmployerService |
| `job_applications` | applicationService, adminEmployerService |
| `application_status_logs` | adminEmployerService |
| `interview_requests` | adminEmployerService |
| `job_offers` | adminEmployerService |
| `agreements` | adminEmployerService |
| `attendance_records` | attendanceService, reportService, adminEmployerService |
| `payments` | paymentService, reportService, adminEmployerService |
| `invoices` | paymentService, adminEmployerService |
| `employer_wallets` | walletService, adminEmployerService |
| `wallet_transactions` | walletService, adminEmployerService |
| `notifications` | notificationService |
| `support_tickets` | supportService |
| `support_ticket_messages` | supportService |

**Supabase Storage buckets:**

| Bucket | Used for |
|--------|---------|
| `company-logos` | Employer company logos |
| `company-documents` | KYC/company docs |
| `guard-documents` | Guard identity/police docs |
| `profile-images` | User avatars |
| `invoices` | Invoice PDFs |
| `agreements` | Agreement documents |

All storage via `src/services/storageService.ts` — upload, signed URL, public URL.

**RPC/Edge functions:** None detected in frontend code.

**Realtime:** Not detected in frontend code.

**Environment variable names (no values):**

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY
SUPABASE_PROJECT_REF
SUPABASE_SERVICE_ROLE_KEY        # server-side only
SUPABASE_DB_URL                  # server-side only
SUPABASE_ACCESS_TOKEN            # CLI only
VITE_SITE_URL
VITE_EMAIL_CONFIRMATION_REDIRECT_URL
VITE_EMPLOYER_LOGIN_REDIRECT_URL
VITE_PRODUCTION_FRONTEND_URL
VITE_GOOGLE_MAPS_API_KEY
VITE_PAYMENT_GATEWAY_PUBLIC_KEY
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM_EMAIL / SMTP_FROM_NAME
```

---

## 5. Feature-to-File-to-Supabase Map

| Feature / Screen | Main files | Supabase table/storage | Purpose |
|---|---|---|---|
| Auth / Login (all roles) | `AuthContext.tsx`, `authService.ts`, `web-admin/LoginScreen.tsx`, `mobile-guard/MobileLogin.tsx`, `employer/EmployerAuth.tsx` | `profiles`, Supabase Auth | Sign in, session management, profile bootstrap |
| Landing page portal selector | `App.tsx` (LandingPage) | — | Route user to correct portal |
| Admin Dashboard | `web-admin/pages/Dashboard.tsx` | `job_posts`, `job_applications`, `attendance_records`, `payments` via `reportService.ts` | Summary metrics |
| Guard Management | `web-admin/pages/GuardList.tsx`, `AddGuard.tsx` | `profiles` | List/add guards |
| Employer Management (admin) | `web-admin/pages/EmployerManagement.tsx`, `adminEmployerService.ts` | `profiles`, `employer_profiles`, `employer_companies`, `company_sites`, `job_posts`, `employer_wallets`, `agreements` etc. | Full employer lifecycle management |
| Job Search (guard) | `mobile-guard/screens/JobSearch.tsx`, `jobService.ts` | `job_posts`, `employer_companies`, `company_sites` | Guards browse active jobs |
| Job Applications (guard) | `mobile-guard/screens/ApplicationsScreen.tsx`, `applicationService.ts` | `job_applications`, `job_posts` | Guards apply/view applications |
| Attendance (guard) | `mobile-guard/screens/AttendanceScreen.tsx`, `attendanceService.ts` | `attendance_records` | Check-in/check-out |
| Guard Profile | `mobile-guard/screens/ProfileScreen.tsx`, `profileService.ts` | `profiles` | View/edit profile |
| Employer Auth | `employer/EmployerAuth.tsx`, `authService.ts` | Supabase Auth, `profiles` | Employer signup/login + email verify |
| Employer App (shell) | `employer/EmployerApp.tsx` | `employer_companies`, `employer_wallets`, local storage layer | Employer dashboard; mixes Supabase + legacy local storage |
| Company management | `companyService.ts` | `employer_companies` | CRUD employer companies |
| Site management | `siteService.ts` | `company_sites` | CRUD work sites |
| Job posting | `jobService.ts` | `job_posts`, `company_sites` | Create/manage job posts |
| Wallet & Payments | `walletService.ts`, `paymentService.ts` | `employer_wallets`, `wallet_transactions`, `payments`, `invoices` | Guard payment tracking |
| Notifications | `notificationService.ts` | `notifications` | In-app notifications |
| Support tickets | `supportService.ts` | `support_tickets`, `support_ticket_messages` | User support |
| File uploads | `storageService.ts` | Storage buckets | Company docs, guard docs, avatars |
| Aadhaar verification | `aadhaarVerificationService.ts`, `lib/aadhaarService.ts` | `employer_aadhaar_verifications`, `employer_profiles` | Employer KYC |

---

## 6. API / Data Interaction Map

| Service file | Tables/Storage | Operations | Consumed by |
|---|---|---|---|
| `authService.ts` | `profiles`, Supabase Auth | signIn, signUp, signOut, profile upsert | LoginScreen, MobileLogin, EmployerAuth |
| `profileService.ts` | `profiles`, `employer_profiles` | select, update | ProfileScreen, EmployerApp |
| `jobService.ts` | `job_posts`, `company_sites`, `employer_companies` | select, insert, update | JobSearch, EmployerApp |
| `applicationService.ts` | `job_applications`, `job_posts` | select, insert, update | ApplicationsScreen, EmployerManagement |
| `companyService.ts` | `employer_companies` | select, insert, update | EmployerApp |
| `siteService.ts` | `company_sites` | select, insert, update | EmployerApp |
| `attendanceService.ts` | `attendance_records` | select, insert | AttendanceScreen |
| `paymentService.ts` | `payments`, `invoices` | select, insert | EmployerApp, AdminDashboard |
| `walletService.ts` | `employer_wallets`, `wallet_transactions` | select | EmployerApp, AdminDashboard |
| `reportService.ts` | `job_posts`, `job_applications`, `attendance_records`, `payments` | select aggregates | Dashboard (admin) |
| `notificationService.ts` | `notifications` | select, update | MobileApp, EmployerApp |
| `supportService.ts` | `support_tickets`, `support_ticket_messages` | select, insert | Support screens |
| `roleService.ts` | `roles` | select | Role management |
| `storageService.ts` | Supabase Storage | upload, signedUrl, publicUrl | Document upload flows |
| `adminEmployerService.ts` | 20+ tables | select, insert, update, delete | EmployerManagement (admin) |
| `aadhaarVerificationService.ts` | `employer_aadhaar_verifications`, `employer_profiles` | select, insert, update | Aadhaar gate |

---

## 7. Business Process Flow

```
1. LANDING       User visits / → selects portal (Admin / Guard / Employer)

2. AUTH          Each portal has its own login screen
                 → Supabase signInWithPassword
                 → AuthContext fetches profile from `profiles`
                 → Role checked: super_admin | guard | employer

3. GUARD FLOW
   Login → MobileDashboard
   → Search jobs (job_posts) → Apply (job_applications)
   → Mark attendance (attendance_records)
   → View profile / upload docs

4. EMPLOYER FLOW
   Signup/Login (email confirm) → EmployerApp
   → Create company (employer_companies) → Add sites (company_sites)
   → Post jobs (job_posts) → Review applicants (job_applications)
   → Aadhaar KYC (employer_aadhaar_verifications) → Manage payments/wallet

5. ADMIN FLOW
   Login → AdminApp (Dashboard)
   → View metrics (reports)
   → Manage guards (profiles)
   → Manage employers (adminEmployerService: full lifecycle)
   → Approve/reject applications, view attendance, wallet/payments
```

> Note: `EmployerApp.tsx` has dual-layer data: some views read from Supabase via services, others still use the legacy `src/lib/storage.ts` local-storage layer. This is a migration in progress.

---

## 8. Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, default port 5174 per .env.example)
npm run build        # Production build → dist/
npm run preview      # Serve dist/ locally
npm run lint         # ESLint check
npm run typecheck    # TypeScript compile check (no emit)
```

---

## 9. Low-Token Claude Working Rules

- Always read `CLAUDE.md` first in every session.
- Identify the minimum relevant files before opening anything. Target 3–8 files per task.
- Use Grep/Glob to locate symbols before opening files.
- Ask before scanning more than 15 files.
- For UI-only tasks, skip Supabase service files unless the data shape is unclear.
- For data tasks, read: `supabaseClient.ts` → relevant `services/*.ts` → consuming component.
- Never read: `node_modules/`, `dist/`, `.git/`, `vite-dev.log`, `vite-node.log`, or generated files.
- Never read or expose values from `.env` or `.env.local`.
- `.env.example` is safe to read.

---

## 10. Task Routing Guide

| Task type | Start with these files |
|-----------|----------------------|
| UI layout / styling | Relevant `web-admin/pages/*.tsx` or `mobile-guard/screens/*.tsx` |
| Data not loading | Component → `services/<domain>Service.ts` → check Supabase table name |
| Auth / login issue | `AuthContext.tsx`, `authService.ts`, `hooks/useAuth.ts`, portal LoginScreen |
| Database insert/update | `services/<domain>Service.ts` → `supabase/migrations/` for schema |
| Role/permission error | `AuthContext.tsx`, `components/auth/RoleGuard.tsx`, `supabase/migrations/*.sql` (RLS) |
| Storage / file upload | `services/storageService.ts`, bucket name from `UploadTarget` type |
| Employer management | `web-admin/pages/EmployerManagement.tsx` + `services/adminEmployerService.ts` |
| Guard mobile screen | `mobile-guard/screens/<Screen>.tsx` + relevant service |
| Employer portal | `employer/EmployerApp.tsx` + `employer/EmployerAuth.tsx` |
| Reports / metrics | `web-admin/pages/Dashboard.tsx` + `services/reportService.ts` |
| Build / deploy error | `package.json`, `vite.config.ts`, `netlify.toml`, `.env.example` |
| Aadhaar KYC | `services/aadhaarVerificationService.ts`, `lib/aadhaarService.ts`, `components/auth/AadhaarGate.tsx` |
| Notifications | `services/notificationService.ts` |
| Support tickets | `services/supportService.ts` |

---

## 11. Known Live DB vs Migration Divergences

The live Supabase DB (`uiyllxfhmubtasczqmuj`) has drifted from the migration files. Always verify against the live schema before trusting migrations.

| Item | Migration says | Live DB reality |
|------|---------------|----------------|
| `company_sites.company_id` FK | `references employer_companies(id)` | Was pointing to `companies` table (fixed) |
| `company_sites.name` | NOT NULL | Made nullable (fixed) |
| `job_applications.site_id` | NOT NULL | Made nullable (fixed) |
| `job_posts.latitude/longitude` | Columns exist | Do NOT exist in live DB |
| `is_super_admin()` function | Defined in migration | Not deployed to live DB |
| `is_employer_aadhaar_verified()` function | Defined in migration | Not deployed to live DB |
| `employer_aadhaar_verifications` table | Defined in migration | May not exist in live DB |

**Rule:** When a `PGRST204` (column not found) or `42883` (function not found) error appears, the live DB is missing something from migrations. Fix the service code first; add a migration second. Never assume the live schema matches the files.

---

## 12. Service Layer Rules (Permanent)

- **`siteService.ts`:** Always send both `name` and `site_name` on insert — live DB has `name` column from original schema.
- **`jobService.ts`:** Do NOT send `latitude`/`longitude` — columns do not exist in live `job_posts` table.
- **`aadhaarVerificationService.ts`:** DB inserts are best-effort (non-fatal). Email is via Supabase Edge Function `send-email`. The `_devOtpFallback` in-memory variable is the fallback when the table is missing.
- **`adminEmployerService.ts`:** Uses an ephemeral Supabase client for `signUp` to avoid polluting the admin session. Always throw on auth errors before proceeding to profile/company inserts.
- **`applicationService.ts`:** Validate `company_id` and `site_id` are non-null on the job before inserting an application — `job_applications` has FK constraints on both.

---

## 13. Edge Functions

**Function:** `send-email` (`supabase/functions/send-email/index.ts`)
- Uses `denomailer` (pure Deno SMTP) — **not** `nodemailer` (npm: import crashes Deno)
- Requires signed-in user (checks `Authorization` header)
- SMTP config via Supabase secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`
- Deploy: `npx supabase functions deploy send-email --project-ref uiyllxfhmubtasczqmuj`

---

## 14. RLS Policy Rules

- `is_super_admin()` and `is_employer_aadhaar_verified()` DB functions are NOT deployed to live DB.
- All policies must use inline checks: `exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin')`
- Never write RLS policies that call these functions until they are confirmed deployed.
- See `supabase/migrations/202606090001_relax_aadhaar_write_policies.sql` for the correct pattern.

---

## 15. Employer Portal Architecture Note

The `/employer` portal (`src/employer/EmployerApp.tsx`) has **two Aadhaar verification entry points**:

1. `AadhaarGate` component (`src/components/auth/AadhaarGate.tsx`) → renders `AadhaarVerificationSlider` — used as a route wrapper
2. `AadhaarVerificationPage` function inside `EmployerApp.tsx` — the actual page at `page === 'aadhaar'`

When fixing Aadhaar OTP display bugs, **both components must be updated**. The main employer flow uses #2, not #1.

**Key state bug pattern to avoid:** `AadhaarVerificationPage` receives `key={refresh}` from parent. Calling `onChanged()` inside `sendOtp()` triggers a re-mount and wipes all local state. Only call `onChanged()` after successful OTP verification, not after sending.

---

## 16. Unknowns / Needs Confirmation

- **`employer/EmployerApp.tsx` data layer:** Mixes Supabase services and legacy `src/lib/storage.ts`. Confirm which features are fully migrated.
- **Realtime subscriptions:** None in frontend — confirm if needed.
- **Payment gateway:** `VITE_PAYMENT_GATEWAY_PUBLIC_KEY` present but no SDK in dependencies — confirm gateway.
- **Aadhaar API:** `lib/aadhaarService.ts` may call an external API — not fully audited.
- **`roles` table:** Must contain rows for `super_admin`, `employer`, `guard` — `profiles.role_id` FK depends on this.

---

## 17. Map System Architecture

### Provider Abstraction (IMPORTANT — read before touching any map code)

Maps are implemented through shared provider-agnostic components while Google Maps is the active provider.

```
VITE_MAP_PROVIDER=google
VITE_GOOGLE_MAPS_API_KEY=your_browser_restricted_google_maps_key
```

**Files:**

| File | Role |
|------|------|
| `src/components/map/types.ts` | Shared TS types: `LatLng`, `MapMarker`, `MapViewProps`, `LocationPickerProps` |
| `src/components/map/MapView.tsx` | Shared wrapper that renders the Google implementation |
| `src/components/map/LocationPicker.tsx` | Shared wrapper for click-to-pin picker |
| `src/components/map/google/GoogleMapView.tsx` | Google Maps impl of `MapViewProps` |
| `src/components/map/google/GoogleLocationPicker.tsx` | Google Maps impl of `LocationPickerProps` |
| `src/config/googleMaps.ts` | Google Maps API key and script config |
| `src/components/map/index.ts` | Barrel export |
| `src/lib/geoUtils.ts` | `distanceKm()` (haversine) + `getCurrentPosition()` (browser geolocation) |

**Per-role map components** (consume `MapView` / `LocationPicker` — never Leaflet directly):

| File | Used by | Purpose |
|------|---------|---------|
| `src/components/map/JobRadiusMap.tsx` | Guard `JobSearch.tsx` | Jobs as pins + guard radius circle + geolocation |
| `src/components/map/AdminOverviewMap.tsx` | Admin `Dashboard.tsx` | Guards (green) + Sites (red) + Jobs (blue) overview |
| `LocationPicker` (inline) | Employer `EmployerApp.tsx` site form | Click map → sets `form.latitude` / `form.longitude` |

### Google Maps setup

1. Enable Maps JavaScript API in Google Cloud.
2. Restrict the browser key by HTTP referrer for local, staging, and production domains.
3. Paste the key in `frontend/.env` as `VITE_GOOGLE_MAPS_API_KEY`.
4. Keep consumer components provider-agnostic (`JobRadiusMap`, `AdminOverviewMap`, site form).

### Marker colour convention
- **Blue `#1d4ed8`** — Jobs
- **Green `#166534`** — Guards
- **Red `#7c2d12`** — Sites
- **Purple `#5b21b6`** — Employers

### Coordinates availability
- `company_sites`: `latitude`, `longitude` columns exist in live DB
- `job_posts`: lat/lng do **NOT** exist in live DB — coordinates come from the joined `company_sites`
- `profiles` (guards): lat/lng defined in migrations but not confirmed in live DB
- `attendance_records`: `checkin_latitude/longitude`, `checkout_latitude/longitude` for geofencing

---

## 18. Core Requirements from Project Timeline

The project is scoped across 3 phases (12–15 weeks total). Use this as the authoritative feature checklist.

### Phase 1 — Core Platform & Job Marketplace (4–5 Weeks)
| Feature | Status in code |
|---------|---------------|
| User Registration/Login (Guard & Employer) | Implemented |
| Profile Creation (Guard + Employer) | Implemented |
| Document Upload (ID, Police Verification, Bank Details) | Implemented (`storageService.ts`) |
| Aadhaar API Integration (client-provided API) | Implemented (`aadhaarService.ts`) |
| **Google Maps Integration — Location & Radius-based job search** | Implemented through shared Google Maps components; runtime needs `VITE_GOOGLE_MAPS_API_KEY` |
| Employer: Create Company / Site | Implemented |
| Employer: Post Job | Implemented |
| Guard: Search Job (radius-based via Maps) | UI exists (`JobSearch.tsx`), radius filtering **not implemented** |
| Guard: Apply for Job | Implemented |

**Google Maps requirement:** Job search must filter by geographic radius. Guard sets location; jobs within radius are shown on the shared Google map. Requires `VITE_GOOGLE_MAPS_API_KEY`.

---

### Phase 2 — Hiring, Attendance & Payment (5–6 Weeks)
| Feature | Status in code |
|---------|---------------|
| Employer: View Applicants / Select / Reject | Partially implemented (`applicationService.ts`) |
| **Request Call / Video Interaction (Guard ↔ Employer)** | **Not implemented** — no service or UI found |
| Guard: Accept Job offer | Partially implemented |
| Attendance: In-Time / Out-Time Logging | Implemented (`attendanceService.ts`) |
| **Employer Verification step in hiring workflow** | Unclear — not documented |
| **Agreement Module: Digital onboarding / confirmation** | `agreements` table exists; UI/flow **not documented** |
| Wallet System (Coin-based) | `walletService.ts` exists; coin denomination logic **not documented** |
| Payment Gateway Integration | Key present (`VITE_PAYMENT_GATEWAY_PUBLIC_KEY`); SDK not found |
| **Payment Flow: Employer → Platform → Manpower** | Not implemented end-to-end |
| **OTP Confirmation for Cash Payment** | **Not implemented** |

**Payment flow requirement:** Employer funds wallet → platform holds → releases to guard after job confirmation. Cash payments require OTP confirmation from guard side.

---

### Phase 3 — Admin, Reports & Deployment (3–4 Weeks)
| Feature | Status in code |
|---------|---------------|
| Admin Panel | Implemented (`web-admin/`) |
| **Sub Admin Panel** | **Not implemented** — no sub-admin role, UI, or service found |
| **Block / Unblock Users** | **Not implemented** — no flag on `profiles` table |
| Dashboard: Real-time stats (Jobs, Guards, Revenue) | Basic stats in `Dashboard.tsx`; real-time **not implemented** |
| Reports: Area-wise availability | **Not implemented** |
| Reports: Language Skills | **Not implemented** |
| Reports: Commission Tracking | **Not implemented** |
| Reports: Manpower Availability | **Not implemented** |
| Reports: Earnings | Partial (`reportService.ts`) |
| Functional + Load Testing | **Not done** |
| **Deployment: Azure / AWS** | Currently Netlify — **cloud VM deployment not set up** |

**Sub Admin role:** Needs a new role (`sub_admin`) with scoped permissions — can manage company staff and sites but not platform-wide settings. Requires new RLS policies and a portal entry point.

**Block/Unblock Users:** Needs a `is_blocked` boolean on `profiles` + admin UI action + auth check on login to reject blocked users.

---

### Key Missing Features Summary (not yet in codebase)
1. **Google Maps runtime verification with purchased key** — confirm browser referrers and map loading in local/staging/production
2. **Sub Admin panel + role** — Phase 3 prerequisite
3. **Call/Video interaction** — Phase 2 (likely third-party: Twilio / Agora / Daily.co)
4. **OTP for cash payment** — Phase 2
5. **Agreement module UI** — DB table exists but no frontend flow
6. **Block/Unblock users** — Admin action, DB flag needed
7. **Commission tracking reports** — new report type
8. **Language skills on guard profile** — needed for reporting
9. **Azure/AWS deployment setup** — replace or supplement Netlify
