# Granvia LWF Implementation Readiness

**Review date:** 4 November 2026

**Status:** Planning complete; implementation is not authorized

## Purpose and evidence boundary

This document validates the four LWF audit documents against the current React, Express/Node.js, Prisma/SQL Server, route, and test source. It defines the dependency gates for implementation without changing application code, schemas, APIs, formulas, migrations, or business data.

Evidence reviewed:

- `docs/audits/LWF_CURRENT_IMPLEMENTATION_AUDIT.md`
- `docs/audits/LWF_GAP_ANALYSIS.md`
- `docs/audits/LWF_IMPROVEMENT_PLAN.md`
- `docs/audits/LWF_AUDIT_SUMMARY.md`
- Current LWF, salary, job, location, assignment, attendance, payment, wallet, schema, route, authorization, and test files listed below.

`npm.cmd run test:salary-structure` passed 15/15 focused mock-only tests on 4 November 2026. The restricted launcher first failed before executing tests with `uv_os_get_passwd returned ENOMEM`; the same suite passed outside that launcher. No database or business data was accessed by the suite.

Migration deployment, live database contents, built/deployed server artifact, browser flows, and production behavior remain **Not runtime-verified**.

## Verified audit findings

| Capability | Classification | Current evidence | Verified conclusion |
|---|---|---|---|
| Super Admin LWF standard | Partially implemented | `frontend/src/web-admin/pages/LwfMaster.tsx`; `lwfController.master/saveMaster`; `LwfMasterSetting` | One mutable `STANDARD` record stores fixed employee/employer monthly amounts, status, notes, and audit IDs |
| Employer LWF override | Partially implemented | `LwfSettingsPage.tsx`; `saveEmployerSetting/resetEmployerSetting`; `EmployerLwfSetting` | One employer-wide override wins whenever present; no state/date/establishment scope |
| Managed LWF injection | Implemented and connected | `lwfService.applyEffectiveLwfSetting`; `salaryStructureService.saveJobSalaryStructure` | Client LWF rows are removed and server values are injected before authoritative calculation |
| Employee/employer formula split | Implemented and connected for job estimate | `calculateSalaryStructure`; `SalaryStructurePanel.calculateSalaryDraft` | Employee LWF reduces estimated net; employer LWF increases employer cost; deductions above gross fail |
| LWF source snapshot | Partially implemented | `JobSalaryStructure.lwfSource/lwfSettingId`; `JobSalaryComponent`; `JobSalaryAuditEvent` | Applied values/source are saved, but mutable setting rows and absent dates prevent authoritative policy history |
| State Master | Implemented but disconnected | `StateMaster`, `CityMaster`; `locationMasterController`; `LocationMaster.tsx`; `CityStateSelect.tsx` | Canonical state/city management exists, but LWF has no state relation or lookup |
| Work location | Implemented but disconnected | `EmployerCompany.state`; `CompanySite.state`; `JobPost.companyId/siteId`; `JobApplication/JobOffer/AttendanceRecord` links | Location context exists but the LWF resolver accepts only employer ID |
| Frequency/schedule | Missing | LWF schema/controller/UI; monthly labels in both LWF pages | No cycle, deduction month, contribution period, due-date, or custom schedule model |
| Effective dates/history | Missing | `LwfMasterSetting` and `EmployerLwfSetting` are upserted in place | No effective range, version, overlap validation, supersession, or historical lookup by date |
| Eligibility/exemptions | Missing | Managed LWF rows set min/max gross to `null`; no category/exemption fields | Generic salary thresholds exist but managed LWF does not use them |
| Job salary bifurcation | Partially implemented | `SalaryStructurePanel`; `jobController.store/update/adminStore/adminUpdate`; salary schema/models | Monthly job estimate is connected; it is not employee/pay-period payroll |
| Payroll | Missing | No payroll controller/service/route/model/UI; repository reports call payroll pending | No period, payable days, employee result, lines, approval, finalization, rerun, or correction |
| Payslip | Missing | No payslip model/generator/API/UI | Cannot show finalized deductions or net pay |
| Attendance settlement | Defective for monthly structured fallback | `attendanceController.payableAmount/decideAttendance`; `jobController` copies gross to `JobPost.salaryAmount` | Non-hourly attendance can fall back to gross monthly salary once per approved attendance record |
| Salary payment | Implemented but disconnected | `paymentController`; `Payment`; employer/Associate wallets | Operational payment exists, but it does not consume job net salary or LWF lines |
| Statutory liability/remittance | Missing | No LWF liability/remittance models, routes, services, or reports | Employee deduction and employer contribution cannot be tracked or reconciled as a statutory obligation |
| Current authorization | Implemented and connected for current narrow scope | `requireAdminPanel`; `requireRole`; `assertPersistedSuperAdmin`; admin employee access map | Super Admin master and authenticated-employer boundaries are enforced; future payroll/remittance roles are undefined |

