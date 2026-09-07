# Granvia Smoke Checklist

Use this checklist after a frontend or backend change that can affect the main role flow.

## Demo credentials

| Role | Login route | Email | Password |
| --- | --- | --- | --- |
| Super Admin | `/` or `/admin` | `admin@granvia.test` | `password` |
| Employer | `/employer` or `/app` | `employer@granvia.test` | `password` |
| Associate | `/guard` or `/app` | `guard@granvia.test` | `password` |
| Sub Admin | `/sub-admin` or `/app` | `subadmin@granvia.test` | `password` |
| Sales Executive | `/sales` or `/app` | `sales@granvia.test` | `password` |

## Checklist

| No. | Role / Login | Smoke step | Expected result | Status |
| --- | --- | --- | --- | --- |
| 1 | Any user / `/home-1` | Open the retained multi-login landing page. | Role tiles are visible and selectable. | [ ] |
| 2 | Super Admin / `/` or `/admin` | Log in with the demo Super Admin account. | Super Admin dashboard opens. | [ ] |
| 3 | Employer / `/employer` or `/app` | Log in with the demo Employer account. | Employer dashboard opens. | [ ] |
| 4 | Employer | Create or open a company and submit required documents. | Company is saved and sent for review. | [ ] |
| 5 | Super Admin / `/` or `/admin` | Approve the company. | Company becomes verified. | [ ] |
| 6 | Employer | Create a site for the verified company. | Site becomes active. | [ ] |
| 7 | Employer | Create and submit a job. | Job becomes pending approval. | [ ] |
| 8 | Super Admin / `/` or `/admin` | Approve the job. | Job becomes active. | [ ] |
| 9 | Associate / `/guard` or `/app` | Log in with the demo Associate account. | Associate dashboard opens. | [ ] |
| 10 | Associate | Complete profile, Aadhaar, documents, and agreement. | Profile becomes ready for hiring actions. | [ ] |
| 11 | Associate | Open nearby jobs and apply. | Application is created. | [ ] |
| 12 | Employer | Review applications and shortlist the Associate. | Application becomes shortlisted. | [ ] |
| 13 | Employer | Send a job offer. | Offer appears on the Associate side. | [ ] |
| 14 | Associate | Open `My Applications` and accept the offer. | Offer becomes accepted and agreement is generated. | [ ] |
| 15 | Associate | Open `Accepted Jobs`. | Accepted assignment is visible. | [ ] |
| 16 | Associate | Check in for the assigned shift. | Attendance record is created. | [ ] |
| 17 | Associate | Check out after the shift. | Attendance moves to employer verification. | [ ] |
| 18 | Employer | Approve attendance. | Attendance becomes approved. | [ ] |
| 19 | Employer | Process payment for approved attendance. | Payment is completed and Associate wallet is credited. | [ ] |
| 20 | Associate | Open wallet and verify the credit. | Transaction and balance are visible. | [ ] |
| 21 | Associate | Request withdrawal. | Withdrawal enters requested or processing state. | [ ] |
| 22 | Employer | Close the job after all work is settled. | Job becomes closed. | [ ] |

## Notes

- If step 14 fails, check the `job offer -> application -> agreement` synchronization first.
- If step 16 fails, check assignment status and geofence/location rules.
- If step 19 fails, verify the attendance record is `approved` and the payment API is reachable.
- Record the exact failing step, route, and response message before fixing the issue.
