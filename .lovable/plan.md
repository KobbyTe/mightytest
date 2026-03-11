
Goal: Make the class report match your exact structure and premium style, with no Student ID / Exams Taken / Pass Rate in the report view or exported report.

1) Align report content to your exact structure
- Update the class report table in `src/components/admin/ClassPerformancePortal.tsx` to strictly use:
  `Student (All students) | Test 1..N | Total | Average | Percentage (100%) | Position | Remark`
- Keep tests dynamic (Test 1, Test 2, Test 3, ... based on available exams).
- Remove report-level pass-rate references from the class report area.

2) Remove unwanted fields from report flow
- Remove “Pass Rate” summary card from the class report header area.
- Ensure no “Student ID” or “Exams Taken” appears in the report table or report export.
- Keep ranking based on percentage and show position clearly.

3) Professional visual redesign (catchy + polished)
- Refine the report container to a premium glassmorphism card with stronger visual hierarchy:
  - Gradient title strip
  - Better spacing, typography scale, and row rhythm
  - Sticky/high-contrast table header
  - Alternating row backgrounds for readability
- Upgrade performance cues:
  - Percentage pill colors (high / mid / low) with token-based colors
  - Position badge treatment for top ranks
  - Remark badges with stronger contrast and cleaner shape
- Improve mobile behavior with controlled horizontal scrolling and better column widths.

4) Make export match the on-screen report exactly
- Replace the current PDF generation path in `ClassPerformancePortal.tsx` so export uses the same rendered report structure (no Student ID / Exams Taken / Pass Rate columns).
- Ensure exported output reflects the same column order and visual intent as the UI table.

5) Keep individual student report consistent
- In `src/lib/exportUtils.ts`, adjust `generateRemarks()` so remarks do not reference pass rate wording.
- Preserve focused, performance-only language aligned with your report style.

Technical details
- Main file: `src/components/admin/ClassPerformancePortal.tsx`
  - Table structure enforcement
  - Summary card cleanup
  - Visual polish + responsive refinements
  - Export logic update to use the unified table output
- Supporting file: `src/lib/exportUtils.ts`
  - Remove pass-rate phrasing from generated remarks text
- No database changes required.
- No auth/backend schema changes required.

Validation checklist after implementation
- Class report table shows only the required columns in the exact order.
- No “Student ID”, “Exams Taken”, or “Pass Rate” appears in report UI.
- PDF export matches the same structure and excludes those fields.
- Colors, spacing, and typography look premium on desktop and mobile.
