-- ============================================================================
-- Travel Connect Pro · Schema Test Suite
-- ============================================================================
-- Exercises the migrated schema using pgTAP. Verifies tables, columns,
-- RLS policies, RPCs, triggers, and tenancy isolation.
--
-- HOW TO RUN
-- ----------
-- Locally:
--   1. supabase db reset                      (apply migration on fresh DB)
--   2. supabase test db tests/schema_test.sql  (runs this file via pgTAP)
--
-- Remote (against staging):
--   psql "$STAGING_DATABASE_URL" -f tests/schema_test.sql
--
-- The pgTAP extension is pre-installed in Supabase. We enable it here for
-- local clarity. Each plan() / ok() / is() call produces TAP output.
-- ============================================================================

BEGIN;

-- pgTAP harness
CREATE EXTENSION IF NOT EXISTS pgtap;

-- We have ~95 assertions across the file
SELECT plan(91);


-- ============================================================================
-- 1. EXTENSIONS · everything the migration tried to enable is actually there
-- ============================================================================

SELECT has_extension('uuid-ossp', 'uuid-ossp must be installed');
SELECT has_extension('postgis',   'postgis must be installed');
SELECT has_extension('pg_cron',   'pg_cron must be installed');
SELECT has_extension('pg_net',    'pg_net must be installed');
SELECT has_extension('pgcrypto',  'pgcrypto must be installed');


-- ============================================================================
-- 2. TABLES EXIST · every table the migration declared
-- ============================================================================

SELECT has_table('public', 'hotels',                  'hotels table exists');
SELECT has_table('public', 'manager_profiles',        'manager_profiles table exists');
SELECT has_table('public', 'screens',                 'screens table exists');
SELECT has_table('public', 'property_airports',       'property_airports table exists');
SELECT has_table('public', 'property_configs',        'property_configs table exists');
SELECT has_table('public', 'qr_assets',               'qr_assets table exists');
SELECT has_table('public', 'lobby_pins',              'lobby_pins table exists');
SELECT has_table('public', 'guest_sessions',          'guest_sessions table exists');
SELECT has_table('public', 'scans',                   'scans table exists');
SELECT has_table('public', 'verification_attempts',   'verification_attempts table exists');
SELECT has_table('public', 'service_channels',        'service_channels table exists');
SELECT has_table('public', 'service_catalog',         'service_catalog table exists');
SELECT has_table('public', 'service_requests',        'service_requests table exists');
SELECT has_table('public', 'sla_breaches',            'sla_breaches table exists');
SELECT has_table('public', 'fulfillment_approvals',   'fulfillment_approvals table exists');
SELECT has_table('public', 'slot_balances',           'slot_balances table exists');
SELECT has_table('public', 'slot_spins',              'slot_spins table exists');
SELECT has_table('public', 'slot_property_stats',     'slot_property_stats table exists');
SELECT has_table('public', 'admin_messages',          'admin_messages table exists');
SELECT has_table('public', 'alerts',                  'alerts table exists');
SELECT has_table('public', 'live_events',             'live_events table exists');


-- ============================================================================
-- 3. POSTGIS · location column is geography(POINT, 4326), GIST index exists
-- ============================================================================

SELECT col_type_is('public', 'hotels', 'location', 'geography(Point,4326)',
  'hotels.location is GEOGRAPHY(POINT, 4326)');

SELECT has_index('public', 'hotels', 'idx_hotels_location',
  'GIST index idx_hotels_location exists on hotels.location');


-- ============================================================================
-- 4. RLS · enabled on every hotel-scoped table
-- ============================================================================

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'hotels'),
  'RLS enabled on hotels');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'manager_profiles'),
  'RLS enabled on manager_profiles');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'qr_assets'),
  'RLS enabled on qr_assets');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'guest_sessions'),
  'RLS enabled on guest_sessions');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'scans'),
  'RLS enabled on scans');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'service_requests'),
  'RLS enabled on service_requests');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname = 'slot_spins'),
  'RLS enabled on slot_spins');

-- Shared caches must NOT have RLS — they're service-role-only writes
SELECT ok(NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'weather_cache'),
  'RLS deliberately OFF on weather_cache (shared cache)');
