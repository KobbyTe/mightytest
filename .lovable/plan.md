

# Show Individual Test Results with Numbered List + Average

## What Changes

Currently, all three dashboards (Student, Parent, Admin) only show a single "Average Score" number. The user wants to see each test result listed individually (Test 1, Test 2, Test 3...) and then the overall average clearly displayed at the bottom.

## Changes by Dashboard

### 1. Student Dashboard (`src/pages/Dashboard.tsx`)
- Replace the single "Avg Score" stat card with a new **"My Results Summary"** card section
- Show a numbered list of all graded exams: "Test 1: Science - 75/100 (75%)", "Test 2: Robotics - 80/100 (80%)", etc.
- Display the overall average at the bottom of the list
- Keep the existing exam cards below for detailed view (status, certificates, etc.)

### 2. Parent Dashboard (`src/pages/ParentDashboard.tsx`)
- For each child, replace the "Recent Exam Results" section (currently limited to 5) with a full **numbered results list** showing every graded exam
- Format: "Test 1: [Exam Title] - [Score]/[Total] (Passed/Failed)"
- Show the average score clearly at the bottom of each child's results
- Keep the stats grid (Total Attempts, Passed, Avg Score, Pass Rate) but ensure the Avg Score card reflects the same average

### 3. Admin Dashboard - Student Report Card (`src/components/admin/StudentReportCard.tsx`)
- In the "Exam History" section, add numbered labels: "Test 1", "Test 2", etc.
- Add a summary row at the bottom showing the computed average across all tests
- Sort exams chronologically (oldest first) so numbering is consistent

### 4. Admin Dashboard - Student Performance Table (`src/components/admin/StudentPerformanceTable.tsx`)
- Add a expandable/tooltip showing individual test scores when clicking the "Average Score" cell, or add a small "view details" indicator
- The existing "View" button already leads to the report card, so this is optional

## Technical Details

### Sorting Logic
All test lists will be sorted by `attempted_at` or `completed_at` ascending (chronological order) so Test 1 is always the first exam taken.

### Average Calculation
Average = sum of all (marks_obtained / total_marks * 100) for each graded exam / number of graded exams. This gives a percentage-based average that accounts for exams with different total marks.

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add numbered results list section above/replacing the exam cards for graded exams, with average summary |
| `src/pages/ParentDashboard.tsx` | Replace "Recent Exam Results" (sliced to 5) with full numbered list per child + average |
| `src/components/admin/StudentReportCard.tsx` | Add "Test N" numbering to Exam History items + average summary row |
| `src/components/admin/StudentPerformanceTable.tsx` | Minor: no structural change needed (View button already links to detailed report) |

### UI Design
- Each test result row: `Test [N] | [Exam Title] | [Subject] | [Score]/[Total] | [Pass/Fail badge]`
- Average summary row at bottom with distinct styling (bold, slightly larger, separator above)
- Chronological ordering ensures consistent numbering across all views

