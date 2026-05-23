
-- Trigger function: notify recipient on new chat message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_name text;
BEGIN
  IF NEW.recipient_id IS NULL OR NEW.recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    (SELECT full_name FROM public.students WHERE user_id = NEW.sender_id LIMIT 1),
    (SELECT full_name FROM public.teachers WHERE user_id = NEW.sender_id LIMIT 1),
    (SELECT full_name FROM public.parents  WHERE user_id = NEW.sender_id LIMIT 1),
    'Someone'
  ) INTO _sender_name;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.recipient_id,
    'New message from ' || _sender_name,
    LEFT(NEW.content, 140),
    'info',
    '/dashboard'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_message ON public.messages;
CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();


-- Trigger function: notify teachers + admins on new resit request
CREATE OR REPLACE FUNCTION public.notify_on_resit_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_name text;
  _exam_title text;
BEGIN
  SELECT full_name INTO _student_name FROM public.students WHERE id = NEW.student_id;
  SELECT title     INTO _exam_title   FROM public.exams    WHERE id = NEW.exam_id;

  -- Notify teachers assigned to the class
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT DISTINCT t.user_id,
         'New resit request',
         COALESCE(_student_name, 'A student') || ' applied for a resit'
           || CASE WHEN _exam_title IS NOT NULL THEN ' on "' || _exam_title || '"' ELSE '' END,
         'warning',
         '/admin'
  FROM public.teacher_class_assignments tca
  JOIN public.teachers t ON t.id = tca.teacher_id
  WHERE tca.class_id = NEW.class_id
    AND t.user_id IS NOT NULL;

  -- Notify all admins
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         'New resit request',
         COALESCE(_student_name, 'A student') || ' applied for a resit'
           || CASE WHEN _exam_title IS NOT NULL THEN ' on "' || _exam_title || '"' ELSE '' END,
         'warning',
         '/admin'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role
    AND NOT EXISTS (
      SELECT 1 FROM public.teacher_class_assignments tca
      JOIN public.teachers t ON t.id = tca.teacher_id
      WHERE tca.class_id = NEW.class_id AND t.user_id = ur.user_id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_resit_request ON public.resit_requests;
CREATE TRIGGER trg_notify_on_resit_request
AFTER INSERT ON public.resit_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_resit_request();
