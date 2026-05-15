# Fix exam scoring inflation and false auto-submits

Two distinct bugs in the exam engine. Both fixes stay in `src/pages/ExamTaking.tsx`, `src/hooks/useExamAutoSubmit.ts`, and `src/pages/ExamGrading.tsx`. No schema changes.

---

## Bug 1 — Score exceeds the exam's declared total (e.g. `39/48` when exam is 40)

**Root cause.** Each question carries its own `marks` field. When questions are imported (AI-generated, PDF, manual) the sum of `question.marks` can exceed `exams.total_marks`. The submission paths just sum raw `question.marks`:

- `ExamTaking.tsx` → `gradeAndSubmitExam` (lines 144–160) writes `marks_obtained = totalMarks` unclamped.
- `useExamAutoSubmit.ts` does the same.
- `ExamGrading.tsx` (line 230) also writes the unclamped sum after manual/AI grading.

So `marks_obtained` can be 48 while the UI denominator (`exam.total_marks`) is 40, producing "39/48" or "47/40"-style nonsense.

**Fix.** When persisting `marks_obtained`, normalise to the exam's declared `total_marks`:

```ts
const rawSum = sum(question.marks awarded);
const questionTotal = sum(all question.marks);
const finalMarks = questionTotal > 0
  ? Math.round((rawSum / questionTotal) * exam.total_marks)
  : 0;
// clamp as a safety net
const marks_obtained = Math.min(exam.total_marks, Math.max(0, finalMarks));
```

Apply in all three places:
1. `ExamTaking.tsx::gradeAndSubmitExam` — load `exam.total_marks` into the helper (already in scope via `exam` state) and write the normalised value.
2. `useExamAutoSubmit.ts` — accept `examTotalMarks` + the full question list (already passed) and do the same normalisation.
3. `ExamGrading.tsx::handleSaveGrading` — replace the raw sum with the normalised value using `attempt.exam.total_marks` and `totalPossible`.

Also update the Grading header badge (line 307–309) to show `{normalised} / {exam.total_marks}` so the teacher sees the same denominator the student will see.

`exam_answers.marks_awarded` stays as the raw per-question marks (used by review/AI explanations). Only the aggregated `exam_attempts.marks_obtained` is normalised.

---

## Bug 2 — Exam auto-submits without the student doing anything wrong

Three offenders, all in `ExamTaking.tsx` (and a copy in `useExamAutoSubmit.ts` that should be deleted since it's unused / duplicates the page logic).

### 2a. `visibilitychange` is too trigger-happy
Currently (lines 220–231) **any** `document.hidden` event submits instantly. On mobile this fires for: incoming call, notification shade pull-down, screen lock, switching to a calculator, browser minimising for a keyboard. None of these are cheating.

**Fix.** Replace instant submit with a 3-strike warning system:
- 1st hide → toast warning "Don't leave the exam tab. Strike 1 of 3."
- 2nd hide → toast warning "Strike 2 of 3. One more and your exam will be submitted."
- 3rd hide → auto-submit with reason `tab_switch`.

Strikes are kept in a `useRef` so they survive re-renders. Also require the tab to have been hidden for **>1.5 s** before counting (filters out notification shade / accidental swipes) by setting a timeout on `visibilitychange` and clearing it when the tab becomes visible again.

### 2b. `beforeunload` auto-submits on refresh / back button
Currently (lines 234–248) the handler calls `autoSubmitExam('page_exit')` synchronously then sets `returnValue`. Two problems:
- The submit fires the moment the browser asks the confirmation prompt — before the student even sees it. If they click "Stay", the exam is already submitted in the background.
- A plain Cmd-R / browser back triggers submission.

**Fix.** Inside `beforeunload`, only set `e.returnValue` to show the native confirmation prompt. **Do not** call `autoSubmitExam` from here. Cache answers locally (already done elsewhere) so reload restores progress. Add a separate `pagehide` listener that fires submission only when the page is actually being unloaded (event.persisted === false) — and only if the exam isn't already saved within the last 5 s.

### 2c. Per-question timer can auto-submit the whole exam
Lines 278–298: when the per-question timer hits 0 on the last question, the entire exam is submitted, even if other questions are unanswered or the student is mid-typing.

**Fix.** Remove the auto-submit branch from the per-question timer. On timeout, just advance to the next question (looping back to question 0 if on the last one), or simply stop the per-question countdown and rely solely on the global `totalTimeRemaining` for hard auto-submit. The global timer (lines 261–275) already enforces the real deadline.

### 2d. Stop double registration
`useExamAutoSubmit.ts` registers a second `visibilitychange` and `beforeunload` listener that duplicates what `ExamTaking.tsx` does. Verify nothing imports the hook; if unused, delete the file. If it is used somewhere, remove the duplicate listeners and keep only the answer-syncing logic.

---

## Validation

- Manually take an exam where question marks sum to more than `exam.total_marks`: confirm the saved score is ≤ `exam.total_marks` and the dashboard shows e.g. `32/40` not `39/48`.
- Pull down the notification shade on mobile during an exam → no submission, strike toast appears.
- Hit Cmd-R during an exam → confirmation prompt appears, clicking Stay keeps the exam running.
- Let the per-question timer expire on the last question → it advances or loops; the exam stays open until the global timer ends.

## Files touched
- `src/pages/ExamTaking.tsx` (grading helper + 3 auto-submit branches)
- `src/pages/ExamGrading.tsx` (`handleSaveGrading` + header badge)
- `src/hooks/useExamAutoSubmit.ts` (delete or trim to answer-sync only)
