
-- ============ TABLES ============
CREATE TABLE public.lab_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by uuid,
  subject text,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 10000),
  lab_type text NOT NULL CHECK (lab_type IN ('virtual_robotics','ai_lab','3d_lab')),
  accepted_extension text NOT NULL CHECK (accepted_extension IN ('.kodevr.json','.json','.kvr')),
  max_score integer NOT NULL DEFAULT 100 CHECK (max_score > 0 AND max_score <= 1000),
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  due_date timestamptz,
  allow_late_submission boolean NOT NULL DEFAULT false,
  allow_resubmission boolean NOT NULL DEFAULT true,
  allow_supporting_files boolean NOT NULL DEFAULT true,
  require_description boolean NOT NULL DEFAULT false,
  max_file_size bigint NOT NULL DEFAULT 52428800 CHECK (max_file_size > 0 AND max_file_size <= 209715200),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lab_type_extension_match CHECK (
    (lab_type = 'virtual_robotics' AND accepted_extension = '.kodevr.json') OR
    (lab_type = 'ai_lab' AND accepted_extension = '.json') OR
    (lab_type = '3d_lab' AND accepted_extension = '.kvr')
  ),
  CONSTRAINT rubric_is_array CHECK (jsonb_typeof(rubric) = 'array')
);
CREATE INDEX idx_lab_assign_class ON public.lab_project_assignments(class_id);

CREATE TABLE public.lab_project_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.lab_project_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  project_title text NOT NULL DEFAULT '' CHECK (char_length(project_title) <= 200),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  what_it_does text CHECK (what_it_does IS NULL OR char_length(what_it_does) <= 3000),
  technologies_used text[] NOT NULL DEFAULT '{}',
  learning_reflection text CHECK (learning_reflection IS NULL OR char_length(learning_reflection) <= 3000),
  main_file_path text,
  main_file_name text,
  main_file_size bigint,
  main_file_extension text CHECK (main_file_extension IS NULL OR main_file_extension IN ('.kodevr.json','.json','.kvr')),
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','graded','returned','resubmission_required')),
  is_late boolean NOT NULL DEFAULT false,
  score integer,
  max_score integer NOT NULL DEFAULT 100 CHECK (max_score > 0),
  rubric_scores jsonb,
  teacher_feedback text CHECK (teacher_feedback IS NULL OR char_length(teacher_feedback) <= 10000),
  graded_by uuid,
  graded_at timestamptz,
  review_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lab_score_range CHECK (score IS NULL OR (score >= 0 AND score <= max_score)),
  CONSTRAINT lab_attempt_unique UNIQUE (assignment_id, student_id, attempt_number)
);
CREATE INDEX idx_lab_sub_student ON public.lab_project_submissions(student_id);
CREATE INDEX idx_lab_sub_assignment ON public.lab_project_submissions(assignment_id);

CREATE TABLE public.lab_project_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.lab_project_submissions(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('main_project','screenshot','documentation','video','supporting_asset')),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint NOT NULL CHECK (file_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_files_sub ON public.lab_project_submission_files(submission_id);

CREATE TABLE public.lab_project_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  event text NOT NULL,
  assignment_id uuid,
  submission_id uuid,
  student_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_audit_sub ON public.lab_project_audit_log(submission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_project_assignments TO authenticated;
GRANT SELECT, DELETE ON public.lab_project_submissions TO authenticated;
GRANT SELECT ON public.lab_project_submission_files TO authenticated;
GRANT SELECT ON public.lab_project_audit_log TO authenticated;
GRANT ALL ON public.lab_project_assignments, public.lab_project_submissions, public.lab_project_submission_files, public.lab_project_audit_log TO service_role;

ALTER TABLE public.lab_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_project_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_project_audit_log ENABLE ROW LEVEL SECURITY;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.lab_current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2 WHEN 'parent' THEN 3 ELSE 4 END LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lab_is_staff_for_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'teacher'::app_role)
      AND EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = auth.uid() AND t.status = 'approved')
      AND _class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
    );
