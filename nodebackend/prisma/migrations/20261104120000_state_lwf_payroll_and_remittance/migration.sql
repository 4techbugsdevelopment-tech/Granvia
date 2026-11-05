BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[job_salary_structures] ADD
  [lwf_policy_version_id] NVARCHAR(36),
  [lwf_state_id] NVARCHAR(36),
  [lwf_frequency] NVARCHAR(30),
  [lwf_contribution_schedule] NVARCHAR(500),
  [lwf_effective_date] DATE,
  [lwf_resolution_status] NVARCHAR(30),
  [lwf_resolution_reason] NVARCHAR(120),
  [lwf_policy_snapshot] NVARCHAR(MAX);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = 'job_salary_structures_lwf_source_check')
  ALTER TABLE [dbo].[job_salary_structures] DROP CONSTRAINT [job_salary_structures_lwf_source_check];
ALTER TABLE [dbo].[job_salary_structures] ADD CONSTRAINT [job_salary_structures_lwf_source_check]
  CHECK ([lwf_source] IS NULL OR [lwf_source] IN ('master','employer','state_policy'));

CREATE TABLE [dbo].[lwf_policy_versions] (
  [id] NVARCHAR(36) NOT NULL,
  [state_id] NVARCHAR(36) NOT NULL,
  [version_number] INT NOT NULL,
  [establishment_type] NVARCHAR(120),
  [employee_amount] DECIMAL(12,2) NOT NULL,
  [employer_amount] DECIMAL(12,2) NOT NULL,
  [frequency] NVARCHAR(30) NOT NULL,
  [schedule_months] NVARCHAR(500) NOT NULL,
  [effective_from] DATE NOT NULL,
  [effective_to] DATE,
  [eligibility_min_gross] DECIMAL(12,2),
  [eligibility_max_gross] DECIMAL(12,2),
  [eligible_employee_categories] NVARCHAR(MAX),
  [exemption_codes] NVARCHAR(MAX),
  [status] NVARCHAR(30) NOT NULL CONSTRAINT [lwf_policy_versions_status_df] DEFAULT 'draft',
  [legal_reference] NVARCHAR(1000),
  [notes] NVARCHAR(MAX),
  [created_by_user_id] NVARCHAR(36) NOT NULL,
  [updated_by_user_id] NVARCHAR(36) NOT NULL,
  [activated_by_user_id] NVARCHAR(36),
  [activated_at] DATETIME2,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_policy_versions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [lwf_policy_versions_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_policy_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_policy_versions_state_fkey] FOREIGN KEY ([state_id]) REFERENCES [dbo].[state_masters]([id]),
  CONSTRAINT [lwf_policy_versions_state_version_key] UNIQUE NONCLUSTERED ([state_id], [version_number]),
  CONSTRAINT [lwf_policy_versions_amounts_check] CHECK ([employee_amount] >= 0 AND [employer_amount] >= 0),
  CONSTRAINT [lwf_policy_versions_dates_check] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
  CONSTRAINT [lwf_policy_versions_frequency_check] CHECK ([frequency] IN ('monthly','quarterly','half_yearly','yearly','custom')),
  CONSTRAINT [lwf_policy_versions_status_check] CHECK ([status] IN ('draft','active','inactive','superseded'))
);
CREATE INDEX [lwf_policy_versions_state_status_dates_idx] ON [dbo].[lwf_policy_versions]([state_id], [status], [effective_from], [effective_to]);
CREATE INDEX [lwf_policy_versions_state_establishment_idx] ON [dbo].[lwf_policy_versions]([state_id], [establishment_type]);

