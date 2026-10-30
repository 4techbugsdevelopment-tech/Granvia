-- Granvia reusable SMS gateway persistence and registration mobile OTP.
-- Provider credentials and message bodies are intentionally not stored here.

CREATE TABLE [sms_messages] (
    [id] NVARCHAR(36) NOT NULL,
    [recipient_masked] NVARCHAR(30) NOT NULL,
    [recipient_digest] NVARCHAR(64) NOT NULL,
    [template_key] NVARCHAR(100) NOT NULL,
    [provider] NVARCHAR(40) NOT NULL,
    [provider_message_id] NVARCHAR(255),
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [sms_messages_status_df] DEFAULT 'pending',
    [attempt_count] INT NOT NULL CONSTRAINT [sms_messages_attempt_count_df] DEFAULT 0,
    [correlation_id] NVARCHAR(100),
    [purpose] NVARCHAR(80),
    [error_code] NVARCHAR(80),
    [error_message] NVARCHAR(500),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sms_messages_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [sms_messages_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sms_messages_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [sms_messages_recipient_digest_created_at_idx]
    ON [sms_messages]([recipient_digest], [created_at]);
CREATE INDEX [sms_messages_status_created_at_idx]
    ON [sms_messages]([status], [created_at]);
CREATE INDEX [sms_messages_correlation_id_idx]
    ON [sms_messages]([correlation_id]);

CREATE TABLE [sms_otp_challenges] (
    [id] NVARCHAR(36) NOT NULL,
    [mobile_digest] NVARCHAR(64) NOT NULL,
    [otp_hash] NVARCHAR(64) NOT NULL,
    [purpose] NVARCHAR(50) NOT NULL,
    [session_id] NVARCHAR(36) NOT NULL,
    [request_ip_digest] NVARCHAR(64) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [resend_available_at] DATETIME2 NOT NULL,
    [attempts] INT NOT NULL CONSTRAINT [sms_otp_challenges_attempts_df] DEFAULT 0,
    [consumed_at] DATETIME2,
    [invalidated_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sms_otp_challenges_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [sms_otp_challenges_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sms_otp_challenges_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [sms_otp_challenges_mobile_purpose_session_created_idx]
    ON [sms_otp_challenges]([mobile_digest], [purpose], [session_id], [created_at]);
CREATE INDEX [sms_otp_challenges_request_ip_created_idx]
    ON [sms_otp_challenges]([request_ip_digest], [created_at]);
CREATE INDEX [sms_otp_challenges_expires_at_idx]
    ON [sms_otp_challenges]([expires_at]);
CREATE UNIQUE INDEX [sms_otp_challenges_one_active_per_session]
    ON [sms_otp_challenges]([mobile_digest], [purpose], [session_id])
    WHERE [consumed_at] IS NULL AND [invalidated_at] IS NULL;

CREATE TABLE [sms_verification_grants] (
    [id] NVARCHAR(36) NOT NULL,
    [mobile_digest] NVARCHAR(64) NOT NULL,
    [session_id] NVARCHAR(36) NOT NULL,
    [purpose] NVARCHAR(50) NOT NULL,
    [token_hash] NVARCHAR(64) NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [consumed_at] DATETIME2,
    [invalidated_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [sms_verification_grants_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sms_verification_grants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [sms_verification_grants_token_hash_key] UNIQUE NONCLUSTERED ([token_hash])
);

CREATE INDEX [sms_verification_grants_mobile_purpose_session_created_idx]
    ON [sms_verification_grants]([mobile_digest], [purpose], [session_id], [created_at]);
CREATE INDEX [sms_verification_grants_expires_at_idx]
    ON [sms_verification_grants]([expires_at]);
CREATE UNIQUE INDEX [sms_verification_grants_one_active_per_session]
    ON [sms_verification_grants]([mobile_digest], [purpose], [session_id])
    WHERE [consumed_at] IS NULL AND [invalidated_at] IS NULL;
