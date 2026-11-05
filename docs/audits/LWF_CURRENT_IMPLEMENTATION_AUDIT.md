# Granvia LWF Current Implementation Audit

**Audit date:** 4 November 2026

**Scope:** React frontend, Express/Node.js backend, Prisma/SQL Server schema, migrations, tests, and relevant project documentation

**Mode:** Read-only technical and functional audit; no feature implementation, schema change, migration, seeding, or business-data mutation

## Executive summary

Granvia has a working but deliberately narrow LWF implementation at the **job salary-structure estimate** level. A Super Admin can configure one platform-wide monthly employee amount and employer amount. An employer can replace that standard with one employer-wide override. When a structured monthly job is saved, the backend removes any client-supplied LWF rows, injects the resolved fixed LWF amounts, calculates employee LWF as a deduction, calculates employer LWF as an employer contribution, and stores the resulting job salary components and an audit snapshot.

That implementation is **not a state-wise statutory LWF master** and is **not connected to payroll or statutory remittance**. There are no LWF state, frequency, schedule, effective-date, eligibility, exemption, establishment, liability, or remittance records. The generic State Master exists, but LWF does not reference it. Site and company state values are available as strings, but LWF resolution uses only `employerUserId`.

Granvia also does not currently contain a payroll engine or payslip model. Attendance approval creates an operational wallet settlement from the Associate's daily/hourly rate or `JobPost.salaryAmount`; it does not consume `JobSalaryStructure.netMonthly`, payable days, or any salary component, including LWF. Project documentation independently describes payroll and payslips as pending/proposed.

The focused mock-only salary/LWF test suite passed **15/15** on 4 November 2026. This proves the tested calculation, injection, scoping, and authorization behavior in source. It does not prove that the LWF migration is deployed, that live database rows exist, or that browser/production flows work. Those items are marked **Not runtime-verified**.

## Audit method and evidence boundaries

The audit reviewed:

- Repository documentation, especially `README.md`, `PROJECT_KT.md`, `COMPLETE_END_TO_END_USER_PROCESS.md`, `ROLE_WISE_COMPLETE_USER_FLOW.md`, `GRANVIA_VALIDATION_AUDIT.md`, `docs/ROLE_WISE_REPORT_CATALOGUE.md`, `docs/REPORTING_IMPLEMENTATION_PHASE_SUMMARY.md`, and `docs/GRANVIA_MANAGED_COMPANY_DEPARTMENTS.md`.
- LWF, salary, job, location, Associate assignment, attendance, payment, wallet, reporting, and authorization source.
- `nodebackend/prisma/schema.prisma` and the dynamic salary/LWF migrations.
- `nodebackend/tests/salaryStructure.test.ts` through `npm.cmd run test:salary-structure`.

No database connection, migration-status command, migration, seed, API write, or browser write flow was used. The first restricted test launch failed before test execution with `uv_os_get_passwd returned ENOMEM`; the identical mock-only suite then ran outside that restricted launcher and passed 15/15.

The repository already had unrelated working-tree changes before this audit, including `nodebackend/prisma/migrations/20261102130000_lwf_master_and_employer_overrides/migration.sql` and `.claude/settings.local.json`. They were not changed by this audit.

## Module discovery matrix

