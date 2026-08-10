-- ============================================================================
-- Coding Assignments feature
-- Teachers create coding tasks (HTML/CSS/JS or Python), students write, run,
-- and submit code from a dedicated dashboard workspace, and teachers grade
-- with AI-assisted scoring (auto-grade-essay-style: AI suggests, human confirms).
-- ============================================================================

-- ── coding_assignments ──────────────────────────────────────────────────────
CREATE TABLE public.coding_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructions text,
  language text NOT NULL CHECK (language IN ('html_css_js', 'python')),
  starter_code text NOT NULL DEFAULT '',
  rubric text, -- expected behaviour / grading criteria, shown to AI and teacher
  max_score integer NOT NULL DEFAULT 100 CHECK (max_score > 0),
  due_date timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coding_assignments TO authenticated;
GRANT ALL ON public.coding_assignments TO service_role;
ALTER TABLE public.coding_assignments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_coding_assignments_updated_at
BEFORE UPDATE ON public.coding_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── coding_assignment_class_assignments ─────────────────────────────────────
CREATE TABLE public.coding_assignment_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.coding_assignments(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  due_date_override timestamptz,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coding_assignment_class_assignments TO authenticated;
GRANT ALL ON public.coding_assignment_class_assignments TO service_role;
ALTER TABLE public.coding_assignment_class_assignments ENABLE ROW LEVEL SECURITY;

-- ── coding_submissions ───────────────────────────────────────────────────────
CREATE TABLE public.coding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.coding_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
  last_run_output text,
  last_run_at timestamptz,
  submitted_at timestamptz,
  ai_suggested_score integer,
  ai_feedback text,
  ai_graded_at timestamptz,
  score integer,
  teacher_feedback text,
  graded_by uuid REFERENCES auth.users(id),
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coding_submissions TO authenticated;
GRANT ALL ON public.coding_submissions TO service_role;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_coding_submissions_updated_at
BEFORE UPDATE ON public.coding_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS policies — coding_assignments
-- ============================================================================

CREATE POLICY "Admins manage all coding assignments"
ON public.coding_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view their coding assignments"
ON public.coding_assignments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher') AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coding_assignment_class_assignments a
      WHERE a.assignment_id = coding_assignments.id
        AND a.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
    )
  )
);

CREATE POLICY "Teachers create coding assignments"
ON public.coding_assignments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Teachers update their coding assignments"
ON public.coding_assignments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Teachers delete their coding assignments"
ON public.coding_assignments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'teacher') AND created_by = auth.uid());

CREATE POLICY "Students view published assignments for their class"
ON public.coding_assignments FOR SELECT TO authenticated
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.coding_assignment_class_assignments a
    WHERE a.assignment_id = coding_assignments.id
      AND a.class_id = public.get_student_class_id(auth.uid())
  )
);

-- ============================================================================
-- RLS policies — coding_assignment_class_assignments
-- ============================================================================

CREATE POLICY "Admins manage all coding assignment class links"
ON public.coding_assignment_class_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage class links for their classes"
ON public.coding_assignment_class_assignments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.coding_assignments ca
    WHERE ca.id = coding_assignment_class_assignments.assignment_id
      AND ca.created_by = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher')
  AND class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.coding_assignments ca
    WHERE ca.id = coding_assignment_class_assignments.assignment_id
      AND ca.created_by = auth.uid()
  )
);

CREATE POLICY "Students view class links for their class"
ON public.coding_assignment_class_assignments FOR SELECT TO authenticated
USING (class_id = public.get_student_class_id(auth.uid()));

-- ============================================================================
-- RLS policies — coding_submissions
-- ============================================================================

CREATE POLICY "Students view own submissions"
ON public.coding_submissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = coding_submissions.student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Students create own submissions"
ON public.coding_submissions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = coding_submissions.student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Students edit own draft submissions"
ON public.coding_submissions FOR UPDATE TO authenticated
USING (
  status = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = coding_submissions.student_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = coding_submissions.student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all coding submissions"
ON public.coding_submissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers view submissions for their assignments"
ON public.coding_submissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.coding_assignments ca
    WHERE ca.id = coding_submissions.assignment_id
      AND (
        ca.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coding_assignment_class_assignments a
          WHERE a.assignment_id = ca.id
            AND a.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
        )
      )
  )
);

CREATE POLICY "Teachers grade submissions for their assignments"
ON public.coding_submissions FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.coding_assignments ca
    WHERE ca.id = coding_submissions.assignment_id
      AND (
        ca.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coding_assignment_class_assignments a
          WHERE a.assignment_id = ca.id
            AND a.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
        )
      )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'teacher')
  AND EXISTS (
    SELECT 1 FROM public.coding_assignments ca
    WHERE ca.id = coding_submissions.assignment_id
      AND (
        ca.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coding_assignment_class_assignments a
          WHERE a.assignment_id = ca.id
            AND a.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
        )
      )
  )
);

-- ============================================================================
-- Notify student when their submission is graded
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_on_coding_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_user_id uuid;
  _assignment_title text;
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    SELECT user_id INTO _student_user_id FROM public.students WHERE id = NEW.student_id;
    SELECT title INTO _assignment_title FROM public.coding_assignments WHERE id = NEW.assignment_id;

    IF _student_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        _student_user_id,
        'Coding assignment graded',
        COALESCE(_assignment_title, 'Your assignment') || ' has been graded: ' || COALESCE(NEW.score::text, '0') || ' points.',
        'info',
        '/dashboard/coding'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_coding_graded ON public.coding_submissions;
CREATE TRIGGER trg_notify_on_coding_graded
AFTER UPDATE ON public.coding_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_coding_graded();

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_coding_assignments_created_by ON public.coding_assignments(created_by);
CREATE INDEX idx_coding_assignment_class_assignments_class ON public.coding_assignment_class_assignments(class_id);
CREATE INDEX idx_coding_assignment_class_assignments_assignment ON public.coding_assignment_class_assignments(assignment_id);
CREATE INDEX idx_coding_submissions_assignment ON public.coding_submissions(assignment_id);
CREATE INDEX idx_coding_submissions_student ON public.coding_submissions(student_id);
CREATE INDEX idx_coding_submissions_status ON public.coding_submissions(status);