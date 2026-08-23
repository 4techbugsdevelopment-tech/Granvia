CREATE TABLE [dbo].[guard_availability] (
    [id] NVARCHAR(36) NOT NULL,
    [guard_user_id] NVARCHAR(36) NOT NULL,
    [duration_hours] INT NOT NULL,
    [frequency] NVARCHAR(255) NOT NULL,
    [days] NVARCHAR(MAX) NOT NULL,
    [start_time] NVARCHAR(5) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [guard_availability_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [guard_availability_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [guard_availability_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [guard_availability_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE INDEX [guard_availability_guard_user_id_active_idx]
ON [dbo].[guard_availability]([guard_user_id], [active]);