| Module | Frontend | Backend | Database | API | Status |
|---|---|---|---|---|---|
| LWF Master | `frontend/src/web-admin/pages/LwfMaster.tsx`; `frontend/src/services/lwfService.ts` | `nodebackend/src/controllers/lwfController.ts`; `nodebackend/src/services/lwfService.ts` | `LwfMasterSetting` | `GET/POST /admin/lwf-master` | **Partially implemented** — one global monthly standard only |
| Employer LWF override | `frontend/src/employer/LwfSettingsPage.tsx` | `lwfController.saveEmployerSetting/resetEmployerSetting`; `resolveEffectiveLwfSetting` | `EmployerLwfSetting` | `GET/POST/DELETE /employer/lwf-setting` | **Partially implemented** — one employer-wide override only |
| State Master | `frontend/src/web-admin/pages/LocationMaster.tsx`; `CityStateSelect.tsx` | `locationMasterController.ts` | `StateMaster`, `CityMaster` | `/location-master/*`; `/admin/location/*` | **Fully implemented** as a generic location master, but **implemented but disconnected** from LWF |
| Salary Component Master | `SalaryStructurePanel.tsx`; salary template UI | `salaryStructureController.ts`; `calculateSalaryStructure` | `SalaryStructureTemplate`, `SalaryTemplateComponent`, `SalaryStatutoryRule` | `/employer/salary-templates`; `/employer/salary-statutory-rules`; admin equivalents | **Partially implemented** — generic components/rules; statutory-rule management has backend APIs but no dedicated UI found |
| Salary Bifurcation | `SalaryStructurePanel.tsx` in Employer Add/Edit Job and Admin Job Management | `saveJobSalaryStructure`; `calculateSalaryStructure` | `JobSalaryStructure`, `JobSalaryComponent`, `JobSalaryAuditEvent` | Embedded in job create/update payloads | **Partially implemented** — monthly job estimate, not employee payroll |
| Job Creation / Add Job | `EmployerApp.tsx`; `JobApprovals.tsx` | `jobController.store/update/adminStore/adminUpdate` | `JobPost` plus salary records | `/employer/jobs`; `/admin/jobs` | **Partially implemented** — salary structure is saved authoritatively; statutory location is not resolved |
| Associate Registration | Registration/profile screens use `CityStateSelect` | `authController.ts`; `profileController.ts`; `assertActiveCityState` | `GuardProfile.state/city` strings | Auth/profile APIs | **Partially implemented** — residential state exists; it is not an LWF applicability source |
| Associate Job Assignment | Hiring/application screens | `applicationController.ts`; `jobOfferController.ts`; `employmentAgreementService.ts` | `JobApplication`, `JobOffer`, `Agreement` | Employer/Admin application and offer APIs | **Partially implemented** — job/site references exist, but no assignment-level LWF policy snapshot |
| Attendance / payable time | Attendance screens and reports | `attendanceController.ts` | `AttendanceRecord`, attendance audit/exception models | Guard/Employer/Admin attendance APIs | **Partially implemented** — hours and approval exist; no payroll periods or payable-day engine |
| Payroll processing | No payroll screen found | No payroll service/controller found | No payroll run/result/line-item model | No payroll API found | **Not implemented** |
| Payslip generation | Catalogue marks payslip proposed | No payslip generator found | No payslip model | No payslip API | **Not implemented** |
| Salary payment | Employer payment/attendance UI | `paymentController.ts`; attendance settlement in `attendanceController.ts` | `Payment`, employer/Associate wallets and transactions | `/employer/payments`; attendance approval APIs | **Implemented but disconnected** from salary bifurcation and LWF |
| Payment approval / transactions | Attendance approval, OTP cash confirmation, financial reports | Payment, wallet, withdrawal and reporting controllers | `Payment`, `WalletTransaction`, `AssociateWalletTransaction` | Payment/wallet/report APIs | **Partially implemented** for operational settlements, not payroll/statutory liability |
| PF, ESI, Professional Tax | Default components in `frontend/src/services/salaryStructureService.ts` | Generic statutory calculation/rule overlay | `SalaryStatutoryRule`; salary components | Statutory-rule APIs | **Partially implemented** at job-estimate level only |
| LWF liability/remittance | No UI found | No service/controller/report found | No liability/remittance models | No API found | **Not implemented** |

## Existing LWF functionality

### Configuration hierarchy

`resolveEffectiveLwfSetting()` in `nodebackend/src/services/lwfService.ts` applies this hierarchy:

1. Return the employer's single `EmployerLwfSetting` when one exists.
2. Otherwise return the single `LwfMasterSetting` whose `scopeKey` is `STANDARD`.
3. Otherwise return `null`.

The resolver does not accept state, site, company, Associate, category, establishment, salary, pay period, or calculation date. It also does not filter out inactive rows; an inactive override continues to win and causes zero/disabled LWF rows to be injected instead of falling back to the master. Whether “inactive override means no LWF” or “inactive override means fall back” is a business decision.

### Authoritative salary injection

`applyEffectiveLwfSetting()` removes all client rows with codes `EMPLOYEE_LWF` and `EMPLOYER_LWF`, then inserts authoritative fixed rows when a setting exists:

