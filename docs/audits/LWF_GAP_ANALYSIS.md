# Granvia LWF Gap Analysis

**Audit date:** 4 November 2026

**Basis:** Current repository source and documentation; no live database or production-state claim

## Assessment scale

- **Confirmed defect:** Current code creates a wrong or unsafe cross-module outcome.
- **Confirmed gap:** Required capability is absent from inspected source/schema.
- **Potential improvement:** Desirable hardening or UX enhancement, but not evidence of a current defect.
- **Decision required:** Technical design depends on payroll/legal/business policy not present in the repository.

## Feature-by-feature gap matrix

| Feature | Current implementation | Gap | Classification | Impact | Priority |
|---|---|---|---|---|---|
| Platform LWF standard | One mutable `STANDARD` row with two fixed amounts | Cannot express jurisdiction, dates, frequency, eligibility, or legal source | Confirmed gap | A universal amount can be statutorily wrong | P0 |
| Employer override | One mutable row per employer | Not state/establishment/effective-date scoped; override authority is undefined | Confirmed gap + decision required | Employer exception can override all locations and periods | P0 |
| State-wise configuration | Generic State Master exists | No LWF-to-state relation or lookup | Confirmed gap | Wrong jurisdiction/rate selection | P0 |
| Effective dating | None | No start/end date or immutable versions | Confirmed gap | Future rates can overwrite policy context; backdated payroll impossible | P0 |
| Contribution frequency | Implicit monthly labels and monthly components | No monthly/quarterly/half-yearly/yearly/custom schedule | Confirmed gap | Over/under-deduction and wrong annual CTC | P0 |
| Salary bifurcation | Server-authoritative job estimate | LWF is always a monthly fixed component when active | Confirmed gap | Non-monthly LWF would be repeated every month in estimates | P0 |
| Employee vs employer treatment | Correct categories and formulas | Not materialized in employee payroll | Confirmed gap | Estimate is correct, payment liability is absent | P0 |
| Work-location resolution | Job links to site/company; state text exists | Resolver uses only employer ID | Confirmed gap | Residential/employer/global assumptions replace establishment law | P0 |
| Employee eligibility | Generic salary thresholds exist | Managed LWF sets thresholds to null; no category/exemption inputs | Confirmed gap | Ineligible staff may be charged; eligible staff may be missed | P0 |
| Payroll period application | No payroll engine | No once-per-period deduction or pay-period snapshot | Confirmed gap | Cannot safely execute LWF deductions | P0 |
| Salary payment integration | Attendance wallet settlement exists | Settlement ignores net salary and all structured components | Confirmed defect | Employee payments can diverge from stated salary | P0 |
| Monthly structured-job fallback | `JobPost.salaryAmount` stores gross monthly | Non-hourly attendance fallback may pay gross monthly per approved day | Confirmed defect | Potential severe overpayment/wallet debit | P0 |
| Payslip | None | No employee/employer LWF display or source explanation | Confirmed gap | No transparent deduction evidence | P1 |
| Liability tracking | None | No calculated/deducted/payable/remitted states | Confirmed gap | Cannot control statutory exposure | P1 |
| Remittance | None | No challan/reference/due date/period/duplicate guard | Confirmed gap | No compliance payment evidence | P2 after payroll/liability |
| Reporting/reconciliation | Generic payment reports exist | No state-period LWF liability or payroll-remittance reconciliation | Confirmed gap | Compliance review cannot be performed | P2 |
| Audit history | Job salary snapshots exist | Setting changes and payroll corrections lack immutable history | Confirmed gap | Weak legal traceability | P0/P1 |
| UI validation | Basic sanitization and generic notices | No state/date/schedule/overlap/eligibility validation; weak field errors | Confirmed gap | Configuration errors remain easy | P1 |
| Authorization | Strong master/employer scoping | Future configuration and remittance duties have no permission model | Decision required | Excess authority or blocked operations | P0 design |

## State-wise LWF Master gaps

