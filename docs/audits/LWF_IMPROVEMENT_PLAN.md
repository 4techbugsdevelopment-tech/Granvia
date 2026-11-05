# Granvia LWF Improvement Plan

**Audit date:** 4 November 2026

**Status:** Proposed architecture and roadmap only; no implementation is authorized by this document

## Design goals

1. Keep statutory LWF policy configuration-driven and effective-dated.
2. Resolve jurisdiction from the legally applicable establishment/work assignment, not residential state by default.
3. Preserve the current authority boundary: Super Admin standards remain platform-controlled; any employer exception remains isolated to that employer and must be legally permitted.
4. Separate monthly salary-structure estimates from actual pay-period deductions.
5. Keep employee deductions, employer contributions, Associate salary payments, statutory liabilities, and remittances as distinct accounting concepts.
6. Make finalized payroll and remittance history immutable; corrections use additive adjustment/reversal records.
7. Reuse Granvia's State Master, salary component types, authorization middleware, transaction patterns, reporting conventions, and React design system.
8. Do not hardcode or seed statutory rates without approved legal sources.

## Recommended target architecture

```text
State Master + Establishment/Work Assignment + Pay Period + Employee Eligibility
                                 |
                                 v
                    Effective LWF Policy Resolver
                 (master policy + permitted employer scope)
                                 |
                 +---------------+----------------+
                 |                                |
                 v                                v
       Job salary estimate                 Payroll calculation
       (informational/monthly)        (period-specific authoritative)
                                                  |
                       +--------------------------+------------------+
                       |                          |                  |
                       v                          v                  v
                 Employee pay line       Employer LWF line    Liability ledger
                       |                                             |
                       v                                             v
                 Net salary payment                         Remittance + report
```

The effective resolver should accept a complete context, not only an employer ID:

```ts
{
  employerUserId,
  companyId,
  siteId,
  establishmentId,
  assignmentId,
  employeeUserId,
  employeeCategory,
  calculationDate,
  payPeriodStart,
  payPeriodEnd,
  grossOrEligibleWages,
  event: 'regular' | 'joining' | 'exit' | 'revision' | 'arrears' | 'correction'
}
```

The result should explain the decision:

```ts
{
  applicable,
  policyVersionId,
  jurisdictionStateId,
  contributionPeriodKey,
  employeeAmount,
  employerAmount,
  deductionTrigger,
  remittanceDueDate,
  reasonCode,
  legalReference
}
```

## State-wise configuration approach

### Policy ownership

- Super Admin creates and activates verified statutory policy versions by state/jurisdiction.
- Employer-specific records should represent only legally permitted establishment/applicability exceptions. If employers may change contribution amounts, compliance must explicitly approve that authority; otherwise rate fields remain Super Admin-controlled.
- No global hardcoded fallback applies when no active verified rule matches. The resolver returns `not_configured`/`not_applicable` distinctly so missing configuration cannot silently appear as statutory non-applicability.

### Jurisdiction

Add a canonical state reference to the legal establishment/work assignment path. Reuse `StateMaster`; do not create an LWF-specific state list.

Because existing operational records store state names, use a compatibility migration strategy:

1. Add nullable `stateId` references to the relevant establishment/site records while retaining existing text fields.
2. Backfill only exact, reviewed matches to `StateMaster`.
3. Require `stateId` for new/edited statutory establishment records after data cleanup.
4. Preserve original display text for compatibility until all consumers are migrated.

The policy resolver should prefer an explicit statutory establishment assignment. Falling back to site state should require a documented rule; falling back to Associate residential state should not occur unless compliance mandates it.

### Effective dating and history

- Create a new policy version for any rate, schedule, threshold, exemption, or legal-source change.
- Do not update a version that has been used by finalized payroll.
- Reject overlapping effective ranges for the same owner/jurisdiction/establishment/category/rule priority.
- Permit future-dated drafts and explicit activation/approval.
- Store both resolver inputs and the selected version on each payroll LWF line.

## Contribution frequency and schedule approach

Use a dedicated schedule structure rather than only a frequency string.

Suggested concepts:

