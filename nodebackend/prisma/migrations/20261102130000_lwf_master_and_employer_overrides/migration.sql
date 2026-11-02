BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[lwf_master_settings] (
  [id] NVARCHAR(36) NOT NULL,
  [scope_key] NVARCHAR(30) NOT NULL CONSTRAINT [lwf_master_settings_scope_key_df] DEFAULT 'STANDARD',
  [employee_amount] DECIMAL(12,2) NOT NULL,
  [employer_amount] DECIMAL(12,2) NOT NULL,
  [status] NVARCHAR(20) NOT NULL CONSTRAINT [lwf_master_settings_status_df] DEFAULT 'active',
  [notes] NVARCHAR(500),
  [created_by_user_id] NVARCHAR(36) NOT NULL,
  [updated_by_user_id] NVARCHAR(36) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_master_settings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL,
  CONSTRAINT [lwf_master_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_master_settings_scope_key_key] UNIQUE NONCLUSTERED ([scope_key]),
  CONSTRAINT [lwf_master_settings_status_check] CHECK ([status] IN ('active','inactive')),
  CONSTRAINT [lwf_master_settings_amounts_check] CHECK ([employee_amount] >= 0 AND [employer_amount] >= 0)
);

CREATE TABLE [dbo].[employer_lwf_settings] (
  [id] NVARCHAR(36) NOT NULL,
  [employer_user_id] NVARCHAR(36) NOT NULL,
  [employee_amount] DECIMAL(12,2) NOT NULL,
  [employer_amount] DECIMAL(12,2) NOT NULL,
  [status] NVARCHAR(20) NOT NULL CONSTRAINT [employer_lwf_settings_status_df] DEFAULT 'active',
  [notes] NVARCHAR(500),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [employer_lwf_settings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL,
  CONSTRAINT [employer_lwf_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [employer_lwf_settings_employer_user_id_key] UNIQUE NONCLUSTERED ([employer_user_id]),
  CONSTRAINT [employer_lwf_settings_employer_user_id_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT [employer_lwf_settings_status_check] CHECK ([status] IN ('active','inactive')),
  CONSTRAINT [employer_lwf_settings_amounts_check] CHECK ([employee_amount] >= 0 AND [employer_amount] >= 0)
);

ALTER TABLE [dbo].[job_salary_structures] ADD
  [lwf_source] NVARCHAR(20),
  [lwf_setting_id] NVARCHAR(36);

ALTER TABLE [dbo].[job_salary_structures] ADD CONSTRAINT [job_salary_structures_lwf_source_check]
  CHECK ([lwf_source] IS NULL OR [lwf_source] IN ('master','employer'));

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
