
-- 1) exam_questions: restrict SELECT to authenticated only
DROP POLICY IF EXISTS "Students can view questions for active exams" ON public.exam_questions;
CREATE POLICY "Authenticated users can view questions for active exams"
ON public.exam_questions
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.exams WHERE exams.id = exam_questions.exam_id AND exams.status = 'active'));

DROP POLICY IF EXISTS "Admins can manage questions" ON public.exam_questions;
CREATE POLICY "Admins can manage questions"
ON public.exam_questions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) page_views: add validation to anonymous insert
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert validated page views"
ON public.page_views
FOR INSERT
TO public
WITH CHECK (
  length(session_id) BETWEEN 1 AND 128
  AND length(page_path) BETWEEN 1 AND 512
  AND length(event_type) BETWEEN 1 AND 64
  AND (page_title IS NULL OR length(page_title) <= 512)
  AND (referrer IS NULL OR length(referrer) <= 1024)
  AND (user_agent IS NULL OR length(user_agent) <= 1024)
  AND (device_type IS NULL OR length(device_type) <= 64)
  AND (browser IS NULL OR length(browser) <= 64)
  AND (os IS NULL OR length(os) <= 64)
  AND (country IS NULL OR length(country) <= 64)
  AND (city IS NULL OR length(city) <= 128)
  AND (event_data IS NULL OR pg_column_size(event_data) <= 4096)
);

DROP POLICY IF EXISTS "Admins can delete page views" ON public.page_views;
CREATE POLICY "Admins can delete page views"
ON public.page_views FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all page views" ON public.page_views;
CREATE POLICY "Admins can view all page views"
ON public.page_views FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) password_reset_tokens: remove all API-facing policies; only service_role can access
DROP POLICY IF EXISTS "Only system can manage password reset tokens" ON public.password_reset_tokens;
REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;
GRANT ALL ON public.password_reset_tokens TO service_role;

-- 4) registration_keys: scope to authenticated only
DROP POLICY IF EXISTS "Admins can manage registration keys" ON public.registration_keys;
CREATE POLICY "Admins can manage registration keys"
ON public.registration_keys FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
