CREATE TABLE [dbo].[minimum_wage_jurisdictions] (
  [id] NVARCHAR(36) NOT NULL,
  [jurisdiction_type] NVARCHAR(30) NOT NULL,
  [state_ut_code] NVARCHAR(20),
  [appropriate_government] NVARCHAR(30) NOT NULL,
  [jurisdiction_name] NVARCHAR(180) NOT NULL,
  [status] NVARCHAR(20) NOT NULL CONSTRAINT [minimum_wage_jurisdictions_status_df] DEFAULT 'active',
  [created_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_jurisdictions_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_jurisdictions_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [minimum_wage_jurisdictions_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [minimum_wage_jurisdictions_scope_key] UNIQUE NONCLUSTERED ([jurisdiction_type], [state_ut_code], [appropriate_government], [jurisdiction_name]),
  CONSTRAINT [minimum_wage_jurisdictions_type_check] CHECK ([jurisdiction_type] IN ('state','union_territory','central')),
  CONSTRAINT [minimum_wage_jurisdictions_government_check] CHECK ([appropriate_government] IN ('STATE','CENTRAL')),
  CONSTRAINT [minimum_wage_jurisdictions_status_check] CHECK ([status] IN ('active','inactive'))
);
CREATE INDEX [minimum_wage_jurisdictions_state_status_idx] ON [dbo].[minimum_wage_jurisdictions]([state_ut_code], [status]);

CREATE TABLE [dbo].[minimum_wage_notifications] (
  [id] NVARCHAR(36) NOT NULL,
  [jurisdiction_id] NVARCHAR(36) NOT NULL,
  [notification_number] NVARCHAR(180) NOT NULL,
  [notification_title] NVARCHAR(500) NOT NULL,
  [issuing_authority] NVARCHAR(300) NOT NULL,
  [publication_date] DATE NOT NULL,
  [effective_from] DATE NOT NULL,
  [effective_to] DATE,
  [notification_type] NVARCHAR(30) NOT NULL CONSTRAINT [minimum_wage_notifications_type_df] DEFAULT 'original',
  [amendment_of_id] NVARCHAR(36),
  [source_url] NVARCHAR(1000),
  [source_document_path] NVARCHAR(1000),
  [source_document_hash] NVARCHAR(128),
  [verification_status] NVARCHAR(30) NOT NULL CONSTRAINT [minimum_wage_notifications_verification_df] DEFAULT 'draft',
  [workflow_stage] NVARCHAR(30) NOT NULL CONSTRAINT [minimum_wage_notifications_workflow_df] DEFAULT 'imported',
  [verified_by_user_id] NVARCHAR(36),
  [verified_at] DATETIME2,
  [approved_by_user_id] NVARCHAR(36),
  [approved_at] DATETIME2,
  [last_verified_at] DATETIME2,
  [next_review_at] DATE,
  [remarks] NVARCHAR(MAX),
  [created_by_user_id] NVARCHAR(36) NOT NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_notifications_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_notifications_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [minimum_wage_notifications_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [minimum_wage_notifications_jurisdiction_fkey] FOREIGN KEY ([jurisdiction_id]) REFERENCES [dbo].[minimum_wage_jurisdictions]([id]),
  CONSTRAINT [minimum_wage_notifications_amendment_fkey] FOREIGN KEY ([amendment_of_id]) REFERENCES [dbo].[minimum_wage_notifications]([id]),
  CONSTRAINT [minimum_wage_notifications_scope_number_key] UNIQUE NONCLUSTERED ([jurisdiction_id], [notification_number]),
  CONSTRAINT [minimum_wage_notifications_dates_check] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
  CONSTRAINT [minimum_wage_notifications_verification_check] CHECK ([verification_status] IN ('draft','under_review','approved','rejected','revoked')),
  CONSTRAINT [minimum_wage_notifications_workflow_check] CHECK ([workflow_stage] IN ('source_discovered','imported','parsed','validated','reviewed','approved','published','rejected','revoked'))
);
CREATE INDEX [minimum_wage_notifications_status_dates_idx] ON [dbo].[minimum_wage_notifications]([verification_status], [effective_from], [effective_to]);
CREATE INDEX [minimum_wage_notifications_hash_idx] ON [dbo].[minimum_wage_notifications]([source_document_hash]);

CREATE TABLE [dbo].[minimum_wage_rates] (
  [id] NVARCHAR(36) NOT NULL,
  [notification_id] NVARCHAR(36) NOT NULL,
  [jurisdiction_id] NVARCHAR(36) NOT NULL,
  [state_ut_code] NVARCHAR(20) NOT NULL,
  [district_code] NVARCHAR(100),
  [zone_code] NVARCHAR(100),
  [employment_category_code] NVARCHAR(150),
  [occupation_code] NVARCHAR(150),
  [skill_category_code] NVARCHAR(100),
  [effective_from] DATE NOT NULL,
  [effective_to] DATE,
  [wage_unit] NVARCHAR(30) NOT NULL,
  [basic_wage] DECIMAL(14,2) NOT NULL,
  [variable_dearness_allowance] DECIMAL(14,2) NOT NULL CONSTRAINT [minimum_wage_rates_vda_df] DEFAULT 0,
  [other_mandatory_wage_components] DECIMAL(14,2) NOT NULL CONSTRAINT [minimum_wage_rates_other_df] DEFAULT 0,
  [total_notified_minimum_wage] DECIMAL(14,2) NOT NULL,
  [currency] NVARCHAR(3) NOT NULL CONSTRAINT [minimum_wage_rates_currency_df] DEFAULT 'INR',
  [qualifying_component_codes] NVARCHAR(MAX) NOT NULL,
  [applicability_conditions] NVARCHAR(MAX),
  [conversion_basis] NVARCHAR(MAX),
  [approval_status] NVARCHAR(30) NOT NULL CONSTRAINT [minimum_wage_rates_approval_df] DEFAULT 'draft',
  [created_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_rates_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_rates_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [minimum_wage_rates_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [minimum_wage_rates_notification_fkey] FOREIGN KEY ([notification_id]) REFERENCES [dbo].[minimum_wage_notifications]([id]) ON DELETE CASCADE,
  CONSTRAINT [minimum_wage_rates_jurisdiction_fkey] FOREIGN KEY ([jurisdiction_id]) REFERENCES [dbo].[minimum_wage_jurisdictions]([id]),
  CONSTRAINT [minimum_wage_rates_dates_check] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
  CONSTRAINT [minimum_wage_rates_unit_check] CHECK ([wage_unit] IN ('MONTHLY','DAILY','HOURLY','WEEKLY')),
  CONSTRAINT [minimum_wage_rates_amounts_check] CHECK ([basic_wage] >= 0 AND [variable_dearness_allowance] >= 0 AND [other_mandatory_wage_components] >= 0 AND [total_notified_minimum_wage] > 0),
  CONSTRAINT [minimum_wage_rates_total_check] CHECK ([total_notified_minimum_wage] = [basic_wage] + [variable_dearness_allowance] + [other_mandatory_wage_components]),
  CONSTRAINT [minimum_wage_rates_approval_check] CHECK ([approval_status] IN ('draft','approved','rejected','revoked'))
);
CREATE INDEX [minimum_wage_rates_resolution_idx] ON [dbo].[minimum_wage_rates]([state_ut_code], [wage_unit], [effective_from], [effective_to], [approval_status]);
CREATE INDEX [minimum_wage_rates_classification_idx] ON [dbo].[minimum_wage_rates]([employment_category_code], [occupation_code], [skill_category_code]);

CREATE TABLE [dbo].[job_role_skill_mappings] (
  [id] NVARCHAR(36) NOT NULL,
  [jurisdiction_id] NVARCHAR(36),
  [job_role_code] NVARCHAR(150) NOT NULL,
  [employment_category_code] NVARCHAR(150),
  [occupation_code] NVARCHAR(150),
  [skill_category_code] NVARCHAR(100) NOT NULL,
  [mapping_status] NVARCHAR(30) NOT NULL CONSTRAINT [job_role_skill_mappings_status_df] DEFAULT 'draft',
  [legal_reference] NVARCHAR(1000),
  [created_by_user_id] NVARCHAR(36) NOT NULL,
  [approved_by_user_id] NVARCHAR(36),
  [approved_at] DATETIME2,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [job_role_skill_mappings_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [job_role_skill_mappings_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [job_role_skill_mappings_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [job_role_skill_mappings_jurisdiction_fkey] FOREIGN KEY ([jurisdiction_id]) REFERENCES [dbo].[minimum_wage_jurisdictions]([id]),
  CONSTRAINT [job_role_skill_mappings_scope_key] UNIQUE NONCLUSTERED ([jurisdiction_id], [job_role_code], [employment_category_code], [occupation_code]),
  CONSTRAINT [job_role_skill_mappings_status_check] CHECK ([mapping_status] IN ('draft','approved','rejected','revoked'))
);
CREATE INDEX [job_role_skill_mappings_role_status_idx] ON [dbo].[job_role_skill_mappings]([job_role_code], [mapping_status]);

CREATE TABLE [dbo].[minimum_wage_coverage] (
  [id] NVARCHAR(36) NOT NULL,
  [jurisdiction_id] NVARCHAR(36),
  [state_ut_code] NVARCHAR(20) NOT NULL,
  [state_ut_name] NVARCHAR(150) NOT NULL,
  [region_type] NVARCHAR(20) NOT NULL,
  [coverage_status] NVARCHAR(30) NOT NULL CONSTRAINT [minimum_wage_coverage_status_df] DEFAULT 'NOT_STARTED',
  [verified_notification_count] INT NOT NULL CONSTRAINT [minimum_wage_coverage_count_df] DEFAULT 0,
  [last_verified_at] DATETIME2,
  [next_review_at] DATE,
  [coverage_notes] NVARCHAR(MAX),
  [updated_by_user_id] NVARCHAR(36),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_coverage_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_coverage_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [minimum_wage_coverage_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [minimum_wage_coverage_jurisdiction_fkey] FOREIGN KEY ([jurisdiction_id]) REFERENCES [dbo].[minimum_wage_jurisdictions]([id]),
  CONSTRAINT [minimum_wage_coverage_scope_key] UNIQUE NONCLUSTERED ([state_ut_code], [jurisdiction_id]),
  CONSTRAINT [minimum_wage_coverage_status_check] CHECK ([coverage_status] IN ('NOT_STARTED','SOURCE_IDENTIFIED','DATA_IMPORTED','UNDER_REVIEW','VERIFIED','PARTIALLY_VERIFIED','STALE','REQUIRES_UPDATE')),
  CONSTRAINT [minimum_wage_coverage_region_check] CHECK ([region_type] IN ('state','union_territory'))
);
CREATE INDEX [minimum_wage_coverage_status_state_idx] ON [dbo].[minimum_wage_coverage]([coverage_status], [state_ut_code]);

CREATE TABLE [dbo].[job_minimum_wage_snapshots] (
  [id] NVARCHAR(36) NOT NULL,
  [job_id] NVARCHAR(36) NOT NULL,
  [rate_id] NVARCHAR(36),
  [notification_id] NVARCHAR(36),
  [state_ut_code] NVARCHAR(20),
  [district_code] NVARCHAR(100),
  [zone_code] NVARCHAR(100),
  [employment_category_code] NVARCHAR(150),
  [occupation_code] NVARCHAR(150),
  [skill_category_code] NVARCHAR(100),
  [effective_date] DATE NOT NULL,
  [wage_unit] NVARCHAR(30),
  [applied_wage_floor] DECIMAL(14,2),
  [offered_qualifying_wage] DECIMAL(14,2),
  [shortfall] DECIMAL(14,2),
  [resolution_status] NVARCHAR(30) NOT NULL,
  [compliance_status] NVARCHAR(30) NOT NULL,
  [resolution_reason] NVARCHAR(500),
  [policy_snapshot] NVARCHAR(MAX) NOT NULL,
  [qualifying_wage_snapshot] NVARCHAR(MAX),
  [resolver_version] NVARCHAR(30) NOT NULL,
  [trigger_action] NVARCHAR(50) NOT NULL,
  [is_current] BIT NOT NULL CONSTRAINT [job_minimum_wage_snapshots_current_df] DEFAULT 1,
  [checked_by_user_id] NVARCHAR(36) NOT NULL,
  [checked_at] DATETIME2 NOT NULL CONSTRAINT [job_minimum_wage_snapshots_checked_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [job_minimum_wage_snapshots_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [job_minimum_wage_snapshots_job_fkey] FOREIGN KEY ([job_id]) REFERENCES [dbo].[job_posts]([id]),
  CONSTRAINT [job_minimum_wage_snapshots_rate_fkey] FOREIGN KEY ([rate_id]) REFERENCES [dbo].[minimum_wage_rates]([id]),
  CONSTRAINT [job_minimum_wage_snapshots_notification_fkey] FOREIGN KEY ([notification_id]) REFERENCES [dbo].[minimum_wage_notifications]([id]),
  CONSTRAINT [job_minimum_wage_snapshots_resolution_check] CHECK ([resolution_status] IN ('VERIFIED','REVIEW_REQUIRED','NOT_AVAILABLE','CONFLICT_DETECTED','STALE_DATA','INVALID_LOCATION','INVALID_CLASSIFICATION')),
  CONSTRAINT [job_minimum_wage_snapshots_compliance_check] CHECK ([compliance_status] IN ('COMPLIANT','NON_COMPLIANT','REVIEW_REQUIRED'))
);
CREATE INDEX [job_minimum_wage_snapshots_job_current_idx] ON [dbo].[job_minimum_wage_snapshots]([job_id], [is_current], [checked_at]);
CREATE INDEX [job_minimum_wage_snapshots_status_idx] ON [dbo].[job_minimum_wage_snapshots]([resolution_status], [compliance_status]);

CREATE TABLE [dbo].[minimum_wage_compliance_audits] (
  [id] NVARCHAR(36) NOT NULL,
  [actor_user_id] NVARCHAR(36) NOT NULL,
  [action] NVARCHAR(80) NOT NULL,
  [entity_type] NVARCHAR(50) NOT NULL,
  [entity_id] NVARCHAR(36) NOT NULL,
  [job_id] NVARCHAR(36),
  [notification_id] NVARCHAR(36),
  [previous_values] NVARCHAR(MAX),
  [new_values] NVARCHAR(MAX),
  [reason] NVARCHAR(1000),
  [source_reference] NVARCHAR(1000),
  [created_at] DATETIME2 NOT NULL CONSTRAINT [minimum_wage_compliance_audits_created_at_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [minimum_wage_compliance_audits_pkey] PRIMARY KEY CLUSTERED ([id])
);
CREATE INDEX [minimum_wage_compliance_audits_entity_idx] ON [dbo].[minimum_wage_compliance_audits]([entity_type], [entity_id], [created_at]);
CREATE INDEX [minimum_wage_compliance_audits_job_idx] ON [dbo].[minimum_wage_compliance_audits]([job_id], [created_at]);
CREATE INDEX [minimum_wage_compliance_audits_notification_idx] ON [dbo].[minimum_wage_compliance_audits]([notification_id], [created_at]);

INSERT INTO [dbo].[minimum_wage_jurisdictions] ([id], [jurisdiction_type], [state_ut_code], [appropriate_government], [jurisdiction_name]) VALUES
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'AP', 'STATE', 'Andhra Pradesh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'AR', 'STATE', 'Arunachal Pradesh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'AS', 'STATE', 'Assam'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'BR', 'STATE', 'Bihar'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'CG', 'STATE', 'Chhattisgarh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'GA', 'STATE', 'Goa'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'GJ', 'STATE', 'Gujarat'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'HR', 'STATE', 'Haryana'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'HP', 'STATE', 'Himachal Pradesh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'JH', 'STATE', 'Jharkhand'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'KA', 'STATE', 'Karnataka'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'KL', 'STATE', 'Kerala'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'MP', 'STATE', 'Madhya Pradesh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'MH', 'STATE', 'Maharashtra'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'MN', 'STATE', 'Manipur'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'ML', 'STATE', 'Meghalaya'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'MZ', 'STATE', 'Mizoram'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'NL', 'STATE', 'Nagaland'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'OD', 'STATE', 'Odisha'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'PB', 'STATE', 'Punjab'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'RJ', 'STATE', 'Rajasthan'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'SK', 'STATE', 'Sikkim'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'TN', 'STATE', 'Tamil Nadu'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'TS', 'STATE', 'Telangana'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'TR', 'STATE', 'Tripura'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'UP', 'STATE', 'Uttar Pradesh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'UK', 'STATE', 'Uttarakhand'),
  (CONVERT(NVARCHAR(36), NEWID()), 'state', 'WB', 'STATE', 'West Bengal'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'AN', 'STATE', 'Andaman and Nicobar Islands'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'CH', 'STATE', 'Chandigarh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'DN', 'STATE', 'Dadra and Nagar Haveli and Daman and Diu'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'DL', 'STATE', 'Delhi'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'JK', 'STATE', 'Jammu and Kashmir'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'LA', 'STATE', 'Ladakh'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'LD', 'STATE', 'Lakshadweep'),
  (CONVERT(NVARCHAR(36), NEWID()), 'union_territory', 'PY', 'STATE', 'Puducherry'),
  (CONVERT(NVARCHAR(36), NEWID()), 'central', NULL, 'CENTRAL', 'Central Sphere');

INSERT INTO [dbo].[minimum_wage_coverage] ([id], [jurisdiction_id], [state_ut_code], [state_ut_name], [region_type])
SELECT CONVERT(NVARCHAR(36), NEWID()), [id], [state_ut_code], [jurisdiction_name], [jurisdiction_type]
FROM [dbo].[minimum_wage_jurisdictions]
WHERE [jurisdiction_type] IN ('state', 'union_territory');

