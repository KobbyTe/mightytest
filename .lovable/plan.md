

## Plan: Fix Total Marks Calculation and Ranking Logic

### Problem Identified

Two bugs in `ClassPerformancePortal.tsx`:

1. **Inflated totals from duplicate attempts**: The code sums ALL attempt rows, including retakes of the same exam. Example: "Setor Enam Agbenu" has 6 graded attempts on "1st ASSESSMENT TEST" (each 30 marks) + 1 attempt on "2ND ASSESSMENT TEST" (30 marks) = 210 total possible, when it should reflect only the distinct exams taken (2 exams = 60 total possible). The student's obtained marks are also inflated (193 instead of the real latest/best score).

2. **Unfair ranking**: Currently ranked by `averagePercentage`. A student with 1 test at 96.7% outranks a student with all tests completed at a lower percentage. User wants ranking by **total marks obtained** (students who completed more tests and scored more total marks rank higher).

### Changes

**File: `src/components/admin/ClassPerformancePortal.tsx`**

**1) Deduplicate attempts per student per exam** (lines 142-190)

When building `attemptsByStudent`, keep only the **best-scoring** attempt per student per exam (since user chose "keep all attempts" for display but the totals need to reflect distinct exams):

- After grouping attempts by student, for each student, deduplicate by `exam.id` keeping the attempt with the highest `marks_obtained`
- This fixes `totalMarks` (e.g., 2 exams * 30 = 60, not 210) and `marksObtained` (best score per exam summed)

**2) Change ranking sort to total marks first** (line 587-589)

Replace:
```ts
.sort((a, b) => b.averagePercentage - a.averagePercentage)
```
With:
```ts
.sort((a, b) => {
  // Primary: total marks obtained (more exams + higher scores = better rank)
  if (b.marksObtained !== a.marksObtained) return b.marksObtained - a.marksObtained;
  // Tiebreaker: percentage
  return b.averagePercentage - a.averagePercentage;
})
```

**3) Update UI table Total column** (lines 773-823)

The UI Rankings table currently calculates `totalObtained`/`totalPossible` inline by iterating `examOrder`. This inline logic should also use the deduplicated data (already fixed if the underlying `rawAttempts` is deduplicated) — verify it stays consistent.

**4) Update PDF export** (lines 456-545)

The PDF export also reads from `rawAttempts` and `rankedStudents`. Since deduplication happens at data load time, the PDF will automatically use corrected values. Verify the Total column in PDF uses `student.marksObtained/student.totalMarks` from the fixed data.

**5) Update StudentReportCard** (already receives deduplicated `examAttempts` via `getStudentExamAttempts`)

The `getStudentExamAttempts` function (line 574-584) returns all raw attempts. Apply the same deduplication here so individual report cards also show correct totals.

### Result
- Total marks will correctly reflect distinct exams only (best score per exam)
- Rankings will sort by total marks obtained, rewarding students who completed more tests
- Both UI table and PDF export will show consistent, correct data

