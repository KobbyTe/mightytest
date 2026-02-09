

# Homepage Enhancement with Hero Video

## Overview

Replace the static hero image with a clean, professional, muted autoplay hero video (no audio) showing STEM/technology/education visuals. Also polish the overall homepage with refined spacing, smoother animations, and a more modern feel.

## Changes

### 1. Hero Section -- Video Background (File: `src/components/Hero.tsx`)

- Replace the right-side static `hero-stem.jpg` image with a **full-width background video** that covers the entire hero section
- Use a free, royalty-free STEM/technology video from a CDN (e.g., a Pexels or Coverr video showing coding, robotics, or lab work)
- Video attributes: `autoPlay`, `muted`, `loop`, `playsInline`, no controls -- completely silent and non-intrusive
- Add a dark gradient overlay on top of the video so the text remains crisp and readable
- Switch from the 2-column grid layout to a **centered text-over-video** layout for a more cinematic, modern feel
- Keep all existing content (badge, heading, description, CTAs, stats) but center them over the video

### 2. Visual Polish (File: `src/components/Hero.tsx`)

- Add a subtle `backdrop-blur` to the stats row for a frosted-glass look
- Make the CTA buttons slightly larger with more breathing room
- Add a subtle scroll-down indicator (animated chevron) at the bottom of the hero

### 3. Features Section Refinement (File: `src/components/Features.tsx`)

- Add a subtle gradient divider between Hero and Features for a smoother visual transition
- No structural changes -- just minor spacing/padding tweaks

### 4. Footer Year Update (File: `src/components/Footer.tsx`)

- Update copyright year from 2024 to 2025

## Technical Details

| File | Change |
|------|--------|
| `src/components/Hero.tsx` | Replace 2-column image layout with full-width background video + centered overlay content. Use an HTML `<video>` element with a free STEM video URL. Add gradient overlays for text readability. Add scroll indicator. |
| `src/components/Features.tsx` | Minor spacing adjustments at the top for a smoother transition from the hero. |
| `src/components/Footer.tsx` | Update copyright year to 2025. |

### Video Source

Will use a high-quality, royalty-free video URL from Pexels/Coverr CDN showing technology/STEM visuals (e.g., circuit boards, code on screens, robotics). The video loads via a direct URL -- no file upload needed. Falls back gracefully to a gradient background if the video fails to load.

