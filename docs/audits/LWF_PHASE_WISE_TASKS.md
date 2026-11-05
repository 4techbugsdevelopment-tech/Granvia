# Granvia LWF Phase-Wise Tasks

**Prepared:** 4 November 2026

**Execution status:** All tasks are **Not Started**. This checklist does not authorize implementation.

## Dependency rule

Tasks may start only when their listed dependencies and the go criteria in `LWF_IMPLEMENTATION_READINESS.md` are satisfied. Phase F test design starts early, but release certification follows the implemented dependency order.

## Phase A — LWF Master completion and safety foundation

### Phase definition

- **Objective:** Contain the confirmed monthly-settlement risk, approve the compliance contract, and establish deterministic state/establishment/effective-date LWF policy resolution.
- **Reusable components:** `StateMaster`, `CityMaster`, `LocationMaster.tsx`, `CityStateSelect.tsx`, `LwfMaster.tsx`, `LwfSettingsPage.tsx`, current LWF controller/service, Zod validation, admin/employer role middleware, Prisma transaction/audit patterns.
- **Required modifications:** Replace the state-less mutable policy concept with effective versions and schedules; preserve legacy behavior only through an explicit compatibility path; define employer exceptions and inactive semantics.
- **Candidate affected files:** `frontend/src/web-admin/pages/LwfMaster.tsx`, `frontend/src/employer/LwfSettingsPage.tsx`, `frontend/src/services/lwfService.ts`, `nodebackend/src/controllers/lwfController.ts`, `nodebackend/src/services/lwfService.ts`, admin/employer routes, authorization map, `nodebackend/prisma/schema.prisma`, future approved migration, focused tests.
- **Database impact:** Expected, but exact structures must follow approved rules. Prefer policy-version/schedule/audit concepts and canonical `StateMaster` references; do not add tables without confirming safe extension options.
- **API impact:** Expected versioned configuration, activation/closure, list/filter, and resolution-preview operations. Existing endpoints require a documented compatibility strategy.
- **Dependencies:** Owner/compliance decisions, verified pilot-state notification, establishment/jurisdiction definition, target database drift review.
- **Primary risks:** Wrong jurisdiction, auto-promoting legacy global rates, overlapping periods, unauthorized employer rate changes, broken daily/hourly settlement, migration drift.
- **Rollback:** Feature-flag new resolution; retain legacy reads during transition; do not delete used policies; close/supersede bad versions; containment must fail safely without restoring the gross-monthly fallback.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| A-001 | P0 | Approve business decision register BD-01 through BD-14 and assign product/compliance owners | Owner review | Product, compliance, payroll, finance | Signed decisions identify jurisdiction, overrides, schedules, roles, history, correction, and rounding | Scenario walkthrough for monthly, half-yearly, yearly, join, exit, transfer, backdate, correction | Not Started |
| A-002 | P0 | Collect and approve authoritative pilot-state LWF notification package | A-001 | Compliance records | Legal source, effective dates, applicability, split, frequency, eligibility, due date, and amendments are recorded | Independent compliance review against test vectors | Not Started |
| A-003 | P0 | Contain monthly structured-job attendance settlement so gross monthly cannot be paid per attendance | A-001 owner authorization | Attendance, job, payment, wallet, attendance UIs | Monthly gross is never used as a per-attendance fallback; approved daily/hourly flows remain unchanged | Monthly job with/without explicit rate; daily/hourly regression; duplicate approval; wallet rollback | Not Started |
| A-004 | P0 | Inventory current state text values and define canonical `StateMaster` mapping without changing data | A-001 | State Master, profiles, companies, sites | Every pilot record is exact-match, exception, or unresolved; no silent fuzzy mapping | Duplicate/case/rename/inactive/unmatched state review | Not Started |
| A-005 | P0 | Decide statutory establishment representation and assignment jurisdiction precedence | A-001, A-002 | Company, site, job, assignment | One documented precedence rule returns one jurisdiction or a blocking ambiguity | Site/company mismatch, transfer, remote/multi-site examples | Not Started |
| A-006 | P0 | Produce final policy-version and contribution-schedule data design | A-001, A-002, A-005 | LWF schema, State Master | Design covers state, owner scope, establishment, split, dates, eligibility, schedule, legal source, approval, audit | Schema review for overlap, nullability, immutability, deletion, indexes | Not Started |
| A-007 | P0 | Compare extensions of current LWF models against new normalized structures and choose the smallest safe design | A-006 | Prisma LWF models | Decision explains reuse versus new structures and preserves historical/legacy meaning | Migration dry-design review; referential and unique-key analysis | Not Started |
| A-008 | P0 | Design legacy setting treatment and endpoint compatibility | A-006, A-007 | Current LWF API/UI and saved job structures | Legacy rows are marked unscoped and never auto-activated for every state; saved components remain intact | Legacy master/override/no-setting cases | Not Started |
| A-009 | P0 | Design deterministic effective-policy resolver and typed outcomes | A-002, A-005, A-006 | `lwfService` | Resolver accepts employer, establishment/site, assignment/employee, date/period, wages/event and returns applied/not-applicable/not-configured/ambiguous with reason | Priority, date boundary, missing, ambiguous, inactive, future, expired cases | Not Started |
| A-010 | P0 | Define overlap, chronology, schedule, amount, eligibility, legal-source, and immutability validation | A-006 | LWF controller/service/schema | Invalid/overlapping rules fail with field-specific 409/422 errors; used versions cannot mutate | Boundary, concurrency, duplicate, invalid schedule tests | Not Started |
| A-011 | P1 | Design configuration and resolution-preview APIs with snake_case responses and current error conventions | A-008, A-009, A-010 | Admin/employer routes/controllers/services | API contract covers list/view/create/activate/close/preview and exact authorization | Contract, authorization, validation, pagination/filter tests | Not Started |
| A-012 | P1 | Design LWF Master list and staged configuration UI using existing components/styles | A-011 | Admin LWF UI | UI shows state, split, frequency, deduction period, dates, source, status, legal reference, validation, version history | Form/list accessibility, state/filter, field-error, immutable-version UI tests | Not Started |
| A-013 | P1 | Define employer exception UI and legal restrictions | A-001, A-011 | Employer LWF Settings | Employer sees standard/effective rule and can change only approved exception fields with reason/evidence | Employer isolation, forbidden rate edit, fallback/close behavior | Not Started |
| A-014 | P0 | Define policy author/approver permissions and audit events | A-001, A-011 | Admin employee roles, employer permissions, audit | Maker/checker and employer scope are explicit; every policy change stores actor/reason/before/after | Role matrix, inactive user, cross-employer access, maker-checker tests | Not Started |
| A-015 | P0 | Prepare DBA-reviewed migration, deployment preflight, and rollback plan only after design approval | A-004–A-014 | Prisma migration/deployment | Target DB and migration ledger are verified; migration is additive and rollback preserves history | Empty/existing/legacy/drifted schema rehearsal in disposable DB | Not Started |
| A-016 | P0 | Implement and verify Phase A only after explicit owner approval | A-001–A-015 | All Phase A modules | All Phase A acceptance gates pass; no production activation without separate approval | Focused unit/API/integration/frontend/build/regression suite | Not Started |

