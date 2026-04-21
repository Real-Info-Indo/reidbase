CREATE TABLE public.chat_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_index INTEGER,
  rating TEXT NOT NULL,
  comment TEXT,
  wix_user_id TEXT,
  wix_user_name TEXT,
  wix_user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert feedback"
ON public.chat_feedback FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read feedback"
ON public.chat_feedback FOR SELECT
USING (true);

CREATE INDEX idx_chat_feedback_conversation ON public.chat_feedback(conversation_id);