- `EMPLOYEE_LWF`: category `deduction`, mandatory, fixed monthly amount.
- `EMPLOYER_LWF`: category `employer_contribution`, mandatory, fixed monthly amount.

`saveJobSalaryStructure()` performs resolution and injection inside the job transaction before `calculateSalaryStructure()` runs. This means frontend tampering cannot change the managed LWF amounts on save. If no master or override exists, client-supplied LWF rows are removed and no LWF is applied.

### Formula behavior

`calculateSalaryStructure()` correctly maintains the current monthly estimate relationships:

- `grossMonthly = sum(enabled earnings)`
- `deductionsMonthly = sum(enabled deductions)`
- `netMonthly = grossMonthly - deductionsMonthly`
- `employerContributionsMonthly = sum(enabled employer contributions)`
- `employerCostMonthly = grossMonthly + employerContributionsMonthly`
- `annualCtc = employerCostMonthly × 12`

Therefore employee LWF reduces estimated net salary and employer LWF increases employer cost without reducing employee net salary. Deductions greater than gross are rejected. Backend decimal arithmetic rounds half-up to two decimals and is authoritative. The frontend duplicates the preview calculation with integer paise arithmetic; this is useful UX but creates a regression risk if the two implementations diverge.

### Persistence and audit

`JobSalaryStructure` stores the calculated monthly totals, `lwfSource`, and `lwfSettingId`. `JobSalaryComponent` stores the applied LWF amounts as component snapshots. `JobSalaryAuditEvent` stores the entire normalized calculation result as JSON whenever the structure is saved.

This preserves the amount used in a saved job structure, but it is not a complete effective-dated statutory history:

- Master and employer setting rows are updated in place by `upsert`.
- `lwfSettingId` has no declared relation/foreign key to either setting table.
- No setting version, state, frequency, schedule, effective period, legal reference, eligibility decision, or resolver input is stored.
- Editing/resaving a job structure applies the then-current setting.
- Finalized payroll immutability cannot be assessed because payroll does not exist.

## LWF Master field inventory

| Required capability | Current evidence | Finding |
|---|---|---|
| Unique configuration ID | `LwfMasterSetting.id`, `EmployerLwfSetting.id` | Exists |
| State name and code | No state field/relation in either LWF model | Missing |
| Employee contribution | `employeeAmount` | Exists as one fixed amount |
| Employer contribution | `employerAmount` | Exists as one fixed amount |
| Contribution frequency | UI labels amounts “monthly”; no frequency field | Missing; monthly behavior is implicit |
| Effective-from / effective-to | No fields | Missing |
| Active/inactive | `status`; DB check constraint | Exists, but inactive resolution semantics need clarification |
| Employee categories | No field or relation | Missing |
| Salary/eligibility thresholds | Generic salary components can store min/max gross, but managed LWF injection sets both to `null` | Missing for managed LWF |
| Exemptions | No field | Missing |
| Remarks | `notes` | Exists |
| Created by / updated by | Master has both IDs; employer override has neither | Partial |
| Created/updated timestamps | Both models | Exists |
| Legal notification/reference | No field | Missing |
| Establishment applicability | No field | Missing |
| Deduction/remittance schedule | No field/model | Missing |
| Historical versions | Settings update in place | Missing |

## Current API inventory

| Method and endpoint | Authorization | Purpose | Validation and behavior | Status |
|---|---|---|---|---|
| `GET /admin/lwf-master` | Active persisted Super Admin only | Read the `STANDARD` row | Controller re-checks stored role/status | Working in source; not live-verified |
| `POST /admin/lwf-master` | Active persisted Super Admin only | Create/update global standard | Strict body; non-negative amounts; status enum; notes max 500 | Working in source and mock-tested |
| `GET /admin/lwf-effective/:employer` | Super Admin or Job Management admin employee through admin middleware | Preview effective employer setting | Confirms target user is an employer; resolves by employer only | Working in source; no state/date inputs |
| `GET /employer/lwf-setting` | Active Employer | Read master, own override, and effective row | Employer scope comes from auth identity | Working in source |
| `POST /employer/lwf-setting` | Active Employer | Create/update own override | Master must exist; same strict amount/status validation | Working in source and mock-tested |
| `DELETE /employer/lwf-setting` | Active Employer | Delete own override and revert to master | `deleteMany` scoped to authenticated employer | Working in source |

