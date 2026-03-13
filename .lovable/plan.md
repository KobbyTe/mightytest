

## Plan: Fix PDF Question Extraction Truncation Bug

### Root Cause

The edge function `process-exam-pdf/index.ts` sends the PDF to the AI model with `max_tokens: 65536`. When extracting many questions (30+), the AI's tool-call JSON response gets truncated (`finish_reason: 'length'`). The truncated JSON may still parse successfully but only contains the first ~5 questions. The function logs a warning but proceeds to insert only those 5 questions and reports "success" — so the user sees 5 questions created with no error.

### Fix Strategy

**File: `supabase/functions/process-exam-pdf/index.ts`**

1. **Increase `max_tokens`** to `131072` (128K) to give the model more room for large question sets.

2. **Implement a continuation loop**: After the first AI call, if `finish_reason === 'length'`, make follow-up API calls asking the model to "continue extracting from question N+1 onward" — appending results until `finish_reason !== 'length'` or a max iteration cap (3 rounds).

3. **Add a truncation warning in the response**: If after all retries the result still appears truncated, include a warning message in the success response (e.g., "Extracted 15 questions but the PDF may contain more — try splitting the PDF").

4. **Move the `finish_reason` check before DB insert**: Only proceed with the insert after all continuation rounds are done, so the full question set is accumulated first.

### Implementation Detail

```
Loop (max 3 iterations):
  1. Call AI with PDF + prompt
  2. Parse tool_call arguments → append to allQuestions[]
  3. If finish_reason !== 'length' → break
  4. Else → follow-up call: "You extracted N questions so far. Continue from question N+1. Extract the remaining questions."
  
Deduplicate allQuestions → insert into DB
```

The follow-up calls will reference the count of already-extracted questions and instruct the model to continue, avoiding duplicates via the existing deduplication logic.

### Files Changed
1. `supabase/functions/process-exam-pdf/index.ts` — Increase max_tokens, add continuation loop, improve truncation handling

