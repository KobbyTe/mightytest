

## Plan: Center-Align PDF Table & Refine Colors

**Goal**: Center the entire table on the page and improve color styling for a cleaner, more professional PDF report.

### Changes in `src/components/admin/ClassPerformancePortal.tsx` — `handleExportPDF`

**1) Center-align the table horizontally on the page**
- Calculate `tableStartX = (pw - actualTableW) / 2` instead of using a fixed `margin` for the table.
- Update all column x-positions (`cols[]`) to start from `tableStartX` instead of `margin`.
- Update all `fillRect` calls for rows, headers, and decorative elements to use `tableStartX`.

**2) Center-align text within each column cell**
- Currently all text is left-aligned within cells. Change numeric columns (Test scores, Total, Average, Percentage, Position) to center-align within their column width using `{ align: 'center' }` and positioning at `cols[i] + colWidth/2`.
- Keep Student name left-aligned (natural for names) and Remark left-aligned.

**3) Refine color palette**
- Replace the split indigo/pink header band with a single elegant deep gradient feel — use a rich navy-to-teal band instead of the garish two-tone split.
- Soften alternating row colors for a more subtle contrast.
- Improve the percentage and remark pill colors to be slightly more muted/professional (less saturated).
- Make the table header a richer dark tone with slightly more breathing room.

**4) Polish spacing & typography**
- Increase row height slightly (7→8mm) for better readability.
- Add a thin top border line above the table for visual separation from the header.
- Center the metadata row (Generated, Students, Class Average, Tests) instead of left-aligning.

**File**: `src/components/admin/ClassPerformancePortal.tsx` (lines ~226–577, the `handleExportPDF` function and its inline helpers)

