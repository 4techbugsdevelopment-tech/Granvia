# Granvia Reporting — Phase-wise Implementation Summary

Date: 2026-10-12 (client timezone: Asia/Calcutta)

## Delivery status

Reporting implementation for Employer and Super Admin is complete through Phase 4. Phase 5 automated, build, lint, focused type-check and configured SQL Server query checks are complete. Browser/mobile acceptance and verification of the published HTTP endpoints remain outstanding: this session has no connected browser surface, and deployment was not performed.

The configured database was queried read-only. No database schema, migration, wallet, attendance, payment, agreement or other business record was changed by the reporting implementation or runtime verification.

| Phase | Implemented work | Verification status |
|---|---|---|
| 1 — Shared foundations | Exact-role checks; Employer ownership and parent-scope validation; IST timestamp versus calendar-date ranges; pagination; decimal filters; stable ordering; response metadata and partial-data warnings; CSV escaping and incomplete-export rejection | Automated tests passed; shared helpers are used by the report APIs |
| 2 — Employer operational registers | Job & Hiring; Interview/Offer/Agreement; Attendance & Approval, with applications and exceptions as independent drill-downs/tabs | Fixture HTTP/security tests and configured-database query checks passed |
| 3 — Super Admin operational registers | Platform Summary; Employer/Company Verification; Associate Verification/Profile; Platform Job & Hiring; Attendance/Exceptions/Audit | Fixture HTTP/security tests and configured-database query checks passed |
| 4 — Financial reports | Employer Payment & Settlement and Wallet Statement; Super Admin Employer Wallets, Wallet Movements and Settlement Monitoring | Financial tests, builds and configured-database query checks passed |
| 5 — Verification and hardening | All backend regression tests; report-module frontend checks; read-only schema/runtime verifier; bounded related-record reads; orphan-wallet handling; redacted runtime evidence | Automated and database-query checks passed; browser/mobile and published HTTP acceptance pending |

## Phase 1 — Shared API and security foundations

Backend files: `nodebackend/src/reporting/query.ts`, `scope.ts`, `response.ts`, `index.ts`.

Frontend contract: `frontend/src/lib/reportTypes.ts`.

Implemented:

- Report roles are enforced on list and CSV endpoints. Super Admin does not access Employer endpoints through an implicit bypass.
- Employer ID comes from the signed-in account; an Employer-supplied `employer_id` is rejected.
- Company, site and job IDs are validated against the requested ownership and parent relationships.
- Timestamp date filters use IST midnight converted to UTC, with an inclusive start and exclusive next-day end. SQL calendar dates remain calendar values.
- Query validation rejects invalid calendar dates, reversed ranges, invalid IDs, unsupported filters and unsupported date bases.
- Default page size is 50; maximum page size is 100. ID is a stable ordering tie-breaker.
- Summaries and total counts cover the complete filtered dataset, not just the current page.
- Monetary calculations use Prisma decimals; report values preserve two-decimal financial amounts where applicable.
- Related-record reads deduplicate IDs and use batches of at most 500.
- Responses include scope, applied filters, named date basis, generation time and warnings.
- CSV escapes quotes, commas, newlines and Unicode, neutralises formula-like cells, refuses incomplete datasets and rejects oversized exports.
- Reporting queries are read-only. Existing automatic checkout, wallet creation, wallet synchronisation, approval and settlement handlers are not called by report reads.

## Phase 2 — Employer operational registers

Navigation: **Employer → Reports → Hiring / documents / attendance**.

Screen: `frontend/src/employer/EmployerReportsPage.tsx`.

| Register | What is available | Date basis |
|---|---|---|
| Job & Hiring | Job/company/site/type, job status, required/application/filled/remaining counts, separate hired/joined/leave-requested counts; application drill-down | Job posting: `job_posts.created_at`; application drill-down: `job_applications.applied_at` |
| Interview, Offer & Agreement | Separate tabs; Associate/job/site, request/offer/agreement status, scheduling and offer terms, party confirmations and signing dates | Interview `created_at` or `preferred_date`; offer `created_at` or `start_date`; agreement `created_at` or `signed_at` |
| Attendance & Approval | Sessions, times/hours, statuses, entry and checkout modes, remarks and linked settlement evidence; separate exception requests | Attendance `attendance_date`; exception `created_at` or `decided_at` |

Operational registers use the selected company. Associate/type/job/site selectors are populated through a narrow report-options endpoint. Company switching remounts the report view; stale requests are aborted or ignored.

Filled positions follow the existing capacity definition: `hired`, `joined`, `leave_requested`. Current filled positions are not restricted by an application-date range when reporting jobs selected by posting date. Remaining positions are clamped per job. Overfilled jobs are flagged.

Employer operational records without sufficient job/company linkage are outside a company register; the screen states this explicitly. Financial account views provide access to unattributed payments.

## Phase 3 — Super Admin operational registers

Navigation: **Super Admin → Reports → Operational reports**.

Screen: `frontend/src/web-admin/pages/OperationalReports.tsx`.

