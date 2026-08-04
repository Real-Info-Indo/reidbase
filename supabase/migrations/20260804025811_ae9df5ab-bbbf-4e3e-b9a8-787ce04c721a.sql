ALTER TABLE public.reid_rentals ALTER COLUMN date TYPE text;

UPDATE public.reid_rentals
SET date        = region,
    region      = location,
    location    = type,
    type        = mgmt,
    mgmt        = NULL,
    beds        = count,
    count       = occupancy::int,
    occupancy   = NULL,
    rate_usd    = monthly_usd,
    monthly_usd = total_usd,
    total_usd   = NULL
WHERE region ~ '^[A-Z][a-z]{2}/[0-9]{2}$';