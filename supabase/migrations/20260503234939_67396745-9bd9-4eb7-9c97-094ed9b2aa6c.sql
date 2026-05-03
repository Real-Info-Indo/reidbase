-- Add files column to appraisal_requests for attached file metadata
ALTER TABLE public.appraisal_requests
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create private storage bucket for appraisal attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('appraisals', 'appraisals', false)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone (including anon-with-Wix-token clients) to upload into the
-- appraisals bucket under the appraisal-requests/ prefix. Reads are restricted
-- (no SELECT policy = service role only via Edge Functions / admin).
DROP POLICY IF EXISTS "Appraisal uploads are insertable" ON storage.objects;
CREATE POLICY "Appraisal uploads are insertable"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'appraisals'
    AND (storage.foldername(name))[1] = 'appraisal-requests'
  );
