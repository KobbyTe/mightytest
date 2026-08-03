CREATE POLICY "Staff upload study resource files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'study-resources' AND public.is_admin_or_teacher(auth.uid()));

CREATE POLICY "Staff update study resource files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'study-resources' AND public.is_admin_or_teacher(auth.uid()))
WITH CHECK (bucket_id = 'study-resources' AND public.is_admin_or_teacher(auth.uid()));

CREATE POLICY "Staff delete study resource files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'study-resources' AND public.is_admin_or_teacher(auth.uid()));

CREATE POLICY "Authenticated read study resource files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'study-resources');
