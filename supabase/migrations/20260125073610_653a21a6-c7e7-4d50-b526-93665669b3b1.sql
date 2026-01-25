-- Fix admin RLS policy for exam_class_assignments to allow INSERT/UPDATE via WITH CHECK

DROP POLICY IF EXISTS "Admins can manage exam assignments" ON public.exam_class_assignments;

CREATE POLICY "Admins can manage exam assignments"
ON public.exam_class_assignments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
