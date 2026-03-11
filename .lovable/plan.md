

## Student Report Card — Clean Up & Polish

### What Changes

**`src/components/admin/StudentReportCard.tsx`**

1. **Remove unwanted stat cards**: Delete "Pass Rate", "Exams Taken" from the header stat grid. Keep only **Average**, **Percentage**, and **Position** as summary stats (or remove the stat cards entirely since they duplicate the table).

2. **Remove Student ID / email**: Strip the email line from the profile header. Keep just the student name and status badge.

3. **Premium visual redesign**:
   - Richer gradient banner (e.g., `from-indigo-600 via-purple-600 to-pink-500`)
   - Profile header with larger, bolder name typography
   - Results table with alternating row colors, rounded container, and a subtle gradient header row
   - Color-coded percentage cells with filled background pills (green/amber/red) instead of just text color
   - Remark badges with solid background fills matching their status
   - Tighter spacing, modern font weights, and refined shadow hierarchy
   - Subject performance bars with rounded pill shape and gradient fills
   - Strengths/Weaknesses section with colored icon backgrounds
   - Teacher remarks with a premium quote-style design

4. **Keep exact table structure**: `Student | Test 1 | Test 2 | ... | Total | Average | Percentage (100%) | Position | Remark` — no additions.

### No other files changed. No database changes.