| Requirement | Evidence | Status | Required change |
|---|---|---|---|
| Separate configuration per state | No `stateId` on LWF models | Missing | Link immutable LWF rule versions to `StateMaster` |
| Multiple states | Only one `scopeKey=STANDARD` | Missing | Support multiple jurisdiction/version records |
| Existing State Master selector | `StateMaster`, `CityStateSelect` exist | Reusable but disconnected | Reuse active state records; do not create a second state list |
| Duplicate/overlap prevention | Unique standard row only | Missing | Reject intersecting effective ranges for the same owner/state/establishment/category |
| State-specific eligibility | No category/threshold/exemption fields | Missing | Add explicit, reviewable eligibility rules |
| Historical rates | Job component snapshot only; setting updated in place | Partial | Append policy versions; never mutate a version used by finalized payroll |
| Separate employee/employer amounts | Both amounts exist | Supported for fixed amounts | Preserve split in every rule, payroll line, liability, and report |
| Deduction months/periods | None | Missing | Add schedule records, not only a generic frequency string |
| Employment location selection | Site/company state available | Disconnected | Resolve from approved establishment/work assignment, not residential state by default |

### State-data integrity risks

- `EmployerProfile`, `EmployerCompany`, `CompanySite`, and `GuardProfile` store state names as nullable strings rather than `StateMaster` foreign keys.
- Validation ensures many new/updated names match the master, but renaming/inactivating a master state does not provide referential history for existing operational rows.
- A future LWF engine must not join legal policy using unnormalized free text at calculation time.
- Site state alone may be insufficient if statutory applicability belongs to a registered establishment covering several sites. That relationship is not modeled.

## Contribution frequency and schedule gaps

A single `frequency` enum would be insufficient. It could label a rule “half-yearly” but would not state which payroll month triggers deduction, which contribution period it covers, the due date, proration/joining/leaving behavior, or how custom state schedules work.

Missing schedule data includes:

- Cycle type: monthly, quarterly, half-yearly, yearly, or custom.
- Period boundary and calendar basis.
- Deduction payroll month(s) and trigger rule.
- Employee and employer period treatment.
- Remittance due-date rule and holiday handling.
- Joining, leaving, transfer, revision, and arrears treatment.
- Effective-dated schedule amendments.
- Unique period key used to prevent duplicate deductions and remittances.

Current behavior is implicit monthly: UI labels both LWF amounts “monthly,” `JobSalaryComponent.monthlyAmount` stores them, and `annualCtc` multiplies employer contribution by 12. This is correct only when compliance confirms a monthly recurring rule.

## Salary calculation gap analysis

| Field/formula | Current behavior | Gap/risk |
|---|---|---|
| Basic Salary | Default configurable earning | Job estimate only; no employee revision/pay-period snapshot |
| HRA | Default configurable earning | Same |
| Other Allowances | Custom earnings supported | Same |
| Gross Salary | Sum of enabled earnings | Correct monthly estimate |
| Employee PF/ESI/PT | Generic components and optional employer statutory overlay | Not effective-dated/state-aware; no payroll execution |
| Employee LWF | Fixed managed deduction | Correct category; wrong universal/monthly assumption |
| Employer LWF | Fixed managed employer contribution | Correct category; wrong universal/monthly assumption |
| Other Deductions | Custom deductions supported | No payroll-period source/authorization |
| Net Salary | Gross minus employee deductions | Correct estimate; not used for settlement |
| Employer Cost | Gross plus employer contributions | Correct estimate; not posted as liability/cost |
| Annual CTC | Employer cost × 12 | Wrong for non-monthly contribution schedules unless normalized to monthly equivalent with clear semantics |

### LWF-specific answers

1. LWF is displayed in salary bifurcation: **Yes** when an effective setting is returned.
2. LWF is fetched from the master: **Yes**, with employer override first.
3. Applicable state is identified automatically: **No**.
4. LWF eligibility enable/disable exists: **Only coarse active/inactive setting behavior**, not employee eligibility.
5. Employee LWF reduces estimated net salary: **Yes**.
6. Employer LWF increases estimated employer cost: **Yes**.
7. Contribution frequency is respected: **No frequency exists**.
8. LWF is deducted only in the applicable payroll period: **No payroll period exists**.
9. Duplicate deduction prevention: **No payroll deduction record exists**.
10. Historical rate for previous payroll: **No date-based resolution**; only saved job components preserve an estimate.
11. Selected rate audit: **Partial** through component values, `lwfSource`, `lwfSettingId`, and JSON snapshot.
12. Master changes silently altering finalized salaries: Existing jobs are not bulk-updated, but no finalized payroll exists; resaving a job applies the current setting.

