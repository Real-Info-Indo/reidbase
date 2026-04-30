ALTER TABLE public.chat_logs
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS summary_message_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chat_logs_folder_user
  ON public.chat_logs (wix_user_id, folder_id, updated_at DESC)
  WHERE folder_id IS NOT NULL AND deleted_at IS NULL;