CREATE TABLE [dbo].[lwf_policy_audit_events] (
  [id] NVARCHAR(36) NOT NULL,
  [policy_version_id] NVARCHAR(36) NOT NULL,
  [actor_user_id] NVARCHAR(36) NOT NULL,
  [action] NVARCHAR(50) NOT NULL,
  [reason] NVARCHAR(1000),
  [snapshot] NVARCHAR(MAX) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_policy_audit_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_policy_audit_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_policy_audit_policy_fkey] FOREIGN KEY ([policy_version_id]) REFERENCES [dbo].[lwf_policy_versions]([id]) ON DELETE CASCADE
);
CREATE INDEX [lwf_policy_audit_policy_created_idx] ON [dbo].[lwf_policy_audit_events]([policy_version_id], [created_at]);

CREATE TABLE [dbo].[payroll_periods] (
  [id] NVARCHAR(36) NOT NULL, [employer_user_id] NVARCHAR(36) NOT NULL, [label] NVARCHAR(120) NOT NULL,
  [period_start] DATE NOT NULL, [period_end] DATE NOT NULL, [status] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_periods_status_df] DEFAULT 'open',
  [created_by_user_id] NVARCHAR(36) NOT NULL, [closed_at] DATETIME2, [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_periods_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [payroll_periods_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_periods_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_periods_employer_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [payroll_periods_dates_key] UNIQUE NONCLUSTERED ([employer_user_id], [period_start], [period_end]),
  CONSTRAINT [payroll_periods_dates_check] CHECK ([period_end] >= [period_start]),
  CONSTRAINT [payroll_periods_status_check] CHECK ([status] IN ('open','closed'))
);
CREATE INDEX [payroll_periods_employer_status_idx] ON [dbo].[payroll_periods]([employer_user_id], [status], [period_end]);

CREATE TABLE [dbo].[payroll_runs] (
  [id] NVARCHAR(36) NOT NULL, [period_id] NVARCHAR(36) NOT NULL, [employer_user_id] NVARCHAR(36) NOT NULL,
  [run_type] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_runs_type_df] DEFAULT 'regular', [status] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_runs_status_df] DEFAULT 'draft',
  [idempotency_key] NVARCHAR(120) NOT NULL, [correction_of_run_id] NVARCHAR(36), [reason] NVARCHAR(1000),
  [created_by_user_id] NVARCHAR(36) NOT NULL, [approved_by_user_id] NVARCHAR(36), [approved_at] DATETIME2,
  [finalized_by_user_id] NVARCHAR(36), [finalized_at] DATETIME2, [reversed_by_user_id] NVARCHAR(36), [reversed_at] DATETIME2,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_runs_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [payroll_runs_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_runs_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_runs_period_fkey] FOREIGN KEY ([period_id]) REFERENCES [dbo].[payroll_periods]([id]),
  CONSTRAINT [payroll_runs_employer_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [payroll_runs_idempotency_key] UNIQUE NONCLUSTERED ([idempotency_key]),
  CONSTRAINT [payroll_runs_type_check] CHECK ([run_type] IN ('regular','correction','reversal')),
  CONSTRAINT [payroll_runs_status_check] CHECK ([status] IN ('draft','approved','finalized','reversed'))
);
CREATE INDEX [payroll_runs_period_status_idx] ON [dbo].[payroll_runs]([period_id], [status]);
CREATE INDEX [payroll_runs_employer_created_idx] ON [dbo].[payroll_runs]([employer_user_id], [created_at]);

