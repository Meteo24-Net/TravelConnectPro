-- ============================================================================
-- Travel Connect Pro · White-label Welcome Schema
-- ============================================================================
-- Builds on the initial schema. Adds the per-property branding (colors, fonts,
-- logo) and expands property_configs.welcome to support the full configurable
-- welcome ritual: greeting templates per language × time-of-day, subtext
-- templates, mode (full ritual vs side panel), language QR enable, integration
-- mode (solo vs OTRUM vs hybrid).
-- ============================================================================

BEGIN;


-- ============================================================================
-- 1. HOTELS · add branding column + integration_mode
-- ============================================================================
-- branding JSONB holds everything visually customizable per property:
--   {
--     "logo": {
--       "url": "https://...",                  -- Supabase Storage path
--       "fallback_text_line1": "RADISSON BLU", -- white
--       "fallback_text_line2": "BATUMI"        -- gold
--     },
--     "colors": {
--       "primary": "#003366",                  -- radisson-blue
--       "accent_gold": "#c5a059",
--       "accent_blue": "#009FE3",
--       "background": "rgba(10, 10, 15, 0.98)"
--     },
--     "fonts": {
--       "pairing": "classic",                  -- 'classic'|'modern'|'editorial'|'tech'|'custom'
--       "heading": "Playfair Display",
--       "body": "Inter",
--       "custom_url": null                     -- only used when pairing='custom'
--     }
--   }
-- ============================================================================

ALTER TABLE hotels
  ADD COLUMN branding JSONB NOT NULL DEFAULT jsonb_build_object(
    'logo', jsonb_build_object(
      'url', NULL,
      'fallback_text_line1', '',
      'fallback_text_line2', ''
    ),
    'colors', jsonb_build_object(
      'primary',      '#003366',
      'accent_gold',  '#c5a059',
      'accent_blue',  '#009FE3',
      'background',   'rgba(10, 10, 15, 0.98)'
    ),
    'fonts', jsonb_build_object(
      'pairing',    'classic',
      'heading',    'Playfair Display',
      'body',       'Inter',
      'custom_url', NULL
    )
  );

COMMENT ON COLUMN hotels.branding IS
  'White-label brand config: logo, colors, fonts. Set by SuperAdmin during onboarding. '
  'Read by display app on every render. Manager cannot modify.';


-- integration_mode: drives display behavior
--   'solo'   = no third-party room system; show language QR, default lang = property default
--   'otrum'  = OTRUM passes language via URL/postMessage/cookie; hide language QR
--   'hybrid' = OTRUM optional; if no language signal received within boot window, fall back to solo
ALTER TABLE hotels
  ADD COLUMN integration_mode TEXT NOT NULL DEFAULT 'solo'
    CHECK (integration_mode IN ('solo', 'otrum', 'hybrid'));

COMMENT ON COLUMN hotels.integration_mode IS
  'Determines display behavior for language selection. solo=show language QR. '
  'otrum=external system controls language. hybrid=otrum with solo fallback.';


-- ============================================================================
-- 2. WELCOME TEMPLATES · the shared SuperAdmin-managed template library
-- ============================================================================
-- A two-level system:
--   1. welcome_template_library (SuperAdmin global): the default greeting and
--      subtext text, per language × time-of-day. Inherited by all properties
--      unless overridden.
--   2. property_configs.welcome (per property): overrides + property-specific
--      fields (offer text, mode, language QR settings).
--
-- 99% of properties never override the templates. The override path exists for
-- thematic resorts ("Welcome to paradise" / "May your stay be memorable").
-- ============================================================================

CREATE TABLE welcome_template_library (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code   TEXT         NOT NULL,                  -- 'en', 'ka', 'ru', 'tr'
  time_of_day     TEXT         NOT NULL                   -- matches the boundaries we agreed on
                                 CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
  greeting        TEXT         NOT NULL,                  -- "Good morning" / "Доброе утро"
  subtext         TEXT,                                   -- "Hope you have a wonderful day"
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (language_code, time_of_day)
);

COMMENT ON TABLE welcome_template_library IS
  'SuperAdmin-managed greeting + subtext templates. One row per language × time-of-day. '
  'Properties inherit by default; override via property_configs.welcome.';


-- Time-of-day boundaries (configurable at property level)
-- Stored in property_configs.welcome as part of the welcome config.
-- Defaults applied via a function for new property_configs rows.

CREATE OR REPLACE FUNCTION default_welcome_config()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    -- Display mode
    'mode',                'full_ritual',
    'duration_seconds',    4,

    -- Time-of-day boundaries (24h, property local time)
    'time_boundaries', jsonb_build_object(
      'morning_start',     5,
      'afternoon_start',   12,
      'evening_start',     18,
      'night_start',       23
    ),

    -- Greeting + subtext overrides ({} = inherit from welcome_template_library)
    -- Override structure: { 'en': { 'morning': 'Custom morning greeting' } }
    'greeting_overrides',  '{}'::jsonb,
    'subtext_overrides',   '{}'::jsonb,

    -- Highlight offer block (the gold-bordered footer)
    'offer', jsonb_build_object(
      'enabled',           false,
      'qr_asset_id',       NULL,
      'badge_label',       'EXCLUSIVE OFFER',
      'badge_label_overrides', '{}'::jsonb
    ),

    -- Language QR card (only shows when integration_mode = 'solo' or 'hybrid' fallback)
    'language_qr', jsonb_build_object(
      'enabled',           true,
      'label',             'CHANGE LANGUAGE',
      'subtitle_template', 'SCAN TO CHOOSE',
      'cycle_seconds',     3
    ),

    -- Language change overlay (when guest picks new lang in PWA)
    'language_change_overlay', jsonb_build_object(
      'enabled',           true,
      'duration_seconds',  3,
      'replay_welcome',    true
    ),

    -- Trigger rules
    'trigger', jsonb_build_object(
      'lobby_show_on',     'reboot_only',
      'room_show_on',      'every_power_on'
    )
  );
