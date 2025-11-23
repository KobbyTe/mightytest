-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructor_name TEXT,
  category TEXT,
  duration_weeks INTEGER,
  difficulty_level TEXT DEFAULT 'beginner',
  thumbnail_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create enrollments table
CREATE TABLE public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  progress INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  UNIQUE(student_id, course_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS policies for courses (public read)
CREATE POLICY "Anyone can view active courses"
ON public.courses
FOR SELECT
USING (status = 'active');

CREATE POLICY "Admins can manage courses"
ON public.courses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for enrollments
CREATE POLICY "Students can view their own enrollments"
ON public.enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = enrollments.student_id
    AND students.user_id = auth.uid()
  )
);

CREATE POLICY "Students can enroll themselves"
ON public.enrollments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = enrollments.student_id
    AND students.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage enrollments"
ON public.enrollments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample courses
INSERT INTO public.courses (title, description, instructor_name, category, duration_weeks, difficulty_level) VALUES
('Introduction to Python', 'Learn the basics of Python programming with hands-on projects', 'Dr. Sarah Johnson', 'Programming', 8, 'beginner'),
('Web Development Fundamentals', 'Build modern websites with HTML, CSS, and JavaScript', 'Prof. Michael Chen', 'Web Development', 12, 'beginner'),
('Data Science with Python', 'Explore data analysis, visualization, and machine learning', 'Dr. Emily Rodriguez', 'Data Science', 16, 'intermediate'),
('Mobile App Development', 'Create mobile apps for iOS and Android using React Native', 'James Williams', 'Mobile Development', 14, 'intermediate'),
('Robotics Engineering', 'Design and program robots with Arduino and Raspberry Pi', 'Dr. Alex Kumar', 'Robotics', 20, 'advanced');