## Phase B — Salary bifurcation integration

### Phase definition

- **Objective:** Make Add/Edit Job salary estimates state/policy/schedule-aware without breaking current earnings, PF, ESI, PT, HRA, net salary, employer cost, or legacy jobs.
- **Reusable components:** `SalaryStructurePanel`, frontend salary calculation preview, `calculateSalaryStructure`, `saveJobSalaryStructure`, salary templates/statutory rules, job transaction/audit snapshot.
- **Required modifications:** Provide authoritative policy preview, show jurisdiction/frequency/reasoning, distinguish recurring monthly from scheduled contribution, and persist sufficient policy snapshot metadata.
- **Candidate affected files:** `SalaryStructurePanel.tsx`, frontend salary/LWF services, `EmployerApp.tsx`, `JobApprovals.tsx`, `salaryStructureService.ts`, `jobController.ts`, salary schema/models/audit, focused tests.
- **Database impact:** Possibly additional policy-version/schedule snapshot fields on job salary estimates; do not recalculate or rewrite historical structures.
- **API impact:** Prefer a salary-preview endpoint or enhanced save response; do not duplicate statutory decision logic in React.
- **Dependencies:** Phase A resolver and compatibility contract.
- **Primary risks:** Double LWF injection, frontend/backend mismatch, non-monthly LWF treated monthly, wrong annual CTC, legacy job mutation.
- **Rollback:** Feature-flag schedule-aware preview; preserve server authority and stored legacy components; disable new preview without deleting snapshots.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| B-001 | P0 | Define job salary estimate semantics for monthly and scheduled contributions | A-001, A-009 | Salary product contract | Contract states when LWF affects displayed monthly net and annual CTC | Monthly/half-yearly/yearly worked examples without fabricated rates | Not Started |
| B-002 | P0 | Define authoritative salary-preview request/response using resolver context | A-011, B-001 | Salary/LWF API | Preview returns normalized components, totals, policy version, jurisdiction, frequency, next trigger, and reason | Contract and missing/ambiguous-policy tests | Not Started |
| B-003 | P0 | Preserve current component formulas and backend Decimal rounding | B-001 | Salary calculation service | Gross, deductions, net, employer cost, caps/thresholds, and deduction guard are unchanged except approved schedule treatment | Golden current salary vectors; rounding boundaries | Not Started |
| B-004 | P0 | Prevent managed LWF duplication or client override across preview and save | A-009, B-002 | LWF/salary services | Exactly one employee and one employer LWF line when applicable; client values never win | Tampered payload, duplicate/case variants, no-policy cases | Not Started |
| B-005 | P1 | Add state/policy/frequency/deduction-period explanations to the existing salary panel | B-002 | Salary UI | User can see source and impact; non-trigger contributions are not labelled monthly deductions | Rendering, loading, API error, accessibility tests | Not Started |
| B-006 | P1 | Persist an auditable job-estimate policy snapshot without treating it as payroll | A-006, B-002 | Job salary models/audit | Saved estimate records policy version/schedule explanation and exact applied amounts | Save/edit/resave/current-versus-historical policy tests | Not Started |
| B-007 | P0 | Preserve historical jobs and state-less legacy salary structures | A-008, B-006 | Job CRUD and UI | Viewing/editing unrelated fields does not invent or silently replace legacy component history | Legacy gross-only, legacy LWF, edit-without-salary tests | Not Started |
| B-008 | P0 | Verify PF, ESI, PT, HRA, custom components, and templates with LWF schedules | B-003–B-006 | Salary components/templates | Existing components calculate identically; only approved LWF timing differs | Component interaction matrix and template application tests | Not Started |
| B-009 | P1 | Define preview/save error UX and server mismatch handling | B-002 | Job forms/API errors | Preview failure is visible; save result replaces preview; stale policy produces actionable conflict | Network failure, stale version, validation error tests | Not Started |
| B-010 | P0 | Complete Phase B release gate after explicit approval | B-001–B-009 | Salary/job modules | Phase B suite passes and no monthly/daily payment behavior is unintentionally changed | Focused frontend/backend/build and Phase F regression | Not Started |

