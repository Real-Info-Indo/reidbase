ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_chat_logs_wix_user_id ON public.chat_logs(wix_user_id);
CREATE INDEX IF NOT EXISTS idx_folders_wix_user_id ON public.folders(wix_user_id);