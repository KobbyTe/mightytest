

# Two Feature Implementation Plan

## Feature 1: Full-Page Class Performance Portal (Admin)

### Current Behavior
When an admin clicks the eye button on a class, the `ClassPerformancePortal` opens as a `Sheet` (side panel) with `sm:max-w-4xl`. This feels cramped and unprofessional for the amount of data displayed (student tables, charts, reports).

### Proposed Change
Replace the `Sheet` component with a full-page `Dialog` that covers the entire screen, giving the portal a clean, professional full-page layout.

**File: `src/components/admin/ClassPerformancePortal.tsx`**
- Replace `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription` with `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`
- Set `DialogContent` to use `max-w-[95vw] w-full h-[90vh] overflow-y-auto` for a near-fullscreen modal
- Add a proper close button in the header
- Keep all existing tabs (Students, Performance, Reports) and export functionality intact

---

## Feature 2: Exam Review Page (Student Dashboard)

### Current Behavior
On the student dashboard, completed/graded exams show a "Completed" button that is disabled. Students cannot see which questions they got wrong, what the correct answers were, or any explanations.

### Proposed Change
Add a "Review Exam" button on completed/graded exam cards that navigates to a new dedicated review page showing a question-by-question breakdown.

### New Page: `src/pages/ExamReview.tsx`
A full page that:
1. Fetches the exam attempt, all questions, and the student's answers
2. Displays each question with:
   - The question text and options
   - The student's selected answer (highlighted green if correct, red if wrong)
   - The correct answer (always shown in green)
   - Marks awarded vs marks available
3. For incorrect answers: shows a brief AI-generated review/explanation of why the correct answer is right (generated once and cached, or a static explanation based on the correct answer)
4. Summary at the top: total score, pass/fail status, number correct vs total

### Implementation Details

**New route in `src/App.tsx`:**
- `/exam/review/:attemptId` -- lazy-loaded `ExamReview` page

**Changes to `src/pages/Dashboard.tsx`:**
- Replace the disabled "Completed" button with a "Review Exam" button that navigates to `/exam/review/{attemptId}`

**New file: `src/pages/ExamReview.tsx`:**
- Fetches `exam_attempts` by attempt ID (with exam details)
- Fetches `exam_questions` for that exam
- Fetches `exam_answers` for that attempt
- Matches answers to questions and displays a clean, card-based review layout
- Each question card shows:
  - Question number and text
  - For MCQ/True-False: all options with visual indicators (green checkmark for correct, red X for student's wrong answer)
  - For essay/subjective: the student's answer text and marks awarded
  - A "Review" section with a brief explanation for incorrect answers (a short static sentence explaining the correct answer, derived from the question context)
- Color coding: correct answers get a green border/background, incorrect get a red border/background
- A "Back to Dashboard" button at the top

### Technical Notes
- The review explanations will be simple, static text like "The correct answer is [X] because it matches the expected response" for auto-graded questions. For subjective questions, it will show the admin's feedback if available.
- No AI API calls needed -- the review is based on comparing `exam_answers.answer_text` with `exam_questions.correct_answer`
- RLS policies already allow students to view their own answers and questions for active exams, so no database changes are needed

---

## Summary of Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/admin/ClassPerformancePortal.tsx` | Change from Sheet to full-page Dialog |
| `src/pages/ExamReview.tsx` | New page for question-by-question exam review |
| `src/pages/Dashboard.tsx` | Add "Review Exam" button on completed exam cards |
| `src/App.tsx` | Add `/exam/review/:attemptId` route |

