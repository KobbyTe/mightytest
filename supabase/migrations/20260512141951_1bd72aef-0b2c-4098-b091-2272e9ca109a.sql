-- Drop the overly-permissive public read policy
DROP POLICY IF EXISTS "Anyone can view available keys" ON public.registration_keys;

-- SECURITY DEFINER RPC for pre-auth validation of a single key
CREATE OR REPLACE FUNCTION public.validate_registration_key(_key_code text)
RETURNS TABLE(key_code text, school_name text, class_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rk.key_code, s.name AS school_name, c.name AS class_name
  FROM public.registration_keys rk
  LEFT JOIN public.schools s ON s.id = rk.school_id
  LEFT JOIN public.classes c ON c.id = rk.class_id
  WHERE rk.key_code = upper(_key_code)
    AND rk.status = 'available'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration_key(text) TO anon, authenticated;