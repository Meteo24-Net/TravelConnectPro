-- ============================================================================
-- Travel Connect Pro · Cron Secrets via Vault + Currency-Refresh Schedule
-- ============================================================================
-- Migration 5.1 (corrective patch).
-- Replaces plaintext GUC settings with encrypted Vault secrets.
-- ============================================================================

BEGIN;

-- 1. Required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Private schema for internal helpers
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT  USAGE ON SCHEMA private TO postgres, service_role;

-- 3. Helper function for auth header
-- Note: User MUST have created the 'tcp_cron_service_role' secret in Vault first
-- or run the vault.create_secret command manually.
CREATE OR REPLACE FUNCTION private.tcp_cron_auth_header()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT 'Bearer ' || (
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = 'tcp_cron_service_role'
    LIMIT 1
  );
$$;

REVOKE EXECUTE ON FUNCTION private.tcp_cron_auth_header() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.tcp_cron_auth_header() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION private.tcp_cron_auth_header() TO postgres, service_role;

-- 4. Re-schedule currency-refresh with the secure helper
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'currency-refresh-job') THEN
    PERFORM cron.unschedule('currency-refresh-job');
  END IF;
END $$;

SELECT cron.schedule(
  'currency-refresh-job',
  '0 */6 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://pjyjblllcllnqsjbvbfc.supabase.co/functions/v1/currency-refresh',
      headers := jsonb_build_object(
        'Authorization', private.tcp_cron_auth_header(),
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
  $cron$
);

COMMIT;
