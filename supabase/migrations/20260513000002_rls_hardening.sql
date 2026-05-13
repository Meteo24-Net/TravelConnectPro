-- ============================================================================
-- Travel Connect Pro · RLS Hardening for Inherited Cache Tables
-- ============================================================================
-- Migration 5.2. Closes the RLS gaps that triggered Supabase linter warnings
-- on weather_cache, flights_cache, sports_cache, and ai_content.
-- ============================================================================

BEGIN;

-- 1. Helper: is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_profiles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 2. ai_content (Hotel-scoped or Global)
ALTER TABLE public.ai_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_content_super_admin_read ON public.ai_content;
DROP POLICY IF EXISTS ai_content_manager_read     ON public.ai_content;

CREATE POLICY ai_content_super_admin_read
  ON public.ai_content
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY ai_content_manager_read
  ON public.ai_content
  FOR SELECT
  TO authenticated
  USING (
    hotel_id IS NULL
    OR hotel_id = public.current_user_hotel_id()
  );

REVOKE SELECT ON public.ai_content FROM anon;

-- 3. weather_cache (Per-hotel)
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS weather_cache_super_admin_read ON public.weather_cache;
DROP POLICY IF EXISTS weather_cache_manager_read     ON public.weather_cache;

CREATE POLICY weather_cache_super_admin_read
  ON public.weather_cache
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY weather_cache_manager_read
  ON public.weather_cache
  FOR SELECT
  TO authenticated
  USING (hotel_id = public.current_user_hotel_id());

REVOKE SELECT ON public.weather_cache FROM anon;

-- 4. flights_cache (Global stopgap)
ALTER TABLE public.flights_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flights_cache_authenticated_read ON public.flights_cache;

CREATE POLICY flights_cache_authenticated_read
  ON public.flights_cache
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_hotel_id() IS NOT NULL
    OR public.is_super_admin()
  );

REVOKE SELECT ON public.flights_cache FROM anon;

-- 5. sports_cache (Global stopgap)
ALTER TABLE public.sports_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sports_cache_authenticated_read ON public.sports_cache;

CREATE POLICY sports_cache_authenticated_read
  ON public.sports_cache
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_hotel_id() IS NOT NULL
    OR public.is_super_admin()
  );

REVOKE SELECT ON public.sports_cache FROM anon;

-- 6. currency_cache (Defensive schema handling)
DO $$
DECLARE
  has_new_schema BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'currency_cache'
      AND column_name = 'hotel_id'
  ) INTO has_new_schema;

  IF has_new_schema THEN
    EXECUTE 'ALTER TABLE public.currency_cache ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS currency_cache_super_admin_read ON public.currency_cache';
    EXECUTE 'DROP POLICY IF EXISTS currency_cache_manager_read ON public.currency_cache';

    EXECUTE $POL$
      CREATE POLICY currency_cache_super_admin_read
        ON public.currency_cache
        FOR SELECT
        TO authenticated
        USING (public.is_super_admin())
    $POL$;

    EXECUTE $POL$
      CREATE POLICY currency_cache_manager_read
        ON public.currency_cache
        FOR SELECT
        TO authenticated
        USING (hotel_id = public.current_user_hotel_id())
    $POL$;

    EXECUTE 'REVOKE SELECT ON public.currency_cache FROM anon';
  END IF;
END $$;

COMMIT;