- `cycle`: monthly, quarterly, half-yearly, yearly, custom.
- `periodBasis`: calendar year, financial year, or policy-defined cycle.
- `deductionMonths`: one or more configured payroll months.
- `periodKeyRule`: deterministic key such as `STATE:FY2026:H1`.
- `remittanceDueRule`: fixed day/month or offset from period end.
- `joiningRule`, `exitRule`, `transferRule`, `arrearsRule`.
- Optional employee/employer-specific schedule only if legislation requires different timing.

At payroll time, the schedule determines whether the current payroll is a trigger period. A non-trigger period should create no LWF pay line, rather than creating a zero line that could be mistaken for a calculated liability. The unique contribution-period key prevents repeat deduction across reruns.

## Salary integration design

Keep `SalaryStructurePanel` as a monthly contractual/estimate view, but distinguish:

- **Recurring monthly equivalent:** used only when policy genuinely recurs monthly.
- **Scheduled statutory contribution:** show the configured amount and next applicable period without subtracting it from every month's estimated net.
- **Annualized CTC:** annualize according to the schedule count, not always `monthly amount × 12`.

The server remains authoritative. The salary preview endpoint should return both monthly estimate totals and an LWF explanation. Existing managed component codes can remain for compatibility, but schedule metadata and policy version must accompany them.

Job-level estimates must not become employee-specific payroll facts. Eligibility depending on employee category/wages/joining date is resolved again during payroll using the immutable policy version applicable to that pay period.

## Payroll integration design

LWF cannot be safely integrated into the existing attendance settlement as a small patch. First establish a generic payroll foundation:

1. Create pay periods and draft payroll runs.
2. Snapshot eligible assignments, approved attendance/payable days, salary version, and work jurisdiction.
3. Calculate earnings/proration.
4. Resolve statutory/other deductions and employer contributions, including LWF.
5. Produce employee payroll results and typed line items.
6. Validate non-negative net salary or route exceptions through an approved carry-forward policy.
7. Review/approve/finalize with maker-checker permissions.
8. Make finalized results immutable.
9. Generate payslips from finalized lines.
10. Create net-salary payment instructions separately from employer statutory liabilities.

Idempotency should use a database unique key such as `(payrollRunId, employeeAssignmentId, componentCode, contributionPeriodKey, adjustmentSequence)`. A rerun of a draft replaces draft results transactionally. A finalized run cannot be rerun in place; corrections create linked reversal/adjustment runs.

## Payment and remittance design

### Employee salary payment

The employee payment amount comes from finalized payroll `netPay`, not `JobPost.salaryAmount`. Existing wallet/payment infrastructure may execute or evidence that payment after an explicit integration contract is defined. It must retain the payroll result/run reference and an idempotency key.

The current attendance settlement should remain a separate operational flow for explicitly daily/hourly jobs. Monthly structured jobs should be blocked from the ambiguous attendance fallback until payroll is available or an approved interim daily-rate contract is stored.

### Statutory liability

Finalized payroll creates LWF liability totals grouped by policy version, state, establishment, and contribution period, with separate employee-deducted and employer-contribution amounts. Liability status should progress independently of employee payment:

```text
calculated -> approved/payable -> partially_remitted -> remitted
                              -> adjusted/reversed
```

### Remittance

Reuse common transaction/audit/reporting patterns, but do not overload the Associate `Payment` table. A statutory remittance needs contribution period, state, establishment, liability allocation, amount, challan/reference, remittance date, due date, attachments, actor, status, and reversal links.

A remittance can allocate to one or more approved liabilities. Unique provider/reference constraints and allocation totals prevent duplicate or excessive remittance. Reports reconcile finalized payroll lines → liabilities → remittance allocations.

## Proposed data changes

These are conceptual and must be validated against compliance decisions before a migration is authored.