## Phase C — Payroll integration

### Phase definition

- **Objective:** Create authoritative pay-period calculations with correct LWF timing, historical policy selection, idempotency, approval/finalization, and corrections.
- **Reusable components:** Attendance records/audit, assignment/job/site links, salary calculation primitives, Prisma transactions, role middleware, audit and reporting patterns.
- **Required modifications:** Introduce payroll periods/runs/results/lines or safe equivalents; snapshot salary/jurisdiction/policy; separate draft recalculation from finalized correction.
- **Candidate affected files:** New payroll service/controller/routes/UI/tests plus attendance, assignment, salary, authorization, Prisma schema, and approved migrations.
- **Database impact:** Expected generic payroll foundation; unique idempotency keys and immutable audit history are mandatory.
- **API impact:** Preview/recalculate/read/approve/finalize/correction operations.
- **Dependencies:** Phase A, Phase B, approved payable-day/proration/negative-net/revision rules.
- **Primary risks:** Duplicate deductions, future-rate leakage, negative net, partial transaction writes, mutable finalized payroll, cross-employer leakage.
- **Rollback:** Draft runs can be discarded; finalized runs cannot be deleted. Disable further finalization and create corrections for posted errors.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| C-001 | P0 | Approve payroll period, payable-day, proration, overtime, revision, arrears, negative-net, and finalization rules | A-001 | Payroll product contract | Every calculation input and lifecycle transition is defined | Worked payroll cases and owner sign-off | Not Started |
| C-002 | P0 | Design payroll period/run/result/line/audit grain and keys | C-001, A-006 | Payroll schema | One employee assignment result per run; typed lines preserve source/version; statuses are explicit | Schema/unique-key/immutability review | Not Started |
| C-003 | P0 | Define deterministic contribution-period key and duplicate LWF constraint | A-009, C-002 | Payroll/LWF schema | Same employee/rule/period cannot be deducted twice across reruns | Concurrent duplicate and rerun tests | Not Started |
| C-004 | P0 | Design attendance/payable-day snapshot and late-attendance policy | C-001, C-002 | Attendance/payroll | Draft uses defined approved records; finalization freezes source snapshot | Attendance correction before/after finalization tests | Not Started |
| C-005 | P0 | Implement draft payroll preview transactionally after approval | C-002–C-004 | Payroll service/API | Preview produces earnings, deductions, net, contributions, explanations, and blocking exceptions without money movement | Calculation, rollback, missing data, scope tests | Not Started |
| C-006 | P0 | Resolve policy by historical pay period and assignment context | A-009, C-005 | LWF resolver/payroll | Backdated payroll uses the historically effective policy and jurisdiction snapshot | Effective boundary, transfer, backdate, future-rate tests | Not Started |
| C-007 | P0 | Apply LWF only in configured trigger period | A schedule engine, C-005 | Payroll lines | Non-trigger payroll has no LWF line; trigger period has exact employee/employer lines | Monthly, quarterly, half-yearly, yearly, custom trigger tests | Not Started |
| C-008 | P0 | Add draft recalculation idempotency and concurrency control | C-003, C-005 | Payroll transaction/API | Same request cannot create duplicate results; safe retry returns/replaces intended draft | Parallel requests, retry, deadlock/rollback tests | Not Started |
| C-009 | P0 | Add review, maker-checker approval, and finalization | A-014, C-005 | Payroll UI/API/auth | Only complete approved runs finalize; finalization freezes results and source versions | Role matrix, invalid transition, double-finalize tests | Not Started |
| C-010 | P0 | Add correction/reversal runs without editing finalized records | C-009 | Payroll correction/audit | Correction links original lines, reason, actor, and signed amount | Positive/negative adjustment, authorization, reconciliation tests | Not Started |
| C-011 | P1 | Add payroll exception and audit views using current UI/report conventions | C-005, C-009 | Employer/Admin payroll UI | Blocking and warning conditions are visible and traceable | Filter, drill-down, audit display tests | Not Started |
| C-012 | P0 | Complete Phase C release gate after explicit approval | C-001–C-011 | Payroll and dependencies | Mandatory scenarios A–J pass; no real payment is triggered by preview tests | Unit/API/integration/concurrency/security/performance suite | Not Started |