Missing operations include state-wise listing, state/frequency filters, effective-date overlap validation, immutable version creation, schedule management, compliance-source management, applicable-rate lookup with job/employee/pay-period context, payroll preview, LWF liability reporting, and remittance tracking.

## Database inventory and relationships

| Structure | Current purpose | LWF relevance / limitation |
|---|---|---|
| `StateMaster`, `CityMaster` | Canonical active state/city master | Reusable, but no LWF FK and operational entities store names as strings |
| `EmployerProfile`, `EmployerCompany`, `CompanySite`, `GuardProfile` | Employer, establishment/work location, and residential location | Each may contain state text; none is selected as statutory LWF jurisdiction |
| `JobPost` | Job, company, site, legacy/gross `salaryAmount`, payment type | Work location is reachable; LWF resolver ignores it |
| `JobSalaryStructure` | One monthly estimate per job | Stores totals and weak LWF source/id snapshot; not per employee/pay period |
| `JobSalaryComponent` | Normalized monthly earnings/deductions/contributions | Stores applied LWF amounts and category correctly |
| `SalaryStatutoryRule` | Employer-scoped percentage/threshold/cap overlay | Reusable calculation concepts, but not effective-dated/state-aware and not used to manage LWF amount injection |
| `JobSalaryAuditEvent` | JSON snapshot per salary save | Useful audit evidence; action-only history, no policy-version FK |
| `JobApplication`, `JobOffer`, `Agreement` | Hiring/assignment lifecycle | Carry job/site references but no salary/LWF assignment snapshot; offers/agreements use gross `salaryAmount` |
| `AttendanceRecord` | Daily time and approval | No payroll period/payable-day/LWF link |
| `Payment` | Associate operational payment/settlement | Single amount only; no gross/deduction/employer-contribution lines |
| Wallet transaction models | Employer debit and Associate reserve/credit evidence | Reusable idempotency/reference patterns; not statutory liability/remittance ledgers |
| Payroll/payslip/liability/remittance tables | — | Not present |

The LWF migration `nodebackend/prisma/migrations/20261102130000_lwf_master_and_employer_overrides/migration.sql` creates the two setting tables and adds `lwf_source`/`lwf_setting_id`. Migration deployment was deliberately not queried in this audit and remains **Not runtime-verified**.

## End-to-end salary flow

1. Employer Add/Edit Job (`frontend/src/employer/EmployerApp.tsx`) or Admin Job Management (`frontend/src/web-admin/pages/JobApprovals.tsx`) renders `SalaryStructurePanel`.
2. The panel fetches employer templates and effective LWF. It injects read-only LWF rows for preview and displays their source.
3. The UI calculates estimated gross, deductions, net, employer cost, and annual CTC.
4. The job payload carries `salary_structure` to `jobController`.
5. The backend transaction resolves statutory rules and effective LWF, replaces LWF rows, performs authoritative calculation, upserts `JobSalaryStructure`, replaces components, writes `JobSalaryAuditEvent`, and copies calculated gross into `JobPost.salaryAmount`.
6. Job/detail screens display the stored monthly totals and components.

The flow stops there. No consumer converts the job structure into employee-specific payroll results. `employmentAgreementService.ts`, application/offer services, and settlement code consume the gross `JobPost.salaryAmount`, not the structured net or LWF lines.

## State and Associate/job applicability findings

- Associate residential state: `GuardProfile.state`.
- Employer profile state: `EmployerProfile.state`.
- Company/registered establishment state: `EmployerCompany.state`.
- Work/site state: `CompanySite.state`.
- Job work location: `JobPost.siteId` and `companyId`.
- Application/offer/attendance location linkage: job/company/site IDs are carried into these records.

Granvia validates many entered city/state names against active `StateMaster`/`CityMaster` records through `assertActiveCityState()`, but stores the names rather than state IDs. The LWF resolver does not read any of them.