| Register | What is available | Date basis |
|---|---|---|
| Platform Operational Summary | Current account/job/application/attendance status counts separately from registrations, postings, applications, attendance hours and payment creation activity | Named per metric; registrations/job/payment creation use `created_at`, applications `applied_at`, attendance `attendance_date` |
| Employer & Company Verification | Employer, company and document tabs; account/profile/Aadhaar/company/document statuses, assignments, geography and related counts | Employer `users.created_at`; company `created_at`; document upload `created_at` |
| Associate Verification & Profile | Account/overall/Aadhaar/police statuses, uploaded document counts and current onboarding agreement; separate document-review register | Registration `users.created_at`; document `created_at` or `reviewed_at` |
| Platform Job & Hiring | Shared capacity calculation with Employer reporting, adding Employer identity and platform scope | Job `created_at`; application `applied_at` |
| Attendance, Exceptions & Audit | Independent tab pagination/totals; actor, event type/time, references and remarks; settlement status remains separate from attendance approval | Sessions `attendance_date`; requests `created_at`/`decided_at`; audit `event_at` or `attendance_date` |

Super Admin filters narrow platform scope. Parent-scope conflicts are rejected. Unsupported filter combinations are rejected rather than applied to unrelated metrics.

Missing profiles remain visible with unknown verification fields and warnings. Overall verification is a stored status, not a newly invented readiness formula. Current onboarding agreements follow `current_key = associate_partner_id`; historical versions are not substituted.

Broad admin attendance retains unlinked records. Company/site/job filters narrow records through the relevant job relationship. Exact GPS, IP address, user-agent and identity-document contents are excluded from these registers and exports.

The older area/language/commission analytics remain available separately. Their screen now explains that availability is inferred, language is profile data and commission is a 10% estimate rather than a posted fee ledger.

## Phase 4 — Financial reports

Shared financial engine: `nodebackend/src/reporting/financialReports.ts`.

Shared screen: `frontend/src/components/reports/FinancialReports.tsx`.

Employer navigation: **Reports → Payments / wallet statement**.

Super Admin navigation: **Reports → Wallet & settlement monitoring**.

| Report | Implemented behaviour |
|---|---|
| Employer Payment & Settlement | Company or Employer-account scope; amount/status/method/linkage/date filters; exact status totals; payment, attendance and application references; Employer debit and Associate credit evidence; investigation flags |
| Employer Wallet Statement | Account-wide current total/deposit/admin-credit balances; complete filtered movement totals; account-period completed credits/debits; conditional reconstruction of account opening/closing; no company wallet assumption |
| Super Admin Employer Wallets | Current stored balances and component totals; registered Employers without a wallet remain visible as `not-created` with unknown balances |
| Super Admin Wallet Movements | Full filtered transaction breakdowns and references; explicit mock recharge warning; orphan wallet references retained in the broad platform view without assigning an Employer |
| Super Admin Settlement Monitoring | Platform or narrowed payment scope, lifecycle totals, linked debit/credit amounts/statuses, missing/duplicate/mismatching reference flags |

### Payment attribution and lifecycle

- Payment company attribution uses consistent, ownership-matched job references from the payment, attendance or application.
- Missing or conflicting references are not guessed from the active company.
- Linkage classifications are `attendance-linked`, `application-only`, `job-only`, `unlinked`, `missing-reference` and `conflicting`.
- Company/site/job reports identify excluded unattributed account payments. Account/platform views retain them for investigation.
- Debit and credit evidence joins use reference type and ID, then check the owning wallet.
- Expected debit/credit investigation checks apply to processing/completed payments. Pending creation is not automatically labelled a missing settlement.
- Processing, completed payment, Employer debit, Associate credit and bank payout remain separate meanings.
- Payment date filtering uses `payments.created_at` or stored `payments.payment_date`. The latter is explicitly not a completion timestamp.
- Diagnostic flags are investigation aids, not conclusions about fraud or confirmed bank settlement.

### Wallet history

- Wallet scope is Employer-account-wide across companies. Company/site filters are rejected for a statement.
- Job, Associate, source or status filters narrow displayed movements. They do not create a separate wallet, or change the account-wide period balances.
- Wallet movement date filtering uses `wallet_transactions.created_at`, not nullable `posted_at`.
- Historical reconstruction is attempted only for up to 10,000 completed entries.
- Reconstruction requires a zero-origin recorded chain with known sources, valid dates, recorded balances after each entry, and agreement with current balance, component balance and recharge/credit/debit counters.
- Unknown sources, missing dates/balances, ambiguous ordering, counter mismatch or excessive history produce unavailable opening/closing balances.
- A passing reconstruction is labelled **reconstructed from recorded ledger**. It is not proof of immutable historical completeness or bank reconciliation.
- No wallet is created during a report read. Missing wallets have unknown balance, not an invented zero balance.
- Mock recharges are visibly different from verified bank collection.

### Exports and limits

