# Granvia LWF Audit Summary

**Audit date:** 4 November 2026

**Conclusion:** Granvia's current LWF feature is a tested, server-authoritative monthly **job salary estimate**, not a state-wise payroll and remittance module.

## 1. What is already working?

- Super Admin can set one standard fixed employee LWF amount and employer LWF amount.
- An employer can create one employer-only override or delete it to return to the standard.
- An active Employer is scoped to its own override; delegated admin employees cannot manage the Super Admin master.
- Employer and Admin job salary forms display managed LWF rows as read-only and identify the source.
- Backend salary saving discards client-supplied LWF values and injects the configured values authoritatively.
- Employee LWF is categorized as an employee deduction and reduces estimated net salary.
- Employer LWF is categorized as an employer contribution and increases estimated employer cost without reducing net salary.
- Salary totals use decimal-safe backend calculation, reject deductions greater than gross, and store normalized components.
- Job salary saves record calculated totals, LWF source/setting ID, component values, and a JSON audit snapshot.
- Generic State/City Master, job site/company location, salary component categories, transaction patterns, and report infrastructure are available for reuse.
- The focused mock-only salary/LWF test suite passed 15/15 on 4 November 2026.

## 2. What is partially implemented?

- LWF Master: fixed global monthly values only.
- Employer override: employer-wide values only; no state/establishment/date scope.
- Salary bifurcation: complete monthly estimate categories and totals, but not employee payroll.
- Historical evidence: saved job component amounts and audit snapshots exist, but policy versions/effective dates do not.
- PF/ESI/PT and other statutory components: generic job-estimate rules exist, but not payroll execution.
- Attendance and payments: operational hours, approval, wallet settlement, and payment reporting exist, but they are disconnected from salary structure/net pay.
- State Master: fully usable as a location master but not linked to LWF.

## 3. What is completely missing?

- State-wise LWF configurations and canonical LWF-to-state relationships.
- Effective-from/effective-to dates and immutable policy versions.
- Contribution frequency and deduction/remittance schedules.
- Establishment applicability, employee categories, thresholds, caps, exemptions, and legal notification references.
- Employee/assignment-level LWF eligibility and historical jurisdiction snapshots.
- Payroll periods, payable-day calculation, payroll preview, approval, finalization, rerun, correction, and reversal.
- Payslip generation.
- State-period LWF liabilities, remittance records, challans/references, due dates, allocations, adjustments, and reconciliation.
- LWF reports by state, establishment, contribution period, liability, remittance, and outstanding balance.
- Maker-checker permissions for statutory policy, payroll, and remittance.

## 4. What is incorrectly integrated?

The highest-risk cross-module issue is payment calculation:

- A structured monthly job copies its gross monthly salary into `JobPost.salaryAmount`.
- Attendance approval does not read salary components, deductions, estimated net salary, or LWF.
- For non-hourly settlement, it uses the Associate's daily rate or falls back to `JobPost.salaryAmount`.
- Therefore a gross monthly amount can become the fallback amount for one approved attendance record when no Associate daily rate is available.

This is a confirmed P0 risk. It also proves that LWF in job salary bifurcation is not carried into actual Associate payment.

Other integration gaps:

- LWF resolution uses employer ID only and ignores site/company/work state.
- Implicit monthly LWF is annualized 12 times and cannot represent half-yearly/yearly rules.
- Offers/agreements and settlements consume gross `salaryAmount`, not the structured net/component breakdown.
- Inactive employer override behavior is ambiguous: it shadows the master and disables LWF instead of falling back.
- Existing payment/wallet status is operational settlement status, not statutory liability/remittance status.

## 5. What must be fixed first?

1. Decide and contain the monthly structured-job attendance-settlement fallback before using it for real salary payment.
2. Obtain approved compliance rules for jurisdiction, state rates, frequency, deduction months, eligibility, effective dates, joining/exit/transfer, and override authority.
3. Create an effective-dated state/establishment policy model and deterministic resolver.
4. Add contribution schedules and duplicate-period safeguards.
5. Make job salary estimates schedule-aware.
6. Build a generic payroll foundation before claiming LWF payroll integration.
7. Add payslips/net-pay payment links and statutory liability creation.
8. Add controlled remittance and reconciliation only after payroll/liability data is authoritative.

