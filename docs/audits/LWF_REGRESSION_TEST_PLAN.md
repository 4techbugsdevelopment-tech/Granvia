# Granvia LWF Regression Test Plan

**Prepared:** 4 November 2026

**Status:** Planned; test implementation and execution are not authorized by this document

## Objectives

This plan proves that the proposed LWF workflow selects the correct effective policy, applies employee and employer contributions in the correct period, preserves existing salary formulas, prevents duplicate processing, and reconciles finalized payroll through payslip, salary payment, statutory liability, and remittance.

It also protects current working Granvia behavior: job creation/editing, salary templates, PF/ESI/PT/HRA/custom components, daily/hourly attendance settlement, employer/Associate wallets, authorization, legacy jobs, and audit history.

## Non-negotiable test safeguards

- Use synthetic contribution amounts unless a compliance-approved rule package is explicitly supplied.
- Label synthetic values as test fixtures, never statutory rates.
- Do not run migrations, resets, seeds, or write tests against production or an unverified database.
- Use disposable schemas/databases or transactionally isolated fixtures for integration tests.
- Mock/disable real SMS, payment gateways, bank transfers, and statutory remittance.
- Do not assert compliance from passing software tests; compliance approval is separate.
- Keep the backend authoritative. Frontend tests verify preview parity and error handling, not independent legal decisions.
- Record environment, commit/source state, schema/migration state, feature flags, and timezone for every release run.

## Test layers

| Layer | Purpose | Examples |
|---|---|---|
| Unit | Pure resolver, schedule, calculation, period-key, rounding logic | Effective-date boundaries, frequency triggers, employee/employer split |
| Service/API | Validation, authorization, transaction behavior, typed errors | Overlap 409, missing context 422, cross-employer 403 |
| Database integration | Unique keys, concurrency, immutability, rollback | Duplicate payroll/LWF line, double finalization, remittance over-allocation |
| Frontend component | Field validation, explanations, totals, loading/error states | LWF Master form, salary preview, payroll review |
| End-to-end isolated | Workflow reconciliation without real external movement | Job → payroll → payslip → mock payment → liability → mock remittance |
| Build/static | Type/build and changed-file quality | Backend build, frontend build, focused lint/typecheck |
| Migration rehearsal | Upgrade and rollback safety in disposable DBs | Empty, legacy, partially applied, drifted ledger |

## Baseline suite

Before implementation, capture and retain:

- `npm.cmd run test:salary-structure` result. Current verified baseline: 15/15 passed on 4 November 2026 after the restricted Windows launcher was bypassed following its pre-test ENOMEM fault.
- Existing attendance/wallet reserve, financial report, role/access, job workflow, and validation tests relevant to changed files.
- Backend and frontend production builds at the start of implementation.
- Known unrelated baseline failures, if any, clearly separated from LWF regressions.

## Test data matrix

Use synthetic fixtures covering:

- At least three active states and one inactive state.
- One state with monthly schedule, one with half-yearly schedule, one with yearly/custom schedule, plus one explicit non-applicable state.
- Current, future, expired, and overlapping draft policy versions.
- Master standard, permitted employer establishment exception, closed exception, and unauthorized override attempt.
- Employer with two companies/sites in different states.
- Associates whose residential state differs from work state.
- Joining, exiting, transferred, salary-revised, exempt, below-threshold, at-threshold, and above-threshold Associates.
- Monthly structured jobs, legacy gross-only jobs, daily jobs, and hourly jobs.
- Draft, approved, finalized, corrected, and reversed payroll/remittance lifecycles.