### Duplicate logic and rounding

- Frontend and backend both implement salary calculation. The backend is authoritative, which limits tampering, but parity tests should compare every component/boundary case.
- Backend uses Prisma Decimal with half-up two-decimal rounding. Frontend uses integer paise and explicit percentage rounding. The shared rule should be documented for payroll, proration, arrears, and aggregate liability.
- Per-line rounding versus total rounding is not specified for payroll/statutory remittance.

## Associate and job integration gaps

| Question | Finding |
|---|---|
| Where is Associate state stored? | `GuardProfile.state`, representing profile/residential location |
| Can employment state differ? | Yes; `CompanySite.state` and `EmployerCompany.state` can differ, but there is no explicit statutory-employment state |
| Is job/work location stored? | Yes, through `JobPost.siteId`/`companyId` and site/company records |
| Does client location affect LWF? | No |
| Can an Associate work across states? | Concurrent active assignment is restricted, but sequential/backdated work across states is possible and not historically resolved |
| Correct applicability level? | Not modeled; current resolution is employer-wide |
| Is a policy associated with assignment? | No; a weak source/id snapshot is associated with job salary structure only |
| Do work-location changes affect future LWF? | Not automatically and not effective-dated |
| Is history preserved? | Job salary amount snapshot is preserved, but assignment/location/policy decision history is incomplete |

The target decision order should be: approved establishment/work assignment jurisdiction → effective pay/contribution period → employee/category/threshold/exemption eligibility → contribution schedule. Residential state should be used only if compliance explicitly requires it for a rule.

## Payroll scenario gaps

| Scenario | Current capability | Technical gap | Compliance decision |
|---|---|---|---|
| Monthly | Monthly estimate | No pay-period application/finalization | Define monthly trigger and proration |
| Half-yearly | None | Schedule and once-per-period key absent | Define periods/months and join/exit rules |
| Yearly | None | Same | Define annual basis and trigger |
| New joiner | None | No joining-date payroll eligibility | Confirm state rule |
| Exit | None | No final payroll/outstanding liability | Confirm state rule |
| Salary revision | Job can be resaved | No employee salary version/effective date | Define revision/arrears treatment |
| Rerun | Attendance duplicates are checked | No payroll idempotency/finalization key | Define rerun versus correction |
| Backdated payroll | None | No historical policy resolver | Define lock/correction authorization |
| Multi-state | None | No assignment-period jurisdiction | Define establishment/transfer rule |
| Correction | None | No adjustment/reversal line | Define sign-off and reporting |

## Payment and remittance gaps

| Requirement | Current evidence | Gap |
|---|---|---|
| Carry employee LWF to final payroll | No payroll | Missing |
| Payslip employee LWF | No payslip | Missing |
| Employer LWF in cost report | Job estimate only | Not posted/incurred |
| State/period liability | No liability model | Missing |
| Calculated/deducted/payable/remitted states | `Payment.paymentStatus` is Associate-payment status | Statutory lifecycle missing |
| Payment reference/date/period | Operational payments have method/date | No statutory period/challan/due date |
| Duplicate remittance prevention | Wallet references offer patterns | No statutory unique key |
| Adjustments/reversals | No LWF lines | Missing |
| State-wise report | Generic reports only | Missing |
| Payroll-remittance reconciliation | No payroll/liability | Missing |

The existing `Payment` table should not be overloaded with statutory remittance because it represents money payable to an Associate and lacks jurisdiction, contribution-period, employee/employer split, liability source, due date, and challan semantics.

## Compliance gaps requiring confirmation

- States/union territories where LWF applies or does not apply.
- Whether policy attaches to establishment registration, site, employee work location, or another legal unit.
- Fixed versus salary-linked contributions and contribution caps.
- Employee/employer split per jurisdiction.
- Frequency, deduction months, contribution periods, and remittance deadlines.
- Gross/wage threshold definition and inclusion/exclusion components.
- Employee categories, exemptions, headcount/establishment thresholds, and probation/contractor treatment.
- Joining, exiting, transfer, salary revision, arrears, and backdated cases.
- Legal effective dates, notification references, supersession, and corrections.
- Rounding and aggregation rules.
- Whether employer override is legally permitted or should be limited to applicability metadata under Super Admin-controlled statutory rates.

