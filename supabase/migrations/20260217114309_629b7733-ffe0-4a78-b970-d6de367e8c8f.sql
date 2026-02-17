
-- resit_openings table
CREATE TABLE public.resit_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  opened_by UUID,
  is_open BOOLEAN DEFAULT true,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, class_id)
);

ALTER TABLE public.resit_openings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all resit openings
CREATE POLICY "Admins can manage resit openings"
ON public.resit_openings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Students can view openings for their class
CREATE POLICY "Students can view resit openings for their class"
ON public.resit_openings
FOR SELECT
TO authenticated
USING (
  is_open = true AND
  class_id IN (
    SELECT s.class_id FROM public.students s WHERE s.user_id = auth.uid()
  )
);

-- resit_requests table
CREATE TABLE public.resit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE public.resit_requests ENABLE ROW LEVEL SECURITY;

-- Admins can manage all resit requests
CREATE POLICY "Admins can manage resit requests"
ON public.resit_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own resit requests
CREATE POLICY "Students can view own resit requests"
ON public.resit_requests
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
  )
);

-- Students can insert their own resit requests
CREATE POLICY "Students can insert own resit requests"
ON public.resit_requests
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
  )
);
