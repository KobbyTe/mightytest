

# Make Mighty Test Platform Commercial-Ready

No payment code exists in the project, so nothing to remove. The focus is on two areas: **better landing page** and **more admin features**.

---

## 1. Enhanced Landing Page

Transform the current minimal landing page into a professional, conversion-focused marketing site.

**New sections to add to `Index.tsx`:**
- **Stats/Social Proof Bar** -- Animated counters showing "X+ Students", "X+ Exams Completed", "X+ Schools" (pulled from real DB counts via a public edge function)
- **Testimonials Carousel** -- Rotating quotes from students, parents, and schools with avatars and roles
- **How It Works** -- 3-step visual walkthrough (Register → Take Exams → Track Progress) with icons and connecting lines
- **Call-to-Action Banner** -- Full-width gradient section with "Get Started Free" and "Request a Demo" buttons
- **FAQ Accordion** -- Common questions about the platform using the existing Accordion component

**New standalone pages:**
- `/about` -- Mission, team, and platform story
- `/contact` -- Contact form (stores submissions in a new `contact_submissions` table)
- `/faq` -- Expanded FAQ page
- `/terms` and `/privacy` -- Legal pages with placeholder content

**Footer update:**
- Wire up the currently dead links to the new pages
- Add a newsletter signup input (stores emails in a `newsletter_subscribers` table)

---

## 2. More Admin Features

**Notification System:**
- New `notifications` table (user_id, title, message, type, is_read, link, created_at)
- Bell icon with unread badge in all dashboard headers (admin, student, parent)
- Notification dropdown panel showing recent notifications
- Auto-generate notifications on key events: exam assigned, exam graded, resit opened, new message received
- Database trigger or edge function to create notification rows on relevant table inserts/updates

**Bulk Operations (Admin Dashboard):**
- Multi-select checkboxes on the student roster for bulk actions (deactivate, assign to class, delete)
- Bulk exam assignment -- select multiple classes at once
- Bulk grade export -- select multiple exams and download combined CSV/PDF

**Admin Announcement System:**
- New `announcements` table (title, content, target_role, priority, expires_at, created_by)
- Admin can post announcements visible to all students, all parents, or both
- Banner component on student/parent dashboards showing active announcements

---

## 3. Database Changes

New tables with RLS:
- `contact_submissions` (name, email, message, created_at) -- public INSERT, admin SELECT
- `newsletter_subscribers` (email, created_at) -- public INSERT, admin ALL
- `notifications` (user_id, title, message, type, is_read, link, created_at) -- users see own, admin sees all
- `announcements` (title, content, target_role, priority, expires_at, created_by, created_at) -- admin ALL, authenticated SELECT

---

## 4. Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/Index.tsx` | Add new sections |
| `src/components/StatsBar.tsx` | New -- animated counters |
| `src/components/Testimonials.tsx` | New -- carousel |
| `src/components/HowItWorks.tsx` | New -- 3-step visual |
| `src/components/CTABanner.tsx` | New -- call to action |
| `src/components/FAQSection.tsx` | New -- accordion FAQ |
| `src/pages/About.tsx` | New page |
| `src/pages/Contact.tsx` | New page with form |
| `src/pages/FAQ.tsx` | New page |
| `src/pages/Terms.tsx` | New page |
| `src/pages/Privacy.tsx` | New page |
| `src/components/Footer.tsx` | Wire up links |
| `src/components/Navbar.tsx` | Add new page links |
| `src/components/NotificationBell.tsx` | New -- bell + dropdown |
| `src/components/AnnouncementBanner.tsx` | New -- dashboard banner |
| `src/pages/AdminDashboard.tsx` | Add bulk ops, announcements tab, notification bell |
| `src/pages/Dashboard.tsx` | Add notification bell, announcement banner |
| `src/pages/ParentDashboard.tsx` | Add notification bell, announcement banner |
| `src/App.tsx` | Add new routes |
| Database migration | 4 new tables + RLS policies |

---

This is a large scope. I recommend implementing it in 2-3 rounds: landing page first, then admin features + notifications.

