# API smoke-test summary

Run date: 2026-08-13  
Target: `http://127.0.0.1:8000/api`  
Database used by the local backend: remote SQL Server database configured in `.env`

## Coverage and result

- All 137 registered HTTP method/route pairs were inventoried. Of these, 128 were actually requested across the complete run and one supplemental delete-fixture check; 9 could not be called because a prerequisite fixture or OTP was unavailable.
- Complete run: 150 calls — 117 passed, 13 returned an expected negative/feature-gated response, 11 failed, and 9 were skipped because a prerequisite fixture could not be created.
- Supplemental `DELETE /employer/jobs/:job` check passed with HTTP 200.

## Actual failures

The following 11 calls returned HTTP 500:

- `GET /me/roles`
- `GET /admin/roles`
- `POST /admin/roles`
- `GET /employer/staff`
- `POST /employer/staff`
- `GET /employer/subadmins`
- `POST /employer/subadmins`
- `GET /subadmin/company`
- `PATCH /subadmin/company`
- `GET /subadmin/staff`
- `POST /subadmin/staff`

They share one database-schema cause. The configured database is missing the `dbo.roles` table, `staff_members.role_id` column, and `sub_admin_profiles.employer_user_id` column supplied by `prisma/migrations/20260811103000_roles_master_and_team_management/migration.sql`.

Eight role/staff/subadmin update or delete checks were skipped because their create prerequisite failed. The cash-payment OTP confirmation was also skipped: OTP creation passed, but SMTP is configured and the dummy `.test` mailbox cannot receive the code.

## Expected non-success responses

- Aadhaar write endpoints returned HTTP 403 while the Aadhaar feature is disabled.
- Invalid signature, verification, login OTP, and password-reset checks returned their expected rejection status.
- The deliberate SMTP test to an invalid dummy address returned HTTP 502.

## Dummy-data cleanup

`cleanup-inventory.json` is a read-only inventory containing 64 database records and 13 uploaded files associated with the test window. It also identifies two pre-existing demo profiles changed during testing; inspect and restore those fields rather than deleting those profiles.

No cleanup has been performed.
