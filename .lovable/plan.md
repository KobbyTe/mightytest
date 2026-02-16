# Plan: Display Student ID Code & Email + Exam Score Celebration Screen

## Overview

Three changes: (1) show the official Student ID code and email on the student dashboard profile card, (2) show them in the admin's student management table and details dialog, and (3) add a celebratory score results screen after exam submission instead of immediately redirecting to the dashboard.

---

## Change 1: Student Dashboard Profile Card

**File: `src/contexts/AuthContext.tsx**`

- Add `student_id_code` to the student select query (line 60):
  - From: `'id,user_id,full_name,email,grade,school_name,parent_id,class_id'`
  - To: `'id,user_id,full_name,email,grade,school_name,parent_id,class_id,student_id_code'`

**File: `src/pages/Dashboard.tsx**`

- In the Profile Card section (around line 409-426), add two new fields:
  - **Student ID**: `profile?.student_id_code` (displayed prominently with a badge style)
  - **Email**: `profile?.email` (already shown, but ensure it displays the real email or the synthetic one clearly)

---

## Change 2: Admin Dashboard Student Management

**File: `src/components/admin/StudentManagement.tsx**`

- Add `student_id_code` to the student select query (line 76):
  - Add it to the select fields
- Add `student_id_code` to the `Student` interface
- Add a "Student ID" column to the table between Name and Email
- Add "Student ID" to the View Details dialog

---

## Change 3: Exam Score Celebration Screen

**File: `src/pages/ExamTaking.tsx**`

- Instead of immediately navigating to `/dashboard` after submission, show a full-screen celebratory results overlay:
  - Display the score prominently (e.g., "You scored 85/100!")
  - Show pass/fail status with appropriate messaging
  - Celebratory animations for passing (confetti-like styling, trophy icon, encouraging text like "Amazing work!")
  - Encouraging message for failing ("Keep practicing, you'll get there!")
  - A "Back to Dashboard" button that navigates after the student has seen their score
- For essay-only exams (pending grading), show a "Submitted successfully! Your score will be available after grading." message instead
- Add a new state `showResults` with `resultData` (marks, total, passed, hasEssay) to control the overlay

---

## Technical Details

### AuthContext query change (line 60)

```
supabase.from('students').select('id,user_id,full_name,email,grade,school_name,parent_id,class_id,student_id_code')
```

### Dashboard profile card additions

Two new grid items showing Student ID (with copy button) and Email.

### StudentManagement query change (line 76)

Add `student_id_code` to the select string and display it in the table and view dialog.

### ExamTaking results screen

- New state: `showResults` (boolean), `resultData` ({ marks, totalMarks, passingMarks, passed, hasEssay, examTitle })
- After successful submission in `handleManualSubmit`, set `showResults = true` with the score data instead of navigating
- Render a full-screen overlay when `showResults` is true with:
  - Large trophy/star icon
  - Score in large bold text
  - Pass/fail badge
  - Percentage display
  - Motivational message
  - "Return to Dashboard" button

### Files to modify


| File                                         | Change                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `src/contexts/AuthContext.tsx`               | Add `student_id_code` to student query                |
| `src/pages/Dashboard.tsx`                    | Show Student ID and email in profile card             |
| `src/components/admin/StudentManagement.tsx` | Add Student ID column + details                       |
| `src/pages/ExamTaking.tsx`                   | Add celebratory score results screen after submission |