## Phase D — Payslip and salary payment

### Phase definition

- **Objective:** Generate payslips from finalized payroll and pay the exact finalized net salary with retry-safe references.
- **Reusable components:** Existing document/PDF patterns, private file authorization, `Payment`, wallet transaction/reference patterns, payment reports.
- **Required modifications:** Payslip renderer/read API; explicit payroll-result payment contract; keep daily/hourly attendance settlement separate.
- **Candidate affected files:** New payslip/payroll payment services/controllers/routes/UI/tests; `paymentController.ts`, payment/wallet/report services, document storage authorization.
- **Database impact:** Payroll-payment link/idempotency key and payslip artifact/reference may be required; do not overload job salary structures.
- **API impact:** Employee payslip retrieval, payroll payment initiation/status/retry.
- **Dependencies:** Finalized Phase C payroll and approved payment ownership policy.
- **Primary risks:** Paying gross instead of net, duplicate payment, payslip/payment divergence, private document leakage, retry mutation.
- **Rollback:** Stop new payment initiation; preserve finalized payroll/payslip/payment evidence; retry or reverse payment through its controlled lifecycle.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| D-001 | P0 | Approve payslip fields and employer-contribution display policy | C-001, BD-13 | Payslip product/compliance | Payslip clearly separates earnings, employee LWF, other deductions, net pay, and informational employer contribution | Compliance content review and sample reconciliation | Not Started |
| D-002 | P1 | Design payslip renderer from finalized lines only | C-009, D-001 | Payslip/document service | Renderer performs no independent calculation and matches persisted totals | Golden PDF/data, rounding, correction-version tests | Not Started |
| D-003 | P0 | Add employee-scoped payslip retrieval and private-file authorization | D-002 | Associate API/UI/storage | Only the employee and authorized roles can access the finalized payslip | Ownership, cross-user, inactive role, signed-link tests | Not Started |
| D-004 | P0 | Define payroll-result-to-payment contract and idempotency key | C-009 | Payroll/payment/wallet | Payment amount equals finalized net pay and references one payroll result uniquely | Contract, duplicate, mismatch, retry tests | Not Started |
| D-005 | P0 | Ensure payment failures/retries never recalculate or mutate payroll | D-004 | Payment service | Failed payment preserves finalized payroll; retry uses same source and key | Timeout, failure, retry, partial-status tests | Not Started |
| D-006 | P0 | Keep daily/hourly attendance settlements operationally separate | A-003, D-004 | Attendance/payment/reporting | Reports and APIs distinguish operational settlement from payroll salary payment | Mixed job/payment type and reporting tests | Not Started |
| D-007 | P1 | Add payroll payment status and reconciliation UI | D-004, D-005 | Employer/Admin/Associate UI | Users see payroll period, net amount, status, reference, failure/retry state | UI state and scope tests | Not Started |
| D-008 | P0 | Complete Phase D release gate after explicit approval | D-001–D-007 | Payslip/payment | Payslip, payroll result, and payment reconcile exactly; no duplicate payment | End-to-end isolated payment-adapter tests | Not Started |

