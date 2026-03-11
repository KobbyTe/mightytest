
Goal: Make the downloaded class report look premium and professional, while enforcing your exact table format only:
Student (All students) | Test 1..N | Total | Average | Percentage (100%) | Position | Remark.

What I found
- Your uploaded PDF is still using a legacy structure (Student ID, Exams, Pass Rate, Status), and the styling is too plain/monochrome.
- Current export logic needs to be fully unified so PDF uses the same ranking data model as the new on-screen report.

Implementation plan

1) Enforce one export schema (single source of truth)
- In `src/components/admin/ClassPerformancePortal.tsx`, create one normalized dataset for both UI + PDF export:
  - `studentName`
  - dynamic `testScores[]` as `marks/total`
  - `total`
  - `average`
  - `percentage`
  - `position`
  - `remark`
- Remove any legacy/fallback mapping that can reintroduce Student ID / Exams / Pass Rate.

2) Rebuild PDF layout as a premium report template
- Keep `jsPDF` but redesign drawing flow:
  - Branded top band with strong color treatment and clean hierarchy.
  - Refined metadata row (school, class, generated date) with better spacing.
  - Optional AI summary in a styled callout box (subtle background, readable line height).
  - Professional table block:
    - Exact required column sequence only.
    - Dynamic Test columns sized from available width.
    - Colored header row, alternating row backgrounds, stronger borders.
    - Right/center alignment for numeric consistency.
    - Truncation/wrapping rules so long names/remarks don’t break layout.
  - Footer with page number and timestamp.

3) Add professional performance color system in PDF
- Percentage badge colors:
  - High (>=75) green
  - Mid (>=60) amber
  - Low (<60) red
- Position styling:
  - Top 3 with medal-style fills
  - Others with clean neutral badge
- Remark cell uses concise text + readable contrast.

4) Fix pagination and table continuity
- Repeat table header on every new page.
- Prevent row clipping by checking row height before rendering.
- Keep column widths stable across pages (no visual jump).

5) Remove legacy report fields at data boundary
- Update `supabase/functions/generate-pdf-report/index.ts` response shape so it no longer exposes/encourages legacy table fields for export rendering.
- Keep it focused on summary/meta support (AI summary + class-level context), while table rows come from the normalized client ranking data model.

Files to update
- `src/components/admin/ClassPerformancePortal.tsx` (core export redesign + schema unification + styling logic)
- `supabase/functions/generate-pdf-report/index.ts` (trim legacy payload fields to prevent mismatch regressions)

Validation checklist
- Exported PDF contains only: Student | Test 1..N | Total | Average | Percentage (100%) | Position | Remark.
- No Student ID, Exams Taken, Pass Rate, or Status in exported table.
- Visual quality is premium: strong hierarchy, polished colors, clean spacing, and consistent alignment.
- Multi-page classes render correctly with repeated headers and no broken rows.
- Export output matches what teachers see in the Rankings table structure.
