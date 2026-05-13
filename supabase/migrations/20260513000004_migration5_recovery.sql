-- ============================================================================
-- Travel Connect Pro · Migration 5 Recovery Patch (5.3)
-- ============================================================================
-- Adjusted to use 'brand_tokens' column name.
-- ============================================================================

BEGIN;

-- 1. DROP the old currency_cache
DROP TABLE IF EXISTS public.currency_cache CASCADE;

-- 2. Brand tokens default function
CREATE OR REPLACE FUNCTION public.default_brand_tokens()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'core', jsonb_build_object('primary', '#003366', 'accent', '#c5a059', 'tertiary', '#008374', 'contrast', '#ffffff'),
    'surface', jsonb_build_object('base', '#0a0a0d', 'card', '#13131a', 'widget', 'rgba(255,255,255,0.04)', 'border', 'rgba(197,160,89,0.18)'),
    'text', jsonb_build_object('on_surface', '#ffffff', 'muted', 'rgba(255,255,255,0.65)', 'faint', 'rgba(255,255,255,0.35)', 'accent', '#c5a059'),
    'semantic', jsonb_build_object('success', '#2ecc71', 'warning', '#f39c12', 'danger', '#e74c3c', 'info', '#3498db'),
    'flight', jsonb_build_object('departure_pill', '#c5a059', 'arrival_pill', '#008374'),
    'ticker', jsonb_build_object('announce', '#c5a059', 'events', '#3498db', 'offers', '#e74c3c', 'sports', '#2ecc71'),
    'qr', jsonb_build_object('wifi', '#3498db', 'checkout', '#e74c3c', 'clean', '#2ecc71', 'menu', '#c5a059', 'spa', '#9b59b6', 'loyalty', '#f39c12'),
    'timing', jsonb_build_object('welcome_sec', 6, 'rewelcome_min', 0, 'panel_sec', 15, 'info_sec', 60, 'qr_sec', 12),
    'layout', jsonb_build_object('card_border_px', 8, 'card_radius_px', 10)
  );
$$;

-- 3. Integration config default function
CREATE OR REPLACE FUNCTION public.default_integration_config()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'maps', jsonb_build_object('provider', 'maplibre', 'providers', jsonb_build_object('maplibre', jsonb_build_object('style_url', 'https://demotiles.maplibre.org/style.json'))),
    'weather', jsonb_build_object('enabled', true, 'provider', 'open-meteo', 'refresh_interval_min', 30, 'units', 'celsius'),
    'flights', jsonb_build_object('enabled', true, 'primary_provider', 'airlabs', 'refresh_interval_min', 60),
    'currency', jsonb_build_object('enabled', true, 'source', 'nbg', 'display_codes', jsonb_build_array('USD', 'EUR', 'TRY'), 'base_currency', 'GEL', 'spread_pct', 0.015, 'refresh_interval_hours', 6)
  );
$$;

-- 4. Ensure columns exist
ALTER TABLE public.hotels
  ADD COLUMN IF NOT EXISTS brand_tokens JSONB NOT NULL DEFAULT public.default_brand_tokens(),
  ADD COLUMN IF NOT EXISTS integration_config JSONB NOT NULL DEFAULT public.default_integration_config();

-- 5. Merge default brand tokens into brand_tokens column
UPDATE public.hotels
SET brand_tokens = public.default_brand_tokens() || COALESCE(brand_tokens, '{}'::jsonb);

-- 6. Create new currency_cache
CREATE TABLE public.currency_cache (
  hotel_id           UUID         PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  base_currency      TEXT         NOT NULL DEFAULT 'GEL',
  rates              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  source             TEXT         NOT NULL DEFAULT 'nbg',
  fetched_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_success_at    TIMESTAMPTZ,
  applied_spread_pct NUMERIC(5,4)
);

-- 7. RLS on currency_cache
ALTER TABLE public.currency_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS currency_cache_super_admin_read ON public.currency_cache;
DROP POLICY IF EXISTS currency_cache_manager_read     ON public.currency_cache;

CREATE POLICY currency_cache_super_admin_read ON public.currency_cache
  FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE POLICY currency_cache_manager_read ON public.currency_cache
  FOR SELECT TO authenticated USING (hotel_id = public.current_user_hotel_id());

REVOKE SELECT ON public.currency_cache FROM anon;

-- 8. Resolver functions
CREATE OR REPLACE FUNCTION public.resolve_display_brand_tokens(p_hotel_id UUID)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT brand_tokens FROM public.hotels WHERE id = p_hotel_id;
$$;

CREATE OR REPLACE FUNCTION public.resolve_display_integration_view(p_screen_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'screen', jsonb_build_object('id', s.id, 'type', s.screen_type),
    'property', jsonb_build_object('name', h.brand_name, 'city', h.city, 'timezone', h.timezone),
    'branding', jsonb_build_object('colors', h.theme_config->'colors', 'hotel_name', h.brand_name, 'logo_url', h.theme_config->>'logo_url'),
    'integrations', h.integration_config,
    'content', jsonb_build_object(
      'currency', jsonb_build_object(
        'source', cc.source,
        'date', cc.date,
        'base', cc.base_currency,
        'rates', (
           SELECT jsonb_agg(
             jsonb_build_object(
               'currency', key,
               'buy', (value->'buy')::numeric,
               'sell', (value->'sell')::numeric,
               'mid', (value->'mid')::numeric
             )
           )
           FROM jsonb_each(cc.rates)
        )
      ),
      'flights', jsonb_build_object(
        'iata_code', fc.iata_code,
        'airport_name', fc.airport_name,
        'arrivals', fc.arrivals,
        'departures', fc.departures,
        'last_success_at', fc.last_success_at
      )
    )
  ) INTO v_result
  FROM public.screens s
  JOIN public.hotels h ON s.hotel_id = h.id
  LEFT JOIN public.currency_cache cc ON h.id = cc.hotel_id
  LEFT JOIN public.flights_cache fc ON h.id = fc.hotel_id
  WHERE s.id = p_screen_id;

  RETURN v_result;
END;
$$;

COMMIT;
