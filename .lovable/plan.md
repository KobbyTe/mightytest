

# Add Student Management for Admins (Change Class and Delete)

## Overview
Add a new "Students" tab to the Admin Dashboard where admins can view all students, change a student's class assignment, and delete students entirely.

## Changes

### 1. New "Students" Tab in Admin Dashboard (`src/pages/AdminDashboard.tsx`)
- Add a 5th tab called "Students" to the existing TabsList
- Display a searchable table of all students showing: Name, Email, School, Class, Grade, and Actions
- Actions include: "Change Class" (opens a dialog) and "Delete" (with confirmation)

### 2. Student Management Component (`src/components/admin/StudentManagement.tsx` - new file)
- Fetches all students with their school/class info
- Search bar to find students by name or email
- Filter by school
- **Change Class**: Opens a dialog with school and class dropdowns. When the admin selects a new class, updates the student's `class_id` and `school_id` in the `students` table
- **Delete Student**: Confirmation dialog, then deletes the student record from the `students` table and their auth account via a backend function

### 3. Delete Student Backend Function (`supabase/functions/delete-student/index.ts` - new file)
- Accepts a `student_id`
- Looks up the student's `user_id`
- Deletes the auth user (which cascades to delete the student record and related data)
- Only callable by admins (verified via JWT role check)

## Technical Details

### Student Table Update (Change Class)
Simple UPDATE query on the `students` table:
```sql
UPDATE students SET class_id = 'new-class-id', school_id = 'new-school-id' WHERE id = 'student-id'
```
This is already allowed by the existing RLS policy: "Admins can manage students" (ALL command).

### Student Deletion
- The edge function will use the Supabase service role to call `auth.admin.deleteUser(userId)`
- This cascades through foreign keys to clean up related records
- The function validates the caller is an admin before proceeding

### UI Layout
The Students tab will show:

| Name | Email | School | Class | Actions |
|------|-------|--------|-------|---------|
| Victoria Blay | blay...@gmail.com | School Name | Class A | [Change Class] [Delete] |

The "Change Class" dialog will have:
- Current class displayed
- School dropdown (to filter classes)
- Class dropdown (filtered by selected school)
- Save button

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/components/admin/StudentManagement.tsx` | Create - new student management component |
| `src/pages/AdminDashboard.tsx` | Modify - add Students tab |
| `supabase/functions/delete-student/index.ts` | Create - backend function for deleting student auth accounts |

