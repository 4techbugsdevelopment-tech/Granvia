-- SQL Server filtered unique indexes.
-- Prisma's schema language can't express `WHERE ... IS NOT NULL`, and a plain
-- UNIQUE on SQL Server permits only a single NULL row. Run this after
-- `prisma db push` to restore "unique-when-present" semantics.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'users_mobile_unique')
    CREATE UNIQUE INDEX users_mobile_unique ON dbo.users (mobile) WHERE mobile IS NOT NULL;
