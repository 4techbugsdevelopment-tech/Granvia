# Granvia — Node backend (Express + Prisma + SQL Server)

A ground-up Node.js port of the Laravel API in `../backend`, targeting **SQL Server**.
The React frontend talks to this server exactly as it talked to Laravel — same routes
under `/api`, same JSON shapes, same Bearer-token auth — so switching is just a matter
of pointing `VITE_API_URL` here.

## Stack
- **Express** + **TypeScript**
- **Prisma** ORM (`sqlserver` provider)
- **bcryptjs** for password hashing (verifies existing Laravel `$2y$` hashes)
- Sanctum-compatible opaque tokens stored in `personal_access_tokens`

## Setup

```bash
cd nodebackend
npm install
cp .env.example .env        # then edit DATABASE_URL for your dev SQL Server
npm run prisma:generate
npm run prisma:push         # creates all tables in the SQL Server database
npm run dev                 # http://127.0.0.1:8000/api
```

Point the frontend at it (already the default): in `frontend/.env`
```
VITE_API_URL=http://127.0.0.1:8000/api
```

## Port status (Laravel -> Node)

| Route group (`routes/api/*.php`) | Status |
|----------------------------------|--------|
| `auth.php`                       | ✅ done (register employer/guard, login, logout, me, resend) |
| `guard.php`                      | ✅ done (applications, attendance, documents, aadhaar) |
| `employer.php`                   | ✅ done (companies, sites, docs, jobs, applications, attendance, interviews, offers, agreements, payments, invoices, wallet, aadhaar, reports) |
| `admin.php`                      | ✅ done (guards, guard-docs, employers, jobs approve/reject, reports) |
| `sales.php`                      | ✅ done (counts, activity, clients, proxy job+OTP, discounts, manpower) |
| `subadmin.php`                   | ✅ done (counts, company, staff, verification, clients, guards, reports) |
| `shared.php`                     | ✅ done (public jobs, /me profile+avatar, notifications, support tickets) |

**All 7 route groups ported and verified live against SQL Server.**

### Also done
- **Email/SMTP** (`src/services/mailService.ts`) — Aadhaar OTP, welcome, and verification
  emails via nodemailer. Set `SMTP_*` in `.env` to send; when unset, mail is skipped
  (logged) and OTP endpoints return `dev_otp`.
- **Email verification** — signed `/api/email/verify/:id/:hash` link, sent on register,
  redirects to the frontend `/email-verified`.
- **Data migration** (`scripts/migrate-data.ts`, `npm run migrate:data`) — copies the live
  MySQL `granvia` DB into SQL Server `granviadb` (FK order, JSON stringified, ephemeral
  tables skipped). Verified: all 5 seed users log in with their original Laravel `$2y$`
  bcrypt passwords. Configure the source via `MYSQL_*` env vars.

## SQL Server notes
- After every `prisma db push`, re-apply the filtered unique index so users without a
  mobile number don't collide (SQL Server UNIQUE permits only one NULL):
  ```sql
  -- prisma/filtered-indexes.sql
  CREATE UNIQUE INDEX users_mobile_unique ON dbo.users (mobile) WHERE mobile IS NOT NULL;
  ```

## Conventions
- Prisma models are camelCase with `@map` to the snake_case DB columns; responses are
  converted back to snake_case via `src/utils/serialize.ts` to match the Laravel wire format.
- Laravel `json()` columns are stored as `NVARCHAR(MAX)` strings and parsed in serializers
  (SQL Server has no Prisma `Json` type).
- Decimals are serialised as strings (matching Laravel/Eloquent).
