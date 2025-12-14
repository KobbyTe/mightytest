-- Allow students to update their own exam answers
CREATE POLICY "Students can update their own answers" 
ON public.exam_answers 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM exam_attempts
  JOIN students ON students.id = exam_attempts.student_id
  WHERE exam_attempts.id = exam_answers.attempt_id 
  AND students.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM exam_attempts
  JOIN students ON students.id = exam_attempts.student_id
  WHERE exam_attempts.id = exam_answers.attempt_id 
  AND students.user_id = auth.uid()
));

-- Allow students to delete their own exam answers
CREATE POLICY "Students can delete their own answers" 
ON public.exam_answers 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM exam_attempts
  JOIN students ON students.id = exam_attempts.student_id
  WHERE exam_attempts.id = exam_answers.attempt_id 
  AND students.user_id = auth.uid()
));

-- Allow admins to update exam answers (for grading)
CREATE POLICY "Admins can update answers" 
ON public.exam_answers 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow students to update their own exam attempts
CREATE POLICY "Students can update own attempts" 
ON public.exam_attempts 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM students
  WHERE students.id = exam_attempts.student_id 
  AND students.user_id = auth.uid()
));