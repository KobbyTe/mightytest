
-- Create code_submissions table
CREATE TABLE public.code_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  language text NOT NULL,
  code text NOT NULL,
  stdout text,
  stderr text,
  execution_time_ms integer,
  test_results jsonb,
  passed boolean,
  submitted_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.code_submissions ENABLE ROW LEVEL SECURITY;

-- Students can insert their own submissions
CREATE POLICY "Students can insert own code submissions"
ON public.code_submissions
FOR INSERT
WITH CHECK (
  attempt_id IN (
    SELECT ea.id FROM exam_attempts ea
    WHERE ea.student_id IN (
      SELECT s.id FROM students s WHERE s.user_id = auth.uid()
    )
  )
);

-- Students can view their own submissions
CREATE POLICY "Students can view own code submissions"
ON public.code_submissions
FOR SELECT
USING (
  attempt_id IN (
    SELECT ea.id FROM exam_attempts ea
    WHERE ea.student_id IN (
      SELECT s.id FROM students s WHERE s.user_id = auth.uid()
    )
  )
);

-- Admins can view all submissions
CREATE POLICY "Admins can view all code submissions"
ON public.code_submissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all submissions
CREATE POLICY "Admins can manage code submissions"
ON public.code_submissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster lookups
CREATE INDEX idx_code_submissions_attempt ON public.code_submissions(attempt_id);
CREATE INDEX idx_code_submissions_question ON public.code_submissions(question_id);
