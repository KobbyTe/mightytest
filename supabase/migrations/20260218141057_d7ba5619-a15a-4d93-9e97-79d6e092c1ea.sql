-- Drop the unique constraint on exam_attempts to allow resit attempts (multiple attempts per student per exam)
ALTER TABLE public.exam_attempts DROP CONSTRAINT exam_attempts_student_id_exam_id_key;