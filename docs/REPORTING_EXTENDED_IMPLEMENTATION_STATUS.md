# Extended reporting implementation status

Updated: 2026-10-22, Asia/Kolkata.

The first implementation batch adds **24 role-specific report views using 10 shared report types**. Existing Employer/Super Admin reports and Sub Admin skills/estimated commission remain available. This is not completion of all 105 catalogue entries.

## Implemented first batch

| Role | New report views | Open in the UI |
|---|---|---|
| Super Admin (8) | Employer registrations/growth; Associate registrations/growth; Employer credits; Associate stored wallet balances; Associate movements; withdrawals/payout status; recruitment pipeline/ageing; invoice register/ageing | Reports → Registrations / credits / statements |
| Employer (5) | Own completed credits; applicants/workforce/pipeline; companies; sites; invoices | Reports → Credits / workforce / company reports |
| Associate (4) | Own stored balances; earnings/wallet movements; withdrawals/payout status; applications/work history | More → Reports & Statements |
| Sub Admin (3) | Assigned Employer registrations; assigned Associate registrations; assigned client recruitment pipeline | Reports → Registrations & hiring |
| Sales Executive (2) | Assigned client registrations/growth; assigned client hiring pipeline | Reports |
| Operations (1) | Recruitment pipeline/ageing for active assigned scopes | Reports |
| Finance (1) | Withdrawal register and request ageing | Reports |

Menu labels and permissions are returned by exact-role APIs. Lists and exports share the same scope. Employer and Associate owner IDs come from the signed-in account. Sub Admin/Sales use current profile assignments; Operations uses active Employer/company/site/job assignments. Empty assignments return empty reports. Super Admin cannot use another role's report endpoints as a bypass.

## Implemented calculations

- Registrations: selected-period count, pre-period count, cumulative retained accounts through the end date, current status breakdown, daily and monthly IST trends. Historical account status/assignment is not reconstructed. Trends above 10,000 matching accounts are explicitly unavailable until dates are narrowed; complete counts remain available.
- Employer credits: completed credit entries only, exact decimal total, source subtotals and references. Wallet ownership is authoritative. Failed/pending credits and debits do not inflate received credits. Current account balance is labelled separately from period closing.
- Associate balances: stored available, reserved and combined balances. Missing wallets remain visible with unknown values. Report reads do not create wallets or synchronise legacy payments.
- Associate statements: completed credits, final debits, reservations and releases are separate totals, with movement/status/reference breakdown. Historical opening/closing is unavailable because this ledger has no balance-after chain.
- Withdrawals: requested/fee/net totals by recorded status, decision date, rejection reason, gateway references and pending request age. Sensitive bank details, gateway response bodies and idempotency keys are excluded. No independent bank-settlement assertion is made.
- Recruitment: full-filter application counts, current status breakdown, distinct Associates, distinct currently hired/joined/leave-requested Associates within those applications, and elapsed time since application. This is not time in stage, historical conversion, or reconstructed tenure. Legacy null application owners are included through an authorised job; conflicting owners are excluded for scoped staff/Employer views.
- Company/site registers: own account records, with company ownership used for legacy sites lacking an Employer ID.
- Invoices: stored base/tax/face-value totals by status, calendar invoice/due dates and current overdue days. Invoice status alone is not used to invent partial-payment allocation or outstanding receivables.

## Shared behaviour

- IST timestamp date boundaries; SQL calendar dates remain calendar values.
- Default 50 rows, maximum 100; deterministic ordering; full-filter summaries.
- CSV includes all matching rows up to 5,000 and scope/filter/date/warning metadata. Oversized or incomplete exports fail; formula-like text is neutralised.
- Supported query keys are allowlisted and invalid dates/ranges are rejected.
- Searchable selectors for Super Admin Employer/Associate, Employer company and assigned Sub Admin/Sales clients. Selector results are capped at 500 with a visible narrowing message. More scope fields remain API-only in this first UI batch.
- Filters apply on Apply; stale requests are cancelled/ignored; explicit loading, empty, error, retry and warning states.
- Account-wide extended Employer reports are explicitly separate from the existing selected-company operational report view.
- No schema migration or financial/attendance mutation was introduced.

## Routes and source

All endpoints use the existing `/api` mount:

`/api/{portal}/reports/extended`

Portal names: `admin`, `employer`, `guard`, `subadmin`, `sales`, `operations`, `finance`.

