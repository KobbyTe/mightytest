
-- Create teacher_class_assignments table
CREATE TABLE public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  UNIQUE (teacher_id, class_id, subject)
);

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage teacher_class_assignments"
  ON public.teacher_class_assignments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Teachers can view their own assignments
CREATE POLICY "Teachers can view own assignments"
  ON public.teacher_class_assignments FOR SELECT
  TO authenticated
  USING (teacher_id IN (
    SELECT id FROM public.teachers WHERE user_id = auth.uid()
  ));

-- Helper function to get teacher's assigned class IDs
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tca.class_id
  FROM teacher_class_assignments tca
  JOIN teachers t ON t.id = tca.teacher_id
  WHERE t.user_id = _user_id;
$$;
