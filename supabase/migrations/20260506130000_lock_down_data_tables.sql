-- Remove public SELECT policies from the core data tables.
--
-- All reads go through execute_readonly_query (SECURITY DEFINER), which
-- bypasses RLS and is restricted to service_role only. Dropping these
-- policies closes the direct REST API bulk-download vector while leaving
-- all existing chat and analytics functionality untouched.

DROP POLICY IF EXISTS "Properties are publicly readable" ON public.properties_2025;
DROP POLICY IF EXISTS "Rentals are publicly readable"    ON public.rentals_2025;

-- Harden execute_readonly_query: enforce a 500-row result cap so a
-- single call can never return the full dataset even via the service role.
-- The chat function prompts for LIMIT 50 on non-aggregate queries, but
-- this provides a hard ceiling at the DB level.
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

  -- Only allow SELECT statements
  IF NOT (upper_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords
  IF upper_query ~ '(DELETE|DROP|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE)' THEN
    RAISE EXCEPTION 'Forbidden SQL operation detected';
  END IF;

  -- Wrap in a 500-row cap so a single call can never dump the full table
  EXECUTE format(
    'SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM (%s) raw LIMIT 500) t',
    query_text
  ) INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Ensure grants remain correct after the OR REPLACE
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) TO service_role;
