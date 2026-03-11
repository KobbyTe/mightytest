

## Student Report Card Redesign

### Goal
Restructure the Student Report Card to use a table-based layout matching the requested format: **Student | Test 1 | Test 2 | Test 3 | ... | Total | Average | Percentage | Position | Remark**

### Changes

**1. `src/components/admin/StudentReportCard.tsx` — Full redesign**

- **Header section**: Keep the student profile card with glassmorphism styling (backdrop-blur, translucent bg) per the platform's management UI design standard. Improve with a gradient banner and cleaner stat cards using HSL design tokens.

- **Results Table**: Replace the current vertical exam history list with a horizontal table:
  - Columns: `Student`, `Test 1`, `Test 2`, `Test 3`, ..., `Total`, `Average`, `Percentage (100%)`, `Position`, `Remark`
  - Each Test column shows `marksObtained/totalMarks`
  - Total = sum of all marks obtained
  - Average = total / number of tests
  - Percentage = (total obtained / total possible) × 100
  - Position = passed from parent or computed as "N/A" for single-student view
  - Remark = auto-generated from `generateRemarks()`

- **Subject Performance**: Keep the progress bars but refine with color-coded bars (green ≥75%, amber ≥60%, red <60%) and better spacing.

- **Strengths/Weaknesses**: Consolidate into a single row with improved badge-based display instead of separate cards.

- **Teacher Remarks**: Styled with a left accent border and subtle background.

**2. `src/components/admin/ClassPerformancePortal.tsx` — Minor update**

- When viewing the class-level report (not individual student), add a combined table view showing ALL students in the requested format with computed positions (ranked by percentage). This gives teachers the "Student (All students)" view.

**3. Visual improvements throughout**:
- Glassmorphism card styling with `backdrop-blur-xl` and translucent backgrounds
- `framer-motion` entrance animations
- HSL-based status colors from design tokens
- Better responsive behavior for the table (horizontal scroll on mobile)

### Technical Notes
- Position calculation: sort all students by percentage descending, assign rank
- The `StudentReportCardProps` interface will gain an optional `position` prop
- Table uses existing `Table` UI components from `src/components/ui/table.tsx`
- No database changes required

