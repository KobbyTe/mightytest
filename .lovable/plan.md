

# Fix: Exams Showing to Wrong Classes

## The Problem

When an exam is assigned to Grade 3 classes, students in Grade 5, Grade 8, and other grades also see it in their "Available Exams" section.

## Root Cause

In `Dashboard.tsx` (lines 183-193), there is a **fallback** that kicks in when a student's class has no exam assignments. Instead of showing "No exams available," it loads **ALL active exams** from the database:

```text
if (assignedExams.length === 0) {
  // Falls back to showing EVERY active exam to the student
  const examsRes = await supabase.from('exams').select(...).eq('status', 'active');
  assignedExams = examsRes.data;
}
```

So any student whose class has zero assignments (e.g., a Grade 5 student) ends up seeing every exam on the platform, including ones assigned only to Grade 3.

## The Fix

**Remove the fallback entirely.** If a student's class has no assigned exams, they should see an empty list with a friendly message -- not every exam on the platform.

Additionally, if a student somehow has no `class_id` set, they should see a message saying they're not assigned to a class yet, rather than all exams.

### File: `src/pages/Dashboard.tsx`

**Change**: Delete lines 183-193 (the entire fallback block that queries all active exams when `assignedExams.length === 0`).

The existing UI already handles the empty state correctly -- the "Available Exams" section will simply show no cards, and we can add a brief message like "No exams assigned to your class yet" for clarity.

## Technical Details

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Remove the fallback `if (assignedExams.length === 0)` block (lines 183-193) that loads all active exams. Optionally add a UI message for the empty state in the "Available Exams" section. |

This is a single, targeted change. The exam assignment system and class filtering are working correctly -- the only issue is this fallback overriding the filtered results.
