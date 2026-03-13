
Goal: eliminate the PDF extraction undercount (30 extracted -> 5 saved) and make the pipeline robust against future regressions.

What I found from thorough debugging:
1. Backend logs prove extraction is succeeding:
   - `Initial extraction: 30 questions, finish_reason=stop`
   - then immediately `Total unique questions after dedup: 5`
2. So the failure is not AI extraction; it is post-processing deduplication.
3. Root cause is in `supabase/functions/process-exam-pdf/index.ts`:
   - dedupe key uses only `question_type + first 200 chars of question_text`
   - this collapses distinct questions that share long common stems/passage prefixes.
4. Frontend is not limiting to 5; it simply displays what backend inserted.

Implementation plan:
1. Replace fragile dedupe key with strict composite normalization
   - Use full normalized question text (no 200-char truncation)
   - Include normalized `question_type`, `options`, and `correct_answer`
   - Keep dedupe exact-match only (remove only truly identical questions)
2. Add question normalization/validation before dedupe
   - Normalize whitespace and labels
   - Coerce/repair common field variations (if model drifts)
   - Track dropped items with explicit reasons (e.g., missing question_text)
3. Add “suspicious collapse” guardrail
   - If extracted count is high (e.g., >=20) and dedupe drops an unusually large percentage, flag and run a recovery pass instead of silently shrinking to 5
   - Recovery pass asks AI for “remaining unique questions not in this list,” then re-merge
4. Improve observability in function logs + response payload
   - Log: extracted_count, valid_count, deduped_count, dropped_invalid_count
   - Include warning metadata in response so UI can show “high dedupe detected” messages
5. Keep database behavior safe
   - Continue replace-by-exam flow (delete then insert), but only after validated final question set is ready
   - No schema/RLS changes needed
6. Verification workflow
   - Re-run with the same 30+ PDF
   - Confirm logs show extracted_count ≈ final_inserted_count (not collapsing to 5)
   - Confirm `exam_questions` count for that exam matches response `questionsCreated`
   - Repeat once with a different PDF format to ensure fix is general

Technical details:
- Primary file to update: `supabase/functions/process-exam-pdf/index.ts`
- Optional UI touchpoint: `src/pages/ExamQuestions.tsx` (display backend diagnostics/warnings)
- No migrations required.
- This will directly address the exact observed failure signature in logs (30 extracted, 5 after dedupe).

Expected outcome after fix:
- If AI extracts 30 real questions, backend will save ~30 (minus only true exact duplicates), instead of collapsing to 5.
- Future regressions become detectable immediately via new extraction/dedupe diagnostics.
