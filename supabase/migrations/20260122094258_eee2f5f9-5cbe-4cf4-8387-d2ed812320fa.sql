-- Create schools table
CREATE TABLE public.schools (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create classes table
CREATE TABLE public.classes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade_level TEXT,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(school_id, name)
);

-- Create exam_class_assignments table (which exams are assigned to which classes)
CREATE TABLE public.exam_class_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    due_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(exam_id, class_id)
);

-- Add school_id and class_id to students table (replace old school_name/grade with proper relations)
ALTER TABLE public.students 
    ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- Add submission_type column to exam_attempts for tracking auto-submit vs manual
ALTER TABLE public.exam_attempts
    ADD COLUMN submission_type TEXT DEFAULT 'manual' CHECK (submission_type IN ('manual', 'auto_submitted', 'time_expired'));

-- Add current_question_index and last_activity_at for per-question tracking
ALTER TABLE public.exam_attempts
    ADD COLUMN current_question_index INTEGER DEFAULT 0,
    ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_class_assignments ENABLE ROW LEVEL SECURITY;

-- Schools policies
CREATE POLICY "Admins can manage schools" ON public.schools
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view active schools" ON public.schools
    FOR SELECT USING (status = 'active');

-- Classes policies
CREATE POLICY "Admins can manage classes" ON public.classes
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view active classes" ON public.classes
    FOR SELECT USING (status = 'active');

-- Exam class assignments policies
CREATE POLICY "Admins can manage exam assignments" ON public.exam_class_assignments
    FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view assignments for their class" ON public.exam_class_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE students.user_id = auth.uid() 
            AND students.class_id = exam_class_assignments.class_id
        )
    );

CREATE POLICY "Parents can view assignments for their children's class" ON public.exam_class_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students
            JOIN parents ON parents.id = students.parent_id
            WHERE parents.user_id = auth.uid()
            AND students.class_id = exam_class_assignments.class_id
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON public.schools
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();