CREATE OR REPLACE FUNCTION public.admin_campaign_analytics(p_from timestamptz, p_to timestamptz) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $function$
WITH campaigns(slug,title) AS (VALUES ('q1-report','Bali Q1 2026'),('h1-report','Bali H1 2026'),('q3-report','Bali Q3 2026')),
all_events AS MATERIALIZED (SELECT * FROM public.analytics_events WHERE created_at >= p_from AND created_at <= p_to),
ev AS MATERIALIZED (SELECT e.*, coalesce(nullif(e.metadata->>'slug',''),substring(e.page_path from '^/campaign/([a-z0-9-]+)')) AS slug FROM all_events e WHERE e.page_path LIKE '/campaign/%' OR e.event_name = 'campaign_report_download'),
identities AS MATERIALIZED (SELECT session_id,min(wix_user_id) AS wix_user_id FROM all_events WHERE session_id IS NOT NULL AND wix_user_id IS NOT NULL AND metadata->>'trusted' = 'true' GROUP BY session_id HAVING count(DISTINCT wix_user_id)=1),
activity AS MATERIALIZED (SELECT e.*,coalesce(CASE WHEN e.metadata->>'trusted'='true' THEN e.wix_user_id END,i.wix_user_id) AS known_user,coalesce(nullif(e.session_id,''),'event:'||e.id::text) AS visit_key FROM ev e LEFT JOIN identities i ON e.session_id=i.session_id),
visits AS MATERIALIZED (SELECT slug,visit_key,min(created_at) AS first_seen FROM activity WHERE event_type='page_view' OR event_name='campaign_view' GROUP BY slug,visit_key),
visitors AS (SELECT slug,known_user,count(*) FILTER(WHERE event_type='page_view') AS page_views,count(*) FILTER(WHERE event_name='campaign_report_download') AS downloads,min(created_at) AS first_seen,max(created_at) AS last_seen FROM activity WHERE known_user IS NOT NULL GROUP BY slug,known_user),
acquisition AS (SELECT DISTINCT ON (a.slug,a.visit_key) a.slug,a.visit_key,coalesce(nullif(a.metadata->>'utm_source',''),'Unattributed') AS source,coalesce(nullif(a.metadata->>'utm_medium',''),'Unattributed') AS medium,coalesce(nullif(a.metadata->>'utm_campaign',''),'Untagged') AS campaign FROM activity a WHERE event_type='page_view' ORDER BY a.slug,a.visit_key,a.created_at),
source_counts AS (SELECT slug,source,medium,campaign,count(*) AS visits FROM acquisition GROUP BY slug,source,medium,campaign)
SELECT coalesce(jsonb_agg(jsonb_build_object(
'slug',c.slug,'title',c.title,
'visitors',(SELECT count(*) FROM visits WHERE slug=c.slug),
'page_views',(SELECT count(*) FROM activity WHERE slug=c.slug AND event_type='page_view'),
'identified_users',(SELECT count(DISTINCT known_user) FROM activity WHERE slug=c.slug),
'anonymous_visits',(SELECT count(DISTINCT visit_key) FROM activity WHERE slug=c.slug AND known_user IS NULL AND (event_type='page_view' OR event_name='campaign_view')),
'downloads',(SELECT count(*) FROM activity WHERE slug=c.slug AND event_name='campaign_report_download'),
'downloading_visits',(SELECT count(*) FROM visits v WHERE v.slug=c.slug AND EXISTS(SELECT 1 FROM activity a WHERE a.slug=v.slug AND a.visit_key=v.visit_key AND a.event_name='campaign_report_download' AND a.created_at>=v.first_seen)),
'signin_prompt_visits',(SELECT count(*) FROM visits v WHERE v.slug=c.slug AND EXISTS(SELECT 1 FROM activity a WHERE a.slug=v.slug AND a.visit_key=v.visit_key AND a.event_name='campaign_signin_prompt' AND a.created_at>=v.first_seen)),
'followup_visits',(SELECT count(*) FROM visits v WHERE v.slug=c.slug AND EXISTS(SELECT 1 FROM all_events e WHERE e.session_id=v.visit_key AND e.event_name='chat_message_sent' AND e.metadata->>'trusted'='true' AND e.created_at>=v.first_seen)),
'identified_downloaders',(SELECT count(*) FROM visitors WHERE slug=c.slug AND downloads>0),
'traffic_sources',(SELECT coalesce(jsonb_agg(jsonb_build_object('source',s.source,'medium',s.medium,'campaign',s.campaign,'visits',s.visits) ORDER BY s.visits DESC),'[]'::jsonb) FROM source_counts s WHERE s.slug=c.slug),
'visitor_details',(SELECT coalesce(jsonb_agg(jsonb_build_object('wix_user_id',v.known_user,'display_name',p.display_name,'email',p.email,'page_views',v.page_views,'downloads',v.downloads,'first_seen',v.first_seen,'last_seen',v.last_seen) ORDER BY v.last_seen DESC),'[]'::jsonb) FROM visitors v LEFT JOIN public.user_profiles p ON p.wix_user_id=v.known_user WHERE v.slug=c.slug)
) ORDER BY c.slug),'[]'::jsonb) FROM campaigns c;
$function$;
REVOKE ALL ON FUNCTION public.admin_campaign_analytics(timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_analytics(timestamptz,timestamptz) TO service_role;