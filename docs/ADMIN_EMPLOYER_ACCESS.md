# Super Admin direct employer access

Implemented locally on 2026-10-23.

## User flow

1. A signed-in Super Admin opens **Manage Employers**.
2. The employer name is a link in both the desktop list and mobile cards. It opens that employer's `/employer` dashboard in a new tab.
3. The original Super Admin tab and login stay unchanged. Several employer tabs can be used independently.
4. The new tab shows a **Super Admin access** banner identifying the employer and the employer's actual account status. Existing employer modules operate on that employer's account, companies, sites, jobs, hiring, attendance, documents, wallet, payments and reports.
5. **Return to Super Admin** clears the current tab's employer selection and opens Manage Employers. It never logs out the original Super Admin session.

The employer password is not needed or changed. This link is available only to Super Admin, not Super Admin employee accounts. The normal employer's own login is not revoked or replaced.

## Implementation and authorization

- The existing Super Admin bearer token stays in shared local storage. The employer selection alone is stored in per-tab `sessionStorage`. No second bearer token or employer password is created.
- The new-tab URL initially contains only `admin_employer=<employer UUID>`. Startup stores this selection in the tab and removes the parameter before React authentication runs. Reloading retains the selected employer; leaving the workspace clears it.
- The API client attaches `X-Admin-Employer-Id` in that tab. `requireAuth` first resolves the real bearer token, then validates the stored actor is still an active `super_admin` and the selected ID belongs to an employer.
- Only `/employer/*`, `/me/*` and `/auth/me` accept this scoped authenticated access. Attempts to use it on admin or other portal routes are denied. Missing/deleted targets and invalid IDs fail closed.
- After authorization, `req.user` is projected to the employer for that request so existing employer ownership filters and APIs work without opening access to other employers' records. `req.adminEmployerAccess` separately records the true Super Admin actor and target.
- The scoped response from `/auth/me` identifies the target employer and includes the access metadata for the banner. It never serializes passwords.
- Super Admin may manage inactive/blocked employer accounts; their stored account status is not changed. Employer onboarding menu restrictions are lifted for the Super Admin workspace. Existing company requirements, financial rules, ownership validation and globally disabled integrations remain in force.
- Each scoped request emits an `[admin-employer-access]` server log with actor ID, employer ID, HTTP method, path and response status. Retain backend logs for this attribution. Existing business audit records still use the effective employer identity unless their controller separately records the actor; this feature does not add a durable impersonation-audit database table.
- Logout in the employer tab does not revoke the real bearer token. API `/auth/logout` also protects the admin token when the scoped header is present. Normal logout behavior is unchanged. If the real token expires/is revoked or the Super Admin is blocked/demoted, further employer access fails.
- No schema changes or migrations are required for this feature.

## Verification and remaining acceptance

`npm.cmd run test:admin-employer-access` covers nine cases: ordinary sessions, target scoping, blocked employer access without a saved status change, denial to other roles/inactive admins, invalid targets/routes, safe session serialization, logout isolation, real HTTP authorization with two targets and source-token invalidation, and tab-storage/reload/return behavior.

All 85 tests passed in the combined direct-access, admin-employee and reporting run. Tests use mocked Prisma delegates and simulated tab storage; they are not a real browser or database acceptance run. Backend/frontend builds pass. The full frontend typecheck still reports pre-existing employer/attendance/type-definition errors. Real-account browser acceptance remains pending, including opening two employer tabs from the actual list, using company/site/job/hiring/attendance/report operations, returning to the original tab, and checking deployed proxy/CORS support for the custom header. No live employer writes or deployment were performed.

The previously added Super Admin Roles/Employees feature has a separate unapplied database migration and SQL Server TLS readiness blocker; this direct-access feature adds no further migration.
