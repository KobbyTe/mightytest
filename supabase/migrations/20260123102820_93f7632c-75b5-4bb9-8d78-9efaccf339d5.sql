-- Fix infinite recursion in RLS policies by rewriting them properly
-- First, drop the problematic policies on students table
DROP POLICY IF EXISTS "Parents can view their children" ON public.students;

-- Recreate the parents viewing children policy without recursion
CREATE POLICY "Parents can view their children" 
ON public.students 
FOR SELECT 
USING (
  parent_id IN (
    SELECT id FROM public.parents WHERE user_id = auth.uid()
  )
);

-- Also fix exam_attempts policies that reference students
DROP POLICY IF EXISTS "Parents can view their children's attempts" ON public.exam_attempts;
DROP POLICY IF EXISTS "Students can create own attempts" ON public.exam_attempts;
DROP POLICY IF EXISTS "Students can update own attempts" ON public.exam_attempts;
DROP POLICY IF EXISTS "Students can view own attempts" ON public.exam_attempts;

-- Recreate without JOIN that causes recursion
CREATE POLICY "Parents can view their children's attempts" 
ON public.exam_attempts 
FOR SELECT 
USING (
  student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.parent_id IN (
      SELECT p.id FROM public.parents p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can create own attempts" 
ON public.exam_attempts 
FOR INSERT 
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Students can update own attempts" 
ON public.exam_attempts 
FOR UPDATE 
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Students can view own attempts" 
ON public.exam_attempts 
FOR SELECT 
USING (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

-- Fix exam_class_assignments policies
DROP POLICY IF EXISTS "Parents can view assignments for their children's class" ON public.exam_class_assignments;
DROP POLICY IF EXISTS "Students can view assignments for their class" ON public.exam_class_assignments;

CREATE POLICY "Parents can view assignments for their children's class" 
ON public.exam_class_assignments 
FOR SELECT 
USING (
  class_id IN (
    SELECT s.class_id FROM public.students s
    WHERE s.parent_id IN (
      SELECT p.id FROM public.parents p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view assignments for their class" 
ON public.exam_class_assignments 
FOR SELECT 
USING (
  class_id IN (
    SELECT class_id FROM public.students WHERE user_id = auth.uid()
  )
);

-- Fix exam_answers policies that have recursive JOINs
DROP POLICY IF EXISTS "Students can delete their own answers" ON public.exam_answers;
DROP POLICY IF EXISTS "Students can insert their own answers" ON public.exam_answers;
DROP POLICY IF EXISTS "Students can update their own answers" ON public.exam_answers;
DROP POLICY IF EXISTS "Students can view their own answers" ON public.exam_answers;

CREATE POLICY "Students can delete their own answers" 
ON public.exam_answers 
FOR DELETE 
USING (
  attempt_id IN (
    SELECT ea.id FROM public.exam_attempts ea
    WHERE ea.student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can insert their own answers" 
ON public.exam_answers 
FOR INSERT 
WITH CHECK (
  attempt_id IN (
    SELECT ea.id FROM public.exam_attempts ea
    WHERE ea.student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can update their own answers" 
ON public.exam_answers 
FOR UPDATE 
USING (
  attempt_id IN (
    SELECT ea.id FROM public.exam_attempts ea
    WHERE ea.student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Students can view their own answers" 
ON public.exam_answers 
FOR SELECT 
USING (
  attempt_id IN (
    SELECT ea.id FROM public.exam_attempts ea
    WHERE ea.student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    )
  )
);