

## Update Platform Logo

### Overview

Replace the current Mighty Test logo with the newly uploaded golden shield logo across all platform locations.

---

### Files to Update

The logo is currently used in **4 React components** and there are **favicon/meta assets** in the public folder:

| Location | File | Usage |
|----------|------|-------|
| Navbar | `src/components/Navbar.tsx` | Header logo (h-10) |
| Footer | `src/components/Footer.tsx` | Footer logo (h-10) |
| Auth Page | `src/pages/Auth.tsx` | Login/signup page logo (h-16 and h-10) |
| Design Showcase | `src/components/DesignShowcase.tsx` | Component showcase |
| Favicon | `public/favicon.png` | Browser tab icon |
| OG/Meta | `index.html` | Social media sharing preview |

---

### Implementation Steps

**Step 1: Copy the new logo to src/assets**

Copy the uploaded image to replace the existing logo:
- Source: `user-uploads://ChatGPT_Image_Jan_31_2026_03_33_07_PM.png`
- Destination: `src/assets/mighty-test-logo.png`

Since all 4 component files already import from `@/assets/mighty-test-logo.png`, replacing this file will automatically update all component usages.

**Step 2: Copy the new logo to public folder for favicon/meta**

Copy to public folder for browser tab and social sharing:
- Source: `user-uploads://ChatGPT_Image_Jan_31_2026_03_33_07_PM.png`
- Destination: `public/favicon.png`

This updates:
- Browser tab favicon
- OpenGraph image for social sharing
- Twitter card image

---

### Technical Details

The new logo has a **black background** with a **gold shield** design. The existing components render it as:

```tsx
// Navbar & Footer
<img src={logo} alt="Mighty Test" className="h-10 w-auto" />

// Auth page (large)
<img src={logo} alt="Mighty Test" className="h-16 w-auto" />

// Auth page (mobile)
<img src={logo} alt="Mighty Test" className="h-10 w-auto" />
```

These dimensions should work well with the new horizontal logo format.

---

### Summary

| Action | File |
|--------|------|
| Replace | `src/assets/mighty-test-logo.png` |
| Replace | `public/favicon.png` |

No code changes needed - just replacing the image files will update the logo everywhere automatically.

