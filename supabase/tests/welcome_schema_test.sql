-- ============================================================================
-- Travel Connect Pro · White-label Welcome Schema Tests
-- ============================================================================
-- Verifies the white-label welcome migration applied correctly.
-- Run after BOTH migrations:
--   supabase db reset && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(37);


-- ============================================================================
-- 1. NEW COLUMNS ON HOTELS
-- ============================================================================

SELECT has_column('public', 'hotels', 'branding',
  'hotels.branding column exists');

SELECT col_type_is('public', 'hotels', 'branding', 'jsonb',
  'hotels.branding is JSONB');

SELECT col_not_null('public', 'hotels', 'branding',
  'hotels.branding is NOT NULL');

SELECT has_column('public', 'hotels', 'integration_mode',
  'hotels.integration_mode column exists');

SELECT col_default_is('public', 'hotels', 'integration_mode', 'solo'::text,
  'hotels.integration_mode defaults to solo');


-- ============================================================================
-- 2. INTEGRATION_MODE CHECK CONSTRAINT
-- ============================================================================

PREPARE bad_int_mode AS
  INSERT INTO hotels (brand_name, short_code, integration_mode)
  VALUES ('X', 'bad-int-mode', 'tablet_app');
SELECT throws_ok('bad_int_mode', NULL,
  'integration_mode rejects invalid values');

INSERT INTO hotels (brand_name, short_code, integration_mode)
VALUES ('Solo Test', 'solo-test', 'solo');
SELECT pass('integration_mode accepts solo');

INSERT INTO hotels (brand_name, short_code, integration_mode)
VALUES ('Otrum Test', 'otrum-test', 'otrum');
SELECT pass('integration_mode accepts otrum');

INSERT INTO hotels (brand_name, short_code, integration_mode)
VALUES ('Hybrid Test', 'hybrid-test', 'hybrid');
SELECT pass('integration_mode accepts hybrid');


-- ============================================================================
-- 3. BRANDING DEFAULT STRUCTURE
-- ============================================================================

INSERT INTO hotels (brand_name, short_code) VALUES ('Default Brand Test', 'default-brand-test');

SELECT ok(
  (SELECT branding ? 'logo' FROM hotels WHERE short_code = 'default-brand-test'),
  'New hotel gets branding.logo by default'
);

SELECT ok(
  (SELECT branding ? 'colors' FROM hotels WHERE short_code = 'default-brand-test'),
  'New hotel gets branding.colors by default'
);

SELECT ok(
  (SELECT branding ? 'fonts' FROM hotels WHERE short_code = 'default-brand-test'),
  'New hotel gets branding.fonts by default'
);

SELECT is(
  (SELECT branding->'colors'->>'accent_gold' FROM hotels WHERE short_code = 'default-brand-test'),
  '#c5a059',
  'Default accent_gold is the Radisson gold'
);

SELECT is(
  (SELECT branding->'fonts'->>'pairing' FROM hotels WHERE short_code = 'default-brand-test'),
  'classic',
  'Default font pairing is classic (Playfair + Inter)'
);


-- ============================================================================
-- 4. WELCOME_TEMPLATE_LIBRARY TABLE
-- ============================================================================

SELECT has_table('public', 'welcome_template_library',
  'welcome_template_library table exists');

SELECT has_column('public', 'welcome_template_library', 'language_code',
  'welcome_template_library has language_code');

SELECT has_column('public', 'welcome_template_library', 'time_of_day',
  'welcome_template_library has time_of_day');

PREPARE bad_tod AS
  INSERT INTO welcome_template_library (language_code, time_of_day, greeting)
  VALUES ('en', 'midday', 'Hello');
SELECT throws_ok('bad_tod', NULL,
  'time_of_day rejects values outside morning/afternoon/evening/night');

PREPARE dup_template AS
  INSERT INTO welcome_template_library (language_code, time_of_day, greeting)
  VALUES ('en', 'morning', 'Duplicate Good Morning');