- `GET /` returns only the signed-in role's implemented report definitions.
- `GET /options?kind=<kind>&search=<name>` returns permitted bounded selector labels.
- `GET /<kind>` returns rows, columns, summary, pagination and metadata.
- `GET /<kind>/export` returns the scoped CSV.

Implementation: `nodebackend/src/reporting/extendedReports.ts`, `nodebackend/src/routes/extendedReportRoutes.ts`, `frontend/src/services/extendedReportService.ts`, `frontend/src/components/reports/ExtendedReports.tsx` and the existing role shells.

Example standalone portal links after deployment (not live-verified):

- Super Admin: `https://granvia.llc/admin/reports?extended_report=employer-registrations`
- Employer: `https://granvia.llc/employer?extended_report=employer-credits`
- Associate: `https://granvia.llc/guard?extended_report=associate-statement`
- Sub Admin: `https://granvia.llc/sub-admin?extended_report=employer-registrations`
- Sales: `https://granvia.llc/sales?extended_report=employer-registrations`
- Operations: `https://granvia.llc/operations?extended_report=recruitment-pipeline`
- Finance: `https://granvia.llc/finance?extended_report=withdrawals`

The universal mobile app reuses these role screens. Use its Reports menu; authentication/routing may clear deep-link query parameters.

## Verification

- Final backend regression suite: **96 tests passed**, including **60 reporting tests / 16 new extended-report tests**, with HTTP role/export coverage.
- Backend build, frontend build, reporting-focused frontend type check and focused lint passed. Existing frontend large-chunk warning remains.
- Configured SQL Server read-only verification: 20 report/selector paths passed for active Super Admin, Employer, Associate and Sub Admin accounts. Sales, Operations and Finance had no active accounts, so their configured-database verification is explicitly incomplete. Their fixture HTTP/ownership tests pass.
- Runtime evidence: `nodebackend/api-smoke-artifacts/EXTENDED_REPORTING_RUNTIME_VERIFICATION.json`. The verifier returns a nonzero exit status for incomplete role coverage; it does not manufacture test accounts or claim all queries were verified.
- No browser/app surface is connected. Authenticated browser/WebView, deployment, production bearer-token HTTP, and representative-volume performance checks remain outstanding.
- Final regression/build results are recorded in `GRANVIA_VALIDATION_AUDIT.md`.

Commands:

```powershell
# nodebackend
npm.cmd run test:reports
npm.cmd run build
npm.cmd run verify:reports:extended:readonly -- 2026-10-22
$reportTestFiles = @(rg --files tests -g '*.test.ts' -g '*.test.cjs')
& .\node_modules\.bin\tsx.cmd --test @reportTestFiles

# frontend
npm.cmd run typecheck:reports
npm.cmd run build
npx.cmd eslint src/components/reports/ExtendedReports.tsx src/services/extendedReportService.ts src/employer/EmployerReportingHub.tsx src/web-admin/pages/Reports.tsx
```

## Remaining implementation

The catalogue remains the inventory for subsequent role-wise work. These gaps are not represented by placeholders in the report menu:

1. Management summaries, activation funnels, verification turnaround, geography/type/skill breakdowns and document exceptions.
2. True recruitment conversions/time-to-fill, platform interview/offer/agreement reporting, onboarding readiness, retention/releases and staff productivity.
3. Personal Associate profile, interviews/offers/agreements, attendance/corrections, feedback/support and payroll reports.
4. Dated roster staffing gaps, absence, punctuality and overtime require agreed roster/calendar/grace/leave rules and reliable historical records.
5. Funding forecasts, actual collections/receipts, financial reconciliation, actual commission/revenue/tax, and receivable allocation require their authoritative business records. Mock recharges and estimated commission must remain visibly distinguished.
6. General Finance wallet/financial access needs an explicit scope model. Current Finance APIs are platform-wide for withdrawal review only; this change preserves that scope instead of exposing all Employer/Associate wallets.
7. Financial summaries for Sales/Sub Admin need explicit financial permissions. Existing assignments alone do not grant those reports.
8. Lead conversion, sales targets, attribution, assignment history, export-access audit and scheduled report delivery need the relevant persisted events/configuration.
9. Full selectors/drill-downs, filter persistence, Excel/PDF/print and volume tuning remain follow-up report UI work.
