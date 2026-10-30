BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[job_salary_structures] (
  [id] NVARCHAR(36) NOT NULL,
  [job_id] NVARCHAR(36) NOT NULL,
  [gross_monthly] DECIMAL(12,2) NOT NULL,
  [deductions_monthly] DECIMAL(12,2) NOT NULL,
  [net_monthly] DECIMAL(12,2) NOT NULL,
  [employer_contributions_monthly] DECIMAL(12,2) NOT NULL,
  [employer_cost_monthly] DECIMAL(12,2) NOT NULL,
  [annual_ctc] DECIMAL(14,2) NOT NULL,
  [calculation_version] INT NOT NULL CONSTRAINT [job_salary_structures_calculation_version_df] DEFAULT 1,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [job_salary_structures_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL,
  CONSTRAINT [job_salary_structures_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [job_salary_structures_job_id_key] UNIQUE NONCLUSTERED ([job_id]),
  CONSTRAINT [job_salary_structures_job_id_fkey] FOREIGN KEY ([job_id]) REFERENCES [dbo].[job_posts]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[job_salary_components] (
  [id] NVARCHAR(36) NOT NULL,
  [structure_id] NVARCHAR(36) NOT NULL,
  [code] NVARCHAR(80) NOT NULL,
  [name] NVARCHAR(150) NOT NULL,
  [category] NVARCHAR(30) NOT NULL,
  [calculation_type] NVARCHAR(20) NOT NULL,
  [fixed_amount] DECIMAL(12,2),
  [percentage] DECIMAL(7,4),
  [percentage_basis] NVARCHAR(40),
  [monthly_amount] DECIMAL(12,2) NOT NULL,
  [enabled] BIT NOT NULL CONSTRAINT [job_salary_components_enabled_df] DEFAULT 1,
  [classification] NVARCHAR(20) NOT NULL CONSTRAINT [job_salary_components_classification_df] DEFAULT 'optional',
  [statutory_code] NVARCHAR(50),
  [applicability_min_gross] DECIMAL(12,2),
  [applicability_max_gross] DECIMAL(12,2),
  [monthly_cap] DECIMAL(12,2),
  [is_custom] BIT NOT NULL CONSTRAINT [job_salary_components_is_custom_df] DEFAULT 0,
  [sort_order] INT NOT NULL CONSTRAINT [job_salary_components_sort_order_df] DEFAULT 0,
  CONSTRAINT [job_salary_components_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [job_salary_components_structure_id_code_key] UNIQUE NONCLUSTERED ([structure_id], [code]),
  CONSTRAINT [job_salary_components_structure_id_fkey] FOREIGN KEY ([structure_id]) REFERENCES [dbo].[job_salary_structures]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [job_salary_components_category_check] CHECK ([category] IN ('earning','deduction','employer_contribution')),
  CONSTRAINT [job_salary_components_calculation_type_check] CHECK ([calculation_type] IN ('fixed','percentage')),
  CONSTRAINT [job_salary_components_classification_check] CHECK ([classification] IN ('optional','mandatory'))
);

CREATE TABLE [dbo].[salary_structure_templates] (
  [id] NVARCHAR(36) NOT NULL,
  [employer_user_id] NVARCHAR(36) NOT NULL,
  [name] NVARCHAR(150) NOT NULL,
  [description] NVARCHAR(500),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [salary_structure_templates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL,
  CONSTRAINT [salary_structure_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [salary_structure_templates_employer_user_id_name_key] UNIQUE NONCLUSTERED ([employer_user_id], [name]),
  CONSTRAINT [salary_structure_templates_employer_user_id_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE [dbo].[salary_template_components] (
  [id] NVARCHAR(36) NOT NULL,
  [template_id] NVARCHAR(36) NOT NULL,
  [code] NVARCHAR(80) NOT NULL,
  [name] NVARCHAR(150) NOT NULL,
  [category] NVARCHAR(30) NOT NULL,
  [calculation_type] NVARCHAR(20) NOT NULL,
  [fixed_amount] DECIMAL(12,2),
  [percentage] DECIMAL(7,4),
  [percentage_basis] NVARCHAR(40),
  [enabled] BIT NOT NULL CONSTRAINT [salary_template_components_enabled_df] DEFAULT 1,
  [classification] NVARCHAR(20) NOT NULL CONSTRAINT [salary_template_components_classification_df] DEFAULT 'optional',
  [statutory_code] NVARCHAR(50),
  [applicability_min_gross] DECIMAL(12,2),
  [applicability_max_gross] DECIMAL(12,2),
  [monthly_cap] DECIMAL(12,2),
  [is_custom] BIT NOT NULL CONSTRAINT [salary_template_components_is_custom_df] DEFAULT 0,
  [sort_order] INT NOT NULL CONSTRAINT [salary_template_components_sort_order_df] DEFAULT 0,
  CONSTRAINT [salary_template_components_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [salary_template_components_template_id_code_key] UNIQUE NONCLUSTERED ([template_id], [code]),
  CONSTRAINT [salary_template_components_template_id_fkey] FOREIGN KEY ([template_id]) REFERENCES [dbo].[salary_structure_templates]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [salary_template_components_category_check] CHECK ([category] IN ('earning','deduction','employer_contribution')),
  CONSTRAINT [salary_template_components_calculation_type_check] CHECK ([calculation_type] IN ('fixed','percentage')),
  CONSTRAINT [salary_template_components_classification_check] CHECK ([classification] IN ('optional','mandatory'))
);

CREATE TABLE [dbo].[salary_statutory_rules] (
  [id] NVARCHAR(36) NOT NULL,
  [employer_user_id] NVARCHAR(36) NOT NULL,
  [code] NVARCHAR(50) NOT NULL,
  [name] NVARCHAR(150) NOT NULL,
  [category] NVARCHAR(30) NOT NULL,
  [percentage] DECIMAL(7,4),
  [percentage_basis] NVARCHAR(40),
  [applicability_min_gross] DECIMAL(12,2),
  [applicability_max_gross] DECIMAL(12,2),
  [monthly_cap] DECIMAL(12,2),
  [enabled] BIT NOT NULL CONSTRAINT [salary_statutory_rules_enabled_df] DEFAULT 1,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [salary_statutory_rules_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL,
  CONSTRAINT [salary_statutory_rules_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [salary_statutory_rules_employer_user_id_code_key] UNIQUE NONCLUSTERED ([employer_user_id], [code]),
  CONSTRAINT [salary_statutory_rules_employer_user_id_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT [salary_statutory_rules_category_check] CHECK ([category] IN ('deduction','employer_contribution'))
);

CREATE TABLE [dbo].[job_salary_audit_events] (
  [id] NVARCHAR(36) NOT NULL,
  [job_id] NVARCHAR(36) NOT NULL,
  [actor_user_id] NVARCHAR(36) NOT NULL,
  [action] NVARCHAR(40) NOT NULL,
  [snapshot] NVARCHAR(MAX) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [job_salary_audit_events_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [job_salary_audit_events_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [job_salary_audit_events_job_id_fkey] FOREIGN KEY ([job_id]) REFERENCES [dbo].[job_posts]([id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [job_salary_audit_events_job_id_created_at_idx] ON [dbo].[job_salary_audit_events]([job_id], [created_at]);

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
