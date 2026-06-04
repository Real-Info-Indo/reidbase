DROP POLICY IF EXISTS "Analytics events insertable by anyone" ON public.analytics_events;
REVOKE INSERT ON public.analytics_events FROM anon, authenticated;