CREATE TABLE public.chat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  wix_user_id TEXT,
  wix_user_name TEXT,
  wix_user_email TEXT,
  title TEXT NOT NULL DEFAULT 'New conversation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_mode TEXT DEFAULT 'data-analyst',
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_logs_conversation_id ON public.chat_logs(conversation_id);
CREATE INDEX idx_chat_logs_wix_user_id ON public.chat_logs(wix_user_id);
CREATE INDEX idx_chat_logs_updated_at ON public.chat_logs(updated_at DESC);

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat logs are insertable by anyone" ON public.chat_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Chat logs are updatable by anyone" ON public.chat_logs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Chat logs are readable by anyone" ON public.chat_logs
  FOR SELECT TO anon, authenticated USING (true);