## Source-backed implementation facts

### Current LWF path

1. `SalaryStructurePanel` fetches the effective setting through `frontend/src/services/lwfService.ts`.
2. `lwfController.adminEffective/employerSetting` calls `resolveEffectiveLwfSetting()`.
3. `jobController` passes the submitted salary structure into `saveJobSalaryStructure()` within the job transaction.
4. `saveJobSalaryStructure()` loads employer statutory rules and effective LWF, calls `applyEffectiveLwfSetting()`, then calls `calculateSalaryStructure()`.
5. Calculated totals and components are persisted to `JobSalaryStructure` and `JobSalaryComponent`; a JSON snapshot is written to `JobSalaryAuditEvent`.
6. Calculated gross is copied to `JobPost.salaryAmount` for compatibility.

### Current payment path

1. Attendance approval calls `attendanceController.decideAttendance()`.
2. `payableAmount()` uses Associate hourly/daily rate first and `JobPost.salaryAmount` as fallback.
3. It does not load `JobSalaryStructure`, `netMonthly`, or any component.
4. Approval creates `Payment`, debits the employer wallet, reserves the Associate amount, and creates wallet transaction evidence.

These are separate flows. The current job salary estimate must not be described as payroll or as proof that LWF affects salary payment.

## Current-to-target workflow

### 1. State Master

- **Existing:** `StateMaster`/`CityMaster` CRUD and active-state selection are connected to profile/company/site validation.
- **Target:** Reuse `StateMaster` as the only canonical state source for LWF jurisdiction.
- **Source data:** Active state ID plus the legally applicable establishment/work assignment.
- **Responsibility:** Location modules validate identity; the LWF resolver decides jurisdiction from approved employment context.
- **Dependencies:** Reviewed mapping from existing state-name strings to state IDs; establishment decision.
- **Validation:** Active state, unambiguous mapping, employer/company/site ownership.
- **Output:** Canonical `jurisdiction_state_id` or a blocking unresolved-jurisdiction result.
- **Errors:** Never silently fall back to residential state or a global rate.
- **Impact:** Company/site/assignment data may need canonical references while retaining legacy text during migration.

### 2. LWF Master

- **Existing:** One global standard plus one employer override.
- **Target:** Immutable, effective-dated, state/establishment-scoped policy versions with verified legal source, contribution split, eligibility, schedule, approval, and audit.
- **Source data:** State Master, statutory notification, employer/establishment scope, compliance decisions.
- **Responsibility:** Super Admin/compliance owns standard policy; employer exception authority is limited by approved rules.
- **API dependency:** Versioned list/create/view/activate/close and resolution-preview operations; legacy endpoints remain compatibility-only until retired.
- **Database dependency:** Effective policy versions, schedules, audit, and optional establishment applicability. Exact table count remains a design decision.
- **Validation:** Non-negative amounts, date chronology, overlap prevention, schedule completeness, legal source, maker-checker if approved.
- **Output:** One explainable applicable policy or a typed `not_applicable`, `not_configured`, or `ambiguous` result.
- **Errors:** 409 for overlap/immutable conflict; 422 for invalid/incomplete rules; 403 for authority violations.
- **Impact:** Current state-less rows cannot be auto-promoted to all states.

### 3. Applicable Job/Associate

- **Existing:** Job, company, site, application, offer, agreement, and attendance links exist; Associate residential state is stored separately.
- **Target:** Effective assignment/establishment jurisdiction plus employee category, wages, joining/exit/transfer events, and exemptions.
- **Source data:** Job/site/establishment, assignment dates, Associate category, pay-period wages.
- **Responsibility:** Employment/assignment layer provides facts; LWF resolver applies policy.
- **Dependencies:** Business definition of establishment and employee eligibility.
- **Validation:** Ownership, assignment effective dates, one applicable jurisdiction, required category/eligibility facts.
- **Output:** Resolution context and immutable decision snapshot.
- **Errors:** Block calculation when jurisdiction or eligibility data is ambiguous.
- **Impact:** Residential state is not the default statutory state.

### 4. Salary Bifurcation

