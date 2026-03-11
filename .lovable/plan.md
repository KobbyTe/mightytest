

# Teacher Performance Rating & Awards System

## What We're Building
A **Teacher Performance Score** system that automatically calculates a teacher's effectiveness rating based on their students' exam results, displayed as a prominent section on the Teacher Dashboard with visual awards/badges.

## How It Works

### Performance Metrics (calculated from existing data)
- **Average Student Score** — Mean percentage across all graded attempts for the teacher's scoped classes
- **Pass Rate** — Percentage of students who scored above passing marks
- **Student Improvement** — Track if students improve across sequential exams (comparing first vs latest attempts)
- **Completion Rate** — Percentage of assigned exams actually completed by students

### Teacher Rating Formula
Weighted composite score (0-100):
- 40% Average student score percentage
- 30% Pass rate
- 20% Completion rate  
- 10% Student count engagement factor

### Award Tiers (Badges)
- **Diamond Educator** (90-100) — Elite performance
- **Gold Educator** (75-89) — Outstanding
- **Silver Educator** (60-74) — Good
- **Bronze Educator** (below 60) — Developing

### UI Changes

**1. New Stats in Header Row** — Add a "Performance Score" stat card (5th card) showing the composite score with the award tier badge.

**2. New "Performance" Tab** — Added to the tab navigation, containing:
- Large performance score gauge/ring with award badge
- Breakdown of each metric with progress bars
- Top-performing students list (leaderboard of their best students)
- Award tier explanation card

**3. Profile Dialog Enhancement** — Show the teacher's current award tier badge in their profile dialog.

## Files to Modify
1. **`src/components/TeacherDashboard.tsx`** — Add performance calculation logic, new stat card, new "Performance" tab with metrics UI, and update profile dialog with award badge.

## Technical Details
- All calculations done client-side from already-fetched `attempts` data + a query for total assigned students
- No database changes needed — purely derived from existing `exam_attempts`, `students`, and `exam_class_assignments` data
- Uses `recharts` (already installed) for the score breakdown visualization
- `framer-motion` for animated score counter and badge reveals

