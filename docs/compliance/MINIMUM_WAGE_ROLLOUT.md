# Minimum Wage Rollout

Do not treat the feature as live until every step below is complete.

1. Back up and inspect the target database and Prisma migration ledger.
2. Confirm earlier pending migrations, especially the existing LWF/payroll migration, are reconciled.
3. Review `20261110130000_minimum_wage_compliance_engine/migration.sql`.
4. Apply migrations through the approved deployment process.
5. Rebuild and restart the compiled Node backend because production runs `nodebackend/dist`.
6. Deploy the frontend build.
7. Give `Minimum Wage Compliance` only to authorized Admin Employee roles; Super Admin already has access.
8. Import official notifications as under-review records.
9. Legally verify location, category, skill, qualifying components, dates, and amounts before approval.
10. Start with a limited state/category pilot. Validate draft, compliant, below-minimum, missing-data, conflict, stale, edit, approval, and history cases.
11. Rerun minimum-wage, salary, LWF/payroll, attendance, wallet, and job regression tests in a host without the TSX ENOMEM fault.
12. Expand coverage only after verified data and workflow acceptance. Never label all-India coverage complete merely because all regions appear in the registry.

Rollback should disable/revoke incorrect notification records and stop publication. Do not delete historical snapshots or reverse completed payroll/payments through this module.