No statutory amount should be hardcoded or seeded from an unverified web table. A compliance owner must approve each effective-dated rule and attach its authoritative notification/reference.

## Validation gaps

### Frontend

- No state selector, effective-date fields, frequency/schedule editor, thresholds, exemptions, or legal reference.
- Amount inputs strip invalid characters but do not provide complete field-level decimal/range feedback.
- No overlapping-period or duplicate-jurisdiction feedback.
- Salary panel does not explain a deduction period because schedules do not exist.
- LWF fetch failures silently remove the source label; the subsequent backend save may still inject a setting, causing preview/server mismatch without a clear warning.

### Backend

- No state/status/effective-date resolver inputs.
- No overlap, gap, chronology, schedule, category, exemption, or establishment validation.
- No rule-version immutability after payroll use.
- No legal reference or approval validation.
- No payroll negative-net rule after proration/period deductions; only the monthly structure estimate has this guard.
- No DB uniqueness for a payroll employee/component/period or statutory state/period remittance because those records do not exist.

## Security and authorization gaps

Current LWF master authorization is appropriately narrow: only an active persisted Super Admin can manage the standard; an employer can modify only its own override; delegated Job Management can preview but not manage the master.

Future gaps:

- Separate permissions for policy authoring, compliance approval, payroll preview, payroll finalization, liability review, and remittance recording.
- Maker-checker approval for statutory rule activation and remittance.
- Assignment/department scope for employer staff and platform employees.
- Field-level restriction preventing employers from changing Super Admin-controlled statutory rates if overrides are not legally permitted.
- Immutable actor, timestamp, reason, and before/after snapshots.
- Sensitive remittance reference/document access and download authorization.

## Data-integrity and operational risks

| Risk | Evidence | Severity | Safeguard |
|---|---|---|---|
| Wrong state/rate | Employer-only resolver | Critical | Canonical jurisdiction + effective-date resolver |
| Duplicate/non-periodic deductions | No payroll period key | Critical | Unique employee/component/contribution-period record |
| Incorrect employee/employer allocation | Current categories are correct but no payroll lines | High | Typed component codes and separate liability columns |
| Future rate used historically | Mutable current setting; no date resolver | Critical | Immutable versions and `calculationDate` resolution |
| Inactive rule behavior | Inactive override shadows master | High/decision | Explicit resolver semantics and tests |
| Negative take-home | Monthly estimate blocks deduction > gross only | High | Pay-period net guard and authorized carry-forward policy |
| Finalized payroll mutation | No payroll finalization model | Critical | Immutable finalized run; correction/reversal workflow |
| Salary settlement mismatch | Attendance settlement ignores structure | Critical | Block/contain monthly structured settlement until payroll contract exists |
| Overpayment fallback | Gross monthly may be used per attendance | Critical | Remove ambiguous fallback after approved design; require explicit rate source |
| Policy deletion/history loss | Overrides can be deleted; master updated in place | High | Soft-close/version; never delete used policy versions |
| Concurrent duplicates | Application checks without all DB unique constraints | High | Transaction plus unique business keys and idempotency tokens |
| Rounding drift | Frontend/backend duplicate calculation | Medium | Shared conformance vectors; backend-only persisted result |
| Unverified deployment | Migration status not checked | High for rollout | Environment-specific preflight and DBA-approved deploy |

## Confirmed defects versus planned improvements

### Confirmed defects requiring containment

- Monthly structured salary gross can become a per-attendance settlement fallback.
- Operational salary settlement ignores structured deductions/net salary, including LWF.
- A global/employer-wide monthly LWF amount cannot represent state-specific statutory applicability if used as compliance output.

### Confirmed missing foundations

- State/effective-date/frequency/eligibility rule engine.
- Payroll runs, employee results, line items, approval/finalization, correction, and payslips.
- LWF liability, remittance, and reconciliation.

### Potential improvements after foundations

- Rich filters/search/pagination for a multi-rule master.
- Schedule visualizations and contextual salary explanations.
- Automated due-date reminders and exception dashboards.
- Compliance document attachments and maker-checker workflow.

These improvements must not be mistaken for evidence that the current narrow LWF salary-estimate feature is broken in isolation; its tested employee/employer formula treatment is correct for a configured monthly fixed amount.
