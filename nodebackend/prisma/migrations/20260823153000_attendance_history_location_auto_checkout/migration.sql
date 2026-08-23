ALTER TABLE [dbo].[attendance_records]
ADD [scheduled_out_time] DATETIME2 NULL,
    [check_in_latitude] DECIMAL(10, 6) NULL,
    [check_in_longitude] DECIMAL(10, 6) NULL,
    [check_out_latitude] DECIMAL(10, 6) NULL,
    [check_out_longitude] DECIMAL(10, 6) NULL,
    [entry_mode] NVARCHAR(32) NOT NULL CONSTRAINT [attendance_records_entry_mode_df] DEFAULT 'live',
    [checkout_method] NVARCHAR(32) NULL;

CREATE INDEX [attendance_records_scheduled_out_time_idx]
ON [dbo].[attendance_records]([scheduled_out_time]);
