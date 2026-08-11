IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[roles] (
        [id] NVARCHAR(36) NOT NULL,
        [code] NVARCHAR(120) NOT NULL,
        [name] NVARCHAR(150) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [permissions] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_roles_status] DEFAULT ('active'),
        [created_by_user_id] NVARCHAR(36) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_roles_created_at] DEFAULT (SYSUTCDATETIME()),
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_roles_updated_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_roles] PRIMARY KEY CLUSTERED ([id] ASC)
    );

    CREATE UNIQUE INDEX [UX_roles_code] ON [dbo].[roles] ([code]);
    CREATE UNIQUE INDEX [UX_roles_name] ON [dbo].[roles] ([name]);
    CREATE INDEX [IX_roles_status] ON [dbo].[roles] ([status]);
END

IF COL_LENGTH('dbo.sub_admin_profiles', 'employer_user_id') IS NULL
BEGIN
    ALTER TABLE [dbo].[sub_admin_profiles]
        ADD [employer_user_id] NVARCHAR(36) NULL;

    CREATE INDEX [IX_sub_admin_profiles_employer_user_id]
        ON [dbo].[sub_admin_profiles] ([employer_user_id]);
END

IF COL_LENGTH('dbo.staff_members', 'role_id') IS NULL
BEGIN
    ALTER TABLE [dbo].[staff_members]
        ADD [role_id] NVARCHAR(36) NULL;

    CREATE INDEX [IX_staff_members_role_id]
        ON [dbo].[staff_members] ([role_id]);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles])
BEGIN
    INSERT INTO [dbo].[roles] ([id], [code], [name], [description], [status], [created_by_user_id])
    VALUES
        (NEWID(), 'branch_manager', 'Branch Manager', 'Branch-level manager with broad operational access.', 'active', NULL),
        (NEWID(), 'operations_manager', 'Operations Manager', 'Operational oversight and daily coordination.', 'active', NULL),
        (NEWID(), 'hr_coordinator', 'HR Coordinator', 'Hiring, onboarding, and workforce coordination.', 'active', NULL),
        (NEWID(), 'field_supervisor', 'Field Supervisor', 'Field-level supervision and escalations.', 'active', NULL),
        (NEWID(), 'site_incharge', 'Site Incharge', 'On-site supervision and attendance coordination.', 'active', NULL);
END

IF COL_LENGTH('dbo.roles', 'permissions') IS NOT NULL
BEGIN
    UPDATE [dbo].[roles]
    SET [permissions] = '[]'
    WHERE [permissions] IS NULL;
END
