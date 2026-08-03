CREATE TYPE public.study_resource_type AS ENUM ('book', 'video', 'worksheet');

CREATE TABLE public.study_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  resource_type public.study_resource_type NOT NULL,
  subject text,
  grade_level text,
  file_path text,
  external_url text,
  cover_url text,
  file_size bigint,
  duration_seconds integer,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_resources TO authenticated;
GRANT ALL ON public.study_resources TO service_role;
ALTER TABLE public.study_resources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.study_resource_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.study_resources(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_resource_class_assignments TO authenticated;
GRANT ALL ON public.study_resource_class_assignments TO service_role;
ALTER TABLE public.study_resource_class_assignments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_study_resources_updated_at
BEFORE UPDATE ON public.study_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_student_class_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.class_id FROM public.students s WHERE s.user_id = _user_id LIMIT 1;
$$;

-- study_resources policies
CREATE POLICY "Admins manage all study resources"
ON public.study_resources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view resources for their classes"
ON public.study_resources FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher') AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.study_resource_class_assignments a
      WHERE a.resource_id = study_resources.id
        AND a.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
    )
  )
);

CREATE POLICY "Teachers create study resources"
ON public.study_resources FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Teachers update their study resources"
ON public.study_resources FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Teachers delete their study resources"
ON public.study_resources FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Students view published resources for their class"
ON public.study_resources FOR SELECT TO authenticated
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.study_resource_class_assignments a
    WHERE a.resource_id = study_resources.id
      AND a.class_id = public.get_student_class_id(auth.uid())
  )
);

-- assignment policies
CREATE POLICY "Admins manage all resource assignments"
ON public.study_resource_class_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage assignments for their classes"
ON public.study_resource_class_assignments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher')
  AND class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
);

CREATE POLICY "Students view assignments for their class"
ON public.study_resource_class_assignments FOR SELECT TO authenticated
USING (class_id = public.get_student_class_id(auth.uid()));
