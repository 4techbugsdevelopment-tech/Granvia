CREATE TABLE [dbo].[associate_types] (
    [id] NVARCHAR(36) NOT NULL CONSTRAINT [DF_associate_types_id] DEFAULT LOWER(CONVERT(NVARCHAR(36), NEWID())),
    [code] NVARCHAR(120) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_associate_types_status] DEFAULT 'active',
    [created_by_user_id] NVARCHAR(36) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_associate_types_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_associate_types_updated] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_associate_types] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_associate_types_code] UNIQUE ([code]),
    CONSTRAINT [UQ_associate_types_name] UNIQUE ([name])
);

CREATE INDEX [IX_associate_types_status] ON [dbo].[associate_types]([status]);

IF NOT EXISTS (SELECT 1 FROM [dbo].[associate_types] WHERE [code] = 'guard')
    INSERT INTO [dbo].[associate_types] ([id], [code], [name], [description], [status], [created_at], [updated_at])
    VALUES (LOWER(CONVERT(NVARCHAR(36), NEWID())), 'guard', 'Guard', 'Security guard and site protection associate partner.', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

IF NOT EXISTS (SELECT 1 FROM [dbo].[associate_types] WHERE [code] = 'electrician')
    INSERT INTO [dbo].[associate_types] ([id], [code], [name], [description], [status], [created_at], [updated_at])
    VALUES (LOWER(CONVERT(NVARCHAR(36), NEWID())), 'electrician', 'Electrician', 'Electrical maintenance and repair associate partner.', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

IF NOT EXISTS (SELECT 1 FROM [dbo].[associate_types] WHERE [code] = 'carpenter')
    INSERT INTO [dbo].[associate_types] ([id], [code], [name], [description], [status], [created_at], [updated_at])
    VALUES (LOWER(CONVERT(NVARCHAR(36), NEWID())), 'carpenter', 'Carpenter', 'Carpentry and woodwork associate partner.', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
