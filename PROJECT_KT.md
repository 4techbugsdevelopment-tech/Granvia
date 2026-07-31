# 📌 PROJECT_KT.md — Granvia Master Knowledge Transfer (MUST READ)

> **Status:** Authoritative product/functional spec for Granvia.
> **Read this alongside** [`CLAUDE.md`](CLAUDE.md) (repo navigation), [`PROJECT_CHANGES.md`](PROJECT_CHANGES.md) (active task list), and [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md).
> Compiled from SRS, project timeline, brand assets, and operational transcripts.

---

## ⚠️ 0. Reconciliation Notes (read before trusting any section)

These are known divergences between this KT document and the actual codebase as of **2026-07-30**. Verify against live code before acting.

| Topic | This KT says | Codebase reality | Action |
|-------|--------------|------------------|--------|
| **Backend** | Supabase (Auth + DB) — marked "[User Context]" | Migrated to **Laravel API**; in-progress port to **Node + SQL Server** (`nodebackend/`, auth vertical done). `backend-laravel-backup/` present. | **Confirm intended backend with product owner.** Treat Supabase references here as legacy business context, not current architecture. |
| **Role terminology** | "Service Partner" / "Associate Partner" (brand-preferred over "Guard") | Code still largely uses `guard` role + "Guard" UI strings. | Rename is a branding task, not yet done. Use `guard` role internally; display "Associate Partner" per brand. |
| **Sub-Admin / Sales Executive roles** | Full roles defined below | Not implemented (no `sub_admin` / `sales_executive` role, RLS, or portal). | New work — see §2 and Phase 3 gaps. |
| **Radius job search** | Core Phase-1 feature | Map abstraction exists (Leaflet); radius filtering not wired end-to-end. | Highest-priority Phase-1 gap. |

When a section here conflicts with code, **code + `PROJECT_CHANGES.md` win for "what exists"; this KT wins for "what the business wants."**

---

## 1. Project Overview & Business Logic

**Project Name:** Granvia
**Business Vision:** Bridge the gap in the manpower industry by creating a 100% verified, real-time marketplace where employers find nearby service partners (manpower) and service partners find flexible work within a specified radius.
**Core Problem:** Workers are available but employers lack visibility into their locations or verification status. Granvia solves this via the **"Prime Key"** — a database of Aadhaar- and Police-verified users.

**Tech Stack (per KT source):**
- **Frontend:** React (Web for Admin/Employer) and React Native (Mobile for Service Partner/Employer).
- **Backend:** Supabase (Auth + Database) *[User Context — see Reconciliation §0; actually Laravel/Node in code].*
- **Integrations:** Google Maps API (location), Aadhaar Verification API, SMS/Email OTP API, Payment Gateway.

---

## 2. User Roles & Responsibilities

| Role | Responsibilities | Permissions / Access |
|------|------------------|----------------------|
| **Service Partner (Manpower)** | Profile management, KYC upload, setting availability, radius-based job search, attendance logging, wallet management. | Mobile app; can apply for jobs, manage own wallet, do P2P transfers. |
| **Employer (Client)** | Managing sites/companies, posting jobs, interviewing candidates, verifying attendance, wallet settlement. | Web/mobile; can hire manpower, verify logs, manage site billing. |
| **Sales Executive** | Intermediary between clients and the platform. | Web/mobile; can post jobs for clients (**OTP-secured**) and apply discounts to employer billing. |
| **Sub-Admin** | Regional management of a specific branch or company. | Web/mobile; manage own staff, clients, and assigned manpower; view localized reports. |
| **Super Admin** | Global system oversight, master CRUD, dispute resolution. | Web/mobile; global reporting, user block/unblock, commission tracking, master-entry management. |

---

## 3. Module & Feature Breakdown

### 3.1 Profile & Verification ("Prime Key")
- **Aadhaar Verification:** Government-linked API triggers an OTP to the partner's registered mobile.
- **Police Verification:** Manual document upload by the user. **Manual Admin approval** required to grant verified status until an automated API exists.
- **KYC Elements:** Name, Address, Qualification, Skills (English, 12th pass, etc.), Bank Details.

### 3.2 Marketplace & Radius Search
- **Google Maps Slider:** Service Partners set a radius from **1km to 15km+**, or choose **"Walking Distance"**, to find nearby jobs.
- **Availability Heatmap:** Employers/Admin view available manpower on a map to see "Pre-Verified" people in the immediate neighbourhood.

### 3.3 Job Categorization & Scheduling
- **Shift Durations:** **4h (Half Day)**, **8h (Full Day)**, **12h (Full Day + Overtime)**.
- **My Availability:** Partners select specific dates and standardized shift slots (**7 AM–7 PM** or **7 PM–7 AM**) they are open to work.

