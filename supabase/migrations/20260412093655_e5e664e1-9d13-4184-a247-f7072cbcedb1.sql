
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wix_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  business TEXT,
  nickname TEXT,
  occupation TEXT,
  about TEXT,
  tier TEXT,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User profiles readable by anyone"
  ON public.user_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "User profiles insertable by anyone"
  ON public.user_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "User profiles updatable by anyone"
  ON public.user_profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
