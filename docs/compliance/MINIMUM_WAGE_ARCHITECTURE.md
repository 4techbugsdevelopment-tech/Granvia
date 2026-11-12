# Minimum Wage Architecture

## Status

Implemented locally on 2026-11-10. Production migration and government wage data are not deployed or populated.

## Design

The feature is a separate compliance module. It does not replace salary calculation, LWF, attendance, payroll, wallets, or payments.

1. Super Admin imports an official notification and one or more effective-dated rates.
2. Imported records remain inactive and under review.
3. Approval checks the official source, qualifying component list, dates, totals, and overlapping approved rates.
4. The resolver uses work state/UT, government sphere, district/zone where required, employment/occupation/skill classification, effective date, and wage unit.
5. Exactly one best approved match returns `VERIFIED`. Missing facts, no data, conflicts, stale review, invalid location, or invalid classification return explicit non-verified statuses.
6. The compliance comparer sums only earning components explicitly named by the approved rate. It never uses CTC, net pay, employer contributions, or an arbitrary conversion.
7. Job create/edit/approval writes an immutable decision snapshot. Active publication and approval require `VERIFIED` plus `COMPLIANT`; draft/pending work can remain under review.

## Resolution statuses

- `VERIFIED`
- `REVIEW_REQUIRED`
- `NOT_AVAILABLE`
- `CONFLICT_DETECTED`
- `STALE_DATA`
- `INVALID_LOCATION`
- `INVALID_CLASSIFICATION`

## Security

Management APIs use the existing `/admin` authentication and role-permission middleware. The menu permission is `Minimum Wage Compliance`. Employer APIs are authenticated and scoped to the employer's jobs. Backend validation is authoritative.

## Revision handling

Approved records are not edited in place. A new notification/version is imported and approved with its own dates. Overlapping approved rates for the same exact classification are rejected. Revocation is retained in audit history. Existing salaries, payroll, payments, and contracts are never changed automatically.

## Monitoring design

Future source monitors should create a `source_discovered`/under-review notification candidate, attach the durable official source and hash, compare it with approved periods, and notify authorized users. Monitoring must never approve or publish a rate. No external website monitor is enabled in this local implementation.

