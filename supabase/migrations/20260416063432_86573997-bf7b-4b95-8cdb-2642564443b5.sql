-- Change 1: Add columns to chat_logs
ALTER TABLE public.chat_logs
ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN folder_id TEXT;

-- Change 2: Create folders table
CREATE TABLE public.folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  wix_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX folders_wix_user_id_idx ON public.folders(wix_user_id);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Folders readable by anyone"
  ON public.folders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Folders insertable by anyone"
  ON public.folders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Folders updatable by anyone"
  ON public.folders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Folders deletable by anyone"
  ON public.folders FOR DELETE
  TO anon, authenticated
  USING (true);