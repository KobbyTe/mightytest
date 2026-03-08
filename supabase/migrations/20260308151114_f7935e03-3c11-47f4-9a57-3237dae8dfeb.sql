
-- Create teachers profile table
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text,
  school_id uuid REFERENCES public.schools(id),
  subject_specialty text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view own profile" ON public.teachers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can insert own profile" ON public.teachers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can update own profile" ON public.teachers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'teacher'::app_role)
  )
$$;

-- Teacher RLS policies
CREATE POLICY "Teachers can manage exams" ON public.exams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage questions" ON public.exam_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage all attempts" ON public.exam_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can view all answers" ON public.exam_answers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can update answers" ON public.exam_answers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can view all students" ON public.students FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage schools" ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage exam assignments" ON public.exam_class_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage all messages" ON public.messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage resit openings" ON public.resit_openings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage resit requests" ON public.resit_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage registration keys" ON public.registration_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage parents" ON public.parents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can view all parents" ON public.parents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage all notifications" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers can manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'::app_role));
