# Granvia — proposed report catalogue for all roles

Prepared: 2026-10-22 (Asia/Kolkata).

Implementation has started. The first batch adds 24 role-specific views across all seven roles; see [implementation status](REPORTING_EXTENDED_IMPLEMENTATION_STATUS.md) for exact coverage, limits and verification. **Partial** below means a working subset exists and the whole catalogue entry is not complete.

This is a planning catalogue with tracked implementation status, not a deployment claim. It covers the seven current business roles. Proposed access does not grant permission. Existing report code was checked against the reporting summary, frontend report screens, report routers, and Sub Admin report handlers. Role workflow documents describe intended workflows and do not prove every underlying feature is implemented.

## Status legend

- **Existing**: a dedicated report/register is present in current local source; live availability is not established here.
- **Extend**: an existing report or analytics screen provides a foundation, but the proposed metrics, history, or breakdown require more work.
- **Proposed**: a new dedicated report is needed, even if related screens or APIs already exist.
- Dependencies listed later must be checked before implementation. A report must explicitly show unavailable data rather than manufacture it.

## Access policy to use when designing reports

| Role | Proposed report scope |
|---|---|
| Super Admin | Platform-wide, with drill-down by Employer, company, site, job, Associate, assigned staff and geography |
| Employer | Own account, companies, sites, jobs and associated work records; personal Associate finance only where it directly evidences the Employer's payment |
| Associate | Own profile, applications, assignments, attendance, earnings, wallet and withdrawals |
| Sub Admin | Assigned Employers, companies and Associates; financial views only through an explicit scoped permission |
| Sales Executive | Assigned clients, own sales activity and authorised commercial summaries; no general Associate wallet access |
| Operations | Assigned Employer/company/site/job workflows; settlement status and funding alerts where authorised; no unrelated wallet statements |
| Finance | Assigned financial scope, payment evidence, wallets, withdrawals and reconciliation; identity/bank fields only as needed for financial duties |

Employer users must not receive platform-wide Employer/Associate registration counts. Their equivalent is their own company/team growth and the distinct Associates who applied, were hired or joined their jobs. These are different measures, not registrations on the platform.

## 1. Super Admin

