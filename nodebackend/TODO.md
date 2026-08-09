# Granvia Node backend TODO

The Node backend is feature-complete for the current port. The items below are net-new work
that should be scoped separately.

## Deferred / net-new features

- [ ] **Payment gateway integration** — wallet/payment/invoice *endpoints* are ported, but
  nothing charges a card. Wire the gateway SDK (`VITE_PAYMENT_GATEWAY_PUBLIC_KEY` present):
  employer funds wallet → platform holds → releases to guard; cash payments need OTP.
- [ ] **Real Aadhaar API** — guard + employer Aadhaar flows use a mock/email-OTP stub
  (`instantVerify` approves any valid 12-digit number). Swap send/verify internals for the
  client-provided Aadhaar API when credentials arrive; route contracts stay the same.
  Files: `src/controllers/guardAadhaarController.ts`, `src/controllers/employerAadhaarController.ts`.
- [ ] **Call/Video interaction** (guard ↔ employer) — Phase-2 requirement. Needs a third-party
  (Twilio/Agora/Daily.co) + service + endpoints + UI.

## Operational follow-ups

- [ ] Provide SMTP creds in `.env` (`SMTP_*`) to send real emails; until then OTPs return
  as `dev_otp` and mail is skipped (logged).
- [ ] Re-apply `prisma/filtered-indexes.sql` after any `prisma db push` (SQL Server allows
  only one NULL in a UNIQUE column; the filtered index restores unique-when-present on
  `users.mobile`).
- [ ] For go-live, re-run `npm run migrate:data` against the production MySQL, then point
  `DATABASE_URL` at the live SQL Server.