- Lists use server pagination; CSV includes all matching rows up to 5,000.
- Date, scope, warning and full-filter summary metadata are included on financial data rows. Empty CSV datasets contain headers only.
- Missing required financial evidence blocks export and evidence-dependent filters instead of supplying false zero evidence.
- Historical-balance warnings do not remove valid movement rows from the report or export.
- Large-data query plans and latency require further validation against representative production volume; the successful runtime check used the configured database's current records.

## Phase 5 — Verification results

| Check | Result |
|---|---|
| Reporting-focused backend tests | 44 passed |
| Full backend test suite, including reporting and existing lifecycle/reserve/validation tests | 80 passed |
| Backend production build and Prisma Client generation | Passed |
| Frontend production build | Passed; existing large-chunk warning remains |
| Reporting frontend type check | Passed using `frontend/tsconfig.reporting.json` |
| Focused lint across reporting components and services | Passed |
| Full frontend type check | Fails on existing project errors outside the reporting modules, including legacy Employer screen/service/admin model issues; not reported as passed |
| Diff whitespace check | Passed |
| Configured SQL Server schema check | 18 required tables and their checked columns present |
| Configured SQL Server report queries | All 23 report query paths passed; one admin wallet-movement query returned the expected mock-recharge warning |
| Browser/mobile acceptance | Not performed: no browser or native app surface is connected to this session |
| Published bearer-token HTTP/API acceptance | Not performed; fixture HTTP tests passed, but deployment was not carried out |

Runtime evidence: [REPORTING_RUNTIME_VERIFICATION.json](../nodebackend/api-smoke-artifacts/REPORTING_RUNTIME_VERIFICATION.json).

The runtime verifier uses a selected active Super Admin and Employer account from the configured database, and checks the selected Employer's company where needed. It reports counts and warning codes without publishing names, account IDs, connection credentials, bank details or document contents. Successful service/SQL queries do not establish browser behaviour, every tenant's data quality, or published API availability.

## Report endpoint inventory

All paths below include the existing `/api` mount. Every report list below also has a GET `/export` suffix.

| Role | Report endpoints |
|---|---|
| Employer operational | `/api/employer/reports/job-hiring`, `/applications`, `/interviews`, `/offers`, `/agreements`, `/attendance`, `/attendance-exceptions` |
| Employer financial | `/api/employer/reports/payments`, `/wallet-statement` |
| Super Admin operational | `/api/admin/reports/platform-summary`, `/employer-verification`, `/company-verification`, `/company-documents`, `/associate-verification`, `/associate-documents`, `/job-hiring`, `/applications`, `/attendance`, `/attendance-exceptions`, `/attendance-audit` |
| Super Admin financial | `/api/admin/reports/wallets`, `/wallet-movements`, `/settlements` |

In each row, endpoints after the first entry share that row's `/api/<role>/reports` prefix. Filter-option endpoints are `/options` and `/financial-options` under each role's report prefix.

Route mounting is in `nodebackend/src/routes/employerRoutes.ts` and `adminRoutes.ts`; dedicated routers are `employerReportRoutes.ts` and `adminReportRoutes.ts`. Existing operational endpoint response shapes and financial mutation rules remain unchanged.

## Reproducible checks

From `C:\reactprojects\granvia\nodebackend`:

```powershell
npm.cmd run test:reports
npm.cmd run build
npm.cmd run verify:reports:readonly -- 2026-10-12

# Broader regression suite:
$reportTestFiles = @(rg --files tests -g '*.test.ts' -g '*.test.cjs')
& .\node_modules\.bin\tsx.cmd --test @reportTestFiles
```

The read-only verifier accepts a calendar date. Use the intended verification date; it checks activity from that month's first day through that date. It reads the existing backend database configuration and performs no migration or business-data writes.

From `C:\reactprojects\granvia\frontend`:

```powershell
npm.cmd run typecheck:reports
npm.cmd run build
npx.cmd eslint src/lib/reportTypes.ts src/services/employerReportService.ts src/services/adminReportService.ts src/services/financialReportService.ts src/employer/EmployerReportsPage.tsx src/employer/EmployerReportingHub.tsx src/components/reports/FinancialReports.tsx src/web-admin/pages/OperationalReports.tsx src/web-admin/pages/Reports.tsx
```

## Remaining release acceptance

1. Deploy the built backend/frontend through the existing deployment process and restart the actual backend service. No new reporting migration was introduced.
2. Verify the published report routes with real authenticated Employer and Super Admin sessions; test an unauthorised role and a foreign-company ID.
3. Browser-test all report groups on desktop/mobile: dependent filters, company changes, reload, refresh, pagination, exports and loading/empty/error/partial states.
4. Verify real account wallet opening/closing reconstruction against recorded ledger evidence; investigate warnings instead of suppressing them.
5. Check query performance and export latency with representative production data sizes.
6. Resolve the existing full-project frontend type-check failures before claiming a clean project-wide type check.

Payroll, actual posted commission, invoice receivables, bank/gateway reconciliation, dated roster absence/punctuality and reports for other roles were not implemented in this first release. Their earlier data/definition dependencies remain applicable.