SELECT ok(NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'sports_cache'),
  'RLS deliberately OFF on sports_cache (shared cache)');


-- ============================================================================
-- 5. RPCs · the two functions Edge Functions will call
-- ============================================================================

SELECT has_function('public', 'current_user_hotel_id',
  'current_user_hotel_id() RPC exists');

SELECT has_function('public', 'check_proximity',
  ARRAY['uuid', 'double precision', 'double precision', 'double precision'],
  'check_proximity(uuid, lat, lng, accuracy) RPC exists');

SELECT has_function('public', 'check_lobby_pin',
  ARRAY['uuid', 'text'],
  'check_lobby_pin(uuid, text) RPC exists');

-- Search path hardening — we pinned search_path on SECURITY DEFINER functions
SELECT ok(
  (SELECT proconfig::text FROM pg_proc WHERE proname = 'check_proximity')
  LIKE '%search_path=public, pg_temp%',
  'check_proximity has pinned search_path (security defender)'
);
SELECT ok(
  (SELECT proconfig::text FROM pg_proc WHERE proname = 'check_lobby_pin')
  LIKE '%search_path=public, pg_temp%',
  'check_lobby_pin has pinned search_path'
);
SELECT ok(
  (SELECT proconfig::text FROM pg_proc WHERE proname = 'current_user_hotel_id')
  LIKE '%search_path=public, pg_temp%',
  'current_user_hotel_id has pinned search_path'
);


-- ============================================================================
-- 6. SEED · the demo hotel was inserted
-- ============================================================================

SELECT is(
  (SELECT brand_name FROM hotels WHERE short_code = 'rad-bat-001'),
  'Radisson Blu Batumi',
  'Demo hotel rad-bat-001 was seeded'
);

SELECT is(
  (SELECT timezone FROM hotels WHERE short_code = 'rad-bat-001'),
  'Asia/Tbilisi',
  'Demo hotel timezone is Asia/Tbilisi'
);

SELECT is(
  (SELECT geofence_radius_m FROM hotels WHERE short_code = 'rad-bat-001'),
  200,
  'Demo hotel geofence radius defaults to 200m'
);

SELECT ok(
  (SELECT location IS NOT NULL FROM hotels WHERE short_code = 'rad-bat-001'),
  'Demo hotel has a location set'
);


-- ============================================================================
-- 7. PROXIMITY RPC · functional test of geofence math
-- ============================================================================

-- Set up a test hotel with known coordinates (Tbilisi center)
INSERT INTO hotels (id, brand_name, short_code, status, location, geofence_radius_m)
VALUES (
  '99999999-0000-0000-0000-000000000001',
  'Test Hotel Tbilisi',
  'test-tbs-001',
  'active',
  ST_SetSRID(ST_MakePoint(44.7866, 41.7151), 4326)::geography,
  200
)
ON CONFLICT (short_code) DO UPDATE SET
  location = EXCLUDED.location,
  geofence_radius_m = EXCLUDED.geofence_radius_m;

-- A: guest at the exact same coordinates → within geofence
SELECT ok(
  (SELECT is_within FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.7151, 44.7866, 10.0
  )),
  'Guest at hotel coords (accuracy 10m) verifies as within geofence'
);

-- B: guest 50m away → still within 200m geofence
-- (~0.00045 deg latitude ≈ 50m)
SELECT ok(
  (SELECT is_within FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.71555, 44.7866, 15.0
  )),
  'Guest 50m away (accuracy 15m) verifies as within 200m geofence'
);

-- C: guest 1km away → outside geofence
-- (~0.009 deg latitude ≈ 1000m)
SELECT ok(
  NOT (SELECT is_within FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.7241, 44.7866, 20.0
  )),
  'Guest 1km away rejected (outside 200m geofence)'
);

-- D: distance is computed and returned correctly
SELECT ok(
  (SELECT distance_m FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.71555, 44.7866, 15.0
  )) BETWEEN 40 AND 60,
  'Distance computation correct (50m guest reads as 40-60m)'
);

-- E: GPS accuracy worse than geofence radius → rejected for unreliability
-- Even when standing on top of the hotel, a 300m-accurate fix should fail
SELECT ok(
  NOT (SELECT is_within FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.7151, 44.7866, 300.0
  )),
  'GPS accuracy worse than radius rejected (anti-fraud)'
);