## A. State-wise LWF selection

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| ST-001 | P0 | Job site and statutory establishment point to the same active state | Resolver selects the single effective policy and returns state/version/reason | Unit/API |
| ST-002 | P0 | Associate residential state differs from work establishment state | Work/establishment policy wins; residential state is not used | Unit/API |
| ST-003 | P0 | Employer has sites in two states | Each assignment resolves its own state policy; no employer-wide leakage | Integration |
| ST-004 | P0 | Job site state differs from registered establishment state | Approved precedence rule is applied and explained; unresolved policy blocks if precedence is not configured | Unit/API |
| ST-005 | P0 | Missing site/establishment jurisdiction | Typed `ambiguous` or `not_configured` error; no global fallback | API/UI |
| ST-006 | P0 | State is inactive in State Master | New policy/assignment resolution is rejected; historical finalized records remain readable | API/integration |
| ST-007 | P0 | State text has case/spacing variation but canonical ID exists | Calculation uses canonical ID; no runtime free-text legal join | Integration |
| ST-008 | P0 | Unmapped legacy state text | Record is flagged for cleanup and cannot silently select a policy | Integration |
| ST-009 | P0 | Multiple active policies match the same scope/date | Resolver fails with ambiguity; no arbitrary priority unless explicitly approved | Unit/API |
| ST-010 | P0 | No applicable legislation for configured state | Explicit `not_applicable` result, distinct from missing configuration | Unit/API/UI |
| ST-011 | P0 | Employer attempts cross-employer/state policy access | 403/404 according to scope convention; no data leakage | API security |
| ST-012 | P1 | Assignment transfers states on an effective date | Old state applies through prior date; new state applies from transfer date | Unit/integration |

## B. Contribution frequency and schedule

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| FR-001 | P0 | Monthly rule in trigger month | One employee LWF and one employer LWF line are created | Unit/payroll |
| FR-002 | P0 | Monthly payroll rerun while draft | Draft is replaced/reused idempotently; no second contribution-period line | Integration |
| FR-003 | P0 | Half-yearly rule in configured trigger month | Contribution appears once for the half-year contribution key | Unit/payroll |
| FR-004 | P0 | Half-yearly rule in non-trigger month | No LWF payroll line or liability is created | Unit/payroll |
| FR-005 | P0 | Yearly rule in configured annual month | Contribution appears once with the annual period key | Unit/payroll |
| FR-006 | P0 | Yearly rule in other months | No LWF line; salary payment frequency remains monthly | Unit/payroll |
| FR-007 | P0 | Quarterly/custom schedule with multiple trigger periods | Each configured period gets one unique contribution key | Unit/integration |
| FR-008 | P0 | Financial-year boundary | Period key and effective policy follow the approved FY/calendar basis | Unit |
| FR-009 | P0 | Schedule changed by a future policy version | Old schedule applies before effective date; new schedule after it | Unit/integration |
| FR-010 | P0 | Invalid schedule: frequency without trigger or duplicate trigger | Configuration fails with field-level 422 | API/UI |
| FR-011 | P1 | Due date falls on special/holiday rule | Approved due-date policy determines result; no invented adjustment | Unit |
| FR-012 | P0 | Employee and employer timing differs where approved | Each side follows its verified schedule without affecting the other's classification | Unit/payroll |

## C. Employee/employer calculation and salary regression

The persisted calculation must satisfy:

```text
Net Salary = Gross Earnings - Applicable Employee Deductions
Employer Cost = Gross Earnings + Applicable Employer Contributions + Other Employer Costs
```

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| CAL-001 | P0 | Applicable employee and employer fixed LWF | Employee amount reduces net; employer amount increases cost; employee amount is not added to employer cost twice | Unit |
| CAL-002 | P0 | Non-applicable LWF | No LWF line; gross/net/cost match the same salary without LWF | Unit |
| CAL-003 | P0 | Non-trigger month for non-monthly rule | Monthly net excludes scheduled LWF; annual/period explanation remains accurate | Unit/UI |
| CAL-004 | P0 | Basic + HRA + allowance + employee LWF | Gross remains sum of earnings; LWF is deduction only | Unit |
| CAL-005 | P0 | Employer LWF with employer PF/ESI | Employer contributions sum independently; none reduce net | Unit |
| CAL-006 | P0 | Employee LWF with employee PF/ESI/PT | Deductions sum once each and net equals gross minus persisted rounded lines | Unit |
| CAL-007 | P0 | PF/ESI threshold or cap boundary | Existing statutory rule behavior is unchanged by LWF resolution | Unit/regression |
| CAL-008 | P0 | LWF eligibility threshold below/at/above boundary | Approved inclusive/exclusive rule is followed exactly | Unit |
| CAL-009 | P0 | Exempt employee/category | No LWF lines; reason code identifies exemption | Unit/API |
| CAL-010 | P0 | Deductions exceed gross | Existing 422/negative-net safeguard or approved payroll exception flow is triggered | Unit/API |
| CAL-011 | P0 | Decimal percentage produces half-paise result | Backend-approved rounding is applied per line and totals reconcile | Unit |
| CAL-012 | P0 | Frontend preview versus backend save | Displayed normalized totals equal persisted backend result; server wins on stale preview | Component/API |
| CAL-013 | P0 | Client submits altered LWF amount/code casing/duplicate | Server removes managed variants and persists only authoritative lines | API security |
| CAL-014 | P1 | Annual CTC for half-yearly/yearly contribution | Annual cost uses actual scheduled count, not monthly amount multiplied by 12 | Unit/UI |
| CAL-015 | P0 | Disabled/inactive policy semantics | Approved fallback/not-applicable rule is followed and explained | Unit/API |

