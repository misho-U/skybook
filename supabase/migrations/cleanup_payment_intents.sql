-- =============================================================================
-- Daily cleanup of stale payment_intents rows.
-- =============================================================================
-- payment_intents is a transient signaling table (the frontend polls it for
-- the Flitt webhook outcome). Once the row is older than 30 days it cannot
-- be in flight any more — the Flitt redirect has long since timed out, and
-- the trip (if it succeeded) is already finalized in `trips`.
--
-- Schedule:  daily at 03:00 UTC (low-traffic window)
-- Retention: 30 days
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent helper so we can re-run this migration safely
CREATE OR REPLACE FUNCTION cleanup_old_payment_intents()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM payment_intents
  WHERE created_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'cleanup_old_payment_intents: deleted % row(s)', deleted_count;
END;
$$;

-- Unschedule any previous version of this job so the migration is idempotent
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id
    FROM cron.job
   WHERE jobname = 'cleanup_payment_intents_daily';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END;
$$;

-- Schedule: 03:00 UTC every day
SELECT cron.schedule(
  'cleanup_payment_intents_daily',
  '0 3 * * *',
  $$SELECT cleanup_old_payment_intents();$$
);
