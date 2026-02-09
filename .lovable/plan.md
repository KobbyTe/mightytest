

# Full Homepage Enhancement + Smooth Scroll + Mobile Fixes

## Overview

Enhance every section of the homepage for a cleaner, more professional and modern look. Wire up smooth scroll for the "Explore Features" button and navbar links. Fix mobile layout issues spotted during inspection (hero text sizing, stats overflow, section spacing).

## Changes

### 1. Smooth Scroll Behavior (File: `src/index.css`)

- Add `scroll-behavior: smooth` to the `html` element in the base layer so all anchor scrolls are smooth site-wide.

### 2. Hero -- "Explore Features" Button Scroll (File: `src/components/Hero.tsx`)

- Add an `onClick` handler to the "Explore Features" button that scrolls to `#features`:
  ```
  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
  ```
- Mobile fixes:
  - Reduce heading from `text-5xl` to `text-3xl` on small screens for better fit
  - Reduce stats text from `text-3xl` to `text-2xl` on mobile
  - Add `px-2` padding to stats grid to prevent edge overflow
  - Reduce max-width on description text for mobile readability

### 3. Navbar -- Smooth Scroll for Hash Links (File: `src/components/Navbar.tsx`)

- Replace `<Link to="/#features">` etc. with `<a href="#features">` anchor tags that use smooth scroll behavior (provided by the CSS change above), so clicking Features/Subjects in the navbar scrolls smoothly instead of doing a page navigation.
- Apply the same for mobile nav links and close the mobile menu after clicking.

### 4. Features Section Enhancement (File: `src/components/Features.tsx`)

- Add a subtle section label/overline text ("WHY MIGHTY TEST") above the heading for visual hierarchy
- Add a bottom gradient divider for a smoother transition into the Subjects section
- Slightly increase card padding and add a subtle gradient border on hover

### 5. Subjects Section Enhancement (File: `src/components/Subjects.tsx`)

- Add an overline label ("EXPLORE SUBJECTS") above the heading
- Add a CTA button at the bottom: "Start Your STEM Journey" linking to `/auth`
- Add subtle background pattern or gradient for visual interest

### 6. Footer Enhancement (File: `src/components/Footer.tsx`)

- Add social media icon placeholders (Github, Twitter/X, LinkedIn) with hover effects
- Add a subtle gradient top border for visual separation
- Improve spacing and typography on mobile

## Technical Details

| File | Changes |
|------|---------|
| `src/index.css` | Add `html { scroll-behavior: smooth }` in base layer |
| `src/components/Hero.tsx` | Wire onClick smooth scroll on "Explore Features" button; fix mobile text sizes (3xl/2xl); fix stats grid mobile padding |
| `src/components/Navbar.tsx` | Convert hash links from `<Link to="/#x">` to `<a href="#x">` for native smooth scroll; close mobile menu on click |
| `src/components/Features.tsx` | Add overline text; add bottom gradient divider; minor card polish |
| `src/components/Subjects.tsx` | Add overline text; add CTA button at bottom; subtle background treatment |
| `src/components/Footer.tsx` | Add social icons row; gradient top border; mobile spacing tweaks |

