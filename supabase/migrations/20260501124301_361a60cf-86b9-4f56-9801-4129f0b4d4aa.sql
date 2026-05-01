REVOKE ALL ON FUNCTION public.has_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_admin(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.has_admin(TEXT) FROM authenticated;