The existing architecture most naturally supports future resolution from the job's actual site/establishment, then the pay period and Associate eligibility. Residential state should not be the default statutory key. A job can cover multiple Associates, while eligibility can be employee-specific; therefore a job-level salary estimate alone cannot be the final LWF decision. Active-assignment guards currently prevent an Associate from holding another active job, but sequential location changes and backdated corrections still require effective-dated assignment/location history.

## Payroll integration findings

No `PayrollRun`, employee payroll result, payroll line item, pay period, payable-day calculation, approval/finalization, recalculation, reversal, or payslip model/controller/UI was found. Repository documentation explicitly says payroll is pending/proposed and that attendance reports are not payroll.

`attendanceController.payableAmount()` demonstrates the current disconnect:

- Hourly payments use `GuardProfile.hourlyRate` or `JobPost.salaryAmount`, multiplied by attendance hours.
- All other payment types, including `Monthly`, use `GuardProfile.dailyRate` or `JobPost.salaryAmount` once per approved attendance record.
- For a structured job, `JobPost.salaryAmount` is the calculated **gross monthly** value.
- No salary deduction, net salary, employer contribution, payable days, or LWF component is read.

Consequently, a structured monthly job without an Associate daily rate can expose the gross monthly amount as the fallback amount for each approved attendance settlement. This is a confirmed cross-module defect/risk, not an LWF-only issue. The UI and reporting correctly caution that attendance settlement is not payroll, but the monetary fallback still needs P0 containment before structured monthly jobs are used for attendance settlement.

### Mandatory scenario assessment

| Scenario | Classification | Evidence |
|---|---|---|
| A — Monthly contribution | **Partially supported** | Monthly job estimate includes LWF once in estimated monthly totals; no monthly payroll execution exists |
| B — Half-yearly contribution | **Unsupported** | No frequency/schedule/pay-period engine |
| C — Yearly contribution | **Unsupported** | No frequency/schedule/pay-period engine |
| D — New employee | **Requires compliance clarification** and technically unsupported | No join-period LWF rule or employee payroll result |
| E — Employee exit | **Requires compliance clarification** and technically unsupported | No exit-period payroll/statutory workflow |
| F — Salary revision | **Partially supported** only for resaving a job estimate | No effective-dated employment salary revision or payroll recalculation policy |
| G — Payroll rerun | **Unsupported** | No payroll run; attendance settlement has a duplicate-payment check but is not payroll |
| H — Backdated payroll | **Unsupported** | No historical resolver by date/config version |
| I — Multi-state employment | **Unsupported** | Resolver ignores site/state and assignment periods |
| J — Payroll correction | **Unsupported** | No payroll reversal/adjustment lines or finalized-run workflow |

## Payment and statutory remittance findings

Granvia distinguishes operational payment records and wallet movements, but it does not distinguish payroll earnings from statutory liabilities:

- `Payment` has one `amount`, status, method, and references to job/application/attendance.
- Attendance approval creates a processing payment, debits the employer wallet, and reserves an equal amount in the Associate wallet.
- OTP-confirmed cash payment debits the employer wallet and credits the Associate wallet.
- Financial reports reconcile stored payment/wallet evidence.

No code carries employee LWF to a finalized payroll or payslip. No employer-cost report reads LWF components as incurred liabilities. No state-period liability, calculated/deducted/payable/remitted state, challan/reference, remittance date, due date, adjustment, reversal, duplicate-remittance guard, or payroll-to-remittance reconciliation exists.

Existing wallet/payment services should not be treated as statutory remittance merely because they move money. Their transaction/reference/idempotency patterns and reporting infrastructure are reusable, but statutory liability needs its own legal period, jurisdiction, component split, and immutable source links.

## CRUD, validation, security, and UX audit

### What exists

- Super Admin view/create/update of the one standard row.
- Employer view/create/update/delete of its own override.
- Backend non-negative decimal validation, status enum, strict payload, and notes length.
- Database non-negative and status checks.
- Frontend success/error notices and confirmation before deleting an override.
- Persisted Super Admin re-check for master management.
- Employer route role protection and authenticated employer scoping.
- Delegated Job Management employees may preview effective LWF but cannot change the master.

### What is missing or incomplete

