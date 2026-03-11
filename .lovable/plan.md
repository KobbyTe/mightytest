

# Redesign Teacher Profile Dialog — Professional & Rich

## Problem
The current teacher profile dialog is a simple list of fields in muted cards. It feels flat, lacks hierarchy, and doesn't convey trust or professionalism.

## Design Approach
Replace the current profile dialog with a premium, full-featured profile layout:

### 1. Hero Header with Gradient Banner
- Full-width gradient banner at the top (using STEM brand colors)
- Large avatar overlapping the banner edge with a verified/status shield icon overlay
- Teacher name, status badge, and school name prominently displayed
- Approval date shown as a "Verified since" trust indicator

### 2. Structured Info Sections with Icons
Replace the flat list with clearly separated sections:

- **Contact Information** — Email and phone in a two-column grid with copy-to-clipboard functionality
- **Professional Details** — Subject specialty (color-coded STEM badge), school affiliation, teacher ID (truncated, professional format)
- **Account Timeline** — Registration date and approval date shown as a mini timeline with connected dots
- **Security & Verification** — A trust section showing verified status with a shield icon, account age, and verification badge

### 3. Assigned Classes Section
- Card-based grid (instead of a flat list) with each assignment showing class name, subject badge, school, and assignment date
- Empty state with a professional illustration prompt

### 4. Animations
- Staggered `framer-motion` entry for each section
- Smooth fade-in for the header

## Files to Modify
1. **`src/components/admin/TeacherManagement.tsx`** — Lines 566–711: Rebuild the profile dialog content with the new layout

## Scope
- UI-only change within the existing profile dialog
- No database or backend changes
- No new dependencies needed (framer-motion already installed)

