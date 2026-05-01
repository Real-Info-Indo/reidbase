CREATE OR REPLACE FUNCTION public.increment_chat_feedback_counter(
  _conversation_id text,
  _wix_user_id text,
  _kind text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value integer;
BEGIN
  IF _kind NOT IN ('copy', 'like', 'dislike') THEN
    RAISE EXCEPTION 'invalid_kind: %', _kind;
  END IF;

  IF _kind = 'copy' THEN
    UPDATE public.chat_logs
       SET copy_count = COALESCE(copy_count, 0) + 1
     WHERE conversation_id = _conversation_id
       AND (wix_user_id IS NULL OR wix_user_id = _wix_user_id)
    RETURNING copy_count INTO new_value;
  ELSIF _kind = 'like' THEN
    UPDATE public.chat_logs
       SET likes = COALESCE(likes, 0) + 1
     WHERE conversation_id = _conversation_id
       AND (wix_user_id IS NULL OR wix_user_id = _wix_user_id)
    RETURNING likes INTO new_value;
  ELSE
    UPDATE public.chat_logs
       SET dislikes = COALESCE(dislikes, 0) + 1
     WHERE conversation_id = _conversation_id
       AND (wix_user_id IS NULL OR wix_user_id = _wix_user_id)
    RETURNING dislikes INTO new_value;
  END IF;

  RETURN new_value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_chat_feedback_counter(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_chat_feedback_counter(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_chat_feedback_counter(text, text, text) FROM authenticated;