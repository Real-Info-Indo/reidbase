CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tz constant text := 'Asia/Makassar';
  v_summary jsonb;
  v_page_views_by_day jsonb;
  v_chats_by_day jsonb;
  v_appraisals_by_day jsonb;
  v_top_pages jsonb;
  v_feature_usage jsonb;
  v_conversations_by_mode jsonb;
  v_funnel jsonb;
  v_mode_performance jsonb;
  v_top_referrers jsonb;
  v_top_campaigns jsonb;
  v_new_appraisal_count int;
  v_appraisal_requests_total int;
  v_appraisal_cta_events int;
BEGIN
  -- Authoritative: count from appraisal_requests rows in range.
  SELECT count(*)::int INTO v_appraisal_requests_total
    FROM public.appraisal_requests
   WHERE created_at >= p_from AND created_at <= p_to;

  -- Non-authoritative: client-side `appraisal_submitted` feature event.
  SELECT count(*)::int INTO v_appraisal_cta_events
    FROM public.analytics_events
   WHERE event_type = 'feature'
     AND event_name = 'appraisal_submitted'
     AND created_at >= p_from AND created_at <= p_to;

  WITH ev AS (
    SELECT * FROM public.analytics_events
     WHERE created_at >= p_from AND created_at <= p_to
  ), cl AS (
    SELECT * FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
  )
  SELECT jsonb_build_object(
    'page_views',              (SELECT count(*) FROM ev WHERE event_type = 'page_view'),
    'feature_events',          (SELECT count(*) FROM ev WHERE event_type = 'feature'),
    'unique_users',            (SELECT count(DISTINCT wix_user_id) FROM ev WHERE wix_user_id IS NOT NULL),
    'unique_sessions',         (SELECT count(DISTINCT session_id) FROM ev WHERE session_id IS NOT NULL),
    'conversations',           (SELECT count(*) FROM cl),
    'total_messages',          (SELECT COALESCE(sum(message_count), 0) FROM cl),
    'appraisal_requests',      v_appraisal_requests_total,
    'appraisal_cta_events',    v_appraisal_cta_events,
    -- Back-compat alias; now sourced from appraisal_requests rows.
    'appraisal_submissions',   v_appraisal_requests_total
  ) INTO v_summary;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'views', c) ORDER BY d), '[]'::jsonb)
    INTO v_page_views_by_day
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d,
           count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view'
       AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'chats', c) ORDER BY d), '[]'::jsonb)
    INTO v_chats_by_day
  FROM (
    SELECT to_char((updated_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d,
           count(*)::int AS c
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ) t;

  -- Authoritative appraisal requests bucketed per WITA day.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'requests', c) ORDER BY d), '[]'::jsonb)
    INTO v_appraisals_by_day
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d,
           count(*)::int AS c
      FROM public.appraisal_requests
     WHERE created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('page', page, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_pages
  FROM (
    SELECT COALESCE(page_path, '/') AS page, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view'
       AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
     ORDER BY c DESC
     LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_name', event_name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_feature_usage
  FROM (
    SELECT event_name, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'feature'
       AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
     ORDER BY c DESC
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('mode', mode, 'value', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_conversations_by_mode
  FROM (
    SELECT COALESCE(search_mode, 'data-analyst') AS mode, count(*)::int AS c
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ) t;

  -- Funnel: appraisal step now uses authoritative request rows.
  SELECT jsonb_build_object(
    'landing_views',       (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'page_view'
                               AND COALESCE(page_path, '/') = '/'
                               AND created_at >= p_from AND created_at <= p_to),
    'login_started',       (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'feature' AND event_name = 'login_started'
                               AND created_at >= p_from AND created_at <= p_to),
    'login_success',       (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'feature' AND event_name = 'login_success'
                               AND created_at >= p_from AND created_at <= p_to),
    'first_prompt',        (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'feature' AND event_name = 'funnel_first_prompt'
                               AND created_at >= p_from AND created_at <= p_to),
    'report_view',         (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'feature' AND event_name = 'funnel_report_view'
                               AND created_at >= p_from AND created_at <= p_to),
    'appraisal_submitted', v_appraisal_requests_total,
    'appraisal_cta_events',v_appraisal_cta_events
  ) INTO v_funnel;

  WITH chat_part AS (
    SELECT COALESCE(search_mode, 'data-analyst') AS mode,
           count(*)::int                   AS conversations,
           COALESCE(sum(message_count), 0)::int AS total_messages,
           count(DISTINCT wix_user_id) FILTER (WHERE wix_user_id IS NOT NULL)::int AS chat_users
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ), event_part AS (
    SELECT COALESCE(NULLIF(metadata->>'search_mode', ''), 'data-analyst') AS mode,
           count(*) FILTER (WHERE event_name = 'chat_message_sent')::int       AS prompts,
           count(*) FILTER (WHERE event_name = 'chat_response_completed')::int AS completed,
           count(DISTINCT wix_user_id) FILTER (WHERE wix_user_id IS NOT NULL)::int AS event_users
      FROM public.analytics_events
     WHERE event_type = 'feature'
       AND event_name IN ('chat_message_sent', 'chat_response_completed')
       AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ), merged AS (
    SELECT mode FROM chat_part
    UNION
    SELECT mode FROM event_part
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mode',           m.mode,
    'conversations',  COALESCE(c.conversations, 0),
    'total_messages', COALESCE(c.total_messages, 0),
    'prompts',        COALESCE(e.prompts, 0),
    'completed',      COALESCE(e.completed, 0),
    'unique_users',   GREATEST(COALESCE(c.chat_users, 0), COALESCE(e.event_users, 0))
  ) ORDER BY COALESCE(c.conversations, 0) DESC), '[]'::jsonb)
    INTO v_mode_performance
  FROM merged m
  LEFT JOIN chat_part c USING (mode)
  LEFT JOIN event_part e USING (mode);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('referrer', host, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_referrers
  FROM (
    SELECT lower((regexp_match(metadata->>'referrer', '^[a-z]+://([^/]+)'))[1]) AS host,
           count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view'
       AND created_at >= p_from AND created_at <= p_to
       AND metadata ? 'referrer'
       AND length(COALESCE(metadata->>'referrer','')) > 0
     GROUP BY 1
    HAVING (regexp_match(metadata->>'referrer', '^[a-z]+://([^/]+)'))[1] IS NOT NULL
       AND lower((regexp_match(metadata->>'referrer', '^[a-z]+://([^/]+)'))[1]) NOT IN
           ('reidbase.lovable.app','app.realinfo.id','ai.realinfo.id','www.realinfo.id','realinfo.id','localhost','127.0.0.1')
     ORDER BY c DESC
     LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'source',   COALESCE(metadata->>'utm_source', ''),
           'medium',   COALESCE(metadata->>'utm_medium', ''),
           'campaign', COALESCE(metadata->>'utm_campaign', ''),
           'count',    c
         ) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_campaigns
  FROM (
    SELECT metadata, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view'
       AND created_at >= p_from AND created_at <= p_to
       AND (metadata ? 'utm_source' OR metadata ? 'utm_medium' OR metadata ? 'utm_campaign')
     GROUP BY metadata->>'utm_source', metadata->>'utm_medium', metadata->>'utm_campaign', metadata
     ORDER BY c DESC
     LIMIT 12
  ) t;

  SELECT count(*)::int INTO v_new_appraisal_count
    FROM public.appraisal_requests WHERE status = 'new';

  RETURN jsonb_build_object(
    'summary',                v_summary,
    'page_views_by_day',      v_page_views_by_day,
    'chats_by_day',           v_chats_by_day,
    'appraisals_by_day',      v_appraisals_by_day,
    'top_pages',              v_top_pages,
    'feature_usage',          v_feature_usage,
    'conversations_by_mode',  v_conversations_by_mode,
    'funnel',                 v_funnel,
    'mode_performance',       v_mode_performance,
    'top_referrers',          v_top_referrers,
    'top_campaigns',          v_top_campaigns,
    'new_appraisal_count',    v_new_appraisal_count,
    'appraisal_requests_total', v_appraisal_requests_total,
    'appraisal_cta_events',   v_appraisal_cta_events
  );
END;
$function$;