## D. Job creation, editing, and salary structure

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| JOB-001 | P0 | Create monthly structured job with valid jurisdiction | Backend persists normalized salary and explained LWF snapshot | API/integration |
| JOB-002 | P0 | Create job with missing/ambiguous jurisdiction | Save is blocked or explicitly allowed as draft according to approved policy; never silently global | API/UI |
| JOB-003 | P0 | Admin creates job for an employer | Resolver uses selected employer/site and admin authorization scope | API security |
| JOB-004 | P0 | Employer creates job for own company/site | Ownership checks remain intact | API regression |
| JOB-005 | P0 | Apply salary template | Managed LWF is resolved once after template application | Component/API |
| JOB-006 | P0 | Edit salary components without location change | Current approved policy preview/save applies; audit captures before/after | Integration |
| JOB-007 | P0 | Change site/state on a draft job | LWF preview is re-resolved; stale policy/version cannot be saved silently | Component/API |
| JOB-008 | P0 | Change unrelated job field on legacy structured job | Historical salary/LWF snapshot remains unchanged unless salary is explicitly resaved | Integration |
| JOB-009 | P0 | Edit legacy gross-only job | No component/LWF history is invented | Integration |
| JOB-010 | P0 | Master rate changes after job save | Existing job snapshot remains; new preview/resave uses new effective version per approved rule | Integration |
| JOB-011 | P0 | Monthly structured job reaches attendance approval | Gross monthly is never used as per-attendance amount | End-to-end isolated |
| JOB-012 | P0 | Daily/hourly legacy job attendance approval | Existing explicit daily/hourly calculation remains unchanged | Regression |

## E. Payroll recalculation, historical rates, and duplicate deductions

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| PAY-001 | P0 | Create draft payroll preview | No payment/liability/remittance side effect; lines/totals/exceptions are returned | API/integration |
| PAY-002 | P0 | Recalculate same draft after attendance correction | Draft source snapshot and results replace transactionally; no duplicate lines | Integration |
| PAY-003 | P0 | Two concurrent preview requests with same idempotency key | One intended draft/result set; retry-safe response | Concurrency |
| PAY-004 | P0 | Finalize approved payroll | Results and source policy versions become immutable; liability creation follows approved transaction boundary | Integration |
| PAY-005 | P0 | Finalize same payroll twice | Second attempt is idempotent or 409; no duplicate LWF line/liability | Concurrency |
| PAY-006 | P0 | Edit finalized payroll directly | Rejected; correction workflow is required | API/security |
| PAY-007 | P0 | Backdated payroll before a rate change | Historical policy version is selected | Unit/integration |
| PAY-008 | P0 | Backdated payroll after a work-state transfer | Assignment state effective for the period is selected | Integration |
| PAY-009 | P0 | New joiner in contribution period | Approved state joining rule determines applicability and reason | Unit/payroll |
| PAY-010 | P0 | Employee exit before/within trigger period | Approved exit rule determines applicability and outstanding liability | Unit/payroll |
| PAY-011 | P0 | Salary revision across threshold | Eligibility changes only according to effective revision and policy rule | Unit/payroll |
| PAY-012 | P0 | Correction adds LWF omitted from finalized payroll | Linked adjustment lines/liability are created without editing original | Integration |
| PAY-013 | P0 | Correction reverses erroneous LWF | Linked negative/reversal lines preserve original and reconcile | Integration |
| PAY-014 | P0 | Same contribution period appears in separate payroll/correction runs | Unique rule allows only intended original plus explicit linked adjustment sequence | Database integration |
| PAY-015 | P0 | Transaction fails mid-calculation/finalization | No partial results, wallet movement, or liability remains | Integration |
| PAY-016 | P1 | Large employer payroll | Completes within agreed performance threshold with stable totals | Performance |