- List/search/filter/pagination are not meaningful for a one-row master and do not exist.
- No state or frequency filter.
- No date-overlap or duplicate-jurisdiction validation.
- No effective-date, schedule, eligibility, exemption, establishment, or legal-source validation.
- Frontend money fields sanitize characters but rely on backend for decimal precision/range errors and do not render field-specific API errors.
- No LWF setting change-history table or before/after audit event.
- Employer override does not store created/updated actor IDs.
- No concurrency/version check; last update wins.
- No dedicated read authorization based on employer assignment for arbitrary `admin/lwf-effective/:employer` beyond Job Management module access.
- No current-state proof that the migration is deployed.

## Confirmed issues

1. **Global rate is incorrectly universal for statutory use.** LWF resolution does not use state, site, establishment, category, eligibility, or pay date.
2. **Contribution timing is hardwired as monthly estimation.** There is no frequency or schedule, and annual CTC always multiplies monthly employer LWF by 12.
3. **LWF is not a payroll deduction.** It exists only in the job salary estimate and is never materialized in an employee pay-period result.
4. **Salary payment is disconnected from salary bifurcation.** Attendance settlement does not use net monthly salary or salary components.
5. **Monthly structured-job settlement has a dangerous gross fallback.** When no Associate daily rate exists, the gross monthly `JobPost.salaryAmount` can become the amount of one approved attendance settlement.
6. **No statutory liability/remittance lifecycle exists.** Calculated employee/employer LWF cannot be reconciled or marked remitted.
7. **Policy history is incomplete.** Stored component amounts/audit snapshots preserve job estimates, but mutable setting rows and absent effective dates prevent authoritative historical resolution.
8. **Location is disconnected.** State Master and job site state exist but are not inputs to LWF.
9. **Inactive-row semantics are ambiguous.** An inactive employer override shadows the standard and produces disabled LWF rather than falling back.
10. **No payroll/payslip foundation exists.** LWF payroll integration cannot safely begin as a small isolated patch.

## Existing code that can be reused

- `StateMaster`/`CityMaster` and `CityStateSelect` for canonical jurisdiction selection.
- Job → company/site links for work-location context.
- `calculateSalaryStructure()` categories, threshold/cap logic, Decimal rounding, and negative-net guard for estimates and payroll-line calculation primitives.
- `applyEffectiveLwfSetting()` server-authority pattern, after redesigning resolution inputs and schedules.
- `JobSalaryComponent`/`JobSalaryAuditEvent` snapshot pattern.
- Express auth/role middleware and exact employer scoping.
- Prisma transaction patterns and reference-based wallet idempotency patterns.
- Existing reporting filters/export conventions for future liability reports.
- Existing form, table, notice, and error conventions in the React portals.

## Unverified assumptions and decisions required

- **Not runtime-verified:** LWF/salary migrations are deployed on the target database and Prisma Client/server artifact are current.
- **Not runtime-verified:** real Super Admin, employer, admin-employee, and browser behavior.
- The legal source and approval owner for state-wise rates, thresholds, exemptions, deduction periods, remittance dates, joining/leaving rules, and amendments are not defined in repository documentation.
- The authoritative jurisdiction may be establishment registration rather than merely site state; product/compliance must define this.
- Employer override authority needs clarification: may an employer deviate from a statutory Super Admin rule, or only configure an establishment-specific rule within controlled bounds?
- “Inactive override” must be defined as either “no LWF for this employer” or “fall back to the active standard.”
- The desired monthly-payable-days formula, loss-of-pay rules, overtime, proration, rounding, revision, and finalization policies are not specified.
- Whether the existing attendance-wallet settlement remains a separate daily operational flow or must be disabled/replaced for monthly structured jobs requires a product decision.
- The repository contains no authoritative statutory rate source. No rates should be seeded or inferred until compliance supplies verified, versioned notifications.

## Verification result

`npm.cmd run test:salary-structure` passed 15/15 focused tests. Covered behavior includes formula separation, rounding, generic statutory thresholds/caps, invalid structures, transaction snapshotting, employer-scoped templates, job gross persistence, LWF hierarchy/injection, removal of client-supplied LWF, delegated-admin restrictions, employer scoping, and role gates.

The test suite does not cover state/frequency behavior, payroll, payslips, liabilities, remittances, browser behavior, migration deployment, concurrent remittance/idempotency, or the attendance-settlement/salary-structure disconnect.