| Concept | Key fields | Reuse / rationale |
|---|---|---|
| `LwfPolicyVersion` | ID, owner scope, employer ID nullable, state ID, establishment scope, employee/employer amount/rule, thresholds, categories, exemptions, effective dates, status, legal reference, approved by/at, timestamps | Replaces mutable one-row policy with immutable effective versions |
| `LwfContributionSchedule` | Policy version ID, cycle, period basis, deduction trigger/months, due rule, joining/exit/transfer rules | Required for non-monthly and custom timing |
| `StatutoryEstablishment` or scoped extension | Employer/company, state ID, registration/reference, applicability dates/status | Explicit legal applicability instead of guessing from address |
| Assignment jurisdiction snapshot | Assignment/job/site/establishment, effective dates | Handles location changes and historical calculation |
| `PayrollPeriod` | Employer, start/end, pay date, status | Generic payroll foundation |
| `PayrollRun` | Period, employer/company scope, status, version, actors/timestamps | Preview/approval/finalization boundary |
| `PayrollEmployeeResult` | Run, assignment/employee, salary version, days, gross, deductions, net, employer cost | Final employee result |
| `PayrollLineItem` | Result, component code/category, amount, source policy version, contribution period key, metadata | Generic immutable earnings/deduction/contribution evidence |
| `StatutoryLiability` | Type LWF, state, establishment, period key, employee amount, employer amount, total, due date, status | Payable obligation separate from salary payment |
| `StatutoryRemittance` | State/establishment, reference, date, amount, status, attachment/audit fields | Payment evidence |
| `StatutoryRemittanceAllocation` | Remittance ID, liability ID, amount | Reconciliation and partial remittance |
| Policy/payroll audit event | Actor, action, before/after/source, timestamp, reason | Immutable auditability |

Where safe, extend existing generic salary component concepts and audit conventions. Do not force payroll lines or statutory liabilities into `JobSalaryComponent`, `Payment`, or wallet tables because their grain and legal meaning differ.

## Proposed API changes

All response examples should use the repository's existing snake_case API convention and standard error envelope.

### Configuration APIs

| Method and endpoint | Purpose | Inputs / response | Validation | Authorization / errors |
|---|---|---|---|---|
| `GET /admin/lwf-configurations` | List policy versions | Filters: state, status, cycle, effective date, employer; paginated rows with schedule and legal source | Validate filter IDs/enums/dates | Super Admin/compliance read; 403 scope errors |
| `POST /admin/lwf-configurations` | Create draft version | State, rates/rules, effective dates, schedule, eligibility, legal reference; returns draft/version ID | Active state; non-negative amounts; chronology; no overlap; schedule completeness | Policy-author permission; 422 field errors; 409 overlap |
| `GET /admin/lwf-configurations/:id` | Inspect version/history | Full policy, schedule, audit/use counts | Valid ID | Scoped read; 404 |
| `PATCH /admin/lwf-configurations/:id` | Edit unused draft only | Mutable draft fields | Reject active/used versions | Policy-author permission; 409 immutable |
| `POST /admin/lwf-configurations/:id/activate` | Approve/activate version | Approval reason | Legal source present; no overlap; maker != checker if required | Compliance approver; 409 conflict |
| `POST /admin/lwf-configurations/:id/deactivate` | End future use | End date/reason | Cannot erase historical use | Compliance approver |
| `GET /employer/lwf-configurations` | View effective standards and own exceptions | Employer-scoped filters/result | Auth scope | Employer read |
| `POST /employer/lwf-overrides` | Create permitted employer/establishment exception | Policy/state/establishment/applicability fields; rates only if permitted | Super Admin policy exists; exact scope; no overlap | Employer payroll/compliance permission; 422/409 |
| `POST /employer/lwf-overrides/:id/close` | End an exception | Effective-to/reason | No historical mutation | Employer scope |

### Resolution and salary-preview APIs

| Method and endpoint | Purpose | Inputs / response | Validation | Authorization / errors |
|---|---|---|---|---|
| `POST /employer/lwf/resolve-preview` | Explain applicable policy without persisting payroll | Company/site/establishment, employee category, date/period, wages; returns decision and reasons | Ownership, active location, complete context | Employer payroll/job permission; 422 ambiguous/missing policy |
| `POST /admin/lwf/resolve-preview` | Admin diagnostic preview | Same plus employer ID | Admin employer assignment/scope | Super Admin or assigned Job/Payroll role |
| `POST /employer/jobs/salary-preview` | Authoritative job estimate | Salary draft + location/date; returns normalized components, totals, LWF schedule explanation | Same salary validation plus LWF context | Employer job permission |

Existing `/admin/lwf-master` and `/employer/lwf-setting` can temporarily act as compatibility façades, but they should not silently map a state-less legacy row to all states. Migration/activation requires an explicit business decision.

### Payroll APIs