## F. Payslip and salary payment

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| PSL-001 | P0 | Generate payslip for finalized payroll | Payslip exactly matches finalized earnings, deductions, employee LWF, net, and approved employer information | Integration/document |
| PSL-002 | P0 | Request payslip for draft payroll | Rejected/not found; no draft artifact is exposed | API |
| PSL-003 | P0 | Associate requests own payslip | Allowed and correctly scoped | API security |
| PSL-004 | P0 | Associate requests another employee's payslip | Denied without information leakage | API security |
| PSL-005 | P0 | Corrected payroll payslip | Version/correction presentation follows approved policy and totals reconcile | Document/integration |
| PMT-001 | P0 | Initiate salary payment | Payment amount equals finalized net pay, not gross salary or employer cost | Integration |
| PMT-002 | P0 | Retry same salary payment | Same idempotency reference; no duplicate wallet credit/debit | Integration/concurrency |
| PMT-003 | P0 | Gateway/mock payment failure | Payroll remains finalized and unchanged; payment status records failure | Integration |
| PMT-004 | P0 | Retry failed payment | Uses original finalized payroll result and amount | Integration |
| PMT-005 | P0 | LWF employee deduction present | Net payment reflects deduction exactly once | End-to-end isolated |
| PMT-006 | P0 | Employer LWF present | Employer contribution does not reduce employee payment | End-to-end isolated |
| PMT-007 | P0 | Daily/hourly operational settlement | Remains distinguishable from payroll salary payment | Regression/reporting |
| PMT-008 | P0 | Attempt payment before finalization | Rejected | API |

## G. Statutory liability and remittance

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| LIA-001 | P1 | Finalized payroll with multiple employees in one state/period | Liability employee/employer subtotals equal source lines | Integration |
| LIA-002 | P1 | Employees across two states/establishments | Separate liabilities are created; no cross-state aggregation | Integration |
| LIA-003 | P1 | Payroll finalization retried | No duplicate liability | Concurrency |
| LIA-004 | P1 | Payroll correction after liability creation | Linked liability adjustment preserves original totals/history | Integration |
| LIA-005 | P1 | Liability due date calculation | Verified policy due rule is applied | Unit |
| REM-001 | P1 | Record full remittance with unique reference | Liability becomes remitted and allocation equals payable | Integration |
| REM-002 | P1 | Record partial remittance | Liability becomes partially remitted; outstanding is exact | Integration |
| REM-003 | P1 | Allocate more than outstanding | Rejected transactionally | API/database |
| REM-004 | P1 | Duplicate remittance reference/idempotency key | Rejected or safely returns existing record; no duplicate allocation | Database/concurrency |
| REM-005 | P1 | Maker attempts self-approval when prohibited | Denied | API security |
| REM-006 | P1 | Reverse approved remittance | Original remains immutable; linked reversal restores outstanding correctly | Integration |
| REM-007 | P1 | Delete/edit approved remittance | Rejected | API/security |
| REM-008 | P2 | Reconciliation report | `payable = remitted + outstanding + approved net adjustments` for every group | Reporting |
| REM-009 | P2 | Cross-employer report access | Denied and totals remain tenant-scoped | API security |
| REM-010 | P2 | Export versus UI totals | Same filters produce identical totals and item counts | Reporting |