## Phase E — Statutory liability and remittance

### Phase definition

- **Objective:** Convert finalized LWF payroll lines into state/establishment/period liabilities and record controlled statutory remittance evidence.
- **Reusable components:** Reporting filter/export patterns, Prisma transactions, role middleware, audit conventions, file storage/access patterns, reference/idempotency patterns.
- **Required modifications:** Liability aggregation, status lifecycle, remittance/evidence/allocation/reversal, reconciliation reports.
- **Candidate affected files:** New statutory liability/remittance services/controllers/routes/UI/tests; reporting framework; authorization; Prisma schema and approved migrations.
- **Database impact:** Likely liability, remittance, allocation, and audit structures; confirm whether generic statutory structures can support future PF/ESI/PT safely.
- **API impact:** Liability list/detail, remittance create/approve/reverse, reconciliation/report operations.
- **Dependencies:** Finalized Phase C payroll, role/approval decisions, verified due-date rules.
- **Primary risks:** Recalculating instead of aggregating payroll, duplicate reference, over-allocation, wrong state/period, destructive correction, confusing Associate payment with statutory remittance.
- **Rollback:** Disable new remittance writes; preserve approved evidence; reverse through linked records, never delete; liability remains derivable from finalized payroll.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| E-001 | P1 | Decide immediate versus deferred remittance scope and generic statutory reuse | A-001, Phase C roadmap | Finance/compliance architecture | Owner selects liability-only or full remittance release and future statutory scope | Architecture and compliance review | Not Started |
| E-002 | P1 | Design liability grain, status, due date, and unique grouping key | C-002, C-007, E-001 | Liability schema | Liability groups finalized lines by type/state/establishment/period/policy without recalculation | Grouping, correction, due-date review | Not Started |
| E-003 | P1 | Aggregate finalized employee and employer LWF lines transactionally | C-009, E-002 | Payroll/liability service | Employee + employer split and total exactly equal source lines | Multi-employee, correction, retry, concurrency tests | Not Started |
| E-004 | P1 | Design remittance, evidence, allocation, partial payment, and reversal lifecycle | E-001–E-003 | Remittance schema/service | Allocation cannot exceed approved liability; reversals are additive/audited | Partial, over-allocation, duplicate reference, reversal tests | Not Started |
| E-005 | P1 | Define maker-checker finance/compliance permissions | A-014, E-004 | Roles/auth | Maker cannot self-approve where required; employer/platform scopes are exact | Role matrix and cross-employer tests | Not Started |
| E-006 | P2 | Build liability/remittance UI using existing list/filter/form conventions | E-003–E-005 | Employer/Admin UI | State, period, split, due, payable, remitted, outstanding, evidence, status are visible | Filter, form, error, accessibility tests | Not Started |
| E-007 | P2 | Add state/establishment/period reconciliation and exports | E-003, E-004 | Reporting | Every total drills to finalized payroll and remittance allocations; export equals UI | Scope, totals, filters, large export tests | Not Started |
| E-008 | P1 | Enforce immutable approved remittance and controlled reversal | E-004, E-005 | Remittance/audit | Approved evidence cannot be edited/deleted; reversal preserves original | Mutation rejection, reversal and audit tests | Not Started |
| E-009 | P1 | Complete Phase E release gate after explicit approval | E-001–E-008 | Liability/remittance/reporting | Payroll lines = liability = remitted + outstanding + approved adjustments | End-to-end reconciliation/security/performance suite | Not Started |

