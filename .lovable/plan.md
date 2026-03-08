

# Fix Redundancy in ExamTaking.tsx

After reviewing the file, there are three major areas of redundancy:

## 1. Duplicated Grading Logic (autoSubmitExam vs handleManualSubmit)

Both `autoSubmitExam` (lines 78-142) and `handleManualSubmit` (lines 389-491) contain nearly identical code:
- Iterate over answers, find matching questions
- Grade MCQ/true_false by comparing to `correct_answer`
- Mark essays as `is_correct: null, marks_awarded: null`
- Calculate `totalMarks` / `hasEssay`
- Delete all answers then re-insert graded ones
- Update attempt status, send notification

**Fix:** Extract a shared `gradeAndSubmitExam(submissionType)` function that both call.

## 2. autoSubmitExam and handleManualSubmit Still Use Delete-Then-Insert

Bug #7 was only fixed for the real-time auto-save (line 252). Both submission functions (lines 84 and 408) still use `delete` + `insert`. These should use upsert too, for consistency and atomicity.

**Fix:** Use upsert in the shared submission function.

## 3. Unused useQuestionTimer Hook

There's a fully-built `src/hooks/useQuestionTimer.ts` with timer logic and formatting functions, but ExamTaking.tsx reimplements everything inline:
- `formatTotalTime` (line 493) duplicates the hook's `formatTotalTime`
- `formatQuestionTime` (line 500) duplicates the hook's `formatQuestionTime`
- Question timer effect (lines 208-228) and total timer effect (lines 190-205) duplicate the hook's timers

**Fix:** This hook has different semantics (it auto-advances internally), so rather than adopting it, remove the unused hook file to avoid confusion. The inline implementation is better suited since it needs access to `autoSubmitExam`.

## Changes

### `src/pages/ExamTaking.tsx`
1. Create a shared `gradeAndSubmitExam(submissionType: string)` helper that:
   - Grades all answers (MCQ/true_false auto-grade, essay null)
   - Upserts graded answers (not delete+insert)
   - Updates attempt status
   - Sends notification
   - Returns result data for the overlay
2. Refactor `autoSubmitExam` to call `gradeAndSubmitExam` then show toast + navigate
3. Refactor `handleManualSubmit` to call `gradeAndSubmitExam` then show results overlay
4. Remove duplicated local `formatTotalTime` and `formatQuestionTime` (keep them, but now only one copy exists)

### `src/hooks/useQuestionTimer.ts`
- Delete this unused file

This reduces ~100 lines of duplicated grading/submission logic into a single shared function.