$$;

CREATE OR REPLACE FUNCTION public.lab_can_view_submission(_submission_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lab_project_submissions s
    JOIN public.lab_project_assignments a ON a.id = s.assignment_id
    JOIN public.students st ON st.id = s.student_id
    WHERE s.id = _submission_id
      AND (
        st.user_id = auth.uid()
        OR public.lab_is_staff_for_class(a.class_id)
        OR EXISTS (SELECT 1 FROM public.parents p WHERE p.user_id = auth.uid() AND p.id = st.parent_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.lab_audit(_event text, _assignment uuid, _submission uuid, _student uuid, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.lab_project_audit_log(actor_id, actor_role, event, assignment_id, submission_id, student_id, metadata)
  VALUES (auth.uid(), public.lab_current_role(), _event, _assignment, _submission, _student, COALESCE(_meta, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.lab_audit(text, uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ============ ASSIGNMENT POLICIES ============
CREATE POLICY "lab_assign_select" ON public.lab_project_assignments FOR SELECT TO authenticated USING (
  public.lab_is_staff_for_class(class_id)
  OR (status = 'published' AND class_id = public.get_student_class_id(auth.uid()))
  OR (status = 'published' AND EXISTS (
        SELECT 1 FROM public.students st JOIN public.parents p ON p.id = st.parent_id
        WHERE p.user_id = auth.uid() AND st.class_id = lab_project_assignments.class_id))
);
CREATE POLICY "lab_assign_insert" ON public.lab_project_assignments FOR INSERT TO authenticated WITH CHECK (
  public.lab_is_staff_for_class(class_id) AND created_by = auth.uid()
);
CREATE POLICY "lab_assign_update" ON public.lab_project_assignments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR (created_by = auth.uid() AND public.lab_is_staff_for_class(class_id)))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR (created_by = auth.uid() AND public.lab_is_staff_for_class(class_id)));
CREATE POLICY "lab_assign_delete" ON public.lab_project_assignments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role) OR (created_by = auth.uid() AND public.lab_is_staff_for_class(class_id)
  AND NOT EXISTS (SELECT 1 FROM public.lab_project_submissions s WHERE s.assignment_id = lab_project_assignments.id AND s.status <> 'draft')));

-- class must belong to school
CREATE OR REPLACE FUNCTION public.lab_validate_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = NEW.class_id AND c.school_id = NEW.school_id) THEN
    RAISE EXCEPTION 'Class does not belong to the selected school';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Assignment ownership cannot be changed';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lab_validate_assignment BEFORE INSERT OR UPDATE ON public.lab_project_assignments
FOR EACH ROW EXECUTE FUNCTION public.lab_validate_assignment();

CREATE OR REPLACE FUNCTION public.lab_after_assignment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.lab_audit('assignment_created', NEW.id, NULL, NULL, jsonb_build_object('title', NEW.title, 'lab_type', NEW.lab_type));
  IF NEW.status = 'published' THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    SELECT st.user_id, 'New lab project', NEW.title || ' has been assigned to your class.', 'info', '/dashboard/projects'
    FROM public.students st WHERE st.class_id = NEW.class_id AND st.user_id IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lab_after_assignment_insert AFTER INSERT ON public.lab_project_assignments
FOR EACH ROW EXECUTE FUNCTION public.lab_after_assignment_insert();

-- ============ SUBMISSION / FILE / AUDIT POLICIES ============
CREATE POLICY "lab_sub_select" ON public.lab_project_submissions FOR SELECT TO authenticated
USING (public.lab_can_view_submission(id));
CREATE POLICY "lab_sub_admin_delete" ON public.lab_project_submissions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "lab_files_select" ON public.lab_project_submission_files FOR SELECT TO authenticated
USING (public.lab_can_view_submission(submission_id));

CREATE POLICY "lab_audit_select" ON public.lab_project_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role)
  OR (assignment_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.lab_project_assignments a WHERE a.id = assignment_id AND public.lab_is_staff_for_class(a.class_id))));