CREATE TABLE [dbo].[payroll_results] (
  [id] NVARCHAR(36) NOT NULL, [run_id] NVARCHAR(36) NOT NULL, [application_id] NVARCHAR(36) NOT NULL, [guard_user_id] NVARCHAR(36) NOT NULL,
  [job_id] NVARCHAR(36) NOT NULL, [state_id] NVARCHAR(36), [lwf_policy_version_id] NVARCHAR(36), [lwf_contribution_period_key] NVARCHAR(120),
  [payable_days] INT NOT NULL CONSTRAINT [payroll_results_days_df] DEFAULT 0, [attendance_snapshot] NVARCHAR(MAX) NOT NULL,
  [salary_snapshot] NVARCHAR(MAX) NOT NULL, [policy_snapshot] NVARCHAR(MAX), [gross_payable] DECIMAL(12,2) NOT NULL,
  [employee_deductions] DECIMAL(12,2) NOT NULL, [net_payable] DECIMAL(12,2) NOT NULL,
  [employer_contributions] DECIMAL(12,2) NOT NULL, [employer_cost] DECIMAL(12,2) NOT NULL,
  [status] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_results_status_df] DEFAULT 'draft', [original_result_id] NVARCHAR(36),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_results_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [payroll_results_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_results_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_results_run_fkey] FOREIGN KEY ([run_id]) REFERENCES [dbo].[payroll_runs]([id]) ON DELETE CASCADE,
  CONSTRAINT [payroll_results_job_fkey] FOREIGN KEY ([job_id]) REFERENCES [dbo].[job_posts]([id]),
  CONSTRAINT [payroll_results_run_application_key] UNIQUE NONCLUSTERED ([run_id], [application_id])
);
CREATE INDEX [payroll_results_guard_created_idx] ON [dbo].[payroll_results]([guard_user_id], [created_at]);
CREATE INDEX [payroll_results_job_created_idx] ON [dbo].[payroll_results]([job_id], [created_at]);

CREATE TABLE [dbo].[payroll_lines] (
  [id] NVARCHAR(36) NOT NULL, [payroll_result_id] NVARCHAR(36) NOT NULL, [code] NVARCHAR(80) NOT NULL, [name] NVARCHAR(180) NOT NULL,
  [category] NVARCHAR(40) NOT NULL, [amount] DECIMAL(12,2) NOT NULL, [source_type] NVARCHAR(40) NOT NULL, [source_id] NVARCHAR(36),
  [metadata] NVARCHAR(MAX), [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_lines_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_lines_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_lines_result_fkey] FOREIGN KEY ([payroll_result_id]) REFERENCES [dbo].[payroll_results]([id]) ON DELETE CASCADE,
  CONSTRAINT [payroll_lines_result_code_key] UNIQUE NONCLUSTERED ([payroll_result_id], [code])
);
CREATE INDEX [payroll_lines_code_created_idx] ON [dbo].[payroll_lines]([code], [created_at]);

CREATE TABLE [dbo].[payroll_lwf_occurrences] (
  [id] NVARCHAR(36) NOT NULL, [payroll_result_id] NVARCHAR(36) NOT NULL, [guard_user_id] NVARCHAR(36) NOT NULL,
  [policy_version_id] NVARCHAR(36) NOT NULL, [contribution_period_key] NVARCHAR(120) NOT NULL,
  [status] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_lwf_occurrence_status_df] DEFAULT 'finalized',
  [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_lwf_occurrence_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_lwf_occurrences_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_lwf_occurrences_result_fkey] FOREIGN KEY ([payroll_result_id]) REFERENCES [dbo].[payroll_results]([id]),
  CONSTRAINT [payroll_lwf_occurrences_result_key] UNIQUE NONCLUSTERED ([payroll_result_id]),
  CONSTRAINT [payroll_lwf_occurrences_deduction_key] UNIQUE NONCLUSTERED ([guard_user_id], [policy_version_id], [contribution_period_key])
);

CREATE TABLE [dbo].[payroll_audit_events] (
  [id] NVARCHAR(36) NOT NULL, [run_id] NVARCHAR(36) NOT NULL, [actor_user_id] NVARCHAR(36) NOT NULL,
  [action] NVARCHAR(60) NOT NULL, [reason] NVARCHAR(1000), [snapshot] NVARCHAR(MAX),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_audit_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_audit_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_audit_run_fkey] FOREIGN KEY ([run_id]) REFERENCES [dbo].[payroll_runs]([id]) ON DELETE CASCADE
);
CREATE INDEX [payroll_audit_run_created_idx] ON [dbo].[payroll_audit_events]([run_id], [created_at]);

