ALTER TABLE public.properties_2025 RENAME TO reid_properties;
ALTER TABLE public.rentals_2025 RENAME TO reid_rentals;
ALTER SEQUENCE IF EXISTS public.rentals_2025_id_seq RENAME TO reid_rentals_id_seq;