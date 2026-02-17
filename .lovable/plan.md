
# Plan: Resit Exam System

## Overview
Add a resit (retake) exam system where the admin can reopen an exam for a specific class, students apply for the resit, and the admin approves individual students before they can retake the exam.

---

## Database Changes

### New Table: `resit_requests`
Tracks which exams are open for resit per class, and individual student requests with admin approval status.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| exam_id | uuid | References exams |
| class_id | uuid | References classes |
| student_id | uuid | References students |
| status | text | `pending`, `approved`, `rejected` (default: `pending`) |
| requested_at | timestamptz | Default: now() |
| reviewed_at | timestamptz | Nullable |
| reviewed_by | uuid | Nullable (admin who reviewed) |
| admin_note | text | Optional rejection/approval reason |
| created_at | timestamptz | Default: now() |

### New Table: `resit_openings`
Tracks which exam+class combos are open for resit applications.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| exam_id | uuid | References exams |
| class_id | uuid | References classes |
| opened_by | uuid | Admin who opened it |
| is_open | boolean | Default: true |
| deadline | timestamptz | Nullable, deadline to apply |
| created_at | timestamptz | Default: now() |

### RLS Policies
- **resit_openings**: Admins can manage all. Students can SELECT openings for their class.
- **resit_requests**: Admins can manage all. Students can INSERT their own requests and SELECT their own requests.

---

## Admin Side (ExamAssignment or new tab)

### "Resit Management" section added to Admin Dashboard
A new tab called **"Resits"** in the admin dashboard with two sub-sections:

1. **Open Resit Portal**: Admin selects a school, class, and exam, then clicks "Open for Resit". This creates a `resit_openings` row. Admin can also close the portal and set a deadline.

2. **Review Resit Requests**: A table showing all pending resit requests with student name, exam title, class, original score, and approve/reject buttons. Bulk approve option included.

When an admin approves a request:
- The `resit_requests.status` is set to `approved`
- This allows the student to register a new `exam_attempts` row for that exam

---

## Student Side (Dashboard)

### Resit Section on Student Dashboard
Below the "Available Exams" section, a new **"Resit Exams"** section appears if there are any open resit portals for the student's class and the student has a completed/graded attempt for that exam.

- Shows the exam name, original score, and deadline
- Student clicks **"Apply for Resit"** which creates a `resit_requests` row with status `pending`
- Once approved, the exam appears in available exams again with a "Resit" badge and the student can register a new attempt
- If pending, shows "Awaiting Approval" status
- If rejected, shows "Rejected" with admin note

### Exam Registration Logic Update
The `handleRegisterExam` function in Dashboard.tsx will be updated:
- Before inserting a new attempt, check if the student already has a completed/graded attempt
- If yes, verify there is an approved `resit_requests` entry for this student+exam combo
- If no approved resit, block registration with a message
- If approved, allow the new attempt (the existing unique constraint on exam_attempts may need to be relaxed -- currently there's no unique constraint based on the error handling code, so multiple attempts should work)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | New `resit_openings` and `resit_requests` tables with RLS |
| `src/components/admin/ResitManagement.tsx` | Create | Admin UI for opening resits and approving requests |
| `src/pages/AdminDashboard.tsx` | Modify | Add "Resits" tab |
| `src/pages/Dashboard.tsx` | Modify | Add resit section and update exam registration logic |

---

## Technical Details

### Migration SQL
```text
-- resit_openings table
CREATE TABLE public.resit_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  class_id UUID NOT NULL,
  opened_by UUID,
  is_open BOOLEAN DEFAULT true,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, class_id)
);

ALTER TABLE public.resit_openings ENABLE ROW LEVEL SECURITY;

-- resit_requests table
CREATE TABLE public.resit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE public.resit_requests ENABLE ROW LEVEL SECURITY;
```

### Admin Resit Workflow
1. Admin goes to "Resits" tab
2. Clicks "Open Resit Portal" -- selects school, class, exam
3. Students in that class who failed see the resit option
4. Students apply -- request appears in admin's pending list
5. Admin reviews original score, approves or rejects
6. Approved students can re-register for the exam

### Student Dashboard Resit Flow
1. Query `resit_openings` where `class_id = student's class` and `is_open = true`
2. Cross-reference with student's completed attempts to show only exams they've taken
3. Query `resit_requests` for the student to show current request status
4. If no request yet: show "Apply for Resit" button
5. If approved and no new pending attempt: show "Register for Resit" button (calls existing `handleRegisterExam`)
