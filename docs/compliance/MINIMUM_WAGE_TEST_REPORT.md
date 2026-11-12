# Minimum Wage Test Report

Date: 2026-11-10

## Passed

- `npm.cmd run build` in `nodebackend`: passed, including Prisma generate and TypeScript compilation.
- `npm.cmd run build` in `frontend`: passed.
- `npm.cmd run test:minimum-wage:compiled`: passed five assertions.

The compiled smoke verifies:

1. one approved effective rate resolves;
2. total minimum wage is returned exactly;
3. named Basic and DA components comply;
4. HRA is excluded when it is not a named qualifying component; and
5. a below-floor qualifying wage returns the exact shortfall.

## Added automated tests

`nodebackend/tests/minimumWage.test.ts` covers verified resolution, missing classification, conflict detection, stale data, qualifying-component comparison, and prohibition on implicit monthly-to-daily conversion.

## Environment blocker

The following commands failed before loading any test file:

- `npm.cmd run test:minimum-wage`
- `npm.cmd run test:salary-structure`
- `npm.cmd run test:lwf-payroll`

Common host error: `uv_os_get_passwd returned ENOMEM (not enough memory)` from the TSX temporary-directory bootstrap. This is an execution-environment failure, not a test assertion failure. These suites must be rerun in a normal Node environment before production rollout.

## Not performed

- No production or shared database migration.
- No live government notification import.
- No browser end-to-end run against a migrated database.
- No live job, salary, payroll, wallet, attendance, or payment mutation.