SELECT ok(
  NOT (SELECT accuracy_ok FROM check_proximity(
    '99999999-0000-0000-0000-000000000001'::uuid,
    41.7151, 44.7866, 300.0
  )),
  'accuracy_ok flag returns false for poor accuracy'
);

-- F: hotel without location set → cannot verify
INSERT INTO hotels (id, brand_name, short_code, status)
VALUES ('99999999-0000-0000-0000-000000000002', 'No Location Hotel', 'test-noloc', 'active')
ON CONFLICT (short_code) DO NOTHING;

SELECT ok(
  NOT (SELECT is_within FROM check_proximity(
    '99999999-0000-0000-0000-000000000002'::uuid,
    41.7151, 44.7866, 10.0
  )),
  'Hotel without location cannot be verified (returns false)'
);


-- ============================================================================
-- 8. LOBBY PIN RPC · grace overlap, current/previous matching
-- ============================================================================

-- Insert a fresh PIN setup for the test hotel
INSERT INTO lobby_pins (hotel_id, current_pin, previous_pin, rotated_at, expires_at, rotation_minutes, grace_seconds)
VALUES (
  '99999999-0000-0000-0000-000000000001',
  '4729',
  '8841',
  NOW() - INTERVAL '5 seconds',     -- rotated 5 sec ago, well within grace
  NOW() + INTERVAL '5 minutes',
  5,
  15
)
ON CONFLICT (hotel_id) DO UPDATE SET
  current_pin = EXCLUDED.current_pin,
  previous_pin = EXCLUDED.previous_pin,
  rotated_at = EXCLUDED.rotated_at,
  expires_at = EXCLUDED.expires_at,
  grace_seconds = EXCLUDED.grace_seconds;

-- A: current PIN matches → true
SELECT ok(
  check_lobby_pin('99999999-0000-0000-0000-000000000001'::uuid, '4729'),
  'Current PIN 4729 matches'
);

-- B: previous PIN within grace → still valid
SELECT ok(
  check_lobby_pin('99999999-0000-0000-0000-000000000001'::uuid, '8841'),
  'Previous PIN 8841 within grace overlap matches'
);

-- C: random wrong PIN → false
SELECT ok(
  NOT check_lobby_pin('99999999-0000-0000-0000-000000000001'::uuid, '0000'),
  'Wrong PIN 0000 rejected'
);

-- D: previous PIN past grace window → no longer valid
UPDATE lobby_pins
SET rotated_at = NOW() - INTERVAL '60 seconds'  -- way past 15s grace
WHERE hotel_id = '99999999-0000-0000-0000-000000000001';

SELECT ok(
  NOT check_lobby_pin('99999999-0000-0000-0000-000000000001'::uuid, '8841'),
  'Previous PIN past grace window rejected'
);

SELECT ok(
  check_lobby_pin('99999999-0000-0000-0000-000000000001'::uuid, '4729'),
  'Current PIN still valid even after previous PIN expired'
);

-- E: hotel with no PIN configured → false
SELECT ok(
  NOT check_lobby_pin('99999999-0000-0000-0000-000000000002'::uuid, '4729'),
  'Hotel with no lobby PIN configured rejects all submissions'
);


-- ============================================================================
-- 9. CHECK CONSTRAINTS · catch invalid enum values early
-- ============================================================================

PREPARE bad_status AS
  INSERT INTO hotels (brand_name, short_code, status)
  VALUES ('X', 'test-bad-status', 'invalid_status');
SELECT throws_ok('bad_status', NULL,
  'hotels.status check constraint rejects invalid enum');

PREPARE bad_tier AS
  INSERT INTO hotels (brand_name, short_code, tier)
  VALUES ('X', 'test-bad-tier', 'super_premium_pro');
SELECT throws_ok('bad_tier', NULL,
  'hotels.tier check constraint rejects invalid enum');

PREPARE bad_qr_tier AS
  INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url)
  VALUES (
    '99999999-0000-0000-0000-000000000001',
    'test-bad-qr', 'super_verified', 'reward', 'X', 'https://x.test'
  );
