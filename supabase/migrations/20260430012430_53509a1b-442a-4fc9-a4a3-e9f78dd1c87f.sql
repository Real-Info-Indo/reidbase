CREATE TABLE public.shared_conversations (
  id text PRIMARY KEY,
  source_conversation_id text,
  title text NOT NULL DEFAULT 'Shared conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  search_mode text,
  sharer_wix_user_id text,
  sharer_name text,
  sharer_tier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shared conversations readable by anyone"
  ON public.shared_conversations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Shared conversations insertable by anyone"
  ON public.shared_conversations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX idx_shared_conversations_created_at ON public.shared_conversations(created_at DESC);