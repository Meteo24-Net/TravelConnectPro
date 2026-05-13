-- ============================================================================
-- Travel Connect Pro · Weather & Layout Recovery (5.4)
-- ============================================================================

BEGIN;

-- 1. Create weather_cache if it doesn't exist
CREATE TABLE IF NOT EXISTS public.weather_cache (
  hotel_id         UUID         PRIMARY KEY REFERENCES public.hotels(id) ON DELETE CASCADE,
  city             TEXT,
  temp_c           NUMERIC(4,1),
  condition        TEXT,
  icon             TEXT,
  wind_kmh         NUMERIC(5,1),
  uv_index         NUMERIC(3,1),
  forecast         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  fetched_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Populate mock weather for Batumi/Tbilisi to restore UI immediately
INSERT INTO public.weather_cache (hotel_id, city, temp_c, condition, icon, wind_kmh, uv_index, forecast)
SELECT 
  id, 
  city, 
  24.0, 
  'Clear Skies', 
  'sunny', 
  12.5, 
  4.0, 
  '[{"day": "FRI", "high": 26, "low": 18, "icon": "sunny"}, {"day": "SAT", "high": 24, "low": 17, "icon": "cloudy"}, {"day": "SUN", "high": 22, "low": 16, "icon": "rainy"}]'::jsonb
FROM public.hotels
ON CONFLICT (hotel_id) DO NOTHING;

-- 3. Update the Unified Resolver to include Weather and Fixed Carousel
CREATE OR REPLACE FUNCTION public.resolve_display_integration_view(p_screen_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'screen', jsonb_build_object('id', s.id, 'type', s.screen_type),
    'property', jsonb_build_object('name', h.brand_name, 'city', h.city, 'timezone', h.timezone),
    'branding', jsonb_build_object(
      'colors', h.theme_config->'colors', 
      'hotel_name', h.brand_name, 
      'logo_url', h.theme_config->>'logo_url',
      'background_url', h.theme_config->>'background_url',
      'city', h.city
    ),
    'integrations', h.integration_config,
    'content', jsonb_build_object(
      'carousel', jsonb_build_array(
        jsonb_build_object('type', 'welcome', 'duration_ms', 10000, 'content', jsonb_build_object('greeting', 'Welcome to ' || h.brand_name, 'subtext', 'Experience the magic of ' || h.city)),
        jsonb_build_object('type', 'flights', 'duration_ms', 15000, 'content', jsonb_build_object('iata_code', fc.iata_code, 'airport_name', fc.airport_name)),
        jsonb_build_object('type', 'weather', 'duration_ms', 12000, 'content', jsonb_build_object('weather_data', jsonb_build_object('temp_c', wc.temp_c, 'condition', wc.condition, 'forecast', wc.forecast, 'wind_kmh', wc.wind_kmh, 'uv_index', wc.uv_index)))
      ),
      'currency', jsonb_build_object(
        'source', cc.source,
        'date', cc.fetched_at,
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
        COALESCE(fc.iata_code, 'BUS'), 
        (
          SELECT jsonb_agg(f)
          FROM (
            SELECT 
              f->>'flight_number' as flight_number,
              f->>'destination' as destination,
              f->>'scheduled' as scheduled,
              f->>'status' as status,
              f->>'gate' as gate
            FROM jsonb_array_elements(COALESCE(fc.departures, '[]'::jsonb)) f
          ) f
        )
      ),
      'weather', jsonb_build_object(
        'temp_c', wc.temp_c,
        'condition', wc.condition,
        'forecast', wc.forecast
      )
    )
  ) INTO v_result
  FROM public.screens s
  JOIN public.hotels h ON s.hotel_id = h.id
  LEFT JOIN public.currency_cache cc ON h.id = cc.hotel_id
  LEFT JOIN public.flights_cache fc ON h.id = fc.hotel_id
  LEFT JOIN public.weather_cache wc ON h.id = wc.hotel_id
  WHERE s.id = p_screen_id;

  RETURN v_result;
END;
$$;

COMMIT;