## H. Configuration validation, permissions, and audit

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| CFG-001 | P0 | Create valid future draft policy | Saved as draft; does not affect current resolution | API/integration |
| CFG-002 | P0 | Activate policy without legal source | Rejected | API |
| CFG-003 | P0 | Overlapping effective range in same scope | 409 with actionable conflict | API/database |
| CFG-004 | P0 | Adjacent non-overlapping ranges | Accepted according to inclusive/exclusive date convention | Unit/database |
| CFG-005 | P0 | Edit policy already used by finalized payroll | Rejected; create new version | API |
| CFG-006 | P0 | Close current version with future replacement | Resolver changes only at effective boundary | Unit/integration |
| CFG-007 | P0 | Employer attempts to change Super Admin rate | Denied unless explicit approved authority exists | API security |
| CFG-008 | P0 | Employer creates approved establishment exception | Scoped only to that employer/establishment and audited | API/integration |
| CFG-009 | P0 | Delegated Job Management user previews policy | Allowed only within approved scope; cannot manage master | API security |
| CFG-010 | P0 | Inactive/blocked user calls configuration/payroll API | Fails closed | API security |
| AUD-001 | P0 | Policy create/activate/close | Actor, time, reason, before/after/version are recorded | Integration |
| AUD-002 | P0 | Payroll finalize/correct | Immutable audit links run, employee, source versions, and actor | Integration |
| AUD-003 | P1 | Remittance approve/reverse | Complete audit and evidence references remain accessible to authorized roles | Integration/security |

## I. Backward compatibility and migration

| Test ID | Priority | Scenario | Expected result | Layer |
|---|---|---|---|---|
| LEG-001 | P0 | Existing global master/override rows | Remain identifiable as legacy unscoped; not auto-applied to every state | Migration/integration |
| LEG-002 | P0 | Existing job with saved LWF components | Values and audit snapshot remain readable and unchanged | Migration/regression |
| LEG-003 | P0 | Legacy gross-only job | Remains usable without invented components | Regression |
| LEG-004 | P0 | Existing salary template | Applies normally; authoritative LWF is resolved separately | Regression |
| LEG-005 | P0 | Existing PF/ESI/PT statutory rules | Current behavior remains unchanged | Regression |
| LEG-006 | P0 | Existing daily/hourly attendance payment | Continues with explicit compatible rate and existing wallet safeguards | Regression |
| LEG-007 | P0 | Empty database migration rehearsal | Approved migration applies cleanly | Disposable DB |
| LEG-008 | P0 | Database with current LWF migration/legacy rows | Additive migration preserves rows and constraints | Disposable DB |
| LEG-009 | P0 | Partially applied/drifted database | Preflight detects mismatch and stops; no blind deploy | Disposable DB |
| LEG-010 | P0 | Feature flag disabled after deployment | Legacy reads work as approved; no new policy/payroll/remittance writes occur | Integration/rollback |

## Error-handling assertions

Every blocking error must be typed, scoped, and actionable:

- `403`: user/role/employer/assignment scope violation.
- `404`: inaccessible or absent resource according to the existing concealment convention.
- `409`: overlap, immutable-state conflict, duplicate business key, stale policy, or invalid lifecycle transition.
- `422`: invalid fields, missing jurisdiction/eligibility context, incomplete schedule, negative-net violation, or allocation mismatch.
- `503`: dependency/schema feature not deployed, when graceful degradation is explicitly designed.

No error may silently substitute a global LWF rate, residential state, zero amount, gross salary payment, or new policy version.

## Release exit criteria

- All P0 cases for the implemented phase pass.
- No unresolved critical/high defect affects salary, payment, tenant isolation, policy selection, historical rates, or duplicate processing.
- Frontend preview and backend persisted calculation match approved fixtures.
- Existing salary/job/attendance/payment regression suites pass or unrelated baselines are documented and accepted.
- Migration rehearsals pass for all approved starting states.
- No automated test invokes real SMS, payment, remittance, or production data.
- Security/role matrix and direct-object-reference tests pass.
- Finalized payroll, payslip, payment, liability, and remittance reconcile for any phases included in the release.
- Feature-flag disable/rollback rehearsal preserves historical data and stops new writes.
- Compliance owner signs the exact policy fixtures activated for production.
- Project owner separately approves migration, deployment, and activation.

## Current readiness verdict

Only the existing narrow job salary-estimate behavior has a passing focused suite. State-wise resolution, schedules, payroll, payslips, salary payment linkage, liabilities, and remittance remain unimplemented and therefore cannot yet pass their planned scenarios. Test implementation should begin alongside Phase A design, but production release certification remains dependency-based through the final implemented phase.
