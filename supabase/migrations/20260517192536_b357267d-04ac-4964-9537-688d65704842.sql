
-- 1. Add review_opened_at column to exam_attempts
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS review_opened_at timestamptz;

-- 2. Helper: can the current student review this attempt?
-- Locked when there is a pending/approved resit_request for the same (student, exam)
-- and the student has NOT yet submitted (completed/graded) a later resit attempt.
CREATE OR REPLACE FUNCTION public.can_review_attempt(_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _exam_id uuid;
  _attempt_completed_at timestamptz;
  _has_pending_resit boolean;
  _later_resit_submitted boolean;
BEGIN
  SELECT student_id, exam_id, completed_at
    INTO _student_id, _exam_id, _attempt_completed_at
  FROM public.exam_attempts
  WHERE id = _attempt_id;

  IF _student_id IS NULL THEN
    RETURN false;
  END IF;

  -- Is there an active resit request (pending or approved) for this exam?
  SELECT EXISTS (
    SELECT 1 FROM public.resit_requests
    WHERE student_id = _student_id
      AND exam_id = _exam_id
      AND status IN ('pending', 'approved')
  ) INTO _has_pending_resit;

  IF NOT _has_pending_resit THEN
    RETURN true;
  END IF;

  -- Has the student already finished a resit attempt (i.e. a later attempt that's completed/graded)?
  SELECT EXISTS (
    SELECT 1 FROM public.exam_attempts ea
    WHERE ea.student_id = _student_id
      AND ea.exam_id = _exam_id
      AND ea.id <> _attempt_id
      AND ea.status IN ('completed', 'graded')
      AND (_attempt_completed_at IS NULL OR ea.completed_at IS NULL OR ea.completed_at >= _attempt_completed_at)
  ) INTO _later_resit_submitted;

  RETURN _later_resit_submitted;
END;
$$;

-- 3. Helper: can the student request a resit for this exam?
-- Locked if any of the student's attempts for this exam has review_opened_at set.
CREATE OR REPLACE FUNCTION public.can_request_resit(_student_id uuid, _exam_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.exam_attempts
    WHERE student_id = _student_id
      AND exam_id = _exam_id
      AND review_opened_at IS NOT NULL
  );
$$;

-- 4. RPC for the client to mark review as opened (idempotent, security-checked)
CREATE OR REPLACE FUNCTION public.mark_review_opened(_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_user_id uuid;
BEGIN
  SELECT s.user_id
    INTO _owner_user_id
  FROM public.exam_attempts ea
  JOIN public.students s ON s.id = ea.student_id
  WHERE ea.id = _attempt_id;

  IF _owner_user_id IS NULL OR _owner_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.can_review_attempt(_attempt_id) THEN
    RAISE EXCEPTION 'Review is locked while a resit is pending or in progress';
  END IF;

  UPDATE public.exam_attempts
  SET review_opened_at = COALESCE(review_opened_at, now())
  WHERE id = _attempt_id;
END;
$$;

-- 5. Tighten exam_answers SELECT policy for students
DROP POLICY IF EXISTS "Students can view their own answers" ON public.exam_answers;
CREATE POLICY "Students can view their own answers"
ON public.exam_answers
FOR SELECT
USING (
  attempt_id IN (
    SELECT ea.id
    FROM public.exam_attempts ea
    WHERE ea.student_id IN (
      SELECT students.id FROM public.students WHERE students.user_id = auth.uid()
    )
    AND public.can_review_attempt(ea.id)
  )
);

-- 6. Tighten resit_requests INSERT policy for students
DROP POLICY IF EXISTS "Students can insert own resit requests" ON public.resit_requests;
CREATE POLICY "Students can insert own resit requests"
ON public.resit_requests
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  AND public.can_request_resit(student_id, exam_id)
);
