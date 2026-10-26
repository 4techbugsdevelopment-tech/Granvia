BEGIN TRY
BEGIN TRAN;
CREATE TABLE [dbo].[admin_company_assignments] (
 [id] NVARCHAR(36) NOT NULL,
 [employee_id] NVARCHAR(36) NOT NULL,
 [company_id] NVARCHAR(36) NOT NULL,
 [department] NVARCHAR(30) NOT NULL,
 [created_at] DATETIME2 NOT NULL CONSTRAINT [admin_company_assignments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT [admin_company_assignments_pkey] PRIMARY KEY CLUSTERED ([id]),
 CONSTRAINT [admin_company_assignments_employee_id_company_id_department_key] UNIQUE NONCLUSTERED ([employee_id], [company_id], [department]),
 CONSTRAINT [admin_company_assignments_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[admin_employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
 CONSTRAINT [admin_company_assignments_company_id_fkey] FOREIGN KEY ([company_id]) REFERENCES [dbo].[employer_companies]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
 CONSTRAINT [admin_company_assignments_department_check] CHECK ([department] IN ('hr', 'sales', 'operations', 'accounts'))
);
CREATE NONCLUSTERED INDEX [admin_company_assignments_company_id_idx] ON [dbo].[admin_company_assignments]([company_id]);
COMMIT TRAN;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT > 0 ROLLBACK TRAN;
 THROW;
END CATCH