| ID | Report | Contents | Status |
|---|---|---|---|
| SA01 | Platform management summary | Registration, verification, jobs, hiring, attendance and financial KPIs with drill-down | Extend |
| SA02 | Employer registration and growth | New, cumulative, active, inactive and blocked Employers; daily/monthly trends; geography and assignment | Partial — counts and IST trends implemented |
| SA03 | Associate registration and growth | New and cumulative Associates; Type/Category, geography, verification and source where recorded | Partial — counts and IST trends implemented |
| SA04 | Registration-to-activation funnel | Registered → profile complete → verified → first job/application → first completed work/payment | Proposed |
| SA05 | Employer verification | Account/profile/Aadhaar status, ownership and pending verification | Existing |
| SA06 | Company verification and documents | Company and document registers, statuses and references | Existing |
| SA07 | Associate verification and documents | Overall/Aadhaar/police/document status and current onboarding agreement | Existing |
| SA08 | Verification ageing and turnaround | Pending age, decision times, rejection reasons, repeated submissions and reviewer workload | Proposed |
| SA09 | Account and document exceptions | Missing profiles, incomplete mandatory data, duplicate candidates, expired/expiring documents where dates exist | Proposed |
| SA10 | Geography and workforce distribution | Employers/Associates by state, city, area, Type/Category, language, skill and qualification | Extend |
| SA11 | Job and hiring register | Jobs, demand, applications, current filled/remaining positions and application drill-down | Existing |
| SA12 | Recruitment conversion and time-to-fill | Application → interview → offer → acceptance → joining; vacancy age and conversion | Partial — current pipeline and elapsed application age |
| SA13 | Interview, offer and agreement lifecycle | Platform-wide scheduling, outcomes, acceptance, signature and overdue actions | Proposed |
| SA14 | Deployment, availability and retention | Current deployment, historical utilisation, tenure, release/exit reasons and repeat placements | Extend |
| SA15 | Attendance, exceptions and audit | Attendance sessions, exception requests and recorded audit events | Existing |
| SA16 | Attendance compliance and staffing gaps | Scheduled versus attended, absence, late arrival, early departure and overtime | Proposed |
| SA17 | Employer wallet balance register | Current Employer wallet balances and wallets not created | Existing |
| SA18 | Employer total credits statement | Per Employer opening, recharge credits, admin credits, reversals, debits and closing; platform subtotals | Partial — completed credits, sources and account selector |
| SA19 | Associate wallet balance register | Available/reserved/total balances per Associate; aggregate exposure and reconciliation flags | Partial — stored balances and missing wallets implemented |
| SA20 | Associate total credits statement | Earnings credits, adjustments, reversals, withdrawal reservations/releases, debits and closing | Partial — ledger totals; historical closing unavailable |
| SA21 | Consolidated wallet movements | Employer and Associate movement registers with source/reference drill-down and full filtered totals | Partial — separate Employer and Associate registers |
| SA22 | Payment and shift settlement monitoring | Payment lifecycle, Employer debit/Associate credit evidence and mismatch flags | Existing |
| SA23 | Withdrawal and bank payout monitoring | Requested, approved, processing, completed, rejected, failed and returned payouts | Partial — recorded lifecycle, references and pending age |
| SA24 | Employer funding and shortfall | Low balance, blocked settlement value, projected funding need based on an explicit basis | Proposed |
| SA25 | Recharge and gateway collection | Recharge attempts, confirmed collections, failed/pending attempts, fees and gateway references | Proposed |
| SA26 | Bank/gateway/ledger reconciliation | Matched, unmatched, duplicate, missing, returned and amount-mismatched records | Proposed |
| SA27 | Actual revenue, commission and tax | Posted fees, earned/payable commission, taxes and adjustments; estimates labelled separately | Proposed |
| SA28 | Invoice, receivables and ageing | Issued invoices, due/paid/overdue amounts, credit notes and outstanding age | Partial — invoice face values and overdue days |
| SA29 | Staff, branch and sales performance | Assigned portfolio, verification/hiring activity, conversions and turnaround by role | Proposed |
| SA30 | Feedback, disputes and service quality | Ratings, complaints, resolution age, repeated issues and escalation | Proposed |
| SA31 | Administrative and report-access audit | Role/assignment changes, financial actions, report/export access and privileged activity | Proposed |

## 2. Employer

| ID | Report | Contents | Status |
|---|---|---|---|
| EM01 | Employer management summary | Own companies, sites, jobs, applications, workforce, attendance and spending | Proposed |
| EM02 | Company, site and team register | Active/inactive entities, new additions and staff assignments within the account | Partial — company and site registers implemented |
| EM03 | Associate applicant and workforce growth | Distinct applicants, hired/joined/current/released Associates; no platform registration count | Partial — distinct applicants/current hires and status totals |
| EM04 | Job and hiring register | Required, applications, filled/remaining positions, current status and drill-down | Existing |
| EM05 | Recruitment conversion and vacancy ageing | Pipeline conversion, unfilled demand and time-to-fill by company/site/job/type | Partial — current pipeline and application age |
| EM06 | Interview register | Requests, schedule and status | Existing |
| EM07 | Offer and agreement registers | Offer terms/status; agreement confirmations and signatures | Existing |
| EM08 | Onboarding readiness and joining | Checklist completion, pending documents, planned/actual joining and no-shows | Proposed |
| EM09 | Attendance and approval | Sessions, hours, entry/checkout methods, approval and linked settlement evidence | Existing |
| EM10 | Attendance exceptions and approval ageing | Correction requests, decisions, pending duration and approver workload | Extend |
| EM11 | Staffing gaps, punctuality and overtime | Planned coverage versus actual work, absences, late/early time and overtime | Proposed |
| EM12 | Workforce tenure, releases and feedback | Assignment duration, exits/releases, reasons and service quality | Proposed |
| EM13 | Total credits statement | Own recharge credits, admin credits and reversals by period; source subtotals | Implemented — recorded completed credits and source totals |
| EM14 | Wallet statement | Own account-wide movements, balances and conditional historical opening/closing | Existing |
| EM15 | Payment and settlement register | Recorded payment status and own debit/linked Associate credit evidence | Existing |
| EM16 | Labour cost and spending | Actual recorded costs by company/site/job/Associate/Type/Category and work date | Proposed |
| EM17 | Funding requirement and failed settlements | Available funds, pending obligations, shortfall and blocked settlement reasons | Proposed |
| EM18 | Recharge history and collection receipts | Recharge attempts, confirmed credits, gateway references and receipts where available | Proposed |
| EM19 | Invoice and account dues | Own invoices, fees, taxes, payment allocation, outstanding and ageing | Partial — invoice face values and overdue days |
| EM20 | Team activity and approval audit | Own account staff actions, hiring decisions, attendance approvals and authorised exports | Proposed |

