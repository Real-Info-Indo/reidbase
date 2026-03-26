CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_user_id text NOT NULL,
  session_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX idx_user_sessions_wix_user_id ON public.user_sessions (wix_user_id);

-- Unique constraint: one active session per user
CREATE UNIQUE INDEX idx_user_sessions_unique_user ON public.user_sessions (wix_user_id);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read/insert/update/delete (using anon key, no Supabase auth)
CREATE POLICY "Sessions readable by anyone" ON public.user_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Sessions insertable by anyone" ON public.user_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Sessions updatable by anyone" ON public.user_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Sessions deletable by anyone" ON public.user_sessions FOR DELETE TO anon, authenticated USING (true);