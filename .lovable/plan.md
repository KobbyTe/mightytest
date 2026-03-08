

# Add Teacher/Educator Role with Admin Approval System

## Overview

Introduce a 4-role hierarchy: **Admin** (super-admin, existing account) > **Teacher/Educator** (needs approval) > **Student** > **Parent**. The existing admin account (kwabenatekyi19@gmail.com) and all its data remain completely untouched.

---

## Architecture

```text
Admin (super-admin)
  ├── Approves/manages teachers
  ├── Full platform control
  └── All current admin capabilities
  
Teacher/Educator (new role)
  ├── Must be approved by admin before login
  ├── Gets current admin-like capabilities (exams, students, grading)
  └── Cannot manage other teachers or admin settings
```

---

## Database Changes

### 1. Add `teacher` to `app_role` enum
```sql
ALTER TYPE public.app_role ADD VALUE 'teacher';
```

### 2. Create `teachers` profile table
- Columns: `id`, `user_id`, `full_name`, `email`, `phone_number`, `school_id`, `subject_specialty`, `status` (pending/approved/rejected), `approved_by`, `approved_at`, `created_at`
- RLS: admin can manage all, teachers can view own profile, teachers can insert own profile

### 3. Update RLS policies
- All existing `has_role(auth.uid(), 'admin'::app_role)` policies need companion policies for teachers (or update the `has_role` checks to also include teacher where appropriate)
- Create a helper function `is_admin_or_teacher()` to avoid duplicating logic
- Tables teachers should access: `exams`, `exam_questions`, `exam_attempts`, `exam_answers`, `students`, `classes`, `schools`, `exam_class_assignments`, `messages`, `resit_openings`, `resit_requests`, `registration_keys`
- Tables only admin should access: `teachers` (management), `user_roles`, `page_views`, `newsletter_subscribers`, `contact_submissions`

---

## Frontend Changes

### Auth Page (`Auth.tsx`)
- Rename "Admin" tab to "Teacher/Educator" with a new icon
- Add a **Teacher Registration** form (name, email, password, school, subject specialty)
- Show message after registration: "Your account is pending admin approval"
- Add a separate hidden/minimal "Admin" login (small link below tabs, or a dedicated `/admin-login` route)
- Teachers with `status = 'pending'` see a "pending approval" screen after login instead of the dashboard

### New: Teacher Registration Edge Function
- Creates auth user, assigns `teacher` role, creates `teachers` profile row with `status = 'pending'`

### Auth Context (`AuthContext.tsx`)
- Add `'teacher'` to the role union type
- Load teacher profile when role is `teacher`
- Check teacher approval status

### Protected Routes (`ProtectedRoute.tsx` & `App.tsx`)
- Add `'teacher'` to allowed roles alongside `'admin'` for dashboard routes
- Teacher routes: `/teacher` dashboard (reuse AdminDashboard or create TeacherDashboard)
- Add pending-approval redirect for unapproved teachers

### Admin Dashboard Updates
- Add **Teacher Management** tab (for admin only): list pending/approved/rejected teachers, approve/reject buttons
- Admin sees everything teachers see, plus teacher management
- When role is `teacher`, hide admin-only tabs (teacher management, website analytics)

### Navigation
- Teacher dashboard header shows "Teacher/Educator Dashboard" instead of "Admin Dashboard"

---

## Edge Functions

### `register-teacher/index.ts` (new)
- Accepts: name, email, password, school_id, subject_specialty
- Creates auth user with `email_confirm: true`
- Assigns `teacher` role in `user_roles`
- Creates `teachers` row with `status: 'pending'`

### `approve-teacher/index.ts` (new)
- Admin-only: updates teacher `status` to `approved` or `rejected`
- Sends notification to teacher

### Update `login/index.ts`
- Handle `teacher` userType
- Check teacher approval status; reject login if pending/rejected

---

## Files to Create/Edit

| File | Action |
|------|--------|
| Migration SQL | Add enum value, create `teachers` table, update RLS |
| `supabase/functions/register-teacher/index.ts` | New edge function |
| `supabase/functions/approve-teacher/index.ts` | New edge function |
| `supabase/functions/login/index.ts` | Add teacher type handling |
| `src/contexts/AuthContext.tsx` | Add teacher role support |
| `src/components/ProtectedRoute.tsx` | Add teacher to allowed roles |
| `src/pages/Auth.tsx` | Rename admin tab, add teacher registration |
| `src/pages/AdminDashboard.tsx` | Add teacher management tab, conditional tabs |
| `src/components/admin/TeacherManagement.tsx` | New component |
| `src/App.tsx` | Add teacher routes |
| `src/components/ChatBubble.tsx` | Add teacher as sender/recipient role |

---

## Safety Guarantees

- The existing admin account's `user_roles` row (`role = 'admin'`) is never modified
- No existing RLS policies are removed -- only new companion policies added
- All existing data relationships remain intact
- The `admin` role retains full access to everything

