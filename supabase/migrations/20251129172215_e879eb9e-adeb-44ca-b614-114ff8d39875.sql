-- Create exam_questions table
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'essay')),
  options JSONB, -- For multiple choice: ["option1", "option2", "option3", "option4"]
  correct_answer TEXT, -- For multiple choice and true/false
  marks INTEGER NOT NULL DEFAULT 1,
  order_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exam_answers table
CREATE TABLE public.exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  is_correct BOOLEAN,
  marks_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- Enable RLS
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_questions
CREATE POLICY "Admins can manage questions"
  ON public.exam_questions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view questions for active exams"
  ON public.exam_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_questions.exam_id
      AND exams.status = 'active'
    )
  );

-- RLS Policies for exam_answers
CREATE POLICY "Admins can view all answers"
  ON public.exam_answers
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can insert their own answers"
  ON public.exam_answers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.students ON students.id = exam_attempts.student_id
      WHERE exam_attempts.id = exam_answers.attempt_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own answers"
  ON public.exam_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.students ON students.id = exam_attempts.student_id
      WHERE exam_attempts.id = exam_answers.attempt_id
      AND students.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_exam_questions_updated_at
  BEFORE UPDATE ON public.exam_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_exam_questions_exam_id ON public.exam_questions(exam_id);
CREATE INDEX idx_exam_answers_attempt_id ON public.exam_answers(attempt_id);
CREATE INDEX idx_exam_answers_question_id ON public.exam_answers(question_id);