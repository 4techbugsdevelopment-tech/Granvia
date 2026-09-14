CREATE TABLE [dbo].[attendance_location_attempts] (
    [id] NVARCHAR(36) NOT NULL,
    [guard_user_id] NVARCHAR(36) NOT NULL,
    [employer_user_id] NVARCHAR(36) NULL,
    [company_id] NVARCHAR(36) NULL,
    [job_id] NVARCHAR(36) NULL,
    [site_id] NVARCHAR(36) NULL,
    [attempt_type] NVARCHAR(30) NOT NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_attendance_location_attempts_status] DEFAULT 'blocked',
    [device_latitude] DECIMAL(10,6) NULL,
    [device_longitude] DECIMAL(10,6) NULL,
    [site_latitude] DECIMAL(10,6) NULL,
    [site_longitude] DECIMAL(10,6) NULL,
    [distance_meters] DECIMAL(10,2) NULL,
    [radius_meters] INT NOT NULL,
    [reason] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_attendance_location_attempts_created] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_attendance_location_attempts] PRIMARY KEY ([id])
);

CREATE INDEX [IX_attendance_location_attempts_employer_created]
    ON [dbo].[attendance_location_attempts]([employer_user_id], [created_at]);

CREATE INDEX [IX_attendance_location_attempts_guard_created]
    ON [dbo].[attendance_location_attempts]([guard_user_id], [created_at]);

CREATE INDEX [IX_attendance_location_attempts_job_created]
    ON [dbo].[attendance_location_attempts]([job_id], [created_at]);