- **Existing:** Monthly earnings, deductions, contributions, gross, net, employer cost, and annual CTC are calculated server-side; managed LWF is fixed monthly.
- **Target:** Preserve formulas while showing applicable state, policy/version, employee/employer split, frequency, and next applicable deduction period.
- **Source data:** Job salary draft plus policy preview context.
- **Responsibility:** Backend salary preview/save remains authoritative; frontend remains a preview.
- **API dependency:** Prefer one authoritative salary-preview result rather than independent frontend rule inference.
- **Database dependency:** Policy/schedule snapshot metadata on the saved job estimate if needed.
- **Validation:** Existing component checks plus policy resolution and schedule semantics.
- **Output:** Contractual/monthly estimate with clear scheduled statutory treatment.
- **Errors:** A missing policy is visibly distinct from non-applicability.
- **Impact:** Half-yearly/yearly LWF must not be subtracted every month or annualized as 12 recurring payments.

### 5. Payroll Calculation

- **Existing:** Missing. Attendance settlement is not payroll.
- **Target:** Pay periods, draft runs, payable days/earnings, employee results, typed lines, LWF contribution-period key, approval, finalization, rerun rules, and corrections.
- **Source data:** Approved attendance/payable days, salary version, assignment/jurisdiction, employee eligibility, effective policy/schedule.
- **Responsibility:** Payroll service calculates period-specific earnings/deductions/contributions and persists the authoritative result.
- **API dependency:** Preview/recalculate/review/approve/finalize/correction operations.
- **Database dependency:** Payroll period/run/result/line/audit records or safe equivalent extensions.
- **Validation:** Idempotency, negative net, finalized immutability, historical policy selection, duplicate contribution-period prevention.
- **Output:** Final gross, employee deductions, net pay, employer contributions, and policy-linked LWF lines.
- **Errors:** Draft can be recalculated; finalized run requires linked reversal/adjustment, never in-place edit.
- **Impact:** This is a platform payroll foundation, not an LWF-only controller.

### 6. Payslip

- **Existing:** Missing.
- **Target:** Generate from finalized payroll lines only.
- **Source data:** Immutable finalized employee result and line items.
- **Responsibility:** Payslip service renders evidence; it performs no independent calculation.
- **API/database dependency:** Employee-scoped retrieval and artifact/reference strategy.
- **Validation:** Employee ownership, finalized status, exact total reconciliation.
- **Output:** Gross, each deduction including employee LWF, net pay, and employer contribution information where approved for display.
- **Errors:** No payslip for draft/unfinalized payroll.
- **Impact:** Existing offer/agreement documents remain separate.

### 7. Salary Payment

- **Existing:** `Payment` and wallet settlement exist, but are attendance/application-based.
- **Target:** Net salary payment is created from finalized payroll `net_pay` with an idempotent payroll-result reference.
- **Source data:** Finalized payroll result, never gross `JobPost.salaryAmount`.
- **Responsibility:** Payroll owns amount; payment/wallet layer executes or records it.
- **API/database dependency:** Explicit payroll-payment contract and unique reference.
- **Validation:** Finalized result, amount equality, no duplicate payment, retry-safe status transitions.
- **Output:** Payment evidence linked to payroll result.
- **Errors:** Failed payment does not alter finalized payroll; retry uses the same idempotency key.
- **Impact:** Daily/hourly operational settlement remains separate and must have an explicit compatible rate source.

### 8. LWF Liability

- **Existing:** Missing.
- **Target:** Aggregate finalized LWF lines by policy version, state, establishment, and contribution period.
- **Source data:** Finalized payroll LWF employee and employer lines.
- **Responsibility:** Liability service aggregates; it does not recalculate payroll.
- **API/database dependency:** Liability view/status and immutable source links.
- **Validation:** Sum of source lines, unique grouping key, due-date rule, adjustment linkage.
- **Output:** Employee deducted, employer contributed, total payable, due date, and status.
- **Errors:** Reconciliation mismatch blocks approval/remittance.
- **Impact:** Liability is legally and financially separate from Associate `Payment`.

### 9. Statutory Remittance

- **Existing:** Missing.
- **Target:** Maker-checker remittance with references, evidence, allocation, partial payment, reversal, and reconciliation.
- **Source data:** Approved liabilities and actual remittance evidence.
- **Responsibility:** Authorized finance/compliance roles record and approve; no automatic real payment is proposed without a separate integration decision.
- **API/database dependency:** Remittance and allocation lifecycle; report endpoints.
- **Validation:** Unique reference, allocation total, no over-remittance, state/period scope, immutable approved evidence.
- **Output:** Remitted/outstanding/overdue state and complete audit trail.
- **Errors:** Corrections use reversal/allocation adjustments, not deletion.
- **Impact:** Existing payment/wallet records may supply reusable patterns but must not store statutory remittance directly.

