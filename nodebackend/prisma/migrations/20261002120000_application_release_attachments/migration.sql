IF COL_LENGTH('dbo.job_applications', 'release_attachments') IS NULL
  ALTER TABLE [dbo].[job_applications] ADD [release_attachments] NVARCHAR(MAX) NULL;
