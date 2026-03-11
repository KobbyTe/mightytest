

# Redesign Teacher Dashboard — Modern, Clean & Professional

## Problem
The teacher dashboard shares the same `AdminDashboard.tsx` component as admins. It feels generic, cluttered, and lacks a teacher-specific identity. Teachers also cannot view their own profile.

## Approach
Create a dedicated teacher dashboard experience within the existing file by conditionally rendering a completely redesigned layout when `role === 'teacher'`. This avoids breaking the admin flow.

### 1. Teacher-Specific Dashboard Layout
Replace the current teacher view with a modern layout featuring:

- **Welcome Hero Section** — Personalized greeting with teacher name, avatar, and a "View My Profile" button. Gradient background with glassmorphism.
- **Quick Stats Row** — 4 animated stat cards (Total Exams, Active Exams, Assigned Classes, Students) with icons and subtle gradient backgrounds.
- **Clean Navigation Tabs** — Redesigned pill-style tabs with icons and count badges, wrapped in a frosted-glass card.
- **Content Sections** — Each tab content area uses consistent card styling with proper spacing.

### 2. Teacher Profile Dialog
A rich "My Profile" dialog accessible from the header, showing:
- Hero banner with avatar and verified status
- Contact info (email, phone) with copy-to-clipboard
- Subject specialty with STEM color coding
- School affiliation
- Assigned classes grid
- Account timeline (registered, approved dates)

### 3. Animations
- `framer-motion` staggered entry for stat cards and content sections
- Smooth tab transitions
- Hover effects on interactive cards

## Files to Modify
1. **`src/pages/AdminDashboard.tsx`** — Add teacher profile state/fetching logic, conditionally render a redesigned teacher layout (lines ~285-720) with:
   - New teacher header with profile button
   - Animated stats section
   - Redesigned tabs with icons
   - "My Profile" dialog with the same premium design used for admin's teacher profile view

## Technical Details
- Fetch teacher record on mount when `role === 'teacher'` to get profile data (name, email, phone, school, subject)
- Reuse existing `useTeacherScope` hook for assignments
- Count students via scoped class IDs query
- No new dependencies (framer-motion already installed)
- No database changes needed

