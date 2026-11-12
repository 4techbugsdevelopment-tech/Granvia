# Minimum Wage Implementation Plan and Status

| Phase | Status | Result |
|---|---|---|
| A0 Existing audit | Complete | Actual Granvia job, salary, LWF, payroll, auth, and UI paths documented |
| A1 Data architecture | Complete locally | Additive Prisma schema and SQL Server migration; 36-region coverage registry, no rates |
| A2 Resolver | Complete locally | Effective-date resolution, exact classification, conflict/stale states, Decimal comparison |
| A3 Admin master | Complete locally | Import, approve, reject, revoke, mapping, coverage, audit APIs and UI |
| A4 Job integration | Complete locally | Employer/Admin preview plus active publish and approval blocking |
| A5 Salary integration | Complete locally | Existing salary result reused; only approved qualifying earnings compared |
| A6 Dashboard | Complete locally | Coverage, notifications, mappings, jobs, and audit tabs |
| A7 Monitoring | Design complete | Safe discovery workflow documented; external monitoring is not enabled |
| A8 Verification | Partial | Backend/frontend builds and compiled smoke pass; TSX tests blocked by host ENOMEM |

Production deployment, actual official data import, legal approval, and live workflow acceptance remain operational steps and are not claimed as complete.

