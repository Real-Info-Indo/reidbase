ALTER FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) RENAME TO check_and_increment_free_prompt_old;
CREATE OR REPLACE FUNCTION public.check_and_increment_free_prompt(
  p_wix_user_id TEXT,
  p_daily_limit  INTEGER DEFAULT 5
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.user_profiles (wix_user_id, free_prompts_today, free_prompts_date)
  VALUES (p_wix_user_id, 1, CURRENT_DATE)
  ON CONFLICT (wix_user_id) DO UPDATE
    SET free_prompts_today = CASE
        WHEN user_profiles.free_prompts_date IS DISTINCT FROM CURRENT_DATE THEN 1
        WHEN user_profiles.free_prompts_today >= p_daily_limit THEN user_profiles.free_prompts_today
        ELSE user_profiles.free_prompts_today + 1
      END,
      free_prompts_date = CURRENT_DATE
  RETURNING free_prompts_today INTO v_count;

  RETURN v_count <= p_daily_limit;
END;
$$;
DROP FUNCTION public.check_and_increment_free_prompt_old(TEXT, INTEGER);
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) TO service_role;