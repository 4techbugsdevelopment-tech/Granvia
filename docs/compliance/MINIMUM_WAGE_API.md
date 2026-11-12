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

## Publishing rule

An active job requires both:

- resolution status `VERIFIED`; and
- compliance status `COMPLIANT`.

Otherwise the API returns HTTP 422 with a `minimum_wage` validation error. Draft/pending records may be saved for review.

