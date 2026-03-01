
# Fix All 14 Platform Bugs

## Bug #1 -- Parent Dashboard "Avg Score" uses raw marks instead of percentages
**File:** `src/pages/ParentDashboard.tsx`
- Lines 131-136: Change overall `avgScore` to use percentage-based calculation: `sum((marks_obtained / total_marks) * 100) / count`
- Lines 252-253: Change per-child `childAvgScore` to use the same percentage formula

## Bug #2 -- Exam timer resets on page refresh
**File:** `src/pages/ExamTaking.tsx`
- Line 308: After loading attempt data, calculate remaining time as `duration_minutes * 60 - elapsed` where `elapsed = (Date.now() - started_at) / 1000`, instead of always using full `duration_minutes * 60`
- If remaining time is <= 0, auto-submit immediately

## Bug #3 -- `started_at` overwritten on every load
**File:** `src/pages/ExamTaking.tsx`
- Lines 350-353: Only update `started_at` if `attemptData.started_at` is null. Wrap the update in a conditional check.

## Bug #4 -- ExamGrading overwrites auto-graded answers
**File:** `src/pages/ExamGrading.tsx`
- Lines 281-296: Disable the "Marks Awarded" input for auto-graded questions (multiple_choice, true_false) so the admin cannot accidentally overwrite them. Show a "Auto-graded" label instead.
- The save function already iterates all `answerGrades`, so locking the UI is sufficient.

## Bug #5 -- No centralized route protection
**File:** `src/App.tsx`
- Create a lightweight `ProtectedRoute` wrapper component that checks `useAuth()` role before rendering children, showing a loading spinner during auth resolution instead of briefly flashing the wrong dashboard.
- Wrap `/dashboard`, `/parent`, `/admin`, `/exam/*`, `/grading/*` routes with it.

## Bug #6 -- Stale closures in Dashboard useEffect
**File:** `src/pages/Dashboard.tsx`
- The `dataLoaded` flag already prevents re-execution. This is a theoretical concern, not a runtime bug. No change needed -- the existing guard is sufficient.

## Bug #7 -- Delete-then-insert answer saving is not atomic
**File:** `src/pages/ExamTaking.tsx`
- Lines 238-268: Replace the delete-all + insert-all pattern with upsert. Use `supabase.from('exam_answers').upsert(answersToSave, { onConflict: 'attempt_id,question_id' })` so individual answers are updated in place without deleting first.
- This requires adding a unique constraint on `(attempt_id, question_id)` via a database migration.

**Database Migration:**
```sql
ALTER TABLE public.exam_answers
ADD CONSTRAINT exam_answers_attempt_question_unique
UNIQUE (attempt_id, question_id);
```

## Bug #8 -- send-grade-notification uses Resend SDK import
**File:** `supabase/functions/send-grade-notification/index.ts`
- Replace `import { Resend } from "https://esm.sh/resend@2.0.0"` and `resend.emails.send(...)` with raw `fetch('https://api.resend.com/emails', ...)` calls, matching the pattern used in `notify-exam-assigned`.

## Bug #9 -- Exam deletion doesn't cascade
**Database Migration:** Add `ON DELETE CASCADE` to all foreign keys referencing `exams.id`:
```sql
-- exam_questions
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_exam_id_fkey;
ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- exam_class_assignments
ALTER TABLE public.exam_class_assignments DROP CONSTRAINT IF EXISTS exam_class_assignments_exam_id_fkey;
ALTER TABLE public.exam_class_assignments ADD CONSTRAINT exam_class_assignments_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- resit_openings
ALTER TABLE public.resit_openings DROP CONSTRAINT IF EXISTS resit_openings_exam_id_fkey;
ALTER TABLE public.resit_openings ADD CONSTRAINT resit_openings_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- resit_requests
ALTER TABLE public.resit_requests DROP CONSTRAINT IF EXISTS resit_requests_exam_id_fkey;
ALTER TABLE public.resit_requests ADD CONSTRAINT resit_requests_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;
```

Note: `exam_attempts` and `exam_answers` cascade will also be handled (attempts -> answers).

## Bug #10 -- ExamReview auto-generates AI reviews on every visit
**File:** `src/pages/ExamReview.tsx`
- Lines 156-185: Before calling `generateReviews()`, check if the loaded answers already have non-generic `review_text` on all of them. Only regenerate if there are answers with null `review_text` (not generic pattern matching). Remove the "clear generic reviews" logic that wipes existing review text.
- Add a simple check: if all answers have `review_text !== null`, skip generation entirely.

## Bug #11 -- Parent dashboard data loads multiple times
**File:** `src/pages/ParentDashboard.tsx`
- Add a `dataLoaded` ref/state guard (like the student dashboard has) to prevent `loadDashboardData` from firing again when `profile` reference changes.

## Bug #12 -- Admin tabs overflow on small screens
**File:** `src/pages/AdminDashboard.tsx`
- Line 232: Change `grid-cols-8 lg:w-[1200px]` to a scrollable horizontal layout: use `flex overflow-x-auto` on the TabsList so tabs scroll horizontally on smaller screens instead of overflowing.

## Bug #13 -- Fire-and-forget toast on unmounted component
**File:** `src/components/admin/ExamAssignment.tsx`
- This is a non-issue in practice since `sonner` toasts are global and not tied to component lifecycle. No change needed.

## Bug #14 -- Missing null check on exam in handleManualSubmit
**File:** `src/pages/ExamTaking.tsx`
- Line 448-455: Add an early return if `exam` is null before building `resultData`. Show a toast error: "Exam data not available."

## Summary of Changes

| Priority | Bug | File(s) | Type |
|----------|-----|---------|------|
| Critical | #2, #3 | ExamTaking.tsx | Code fix |
| Critical | #1 | ParentDashboard.tsx | Code fix |
| Critical | #4 | ExamGrading.tsx | Code fix |
| Moderate | #7 | ExamTaking.tsx + DB migration | Code + DB |
| Moderate | #8 | send-grade-notification/index.ts | Edge function |
| Moderate | #9 | DB migration | Database |
| Moderate | #10 | ExamReview.tsx | Code fix |
| Moderate | #5 | App.tsx + new component | Code fix |
| Moderate | #11 | ParentDashboard.tsx | Code fix |
| Minor | #12 | AdminDashboard.tsx | CSS fix |
| Minor | #14 | ExamTaking.tsx | Code fix |
| Skip | #6, #13 | -- | No change needed |

**Database migrations required:** 2 (unique constraint for upsert, cascade foreign keys for exam deletion)
