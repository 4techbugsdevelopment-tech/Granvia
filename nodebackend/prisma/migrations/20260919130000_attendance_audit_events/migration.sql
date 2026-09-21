IF OBJECT_ID('dbo.attendance_audit_events', 'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[attendance_audit_events] (
    [id] NVARCHAR(36) NOT NULL CONSTRAINT [attendance_audit_events_pkey] PRIMARY KEY DEFAULT NEWID(),
    [attendance_record_id] NVARCHAR(36) NULL,
    [exception_request_id] NVARCHAR(36) NULL,
    [guard_user_id] NVARCHAR(36) NULL,
    [employer_user_id] NVARCHAR(36) NULL,
    [job_id] NVARCHAR(36) NULL,
    [site_id] NVARCHAR(36) NULL,
    [actor_user_id] NVARCHAR(36) NULL,
    [actor_role] NVARCHAR(40) NULL,
    [event_type] NVARCHAR(60) NOT NULL,
    [event_at] DATETIME2 NOT NULL CONSTRAINT [attendance_audit_events_event_at_df] DEFAULT CURRENT_TIMESTAMP,
    [attendance_date] DATETIME2 NULL,
    [device_latitude] DECIMAL(10, 6) NULL,
    [device_longitude] DECIMAL(10, 6) NULL,
    [device_location_name] NVARCHAR(500) NULL,
    [site_latitude] DECIMAL(10, 6) NULL,
    [site_longitude] DECIMAL(10, 6) NULL,
    [distance_meters] DECIMAL(10, 2) NULL,
    [radius_meters] INT NULL,
    [ip_address] NVARCHAR(100) NULL,
    [user_agent] NVARCHAR(1000) NULL,
    [origin] NVARCHAR(500) NULL,
    [referer] NVARCHAR(500) NULL,
    [remarks] NVARCHAR(MAX) NULL,
    [metadata] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [attendance_audit_events_created_at_df] DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX [attendance_audit_events_record_event_idx] ON [dbo].[attendance_audit_events]([attendance_record_id], [event_at]);
  CREATE INDEX [attendance_audit_events_request_event_idx] ON [dbo].[attendance_audit_events]([exception_request_id], [event_at]);
  CREATE INDEX [attendance_audit_events_actor_event_idx] ON [dbo].[attendance_audit_events]([actor_user_id], [event_at]);
  CREATE INDEX [attendance_audit_events_guard_event_idx] ON [dbo].[attendance_audit_events]([guard_user_id], [event_at]);
  CREATE INDEX [attendance_audit_events_employer_event_idx] ON [dbo].[attendance_audit_events]([employer_user_id], [event_at]);
END;