| Method and endpoint | Purpose | Inputs / response | Validation | Authorization / errors |
|---|---|---|---|---|
| `POST /employer/payroll-runs/preview` | Create/recalculate draft | Pay period, company/assignment scope; returns employee results, exceptions, totals | Closed attendance rules, assignment/salary versions, jurisdiction, unique draft | Payroll maker; 409 existing/finalized conflict |
| `GET /employer/payroll-runs/:id` | Review draft/final result | Run, employee rows, component lines, LWF explanations | Employer/company scope | Payroll read |
| `POST /employer/payroll-runs/:id/approve` | Approve reviewed draft | Comment/exception acknowledgements | All blocking errors resolved; maker-checker | Payroll approver |
| `POST /employer/payroll-runs/:id/finalize` | Freeze results and create liabilities | Idempotency key | Approved status; unique employee/period lines | Authorized finalizer; 409 on duplicate/state mismatch |
| `POST /employer/payroll-runs/:id/corrections` | Create linked correction run | Target lines, reason | Original finalized; open correction period | Elevated permission/audit |
| `GET /employees/me/payslips/:period` | Read finalized payslip | Finalized result and line breakdown | Employee ownership | Associate read; 404 if not finalized |

### Liability/remittance APIs

| Method and endpoint | Purpose | Inputs / response | Validation | Authorization / errors |
|---|---|---|---|---|
| `GET /employer/statutory/lwf-liabilities` | State/period liability report | Filters and grouped totals/status | Scope and date filters | Employer compliance/accounts |
| `GET /admin/statutory/lwf-liabilities` | Platform oversight | Employer/state/period/status filters | Admin scope | Super Admin/compliance |
| `POST /employer/statutory/lwf-remittances` | Record remittance | Liability allocations, reference, date, amount, attachment | Approved liabilities; allocation total; unique reference; not over-allocated | Remittance maker |
| `POST /employer/statutory/lwf-remittances/:id/approve` | Maker-checker approval | Approval note | Evidence complete; maker != approver | Remittance approver |
| `POST /employer/statutory/lwf-remittances/:id/reverse` | Controlled reversal | Reason/reference | Approved remittance; no destructive delete | Elevated approver |
| `GET /employer/statutory/lwf-reconciliation` | Payroll-to-remittance reconciliation | State/period/establishment | Finalized data only | Employer compliance/accounts |

## UI/UX recommendations

Reuse existing `PageHeader`, table, form-input, notice/error, modal/drawer, confirmation, and responsive layout conventions.

### LWF Master list

Show State, establishment scope, employee contribution, employer contribution, frequency, deduction period, effective dates, legal reference, status, and actions. Add state/frequency/status/effective-date filters and pagination only after multiple versions exist. Visually distinguish draft, future, active, expired, and superseded versions.

### Add/Edit configuration

Use staged sections:

1. Jurisdiction and establishment scope.
2. Employee/employer contribution rule.
3. Frequency and deduction/remittance schedule.
4. Eligibility, thresholds, categories, and exemptions.
5. Effective dates and legal source.
6. Review/activation confirmation.

Render overlap/schedule errors next to fields. Show a read-only impact preview. Used/active versions should open in view mode with “Create new version,” not destructive edit.

### Salary bifurcation

Show employee LWF and employer LWF separately, applicable state/establishment, policy source/version, frequency, next deduction period, net-pay impact, and employer-cost impact. For non-monthly schedules, avoid presenting the amount as a recurring monthly deduction.

### Payroll preview

For each employee show current-period LWF, employee/employer split, jurisdiction, contribution-period key, policy version/legal reference, reason applied/not applied, and blocking exceptions. Allow drill-down but not manual free-form amount override without a controlled adjustment reason and permission.

### Payment and reporting

Provide state/establishment/period totals for employee deducted, employer contribution, total payable, remitted, outstanding, overdue, and adjusted. Link each total back to payroll lines and remittance evidence.

## Prioritized implementation roadmap

### Workstream 0 — Business/compliance contract

- **Feature:** LWF legal and payroll decision record.
- **Current status:** Missing.
- **Issue:** Jurisdiction, override authority, schedules, eligibility, joining/exit/correction, and legal source are undefined.
- **Business impact:** Code cannot safely distinguish missing policy from non-applicability.
- **Proposed solution:** Product, payroll, finance, and compliance approve a versioned rules contract and representative state scenarios before schema work.
- **Affected frontend/backend/database/API:** None initially; specification governs all later areas.
- **Dependencies:** Verified statutory notifications and named compliance owner.
- **Risk/Priority/Complexity:** Critical / P0 / M.
- **Acceptance criteria:** Signed decision matrix covers every required scenario and explicitly defines employer override limits.
- **Required tests:** Review test vectors for at least monthly, half-yearly, yearly, joining, exit, transfer, rerun, backdate, and correction.

