-- Migration 1: Free-tier server-side rate limit
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS free_prompts_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_prompts_date  DATE;

CREATE OR REPLACE FUNCTION public.check_and_increment_free_prompt(
  p_wix_user_id TEXT,
  p_daily_limit INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_count INTEGER;
BEGIN
  INSERT INTO public.user_profiles (wix_user_id, free_prompts_today, free_prompts_date)
  VALUES (p_wix_user_id, 1, v_today)
  ON CONFLICT (wix_user_id) DO UPDATE
    SET
      free_prompts_today = CASE
        WHEN user_profiles.free_prompts_date IS DISTINCT FROM v_today THEN 1
        WHEN user_profiles.free_prompts_today >= p_daily_limit        THEN user_profiles.free_prompts_today
        ELSE user_profiles.free_prompts_today + 1
      END,
      free_prompts_date = v_today
  RETURNING free_prompts_today INTO v_count;

  RETURN v_count <= p_daily_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) TO service_role;

-- Migration 2: Lock down core data tables and harden query function
DROP POLICY IF EXISTS "Properties are publicly readable" ON public.properties_2025;
DROP POLICY IF EXISTS "Rentals are publicly readable"    ON public.rentals_2025;

CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  upper_query TEXT;
BEGIN
  upper_query := UPPER(TRIM(query_text));

  IF NOT (upper_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF upper_query ~ '(DELETE|DROP|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE)' THEN
    RAISE EXCEPTION 'Forbidden SQL operation detected';
  END IF;

  EXECUTE format(
    'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM (%s) raw LIMIT 500) t',
    query_text
  ) INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) TO service_role;