## 3. Associate

These are proposed dedicated reports. Existing profile, attendance, payment or wallet screens must be assessed for reuse; their presence alone is not a complete reporting feature.

| ID | Report | Contents | Status |
|---|---|---|---|
| AS01 | Personal work and earnings summary | Own applications, joined work, attendance, earnings and withdrawal status | Proposed |
| AS02 | Profile and verification statement | Own profile completeness, verification decisions and required actions | Proposed |
| AS03 | Application and interview history | Jobs applied, status transitions, interviews and outcomes | Partial — application register/current statuses |
| AS04 | Offers, agreements and employment history | Own accepted/rejected offers, signed agreements, assignments, joining and releases | Proposed |
| AS05 | Attendance and correction statement | Check-in/out, hours, approval, correction requests and decisions | Proposed |
| AS06 | Earnings and total credits statement | Own work-linked credits, pending earnings evidence, adjustments and reversals | Partial — recorded ledger credits and breakdowns |
| AS07 | Personal wallet statement | Available/reserved/total balances, credits/debits and valid opening/closing history | Partial — stored balances/movements; historical balances unavailable |
| AS08 | Withdrawal and payout statement | Requested/net amounts, fees/deductions, decisions, bank references and final status | Partial — stored lifecycle, fees, references and decisions |
| AS09 | Payslip and deductions statement | Approved pay components, overtime, deductions, tax and net pay where payroll exists | Proposed |
| AS10 | Feedback, disputes and support history | Own ratings, complaints, resolutions and appeals | Proposed |

## 4. Sub Admin

| ID | Report | Contents | Status |
|---|---|---|---|
| SU01 | Assigned portfolio summary | Assigned Employers, companies, Associates and staff with growth and current status | Proposed |
| SU02 | Assigned registration and activation | Registration/cohort counts of assigned accounts; assignment date shown separately | Partial — current-portfolio registration counts/trends |
| SU03 | Verification and document workload | Scoped pending/rejected/expiring records, reviewer activity and turnaround | Proposed |
| SU04 | Manpower skills | Assigned Associates' English, qualification, specialisation and experience | Existing |
| SU05 | Workforce availability and deployment | Scoped supply, deployments and Type/Category/geography distribution | Proposed |
| SU06 | Hiring and joining performance | Assigned job demand, recruitment conversion, joining and unfilled demand | Partial — scoped current recruitment pipeline |
| SU07 | Attendance and operational exceptions | Scoped attendance, approval gaps, correction queues and settlement status | Proposed |
| SU08 | Permitted client funding summary | Assigned client balances, credits and shortfall with explicit financial permission | Proposed |
| SU09 | Commission performance | Existing 10% estimated commission; extend to posted earned/paid/outstanding commission | Extend |
| SU10 | Staff activity, quality and disputes | Assigned workload, actions, feedback, disputes and resolution age | Proposed |

## 5. Sales Executive

