CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tz constant text := 'Asia/Makassar';
  v_now constant timestamptz := now();
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
  v_retention_snapshot jsonb;
  v_weekly_cohorts jsonb;
  v_total_known_users int;
  v_active_7d int;
  v_active_30d int;
  v_new_30d int;
  v_returning int;
BEGIN
  SELECT count(*)::int INTO v_appraisal_requests_total
    FROM public.appraisal_requests
   WHERE created_at >= p_from AND created_at <= p_to;

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
    'appraisal_submissions',   v_appraisal_requests_total
  ) INTO v_summary;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'views', c) ORDER BY d), '[]'::jsonb)
    INTO v_page_views_by_day
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view' AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'chats', c) ORDER BY d), '[]'::jsonb)
    INTO v_chats_by_day
  FROM (
    SELECT to_char((updated_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d, count(*)::int AS c
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day_key', d, 'requests', c) ORDER BY d), '[]'::jsonb)
    INTO v_appraisals_by_day
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_tz)::date, 'YYYY-MM-DD') AS d, count(*)::int AS c
      FROM public.appraisal_requests
     WHERE created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('page', page, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_pages
  FROM (
    SELECT COALESCE(page_path, '/') AS page, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view' AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1 ORDER BY c DESC LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('event_name', event_name, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_feature_usage
  FROM (
    SELECT event_name, count(*)::int AS c
      FROM public.analytics_events
     WHERE event_type = 'feature' AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1 ORDER BY c DESC
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('mode', mode, 'value', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_conversations_by_mode
  FROM (
    SELECT COALESCE(search_mode, 'data-analyst') AS mode, count(*)::int AS c
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ) t;

  SELECT jsonb_build_object(
    'landing_views',       (SELECT count(*) FROM public.analytics_events
                             WHERE event_type = 'page_view' AND COALESCE(page_path, '/') = '/'
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
           count(*)::int AS conversations,
           COALESCE(sum(message_count), 0)::int AS total_messages
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to
     GROUP BY 1
  ), event_part AS (
    SELECT COALESCE(NULLIF(metadata->>'search_mode', ''), 'data-analyst') AS mode,
           count(*) FILTER (WHERE event_name = 'chat_message_sent')::int       AS prompts,
           count(*) FILTER (WHERE event_name = 'chat_response_completed')::int AS completed
      FROM public.analytics_events
     WHERE event_type = 'feature'
       AND event_name IN ('chat_message_sent', 'chat_response_completed')
       AND created_at >= p_from AND created_at <= p_to
     GROUP BY 1
  ), unioned_users AS (
    SELECT COALESCE(search_mode, 'data-analyst') AS mode, wix_user_id
      FROM public.chat_logs
     WHERE updated_at >= p_from AND updated_at <= p_to AND wix_user_id IS NOT NULL
    UNION
    SELECT COALESCE(NULLIF(metadata->>'search_mode', ''), 'data-analyst') AS mode, wix_user_id
      FROM public.analytics_events
     WHERE event_type = 'feature'
       AND event_name IN ('chat_message_sent', 'chat_response_completed')
       AND created_at >= p_from AND created_at <= p_to
       AND wix_user_id IS NOT NULL
  ), user_part AS (
    SELECT mode, count(DISTINCT wix_user_id)::int AS unique_users
      FROM unioned_users GROUP BY 1
  ), merged AS (
    SELECT mode FROM chat_part
    UNION SELECT mode FROM event_part
    UNION SELECT mode FROM user_part
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'mode', m.mode,
    'conversations',  COALESCE(c.conversations, 0),
    'total_messages', COALESCE(c.total_messages, 0),
    'prompts',        COALESCE(e.prompts, 0),
    'completed',      COALESCE(e.completed, 0),
    'unique_users',   COALESCE(u.unique_users, 0)
  ) ORDER BY COALESCE(c.conversations, 0) DESC), '[]'::jsonb)
    INTO v_mode_performance
  FROM merged m
  LEFT JOIN chat_part c USING (mode)
  LEFT JOIN event_part e USING (mode)
  LEFT JOIN user_part u USING (mode);

  -- Top referrers: do filtering in WHERE so HAVING does not reference ungrouped columns.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('referrer', host, 'count', c) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_referrers
  FROM (
    SELECT host, count(*)::int AS c FROM (
      SELECT lower((regexp_match(metadata->>'referrer', '^[a-z]+://([^/]+)'))[1]) AS host
        FROM public.analytics_events
       WHERE event_type = 'page_view'
         AND created_at >= p_from AND created_at <= p_to
         AND metadata ? 'referrer'
         AND length(COALESCE(metadata->>'referrer','')) > 0
    ) inner_t
    WHERE host IS NOT NULL
      AND host NOT IN ('reidbase.lovable.app','app.realinfo.id','ai.realinfo.id','www.realinfo.id','realinfo.id','localhost','127.0.0.1')
    GROUP BY host
    ORDER BY c DESC LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'source',   source,
           'medium',   medium,
           'campaign', campaign,
           'count',    c
         ) ORDER BY c DESC), '[]'::jsonb)
    INTO v_top_campaigns
  FROM (
    SELECT COALESCE(metadata->>'utm_source', '')   AS source,
           COALESCE(metadata->>'utm_medium', '')   AS medium,
           COALESCE(metadata->>'utm_campaign', '') AS campaign,
           count(*)::int                            AS c
      FROM public.analytics_events
     WHERE event_type = 'page_view' AND created_at >= p_from AND created_at <= p_to
       AND (metadata ? 'utm_source' OR metadata ? 'utm_medium' OR metadata ? 'utm_campaign')
     GROUP BY 1, 2, 3
     ORDER BY c DESC LIMIT 12
  ) t;

  SELECT count(*)::int INTO v_new_appraisal_count
    FROM public.appraisal_requests WHERE status = 'new';

  WITH user_events AS (
    SELECT wix_user_id, created_at,
           lag(created_at) OVER (PARTITION BY wix_user_id ORDER BY created_at) AS prev_at
      FROM public.analytics_events
     WHERE wix_user_id IS NOT NULL
  ),
  sessionised AS (
    SELECT wix_user_id, created_at,
           CASE WHEN prev_at IS NULL OR created_at - prev_at >= interval '24 hours' THEN 1 ELSE 0 END AS is_new_session
      FROM user_events
  ),
  per_user AS (
    SELECT wix_user_id,
           min(created_at) AS first_seen,
           max(created_at) AS last_seen,
           sum(is_new_session)::int AS session_count
      FROM sessionised
     GROUP BY 1
  ),
  per_user_returning AS (
    SELECT pu.wix_user_id, pu.first_seen, pu.last_seen, pu.session_count,
           EXISTS (
             SELECT 1 FROM sessionised s
              WHERE s.wix_user_id = pu.wix_user_id
                AND s.is_new_session = 1
                AND s.created_at >= pu.first_seen + interval '24 hours'
           ) AS is_returning
      FROM per_user pu
  )
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE last_seen >= v_now - interval '7 days')::int,
    count(*) FILTER (WHERE last_seen >= v_now - interval '30 days')::int,
    count(*) FILTER (WHERE first_seen >= v_now - interval '30 days')::int,
    count(*) FILTER (WHERE is_returning)::int
    INTO v_total_known_users, v_active_7d, v_active_30d, v_new_30d, v_returning
  FROM per_user_returning;

  v_retention_snapshot := jsonb_build_object(
    'total_known_users', COALESCE(v_total_known_users, 0),
    'active_users_7d',   COALESCE(v_active_7d, 0),
    'active_users_30d',  COALESCE(v_active_30d, 0),
    'new_users_30d',     COALESCE(v_new_30d, 0),
    'returning_users',   COALESCE(v_returning, 0),
    'repeat_rate',
      CASE WHEN COALESCE(v_total_known_users, 0) = 0 THEN 0
           ELSE round((v_returning::numeric / v_total_known_users::numeric)::numeric, 4)
      END,
    'computed_at',       v_now,
    'window',            'all_time'
  );

  WITH user_events AS (
    SELECT wix_user_id, created_at
      FROM public.analytics_events
     WHERE wix_user_id IS NOT NULL
  ),
  per_user AS (
    SELECT wix_user_id, min(created_at) AS first_seen, max(created_at) AS last_seen
      FROM user_events GROUP BY 1
  ),
  with_retained AS (
    SELECT pu.wix_user_id, pu.first_seen,
           EXISTS (
             SELECT 1 FROM user_events e
              WHERE e.wix_user_id = pu.wix_user_id
                AND e.created_at >= pu.first_seen + interval '24 hours'
           ) AS retained
      FROM per_user pu
  ),
  cohorts AS (
    SELECT to_char(date_trunc('week', (first_seen AT TIME ZONE v_tz))::date, 'IYYY-"W"IW') AS cohort_week,
           date_trunc('week', (first_seen AT TIME ZONE v_tz))::date AS cohort_start,
           count(*)::int AS cohort_size,
           count(*) FILTER (WHERE retained)::int AS retained_users
      FROM with_retained
     GROUP BY 1, 2
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'cohort_week',     cohort_week,
           'cohort_start',    to_char(cohort_start, 'YYYY-MM-DD'),
           'cohort_size',     cohort_size,
           'retained_users',  retained_users,
           'retention_rate',  CASE WHEN cohort_size = 0 THEN 0
                                   ELSE round((retained_users::numeric / cohort_size::numeric)::numeric, 4) END
         ) ORDER BY cohort_start DESC), '[]'::jsonb)
    INTO v_weekly_cohorts
  FROM cohorts;

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
    'appraisal_cta_events',   v_appraisal_cta_events,
    'retention_snapshot',     v_retention_snapshot,
    'weekly_retention_cohorts', v_weekly_cohorts
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_analytics_summary(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary(timestamptz, timestamptz) TO service_role;

-- Per-user engagement aggregates for the admin user directory.
-- Returns one row per wix_user_id with counts and small JSON breakdowns,
-- so the client never has to scan raw analytics_events / chat_logs.
CREATE OR REPLACE FUNCTION public.admin_user_aggregates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_users jsonb;
BEGIN
  WITH ev AS (
    SELECT wix_user_id, event_type, event_name, page_path, metadata
      FROM public.analytics_events
     WHERE wix_user_id IS NOT NULL
  ),
  page_counts AS (
    SELECT wix_user_id, count(*)::int AS page_views
      FROM ev WHERE event_type = 'page_view'
     GROUP BY 1
  ),
  download_counts AS (
    SELECT wix_user_id, count(*)::int AS downloads
      FROM ev WHERE event_name = 'report_download'
     GROUP BY 1
  ),
  appraisal_counts AS (
    SELECT wix_user_id, count(*)::int AS appraisal_count
      FROM ev WHERE event_name = 'appraisal_submitted'
     GROUP BY 1
  ),
  chat_counts AS (
    SELECT wix_user_id, count(*)::int AS chat_count
      FROM public.chat_logs
     WHERE wix_user_id IS NOT NULL
     GROUP BY 1
  ),
  top_pages_per_user AS (
    SELECT wix_user_id,
           jsonb_object_agg(page, c) AS pages
      FROM (
        SELECT wix_user_id, COALESCE(page_path, 'unknown') AS page, count(*)::int AS c,
               row_number() OVER (PARTITION BY wix_user_id ORDER BY count(*) DESC) AS rn
          FROM ev WHERE event_type = 'page_view'
         GROUP BY wix_user_id, page
      ) ranked
     WHERE rn <= 20
     GROUP BY wix_user_id
  ),
  download_items_per_user AS (
    SELECT wix_user_id,
           jsonb_agg(item ORDER BY item) AS items
      FROM (
        SELECT wix_user_id,
               COALESCE(metadata->>'report', metadata->>'name', page_path, 'Report') AS item,
               row_number() OVER (PARTITION BY wix_user_id ORDER BY (COALESCE(metadata->>'report', metadata->>'name', page_path, 'Report'))) AS rn
          FROM ev WHERE event_name = 'report_download'
      ) d
     WHERE rn <= 50
     GROUP BY wix_user_id
  ),
  all_users AS (
    SELECT wix_user_id FROM page_counts
    UNION SELECT wix_user_id FROM download_counts
    UNION SELECT wix_user_id FROM appraisal_counts
    UNION SELECT wix_user_id FROM chat_counts
  )
  SELECT COALESCE(jsonb_object_agg(au.wix_user_id, jsonb_build_object(
           'pageViews',      COALESCE(p.page_views, 0),
           'downloads',      COALESCE(d.downloads, 0),
           'appraisalCount', COALESCE(a.appraisal_count, 0),
           'chatCount',      COALESCE(c.chat_count, 0),
           'pages',          COALESCE(tp.pages, '{}'::jsonb),
           'downloadItems',  COALESCE(di.items, '[]'::jsonb)
         )), '{}'::jsonb)
    INTO v_users
    FROM all_users au
    LEFT JOIN page_counts p USING (wix_user_id)
    LEFT JOIN download_counts d USING (wix_user_id)
    LEFT JOIN appraisal_counts a USING (wix_user_id)
    LEFT JOIN chat_counts c USING (wix_user_id)
    LEFT JOIN top_pages_per_user tp USING (wix_user_id)
    LEFT JOIN download_items_per_user di USING (wix_user_id);

  RETURN COALESCE(v_users, '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_user_aggregates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_aggregates() TO service_role;