### Workstream 1 — Contain salary-settlement mismatch

- **Feature:** Safe rate source for attendance settlement.
- **Current status:** Confirmed defect.
- **Issue:** Monthly gross may be used as a per-attendance fallback; structured deductions/net are ignored.
- **Business impact:** Potential overpayment and employer-wallet over-debit.
- **Proposed solution:** After product approval, block monthly structured jobs from attendance settlement unless an explicit approved daily/hourly settlement rate exists; keep daily operational settlement separate from payroll.
- **Affected frontend:** Attendance approval screens and messages in `EmployerApp.tsx`, `AttendanceAdmin.tsx`, managed company attendance UI.
- **Affected backend:** `attendanceController.payableAmount/decideAttendance`, job validation, payment reporting.
- **Affected database/API:** Possibly an explicit settlement-rate/source field; attendance approval response errors.
- **Dependencies:** Decision whether monthly jobs use payroll only.
- **Risk/Priority/Complexity:** Critical / P0 / M.
- **Acceptance criteria:** A monthly gross can never be debited once per attendance record; daily/hourly flows remain unchanged.
- **Required tests:** Monthly structured job with/without explicit rate, daily/hourly regression, duplicate approval, wallet atomicity.

### Workstream 2 — Effective-dated state policy model

- **Feature:** State-wise immutable LWF configurations.
- **Current status:** One global mutable row.
- **Issue:** No state/date/history/legal source.
- **Business impact:** Incorrect statutory rate and weak audit evidence.
- **Proposed solution:** Add policy versions, canonical state link, approval state, legal reference, effective range, and controlled owner scope.
- **Affected frontend:** Replace/extend `LwfMaster.tsx`, `LwfSettingsPage.tsx`, `lwfService.ts`.
- **Affected backend:** `lwfController.ts`, `lwfService.ts`, routes, authorization/audit services.
- **Affected database/API:** New policy-version structures and configuration endpoints; retain compatibility façade temporarily.
- **Dependencies:** Workstream 0; State Master data quality.
- **Risk/Priority/Complexity:** High / P0 / L.
- **Acceptance criteria:** Multiple states and future versions coexist; overlaps fail; used versions cannot be mutated; no rule means explicit unresolved/not-applicable result.
- **Required tests:** CRUD/auth, overlap boundaries, timezone/date boundaries, inactive/future/expired rules, employer isolation, audit history.

### Workstream 3 — Schedule and eligibility engine

- **Feature:** Frequency, deduction periods, thresholds, categories, and exemptions.
- **Current status:** Missing; implicit monthly.
- **Issue:** Non-monthly and employee-specific rules cannot be represented.
- **Business impact:** Duplicate/missed deductions and wrong CTC.
- **Proposed solution:** Add schedule and eligibility rule structures with deterministic contribution-period keys.
- **Affected frontend:** Configuration form/list, salary explanation.
- **Affected backend:** Resolver and validators.
- **Affected database/API:** Schedule/eligibility fields/tables; preview endpoint.
- **Dependencies:** Workstreams 0 and 2.
- **Risk/Priority/Complexity:** Critical / P0 / XL.
- **Acceptance criteria:** Monthly, quarterly, half-yearly, yearly, and configured custom schedules resolve deterministically with no duplicate period.
- **Required tests:** Trigger/non-trigger months, FY/calendar boundaries, joins/exits/transfers, thresholds/caps/exemptions, inactive schedules.

### Workstream 4 — Establishment and assignment jurisdiction

- **Feature:** Legally correct work-state resolution.
- **Current status:** Site/company state strings exist; disconnected.
- **Issue:** No statutory establishment or historical assignment jurisdiction.
- **Business impact:** Wrong state policy, especially transfers/multi-state work.
- **Proposed solution:** Canonical state IDs, establishment applicability, and effective assignment snapshots.
- **Affected frontend:** Company/site/assignment forms and diagnostics.
- **Affected backend:** Company/site/job/assignment validation and LWF resolver.
- **Affected database/API:** Nullable canonical FKs, establishment/assignment history.
- **Dependencies:** Workstream 0; data-cleanup plan.
- **Risk/Priority/Complexity:** High / P0 / L.
- **Acceptance criteria:** Every payroll assignment resolves one auditable jurisdiction or blocks with a specific error.
- **Required tests:** Site/company mismatch, inactive state, transfer effective date, historical calculation, ambiguous establishment.

