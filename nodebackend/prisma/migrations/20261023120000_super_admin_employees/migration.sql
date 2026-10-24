BEGIN TRY
BEGIN TRAN;

IF OBJECT_ID(N'dbo.admin_employee_roles', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[admin_employee_roles] (
    [id] NVARCHAR(36) NOT NULL,
    [owner_user_id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(MAX),
    [permissions] NVARCHAR(MAX) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [admin_employee_roles_status_df] DEFAULT 'active',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [admin_employee_roles_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [admin_employee_roles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [admin_employee_roles_owner_user_id_name_key] UNIQUE NONCLUSTERED ([owner_user_id], [name])
);
END;

IF OBJECT_ID(N'dbo.admin_employees', N'U') IS NULL
BEGIN
CREATE TABLE [dbo].[admin_employees] (
    [id] NVARCHAR(36) NOT NULL,
    [user_id] NVARCHAR(36) NOT NULL,
    [owner_user_id] NVARCHAR(36) NOT NULL,
    [role_id] NVARCHAR(36) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [admin_employees_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [admin_employees_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [admin_employees_user_id_key] UNIQUE NONCLUSTERED ([user_id]),
    CONSTRAINT [admin_employees_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [admin_employees_role_id_fkey] FOREIGN KEY ([role_id]) REFERENCES [dbo].[admin_employee_roles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE NONCLUSTERED INDEX [admin_employees_owner_user_id_idx] ON [dbo].[admin_employees]([owner_user_id]);
CREATE NONCLUSTERED INDEX [admin_employees_role_id_idx] ON [dbo].[admin_employees]([role_id]);
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