## 6. Which existing modules can be reused?

- `StateMaster`/`CityMaster` and `CityStateSelect`.
- Job → company → site location relationships.
- Salary component categories and `calculateSalaryStructure()` primitives.
- Server-side managed-component replacement pattern.
- Decimal rounding and negative-net validation patterns.
- `JobSalaryAuditEvent` snapshot approach.
- Existing Express auth, role, and employer scoping middleware.
- Prisma transactions and unique reference/idempotency patterns.
- Payment/wallet execution only after a clear payroll-payment contract; not as the statutory liability store.
- Reporting query/filter/export conventions.
- Existing React tables, forms, drawers/modals, alerts/notices, and navigation style.

## 7. What requires business or statutory clarification?

- Is jurisdiction determined by registered establishment, job site, work location, or another legal unit?
- Which verified legislation/notification is authoritative for each state and effective period?
- May an employer change statutory rates, or only maintain approved applicability/establishment exceptions?
- What does an inactive employer override mean: no LWF or fallback to the Super Admin standard?
- Which employees/categories/establishments are eligible or exempt, and which wage definition/threshold applies?
- What are the contribution periods, deduction payroll months, remittance deadlines, and FY/calendar basis?
- How are joining, exit, transfer, salary revision, arrears, backdated payroll, and corrections treated?
- What are the payable-day, proration, overtime, rounding, and negative-net policies?
- Should monthly structured jobs stop using daily attendance settlement entirely?
- Who may author, approve, finalize, remit, reverse, and audit each stage?

## 8. Recommended implementation order

### P0 — decisions and containment

- [ ] Approve the LWF legal/payroll decision matrix and named compliance owner.
- [ ] Decide employer override authority and inactive-setting semantics.
- [ ] Contain the monthly gross-per-attendance settlement fallback.
- [ ] Define monthly job versus daily/hourly settlement boundaries.
- [ ] Verify target database schema/migration state before any later deployment.

### P0 — policy foundation

- [ ] Add canonical state/establishment jurisdiction and data-cleanup plan.
- [ ] Design immutable effective-dated LWF policy versions.
- [ ] Design frequency/deduction/remittance schedules.
- [ ] Design eligibility, threshold, category, exemption, and legal-source fields.
- [ ] Implement overlap, inactive, future, missing-policy, and historical-resolution rules.
- [ ] Add policy authorization and immutable audit history.

### P1 — salary and payroll

- [ ] Make salary preview schedule-aware and show jurisdiction/policy reasoning.
- [ ] Preserve existing employee/employer formula separation.
- [ ] Build payroll periods, runs, employee results, and line items.
- [ ] Integrate approved attendance/payable days and salary versions.
- [ ] Apply LWF only in the configured contribution period.
- [ ] Add database idempotency for employee/component/contribution period.
- [ ] Add approval, finalization, correction, reversal, and negative-net safeguards.
- [ ] Generate payslips and link net salary to payment instructions.

### P1/P2 — liability, remittance, reporting

- [ ] Aggregate finalized employee and employer LWF into state-period liabilities.
- [ ] Add due dates, payable/remitted/outstanding statuses, and controlled adjustments.
- [ ] Add remittance references, evidence, allocation, maker-checker, and reversal.
- [ ] Add state/establishment/period liability reports.
- [ ] Add payroll-to-liability-to-remittance reconciliation.
- [ ] Validate performance, security scopes, migration rollout, feature flags, and rollback.

## Implementation readiness

Implementation should **not** begin as a full LWF payroll/remittance build yet. The codebase is ready for a narrowly scoped P0 design and containment phase after review, but state applicability, establishment jurisdiction, employer override authority, contribution schedules, employee eligibility, payroll rules, and remittance ownership require explicit business/compliance decisions first.

No production migration, feature activation, payroll execution, or statutory rate population should occur until those decisions are approved and the target database/deployment state is verified.
