-- Allow students to view their linked parent's basic info (for displaying credentials on dashboard)
CREATE POLICY "Students can view their linked parent" 
ON public.parents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM students
    WHERE students.parent_id = parents.id 
    AND students.user_id = auth.uid()
  )
);