BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.wallet_recharge_requests', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[wallet_recharge_requests] (
    [id] NVARCHAR(36) NOT NULL,
    [employer_user_id] NVARCHAR(36) NOT NULL,
    [amount] DECIMAL(12, 2) NOT NULL,
    [remarks] NVARCHAR(500),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [wallet_recharge_requests_status_df] DEFAULT 'pending',
    [completed_by_user_id] NVARCHAR(36),
    [completed_at] DATETIME2,
    [wallet_transaction_id] NVARCHAR(36),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [wallet_recharge_requests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [wallet_recharge_requests_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [wallet_recharge_requests_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [wallet_recharge_requests_employer_user_id_fkey] FOREIGN KEY ([employer_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT [wallet_recharge_requests_completed_by_user_id_fkey] FOREIGN KEY ([completed_by_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [wallet_recharge_requests_employer_user_id_created_at_idx]
    ON [dbo].[wallet_recharge_requests]([employer_user_id], [created_at]);
CREATE NONCLUSTERED INDEX [wallet_recharge_requests_status_created_at_idx]
    ON [dbo].[wallet_recharge_requests]([status], [created_at]);
CREATE NONCLUSTERED INDEX [wallet_recharge_requests_completed_by_user_id_idx]
    ON [dbo].[wallet_recharge_requests]([completed_by_user_id]);
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
