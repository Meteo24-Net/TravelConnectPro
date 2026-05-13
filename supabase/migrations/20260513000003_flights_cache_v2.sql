-- ============================================================================
-- Travel Connect Pro · Migration: flights_cache_v2
-- ============================================================================
-- Reshapes flights_cache to be per-hotel and adds tracking columns.
-- This allows different properties to use different providers (AirLabs/AviationStack).
-- ============================================================================

BEGIN;

-- ── 1. Upgrade flights_cache table ──────────────────────────────────────────

-- Drop old primary key and clear global data
ALTER TABLE flights_cache DROP CONSTRAINT flights_cache_pkey;
DELETE FROM flights_cache;

-- Add new columns
ALTER TABLE flights_cache
  ADD COLUMN hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  ADD COLUMN source          TEXT,
  ADD COLUMN last_success_at TIMESTAMPTZ,
  ADD COLUMN type            TEXT CHECK (type IN ('arrivals', 'departures')) DEFAULT 'departures';

-- Set new composite primary key
ALTER TABLE flights_cache
  ADD PRIMARY KEY (hotel_id, iata_code, type);

COMMENT ON TABLE flights_cache IS 'Per-hotel cached flight data. Populated via Edge Function using integration_config.';

-- ── 2. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE flights_cache ENABLE ROW LEVEL SECURITY;

-- Super admin can read all
CREATE POLICY flights_cache_super_admin_read
  ON public.flights_cache
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Managers can read their own hotel's data
CREATE POLICY flights_cache_manager_read
  ON public.flights_cache
  FOR SELECT
  TO authenticated
  USING (hotel_id = public.current_user_hotel_id());

-- Anon role (display app) reads via Edge Function (no direct SELECT)
REVOKE SELECT ON public.flights_cache FROM anon;

-- ── 3. Schedule the cron job ───────────────────────────────────────────────

SELECT cron.schedule(
  'flights-refresh-job',
  '*/30 * * * *',  -- every 30 minutes
  $cron$
    SELECT net.http_post(
      url := 'https://pjyjblllcllnqsjbvbfc.supabase.co/functions/v1/flights-refresh',
      headers := jsonb_build_object(
        'Authorization', private.tcp_cron_auth_header(),
        'Content-Type', 'application/json'
      )
    );
  $cron$
);

COMMIT;
