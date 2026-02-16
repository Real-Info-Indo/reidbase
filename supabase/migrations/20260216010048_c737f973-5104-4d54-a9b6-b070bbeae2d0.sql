
-- Create properties_2025 table for real estate data
CREATE TABLE public.properties_2025 (
  uqid INTEGER PRIMARY KEY,
  id TEXT,
  region TEXT,
  location TEXT,
  contract_type TEXT,
  property_type TEXT,
  years INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  land_size_sqm NUMERIC,
  build_size_sqm NUMERIC,
  fsr TEXT,
  price_idr NUMERIC,
  price_usd NUMERIC,
  price_per_sqm_usd NUMERIC,
  price_per_year_usd NUMERIC,
  availability TEXT,
  sold_date TEXT,
  scrape_date TEXT,
  days_listed INTEGER,
  off_plan TEXT
);

-- Enable RLS
ALTER TABLE public.properties_2025 ENABLE ROW LEVEL SECURITY;

-- Public read access (property data is public)
CREATE POLICY "Properties are publicly readable"
  ON public.properties_2025
  FOR SELECT
  USING (true);