### Workstream 5 — Salary estimate integration

- **Feature:** Schedule-aware LWF in job salary bifurcation.
- **Current status:** Correct fixed monthly category treatment.
- **Issue:** Non-monthly LWF is repeated/annualized monthly and preview fetch failure can hide source.
- **Business impact:** Misleading net/CTC offers.
- **Proposed solution:** Authoritative preview API returns policy/schedule explanation and schedule-aware annualization; backend save remains authoritative.
- **Affected frontend:** `SalaryStructurePanel.tsx`, salary services, job screens.
- **Affected backend:** `salaryStructureService.ts`, job controllers, resolver.
- **Affected database/API:** Enhanced salary snapshot metadata and preview endpoint.
- **Dependencies:** Workstreams 2–4.
- **Risk/Priority/Complexity:** High / P1 / L.
- **Acceptance criteria:** Employee/employer split remains correct; non-trigger contributions are not represented as monthly deductions; displayed and stored preview agree.
- **Required tests:** Frontend/backend conformance, schedules, rounding, missing/ambiguous policy, tampered payload.

### Workstream 6 — Payroll foundation and LWF execution

- **Feature:** Pay periods, payroll runs/results/lines, approval/finalization/correction.
- **Current status:** Not implemented.
- **Issue:** Job estimates and attendance settlements cannot execute payroll deductions.
- **Business impact:** No compliant salary or LWF processing.
- **Proposed solution:** Generic payroll engine with period-specific LWF resolution and immutable finalized lines.
- **Affected frontend:** New payroll preview/review/finalization screens using existing design components.
- **Affected backend:** New payroll services/controllers plus attendance/salary consumers.
- **Affected database/API:** Payroll period/run/result/line/audit structures and APIs.
- **Dependencies:** Workstreams 0–5; payable-day and salary revision rules.
- **Risk/Priority/Complexity:** Critical / P1 / XL.
- **Acceptance criteria:** All mandatory scenarios execute deterministically; reruns are idempotent; final results cannot be edited; corrections are linked and auditable.
- **Required tests:** Calculation, concurrency, idempotency, authorization, negative net, backdate, correction, volume/performance, transaction rollback.

### Workstream 7 — Payslip and net-salary payment

- **Feature:** Finalized payslip and payment instruction.
- **Current status:** Not implemented; operational payment exists.
- **Issue:** No transparent LWF deduction or net-pay source.
- **Business impact:** Associate cannot verify deductions; payment can diverge from salary.
- **Proposed solution:** Generate payslip from finalized lines and create idempotent net-pay payment reference; do not copy gross job amount.
- **Affected frontend:** Associate payslip and Employer payroll payment status.
- **Affected backend:** Payslip generator, payment integration.
- **Affected database/API:** Payslip artifact/reference and payroll-payment link.
- **Dependencies:** Workstream 6.
- **Risk/Priority/Complexity:** High / P1 / L.
- **Acceptance criteria:** Payslip totals reconcile exactly to finalized payroll and payment amount equals net pay.
- **Required tests:** Access control, PDF/data parity, LWF display, corrections, duplicate payment, failed/retried payment.

### Workstream 8 — Liability and remittance

- **Feature:** LWF payable/remitted lifecycle.
- **Current status:** Not implemented.
- **Issue:** Employee deduction and employer contribution have no statutory obligation record.
- **Business impact:** No compliance control or evidence.
- **Proposed solution:** Aggregate finalized LWF lines into state/establishment/period liabilities and allocate controlled remittances.
- **Affected frontend:** Liability list, remittance form, evidence/reversal workflow.
- **Affected backend:** Liability/remittance services, approvals, reports.
- **Affected database/API:** Liability/remittance/allocation/audit models and APIs.
- **Dependencies:** Workstream 6 and finance/compliance permissions.
- **Risk/Priority/Complexity:** High / P1/P2 / XL.
- **Acceptance criteria:** Payroll totals equal liability; remittance cannot exceed/duplicate liability; partial and reversal flows reconcile.
- **Required tests:** Grouping, due dates, allocations, duplicate references, partial remittance, reversal, maker-checker, attachments.

