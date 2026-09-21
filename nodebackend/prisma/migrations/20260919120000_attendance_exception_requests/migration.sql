IF COL_LENGTH('dbo.attendance_records', 'check_in_location_name') IS NULL
BEGIN
  ALTER TABLE [dbo].[attendance_records]
  ADD [check_in_location_name] NVARCHAR(500) NULL;
END;

IF COL_LENGTH('dbo.attendance_records', 'check_out_location_name') IS NULL
BEGIN
  ALTER TABLE [dbo].[attendance_records]
  ADD [check_out_location_name] NVARCHAR(500) NULL;
END;

IF OBJECT_ID('dbo.attendance_exception_requests', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[attendance_exception_requests] (
    [id] NVARCHAR(36) NOT NULL CONSTRAINT [attendance_exception_requests_pkey] PRIMARY KEY DEFAULT NEWID(),
    [guard_user_id] NVARCHAR(36) NOT NULL,
    [employer_user_id] NVARCHAR(36) NULL,
    [company_id] NVARCHAR(36) NULL,
    [job_id] NVARCHAR(36) NOT NULL,
    [site_id] NVARCHAR(36) NULL,
    [attendance_record_id] NVARCHAR(36) NULL,
    [request_type] NVARCHAR(30) NOT NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [attendance_exception_requests_status_df] DEFAULT 'pending',
    [message] NVARCHAR(MAX) NOT NULL,
    [employer_remarks] NVARCHAR(MAX) NULL,
    [device_latitude] DECIMAL(10, 6) NULL,
    [device_longitude] DECIMAL(10, 6) NULL,
    [device_location_name] NVARCHAR(500) NULL,
    [site_latitude] DECIMAL(10, 6) NULL,
    [site_longitude] DECIMAL(10, 6) NULL,
    [distance_meters] DECIMAL(10, 2) NULL,
    [radius_meters] INT NULL,
    [failure_reason] NVARCHAR(MAX) NULL,
    [decided_at] DATETIME2 NULL,
    [decided_by] NVARCHAR(36) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [attendance_exception_requests_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [attendance_exception_requests_updated_at_df] DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX [attendance_exception_requests_employer_status_created_idx]
  ON [dbo].[attendance_exception_requests]([employer_user_id], [status], [created_at]);

  CREATE INDEX [attendance_exception_requests_guard_status_created_idx]
  ON [dbo].[attendance_exception_requests]([guard_user_id], [status], [created_at]);

  CREATE INDEX [attendance_exception_requests_job_created_idx]
  ON [dbo].[attendance_exception_requests]([job_id], [created_at]);
END;
