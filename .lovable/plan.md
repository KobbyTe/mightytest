

# Fix Exam Review: Handle Missing Answers and Improve Explanations

## Root Cause

When a student scores 0 (didn't answer any questions), no rows exist in `exam_answers`. This causes:
- The edge function to return "No answers found" (404 error)
- The fallback text to show generic messages like `The correct answer is "Air coming out of the balloon"`

## Solution (Two Parts)

### Part 1: Create Missing Answer Rows on Review Load

When `ExamReview.tsx` loads and finds that some questions have no corresponding `exam_answers` row, it will **insert stub rows** (with `answer_text: null`, `is_correct: false`, `marks_awarded: 0`) so the edge function has something to work with.

**File: `src/pages/ExamReview.tsx`**
- After loading questions and answers, compare the two lists
- For any question without a matching answer row, insert a stub into `exam_answers`
- Then proceed with review generation as normal

### Part 2: Improve AI Prompt for Educational Explanations

The current prompt says "write a brief (1-2 sentence) explanation" but allows generic responses. The improved prompt will be more specific:

**File: `supabase/functions/generate-exam-reviews/index.ts`**
- Update the prompt to explicitly instruct: "Explain the underlying concept or reasoning behind why the correct answer is right. Do NOT simply restate which answer is correct."
- For unanswered questions, instruct: "Explain the concept as if teaching the student for the first time."
- Increase to 2-3 sentences for richer explanations

### Part 3: Clear Stale/Generic Cached Reviews

Since some attempts already have cached but generic `review_text`, add a mechanism to regenerate:
- If existing `review_text` matches patterns like `"Correct!"` or `"The correct answer is"`, treat it as needing regeneration
- This ensures previously cached generic text gets replaced with proper explanations

## Technical Details

### ExamReview.tsx Changes

```
// After loading questions and answers:
// 1. Find questions without answer rows
// 2. Insert stubs for missing answers
// 3. Check if any review_text is null or looks generic
// 4. If so, call generate-exam-reviews
```

### Edge Function Prompt Update

```
Current: "write a brief (1-2 sentence) explanation of WHY the correct answer is right"

New: "Write a 2-3 sentence educational explanation for each question. 
Explain the underlying concept, principle, or reasoning that makes the 
correct answer right. Do NOT just say 'The correct answer is X'. 
Instead, teach the student the concept. For example, if the question 
is about Newton's Third Law, explain what the law states and how it 
applies. If the student answered incorrectly, briefly explain why 
their chosen answer is a common misconception."
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ExamReview.tsx` | Add logic to create stub answer rows for unanswered questions; detect and regenerate generic cached reviews |
| `supabase/functions/generate-exam-reviews/index.ts` | Improve AI prompt for richer, concept-based explanations instead of generic restating |

