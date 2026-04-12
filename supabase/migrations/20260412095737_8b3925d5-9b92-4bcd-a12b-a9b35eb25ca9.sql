CREATE TABLE public.chat_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id text NOT NULL,
  wix_user_id text,
  wix_user_name text,
  wix_user_email text,
  flagged_message text NOT NULL,
  category text NOT NULL DEFAULT 'untrustworthy',
  severity text NOT NULL DEFAULT 'medium',
  details text,
  reviewed boolean NOT NULL DEFAULT false,
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat flags insertable by anyone" ON public.chat_flags FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Chat flags readable by anyone" ON public.chat_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Chat flags updatable by anyone" ON public.chat_flags FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);