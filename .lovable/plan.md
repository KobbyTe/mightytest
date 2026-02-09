

# Delete All Student Exam Scores and Attempts

## What Will Be Deleted

- **617 exam answer records** (individual question responses, AI review explanations)
- **32 exam attempt records** (scores, grading status, timestamps)

This will clear all student portals of any test history. The exams themselves and questions will remain intact so students can retake them.

## Execution Order

Data must be deleted in the correct order to avoid foreign key issues:

1. **Delete all rows from `exam_answers`** -- must go first since answers reference attempts
2. **Delete all rows from `exam_attempts`** -- can be deleted after answers are cleared

## Technical Details

Two SQL statements will be run using the database migration tool:

```sql
DELETE FROM public.exam_answers;
DELETE FROM public.exam_attempts;
```

No schema changes are needed -- only data removal.

## Impact

- All students will see a clean portal with no previous test scores
- The exams and questions remain available for future assignments
- Students can retake exams fresh
- AI review explanations will be regenerated when students review future attempts

