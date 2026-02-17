
-- Create a secure function to execute read-only queries
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
  
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