## Salary calculation contract to preserve

- `Net Salary = Gross Earnings - Applicable Employee Deductions`.
- `Employer Cost = Gross Earnings + Applicable Employer Contributions + Other Employer Costs`.
- Employee LWF is a deduction only in an applicable contribution period.
- Employer LWF is an employer cost/liability and never reduces employee net salary.
- Contribution frequency determines the statutory contribution period, not salary-payment frequency.
- A half-yearly or yearly contribution creates a line only in its configured trigger period unless the approved state rule requires another treatment.
- Backend calculation remains authoritative; frontend calculation is preview-only.
- Existing PF, ESI, HRA, custom component, threshold/cap, decimal rounding, and deduction-above-gross behavior remain unchanged unless a separately confirmed defect is approved for correction.
- Historical payroll resolves the policy effective for the historical calculation date and assignment context.
- Draft recalculation is replaceable and idempotent; finalized payroll is immutable and corrected through linked adjustments/reversals.

Rounding proposal requiring approval: round each payroll component to two decimals using the existing backend half-up rule, then sum persisted rounded lines. Aggregate remittance rounding must follow the verified statutory notification if it differs.

## Dependency map

```text
G0 Owner/compliance decisions + authoritative notifications
 |\
 | +--> A0 Monthly-settlement safety containment
 |
 +----> A1 Canonical jurisdiction and data-quality plan
          |
          +--> A2 Effective-dated LWF policy + schedule + eligibility
                    |
                    +--> B Salary bifurcation preview/snapshot
                    |      |
                    |      +--> C Payroll foundation and LWF execution
                    |               |
                    |               +--> D Payslip and net-salary payment
                    |               |
                    |               +--> E Liability and remittance
                    |
                    +--> F Continuous regression/security/data tests
```

Phase E cannot start from job salary components alone. It requires finalized payroll LWF lines. Phase D payment cannot use job gross; it requires finalized employee net pay. Phase B must not activate state policies until Phase A has an unambiguous jurisdiction contract.

## Prioritized gaps

### P0 — blocking safety and policy gaps

1. Monthly structured-job gross may be used as one attendance settlement amount.
2. No approved legal source/jurisdiction/override/schedule/eligibility contract.
3. No canonical state/establishment link in LWF policy resolution.
4. No effective-dated immutable policy versions or overlap rules.
5. No contribution-period key or duplicate-deduction design.
6. Target database migration/deployment state is unverified.

### P1 — payroll execution gaps

1. Salary estimate is not schedule-aware.
2. No pay periods, employee results, line items, approval, finalization, or correction.
3. No payslip or net-pay-linked payment.
4. No statutory liability aggregation.

### P2 — compliance operations

1. No remittance/evidence/allocation/reversal lifecycle.
2. No state-period liability and reconciliation reports.
3. No due-date monitoring or advanced historical adjustment reporting.

## Recommended implementation phases

| Phase | Objective | Start dependency | Exit criterion |
|---|---|---|---|
| A0 | Contain monthly settlement risk and approve the rules contract | Owner authorization | Monthly gross cannot be debited per attendance; decisions signed |
| A1 | Complete state/effective LWF Master foundation | A0 decisions; State Master quality review | Deterministic, explainable, versioned policy resolution |
| B | Integrate schedule-aware LWF into salary bifurcation | A1 | Existing salary formulas regress cleanly; non-monthly LWF is not monthly-deducted |
| C | Build payroll and period-specific LWF execution | A1, B, payroll rules | Idempotent preview/finalization/correction with historical policy |
| D | Generate payslip and pay finalized net salary | C | Payslip and payment reconcile exactly to finalized payroll |
| E | Create liability, remittance, and reconciliation | C; finance/compliance roles | Payroll LWF lines reconcile to liabilities and remittances |
| F | Complete regression, security, migration, and rollback validation | Runs across A-E | All release gates pass with no real external payment/data mutation |

Detailed tasks and tests are maintained in `LWF_PHASE_WISE_TASKS.md` and `LWF_REGRESSION_TEST_PLAN.md`.

## Business decision register

