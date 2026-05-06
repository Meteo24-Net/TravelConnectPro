-- ============================================================================
-- Travel Connect Pro · Initial Schema Migration
-- ============================================================================
-- Multi-tenant SaaS for hotel digital signage. Every hotel-scoped table has a
-- hotel_id column and an RLS policy that isolates managers to their own hotel.
-- Edge Functions use the service_role key to bypass RLS for cross-hotel work.
-- Display screens (lobby/room TVs) read via signed URLs — no auth.users session.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
-- uuid-ossp · UUID generation for primary keys
-- postgis  · spatial queries for geofence verification
-- pg_cron  · scheduled jobs (slots reset, SLA monitor, content refresh)
-- pg_net   · async HTTP from triggers (used as fallback to Edge Functions)
-- pgcrypto · for digest() / hmac() in token signing
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 2. CORE TABLES (no foreign-key dependencies on each other)
-- ============================================================================

-- Hotels · the top-level tenant. Every other hotel-scoped row references this.
CREATE TABLE hotels (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name            TEXT         NOT NULL,
  short_code            TEXT         UNIQUE NOT NULL,                       -- 'rad-bat-001' for URL-safe references
  status                TEXT         NOT NULL DEFAULT 'trial'                -- 'trial' | 'active' | 'suspended'
                                       CHECK (status IN ('trial', 'active', 'suspended')),
  tier                  TEXT         NOT NULL DEFAULT 'basic'                -- 'basic' | 'premium' | 'enterprise'
                                       CHECK (tier IN ('basic', 'premium', 'enterprise')),

  -- Location (PostGIS) — drives geofence verification for Tier-2 QRs
  location              GEOGRAPHY(POINT, 4326),                              -- nullable until set
  geofence_radius_m     INT          NOT NULL DEFAULT 200,                   -- per-property override
  timezone              TEXT         NOT NULL DEFAULT 'UTC',                 -- 'Asia/Tbilisi'
  address               TEXT,
  city                  TEXT,
  country_code          TEXT,                                                -- ISO 3166-1 alpha-2

  -- Branding (white-label theme)
  theme_config          JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- colors, logo URL, fonts
  default_language      TEXT         NOT NULL DEFAULT 'en',
  supported_languages   TEXT[]       NOT NULL DEFAULT ARRAY['en'],

  -- Telegram fulfillment (one bot, per-hotel chat ids)
  telegram_bot_token    TEXT,                                                -- nullable, stored encrypted in Vault in production
  manager_chat_id       TEXT,                                                -- default fallback chat

  -- Operational metadata
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hotels IS 'Top-level tenant. Every hotel-scoped row references hotels.id via hotel_id.';
COMMENT ON COLUMN hotels.location IS 'GEOGRAPHY(POINT, 4326) — WGS84 lat/lng. Used by check_proximity() for Tier-2 verification.';
COMMENT ON COLUMN hotels.geofence_radius_m IS 'Per-property geofence radius. Urban: 50m, resort: 500m, default: 200m.';


-- Manager profiles · ties Supabase auth users to hotels with a role.
-- Used by every RLS policy to determine "which hotel can this user see?"
CREATE TABLE manager_profiles (
  user_id               UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  role                  TEXT         NOT NULL                                -- 'super_admin' | 'property_manager' | 'staff'
                                       CHECK (role IN ('super_admin', 'property_manager', 'staff')),
  display_name          TEXT,
  email                 TEXT,
  phone                 TEXT,                                                -- for SMS fallback
  telegram_user_id      TEXT,                                                -- for direct manager DMs
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE manager_profiles IS 'Links auth.users to a hotel. Used by all RLS policies via the helper function current_user_hotel_id().';
COMMENT ON COLUMN manager_profiles.role IS 'super_admin sees all hotels (bypassed via service_role). property_manager sees their hotel only. staff is reserved for v.2.';


-- ============================================================================
-- 3. RLS HELPER FUNCTION
-- ============================================================================
-- Returns the hotel_id of the calling user. Used by every RLS policy.
-- SECURITY DEFINER so it can read manager_profiles even when RLS is on.
-- search_path is pinned to public, pg_temp to defend against schema injection.
-- ============================================================================
CREATE OR REPLACE FUNCTION current_user_hotel_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT hotel_id
  FROM manager_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION current_user_hotel_id() IS 'Returns the hotel_id for the calling auth user. Used in every RLS policy.';


-- ============================================================================
-- 4. SCREENS · lobby and room TVs registered to each hotel
-- ============================================================================

CREATE TABLE screens (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  screen_type           TEXT         NOT NULL                                -- 'lobby_landscape' | 'lobby_portrait' | 'room_tv' | 'small_display'
                                       CHECK (screen_type IN ('lobby_landscape', 'lobby_portrait', 'room_tv', 'small_display')),
  display_name          TEXT         NOT NULL,                               -- 'Lobby Main', 'Room 412'
  room_number           TEXT,                                                -- only for screen_type = 'room_tv'

  -- Hardware metadata (powers the button_map and quirks system)
  vendor                TEXT,                                                -- 'samsung_tizen' | 'lg_webos' | 'android_tv' | 'generic_stb'
  model                 TEXT,
  resolution            TEXT,                                                -- '1920x1080'
  button_map            JSONB        NOT NULL DEFAULT '{"ok": "Enter", "up": "ArrowUp", "down": "ArrowDown"}'::jsonb,

  -- Heartbeat (updated every 30s by the screen)
  last_heartbeat_at     TIMESTAMPTZ,
  status                TEXT         NOT NULL DEFAULT 'pending'              -- 'pending' | 'online' | 'warning' | 'offline'
                                       CHECK (status IN ('pending', 'online', 'warning', 'offline')),

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- A hotel can have multiple lobby screens but only one TV per room
  UNIQUE (hotel_id, room_number)
);

COMMENT ON TABLE screens IS 'Every TV/display registered to a hotel. Heartbeat tracks online/offline.';


-- ============================================================================
-- 5. AIRPORTS · per-hotel list of airports for the flights carousel slide
-- ============================================================================

CREATE TABLE property_airports (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  iata_code             TEXT         NOT NULL,                               -- 'BUS', 'TBS'
  airport_name          TEXT         NOT NULL,
  drive_time_minutes    INT,                                                 -- to display in carousel
  display_order         INT          NOT NULL DEFAULT 0,
  enabled               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (hotel_id, iata_code)
);

COMMENT ON TABLE property_airports IS 'Multi-airport per hotel. Each adds a flights carousel slide.';


-- ============================================================================
-- 6. SHARED CACHES · global, not hotel-scoped
-- ============================================================================
-- These tables are read by Edge Functions across all properties.
-- Not RLS-protected. Service-role-only writes. Anon-key reads.
-- The shared cache pattern means 50 screens at one hotel = 1 API call,
-- not 50 calls. Multi-hotel cache hits compound the savings.
-- ============================================================================

CREATE TABLE weather_cache (
  hotel_id              UUID         PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  payload               JSONB        NOT NULL,                               -- full openweathermap response
  fetched_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL                                -- typically NOW() + 15 min
);

CREATE TABLE flights_cache (
  iata_code             TEXT         PRIMARY KEY,
  payload               JSONB        NOT NULL,                               -- arrivals/departures list
  fetched_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL                                -- typically NOW() + 5 min
);

CREATE TABLE sports_cache (
  cache_key             TEXT         PRIMARY KEY,                            -- 'epl', 'nba_today', etc.
  payload               JSONB        NOT NULL,
  payload_hash          TEXT         NOT NULL,                               -- SHA256 of payload — used for diff detection
  fetched_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL,
  has_live_match        BOOLEAN      NOT NULL DEFAULT FALSE                  -- when true, cron polls every 60s; otherwise 30min
);

CREATE TABLE currency_cache (
  base_currency         TEXT         PRIMARY KEY,                            -- 'USD'
  rates                 JSONB        NOT NULL,                               -- { 'GEL': 2.65, 'EUR': 0.92, ... }
  fetched_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL                                -- typically NOW() + 1h
);

CREATE TABLE ai_content (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         REFERENCES hotels(id) ON DELETE CASCADE, -- nullable: null = SuperAdmin global
  content_type          TEXT         NOT NULL                                -- 'ticker' | 'welcome' | 'insight'
                                       CHECK (content_type IN ('ticker', 'welcome', 'insight')),
  language              TEXT         NOT NULL DEFAULT 'en',
  payload               JSONB        NOT NULL,                               -- generated text + metadata
  generated_by          TEXT         NOT NULL                                -- 'claude-haiku-4' | 'claude-sonnet-4'
                                       CHECK (generated_by IN ('claude-haiku-4', 'claude-sonnet-4')),
  generated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL                                -- 1h for ticker, 24h for welcome, 1d for insight
);

COMMENT ON TABLE ai_content IS 'AI-generated content. ticker = Haiku hourly per-property. welcome = templates per timeofday/lang. insight = Sonnet daily per-property.';


-- ============================================================================
-- 7. CONFIG · master config blob per hotel (admin v.1.4 saves here)
-- ============================================================================
-- One row per hotel. The admin panel updates JSONB blocks.
-- Display apps read this via signed URL on boot, then subscribe to Realtime
-- changes for live updates without page reloads.
-- ============================================================================

CREATE TABLE property_configs (
  hotel_id              UUID         PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  ticker                JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- announcements, events, offers, sports flags
  carousel              JSONB        NOT NULL DEFAULT '{"sequence": []}'::jsonb,
  welcome               JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- highlight_offer per language
  media                 JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- bgm, corp video, cam
  games_enabled         JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- { roulette: true, neon_slots: true, ... }
  slot_config           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  verification          JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- pin rotation, geofence override
  fulfillment           JSONB        NOT NULL DEFAULT '{}'::jsonb,           -- auto threshold, telegram toggle
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by            UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE property_configs IS 'Master JSONB config per hotel. Admin writes; screens subscribe via Realtime.';


-- ============================================================================
-- 8. QR · two-tier QR system (open vs verified)
-- ============================================================================

CREATE TABLE qr_assets (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  qr_id                 TEXT         NOT NULL,                               -- 'wifi', 'menu', 'spa-upgrade'

  -- Tier-2 verification
  tier                  TEXT         NOT NULL DEFAULT 'open'                 -- 'open' | 'verified'
                                       CHECK (tier IN ('open', 'verified')),
  category              TEXT         NOT NULL                                -- 'wifi' | 'info' | 'social' | 'reward' | 'quest_node' | 'game_prize'
                                       CHECK (category IN ('wifi', 'info', 'social', 'reward', 'quest_node', 'game_prize')),

  -- Display
  label                 TEXT         NOT NULL,
  destination_url       TEXT         NOT NULL,
  enabled               BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Reward configuration (verified tier only)
  reward_title          TEXT,
  reward_value_gel      INT          DEFAULT 0,
  fulfillment_mode      TEXT                                                 -- 'auto' | 'approval'
                                       CHECK (fulfillment_mode IN ('auto', 'approval')),
  daily_cap             INT          DEFAULT 0,                              -- 0 = unlimited
  claimed_today         INT          NOT NULL DEFAULT 0,
  once_per_stay         BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Quest node specifics
  secret_code           TEXT,                                                -- physical code at the location

  -- Server-side QR generation
  qr_image_path         TEXT,                                                -- Supabase Storage path: /qr/{hotel_id}/{qr_id}.png
  qr_token              TEXT,                                                -- signed JWT, refreshed daily for static QRs
  qr_token_expires_at   TIMESTAMPTZ,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (hotel_id, qr_id)
);

COMMENT ON TABLE qr_assets IS 'Generalized QR system. tier=open is frictionless. tier=verified requires Proof of Proximity.';


-- Lobby PIN · the rotating fallback for verified QRs
-- One row per hotel (UPSERT via Edge Function on rotation)
CREATE TABLE lobby_pins (
  hotel_id              UUID         PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
  current_pin           TEXT         NOT NULL,                               -- '4729'
  previous_pin          TEXT,                                                -- still valid during grace overlap
  rotated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL,                               -- current_pin valid until this
  rotation_minutes      INT          NOT NULL DEFAULT 5,
  grace_seconds         INT          NOT NULL DEFAULT 15
);

COMMENT ON TABLE lobby_pins IS 'Rotating 4-digit PIN for proximity verification fallback. Broadcast to lobby TVs via Realtime.';


-- ============================================================================
-- 9. GUEST SESSIONS & SCANS (analytics)
-- ============================================================================
-- Anonymous: device_hash = SHA256(UA + day_salt + hotel_id). No PII.
-- Phone identity is opt-in for loyalty in v.2 (not in this migration).
-- ============================================================================

CREATE TABLE guest_sessions (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id               UUID         REFERENCES screens(id) ON DELETE SET NULL,
  device_hash           TEXT         NOT NULL,
  language              TEXT         DEFAULT 'en',

  -- Verification state
  verified              BOOLEAN      NOT NULL DEFAULT FALSE,
  verification_method   TEXT                                                 -- 'geofence' | 'lobby_pin'
                                       CHECK (verification_method IN ('geofence', 'lobby_pin')),
  verified_at           TIMESTAMPTZ,

  -- Quest progress (only used if hotel runs a quest)
  active_quest_id       UUID,                                                -- soft FK; quests table is v.2
  progress_pct          INT          NOT NULL DEFAULT 0
                                       CHECK (progress_pct BETWEEN 0 AND 100),

  -- Propensity score (recomputed by trigger on scan insert)
  propensity_score      DECIMAL(4,3) DEFAULT 0,                              -- 0.000 – 1.000
  explorer_score        DECIMAL(4,3) DEFAULT 0,
  transactor_score      DECIMAL(4,3) DEFAULT 0,

  -- Lifecycle
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_activity_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

COMMENT ON TABLE guest_sessions IS 'Anonymous session per device per hotel. No PII collected. Identity opt-in for loyalty in v.2.';


-- Scans log · every QR scan, one row. Source of all analytics.
CREATE TABLE scans (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  session_id            UUID         REFERENCES guest_sessions(id) ON DELETE SET NULL,
  qr_asset_id           UUID         REFERENCES qr_assets(id) ON DELETE SET NULL,
  client_ip             INET,
  user_agent            TEXT,
  was_verified          BOOLEAN      NOT NULL DEFAULT FALSE,                 -- did this scan satisfy verification?
  scanned_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- Verification attempts · log every Tier-2 attempt for fraud analytics
CREATE TABLE verification_attempts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  qr_asset_id           UUID         REFERENCES qr_assets(id) ON DELETE SET NULL,
  device_hash           TEXT,
  method                TEXT         NOT NULL                                -- 'geofence' | 'lobby_pin'
                                       CHECK (method IN ('geofence', 'lobby_pin')),
  -- Geofence specifics
  guest_lat             DOUBLE PRECISION,
  guest_lng             DOUBLE PRECISION,
  accuracy_m            DOUBLE PRECISION,                                    -- browser-reported accuracy
  distance_to_hotel_m   DOUBLE PRECISION,
  -- PIN specifics
  pin_entered           TEXT,
  -- Outcome
  result                TEXT         NOT NULL                                -- 'success' | 'denied' | 'fail_distance' | 'fail_pin' | 'fail_accuracy'
                                       CHECK (result IN ('success', 'denied', 'fail_distance', 'fail_pin', 'fail_accuracy')),
  attempted_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE verification_attempts IS 'Audit log for every Tier-2 verification attempt. Used for fraud analytics and support debugging.';


-- ============================================================================
-- 10. SERVICE REQUESTS · the Telegram automation pipeline
-- ============================================================================

CREATE TABLE service_channels (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  channel_id            TEXT         NOT NULL,                               -- 'housekeeping', 'front_desk', 'spa'
  name                  TEXT         NOT NULL,                               -- 'Housekeeping'
  telegram_chat_id      TEXT,                                                -- '@radbat_housekeeping' or numeric chat ID
  email_fallback        TEXT,
  sms_fallback          TEXT,                                                -- E.164 phone
  manager_name          TEXT,
  enabled               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (hotel_id, channel_id)
);


CREATE TABLE service_catalog (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  service_id            TEXT         NOT NULL,                               -- 'clean-room', 'late-checkout'
  emoji                 TEXT,
  name                  TEXT         NOT NULL,
  channel_id            TEXT         NOT NULL,                               -- soft FK to service_channels.channel_id
  priority              TEXT         NOT NULL DEFAULT 'low'                  -- 'low' | 'medium' | 'high'
                                       CHECK (priority IN ('low', 'medium', 'high')),
  sla_minutes           INT          NOT NULL DEFAULT 30,
  auto_route            BOOLEAN      NOT NULL DEFAULT TRUE,
  enabled               BOOLEAN      NOT NULL DEFAULT TRUE,
  locked_by_super_admin BOOLEAN      NOT NULL DEFAULT FALSE,                 -- pricing tier gate
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (hotel_id, service_id)
);


CREATE TABLE service_requests (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  service_id            TEXT         NOT NULL,                               -- soft FK to service_catalog.service_id
  room_number           TEXT,
  session_id            UUID         REFERENCES guest_sessions(id) ON DELETE SET NULL,
  device_hash           TEXT,
  notes                 TEXT,                                                -- guest's optional message

  -- Status workflow
  status                TEXT         NOT NULL DEFAULT 'pending'              -- 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled'
                                       CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled')),
  acknowledged_at       TIMESTAMPTZ,
  acknowledged_by       UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  in_progress_at        TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,

  -- Telegram tracking
  telegram_message_id   TEXT,                                                -- for editing the message on status change
  telegram_chat_id      TEXT,
  notification_attempts JSONB        NOT NULL DEFAULT '[]'::jsonb,           -- [{channel: 'telegram', sent_at, success}]

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE service_requests IS 'Every guest service request. Telegram is primary, with email/SMS fallback chain.';


CREATE TABLE sla_breaches (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  request_id            UUID         NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  breached_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  escalation_level      INT          NOT NULL DEFAULT 1,                     -- 1=email, 2=SMS, 3=duty manager
  notified_via          TEXT[]
);


-- ============================================================================
-- 11. FULFILLMENT · approval queue for high-value rewards
-- ============================================================================

CREATE TABLE fulfillment_approvals (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  qr_asset_id           UUID         REFERENCES qr_assets(id) ON DELETE SET NULL,
  session_id            UUID         REFERENCES guest_sessions(id) ON DELETE SET NULL,
  reward_title          TEXT         NOT NULL,
  reward_value_gel      INT,

  status                TEXT         NOT NULL DEFAULT 'pending'              -- 'pending' | 'approved' | 'rejected'
                                       CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by            UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at            TIMESTAMPTZ,
  decision_notes        TEXT,

  -- Telegram tracking (same approval may surface there)
  telegram_message_id   TEXT,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 12. GAMES · slot machine state (other games are stateless client-only)
-- ============================================================================

CREATE TABLE slot_balances (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  device_hash           TEXT         NOT NULL,
  room_number           TEXT,
  coins                 INT          NOT NULL DEFAULT 0,
  free_spins            INT          NOT NULL DEFAULT 0,

  -- Reset bookkeeping (supports both daily_midnight and stay_based modes)
  first_seen_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_topup_date       DATE,                                                -- last calendar date a top-up was applied
  last_activity_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Stats
  total_spins           INT          NOT NULL DEFAULT 0,
  total_jackpots        INT          NOT NULL DEFAULT 0,

  UNIQUE (hotel_id, device_hash)
);


CREATE TABLE slot_spins (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  device_hash           TEXT         NOT NULL,
  room_number           TEXT,
  result                TEXT         NOT NULL                                -- 'jackpot' | 'free_spins' | 'loss'
                                       CHECK (result IN ('jackpot', 'free_spins', 'loss')),
  was_free_spin         BOOLEAN      NOT NULL DEFAULT FALSE,
  spun_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- Daily property-level slot stats. Aggregated for live HUD display.
-- Updated by trigger on slot_spins insert.
CREATE TABLE slot_property_stats (
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  stat_date             DATE         NOT NULL,                               -- YYYY-MM-DD in property timezone
  spins_today           INT          NOT NULL DEFAULT 0,
  jackpots_today        INT          NOT NULL DEFAULT 0,                     -- enforces daily cap
  active_rooms          INT          NOT NULL DEFAULT 0,                     -- distinct rooms in last hour
  PRIMARY KEY (hotel_id, stat_date)
);


-- ============================================================================
-- 13. MESSAGES · internal admin↔manager comms (admin v.1.1 feature)
-- ============================================================================

CREATE TABLE admin_messages (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  from_role             TEXT         NOT NULL                                -- 'super_admin' | 'property_manager'
                                       CHECK (from_role IN ('super_admin', 'property_manager')),
  from_user_id          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  subject               TEXT         NOT NULL,
  body                  TEXT         NOT NULL,
  category              TEXT         NOT NULL DEFAULT 'general'              -- 'general' | 'feature' | 'bug' | 'billing' | 'alert'
                                       CHECK (category IN ('general', 'feature', 'bug', 'billing', 'alert')),
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 14. ALERTS · emergency broadcast (e.g., evacuation) overlaying every screen
-- ============================================================================

CREATE TABLE alerts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  severity              TEXT         NOT NULL                                -- 'info' | 'warning' | 'critical'
                                       CHECK (severity IN ('info', 'warning', 'critical')),
  message               TEXT         NOT NULL,
  active                BOOLEAN      NOT NULL DEFAULT TRUE,
  expires_at            TIMESTAMPTZ,                                         -- nullable; null = until manually cleared
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by            UUID         REFERENCES auth.users(id) ON DELETE SET NULL
);


-- ============================================================================
-- 15. LIVE EVENTS · sports goal popups, etc. — Realtime broadcast triggers
-- ============================================================================

CREATE TABLE live_events (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID         REFERENCES hotels(id) ON DELETE CASCADE, -- nullable: null = global event
  event_type            TEXT         NOT NULL,                               -- 'goal_scored', 'match_started'
  payload               JSONB        NOT NULL,                               -- { home: 'Liverpool', away: 'Man Utd', score: '2-1', scorer: '...' }
  display_until         TIMESTAMPTZ  NOT NULL,                               -- event auto-dismisses
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 16. INDEXES · all the indexes that matter at scale
-- ============================================================================

-- PostGIS spatial index — critical for fast geofence checks
CREATE INDEX idx_hotels_location ON hotels USING GIST (location);

-- Tenancy lookups
CREATE INDEX idx_screens_hotel_status        ON screens (hotel_id, status);
CREATE INDEX idx_screens_heartbeat           ON screens (last_heartbeat_at) WHERE status IN ('online', 'warning');
CREATE INDEX idx_property_airports_hotel     ON property_airports (hotel_id, display_order) WHERE enabled = TRUE;

-- Cache expiry sweeping
CREATE INDEX idx_weather_cache_expires       ON weather_cache (expires_at);
CREATE INDEX idx_flights_cache_expires       ON flights_cache (expires_at);
CREATE INDEX idx_sports_cache_live           ON sports_cache (has_live_match, expires_at);
CREATE INDEX idx_currency_cache_expires      ON currency_cache (expires_at);
CREATE INDEX idx_ai_content_lookup           ON ai_content (hotel_id, content_type, language, expires_at);

-- QR + verification hot paths
CREATE INDEX idx_qr_assets_lookup            ON qr_assets (hotel_id, qr_id) WHERE enabled = TRUE;
CREATE INDEX idx_qr_assets_token             ON qr_assets (qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX idx_lobby_pins_expires          ON lobby_pins (expires_at);

-- Analytics queries
CREATE INDEX idx_scans_hotel_date            ON scans (hotel_id, scanned_at DESC);
CREATE INDEX idx_scans_session               ON scans (session_id, scanned_at DESC);
CREATE INDEX idx_scans_qr                    ON scans (qr_asset_id, scanned_at DESC);
CREATE INDEX idx_sessions_device             ON guest_sessions (hotel_id, device_hash);
CREATE INDEX idx_sessions_active             ON guest_sessions (hotel_id, last_activity_at DESC);
CREATE INDEX idx_verification_attempts_hotel ON verification_attempts (hotel_id, attempted_at DESC);

-- Service requests dashboard
CREATE INDEX idx_service_requests_hotel_status ON service_requests (hotel_id, status, created_at DESC);
CREATE INDEX idx_service_requests_pending      ON service_requests (hotel_id, created_at) WHERE status IN ('pending', 'acknowledged');
CREATE INDEX idx_service_channels_hotel        ON service_channels (hotel_id) WHERE enabled = TRUE;
CREATE INDEX idx_service_catalog_hotel         ON service_catalog (hotel_id) WHERE enabled = TRUE;
CREATE INDEX idx_sla_breaches_request          ON sla_breaches (request_id, breached_at);

-- Fulfillment queue
CREATE INDEX idx_fulfillment_pending         ON fulfillment_approvals (hotel_id, created_at) WHERE status = 'pending';

-- Slot games
CREATE INDEX idx_slot_balances_lookup        ON slot_balances (hotel_id, device_hash);
CREATE INDEX idx_slot_spins_hotel_date       ON slot_spins (hotel_id, spun_at DESC);
CREATE INDEX idx_slot_stats_today            ON slot_property_stats (hotel_id, stat_date DESC);

-- Messages inbox
CREATE INDEX idx_admin_messages_hotel        ON admin_messages (hotel_id, created_at DESC);
CREATE INDEX idx_admin_messages_unread       ON admin_messages (hotel_id, created_at DESC) WHERE read_at IS NULL;

-- Active alerts (the screen polls for these on every tick)
CREATE INDEX idx_alerts_active               ON alerts (hotel_id) WHERE active = TRUE;

-- Live events
CREATE INDEX idx_live_events_active          ON live_events (hotel_id, display_until) WHERE display_until > NOW();


-- ============================================================================
-- 17. ENABLE ROW LEVEL SECURITY · on EVERY hotel-scoped table
-- ============================================================================

ALTER TABLE hotels                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_airports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_assets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_pins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breaches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_spins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_property_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events             ENABLE ROW LEVEL SECURITY;

-- Shared caches: NOT RLS-protected. Service-role-only writes via Edge Functions.
-- The anon key reads them via signed URLs; no manager isolation needed.


-- ============================================================================
-- 18. RLS POLICIES · single template applied to every hotel-scoped table
-- ============================================================================
-- Pattern: hotel_id = current_user_hotel_id()
-- Edge Functions use service_role and bypass RLS for cross-hotel work.
-- ============================================================================

-- Hotels: managers see only their own hotel
CREATE POLICY hotels_isolation ON hotels FOR SELECT
  USING (id = current_user_hotel_id());
CREATE POLICY hotels_update ON hotels FOR UPDATE
  USING (id = current_user_hotel_id());

-- Manager profiles: a user sees only their own row
CREATE POLICY manager_profiles_self ON manager_profiles FOR SELECT
  USING (user_id = auth.uid());

-- All other hotel-scoped tables: full CRUD when hotel_id matches
CREATE POLICY screens_isolation              ON screens               FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY property_airports_isolation    ON property_airports     FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY property_configs_isolation     ON property_configs      FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY qr_assets_isolation            ON qr_assets             FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY lobby_pins_isolation           ON lobby_pins            FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY guest_sessions_isolation       ON guest_sessions        FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY scans_isolation                ON scans                 FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY verification_attempts_isolation ON verification_attempts FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY service_channels_isolation     ON service_channels      FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY service_catalog_isolation      ON service_catalog       FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY service_requests_isolation     ON service_requests      FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY sla_breaches_isolation         ON sla_breaches          FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY fulfillment_approvals_isolation ON fulfillment_approvals FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY slot_balances_isolation        ON slot_balances         FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY slot_spins_isolation           ON slot_spins            FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY slot_property_stats_isolation  ON slot_property_stats   FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY admin_messages_isolation       ON admin_messages        FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY alerts_isolation               ON alerts                FOR ALL USING (hotel_id = current_user_hotel_id());
CREATE POLICY live_events_isolation          ON live_events           FOR ALL USING (hotel_id = current_user_hotel_id() OR hotel_id IS NULL);


-- ============================================================================
-- 19. CORE RPCs · functions Edge Functions call instead of raw SQL
-- ============================================================================

-- Geofence proximity check. Called by verify-proximity Edge Function.
-- SECURITY DEFINER + pinned search_path is the correct hardening pattern.
CREATE OR REPLACE FUNCTION check_proximity(
  p_hotel_id      UUID,
  p_guest_lat     DOUBLE PRECISION,
  p_guest_lng     DOUBLE PRECISION,
  p_accuracy_m    DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  is_within       BOOLEAN,
  distance_m      DOUBLE PRECISION,
  hotel_radius_m  INT,
  accuracy_ok     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_hotel_loc       GEOGRAPHY;
  v_radius_m        INT;
  v_distance_m      DOUBLE PRECISION;
  v_accuracy_ok     BOOLEAN;
BEGIN
  -- Fetch hotel location and radius
  SELECT location, geofence_radius_m
  INTO v_hotel_loc, v_radius_m
  FROM hotels
  WHERE id = p_hotel_id;

  -- No location set means we cannot verify
  IF v_hotel_loc IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::DOUBLE PRECISION, v_radius_m, FALSE;
    RETURN;
  END IF;

  -- Compute distance using geography (spherical math)
  v_distance_m := ST_Distance(
    v_hotel_loc,
    ST_SetSRID(ST_MakePoint(p_guest_lng, p_guest_lat), 4326)::geography
  );

  -- Reject GPS readings whose accuracy is worse than the radius
  -- (a 300m-accurate fix on a 200m geofence is unreliable)
  v_accuracy_ok := (p_accuracy_m IS NULL OR p_accuracy_m <= v_radius_m);

  RETURN QUERY SELECT
    (v_distance_m <= v_radius_m AND v_accuracy_ok),
    v_distance_m,
    v_radius_m,
    v_accuracy_ok;
END;
$$;

COMMENT ON FUNCTION check_proximity IS 'Geofence verification. Returns is_within, computed distance, hotel radius, and whether GPS accuracy was acceptable.';


-- Verify a submitted lobby PIN against the active PIN with grace overlap.
-- Returns true if the PIN matches the current OR previous PIN within grace.
CREATE OR REPLACE FUNCTION check_lobby_pin(
  p_hotel_id      UUID,
  p_pin           TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_current_pin   TEXT;
  v_previous_pin  TEXT;
  v_rotated_at    TIMESTAMPTZ;
  v_grace_seconds INT;
BEGIN
  SELECT current_pin, previous_pin, rotated_at, grace_seconds
  INTO v_current_pin, v_previous_pin, v_rotated_at, v_grace_seconds
  FROM lobby_pins
  WHERE hotel_id = p_hotel_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Current PIN always valid
  IF p_pin = v_current_pin THEN
    RETURN TRUE;
  END IF;

  -- Previous PIN valid for `grace_seconds` after rotation
  IF p_pin = v_previous_pin
     AND v_previous_pin IS NOT NULL
     AND NOW() < v_rotated_at + (v_grace_seconds || ' seconds')::INTERVAL THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION check_lobby_pin IS 'Validates a submitted PIN against current or previous (within grace overlap).';


-- ============================================================================
-- 20. TRIGGERS · automatic bookkeeping
-- ============================================================================

-- updated_at autotouch
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hotels_updated_at         BEFORE UPDATE ON hotels         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_property_configs_updated_at BEFORE UPDATE ON property_configs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_qr_assets_updated_at      BEFORE UPDATE ON qr_assets      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- Update guest_sessions.last_activity_at on every scan
CREATE OR REPLACE FUNCTION touch_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE guest_sessions
    SET last_activity_at = NOW(),
        expires_at = NOW() + INTERVAL '24 hours'
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_scans_touch_session AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION touch_session_activity();


-- Auto-disable QR when daily cap hit (Tier-2 only)
CREATE OR REPLACE FUNCTION enforce_qr_daily_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.daily_cap > 0 AND NEW.claimed_today >= NEW.daily_cap THEN
    -- Note: we don't disable the QR here; we let the verify Edge Function
    -- check claimed_today < daily_cap before granting. This trigger is a
    -- safety net that flags exhausted rewards in admin views.
    NEW.claimed_today := NEW.daily_cap;  -- prevent overshoot
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qr_cap BEFORE UPDATE OF claimed_today ON qr_assets
  FOR EACH ROW EXECUTE FUNCTION enforce_qr_daily_cap();


-- Update slot_property_stats on every slot spin
CREATE OR REPLACE FUNCTION update_slot_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_today DATE;
  v_tz TEXT;
BEGIN
  SELECT timezone INTO v_tz FROM hotels WHERE id = NEW.hotel_id;
  v_today := (NOW() AT TIME ZONE COALESCE(v_tz, 'UTC'))::DATE;

  INSERT INTO slot_property_stats (hotel_id, stat_date, spins_today, jackpots_today, active_rooms)
  VALUES (
    NEW.hotel_id,
    v_today,
    1,
    CASE WHEN NEW.result = 'jackpot' THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (hotel_id, stat_date) DO UPDATE SET
    spins_today = slot_property_stats.spins_today + 1,
    jackpots_today = slot_property_stats.jackpots_today + CASE WHEN NEW.result = 'jackpot' THEN 1 ELSE 0 END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_slot_spins_stats AFTER INSERT ON slot_spins
  FOR EACH ROW EXECUTE FUNCTION update_slot_stats();


-- ============================================================================
-- 21. SEED A DEMO HOTEL (for development; remove in production migration)
-- ============================================================================
-- This lets the admin UI work against a real database immediately. Comment out
-- or remove this block when running against production.
-- ============================================================================

INSERT INTO hotels (id, brand_name, short_code, status, tier, location, geofence_radius_m, timezone, address, city, country_code, default_language, supported_languages)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Radisson Blu Batumi',
  'rad-bat-001',
  'active',
  'premium',
  ST_SetSRID(ST_MakePoint(41.6464, 41.6168), 4326)::geography,  -- Batumi seafront
  200,
  'Asia/Tbilisi',
  '1 Ninoshvili Street',
  'Batumi',
  'GE',
  'en',
  ARRAY['en', 'ka', 'ru', 'tr']
)
ON CONFLICT (short_code) DO NOTHING;


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Apply with: supabase db reset (local) or supabase db push (remote)
-- ============================================================================
