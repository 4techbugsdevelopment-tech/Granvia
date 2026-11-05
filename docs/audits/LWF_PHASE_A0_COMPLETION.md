# Granvia LWF Phase A0 Completion

**Completed locally:** 4 November 2026  
**Scope:** Phase A0 safety containment and proposed compliance contract only  
**Release status:** Not deployed, not committed, not production-verified  
**Owner status:** Engineering containment complete; compliance and settlement decisions await approval

## Outcome

The monthly attendance-settlement defect is confirmed and contained locally. A monthly job can no longer use `JobPost.salaryAmount` as a per-attendance amount when the Associate has no positive configured daily rate. The request now fails with an actionable HTTP 422 before a `Payment`, employer-wallet debit, Associate-wallet reserve, or attendance approval is written.

No monthly proration or payable-day formula was implemented because none is documented or unambiguous. Existing salary structure, gross salary, deductions, net salary, employer cost, annual CTC, LWF injection, saved salary snapshots, daily settlement, and hourly settlement calculations were not changed.

The compliance configuration below is a proposed owner-review contract. It contains no statutory rates and does not assert any legal requirement that has not been supplied by an authoritative source.

## 1. Settlement defect investigation

### End-to-end source trace

1. `SalaryStructurePanel.tsx` creates a monthly earnings/deductions/employer-contribution estimate. Managed employee and employer LWF rows are read-only in this preview.
2. `jobController.ts` requires a structured salary job to use payment type `Monthly`.
3. `salaryStructureService.saveJobSalaryStructure()` resolves employer/master LWF, injects the managed rows, calculates totals, and persists the structure, component rows, LWF source, setting ID, and audit snapshot.
4. `jobController.ts` copies the calculated `gross_monthly` into the compatibility field `JobPost.salaryAmount`.
5. On attendance approval, `attendanceController.decideAttendance()` loads only the job's `salaryAmount` and `paymentType`, then loads the Associate-wide `GuardProfile.dailyRate` and `hourlyRate`.
6. The former non-hourly calculation selected `guardProfile.dailyRate ?? job.salaryAmount`. For a monthly job with no daily rate, that made the job's monthly gross one attendance-settlement amount.
7. That amount was then used to create `Payment`, debit the employer wallet, reserve the Associate wallet amount, create wallet transactions/notifications, and approve the attendance record.

The attendance path does not load `JobSalaryStructure.netMonthly`, salary components, payable days, a payroll period, or an employee payroll result. It is an operational attendance settlement path, not payroll.

### Exact root cause

Two individually intentional compatibility choices became unsafe when combined:

- Structured monthly job creation stores calculated gross monthly salary in the legacy `JobPost.salaryAmount` field.
- Non-hourly attendance settlement treated that same field as a fallback daily/payment amount.

The field therefore had two incompatible units: monthly gross in the job flow and per-attendance amount in the settlement flow. No unit/type guard prevented the substitution.

### Affected source files

Backend execution path:

- `nodebackend/src/controllers/jobController.ts` - copies calculated monthly gross to `JobPost.salaryAmount`.
- `nodebackend/src/services/salaryStructureService.ts` - calculates and snapshots gross, deductions, net, employer contributions, employer cost, and LWF source.
- `nodebackend/src/services/lwfService.ts` - resolves and injects current managed LWF rows.
- `nodebackend/src/controllers/attendanceController.ts` - selects the settlement rate and starts payment/wallet writes; this is the corrected file.
- `nodebackend/src/controllers/walletController.ts` - debits the employer wallet after the settlement amount is selected.
- `nodebackend/prisma/schema.prisma` - defines Associate-wide daily/hourly rates, job salary amount, salary snapshots, attendance, and payment records.

Frontend entry/display path, reviewed but unchanged:

- `frontend/src/components/salary/SalaryStructurePanel.tsx`
- `frontend/src/employer/EmployerApp.tsx`
- `frontend/src/web-admin/pages/AttendanceAdmin.tsx`
- `frontend/src/web-admin/pages/CompanyDepartments.tsx`
- `frontend/src/services/attendanceService.ts`
- `frontend/src/services/reportService.ts`
- `frontend/src/services/apiErrors.ts`

The current employer and Super Admin attendance screens already surface the backend error message, so a frontend calculation or silent replacement was not added.

### Record impact

- Existing job salary structures and audit snapshots are not changed by this correction.
- Existing completed `Payment` and wallet records are not automatically changed, reversed, or corrected.
- Historical records may be affected if attendance for a monthly job was approved while the Associate had no positive daily rate. Source inspection cannot establish whether or how often that occurred.
- Pending attendance records are unchanged in storage. After this source is built and deployed, approval will fail closed for an affected monthly job until an approved daily rate exists or a future payroll flow is used.
- No production or local business database was queried or modified during Phase A0.

