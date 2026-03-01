
-- Bug #7: Add unique constraint for upsert on exam_answers
ALTER TABLE public.exam_answers
ADD CONSTRAINT exam_answers_attempt_question_unique
UNIQUE (attempt_id, question_id);

-- Bug #9: Add ON DELETE CASCADE to all foreign keys referencing exams.id
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_exam_id_fkey;
ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.exam_class_assignments DROP CONSTRAINT IF EXISTS exam_class_assignments_exam_id_fkey;
ALTER TABLE public.exam_class_assignments ADD CONSTRAINT exam_class_assignments_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.resit_openings DROP CONSTRAINT IF EXISTS resit_openings_exam_id_fkey;
ALTER TABLE public.resit_openings ADD CONSTRAINT resit_openings_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

ALTER TABLE public.resit_requests DROP CONSTRAINT IF EXISTS resit_requests_exam_id_fkey;
ALTER TABLE public.resit_requests ADD CONSTRAINT resit_requests_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Also cascade exam_attempts -> exam_answers
ALTER TABLE public.exam_answers DROP CONSTRAINT IF EXISTS exam_answers_attempt_id_fkey;
ALTER TABLE public.exam_answers ADD CONSTRAINT exam_answers_attempt_id_fkey
  FOREIGN KEY (attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE;

-- And exam_attempts from exams
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_exam_id_fkey;
ALTER TABLE public.exam_attempts ADD CONSTRAINT exam_attempts_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
