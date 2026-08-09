IF OBJECT_ID(N'dbo.email_delivery_logs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[email_delivery_logs] (
        [id] NVARCHAR(36) NOT NULL,
        [kind] NVARCHAR(100) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_email_delivery_logs_status] DEFAULT ('sent'),
        [to_email] NVARCHAR(255) NOT NULL,
        [subject] NVARCHAR(255) NOT NULL,
        [source_url] NVARCHAR(MAX) NULL,
        [request_url] NVARCHAR(MAX) NULL,
        [origin] NVARCHAR(MAX) NULL,
        [referer] NVARCHAR(MAX) NULL,
        [environment] NVARCHAR(50) NULL,
        [provider_host] NVARCHAR(255) NULL,
        [provider_port] INT NULL,
        [provider_secure] BIT NULL,
        [from_email] NVARCHAR(255) NULL,
        [from_name] NVARCHAR(255) NULL,
        [message_id] NVARCHAR(255) NULL,
        [response] NVARCHAR(MAX) NULL,
        [accepted] NVARCHAR(MAX) NULL,
        [rejected] NVARCHAR(MAX) NULL,
        [pending] NVARCHAR(MAX) NULL,
        [envelope_from] NVARCHAR(255) NULL,
        [envelope_to] NVARCHAR(MAX) NULL,
        [error_message] NVARCHAR(MAX) NULL,
        [details] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_email_delivery_logs_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_email_delivery_logs_updated_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_email_delivery_logs] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE INDEX [IX_email_delivery_logs_created_at] ON [dbo].[email_delivery_logs] ([created_at] DESC);
    CREATE INDEX [IX_email_delivery_logs_kind] ON [dbo].[email_delivery_logs] ([kind]);
    CREATE INDEX [IX_email_delivery_logs_status] ON [dbo].[email_delivery_logs] ([status]);
END