SELECT throws_ok('bad_qr_tier', NULL,
  'qr_assets.tier check rejects invalid value (only open/verified)');

PREPARE bad_request_status AS
  INSERT INTO service_requests (hotel_id, service_id, status)
  VALUES (
    '99999999-0000-0000-0000-000000000001',
    'clean-room', 'frozen'
  );
SELECT throws_ok('bad_request_status', NULL,
  'service_requests.status check rejects invalid status');

PREPARE bad_progress AS
  INSERT INTO guest_sessions (hotel_id, device_hash, progress_pct)
  VALUES (
    '99999999-0000-0000-0000-000000000001',
    'test-hash-1', 150
  );
SELECT throws_ok('bad_progress', NULL,
  'guest_sessions.progress_pct check rejects values > 100');


-- ============================================================================
-- 10. UNIQUE CONSTRAINTS · multi-tenant integrity
-- ============================================================================

-- Test: same room_number can exist on different hotels but not within one
INSERT INTO screens (hotel_id, screen_type, display_name, room_number)
VALUES ('99999999-0000-0000-0000-000000000001', 'room_tv', 'Test Room 100', '100');

PREPARE dup_room AS
  INSERT INTO screens (hotel_id, screen_type, display_name, room_number)
  VALUES ('99999999-0000-0000-0000-000000000001', 'room_tv', 'Test Room 100 dup', '100');
SELECT throws_ok('dup_room', '23505',
  'screens UNIQUE(hotel_id, room_number) prevents duplicates within a hotel');

-- Same room number on a different hotel should be fine
INSERT INTO screens (hotel_id, screen_type, display_name, room_number)
VALUES ('99999999-0000-0000-0000-000000000002', 'room_tv', 'Test Room 100 other hotel', '100');

SELECT is(
  (SELECT COUNT(*)::int FROM screens WHERE room_number = '100'),
  2,
  'Same room number 100 can exist across different hotels (multi-tenant)'
);

-- qr_assets UNIQUE(hotel_id, qr_id)
INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url)
VALUES ('99999999-0000-0000-0000-000000000001', 'wifi', 'open', 'wifi', 'Wi-Fi', 'wifi://test');

PREPARE dup_qr AS
  INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url)
  VALUES ('99999999-0000-0000-0000-000000000001', 'wifi', 'open', 'wifi', 'Dup', 'wifi://test2');
SELECT throws_ok('dup_qr', '23505',
  'qr_assets UNIQUE(hotel_id, qr_id) prevents duplicate qr_id within a hotel'
);


-- ============================================================================
-- 11. FOREIGN KEYS · CASCADE delete behavior
-- ============================================================================

-- Set up a temp hotel with related rows, then delete the hotel
INSERT INTO hotels (id, brand_name, short_code)
VALUES ('99999999-0000-0000-0000-000000000099', 'Cascade Test', 'cascade-test');

INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url)
VALUES ('99999999-0000-0000-0000-000000000099', 'menu', 'open', 'info', 'Menu', 'https://x');

INSERT INTO guest_sessions (hotel_id, device_hash)
VALUES ('99999999-0000-0000-0000-000000000099', 'cascade-device');

DELETE FROM hotels WHERE id = '99999999-0000-0000-0000-000000000099';

SELECT is(
  (SELECT COUNT(*)::int FROM qr_assets WHERE hotel_id = '99999999-0000-0000-0000-000000000099'),
  0,
  'qr_assets CASCADE deleted with hotel'
);

SELECT is(
  (SELECT COUNT(*)::int FROM guest_sessions WHERE hotel_id = '99999999-0000-0000-0000-000000000099'),
  0,
  'guest_sessions CASCADE deleted with hotel'
);


-- ============================================================================
-- 12. TRIGGERS · updated_at autotouch
-- ============================================================================

-- Capture the original updated_at, sleep, update, compare
INSERT INTO property_configs (hotel_id) VALUES ('99999999-0000-0000-0000-000000000001')
ON CONFLICT (hotel_id) DO NOTHING;

DO $$
DECLARE
  v_before TIMESTAMPTZ;
  v_after  TIMESTAMPTZ;
