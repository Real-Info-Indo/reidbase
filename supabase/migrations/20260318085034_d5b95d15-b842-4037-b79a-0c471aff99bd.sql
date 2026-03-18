ALTER TABLE public.chat_logs
  ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes integer NOT NULL DEFAULT 0;

-- Allow DELETE for admin cleanup
CREATE POLICY "Chat logs are deletable by anyone"
  ON public.chat_logs
  FOR DELETE
  TO anon, authenticated
  USING (true);