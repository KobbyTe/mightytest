INSERT INTO public.teacher_class_assignments (teacher_id, class_id, subject)
VALUES ('6dc1dc2e-3777-4687-ad13-e075e40938dc', '511c9fb5-b600-4b63-8905-4a0bbfda6270', 'Engineering')
ON CONFLICT DO NOTHING;