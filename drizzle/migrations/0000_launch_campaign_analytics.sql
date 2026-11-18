CREATE OR REPLACE FUNCTION public.admin_campaign_analytics(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH campaigns(slug, title) AS (VALUES ('q1-report','Bali Q1 2026'), ('h1-report','Bali H1 2026'), ('q3-report','Bali Q3 2026')),
ev AS MATERIALIZED (
 SELECT e.*, coalesce(nullif(e.metadata->>'slug',''), substring(e.page_path from '^/campaign/([a-z0-9-]+)')) AS slug
 FROM public.analytics_events e WHERE e.created_at >= p_from AND e.created_at <= p_to
 AND (e.page_path LIKE '/campaign/%' OR e.event_name = 'campaign_report_download')
),
identities AS MATERIALIZED (
 SELECT session_id, min(wix_user_id) AS wix_user_id FROM public.analytics_events
 WHERE created_at >= p_from AND created_at <= p_to AND session_id IS NOT NULL AND wix_user_id IS NOT NULL
 AND metadata->>'trusted' = 'true' GROUP BY session_id HAVING count(DISTINCT wix_user_id) = 1
),
activity AS MATERIALIZED (
 SELECT e.*, coalesce(CASE WHEN e.metadata->>'trusted' = 'true' THEN e.wix_user_id END, i.wix_user_id) AS known_user,
 coalesce(nullif(e.session_id,''), 'event:' || e.id::text) AS visit_key
 FROM ev e LEFT JOIN identities i ON e.session_id = i.session_id
),
visitors AS (
 SELECT slug, known_user, count(*) FILTER (WHERE event_type = 'page_view') AS page_views,
 count(*) FILTER (WHERE event_name = 'campaign_report_download') AS downloads,
 min(created_at) AS first_seen, max(created_at) AS last_seen
 FROM activity WHERE known_user IS NOT NULL GROUP BY slug, known_user
)
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'slug', c.slug, 'title', c.title,
 'visitors', (SELECT count(DISTINCT visit_key) FROM activity WHERE slug = c.slug AND (event_type = 'page_view' OR event_name = 'campaign_view')),
 'page_views', (SELECT count(*) FROM activity WHERE slug = c.slug AND event_type = 'page_view'),
 'identified_users', (SELECT count(DISTINCT known_user) FROM activity WHERE slug = c.slug),
 'anonymous_visits', (SELECT count(DISTINCT visit_key) FROM activity WHERE slug = c.slug AND known_user IS NULL AND (event_type = 'page_view' OR event_name = 'campaign_view')),
 'downloads', (SELECT count(*) FROM activity WHERE slug = c.slug AND event_name = 'campaign_report_download'),
 'visitor_details', (SELECT coalesce(jsonb_agg(jsonb_build_object('wix_user_id', v.known_user, 'display_name', p.display_name, 'email', p.email, 'page_views', v.page_views, 'downloads', v.downloads, 'first_seen', v.first_seen, 'last_seen', v.last_seen) ORDER BY v.last_seen DESC), '[]'::jsonb) FROM visitors v LEFT JOIN public.user_profiles p ON p.wix_user_id = v.known_user WHERE v.slug = c.slug)
) ORDER BY c.slug), '[]'::jsonb) FROM campaigns c;
$$;
REVOKE ALL ON FUNCTION public.admin_campaign_analytics(timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_analytics(timestamptz,timestamptz) TO service_role;
CREATE INDEX IF NOT EXISTS analytics_events_campaign_range_idx ON public.analytics_events(created_at, page_path) WHERE page_path LIKE '/campaign/%' OR event_name = 'campaign_report_download';