# Granvia — Remaining Work (Cross ❌ & Yellow 🟡 items)

_Created 2026-07-11. Working checklist to close the gaps found in the `TimelineSummary.docx` vs. code comparison._

Status: ☐ not started · ◐ in progress · ☑ done
Ref docs: `PROJECT_CHANGES.md` (SRS audit), `PROJECT_PROGRESS.md` (status snapshot).

---

## 0. Locked-in decisions (from requirements Q&A)

- **Aadhaar** → no real API. Mock: enter 12-digit number → **instant approve**.
- **Maps** → stay on **Leaflet** until a Google Maps API key is provided. Add real radius filtering now.
- **Payment gateway** → none. **Mock**: click Pay → processing animation → "Payment done".
- **SMS OTP** → none yet. OTP shown **in-app / dev mode** (no SMS send).
- **Wallet / payments** → build the full flow now against the **simulated gateway** (swap real gateway later).
- **Commission** → **flat fee per settlement**. Default **₹50** (configurable) — change if needed.
- **Deployment (Azure/AWS)** and **testing (functional/load)** → **skipped** for now.

---

## Slice 1 — Phase 1 finish

### 1a. Aadhaar instant-approve mock — ☑ DONE (live-verified)
- ☑ Backend `instantVerify` on `GuardAadhaarController` + `AadhaarVerificationController` (+ routes)
- ☑ Frontend services (`guardVerificationService`, `aadhaarVerificationService`)
- ☑ Guard `ProfileScreen` Aadhaar sheet → single-step enter-number → verify
- ☐ Employer Aadhaar UI (`EmployerApp` AadhaarVerificationPage) → switch to instant path
- ☐ Browser walkthrough (guard + employer)

### 1b. Radius-based job filtering — ☐
- ☐ Filter the guard job **list** (not just the map circle) by distance ≤ radius using `geoUtils.distanceKm()` and guard location
- ☐ Radius slider available in list view too; persist guard `search_radius_km`
- ☐ Guard residential location set via map/pincode (reuse `LocationPicker`) + save
- ☐ Seed a company site (with lat/lng) + active job so radius is demoable

---

## Slice 2 — Guard availability (Phase 1/3 dependency)

- ☐ `guard_availabilities` table (guard_user_id, duration 4/6/8/12hr, frequency Regular/Weekly/Daily, days, active)
- ☐ Guard CRUD endpoints + rewire `AvailabilityScreen` (currently demo)
- ☐ Employer "View Available Guards" endpoint + rewire `AvailableGuardsPage` (currently demo)
- ☐ Feeds admin area-wise availability report (Slice 5)

---

## Slice 3 — Phase 2 money layer (biggest) — ☐

### Wallet & coins
- ☐ Generalize wallet to any user (or add guard wallet); coin ledger via `wallet_transactions`
- ☐ Wallet top-up (simulated gateway) writes credit transactions
- ☐ Guard coin balance + withdrawal request flow (rewire `WalletScreen`, currently demo)

### Simulated payment gateway
- ☐ Mock gateway service: click Pay → processing animation → success; writes payment + transaction
- ☐ Payment flow **Employer → Platform → Manpower** end-to-end
- ☐ Flat-fee commission (₹50/settlement, configurable) recorded per payment

### Cash payment OTP
- ☐ Employer marks cash paid → OTP to guard (in-app/dev, no SMS) → guard confirms → payment confirmed
- ☐ Rewire employer `CashPaymentPage` (currently demo) to live

### Deliverables
- ☐ Payment system functional · wallet & transactions enabled (per timeline Phase 2)

---

## Slice 4 — Hiring workflow completion (Phase 2)

- ☐ Guard **Accept Job** flow completed (job offers → acceptance → status)
- ☐ Agreement module UI (digital onboarding/confirmation) — `agreements` table + endpoints exist; build employer + guard UI
- 🟡 Request Call/Video interaction — interview-request scheduling exists (calls off-platform). In-app video = out of scope (needs Twilio/Agora). Leave as request-based unless a provider is arranged.

---

## Slice 5 — Phase 3 admin reports & dashboard

- ☐ Admin report: **Area-wise manpower availability** (needs Slice 2 + guard location)
- ☐ Admin report: **Language skills** (from `guard_profiles.languages`)
- ☐ Admin report: **Earnings / commission** (from payments + flat-fee commission, Slice 3)
- ☐ Per-site billing filter for invoices/payments
- 🟡 Dashboard "real-time" stats — live-on-load counts already exist; true push/websocket = out of scope (optional auto-refresh)

---

## Explicitly deferred (not in this pass)

- ☐ Real Aadhaar API (client credentials) — mock in place
- ☐ Google Maps provider (API key) — Leaflet in place
- ☐ Real payment gateway (client account) — simulated in place
- ☐ SMS OTP provider — in-app/dev OTP in place
- ☐ Functional + load testing
- ☐ Cloud deployment (Azure / AWS)

---

## Notes

- **Sales Executive** + **Sub Admin** roles are already **live** (backend + frontend, verified) — done earlier this session; not part of this remaining list.
- All new work is verified against the live MySQL DB (recreated 2026-07-11) and seeded demo accounts (`admin/employer/guard/sales/subadmin @granvia.test`, password `password`).