A read-only historical query and a separately approved financial correction process are required before any existing transaction is treated as erroneous or adjusted.

### Need for a separate rate

An attendance-based operational settlement for a monthly job requires one of the following owner-approved sources:

1. an explicit per-day/per-attendance contractual amount; or
2. an approved payroll/payable-day and proration calculation.

Granvia currently has `GuardProfile.dailyRate`, but it is Associate-wide rather than job-, assignment-, establishment-, or effective-date-specific. Phase A0 preserves it as the only existing explicit daily amount, but its long-term authority and scope require an owner decision. Dividing monthly gross by a fixed number of days, calendar days, attendance days, or duty days was deliberately not implemented.

### Overpayment and underpayment assessment

- **Confirmed overpayment risk:** without a daily rate, the former logic could pay the full monthly gross for each approved attendance record. Repeated approvals could repeat that amount.
- **Gross-versus-net mismatch:** the fallback used gross before employee deductions and did not represent an authoritative net salary payment.
- **Overpayment or underpayment risk from explicit profile rates:** an Associate-wide daily/hourly rate can be stale or differ from the applicable job/assignment contract. It can therefore pay more or less than the amount actually due.
- **Exact variance unknown:** without an approved per-day or payroll formula, the legally/contractually correct comparison amount cannot be calculated from source alone.

## 2. Safe correction implemented

`payableAmount()` now applies this order:

1. Hourly jobs retain the existing hourly-rate multiplied by recorded-hours calculation.
2. Non-hourly jobs use a positive configured Associate daily rate when present.
3. A monthly job without that rate fails with HTTP 422 and does not fall back to job gross.
4. Non-monthly daily/legacy jobs retain the existing job-amount fallback.

The failure message is:

> Monthly gross salary cannot be used as an attendance settlement amount. Configure an approved Associate daily rate or use the approved payroll flow.

Changed files:

- `nodebackend/src/controllers/attendanceController.ts`
- `nodebackend/tests/salaryStructure.test.ts`
- `docs/audits/LWF_PHASE_A0_COMPLETION.md`

No schema, migration, LWF amount, salary formula, production data, or frontend file was changed for Phase A0.

## 3. Proposed LWF compliance configuration contract

This contract defines the information and deterministic outcomes required before Phase A1. It is a product/compliance proposal, not an activated legal configuration.

| Area | Proposed contract | Required control |
|---|---|---|
| Applicable employment state | Resolve a canonical active `StateMaster` ID from the approved employment/assignment context. Do not infer it from residential address. | Missing or conflicting state returns `ambiguous`/`not_configured`; no global fallback. Owner must approve jurisdiction precedence. |
| Establishment jurisdiction | Identify the legally relevant employer establishment, company/site, and assignment for the calculation date. | Validate employer ownership and effective assignment. Multi-state or conflicting context must fail visibly until precedence is approved. |
| Employee eligibility | Evaluate configured policy criteria against employee category, wage basis/threshold, exemption, joining/exit/transfer dates, and other facts named by the verified notification. | Return `applied`, `not_applicable`, `not_configured`, or `ambiguous` with reason codes and the facts used. Do not treat missing facts as ineligible. |
| Employee contribution | Store the exact compliance-approved amount or calculation basis and currency for the employee side. | Classified only as an employee deduction; never hardcoded in source or accepted from a client salary payload. |
| Employer contribution | Store the independently approved employer amount or calculation basis and currency. | Classified only as employer contribution/cost/liability; never reduce employee net salary. |
| Contribution frequency | Store the approved cycle, such as monthly or another configured cycle, separately from salary-payment frequency. | Frequency is configuration backed by an authoritative source, not an application assumption. |
| Deduction schedule | Store explicit contribution-period and deduction-trigger rules, including the configured month/period and any approved event treatment. | No contribution in a non-trigger period. A unique employee-policy-contribution-period key prevents silent duplicates. |
| Effective dates | Every policy version has `effective_from` and optional `effective_to`; a half-open range is the recommended software convention. | Prevent overlapping active versions for the same legal scope. Boundary convention requires owner approval before implementation. |
| Historical versions | Activated/used policy versions are immutable and retain legal-source reference, approval, scope, schedule, eligibility, amounts, and timestamps. | Historical calculations resolve the version effective for their pay/assignment date. New rates never rewrite saved job snapshots or finalized results. |
| Employer overrides | Super Admin/compliance owns statutory amounts. Recommended employer authority is limited to an approved establishment/applicability exception with reason, evidence, expiry, and audit. | No arbitrary employer rate edit. Closed/inactive exception fallback semantics must be approved and explicit. |
| Rounding | Recommended default is the current backend two-decimal half-up rule applied to each persisted line before totals. | A verified notification may override component or aggregate rounding. The exact rule and level require compliance approval. |
| Payroll corrections | Draft results may be recalculated idempotently. Finalized results are immutable and corrected through linked adjustment/reversal records with reason and actor. | Never edit/delete a finalized statutory line in place; preserve original and correction chain. |
| Remittance obligations | Aggregate only finalized employee and employer LWF lines by policy version, state, establishment, and contribution period. Store verified due rule, liability, remittance evidence, allocation, status, and corrections separately from Associate payment/wallet records. | No remittance amount or due date is invented. Payment integration, maker-checker roles, partial allocation, reversal, and evidence retention require later approval. |