BEGIN
  SELECT updated_at INTO v_before FROM property_configs WHERE hotel_id = '99999999-0000-0000-0000-000000000001';
  PERFORM pg_sleep(0.05);  -- 50ms is enough for TIMESTAMPTZ to differ
  UPDATE property_configs SET ticker = '{"test": true}'::jsonb WHERE hotel_id = '99999999-0000-0000-0000-000000000001';
  SELECT updated_at INTO v_after FROM property_configs WHERE hotel_id = '99999999-0000-0000-0000-000000000001';

  IF v_after <= v_before THEN
    RAISE EXCEPTION 'updated_at trigger did not fire (before=% after=%)', v_before, v_after;
  END IF;
END;
$$;

SELECT pass('property_configs.updated_at trigger fires on UPDATE');

-- Same test for hotels and qr_assets
DO $$
DECLARE v_before TIMESTAMPTZ; v_after TIMESTAMPTZ;
BEGIN
  SELECT updated_at INTO v_before FROM hotels WHERE id = '99999999-0000-0000-0000-000000000001';
  PERFORM pg_sleep(0.05);
  UPDATE hotels SET city = 'Tbilisi' WHERE id = '99999999-0000-0000-0000-000000000001';
  SELECT updated_at INTO v_after FROM hotels WHERE id = '99999999-0000-0000-0000-000000000001';
  IF v_after <= v_before THEN RAISE EXCEPTION 'hotels updated_at not fired'; END IF;
END;
$$;
SELECT pass('hotels.updated_at trigger fires on UPDATE');


-- ============================================================================
-- 13. TRIGGERS · session activity touch on scan
-- ============================================================================

INSERT INTO guest_sessions (id, hotel_id, device_hash, last_activity_at)
VALUES ('99999999-aaaa-0000-0000-000000000001', '99999999-0000-0000-0000-000000000001', 'session-test', NOW() - INTERVAL '1 hour');

INSERT INTO scans (hotel_id, session_id, qr_asset_id, was_verified)
SELECT '99999999-0000-0000-0000-000000000001',
       '99999999-aaaa-0000-0000-000000000001',
       (SELECT id FROM qr_assets WHERE qr_id = 'wifi' AND hotel_id = '99999999-0000-0000-0000-000000000001'),
       FALSE;

SELECT cmp_ok(
  (SELECT last_activity_at FROM guest_sessions WHERE id = '99999999-aaaa-0000-0000-000000000001'),
  '>',
  NOW() - INTERVAL '1 minute',
  'Scan trigger updated guest_sessions.last_activity_at to recent'
);

SELECT cmp_ok(
  (SELECT expires_at FROM guest_sessions WHERE id = '99999999-aaaa-0000-0000-000000000001'),
  '>',
  NOW() + INTERVAL '23 hours',
  'Scan trigger extended session expires_at to ~24h'
);


-- ============================================================================
-- 14. TRIGGERS · slot stats aggregation on spin insert
-- ============================================================================

-- Clean any prior stat row for today
DELETE FROM slot_property_stats
WHERE hotel_id = '99999999-0000-0000-0000-000000000001';

INSERT INTO slot_spins (hotel_id, device_hash, room_number, result)
VALUES ('99999999-0000-0000-0000-000000000001', 'slot-test-1', '412', 'loss');

SELECT is(
  (SELECT spins_today FROM slot_property_stats
   WHERE hotel_id = '99999999-0000-0000-0000-000000000001'),
  1,
  'First spin inserted creates stat row with spins_today=1'
);

INSERT INTO slot_spins (hotel_id, device_hash, room_number, result)
VALUES ('99999999-0000-0000-0000-000000000001', 'slot-test-1', '412', 'jackpot');

SELECT is(
  (SELECT spins_today FROM slot_property_stats
   WHERE hotel_id = '99999999-0000-0000-0000-000000000001'),
  2,
  'Second spin increments spins_today to 2'
);

SELECT is(
  (SELECT jackpots_today FROM slot_property_stats
   WHERE hotel_id = '99999999-0000-0000-0000-000000000001'),
  1,
  'Jackpot result increments jackpots_today'
);


-- ============================================================================
-- 15. TRIGGERS · QR daily cap enforcement
-- ============================================================================

INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url, daily_cap, claimed_today)
VALUES ('99999999-0000-0000-0000-000000000001', 'late-checkout-test', 'verified', 'reward', 'Late Checkout', 'https://x', 5, 4);

-- Try to bump claimed_today past daily_cap — trigger should clamp it
UPDATE qr_assets
SET claimed_today = 100
WHERE hotel_id = '99999999-0000-0000-0000-000000000001' AND qr_id = 'late-checkout-test';

SELECT is(
  (SELECT claimed_today FROM qr_assets
   WHERE hotel_id = '99999999-0000-0000-0000-000000000001' AND qr_id = 'late-checkout-test'),
  5,
  'QR daily cap trigger clamps claimed_today to daily_cap (overflow protection)'
);


-- ============================================================================
-- 16. RLS ISOLATION · simulating two hotel managers
-- ============================================================================
-- We can't easily fake auth.uid() inside a transaction, so we test indirectly:
-- 1. The current_user_hotel_id() function exists and is called by policies
-- 2. The policies exist on the right tables
-- 3. service_role bypasses RLS as expected (this transaction is service_role)
-- ============================================================================

SELECT policies_are('public', 'qr_assets', ARRAY['qr_assets_isolation'],
  'qr_assets has the expected isolation policy');

SELECT policies_are('public', 'service_requests', ARRAY['service_requests_isolation'],
  'service_requests has the expected isolation policy');

SELECT policies_are('public', 'guest_sessions', ARRAY['guest_sessions_isolation'],
  'guest_sessions has the expected isolation policy');

SELECT policies_are('public', 'manager_profiles', ARRAY['manager_profiles_self'],
  'manager_profiles uses the self-only policy (not hotel-isolation)');

SELECT policies_are('public', 'live_events', ARRAY['live_events_isolation'],
  'live_events has the expected isolation policy (with NULL hotel_id allowance)');

-- service_role (current connection) bypasses RLS — this insert must succeed
-- across hotels in a single transaction
INSERT INTO qr_assets (hotel_id, qr_id, tier, category, label, destination_url)
VALUES
  ('99999999-0000-0000-0000-000000000001', 'rls-test-a', 'open', 'info', 'A', 'https://a'),
  ('99999999-0000-0000-0000-000000000002', 'rls-test-b', 'open', 'info', 'B', 'https://b');

SELECT is(
  (SELECT COUNT(*)::int FROM qr_assets WHERE qr_id LIKE 'rls-test-%'),
  2,
  'service_role bypasses RLS — Edge Functions can read/write across hotels'
);


-- ============================================================================
-- 17. CACHE TABLES · service-role can write
-- ============================================================================

INSERT INTO weather_cache (hotel_id, payload, expires_at)
VALUES (
  '99999999-0000-0000-0000-000000000001',
  '{"temp": 14, "condition": "partly cloudy"}'::jsonb,
  NOW() + INTERVAL '15 minutes'
);

SELECT is(
  (SELECT (payload->>'temp')::int FROM weather_cache
   WHERE hotel_id = '99999999-0000-0000-0000-000000000001'),
  14,
  'weather_cache accepts JSON payloads from service_role'
);

INSERT INTO sports_cache (cache_key, payload, payload_hash, expires_at)
VALUES (
  'epl-test',
  '[{"home": "Liverpool", "away": "Man Utd"}]'::jsonb,
  encode(digest('test', 'sha256'), 'hex'),
  NOW() + INTERVAL '5 minutes'
);

SELECT pass('sports_cache accepts payload + hash + expiry');


-- ============================================================================
-- 18. INDEXES · sanity check the critical ones exist
-- ============================================================================

SELECT has_index('public', 'scans',                'idx_scans_hotel_date');
SELECT has_index('public', 'guest_sessions',       'idx_sessions_device');
SELECT has_index('public', 'service_requests',     'idx_service_requests_hotel_status');
SELECT has_index('public', 'qr_assets',            'idx_qr_assets_lookup');
SELECT has_index('public', 'verification_attempts', 'idx_verification_attempts_hotel');


-- ============================================================================
-- DONE
-- ============================================================================

SELECT * FROM finish();
ROLLBACK;
