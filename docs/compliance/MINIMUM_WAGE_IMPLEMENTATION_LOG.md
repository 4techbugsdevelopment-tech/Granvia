# Minimum Wage Implementation Log

## 2026-11-10

### Phase A0

- Audited Prisma models, job controllers, salary service, LWF, payroll, attendance safety, routes, Employer Add/Edit Job, Super Admin Job Management, menus, and permissions.
- Created `MINIMUM_WAGE_EXISTING_SYSTEM_AUDIT.md` before schema changes.

### Phases A1-A3

- Added seven isolated minimum-wage models and an additive SQL Server migration.
- Registered all 28 states, 8 UTs, and Central sphere without wage rates.
- Added approved/effective resolver, qualifying-wage comparer, immutable job snapshots, and audit service.
- Added notification import/approve/reject/revoke, overlap checks, mappings, coverage, job compliance, and audit APIs.

### Phases A4-A6

- Added read-only debounced checks to Employer and Super Admin job forms.
- Added active publishing and approval enforcement inside job transactions.
- Added `/admin/minimum-wages` and the `Minimum Wage Compliance` role permission.
- Added coverage, notification, mapping, job compliance, and audit screens.

### Phase A7

- Documented the safe source-discovery workflow. No crawler, external scheduler, or automatic approval was enabled.

### Phase A8

- Prisma formatting/generation and TypeScript backend build passed.
- Vite production frontend build passed.
- Compiled resolver/comparison smoke passed five assertions.
- TSX test runner was blocked before test execution by `uv_os_get_passwd returned ENOMEM`; recorded in the test report.
- Production database migration, server restart, notification import, and legal approval were not performed.