CREATE OR REPLACE FUNCTION public.lab_audit_submission_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.lab_audit('submission_deleted', OLD.assignment_id, OLD.id, OLD.student_id, jsonb_build_object('attempt', OLD.attempt_number, 'status', OLD.status));
  RETURN OLD;
END $$;
CREATE TRIGGER trg_lab_audit_submission_delete AFTER DELETE ON public.lab_project_submissions
FOR EACH ROW EXECUTE FUNCTION public.lab_audit_submission_delete();

-- ============ STUDENT RPCs ============
CREATE OR REPLACE FUNCTION public.lab_start_submission(_assignment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _st record; _a record; _latest record; _existing uuid; _new_id uuid; _school uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _st FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF _st.id IS NULL THEN RAISE EXCEPTION 'Only students can submit lab projects'; END IF;
  SELECT * INTO _a FROM public.lab_project_assignments WHERE id = _assignment_id;
  IF _a.id IS NULL OR _a.status <> 'published' THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  IF _st.class_id IS DISTINCT FROM _a.class_id THEN RAISE EXCEPTION 'This project is not assigned to your class'; END IF;
  SELECT COALESCE(_st.school_id, c.school_id) INTO _school FROM public.classes c WHERE c.id = _st.class_id;
  IF _school IS DISTINCT FROM _a.school_id THEN RAISE EXCEPTION 'This project is not assigned to your school'; END IF;

  SELECT id INTO _existing FROM public.lab_project_submissions
   WHERE assignment_id = _a.id AND student_id = _st.id AND status = 'draft' ORDER BY attempt_number DESC LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;

  IF _a.due_date IS NOT NULL AND now() > _a.due_date AND NOT _a.allow_late_submission THEN
    RAISE EXCEPTION 'The deadline for this project has passed';
  END IF;

  SELECT * INTO _latest FROM public.lab_project_submissions
   WHERE assignment_id = _a.id AND student_id = _st.id ORDER BY attempt_number DESC LIMIT 1;
  IF _latest.id IS NOT NULL THEN
    IF _latest.status IN ('submitted','under_review') THEN RAISE EXCEPTION 'You have already submitted this project'; END IF;
    IF _latest.status = 'graded' THEN RAISE EXCEPTION 'This project has already been graded'; END IF;
    IF NOT _a.allow_resubmission THEN RAISE EXCEPTION 'Resubmission is not allowed for this project'; END IF;
  END IF;

  INSERT INTO public.lab_project_submissions(assignment_id, student_id, attempt_number, max_score)
  VALUES (_a.id, _st.id, COALESCE(_latest.attempt_number, 0) + 1, _a.max_score)
  RETURNING id INTO _new_id;
  PERFORM public.lab_audit('submission_created', _a.id, _new_id, _st.id, jsonb_build_object('attempt', COALESCE(_latest.attempt_number,0)+1));
  RETURN _new_id;
END $$;

CREATE OR REPLACE FUNCTION public.lab_own_draft(_submission_id uuid)
RETURNS public.lab_project_submissions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions;
BEGIN
  SELECT s.* INTO _s FROM public.lab_project_submissions s JOIN public.students st ON st.id = s.student_id
   WHERE s.id = _submission_id AND st.user_id = auth.uid();
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF _s.status <> 'draft' THEN RAISE EXCEPTION 'This submission can no longer be edited'; END IF;
  RETURN _s;
END $$;
REVOKE EXECUTE ON FUNCTION public.lab_own_draft(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.lab_save_draft(_submission_id uuid, _title text, _description text, _what_it_does text, _technologies text[], _reflection text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions;
BEGIN
  _s := public.lab_own_draft(_submission_id);
  IF COALESCE(array_length(_technologies,1),0) > 20 THEN RAISE EXCEPTION 'Too many technologies listed'; END IF;
  UPDATE public.lab_project_submissions SET
    project_title = left(COALESCE(trim(_title),''), 200),
    description = NULLIF(left(trim(COALESCE(_description,'')), 5000), ''),
    what_it_does = NULLIF(left(trim(COALESCE(_what_it_does,'')), 3000), ''),
    technologies_used = COALESCE((SELECT array_agg(left(trim(t),50)) FROM unnest(_technologies) t WHERE trim(t) <> ''), '{}'),
    learning_reflection = NULLIF(left(trim(COALESCE(_reflection,'')), 3000), ''),
    updated_at = now()
  WHERE id = _s.id;
END $$;

CREATE OR REPLACE FUNCTION public.lab_attach_file(_submission_id uuid, _file_type text, _file_name text, _storage_path text, _mime text, _size bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE
  _s public.lab_project_submissions; _a record; _prefix text; _lname text; _ext text; _id uuid; _count int;
BEGIN
  _s := public.lab_own_draft(_submission_id);
  SELECT * INTO _a FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  _prefix := _a.school_id || '/' || _a.class_id || '/' || _s.student_id || '/' || _a.id || '/' || _s.id || '/';
  IF _storage_path IS NULL OR left(_storage_path, length(_prefix)) <> _prefix OR _storage_path LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid storage path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'project-submissions' AND o.name = _storage_path) THEN
    RAISE EXCEPTION 'Uploaded file not found';
  END IF;
  IF _size IS NULL OR _size <= 0 OR _size > _a.max_file_size THEN RAISE EXCEPTION 'File is too large for this assignment'; END IF;
  _lname := lower(COALESCE(_file_name,''));

  IF _file_type = 'main_project' THEN
    IF right(_lname, length(_a.accepted_extension)) <> _a.accepted_extension THEN
      RAISE EXCEPTION 'This assignment requires a % project', _a.accepted_extension;
    END IF;
    DELETE FROM public.lab_project_submission_files WHERE submission_id = _s.id AND file_type = 'main_project';
    INSERT INTO public.lab_project_submission_files(submission_id, file_type, file_name, storage_path, mime_type, file_size)
    VALUES (_s.id, 'main_project', left(_file_name,255), _storage_path, left(_mime,100), _size) RETURNING id INTO _id;
    UPDATE public.lab_project_submissions SET main_file_path = _storage_path, main_file_name = left(_file_name,255),
      main_file_size = _size, main_file_extension = _a.accepted_extension, updated_at = now() WHERE id = _s.id;
  ELSIF _file_type IN ('screenshot','documentation','video','supporting_asset') THEN
    IF NOT _a.allow_supporting_files THEN RAISE EXCEPTION 'Supporting files are not allowed for this assignment'; END IF;
    SELECT count(*) INTO _count FROM public.lab_project_submission_files WHERE submission_id = _s.id AND file_type <> 'main_project';
    IF _count >= 10 THEN RAISE EXCEPTION 'Maximum of 10 supporting files'; END IF;
    _ext := substring(_lname from '\.([a-z0-9]+)$');
    IF _ext IS NULL OR _ext NOT IN ('png','jpg','jpeg','webp','gif','pdf','mp4','webm','mov','txt','md') THEN
      RAISE EXCEPTION 'This supporting file type is not allowed';
    END IF;
    IF (_file_type = 'screenshot' AND _ext NOT IN ('png','jpg','jpeg','webp','gif'))
       OR (_file_type = 'video' AND _ext NOT IN ('mp4','webm','mov'))
       OR (_file_type = 'documentation' AND _ext NOT IN ('pdf','txt','md')) THEN
      RAISE EXCEPTION 'File type does not match its category';
    END IF;
    INSERT INTO public.lab_project_submission_files(submission_id, file_type, file_name, storage_path, mime_type, file_size)
    VALUES (_s.id, _file_type, left(_file_name,255), _storage_path, left(_mime,100), _size) RETURNING id INTO _id;
  ELSE
    RAISE EXCEPTION 'Invalid file type';
  END IF;
  PERFORM public.lab_audit('file_uploaded', _a.id, _s.id, _s.student_id, jsonb_build_object('file_type', _file_type, 'file_name', _file_name, 'size', _size));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.lab_remove_file(_file_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f record; _s public.lab_project_submissions;
BEGIN
  SELECT * INTO _f FROM public.lab_project_submission_files WHERE id = _file_id;
  IF _f.id IS NULL THEN RAISE EXCEPTION 'File not found'; END IF;
  _s := public.lab_own_draft(_f.submission_id);
  DELETE FROM public.lab_project_submission_files WHERE id = _f.id;
  IF _f.file_type = 'main_project' THEN
    UPDATE public.lab_project_submissions SET main_file_path = NULL, main_file_name = NULL, main_file_size = NULL, main_file_extension = NULL WHERE id = _s.id;
  END IF;
  RETURN _f.storage_path;
END $$;

CREATE OR REPLACE FUNCTION public.lab_submit(_submission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _a record; _late boolean; _name text;
BEGIN
  _s := public.lab_own_draft(_submission_id);
  SELECT * INTO _a FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  IF _a.status <> 'published' THEN RAISE EXCEPTION 'This assignment is closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = _s.student_id AND st.class_id = _a.class_id) THEN
    RAISE EXCEPTION 'This project is not assigned to your class';
  END IF;
  IF trim(_s.project_title) = '' THEN RAISE EXCEPTION 'Project title is required'; END IF;
  IF _a.require_description AND COALESCE(trim(_s.description),'') = '' THEN RAISE EXCEPTION 'Project description is required'; END IF;
  IF _s.main_file_path IS NULL OR NOT EXISTS (SELECT 1 FROM public.lab_project_submission_files f WHERE f.submission_id = _s.id AND f.file_type = 'main_project') THEN
    RAISE EXCEPTION 'Please upload your main project file';
  END IF;
  _late := _a.due_date IS NOT NULL AND now() > _a.due_date;
  IF _late AND NOT _a.allow_late_submission THEN RAISE EXCEPTION 'The deadline for this project has passed'; END IF;

  UPDATE public.lab_project_submissions SET status = 'submitted', submitted_at = now(), is_late = _late, max_score = _a.max_score, updated_at = now()
  WHERE id = _s.id;

  SELECT full_name INTO _name FROM public.students WHERE id = _s.student_id;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (auth.uid(), 'Project submitted', _a.title || ' was submitted successfully.', 'success', '/dashboard/projects');
  INSERT INTO public.notifications(user_id, title, message, type, link)
  SELECT DISTINCT t.user_id,
    CASE WHEN _s.attempt_number > 1 THEN 'Lab project resubmitted' ELSE 'New lab project submission' END,
    split_part(COALESCE(_name,'A student'),' ',1) || ' submitted "' || _a.title || '"' || CASE WHEN _late THEN ' (late)' ELSE '' END,
    'info', '/teacher'
  FROM public.teacher_class_assignments tca JOIN public.teachers t ON t.id = tca.teacher_id
  WHERE tca.class_id = _a.class_id AND t.user_id IS NOT NULL;

  PERFORM public.lab_audit(CASE WHEN _s.attempt_number > 1 THEN 'resubmission_submitted' ELSE 'submission_submitted' END,
    _a.id, _s.id, _s.student_id, jsonb_build_object('attempt', _s.attempt_number, 'late', _late));
END $$;

CREATE OR REPLACE FUNCTION public.lab_delete_draft(_submission_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _paths text[];
BEGIN
  _s := public.lab_own_draft(_submission_id);
  SELECT COALESCE(array_agg(storage_path), '{}') INTO _paths FROM public.lab_project_submission_files WHERE submission_id = _s.id;
  DELETE FROM public.lab_project_submissions WHERE id = _s.id;
  RETURN _paths;
END $$;

-- ============ STAFF RPCs ============
CREATE OR REPLACE FUNCTION public.lab_staff_submission(_submission_id uuid)
RETURNS public.lab_project_submissions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _class uuid;
BEGIN
  SELECT s.* INTO _s FROM public.lab_project_submissions s WHERE s.id = _submission_id;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Submission not found'; END IF;
  SELECT class_id INTO _class FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  IF NOT public.lab_is_staff_for_class(_class) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN _s;
END $$;
REVOKE EXECUTE ON FUNCTION public.lab_staff_submission(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.lab_mark_under_review(_submission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _uid uuid; _title text;
BEGIN
  _s := public.lab_staff_submission(_submission_id);
  IF _s.status <> 'submitted' THEN RETURN; END IF;
  UPDATE public.lab_project_submissions SET status = 'under_review', review_started_at = now(), updated_at = now() WHERE id = _s.id;
  SELECT user_id INTO _uid FROM public.students WHERE id = _s.student_id;
  SELECT title INTO _title FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (_uid, 'Project under review', 'Your teacher is reviewing ' || COALESCE(_title,'your project') || '.', 'info', '/dashboard/projects');
  END IF;
  PERFORM public.lab_audit('review_started', _s.assignment_id, _s.id, _s.student_id, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.lab_grade_submission(_submission_id uuid, _score integer, _feedback text, _rubric_scores jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _uid uuid; _title text; _was_graded boolean;
BEGIN
  _s := public.lab_staff_submission(_submission_id);
  IF _s.status NOT IN ('submitted','under_review','graded') THEN RAISE EXCEPTION 'This submission cannot be graded in its current state'; END IF;
  IF _score IS NULL OR _score < 0 OR _score > _s.max_score THEN RAISE EXCEPTION 'Score must be between 0 and %', _s.max_score; END IF;
  _was_graded := _s.status = 'graded';
  UPDATE public.lab_project_submissions SET status = 'graded', score = _score,
    teacher_feedback = NULLIF(left(trim(COALESCE(_feedback,'')),10000),''),
    rubric_scores = _rubric_scores, graded_by = auth.uid(), graded_at = now(), updated_at = now()
  WHERE id = _s.id;
  SELECT user_id INTO _uid FROM public.students WHERE id = _s.student_id;
  SELECT title INTO _title FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (_uid, CASE WHEN _was_graded THEN 'Project feedback updated' ELSE 'Project graded' END,
      COALESCE(_title,'Your project') || ': ' || _score || '/' || _s.max_score, 'success', '/dashboard/projects');
  END IF;
  PERFORM public.lab_audit(CASE WHEN _was_graded THEN 'feedback_changed' ELSE 'submission_graded' END,
    _s.assignment_id, _s.id, _s.student_id, jsonb_build_object('score', _score, 'previous_score', _s.score));
END $$;

CREATE OR REPLACE FUNCTION public.lab_request_resubmission(_submission_id uuid, _feedback text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.lab_project_submissions; _uid uuid; _title text;
BEGIN
  _s := public.lab_staff_submission(_submission_id);
  IF _s.status NOT IN ('submitted','under_review','graded') THEN RAISE EXCEPTION 'This submission cannot be returned in its current state'; END IF;
  IF COALESCE(trim(_feedback),'') = '' THEN RAISE EXCEPTION 'Please explain what the student should improve'; END IF;
  UPDATE public.lab_project_submissions SET status = 'resubmission_required',
    teacher_feedback = left(trim(_feedback),10000), graded_by = auth.uid(), graded_at = now(), updated_at = now()
  WHERE id = _s.id;
  SELECT user_id INTO _uid FROM public.students WHERE id = _s.student_id;
  SELECT title INTO _title FROM public.lab_project_assignments WHERE id = _s.assignment_id;
  IF _uid IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (_uid, 'Resubmission requested', 'Your teacher has requested a resubmission of ' || COALESCE(_title,'your project') || '.', 'warning', '/dashboard/projects');
  END IF;
  PERFORM public.lab_audit('resubmission_requested', _s.assignment_id, _s.id, _s.student_id, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.lab_log_download(_file_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f record; _s record;
BEGIN
  SELECT * INTO _f FROM public.lab_project_submission_files WHERE id = _file_id;
  IF _f.id IS NULL OR NOT public.lab_can_view_submission(_f.submission_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT assignment_id, student_id INTO _s FROM public.lab_project_submissions WHERE id = _f.submission_id;
  PERFORM public.lab_audit('submission_downloaded', _s.assignment_id, _f.submission_id, _s.student_id, jsonb_build_object('file_name', _f.file_name, 'file_type', _f.file_type));
END $$;

REVOKE EXECUTE ON FUNCTION public.lab_start_submission(uuid), public.lab_save_draft(uuid,text,text,text,text[],text),
  public.lab_attach_file(uuid,text,text,text,text,bigint), public.lab_remove_file(uuid), public.lab_submit(uuid),
  public.lab_delete_draft(uuid), public.lab_mark_under_review(uuid), public.lab_grade_submission(uuid,integer,text,jsonb),
  public.lab_request_resubmission(uuid,text), public.lab_log_download(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lab_start_submission(uuid), public.lab_save_draft(uuid,text,text,text,text[],text),
  public.lab_attach_file(uuid,text,text,text,text,bigint), public.lab_remove_file(uuid), public.lab_submit(uuid),
  public.lab_delete_draft(uuid), public.lab_mark_under_review(uuid), public.lab_grade_submission(uuid,integer,text,jsonb),
  public.lab_request_resubmission(uuid,text), public.lab_log_download(uuid) TO authenticated;

-- ============ STORAGE POLICIES ============
CREATE OR REPLACE FUNCTION public.lab_path_submission(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _parts text[];
BEGIN
  _parts := string_to_array(_name, '/');
  IF array_length(_parts,1) < 6 OR _parts[5] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
  RETURN _parts[5]::uuid;
END $$;

CREATE OR REPLACE FUNCTION public.lab_path_prefix_ok(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lab_project_submissions s JOIN public.lab_project_assignments a ON a.id = s.assignment_id
    WHERE s.id = public.lab_path_submission(_name)
      AND left(_name, length(a.school_id || '/' || a.class_id || '/' || s.student_id || '/' || a.id || '/' || s.id || '/'))
          = a.school_id || '/' || a.class_id || '/' || s.student_id || '/' || a.id || '/' || s.id || '/'
      AND _name NOT LIKE '%..%'
  );
$$;

CREATE OR REPLACE FUNCTION public.lab_can_upload_path(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.lab_path_prefix_ok(_name) AND EXISTS (
    SELECT 1 FROM public.lab_project_submissions s JOIN public.students st ON st.id = s.student_id
    WHERE s.id = public.lab_path_submission(_name) AND st.user_id = auth.uid() AND s.status = 'draft'
  );
$$;

CREATE OR REPLACE FUNCTION public.lab_can_read_path(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.lab_path_prefix_ok(_name) AND public.lab_can_view_submission(public.lab_path_submission(_name));
$$;

CREATE POLICY "lab_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-submissions' AND public.lab_can_upload_path(name));
CREATE POLICY "lab_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-submissions' AND public.lab_can_read_path(name));
CREATE POLICY "lab_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-submissions' AND (public.lab_can_upload_path(name) OR public.has_role(auth.uid(),'admin'::app_role)));
