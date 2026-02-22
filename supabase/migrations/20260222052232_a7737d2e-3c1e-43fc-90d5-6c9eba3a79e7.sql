
CREATE TABLE public.rentals_2025 (
  id SERIAL PRIMARY KEY,
  date TEXT,
  region TEXT,
  location TEXT,
  type TEXT,
  mgmt TEXT,
  beds INTEGER,
  count INTEGER,
  occupancy NUMERIC,
  rate_usd NUMERIC,
  monthly_usd NUMERIC,
  total_usd NUMERIC
);

ALTER TABLE public.rentals_2025 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rentals are publicly readable"
ON public.rentals_2025
FOR SELECT
USING (true);

CREATE UNIQUE INDEX idx_rentals_2025_unique ON public.rentals_2025 (date, region, location, type, mgmt, beds);
