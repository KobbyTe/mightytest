-- Drop existing INSERT policy for exam_attempts
DROP POLICY IF EXISTS "Students can create own attempts" ON exam_attempts;

-- Create new policy with proper WITH CHECK clause
CREATE POLICY "Students can create own attempts"
ON exam_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);