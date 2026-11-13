BEGIN TRY
BEGIN TRAN;

IF COL_LENGTH(N'dbo.staff_members', N'user_id') IS NULL
  ALTER TABLE [dbo].[staff_members] ADD [user_id] NVARCHAR(36) NULL;
IF COL_LENGTH(N'dbo.staff_members', N'employer_user_id') IS NULL
  ALTER TABLE [dbo].[staff_members] ADD [employer_user_id] NVARCHAR(36) NULL;
IF COL_LENGTH(N'dbo.staff_members', N'company_id') IS NULL
  ALTER TABLE [dbo].[staff_members] ADD [company_id] NVARCHAR(36) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'staff_members_user_id_key' AND object_id = OBJECT_ID(N'dbo.staff_members'))
  CREATE UNIQUE NONCLUSTERED INDEX [staff_members_user_id_key] ON [dbo].[staff_members]([user_id]) WHERE [user_id] IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'staff_members_employer_user_id_status_idx' AND object_id = OBJECT_ID(N'dbo.staff_members'))
  CREATE NONCLUSTERED INDEX [staff_members_employer_user_id_status_idx] ON [dbo].[staff_members]([employer_user_id], [status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'staff_members_company_id_status_idx' AND object_id = OBJECT_ID(N'dbo.staff_members'))
  CREATE NONCLUSTERED INDEX [staff_members_company_id_status_idx] ON [dbo].[staff_members]([company_id], [status]);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'staff_members_user_id_fkey')
  ALTER TABLE [dbo].[staff_members] ADD CONSTRAINT [staff_members_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'staff_members_company_id_fkey')
  ALTER TABLE [dbo].[staff_members] ADD CONSTRAINT [staff_members_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[employer_companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

IF OBJECT_ID(N'dbo.delegated_company_audits', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[delegated_company_audits] (
    [id] NVARCHAR(36) NOT NULL,
    [actor_user_id] NVARCHAR(36) NOT NULL,
    [actor_type] NVARCHAR(40) NOT NULL,
    [employer_user_id] NVARCHAR(36) NOT NULL,
    [company_id] NVARCHAR(36) NOT NULL,
    [department] NVARCHAR(30) NOT NULL,
    [resource] NVARCHAR(80) NOT NULL,
    [record_id] NVARCHAR(36) NULL,
    [method] NVARCHAR(10) NOT NULL,
    [status_code] INT NOT NULL,
    [metadata] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [delegated_company_audits_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [delegated_company_audits_pkey] PRIMARY KEY CLUSTERED ([id])
  );
  CREATE NONCLUSTERED INDEX [delegated_company_audits_actor_user_id_created_at_idx] ON [dbo].[delegated_company_audits]([actor_user_id], [created_at]);
  CREATE NONCLUSTERED INDEX [delegated_company_audits_company_id_created_at_idx] ON [dbo].[delegated_company_audits]([company_id], [created_at]);
END;

IF OBJECT_ID(N'dbo.admin_employee_company_assignments', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[admin_employee_company_assignments] (
    [id] NVARCHAR(36) NOT NULL,
    [employee_id] NVARCHAR(36) NOT NULL,
    [company_id] NVARCHAR(36) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [admin_employee_company_assignments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [admin_employee_company_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [admin_employee_company_assignments_employee_id_company_id_key] UNIQUE NONCLUSTERED ([employee_id], [company_id]),
    CONSTRAINT [admin_employee_company_assignments_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[admin_employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [admin_employee_company_assignments_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[employer_companies]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
  );
  CREATE NONCLUSTERED INDEX [admin_employee_company_assignments_company_id_idx] ON [dbo].[admin_employee_company_assignments]([company_id]);
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
