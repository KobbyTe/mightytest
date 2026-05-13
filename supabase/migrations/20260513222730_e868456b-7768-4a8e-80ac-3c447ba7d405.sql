-- Convert exam_questions.question_type from text to a proper enum
CREATE TYPE public.question_type_enum AS ENUM ('multiple_choice', 'true_false', 'short_answer', 'essay');

-- Drop any leftover CHECK constraints on question_type
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.exam_questions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%question_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.exam_questions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Cast existing column to the new enum
ALTER TABLE public.exam_questions
  ALTER COLUMN question_type TYPE public.question_type_enum
  USING question_type::public.question_type_enum;