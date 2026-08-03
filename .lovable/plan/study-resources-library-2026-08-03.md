# Study Resources Library

Add a teacher/admin-managed library of study materials (books/PDFs, video courses, practice worksheets) that students browse from a new dashboard page, scoped to their class and subject.

## What students get

A new "Library" page in the student sidebar (`/dashboard/library`), styled to match the existing glassmorphic dashboard:

- Hero strip with a count of available materials and the student's class name
- Filter row: search box, type chips (All / Books / Videos / Worksheets), subject chips
- Responsive card grid — each card shows a cover image (or a generated gradient + type icon when none), title, subject pill, type badge, short description, and file size or video duration
- Books/worksheets open in a full-screen glass PDF viewer drawer with a Download button
- Video cards open a glass modal with an embedded YouTube/Vimeo player
- Motion: staggered card entrance, hover lift + glow, animated filter pill transitions, skeleton loaders while fetching, illustrated empty state when a filter returns nothing

## What teachers and admins get

A new "Resources" tab in the teacher and admin dashboards:

- Form to add a resource: title, description, type (book / video / worksheet), subject, optional grade level, and either a file upload (PDF/doc) or a video URL, plus optional cover image
- Assign each resource to one or more of the classes the teacher is scoped to
- Table of existing resources with edit, unpublish, and delete actions
- Teachers only see and manage resources for their assigned classes; admins see everything

## Technical outline

**Database (one migration)**

- `study_resources` — title, description, resource_type (enum: book, video, worksheet), subject, grade_level, file_path, external_url, cover_url, file_size, duration_seconds, is_published, created_by
- `study_resource_class_assignments` — resource_id, class_id, assigned_by
- GRANTs for `authenticated` and `service_role` on both tables, RLS enabled
- Policies: students read published resources assigned to their `class_id`; teachers manage rows for classes in `get_teacher_class_ids(auth.uid())`; admins manage all via `has_role(auth.uid(), 'admin')`

**Storage**

- Private `study-resources` bucket; RLS on `storage.objects` mirrors the table policies so students can only read files for resources assigned to their class. Files are served through signed URLs.

**Frontend**

- `src/components/student/StudyResourceCard.tsx`, `ResourceViewerDialog.tsx`, and `src/components/student/StudyLibrary.tsx`
- `src/components/admin/StudyResourceManagement.tsx` for the teacher/admin tab
- `library` added to `STUDENT_TABS` + `PAGE_META` in `src/pages/Dashboard.tsx`, plus a nav entry in `StudentSidebar.tsx` and `MobileBottomNav.tsx`
- Data fetching with TanStack Query, class scoping read from the existing `profile.class_id`
- All colors use the existing HSL design tokens and `glass`/`glass-strong` utilities — no hardcoded color classes