### 3.4 Wallet & Financial Ecosystem
- **Credit System:** **1 INR = 1 Coin/Credit.**
- **P2P Transfer:** Internal coin transfer between partners/users to avoid banking hurdles.
- **Settlement:** Daily **EOD** (End of Day) account clearing.
- **Employer Wallet:** Must maintain a **minimum balance (≥ 1 day's pay)** to guarantee service.

---

## 4. End-to-End User Journeys

### 4.1 Service Partner Journey
1. **Registration:** Enter name and mobile.
2. **Verification:** Input Aadhaar (triggers OTP); upload scan of Police Verification.
3. **Profile Setup:** Define residential location and search radius.
4. **Availability:** Select dates/shifts (7–7 module).
5. **Search/Apply:** Browse job cards, "Flip" for details, click "Apply".
6. **Interviews:** Participate in video or phone calls initiated by the employer.
7. **Operations:** Click "In-Time" on arrival, "Out-Time" on departure.
8. **Wallet:** View EOD credits; request bank withdrawal or P2P transfer.

### 4.2 Employer Journey
1. **Onboarding:** Create company/site profiles with GPS pins.
2. **Job Posting:** Select manpower count, shift category, required skills.
3. **Selection:** Filter applicants, view "Verified" badges, schedule interviews.
4. **Verification:** Verify partner's In/Out time logs daily.
5. **Payment:** Load wallet; system deducts coins daily based on verified hours.

---

## 5. Detailed Screen & Interaction Specifications

### Screen: Marketplace (Service Partner)
- **Purpose:** Job discovery based on proximity.
- **UI Elements:** Google Map with radius circle; list of Job Cards.
- **Filters:** Radius slider (1km–15km+), Duration (4/8/12h), Shift (Day/Night).
- **Button — Job Card Flip:** Click card → 3D flip animation. Front = Site/Salary; Back = detailed Requirements + Apply button.
- **Button — Apply:** Click → **validate Aadhaar/Police verification complete**. If not, popup: *"Please complete KYC"*.

### Screen: Attendance Dashboard (Shared)
- **Purpose:** Operational time logging.
- **Button — In-Time/Out-Time:** Click → **precondition: user within Site Geofence (GPS check)** → backend logs timestamp and notifies Employer.
- **Employer Action — Verify/Approve Logs:** **Business rule:** verified logs trigger coin deduction from Employer wallet → Partner wallet.

### Screen: Job Posting Wizard (Employer / Sales)
- **Purpose:** Create job requirements.
- **Forms:** Category select (4/8/12h), Skill checklist (English, Education), Manpower count.
- **Button — Post Job:** **Sales Executive rule:** must trigger a **Confirmation OTP** to the Client/Employer. Job is **not live until OTP verified.**

---

## 6. Business Rules & Operational Logic
- **Verification Manual Fallback:** Until full API automation, Admin/Sub-Admin must manually review Police Verification scans and Bank details to approve accounts. *[SRS 3.1.2, 3.5.3]*
- **Hourly Wage Calculation:** Wages per hour. E.g. 12 hours = 12× hourly rate.
- **Daily Settlement:** Accounts settled daily. Partners can withdraw **24h after** funds reflect in wallet.
- **Cash Backup:** If Employer pays cash, they must enter an **OTP Confirmation** in the app to reconcile the digital wallet balance.
- **Sales Discounting:** Sales Executives can apply discounts to the billing rate for specific clients.

---

## 7. Open Questions & Conflicts
- **Police Verification:** SRS says manual upload; audio discusses potential online API linking for "face-to-face" integration. **Current direction: Manual Admin approval.**
- **Sub-Admin Assignment:** How Super Admin assigns specific clients/manpower to a Sub-Admin is **not specified** beyond regional scope ("own company/clients").
- **Sales Commissions:** Exact platform commission % in the Employer → Platform → Manpower flow is **not specified**.

---

## 8. Brand Identity (Design Reference)
- **Terminology:** Use **"Associate Partner"** instead of "Guard" for professional appeal.
- **Colors:** Primary **Navy Blue `#1A2B56`**; Secondary/CTA **Burgundy `#7A2621`**; Typography **Earth Brown `#4B2E2A`**.
- **UI Effects:** Smooth horizontal **"Information Sliding"** for wizard steps; **3D "Card Flipping"** for job details.

---

## 9. Feature Status Cross-Reference (KT → code)

| KT Feature | Implementation status |
|------------|-----------------------|
| Aadhaar OTP verification | Partial (service exists) |
| Police verification + manual admin approval | Upload exists; approval flow to confirm |
| Radius-based job search (Maps slider) | **Gap** — map layer present, radius filter not wired |
| Availability heatmap | **Not implemented** |
| Shift categories (4/8/12h) + 7–7 availability | **Not implemented / confirm** |
| Wallet coins (1 INR = 1 coin) | Wallet service exists; coin logic to confirm |
| P2P transfer | **Not implemented** |
| Daily EOD settlement | **Not implemented** |
| Geofenced In/Out attendance | Attendance exists; geofence check to confirm |
| Employer verify logs → coin deduction | **Not implemented end-to-end** |
| Sales Executive role + OTP job posting | **Not implemented** |
| Sub-Admin role + regional scope | **Not implemented** |
| Block/unblock users | **Not implemented** (no DB flag) |
| Cash payment OTP reconciliation | **Not implemented** |
| Commission tracking | **Not implemented** |
| 3D card flip / sliding wizard | Partial (FlipCard component exists) |
| Brand colors / "Associate Partner" rename | **Not applied** |

> Keep this table synced with `PROJECT_CHANGES.md` / `PROJECT_TODO.md` as work lands.
