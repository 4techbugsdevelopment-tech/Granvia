CREATE TABLE [dbo].[associate_wallets] (
    [id] NVARCHAR(36) NOT NULL,
    [guard_user_id] NVARCHAR(36) NOT NULL,
    [available_balance] DECIMAL(12,2) NOT NULL CONSTRAINT [DF_associate_wallets_available] DEFAULT 0,
    [reserved_balance] DECIMAL(12,2) NOT NULL CONSTRAINT [DF_associate_wallets_reserved] DEFAULT 0,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_associate_wallets_currency] DEFAULT 'INR',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_associate_wallets_status] DEFAULT 'active',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_associate_wallets_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [PK_associate_wallets] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_associate_wallets_guard_user_id] UNIQUE ([guard_user_id]),
    CONSTRAINT [FK_associate_wallets_users] FOREIGN KEY ([guard_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
);

CREATE TABLE [dbo].[associate_wallet_transactions] (
    [id] NVARCHAR(36) NOT NULL,
    [wallet_id] NVARCHAR(36) NOT NULL,
    [transaction_type] NVARCHAR(30) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [purpose] NVARCHAR(MAX),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_associate_wallet_tx_status] DEFAULT 'completed',
    [reference_type] NVARCHAR(50),
    [reference_id] NVARCHAR(36),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_associate_wallet_tx_created] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_associate_wallet_transactions] PRIMARY KEY ([id]),
    CONSTRAINT [FK_associate_wallet_transactions_wallet] FOREIGN KEY ([wallet_id]) REFERENCES [dbo].[associate_wallets]([id]) ON DELETE CASCADE
);

CREATE UNIQUE INDEX [UQ_associate_wallet_transactions_reference]
    ON [dbo].[associate_wallet_transactions]([reference_type], [reference_id])
    WHERE [reference_type] IS NOT NULL AND [reference_id] IS NOT NULL;
CREATE INDEX [IX_associate_wallet_transactions_wallet_created]
    ON [dbo].[associate_wallet_transactions]([wallet_id], [created_at]);

CREATE TABLE [dbo].[withdrawal_requests] (
    [id] NVARCHAR(36) NOT NULL,
    [guard_user_id] NVARCHAR(36) NOT NULL,
    [wallet_id] NVARCHAR(36) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [fee_amount] DECIMAL(12,2) NOT NULL CONSTRAINT [DF_withdrawal_fee] DEFAULT 0,
    [net_amount] DECIMAL(12,2) NOT NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_withdrawal_status] DEFAULT 'requested',
    [rejection_reason] NVARCHAR(MAX),
    [reviewed_by_user_id] NVARCHAR(36),
    [reviewed_at] DATETIME2,
    [gateway_provider] NVARCHAR(100),
    [gateway_reference] NVARCHAR(255),
    [gateway_status] NVARCHAR(80),
    [gateway_response] NVARCHAR(MAX),
    [idempotency_key] NVARCHAR(100) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_withdrawal_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [PK_withdrawal_requests] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_withdrawal_idempotency_key] UNIQUE ([idempotency_key])
);
CREATE INDEX [IX_withdrawal_guard_created] ON [dbo].[withdrawal_requests]([guard_user_id], [created_at]);
CREATE INDEX [IX_withdrawal_status_created] ON [dbo].[withdrawal_requests]([status], [created_at]);

CREATE TABLE [dbo].[operations_assignments] (
    [id] NVARCHAR(36) NOT NULL,
    [operations_user_id] NVARCHAR(36) NOT NULL,
    [employer_user_id] NVARCHAR(36) NOT NULL,
    [company_id] NVARCHAR(36),
    [site_id] NVARCHAR(36),
    [job_id] NVARCHAR(36),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_operations_assignment_status] DEFAULT 'active',
    [permissions] NVARCHAR(MAX),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_operations_assignment_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [PK_operations_assignments] PRIMARY KEY ([id])
);
CREATE INDEX [IX_operations_user_status] ON [dbo].[operations_assignments]([operations_user_id], [status]);
CREATE INDEX [IX_operations_employer_status] ON [dbo].[operations_assignments]([employer_user_id], [status]);
CREATE INDEX [IX_operations_job] ON [dbo].[operations_assignments]([job_id]);

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [code] = 'operations')
    INSERT INTO [dbo].[roles] ([id], [code], [name], [description], [permissions], [status], [created_by_user_id], [created_at], [updated_at])
    VALUES (NEWID(), 'operations', 'Operations', 'Employer-scoped hiring, onboarding and attendance operations.', '["Applications","Hiring","Attendance","Agreements"]', 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles] WHERE [code] = 'finance')
    INSERT INTO [dbo].[roles] ([id], [code], [name], [description], [permissions], [status], [created_by_user_id], [created_at], [updated_at])
    VALUES (NEWID(), 'finance', 'Finance', 'Withdrawal review, payout and reconciliation operations.', '["Wallet & Payments","Withdrawals"]', 'active', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