SELECT throws_ok('dup_template', '23505',
  'welcome_template_library UNIQUE(language_code, time_of_day) prevents duplicates');


-- ============================================================================
-- 5. SEED VERIFICATION · 16 templates (4 langs × 4 times-of-day)
-- ============================================================================

SELECT is(
  (SELECT COUNT(*)::int FROM welcome_template_library),
  16,
  'Seed loaded 16 templates (4 languages × 4 time-of-day periods)'
);

SELECT is(
  (SELECT greeting FROM welcome_template_library WHERE language_code = 'en' AND time_of_day = 'morning'),
  'Good morning',
  'English morning greeting seeded correctly'
);

SELECT is(
  (SELECT greeting FROM welcome_template_library WHERE language_code = 'ka' AND time_of_day = 'evening'),
  'საღამო მშვიდობისა',
  'Georgian evening greeting seeded correctly (UTF-8 handling)'
);

SELECT is(
  (SELECT greeting FROM welcome_template_library WHERE language_code = 'ru' AND time_of_day = 'night'),
  'Доброй ночи',
  'Russian night greeting seeded correctly (Cyrillic UTF-8)'
);


-- ============================================================================
-- 6. DEFAULT_WELCOME_CONFIG FUNCTION
-- ============================================================================

SELECT has_function('public', 'default_welcome_config',
  'default_welcome_config() function exists');

SELECT ok(
  (SELECT default_welcome_config() ? 'mode'),
  'default_welcome_config returns mode key'
);

SELECT ok(
  (SELECT default_welcome_config() ? 'time_boundaries'),
  'default_welcome_config returns time_boundaries key'
);

SELECT ok(
  (SELECT default_welcome_config() ? 'language_qr'),
  'default_welcome_config returns language_qr key'
);

SELECT ok(
  (SELECT default_welcome_config() ? 'offer'),
  'default_welcome_config returns offer key'
);

SELECT is(
  (SELECT default_welcome_config()->>'mode'),
  'full_ritual',
  'default mode is full_ritual'
);

SELECT is(
  (SELECT (default_welcome_config()->'time_boundaries'->>'morning_start')::int),
  5,
  'default morning_start is 5 AM'
);


-- ============================================================================
-- 7. PROPERTY_CONFIGS HAS WELCOME DEFAULTS
-- ============================================================================

SELECT ok(
  (SELECT welcome ? 'mode' FROM property_configs
   WHERE hotel_id = (SELECT id FROM hotels WHERE short_code = 'rad-bat-001')),
  'Demo property has welcome.mode set'
);

SELECT is(
  (SELECT welcome->>'mode' FROM property_configs
   WHERE hotel_id = (SELECT id FROM hotels WHERE short_code = 'rad-bat-001')),
  'full_ritual',
  'Demo property welcome mode is full_ritual'
);


-- ============================================================================
-- 8. SCREENS WELCOME TRACKING COLUMNS
-- ============================================================================

SELECT has_column('public', 'screens', 'last_welcome_played_at',
  'screens.last_welcome_played_at column exists');

SELECT has_column('public', 'screens', 'welcome_debounce_seconds',
  'screens.welcome_debounce_seconds column exists');

SELECT col_default_is('public', 'screens', 'welcome_debounce_seconds', 30,
  'welcome_debounce_seconds defaults to 30');


-- ============================================================================
-- 9. RLS POLICIES ON WELCOME_TEMPLATE_LIBRARY
-- ============================================================================

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'welcome_template_library'),
  'RLS enabled on welcome_template_library'
);

SELECT policies_are('public', 'welcome_template_library',
  ARRAY['welcome_template_read_all', 'welcome_template_super_admin_write'],
  'welcome_template_library has read-all + super-admin-write policies'
);


-- ============================================================================
-- DONE
-- ============================================================================

SELECT * FROM finish();
ROLLBACK;
