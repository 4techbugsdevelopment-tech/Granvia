# Minimum Wage API

All endpoints require existing bearer authentication.

## Super Admin / permitted Admin Employee

- `GET /admin/minimum-wages/jurisdictions`
- `GET /admin/minimum-wages/coverage`
- `GET /admin/minimum-wages/notifications`
- `POST /admin/minimum-wages/notifications`
- `POST /admin/minimum-wages/notifications/:notification/approve`
- `POST /admin/minimum-wages/notifications/:notification/reject`
- `POST /admin/minimum-wages/notifications/:notification/revoke`
- `GET /admin/minimum-wages/mappings`
- `POST /admin/minimum-wages/mappings`
- `POST /admin/minimum-wages/resolve`
- `GET /admin/minimum-wages/jobs`
- `GET /admin/minimum-wages/audits`
- `POST /admin/jobs/:job/validate-minimum-wage`
- `GET /admin/jobs/:job/minimum-wage-compliance`

Management requires `super_admin` or an active Admin Employee role with `Minimum Wage Compliance`. Job approval remains under `Job Management` but calls the authoritative compliance service.

## Employer

- `POST /employer/minimum-wages/resolve`
- `POST /employer/jobs/:job/validate-minimum-wage`
- `GET /employer/jobs/:job/minimum-wage-compliance`

Employer job endpoints verify ownership. Resolve previews do not persist. Job create/edit/approval persists snapshots through the job workflow.

## Publishing behavior

Every job create, edit, activation, and approval still records the minimum-wage resolution and comparison. The API does not reject the job when:

- the resolution is not `VERIFIED`; or
- the comparison is not `COMPLIANT`.

These outcomes are advisory warnings retained in the job snapshot and audit history.

