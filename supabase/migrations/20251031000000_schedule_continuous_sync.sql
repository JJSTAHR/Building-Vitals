-- Schedule continuous-sync Edge Function to run every 5 minutes via pg_cron
-- This automatically fetches last 10 minutes of data from ACE API

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove any existing schedule for this job
SELECT cron.unschedule('continuous-sync-ace-data');

-- Schedule the continuous-sync Edge Function to run every 5 minutes
SELECT cron.schedule(
  'continuous-sync-ace-data',  -- Job name
  '*/5 * * * *',                -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/continuous-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000  -- 2 minute timeout
    );
  $$
);

-- Store settings for the cron job to use
-- You MUST update these values with your actual URL and service role key
ALTER DATABASE postgres SET app.settings.supabase_url TO 'https://jywxcqcjsvlyehuvsoar.supabase.co';

-- Note: Service role key should be set manually via SQL editor for security:
-- ALTER DATABASE postgres SET app.settings.supabase_service_role_key TO 'your-service-role-key-here';

-- Verify the schedule was created
SELECT * FROM cron.job WHERE jobname = 'continuous-sync-ace-data';

-- Check recent job runs (after first execution)
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'continuous-sync-ace-data') ORDER BY start_time DESC LIMIT 10;