### Workstream 9 — Reports and reconciliation

- **Feature:** State-wise LWF control reports.
- **Current status:** Generic reporting infrastructure only.
- **Issue:** No LWF liability/remittance report.
- **Business impact:** Outstanding/overdue obligations are invisible.
- **Proposed solution:** Reuse report filters/export/role scopes for state/establishment/period reconciliation.
- **Affected frontend:** Existing reporting hub patterns.
- **Affected backend:** Reporting query/response framework.
- **Affected database/API:** Read APIs only after liability data exists.
- **Dependencies:** Workstream 8.
- **Risk/Priority/Complexity:** Medium / P2 / M.
- **Acceptance criteria:** Every reported total drills to immutable payroll/remittance evidence; exports match UI totals.
- **Required tests:** Scope isolation, filters, totals, large data, timezone/date boundaries, read-only proof.

## Implementation phases

| Phase | Scope | Exit gate |
|---|---|---|
| P0-A | Compliance contract and settlement containment | Approved decisions; monthly gross cannot be used per attendance |
| P0-B | State/effective policy, schedules, eligibility, jurisdiction | Deterministic resolver with exhaustive test vectors |
| P1-A | Schedule-aware salary estimate | UI/backend parity and safe backward compatibility |
| P1-B | Payroll foundation and LWF line execution | Idempotent, immutable finalized payroll for pilot employer |
| P1-C | Payslip, net payment, liability creation | End-to-end payroll-to-liability reconciliation |
| P2-A | Remittance and maker-checker approval | Evidence, allocation, reversal, and duplicate safeguards |
| P2-B | Reports and advanced corrections | State-period reconciliation and audited correction workflows |

## Testing strategy

- Unit tests for resolver priority, date overlap, schedules, thresholds, exemptions, joining/exit/transfer, rounding, and contribution-period keys.
- Property/boundary tests around effective-date endpoints, FY/calendar transitions, zero/maximum amounts, and thresholds.
- Frontend/backend conformance vectors for every salary component and schedule.
- API authorization tests for Super Admin, delegated admin, Employer roles, payroll maker/approver, Associate, and inactive users.
- Integration tests with isolated database transactions for payroll idempotency, unique keys, rollback, finalization immutability, correction, liability aggregation, and remittance allocation.
- Regression tests preserving current daily/hourly attendance settlement where explicitly applicable.
- Security tests for employer/state/establishment scope and remittance evidence access.
- Read-only reconciliation tests proving payroll lines = payslip totals = net-pay instruction + deductions; LWF lines = liabilities = remittance allocations + outstanding.
- Representative-volume performance tests before production rollout.
- No real SMS, payments, remittances, migrations, or production data in automated tests.

## Backward compatibility

- Preserve existing job salary components and audit snapshots as historical estimates.
- Do not reinterpret legacy `lwfSettingId` as a complete statutory policy version.
- Mark legacy state-less settings as `legacy_unscoped`; do not auto-activate them for every state.
- Preserve legacy jobs with only `salaryAmount` and do not invent component history.
- Keep current LWF endpoints during a versioned deprecation window, returning clear legacy status.
- Do not bulk-recalculate existing job structures or finalized future payroll without explicit migration/approval.
- Keep daily/hourly operational settlement only for jobs with an explicit compatible payment contract.

## Safe rollout and rollback

1. Deploy new schema and APIs behind feature flags after target-database verification and DBA-approved migration review.
2. Import/configure no statutory rates until compliance approval; start with draft policies.
3. Run resolver and payroll in shadow/preview mode without deductions or money movement.
4. Compare outputs against approved payroll test cases for a pilot employer/state.
5. Enable policy UI, then payroll preview, then finalization, then payment/liability, then remittance in separate gates.
6. Monitor unresolved jurisdiction, missing policy, duplicate-period attempts, negative-net exceptions, and reconciliation deltas.
7. Rollback by disabling new calculation/finalization feature flags. Preserve all created audit and finalized records; never delete them during rollback.
8. If a policy is wrong, close/supersede it and create corrective payroll/liability entries. Do not edit historical finalized records.

Production migration, feature activation, real payroll, and remittance remain outside this planning task and require explicit project-owner approval.
