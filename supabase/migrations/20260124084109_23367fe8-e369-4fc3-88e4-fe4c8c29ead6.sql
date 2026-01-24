-- Break infinite-recursion loop between public.students and public.parents policies

-- 1) SECURITY DEFINER helper to fetch a student's linked parent_id without invoking RLS
CREATE OR REPLACE FUNCTION public.get_student_parent_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.parent_id
  FROM public.students s
  WHERE s.user_id = _user_id
  LIMIT 1;
$$;

-- 2) Replace parents policy that referenced students (caused recursion)
DROP POLICY IF EXISTS "Students can view their linked parent" ON public.parents;

CREATE POLICY "Students can view their linked parent"
ON public.parents
FOR SELECT
USING (
  id = public.get_student_parent_id(auth.uid())
);