## Phase F — Regression testing and release assurance

### Phase definition

- **Objective:** Prove LWF changes do not break salary, job, attendance, payment, authorization, data integrity, or legacy behavior.
- **Reusable components:** `nodebackend/tests/salaryStructure.test.ts`, existing attendance/wallet/report tests, frontend build/typecheck conventions, disposable database validation patterns.
- **Required modifications:** Add LWF resolver/schedule/payroll/payslip/payment/liability/remittance suites and end-to-end conformance fixtures.
- **Candidate affected files:** Test files/fixtures/configuration and the three audit planning documents; no production data.
- **Database impact:** Test-only disposable/isolated schemas and transactions; never production reset/seed.
- **API impact:** Test coverage only.
- **Dependencies:** Test cases are designed from Phase A onward; final certification depends on implemented phases.
- **Primary risks:** False confidence from mocked tests, missing concurrency/date boundaries, real external side effects, baseline unrelated failures.
- **Rollback:** Test failures block release; revert/disable the affected feature flag, not historical business data.

### Tasks

| Task ID | Priority | Description | Dependencies | Affected modules | Acceptance criteria | Required tests | Status |
|---|---|---|---|---|---|---|---|
| F-001 | P0 | Baseline existing salary/LWF/job/attendance/payment behavior before implementation | None | Existing test suites | Baseline results and unrelated failures are documented | Current focused tests/builds and read-only checks | Not Started |
| F-002 | P0 | Create approved compliance test vectors without real rates unless supplied by compliance | A-001, A-002 | Fixtures | Fixtures include versioned source/reference and synthetic labels where appropriate | Fixture review and expected-result sign-off | Not Started |
| F-003 | P0 | Add resolver, schedule, overlap, historical, and jurisdiction tests | Phase A design | LWF service/API/schema | All Phase A boundaries and typed outcomes are covered | See `LWF_REGRESSION_TEST_PLAN.md` | Not Started |
| F-004 | P0 | Add frontend/backend salary conformance and PF/ESI interaction tests | Phase B design | Salary UI/service | Preview and persisted backend totals agree for approved vectors | Component/rounding/template matrix | Not Started |
| F-005 | P0 | Add payroll idempotency, concurrency, finalization, correction, and historical tests | Phase C design | Payroll | No duplicate deduction/result; finalized records immutable | Parallel/rerun/backdate/correction tests | Not Started |
| F-006 | P0 | Add payslip/net-payment reconciliation and authorization tests | Phase D design | Payslip/payment | Payslip and payment equal finalized payroll and remain scoped | PDF/data/access/duplicate/retry tests | Not Started |
| F-007 | P1 | Add liability/remittance allocation and reconciliation tests | Phase E design | Liability/remittance/reports | Source-to-outstanding equation holds across partial/reversal cases | Grouping/allocation/reference/role tests | Not Started |
| F-008 | P0 | Add migration rehearsal for empty, legacy, partially deployed, and drifted disposable databases | Approved migrations | Prisma/SQL Server | Migration fails safely or completes predictably with verified rollback plan | Disposable DB migration matrix | Not Started |
| F-009 | P0 | Verify no real SMS, payment, remittance, migration, or production-data side effects in automated tests | All test suites | External integrations/data safety | Providers are mocked/disabled and target DB is verified disposable | Side-effect guard tests/config review | Not Started |
| F-010 | P1 | Run representative-volume and report-export tests | Implemented phases | Payroll/reporting | Runtime and export thresholds meet agreed limits without scope leakage | Volume, pagination, export, timeout tests | Not Started |
| F-011 | P0 | Execute final security/role matrix and tenant isolation review | A-014, implemented phases | All APIs/UIs | No cross-employer/state/employee access; inactive users fail closed | API authorization and direct-object-reference tests | Not Started |
| F-012 | P0 | Complete release checklist, feature-flag rollout, monitoring, and rollback rehearsal | F-001–F-011 | Deployment/operations | Every go criterion passes; rollback disables writes without deleting history | Smoke, monitoring alert, rollback rehearsal | Not Started |

## Overall completion rule

No phase is complete merely because its UI renders or its migration applies. Completion requires approved business decisions, source-backed implementation, exact authorization, focused and regression tests, backward compatibility, deployment verification, and a reversible feature-gated rollout. Production migration or activation requires a separate explicit owner instruction.
