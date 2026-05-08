-- ============================================================================
-- Travel Connect Pro · Migration 4: display_infrastructure
-- ============================================================================
-- Adds:
--   hotels.map_config         JSONB — multi-provider map configuration
--   hotels.integration_keys   JSONB — all API keys (SuperAdmin only, RLS)
--   screens.screen_orientation TEXT  — landscape | portrait | square
--   screens.screen_size        TEXT  — standard | desk_pad | large
--   game_sessions              TABLE — stats for non-slots games
--   qr_assets.show_in_sidebar  BOOL  — appears in right-column QR carousel
--   qr_assets.sidebar_label    TEXT  — short label for compact carousel
--   qr_assets.sidebar_order    INT   — carousel position
-- ============================================================================

BEGIN;

-- ── 1. Map configuration per hotel ──────────────────────────────────────────
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS map_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hotels.map_config IS
  'Multi-provider map config. Schema:
   {
     "primary_provider":  "mapbox" | "tomtom" | "maplibre_osm",
     "fallback_provider": "maplibre_osm",
     "show_traffic":      true,
     "default_zoom":      13,
     "center":            [lon, lat]
   }
   API keys are stored separately in integration_keys — never here.';

-- ── 2. Integration API keys (SuperAdmin only) ────────────────────────────────
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS integration_keys JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN hotels.integration_keys IS
  'Encrypted at rest. RLS: super_admin role only. Never exposed to display app.
   Schema:
   {
     "mapbox_token":      "pk.xxx",   -- URL-restricted, safe to pass to client
     "tomtom_key":        "xxx",      -- server-side only
     "sports_api_key":    "xxx",      -- API-Sports.io, server-side only
     "aviation_key":      "xxx",      -- AviationStack, server-side only
     "openweather_key":   "xxx",      -- optional override of Open-Meteo free
     "exchange_rate_key": "xxx"       -- optional NBG API key
   }';

-- ── 3. Screen orientation and size ──────────────────────────────────────────
ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS screen_orientation TEXT NOT NULL DEFAULT 'landscape'
    CHECK (screen_orientation IN ('landscape', 'portrait', 'square'));

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS screen_size TEXT NOT NULL DEFAULT 'standard'
    CHECK (screen_size IN ('standard', 'desk_pad', 'large'));

COMMENT ON COLUMN screens.screen_orientation IS
  'landscape = 16:9 or wider. portrait = 9:16. square = 1:1 or similar.
   display-config passes this to the TV which selects the correct layout component.';

COMMENT ON COLUMN screens.screen_size IS
  'standard = typical lobby/room TV. desk_pad = small reception tablet.
   large = wide-format corridor display.';

-- ── 4. Game sessions (non-slots games) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  game_id          TEXT        NOT NULL,           -- 'dice' | 'roulette' | 'memory' | 'shell'
  screen_id        UUID        REFERENCES screens(id) ON DELETE SET NULL,
  device_hash      TEXT,                           -- SHA-256, no PII
  room_number      TEXT,
  result           JSONB       NOT NULL DEFAULT '{}',  -- game-specific outcome
  reward_triggered BOOLEAN     NOT NULL DEFAULT FALSE,
  reward_claimed   BOOLEAN     NOT NULL DEFAULT FALSE,
  reward_qr_id     TEXT,                           -- links to qr_assets.qr_id if reward given
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_hotel_game
  ON game_sessions (hotel_id, game_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_rewards
  ON game_sessions (hotel_id, reward_triggered, reward_claimed)
  WHERE reward_triggered = TRUE;

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY game_sessions_hotel_isolation
  ON game_sessions FOR ALL
  USING (hotel_id = current_user_hotel_id())
  WITH CHECK (hotel_id = current_user_hotel_id());

COMMENT ON TABLE game_sessions IS
  'One row per game play for non-slots games (dice, roulette, memory, shell).
   Neon Slots uses slot_spins + slot_balances instead.
   Used for: popularity analytics, reward auditing, guest behaviour analysis.';

-- ── 5. QR sidebar carousel flags ────────────────────────────────────────────
ALTER TABLE qr_assets
  ADD COLUMN IF NOT EXISTS show_in_sidebar  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE qr_assets
  ADD COLUMN IF NOT EXISTS sidebar_label    TEXT;

ALTER TABLE qr_assets
  ADD COLUMN IF NOT EXISTS sidebar_order    INT NOT NULL DEFAULT 99;

COMMENT ON COLUMN qr_assets.show_in_sidebar IS
  'TRUE = appears in the right-column QR carousel on lobby/room TV.
   WiFi QR is always first regardless of this flag (set by category = wifi).
   Admin can add late-checkout, menu, spa, taxi-booking QRs here.';

COMMENT ON COLUMN qr_assets.sidebar_label IS
  'Short label shown above the QR in the compact sidebar carousel.
   E.g. "GUEST WI-FI", "LATE CHECKOUT", "ROOM SERVICE".
   Falls back to qr_assets.label if null.';

CREATE INDEX IF NOT EXISTS idx_qr_assets_sidebar
  ON qr_assets (hotel_id, sidebar_order)
  WHERE show_in_sidebar = TRUE AND enabled = TRUE;

-- ── 6. Seed: mark WiFi QR for sidebar (if it exists) ────────────────────────
UPDATE qr_assets
SET
  show_in_sidebar = TRUE,
  sidebar_label   = 'GUEST WI-FI',
  sidebar_order   = 1
WHERE
  hotel_id = 'a1b2c3d4-0000-0000-0000-000000000001'
  AND category = 'wifi';

-- ── 7. Verify ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'hotels'
      AND column_name  = 'map_config'
  ) THEN
    RAISE EXCEPTION 'Migration 4 failed: map_config not added to hotels';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'game_sessions'
  ) THEN
    RAISE EXCEPTION 'Migration 4 failed: game_sessions table not created';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION 4
-- ============================================================================
