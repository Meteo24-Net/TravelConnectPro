-- ============================================================================
-- Travel Connect Pro · Migration 3: service_request_v2
-- ============================================================================
-- Adds: priority column to service_requests (inherited from service_catalog
--       at insert time by Edge Function — client never sets this directly).
--       Also adds: telegram_notification_sent_at for idempotency tracking.
--       Adds: idx_service_requests_pending partial index for SLA monitoring.
--
-- Why priority on service_requests?
--   service_catalog.priority is the catalog-level default. The Edge Function
--   may escalate to 'urgent' based on repeat-request logic (server-driven).
--   Having it denormalised on the request row means the SLA monitor pg_cron
--   job can ORDER BY priority without a join.
-- ============================================================================

BEGIN;

-- ── 1. Add priority to service_requests ─────────────────────────────────────
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN service_requests.priority IS
  'Server-set at insert time by Edge Function (derived from service_catalog + repeat logic). '
  'Client never sends this. Possible values: low | normal | high | urgent.';

-- ── 2. Add Telegram idempotency column ───────────────────────────────────────
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS telegram_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN service_requests.telegram_sent_at IS
  'Set after a Telegram notification is successfully sent. Prevents double-send on retry.';

-- ── 3. Add index for SLA monitor (pending + priority + created_at) ───────────
CREATE INDEX IF NOT EXISTS idx_service_requests_sla_monitor
  ON service_requests (hotel_id, priority, created_at)
  WHERE status IN ('pending', 'acknowledged');

COMMENT ON INDEX idx_service_requests_sla_monitor IS
  'Used by pg_cron SLA breach scanner — filters only active requests by priority age.';

-- ── 4. Verify ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'service_requests'
      AND column_name  = 'priority'
  ) THEN
    RAISE EXCEPTION 'Migration failed: priority column not added to service_requests';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