| ID | Report | Contents | Status |
|---|---|---|---|
| SE01 | Sales portfolio and client growth | Assigned clients, new registrations, activation, active/inactive and geography | Partial — assigned registration counts/trends |
| SE02 | Lead-to-client conversion | Enquiry/lead stages, wins/losses and reasons where lead history exists | Proposed |
| SE03 | Client onboarding progress | Own clients' company/profile/document readiness and pending actions | Proposed |
| SE04 | Job creation and Employer confirmation | Own job drafts, OTP-confirmation outcomes, publication and pending age | Proposed |
| SE05 | Client hiring and repeat business | Jobs posted, filled positions, placements, repeat clients and conversion | Partial — scoped current recruitment pipeline |
| SE06 | Discounts and approvals | Requested/approved/applied discounts, authority, expiry and commercial impact | Proposed |
| SE07 | Authorised client funding summary | Assigned clients' recharge activity and funding-needed alerts within permission | Proposed |
| SE08 | Sales targets and productivity | Targets versus actual, client activity and follow-up performance | Proposed |
| SE09 | Sales commission statement | Posted earned/approved/paid/outstanding commission and reversal references | Proposed |
| SE10 | Sales activity and lost-client analysis | Contact/follow-up history, inactivity and churn using agreed definitions | Proposed |

## 6. Operations

| ID | Report | Contents | Status |
|---|---|---|---|
| OP01 | Assigned operations summary | Jobs, required workforce, queues, joining, attendance and exceptions | Proposed |
| OP02 | Recruitment pipeline and ageing | Assigned applications, stage transitions, pending actions and conversion | Partial — assigned current pipeline and application age |
| OP03 | Contact and interview performance | Attempts, responses, schedules, outcomes and overdue follow-ups | Proposed |
| OP04 | Offers, onboarding and agreement readiness | Pending acceptances, documents, signatures and joining blockers | Proposed |
| OP05 | Joining, deployment and replacement | Planned/actual joining, no-shows, staffing gaps and replacement turnaround | Proposed |
| OP06 | Daily muster and shift coverage | Assigned workforce, expected/actual attendance and coverage gaps | Proposed |
| OP07 | Attendance exceptions and approval ageing | Open correction requests, decisions, unresolved sessions and turnaround | Proposed |
| OP08 | Settlement status and funding blockers | Attendance-to-settlement progress, insufficient-fund alerts and errors | Proposed |
| OP09 | Releases, retention and service issues | Assignment exits, repeated no-shows, complaints and resolution | Proposed |
| OP10 | Operations productivity and action audit | Actions, queue throughput, handoffs, status changes and processing time | Proposed |

## 7. Finance

| ID | Report | Contents | Status |
|---|---|---|---|
| FI01 | Financial control summary | Credits, debits, wallet exposure, pending payouts and reconciliation exceptions | Proposed |
| FI02 | Employer credits and collection statement | Recharges, admin credits, reversals, receipts and source/reference totals | Proposed |
| FI03 | Employer wallet balance and statement | Authorised Employer account balances, movement details and valid historical balances | Proposed |
| FI04 | Associate earnings and credits statement | Work-linked credits, adjustments and reversals within assigned scope | Proposed |
| FI05 | Associate balances and reserve exposure | Available, reserved and total balances; missing wallets and mismatches | Proposed |
| FI06 | Attendance-to-settlement reconciliation | Approved work, payment, Employer debit and Associate credit alignment | Proposed |
| FI07 | Withdrawal decision and ageing | Requested, approved/rejected, age, reasons, decision maker and reserve evidence | Partial — request register, status totals and pending age |
| FI08 | Gateway payout and bank settlement | Processing/success/failed/returned transfers, references and settlement dates | Proposed |
| FI09 | Recharge and gateway collection reconciliation | Provider collection records versus confirmed wallet credits and bank entries | Proposed |
| FI10 | Ledger, reserve and balance reconciliation | Missing/duplicate movements, continuity, reserves and reference mismatches | Proposed |
| FI11 | Failed payments, retries and reversals | Failure reasons, retry chains, idempotency references and recovered/unresolved value | Proposed |
| FI12 | Fees, actual commission and tax | Posted revenue/payables, authorised adjustments, tax and supporting references | Proposed |
| FI13 | Invoices, receivables and ageing | Invoice allocation, collections, due/overdue totals and credit notes | Proposed |
| FI14 | Financial approvals and audit | Admin credits, adjustments, payout approvals, actors, remarks and exports | Proposed |

## Financial definitions to agree before coding

