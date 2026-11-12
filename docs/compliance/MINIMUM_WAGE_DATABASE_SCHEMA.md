# Minimum Wage Database Schema

Migration: `nodebackend/prisma/migrations/20261110130000_minimum_wage_compliance_engine/migration.sql`

The migration is additive and creates:

- `minimum_wage_jurisdictions`: State, UT, and Central-sphere jurisdiction registry.
- `minimum_wage_notifications`: official source, dates, verification/approval workflow, amendment link, and review date.
- `minimum_wage_rates`: effective-dated classification and exact Basic/VDA/other/total amounts using `DECIMAL(14,2)`.
- `job_role_skill_mappings`: approved Granvia role to legal employment/occupation/skill mapping.
- `minimum_wage_coverage`: all 28 states and 8 UTs, initially `NOT_STARTED`.
- `job_minimum_wage_snapshots`: immutable job resolution and compliance decisions.
- `minimum_wage_compliance_audits`: actor/action/reason/before/after/source audit records.

No wage amount is seeded. Central-sphere and all geographic jurisdictions are represented, but that does not mean verified legal coverage exists.

The migration does not alter historical salary structures, payroll results, attendance, wallets, or payments. It must be reviewed and deployed through the normal Prisma migration process; it was not applied to a production database during implementation.

