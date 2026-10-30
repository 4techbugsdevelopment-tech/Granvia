BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.admin_employer_assignments', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[admin_employer_assignments] (
    [id] NVARCHAR(36) NOT NULL,
    [employee_id] NVARCHAR(36) NOT NULL,
    [employer_user_id] NVARCHAR(36) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [admin_employer_assignments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [admin_employer_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [admin_employer_assignments_employee_id_employer_user_id_key] UNIQUE NONCLUSTERED ([employee_id], [employer_user_id]),
    CONSTRAINT [admin_employer_assignments_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[admin_employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [admin_employer_assignments_employer_user_id_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [admin_employer_assignments_employer_user_id_idx] ON [dbo].[admin_employer_assignments]([employer_user_id]);

-- Preserve the employer scope represented by pre-existing company allocations.
INSERT INTO [dbo].[admin_employer_assignments] ([id], [employee_id], [employer_user_id], [created_at])
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), source.[employee_id], source.[employer_user_id], CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT assignment.[employee_id], company.[employer_user_id]
    FROM [dbo].[admin_company_assignments] assignment
    INNER JOIN [dbo].[employer_companies] company ON company.[id] = assignment.[company_id]
) source;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
