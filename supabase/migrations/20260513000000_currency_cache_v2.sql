-- ============================================================================
-- Travel Connect Pro · Brand Tokens + Integration Sources + Currency Cache
-- ============================================================================
-- Unified Migration for Sprint 2.
-- Adds the architectural columns required for white-labeling and secure APIs.
-- ============================================================================

BEGIN;

-- 1. Helper for default brand tokens
CREATE OR REPLACE FUNCTION default_brand_tokens()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'core', jsonb_build_object('primary', '#003366', 'accent', '#c5a059', 'tertiary', '#008374', 'contrast', '#ffffff'),
    'surface', jsonb_build_object('base', '#000000', 'card', '#0a0a0f', 'widget', '#1a1a22', 'border', '#2a2a35'),
    'text', jsonb_build_object('on_surface', '#ffffff', 'on_surface_muted', '#b0b0b0', 'on_surface_faint', '#71717a', 'accent', '#c5a059'),
    'semantic', jsonb_build_object('success', '#2ecc71', 'warning', '#ffcc00', 'danger', '#ef4444', 'info', '#009FE3'),
    'flight', jsonb_build_object('departure_pill', '#009FE3', 'arrival_pill', '#2ecc71'),
    'ticker', jsonb_build_object('announce', '#009FE3', 'events', '#c5a059', 'offers', '#2ecc71', 'sports', '#ef4444'),
    'qr', jsonb_build_object('wifi', '#009FE3', 'checkout', '#c5a059', 'clean', '#2ecc71', 'menu', '#e67e22', 'spa', '#a78bfa', 'loyalty', '#ef4444'),
    'fonts', jsonb_build_object('display', 'Playfair Display', 'body', 'Inter', 'mono', 'JetBrains Mono'),
    'timing', jsonb_build_object('welcome_sec', 6, 'rewelcome_min', 0, 'panel_sec', 15, 'info_sec', 60, 'qr_sec', 12),
    'layout', jsonb_build_object('card_border_px', 8, 'card_radius_px', 10)
  );
$$;

-- 2. Add the new columns to hotels
ALTER TABLE hotels 
  ADD COLUMN IF NOT EXISTS brand_tokens JSONB NOT NULL DEFAULT default_brand_tokens(),
  ADD COLUMN IF NOT EXISTS integration_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Sync existing data from theme_config to brand_tokens if any
UPDATE hotels SET brand_tokens = default_brand_tokens() || theme_config;

-- 3. Integration config defaults
CREATE OR REPLACE FUNCTION default_integration_config()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'maps', jsonb_build_object('provider', 'maplibre', 'providers', jsonb_build_object('maplibre', jsonb_build_object('style_url', 'https://demotiles.maplibre.org/style.json'))),
    'weather', jsonb_build_object('enabled', true, 'provider', 'open-meteo', 'refresh_interval_min', 30),
    'currency', jsonb_build_object('enabled', true, 'source', 'nbg', 'display_codes', jsonb_build_array('USD', 'EUR', 'TRY'), 'base_currency', 'GEL', 'spread_pct', 0.015)
  );
$$;

UPDATE hotels SET integration_config = default_integration_config() WHERE integration_config = '{}'::jsonb;

-- 4. Re-setup display helper functions with correct column names
CREATE OR REPLACE FUNCTION resolve_display_brand_tokens(p_hotel_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT brand_tokens FROM hotels WHERE id = p_hotel_id;
$$;

CREATE OR REPLACE FUNCTION resolve_display_integration_view(p_hotel_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'maps', jsonb_build_object(
      'provider', integration_config->'maps'->>'provider',
      'style', integration_config->'maps'->'providers'->(integration_config->'maps'->>'provider')->>'style',
      'traffic_layer', (integration_config->'maps'->'providers'->(integration_config->'maps'->>'provider')->'traffic_layer')::boolean,
      'mapbox_token', CASE WHEN integration_config->'maps'->>'provider' = 'mapbox' THEN integration_config->'maps'->'providers'->'mapbox'->>'access_token' ELSE NULL END
    ),
    'weather', jsonb_build_object('units', integration_config->'weather'->>'units'),
    'currency', jsonb_build_object('enabled', (integration_config->'currency'->'enabled')::boolean, 'display_codes', integration_config->'currency'->'display_codes', 'base_currency', integration_config->'currency'->>'base_currency', 'source', integration_config->'currency'->>'source')
  ) FROM hotels WHERE id = p_hotel_id;
$$;

COMMIT;
