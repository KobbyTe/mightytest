

# Separate Admin & Teacher Roles with New Admin Dashboard

## Summary

Transfer `kwabenatekyi19@gmail.com` from admin to teacher (auto-approved, all data preserved), create a new admin account for `justiceansah19@gmail.com`, and build a dedicated modern admin dashboard with comprehensive analytics.

---

## Database Changes

### 1. Role swap for kwabenatekyi19@gmail.com
- UPDATE `user_roles` to change role from `admin` to `teacher` for this user
- INSERT into `teachers` table with `status = 'approved'` (auto-approved, no approval needed)
- All existing data (exams, students, etc.) remains untouched since RLS now grants teacher access to the same tables

### 2. Create admin account for justiceansah19@gmail.com
- Use the existing `create-admin` edge function with the provided credentials
- This creates the auth user + assigns `admin` role in `user_roles`

---

## New Admin Dashboard (`src/pages/NewAdminDashboard.tsx`)

A modern, analytics-heavy dashboard exclusively for the admin role with:

### Overview Section
- KPI cards: Total Students, Total Teachers, Total Exams, Active Exams, Overall Pass Rate, Average Score
- Real-time stats pulled from `students`, `teachers`, `exams`, `exam_attempts`

### Student Analytics
- Enrollment trends (line chart over time)
- Performance distribution (histogram of scores)
- Pass/fail rates by subject (bar chart)
- Top performers table
- Students per school/class breakdown (pie chart)

### Teacher Analytics
- Total teachers, pending approvals count
- Teacher approval management (approve/reject from here)
- Teachers by school/subject (table)

### Exam Analytics
- Exam completion rates (bar chart)
- Average scores by subject (bar chart)
- Score trends over time (line chart)
- Grade distribution (pie chart: A/B/C/D/F)
- Most attempted exams ranking

### Platform Analytics
- Reuse existing `WebsiteAnalytics` component for traffic
- Active users over time

### Management Tabs
- Teacher Management (existing component)
- School Management (existing component)
- Student overview with bulk operations

---

## Frontend Routing Changes

| Route | Role | Component |
|-------|------|-----------|
| `/admin` | admin | **NewAdminDashboard** (new) |
| `/admin-setup` | admin | AdminSetup |
| `/teacher` | teacher | AdminDashboard (current, renamed to TeacherDashboard) |

### Auth Page Updates
- The hidden "Admin Login" link stays — admin logs in with `justiceansah19@gmail.com`
- Teacher tab remains for `kwabenatekyi19@gmail.com` and other teachers
- Update `AdminSetup.tsx` defaults to new admin credentials

### ExamAnalytics.tsx
- Update role check to allow both `admin` and `teacher`

### ProtectedRoute
- No changes needed (already supports all roles)

---

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/NewAdminDashboard.tsx` | **Create** — Full admin dashboard with modern analytics |
| `src/App.tsx` | Update `/admin` route to use NewAdminDashboard |
| `src/pages/AdminDashboard.tsx` | Minor: remove admin-only tabs (teachers, analytics), rename to teacher-focused |
| `src/pages/AdminSetup.tsx` | Update default email to justiceansah19@gmail.com |
| `src/pages/ExamAnalytics.tsx` | Allow teacher role access |
| Migration SQL | Role swap for kwabenatekyi19@gmail.com + teacher profile insert |

---

## Data Safety

- No deletion of any data belonging to kwabenatekyi19@gmail.com
- All exams created by that user remain accessible (teacher role has same RLS access to exams, students, etc.)
- The `created_by` field on exams still references the same user_id — no change needed
- The new admin (justiceansah19@gmail.com) gets full platform control

