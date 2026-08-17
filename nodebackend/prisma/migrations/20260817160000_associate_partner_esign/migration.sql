CREATE TABLE [associate_partner_agreements] (
  [id] NVARCHAR(36) NOT NULL,
  [associate_partner_id] NVARCHAR(36) NOT NULL,
  [current_key] NVARCHAR(36) NULL,
  [agreement_number] NVARCHAR(100) NOT NULL,
  [agreement_version] NVARCHAR(50) NOT NULL,
  [template_version] NVARCHAR(50) NOT NULL,
  [status] NVARCHAR(40) NOT NULL CONSTRAINT [associate_partner_agreements_status_df] DEFAULT 'DRAFT',
  [agreement_generated_at] DATETIME2 NULL,
  [original_document_path] NVARCHAR(MAX) NULL,
  [original_document_hash] NVARCHAR(64) NULL,
  [signed_document_path] NVARCHAR(MAX) NULL,
  [signed_document_hash] NVARCHAR(64) NULL,
  [esign_provider] NVARCHAR(100) NULL,
  [esign_transaction_id] NVARCHAR(255) NULL,
  [esign_request_id] NVARCHAR(255) NULL,
  [signer_name] NVARCHAR(1000) NULL,
  [signer_reference] NVARCHAR(1000) NULL,
  [certificate_serial_number] NVARCHAR(1000) NULL,
  [certificate_issuer] NVARCHAR(1000) NULL,
  [certificate_subject] NVARCHAR(1000) NULL,
  [consent_given] BIT NOT NULL CONSTRAINT [associate_partner_agreements_consent_df] DEFAULT 0,
  [consent_given_at] DATETIME2 NULL,
  [consent_ip_address] NVARCHAR(100) NULL,
  [consent_user_agent] NVARCHAR(1000) NULL,
  [esign_initiated_at] DATETIME2 NULL,
  [esign_completed_at] DATETIME2 NULL,
  [signature_verified_at] DATETIME2 NULL,
  [transaction_expires_at] DATETIME2 NULL,
  [callback_processed_at] DATETIME2 NULL,
  [correlation_hash] NVARCHAR(64) NULL,
  [failure_code] NVARCHAR(100) NULL,
  [failure_reason] NVARCHAR(2000) NULL,
  [provider_response_reference] NVARCHAR(500) NULL,
  [production_verified] BIT NOT NULL CONSTRAINT [associate_partner_agreements_production_df] DEFAULT 0,
  [locked_at] DATETIME2 NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [associate_partner_agreements_created_df] DEFAULT CURRENT_TIMESTAMP,
  [updated_at] DATETIME2 NOT NULL CONSTRAINT [associate_partner_agreements_updated_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [associate_partner_agreements_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [associate_partner_agreements_number_key] UNIQUE ([agreement_number]),
  CONSTRAINT [associate_partner_agreements_partner_fk] FOREIGN KEY ([associate_partner_id]) REFERENCES [users]([id])
);

CREATE UNIQUE INDEX [associate_partner_agreements_current_key_key]
  ON [associate_partner_agreements]([current_key]) WHERE [current_key] IS NOT NULL;
CREATE INDEX [associate_partner_agreements_partner_status_idx]
  ON [associate_partner_agreements]([associate_partner_id], [status]);
CREATE INDEX [associate_partner_agreements_transaction_idx]
  ON [associate_partner_agreements]([esign_transaction_id]);

CREATE TABLE [associate_partner_agreement_audits] (
  [id] NVARCHAR(36) NOT NULL,
  [agreement_id] NVARCHAR(36) NOT NULL,
  [associate_partner_id] NVARCHAR(36) NOT NULL,
  [event_type] NVARCHAR(80) NOT NULL,
  [transaction_id] NVARCHAR(255) NULL,
  [ip_address] NVARCHAR(100) NULL,
  [user_agent] NVARCHAR(1000) NULL,
  [metadata] NVARCHAR(MAX) NULL,
  [created_at] DATETIME2 NOT NULL CONSTRAINT [associate_partner_agreement_audits_created_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [associate_partner_agreement_audits_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [associate_partner_agreement_audits_agreement_fk] FOREIGN KEY ([agreement_id]) REFERENCES [associate_partner_agreements]([id]) ON DELETE CASCADE
);

CREATE INDEX [associate_partner_agreement_audits_agreement_created_idx]
  ON [associate_partner_agreement_audits]([agreement_id], [created_at]);
CREATE INDEX [associate_partner_agreement_audits_partner_event_idx]
  ON [associate_partner_agreement_audits]([associate_partner_id], [event_type]);
