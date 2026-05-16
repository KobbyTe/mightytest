## Problem

`exam_questions.question_type` allows four values (`multiple_choice`, `true_false`, `short_answer`, `essay`). `ExamTaking.tsx` only renders an answer input for the first three options + essay — **`short_answer` is missing entirely**, so students see the prompt with no write space and cannot answer. It is also skipped in the grading map and the read-aloud helper.

## Fix (frontend-only, single file: `src/pages/ExamTaking.tsx`)

1. **Add a `short_answer` input branch** next to the essay block (~line 971): a smaller `Textarea` (rows=4) wired to the same `answers[currentQuestion.id]` / `handleAnswerChange` pattern, with a hint that it will be manually graded.
2. **Include `short_answer` in the grading map** (~line 155): treat it like essay → `hasEssay = true`, `is_correct: null`, `marks_awarded: null` so it routes to manual grading (already handled by `ExamGrading.tsx`).
3. **Update the question-type label** (~line 859) and **read-aloud helper** (~line 890) to recognise `short_answer` ("Short Answer" / "Write a brief answer in the text box.").
4. **Update the "essay detected" notice** wording (~line 633) to also cover short-answer when present, so students aren't surprised that those need manual grading.

No DB, RLS, or edge-function changes. No business-logic change to scoring — the existing normalized-marks fix stays as-is.