1. **Registered accounts:** count distinct account IDs by account creation date, separately for Employer and Associate. Count companies separately. Show period registrations and cumulative registrations distinctly.
2. **Total credits:** sum valid posted credit entries for the selected owner/period. Break down by recharge, admin credit, earnings, reversal and adjustment; do not call pending/failed attempts received funds.
3. **Total debits:** show distinct categories, including work settlement, payout consumption, fees, reversals and adjustments. A withdrawal reservation is not automatically a final paid debit.
4. **Balance:** show stored current balance separately from historical period closing. Opening + posted credits − posted debits must reconcile to closing under the ledger's actual reserve model. If history is insufficient, report unavailable rather than inferred zero.
5. **Employer and Associate totals:** present separately. An Employer-to-Associate transfer is not new external collection or platform revenue. A consolidated external-funds report must eliminate internal transfers and define its accounting perimeter.
6. **Settlement versus payout:** approved attendance, Employer debit, Associate credit/reservation and confirmed bank payout are distinct stages with distinct dates.
7. **Commission:** the existing analytics calculate an estimate at 10%. Actual earned/paid/outstanding commission requires an approved contract, posting model and reversal rules.
8. **Associate reach:** applicants, hires, joined workforce and platform registrations use separate distinct counts. An Associate applying to three jobs is one distinct Associate but three applications.
9. **Financial date basis:** distinguish creation, work, posting, decision, payment and bank settlement dates. State which one filters each report.
10. **Historical status and scope:** current status is not historical status. Current assignment is not proof that an account belonged to that staff member on a past date.

## Shared report capabilities

- IST date presets and custom ranges; current snapshots labelled separately from period activity.
- Role-appropriate company/site/job/Associate/Type/Category/geography/status/staff filters.
- Summary counts and amounts over all matching rows, detail drill-down, stable ordering, pagination and search.
- Compare periods and trends only when comparable data and definitions exist.
- CSV export initially; Excel/PDF/print and scheduled delivery are separate proposed capabilities.
- Scope, date basis, generation time, currency, status definitions and warnings on screen and export.
- Row-level ownership validation, explicit financial permissions and field-level masking.
- Empty, unavailable, partial and error states; export restrictions when required evidence is incomplete.
- No business mutations from report reads. Appropriate audit logging for sensitive report/export access.

## Data dependencies and boundaries

| Report family | Required evidence or decisions |
|---|---|
| Registration growth | Stable user IDs, creation dates, role rules, deleted/test account policy and deduplication |
| Activation, retention and funnels | Agreed stages, event timestamps/history and cohort definitions |
| Source attribution and sales conversion | Recorded source/lead IDs, assignment history and attribution rules |
| Attendance absence/punctuality/coverage | Dated roster, shift/timezone rules, breaks, holidays, leave, grace periods and overtime policy |
| Historical wallet statements | Complete posted ledger, trustworthy timestamps/order, balance evidence, reserve semantics and reversals |
| Credits and adjustments | Explicit source categories, posted status, ownership and reference links |
| Bank/gateway reconciliation | Actual provider/webhook/settlement records and bank evidence; mock recharges do not qualify |
| Actual commission, revenue and taxes | Contract/rate version, taxable basis, posting rules, fees, refunds and authoritative financial entries |
| Payroll and payslips | Payroll rules, approved time, pay components, deductions, tax, pay periods and payroll run records |
| Invoices and receivables | Authoritative invoice lifecycle, credit notes, due dates and payment allocation |
| Audit/turnaround/performance | Event history with actors and timestamps; fair SLA definitions and working-calendar rules |
| Role reporting | Verified assignment model and explicit permissions; existing Employer/Admin endpoints must not simply be opened to other roles |

## Suggested implementation order

1. **Registration and money visibility:** Super Admin Employer/Associate registration counts and trends; Employer and Associate current wallet totals; distinct total-credit statements; own Employer management summary.
2. **Statements and financial control:** Employer/Associate ledger drill-down, withdrawals, payout monitoring, settlement exceptions and funding shortfall.
3. **Workforce management:** hiring conversion, onboarding readiness, assignment history and scoped Sub Admin/Operations/Sales reports.
4. **Commercial and accounting:** actual commission, invoices, payroll and bank/gateway reconciliation after the required underlying contracts and records exist.
5. **Advanced management:** historical cohort/retention analysis, forecasts, scheduled delivery and expanded export formats.

The user subsequently requested role-wise implementation. The linked status document records the delivered first batch and remaining dependencies.