CREATE TABLE [dbo].[payroll_payments] (
  [id] NVARCHAR(36) NOT NULL, [payroll_result_id] NVARCHAR(36) NOT NULL, [employer_user_id] NVARCHAR(36) NOT NULL, [guard_user_id] NVARCHAR(36) NOT NULL,
  [amount] DECIMAL(12,2) NOT NULL, [status] NVARCHAR(30) NOT NULL CONSTRAINT [payroll_payments_status_df] DEFAULT 'pending',
  [payment_method] NVARCHAR(80), [external_reference] NVARCHAR(255), [failure_reason] NVARCHAR(1000),
  [attempt_count] INT NOT NULL CONSTRAINT [payroll_payments_attempt_df] DEFAULT 1, [idempotency_key] NVARCHAR(120) NOT NULL,
  [paid_at] DATETIME2, [created_by_user_id] NVARCHAR(36) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [payroll_payments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [payroll_payments_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [payroll_payments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [payroll_payments_result_fkey] FOREIGN KEY ([payroll_result_id]) REFERENCES [dbo].[payroll_results]([id]),
  CONSTRAINT [payroll_payments_employer_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [payroll_payments_result_key] UNIQUE NONCLUSTERED ([payroll_result_id]),
  CONSTRAINT [payroll_payments_idempotency_key] UNIQUE NONCLUSTERED ([idempotency_key]),
  CONSTRAINT [payroll_payments_amount_check] CHECK ([amount] >= 0),
  CONSTRAINT [payroll_payments_status_check] CHECK ([status] IN ('pending','completed','failed','cancelled'))
);
CREATE INDEX [payroll_payments_employer_status_idx] ON [dbo].[payroll_payments]([employer_user_id], [status], [created_at]);

CREATE TABLE [dbo].[lwf_liabilities] (
  [id] NVARCHAR(36) NOT NULL, [employer_user_id] NVARCHAR(36) NOT NULL, [state_id] NVARCHAR(36) NOT NULL,
  [policy_version_id] NVARCHAR(36) NOT NULL, [contribution_period_key] NVARCHAR(120) NOT NULL,
  [employee_total] DECIMAL(14,2) NOT NULL CONSTRAINT [lwf_liabilities_employee_df] DEFAULT 0,
  [employer_total] DECIMAL(14,2) NOT NULL CONSTRAINT [lwf_liabilities_employer_df] DEFAULT 0,
  [total_payable] DECIMAL(14,2) NOT NULL CONSTRAINT [lwf_liabilities_payable_df] DEFAULT 0,
  [remitted_amount] DECIMAL(14,2) NOT NULL CONSTRAINT [lwf_liabilities_remitted_df] DEFAULT 0,
  [outstanding_amount] DECIMAL(14,2) NOT NULL CONSTRAINT [lwf_liabilities_outstanding_df] DEFAULT 0,
  [status] NVARCHAR(30) NOT NULL CONSTRAINT [lwf_liabilities_status_df] DEFAULT 'outstanding',
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_liabilities_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [lwf_liabilities_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_liabilities_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_liabilities_employer_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [lwf_liabilities_state_fkey] FOREIGN KEY ([state_id]) REFERENCES [dbo].[state_masters]([id]),
  CONSTRAINT [lwf_liabilities_period_key] UNIQUE NONCLUSTERED ([employer_user_id], [state_id], [policy_version_id], [contribution_period_key])
);
CREATE INDEX [lwf_liabilities_employer_status_idx] ON [dbo].[lwf_liabilities]([employer_user_id], [status], [updated_at]);

CREATE TABLE [dbo].[lwf_liability_entries] (
  [id] NVARCHAR(36) NOT NULL, [liability_id] NVARCHAR(36) NOT NULL, [payroll_result_id] NVARCHAR(36) NOT NULL,
  [entry_type] NVARCHAR(30) NOT NULL, [employee_amount] DECIMAL(12,2) NOT NULL, [employer_amount] DECIMAL(12,2) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_liability_entries_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_liability_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_liability_entries_liability_fkey] FOREIGN KEY ([liability_id]) REFERENCES [dbo].[lwf_liabilities]([id]),
  CONSTRAINT [lwf_liability_entries_result_fkey] FOREIGN KEY ([payroll_result_id]) REFERENCES [dbo].[payroll_results]([id]),
  CONSTRAINT [lwf_liability_entries_source_key] UNIQUE NONCLUSTERED ([liability_id], [payroll_result_id], [entry_type])
);

CREATE TABLE [dbo].[lwf_remittances] (
  [id] NVARCHAR(36) NOT NULL, [employer_user_id] NVARCHAR(36) NOT NULL, [state_id] NVARCHAR(36) NOT NULL,
  [amount] DECIMAL(14,2) NOT NULL, [status] NVARCHAR(30) NOT NULL CONSTRAINT [lwf_remittances_status_df] DEFAULT 'recorded',
  [payment_reference] NVARCHAR(255) NOT NULL, [challan_number] NVARCHAR(255), [remitted_at] DATETIME2 NOT NULL,
  [notes] NVARCHAR(1000), [created_by_user_id] NVARCHAR(36) NOT NULL, [voided_by_user_id] NVARCHAR(36), [voided_at] DATETIME2, [void_reason] NVARCHAR(1000),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_remittances_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [lwf_remittances_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_remittances_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_remittances_employer_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]),
  CONSTRAINT [lwf_remittances_state_fkey] FOREIGN KEY ([state_id]) REFERENCES [dbo].[state_masters]([id]),
  CONSTRAINT [lwf_remittances_reference_key] UNIQUE NONCLUSTERED ([employer_user_id], [payment_reference]),
  CONSTRAINT [lwf_remittances_amount_check] CHECK ([amount] > 0),
  CONSTRAINT [lwf_remittances_status_check] CHECK ([status] IN ('recorded','void'))
);

CREATE TABLE [dbo].[lwf_remittance_allocations] (
  [id] NVARCHAR(36) NOT NULL, [remittance_id] NVARCHAR(36) NOT NULL, [liability_id] NVARCHAR(36) NOT NULL,
  [amount] DECIMAL(14,2) NOT NULL, [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_remittance_allocations_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_remittance_allocations_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_remittance_allocations_remittance_fkey] FOREIGN KEY ([remittance_id]) REFERENCES [dbo].[lwf_remittances]([id]),
  CONSTRAINT [lwf_remittance_allocations_liability_fkey] FOREIGN KEY ([liability_id]) REFERENCES [dbo].[lwf_liabilities]([id]),
  CONSTRAINT [lwf_remittance_allocations_key] UNIQUE NONCLUSTERED ([remittance_id], [liability_id]),
  CONSTRAINT [lwf_remittance_allocations_amount_check] CHECK ([amount] > 0)
);

CREATE TABLE [dbo].[lwf_remittance_attachments] (
  [id] NVARCHAR(36) NOT NULL, [remittance_id] NVARCHAR(36) NOT NULL, [file_name] NVARCHAR(255) NOT NULL,
  [file_path] NVARCHAR(1000) NOT NULL, [mime_type] NVARCHAR(150) NOT NULL, [file_size] BIGINT NOT NULL,
  [uploaded_by_user_id] NVARCHAR(36) NOT NULL, [created_at] DATETIME2 NOT NULL CONSTRAINT [lwf_remittance_attachments_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [lwf_remittance_attachments_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [lwf_remittance_attachments_remittance_fkey] FOREIGN KEY ([remittance_id]) REFERENCES [dbo].[lwf_remittances]([id]) ON DELETE CASCADE
);

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;
END CATCH;
