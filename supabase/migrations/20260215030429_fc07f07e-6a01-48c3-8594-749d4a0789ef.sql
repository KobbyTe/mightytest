
-- Create registration_keys table
CREATE TABLE public.registration_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code text NOT NULL UNIQUE,
  school_id uuid NOT NULL REFERENCES public.schools(id),
  class_id uuid NOT NULL REFERENCES public.classes(id),
  status text NOT NULL DEFAULT 'available',
  claimed_by uuid REFERENCES public.students(id),
  claimed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registration_keys ENABLE ROW LEVEL SECURITY;

-- Admins can manage all keys
CREATE POLICY "Admins can manage registration keys"
ON public.registration_keys
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can SELECT available keys (needed for pre-auth validation)
CREATE POLICY "Anyone can view available keys"
ON public.registration_keys
FOR SELECT
USING (status = 'available');

-- Make students.email nullable
ALTER TABLE public.students ALTER COLUMN email DROP NOT NULL;

-- Add student_id_code column
ALTER TABLE public.students ADD COLUMN student_id_code text;