$$;

COMMENT ON FUNCTION default_welcome_config IS
  'Returns the default welcome configuration JSONB. Used as default for property_configs.welcome.';


-- Apply the default to existing rows (only if welcome is empty {})
UPDATE property_configs
SET welcome = default_welcome_config()
WHERE welcome = '{}'::jsonb;


-- For new rows, change the column default
ALTER TABLE property_configs
  ALTER COLUMN welcome SET DEFAULT default_welcome_config();


-- ============================================================================
-- 3. SCREENS · room TVs need to track power-on events for welcome trigger
-- ============================================================================

ALTER TABLE screens
  ADD COLUMN last_welcome_played_at TIMESTAMPTZ,
  ADD COLUMN welcome_debounce_seconds INT NOT NULL DEFAULT 30;

COMMENT ON COLUMN screens.last_welcome_played_at IS
  'When the welcome ritual was last shown on this screen. Used to debounce '
  'rapid power cycles so a 5-second flicker does not replay the welcome.';


-- ============================================================================
-- 4. SEED · welcome templates for the demo property's languages
-- ============================================================================

INSERT INTO welcome_template_library (language_code, time_of_day, greeting, subtext) VALUES
  -- English
  ('en', 'morning',   'Good morning',   'Hope you have a wonderful day'),
  ('en', 'afternoon', 'Good afternoon', 'Make the most of your stay'),
  ('en', 'evening',   'Good evening',   'Welcome back to your home away from home'),
  ('en', 'night',     'Good night',     'Rest well, we''ll see you in the morning'),

  -- Russian
  ('ru', 'morning',   'Доброе утро',    'Желаем вам прекрасного дня'),
  ('ru', 'afternoon', 'Добрый день',    'Наслаждайтесь своим пребыванием'),
  ('ru', 'evening',   'Добрый вечер',   'Добро пожаловать в ваш дом вдали от дома'),
  ('ru', 'night',     'Доброй ночи',    'Спокойной ночи, увидимся утром'),

  -- Georgian
  ('ka', 'morning',   'დილა მშვიდობისა', 'გისურვებთ მშვენიერ დღეს'),
  ('ka', 'afternoon', 'დღე მშვიდობისა',  'ისიამოვნეთ თქვენი ვიზიტით'),
  ('ka', 'evening',   'საღამო მშვიდობისა', 'კეთილი იყოს თქვენი მობრძანება'),
  ('ka', 'night',     'ღამე მშვიდობისა', 'მშვიდად დაისვენეთ'),

  -- Turkish
  ('tr', 'morning',   'Günaydın',       'Harika bir gün geçirmenizi diliyoruz'),
  ('tr', 'afternoon', 'İyi günler',     'Konaklamanızın tadını çıkarın'),
  ('tr', 'evening',   'İyi akşamlar',   'Evinizden uzakta evinize hoş geldiniz'),
  ('tr', 'night',     'İyi geceler',    'İyi dinlenmeler, sabaha görüşmek üzere')
ON CONFLICT (language_code, time_of_day) DO NOTHING;


-- Seed branding for the demo hotel so File 2 (display app) has real data
UPDATE hotels
SET branding = jsonb_build_object(
  'logo', jsonb_build_object(
    'url', NULL,
    'fallback_text_line1', 'RADISSON BLU',
    'fallback_text_line2', 'BATUMI'
  ),
  'colors', jsonb_build_object(
    'primary',      '#003366',
    'accent_gold',  '#c5a059',
    'accent_blue',  '#009FE3',
    'background',   'rgba(10, 10, 15, 0.98)'
  ),
  'fonts', jsonb_build_object(
    'pairing',    'classic',
    'heading',    'Playfair Display',
    'body',       'Inter',
    'custom_url', NULL
  )
)
WHERE short_code = 'rad-bat-001';

-- Ensure the demo property has a property_configs row with default welcome
INSERT INTO property_configs (hotel_id, welcome)
SELECT id, default_welcome_config()
FROM hotels
WHERE short_code = 'rad-bat-001'
ON CONFLICT (hotel_id) DO UPDATE SET welcome = EXCLUDED.welcome;


-- Configure the demo property's welcome offer (uses Wi-Fi QR if it exists)
UPDATE property_configs
SET welcome = jsonb_set(
  jsonb_set(
    welcome,
    '{offer,enabled}',
    'true'::jsonb
  ),
  '{offer,qr_asset_id}',
  to_jsonb((SELECT id::text FROM qr_assets WHERE qr_id = 'wifi' AND hotel_id = (SELECT id FROM hotels WHERE short_code = 'rad-bat-001') LIMIT 1))
)
WHERE hotel_id = (SELECT id FROM hotels WHERE short_code = 'rad-bat-001')
  AND EXISTS (SELECT 1 FROM qr_assets WHERE qr_id = 'wifi' AND hotel_id = (SELECT id FROM hotels WHERE short_code = 'rad-bat-001'));


-- ============================================================================
-- 5. RLS · welcome_template_library is global (read-anyone, write-superadmin)
-- ============================================================================

ALTER TABLE welcome_template_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY welcome_template_read_all
  ON welcome_template_library
  FOR SELECT
  USING (TRUE);

CREATE POLICY welcome_template_super_admin_write
  ON welcome_template_library
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM manager_profiles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );


-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX idx_welcome_template_lookup
  ON welcome_template_library (language_code, time_of_day);


COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
