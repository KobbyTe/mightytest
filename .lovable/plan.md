

# Teacher-Class Scoping System

## Problem
Currently, all teachers see all exams, students, and classes across the entire platform. With multiple teachers per school (teaching different subjects in the same class), each teacher should only see and manage their own assigned classes and subjects.

## Database Changes

### 1. New `teacher_class_assignments` table
Links teachers to specific classes with a subject scope:

```sql
CREATE TABLE public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  UNIQUE (teacher_id, class_id, subject)
);

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage teacher_class_assignments"
  ON public.teacher_class_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Teachers can view their own assignments
CREATE POLICY "Teachers can view own assignments"
  ON public.teacher_class_assignments FOR SELECT
  USING (teacher_id IN (
    SELECT id FROM public.teachers WHERE user_id = auth.uid()
  ));
```

### 2. New helper function
```sql
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tca.class_id
  FROM teacher_class_assignments tca
  JOIN teachers t ON t.id = tca.teacher_id
  WHERE t.user_id = _user_id;
$$;
```

## Admin UI — Assign Teachers to Classes
In the **TeacherManagement** component, add an "Assign Classes" action per teacher:
- Dialog showing school → class → subject dropdowns
- Creates rows in `teacher_class_assignments`
- Auto-populate subject from teacher's `subject_specialty` as default

## Teacher Dashboard Scoping
Update data-fetching in **AdminDashboard.tsx** (teacher route) to filter by assigned classes:

- **Exams**: Only show exams assigned to the teacher's classes, or created by the teacher
  ```ts
  // Fetch teacher's assigned class IDs first
  const { data: assignments } = await supabase
    .from('teacher_class_assignments')
    .select('class_id, subject')
    .eq('teacher_id', teacherRecord.id);
  
  // Then filter exams by those class assignments
  const classIds = assignments.map(a => a.class_id);
  const { data: examAssignments } = await supabase
    .from('exam_class_assignments')
    .select('exam_id')
    .in('class_id', classIds);
  ```

- **Students**: Filter `students` table by `class_id IN (teacher's assigned class IDs)`
- **Exam Attempts**: Only attempts for exams assigned to teacher's classes
- **Registration Keys**: Only for teacher's assigned classes

## Fallback for Admins
Admin role bypasses all scoping — continues to see everything (no change needed, existing RLS handles this).

## Files to Modify
1. **Migration** — Create `teacher_class_assignments` table + helper function
2. **`src/components/admin/TeacherManagement.tsx`** — Add "Assign Classes" UI
3. **`src/pages/AdminDashboard.tsx`** — Add scoping logic for teacher role in `loadExams` and related queries
4. **`src/components/admin/StudentManagement.tsx`** — Filter students by teacher's classes when role is teacher
5. **`src/components/admin/ExamAssignment.tsx`** — Scope class dropdown to teacher's assignments
6. **`src/components/admin/RegistrationKeyManagement.tsx`** — Scope to teacher's classes

## Scope Summary
- New table: `teacher_class_assignments` with RLS
- New DB function: `get_teacher_class_ids`
- Admin gets a UI to assign teachers → classes + subjects
- Teacher dashboard queries are filtered by their assignments
- No changes to student registration or auth flow

