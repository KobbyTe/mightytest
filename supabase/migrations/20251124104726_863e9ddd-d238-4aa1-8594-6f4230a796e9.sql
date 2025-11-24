-- Drop existing tables and recreate as exams system
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Create exams table
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  duration_minutes INTEGER,
  total_marks INTEGER NOT NULL DEFAULT 100,
  passing_marks INTEGER NOT NULL DEFAULT 50,
  exam_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exam_attempts table
CREATE TABLE public.exam_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'graded')),
  marks_obtained INTEGER,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES auth.users(id),
  feedback TEXT,
  UNIQUE(student_id, exam_id)
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exams
CREATE POLICY "Admins can manage exams"
  ON public.exams FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view active exams"
  ON public.exams FOR SELECT
  USING (status = 'active');

CREATE POLICY "Parents can view active exams"
  ON public.exams FOR SELECT
  USING (status = 'active');

-- RLS Policies for exam_attempts
CREATE POLICY "Admins can manage all attempts"
  ON public.exam_attempts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view own attempts"
  ON public.exam_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = exam_attempts.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can create own attempts"
  ON public.exam_attempts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = exam_attempts.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view their children's attempts"
  ON public.exam_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      JOIN parents ON parents.id = students.parent_id
      WHERE students.id = exam_attempts.student_id
      AND parents.user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sample data
INSERT INTO public.exams (title, description, subject, grade_level, duration_minutes, total_marks, passing_marks, exam_date, status)
VALUES 
  ('Mathematics Final Exam', 'Comprehensive final exam covering algebra, geometry, and calculus', 'Mathematics', 'Grade 10', 120, 100, 50, now() + interval '7 days', 'active'),
  ('Physics Midterm', 'Midterm examination on mechanics and thermodynamics', 'Physics', 'Grade 11', 90, 100, 40, now() + interval '14 days', 'active'),
  ('Chemistry Quiz', 'Quick assessment on organic chemistry basics', 'Chemistry', 'Grade 9', 45, 50, 25, now() + interval '3 days', 'active');