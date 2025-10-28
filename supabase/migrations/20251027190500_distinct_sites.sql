-- Lightweight RPC to list distinct site names from points
-- Returns SETOF text for PostgREST consumption

CREATE OR REPLACE FUNCTION public.distinct_sites()
RETURNS SETOF text
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT site_name
  FROM public.points
  WHERE site_name IS NOT NULL AND site_name <> ''
  ORDER BY site_name
$$;

