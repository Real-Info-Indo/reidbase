
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_name text NOT NULL,
  page_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  wix_user_id text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics events insertable by anyone"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Analytics events readable by anyone"
  ON public.analytics_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_analytics_events_type ON public.analytics_events (event_type);
CREATE INDEX idx_analytics_events_created ON public.analytics_events (created_at);
CREATE INDEX idx_analytics_events_user ON public.analytics_events (wix_user_id);
