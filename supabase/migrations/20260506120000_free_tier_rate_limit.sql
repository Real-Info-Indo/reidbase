-- Add per-user daily prompt tracking to user_profiles for free-tier enforcement.
-- The chat edge function calls check_and_increment_free_prompt() before
-- processing any free-tier request.  The function atomically resets the
-- counter when the date changes and returns TRUE when the request is allowed.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS free_prompts_today   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_prompts_date     DATE;

-- Atomic check-and-increment.
-- Returns TRUE  → request is within the daily limit (counter incremented).
-- Returns FALSE → daily limit already reached (counter NOT incremented).
CREATE OR REPLACE FUNCTION public.check_and_increment_free_prompt(
  p_wix_user_id TEXT,
  p_daily_limit  INTEGER DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today  DATE    := CURRENT_DATE;
  v_count  INTEGER;
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

-- Only the service role (used by edge functions) may call this.
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_and_increment_free_prompt(TEXT, INTEGER) TO service_role;