### Proposed policy-resolution input/output

Required inputs:

- employer and establishment/company/site identity;
- employee/assignment identity and effective dates;
- canonical jurisdiction state;
- calculation/pay-period date and contribution period;
- eligible wage basis and policy-defined employee facts;
- policy/override status and version.

Required output:

- one of `applied`, `not_applicable`, `not_configured`, or `ambiguous`;
- policy/version and legal-source reference when applied;
- jurisdiction and establishment used;
- employee and employer contribution classifications/amounts;
- contribution period, trigger, and due-rule reference;
- eligibility and precedence reason codes;
- rounding rule and audit metadata.

The resolver must never silently substitute a residential state, global setting, zero amount, future policy, or employer-entered statutory rate.

## 4. Verification results

All checks were local and avoided business data, migrations, external payment, SMS, remittance, deployment, and production access.

| Verification | Result | Coverage/evidence |
|---|---|---|
| Focused salary/LWF/settlement suite | **PASS - 19/19** | Gross, deductions, net, employer cost, annual CTC, rounding, validation, saved snapshots, job gross persistence, master fallback, employer override, managed LWF replacement, authorization, monthly containment, explicit daily rate, daily/hourly regression, and no payment write after containment failure. |
| Restricted first test launch | **Environment failure before tests** | `uv_os_get_passwd returned ENOMEM`; the same mock-only suite passed outside the restricted launcher. This is not a feature failure. |
| Attendance wallet reserve suite | **PASS - 5/5** | Insufficient balance, exact reserve boundary, exact shortfall, attendance debit amount, and non-attendance behavior. |
| Backend production build | **PASS** | Prisma client generation, TypeScript compilation, and document-asset copy completed. No migration ran. |
| Frontend production build | **PASS with existing size warning** | Vite transformed 3,238 modules. Large-chunk warnings are non-blocking and unrelated to Phase A0. |

Verification boundary:

- Current tests are focused/mock or source-level and do not prove deployed behavior.
- No live browser workflow, database integration, historical transaction query, migration rehearsal, or production restart was performed.
- Existing saved salary records were verified through service snapshot tests, not by reading business rows.

## 5. Decisions requiring owner/compliance approval

1. Confirm that a positive Associate-wide `GuardProfile.dailyRate` is acceptable as the interim explicit rate for monthly-job attendance settlement, or require monthly jobs to be fully blocked until a job/assignment-specific rate or payroll exists.
2. Select the permanent monthly payment model: approved payroll/payable-day proration or an explicit job/assignment per-attendance rate. Supply the complete calculation and effective-date rules; no divisor is assumed.
3. Authorize a read-only historical audit for monthly attendance settlements and define who may approve any financial correction. No automatic reversal is proposed.
4. Approve jurisdiction precedence: statutory establishment, site, assignment, and transfer treatment; confirm that residential state is not a fallback.
5. Approve employee eligibility inputs, establishment scope, schedule semantics, inactive/closed override behavior, and employer exception authority.
6. Supply and approve the authoritative pilot-state legislation/notification, amendments, effective dates, contribution split, eligibility, schedule, rounding, correction, and remittance rules.
7. Approve immutable versioning, maker-checker roles, typed policy outcomes, and the proposed two-decimal half-up default subject to the verified notification.
8. Decide whether statutory liability/remittance is deferred until finalized payroll exists, as recommended.

## 6. Remaining risks

- Existing completed attendance settlements may contain overpayments; occurrence and value are not known without a data audit.
- The interim daily rate is Associate-wide and has no job/assignment/effective-date provenance.
- Current LWF master/override rows remain global, mutable, monthly, and state-less. They are preserved for compatibility but are not the target compliance contract.
- No current payroll, payable-day, payslip, statutory liability, or remittance engine exists.
- The current LWF migration/deployment state was not changed or verified against a target database in this phase.
- Local source/build success does not confirm the running server artifact. Deployment and restart require separate authorization.

## 7. Phase A1 readiness

**No-go for Phase A1 implementation until owner/compliance approval.**

Phase A0 engineering containment and regression coverage are ready for review. Phase A1 may begin only after the jurisdiction, establishment, eligibility, schedule, versioning, override, role, rounding, and legal-source decisions above are approved, target database/migration state is inspected, and implementation is separately authorized.

No Phase A1, B, C, D, or E work was implemented.