| ID | Decision requiring approval | Recommended default proposal | Why approval is required |
|---|---|---|---|
| BD-01 | Applicability state source | Resolve from approved statutory establishment/work assignment; never default to residential state | Legal jurisdiction may not equal address |
| BD-02 | Automatic applicability | Apply automatically when one active policy and eligibility match; block ambiguous/missing context | Prevent silent manual/non-compliant choice |
| BD-03 | Manual override | Permit only authorized applicability exception with reason, evidence, expiry, and audit; do not permit arbitrary rate changes | Statutory rates should remain controlled |
| BD-04 | Employer rate authority | Super Admin/compliance owns statutory rates; employer may define only approved establishment exceptions | Preserves platform authority and compliance consistency |
| BD-05 | Inactive override semantics | Close the override and fall back only when an active standard legally applies; otherwise return explicit not-applicable/unconfigured | Current behavior is ambiguous |
| BD-06 | Schedule representation | Store cycle plus explicit contribution periods/deduction triggers/due rule | Frequency alone is insufficient |
| BD-07 | Rate changes and jobs | Do not bulk-recalculate old job snapshots; new previews/saves use current policy | Preserves historical offers/estimates |
| BD-08 | Historical payroll | Resolve immutable policy version effective for the pay period and assignment | Avoid future-rate leakage |
| BD-09 | Corrections | Finalized payroll/remittance is immutable; correct through linked reversal/adjustment | Required auditability |
| BD-10 | Monthly job settlement | Do not allow attendance settlement to use monthly job gross; monthly jobs use payroll or an explicit approved interim rate | Contains confirmed overpayment risk |
| BD-11 | Configuration roles | Separate policy author and approver where feasible; employers cannot edit platform rates | Maker-checker reduces statutory risk |
| BD-12 | Remittance timing | Implement after payroll liability is authoritative unless the owner requires it in the first regulated release | Avoid building an ungrounded payment ledger |
| BD-13 | Employer contribution on payslip | Show as informational employer contribution, not a net deduction, if product/compliance approves | Payslip presentation policy |
| BD-14 | Rounding | Reuse two-decimal half-up per line unless the verified state rule says otherwise | Statutory aggregation may differ |

Every recommended default above is a proposal, not an approved legal rule.

## Compliance verification requirements

Before activating any state policy, obtain and version:

- Authoritative legislation/notification and amendment reference.
- State/union-territory and establishment applicability.
- Effective dates and superseded rule.
- Employee and employer amounts or calculation basis.
- Wage definition, thresholds, caps, employee categories, and exemptions.
- Frequency, contribution period, deduction trigger, and remittance due date.
- Joining, exit, transfer, revision, arrears, backdated payroll, correction, and rounding treatment.
- Compliance owner approval and review date.

No rate should be hardcoded, scraped, or seeded from an unverified rate table. `not_configured` must remain different from `not_applicable`.

## Go/no-go criteria

### Go for Phase A0 planning/containment

- Owner explicitly authorizes the containment change and confirms monthly versus daily/hourly settlement boundaries.
- A named product and compliance decision owner is assigned.
- Existing daily/hourly behavior and affected monthly flows are identified.

### Go for Phase A1 implementation

- BD-01 through BD-06, BD-11, and BD-14 are approved.
- At least one pilot state has an authoritative verified rule package.
- State/establishment data mapping and legacy-setting treatment are approved.
- Target database and migration history are inspected without drift assumptions.
- Proposed schema/API compatibility and rollback are reviewed.

### Go for Phase B

- Phase A resolver returns deterministic explained decisions.
- State/effective/schedule tests pass.
- Legacy job behavior and no-policy behavior are approved.

### Go for Phase C

- Payroll period, payable days, proration, revision, negative-net, finalization, correction, and role decisions are approved.
- Phase B regression suite passes.
- Idempotency and immutable history design is approved.

### Go for Phase D/E

- Finalized payroll is authoritative and reconciles at line level.
- Payment ownership/retry contract and finance/compliance permissions are approved.
- Liability grouping, due dates, remittance evidence, partial allocation, reversal, and reporting decisions are approved.

### No-go conditions

- No authoritative statutory source or unclear jurisdiction.
- Unresolved monthly gross attendance-settlement risk in a release that enables structured monthly jobs.
- Attempt to auto-convert the legacy global setting into state policies.
- Missing overlap/idempotency/immutable-history safeguards.
- Migration drift or unverified deployment target.
- Any plan to calculate payment from job gross instead of finalized net payroll.
- Any plan to store statutory remittance as an Associate payment/wallet transaction.

## Readiness conclusion

Granvia is **not ready for a full LWF payroll/remittance implementation**. It is ready for an owner-approved **Phase A0 safety containment and compliance-contract phase**, followed by the state/effective LWF Master foundation. Salary integration can follow only after deterministic policy resolution. Payroll, payslip/payment, liability, and remittance must remain dependency-ordered downstream work.

No implementation, migration, deployment, statutory rate population, or production activation is authorized by this document.
