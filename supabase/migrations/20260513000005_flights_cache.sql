-- ============================================================================
-- Travel Connect Pro · Migration 6: Flights Cache
-- ============================================================================

BEGIN;

-- 1. Create the flights_cache table (Hotel-Scoped)
CREATE TABLE IF NOT EXISTS public.flights_cache (
  hotel_id        UUID         NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  iata_code       TEXT         NOT NULL,
  airport_name    TEXT,
  arrivals        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  departures      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  PRIMARY KEY (hotel_id, iata_code)
);

-- 2. Enable RLS
ALTER TABLE public.flights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-access to flights_cache" 
  ON public.flights_cache FOR SELECT USING (true);

-- 3. Update Integration Config Defaults
-- Adding flight-specific settings to the default config
CREATE OR REPLACE FUNCTION public.default_integration_config()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'maps', jsonb_build_object('provider', 'maplibre', 'default_zoom', 13),
    'weather', jsonb_build_object('enabled', true, 'provider', 'open-meteo'),
    'flights', jsonb_build_object(
      'enabled', true, 
      'primary_provider', 'airlabs', 
      'iata_code', 'BUS', 
      'airport_name', 'Batumi International Airport',
      'drive_time_minutes', 15,
      'refresh_interval_min', 60
    ),
    'currency', jsonb_build_object(
      'enabled', true, 
      'source', 'oxr', 
      'display_codes', jsonb_build_array('USD', 'EUR', 'TRY'), 
      'base_currency', 'GEL', 
      'spread_pct', 0.015, 
      'refresh_interval_hours', 6
    )
  );
$$;

COMMIT;
