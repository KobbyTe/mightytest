

## Plan: Mobile-First UI Overhaul for All Dashboards

### Problems Identified

**Student Dashboard** (`src/pages/Dashboard.tsx` ~1028 lines):
- Header: title `text-2xl` too large on mobile, buttons don't wrap — overflows
- Stats grid: `grid-cols-2` works but `p-6` padding too generous, `text-3xl` numbers too large for small screens
- Exam cards grid: `md:grid-cols-2 lg:grid-cols-3` has no mobile spacing optimization
- Profile/Parent grid: `grid-cols-2 gap-3` inside cards creates cramped layouts on narrow screens
- Result rows use `flex items-center gap-4` with no wrapping — text truncates badly

**Admin Dashboard** (`src/pages/AdminDashboard.tsx` ~885 lines):
- Header: `text-2xl` title + multiple buttons overflow on mobile
- TabsList: `flex w-full overflow-x-auto` but tabs have no scroll indicators, labels are full text
- Stats grid: `grid-cols-1 md:grid-cols-3` — fine but cards have minimal mobile styling
- Exam form dialog: `grid-cols-2` and `grid-cols-3` layouts break on small screens
- Attempts table: `overflow-x-auto` but cells have `min-w-[150px]` etc — forces horizontal scroll

**Teacher Dashboard** (`src/components/TeacherDashboard.tsx` ~940 lines):
- Header: avatar + text + buttons — wraps awkwardly on mobile
- Stats: `grid-cols-2 lg:grid-cols-5` — acceptable but padding/font sizes need tuning
- Tabs: icons-only on mobile (`hidden sm:inline` for labels) — good but tab bar itself overflows
- Performance gauges: `w-48 h-48` RadialBarChart doesn't scale down
- Top students list has adequate mobile layout

**Parent Dashboard** (`src/pages/ParentDashboard.tsx` ~372 lines):
- Header: same `text-2xl` + button overflow issue
- Stats: `grid-cols-2 md:grid-cols-4` with `p-6` padding — too much for mobile
- Child result rows: `flex items-center gap-4 p-3` with score/status on same line — overflows on narrow screens
- Badge groups in child cards wrap but layout feels cramped

### Implementation Plan

**1. Student Dashboard** (`src/pages/Dashboard.tsx`)
- Header: stack title/subtitle and action buttons vertically on mobile (`flex-col sm:flex-row`), reduce title to `text-lg sm:text-2xl`
- Stats grid: reduce to `p-3 sm:p-6`, font `text-xl sm:text-3xl`, icon containers `w-9 h-9 sm:w-12 sm:h-12`
- Exam cards: add `gap-3 sm:gap-5`, tighter card padding on mobile
- Profile card: `grid-cols-1 sm:grid-cols-2` for info fields
- Parent info card: `grid-cols-1 sm:grid-cols-2` for credential boxes
- Results summary rows: stack score/status below title on mobile (`flex-col sm:flex-row`)

**2. Admin Dashboard** (`src/pages/AdminDashboard.tsx`)
- Header: stack layout on mobile, hide "Analytics" text (icon-only), smaller title
- TabsList: already scrollable but add `no-scrollbar` class, shrink trigger padding
- Exam form dialog: `grid-cols-1 sm:grid-cols-2` and `grid-cols-1 sm:grid-cols-3`
- Attempts tab: convert table to mobile card layout on small screens (hide table, show stacked cards)
- Exam cards: tighter padding, readable text sizes

**3. Teacher Dashboard** (`src/components/TeacherDashboard.tsx`)
- Header: stack on mobile, compact avatar section
- Stats: `p-3 sm:p-4`, smaller text on mobile
- Performance gauge: `w-36 h-36 sm:w-48 sm:h-48`
- Performance grid: `grid-cols-1` on mobile for gauge + breakdown

**4. Parent Dashboard** (`src/pages/ParentDashboard.tsx`)
- Header: same mobile-first stacking
- Stats: `p-3 sm:p-6`, reduced font sizes
- Child result rows: stack into cards on mobile — title on top, score/status below
- Child header: stack avatar + badges vertically on very small screens

### Files to Modify
- `src/pages/Dashboard.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/components/TeacherDashboard.tsx`
- `src/pages/ParentDashboard.tsx`

### Design Principles
- Mobile-first responsive classes (base = mobile, `sm:` = tablet, `md:`/`lg:` = desktop)
- Compact padding and font sizes on mobile, expanding at breakpoints
- Stack layouts vertically on mobile, switch to horizontal on larger screens
- Replace tables with card lists on mobile where appropriate
- Consistent glassmorphism and spacing across all four dashboards

