# Mighty Test — STEM Assessment & Learning Platform

## Complete System Documentation

**Version:** 2.0
**Last Updated:** August 2026
**Type:** Multi-tenant (school-scoped) web application + PWA

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Roles & Access Control (RBAC)](#4-roles--access-control-rbac)
5. [Authentication](#5-authentication)
6. [Registration Flows](#6-registration-flows)
7. [Routing Map](#7-routing-map)
8. [Student Dashboard](#8-student-dashboard)
9. [Teacher Dashboard](#9-teacher-dashboard)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Parent Portal](#11-parent-portal)
12. [Examination Engine](#12-examination-engine)
13. [Grading & Results](#13-grading--results)
14. [Review / Resit Integrity Model](#14-review--resit-integrity-model)
15. [Study Resources Library](#15-study-resources-library)
16. [AI Features](#16-ai-features)
17. [Messaging & Notifications](#17-messaging--notifications)
18. [Analytics & Reporting](#18-analytics--reporting)
19. [Gamification & Onboarding](#19-gamification--onboarding)
20. [Offline Resilience & PWA](#20-offline-resilience--pwa)
21. [Database Schema](#21-database-schema)
22. [Database Functions & Triggers](#22-database-functions--triggers)
23. [Edge Functions (Backend API)](#23-edge-functions-backend-api)
24. [Storage](#24-storage)
25. [Security Architecture](#25-security-architecture)
26. [Design System](#26-design-system)
27. [Performance Strategy](#27-performance-strategy)
28. [SEO](#28-seo)
29. [File Structure](#29-file-structure)
30. [Configuration & Environment](#30-configuration--environment)
31. [Operational Runbook](#31-operational-runbook)
32. [Known Constraints & Design Decisions](#32-known-constraints--design-decisions)

---

## 1. Overview

**Mighty Test** is a STEM (Science, Technology, Engineering, Mathematics, Robotics, AI) education and assessment platform built for schools. It serves four distinct stakeholder groups — **Students, Parents, Teachers, Administrators** — each with a dedicated dashboard, dedicated data scope, and dedicated permissions.

### Core capabilities

| Capability | Summary |
|---|---|
| Exam authoring | Manual authoring, AI generation from a topic, AI extraction from an uploaded PDF |
| Exam delivery | Timed, question-by-question engine with autosave, anti-malpractice warnings, text-to-speech |
| Grading | Auto-grading for objective questions, manual + AI-assisted grading for essays/short answers |
| Integrity | Mutually exclusive review/resit lock, tab-switch strike system, server-timestamped timers |
| Analytics | Class performance charts, student report cards, printable/exportable PDF reports |
| Study Library | Books, video courses and worksheets, class-scoped, private-bucket delivery |
| Communication | Internal real-time messaging, notification centre, email/SMS/web push |
| Gamification | XP, streaks, achievement badges, certificates |
| Offline | LocalStorage exam caching plus an auto-sync queue for network drops |

### Domain hierarchy

```text
School
 └── Class
      ├── Students          (1 class per student)
      ├── Teachers          (via teacher_class_assignments, per subject)
      ├── Exams             (via exam_class_assignments)
      └── Study Resources   (via study_resource_class_assignments)
```

Visibility everywhere in the product is derived from this hierarchy. A teacher sees only their assigned classes; a student sees only their own class's exams and resources; a parent sees only their linked children.

---

## 2. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI framework, hooks-based |
| TypeScript 5 | End-to-end type safety, generated DB types |
| Vite 5 | Dev server + production bundler |
| Tailwind CSS v3 | Utility styling, HSL design tokens |
| shadcn/ui + Radix UI | Accessible primitives (dialog, tabs, select, toast…) |
| Framer Motion | Page/section animation, onboarding tours, glassmorphic motion |
| React Router v6 | Client routing, lazy-loaded route chunks |
| TanStack Query | Server-state caching, background refetch |
| Recharts | Analytics charts (bars, lines, radials, pies) |
| react-hook-form + zod | Form state and schema validation |
| jsPDF + html2canvas | Client-side PDF export (report cards, certificates, keys) |
| react-helmet-async | Per-route SEO meta and JSON-LD |
| lucide-react | Icon set |

### Backend (Lovable Cloud)

| Technology | Purpose |
|---|---|
| PostgreSQL | Primary datastore with Row Level Security on every table |
| Auth | Email/password + synthetic-email Student ID login |
| Deno Edge Functions | Server-side logic, privileged operations, AI calls |
| Storage | Private `study-resources` bucket with signed URLs |
| Realtime | Live message and notification streams |
| Lovable AI Gateway | Gemini models for generation, grading, tutoring |
| Resend | Transactional email |
| Arkesel | SMS delivery (Ghana) |

---

## 3. System Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                        Browser (PWA)                       │
│  React SPA · Service Worker · LocalStorage exam cache      │
│  AuthContext ── ProtectedRoute ── Role dashboards          │
└───────────────┬────────────────────────┬───────────────────┘
                │ supabase-js            │ functions.invoke()
                ▼                        ▼
     ┌────────────────────┐   ┌─────────────────────────────┐
     │  PostgREST + RLS   │   │   Deno Edge Functions       │
     │  (direct queries)  │   │  service-role privileged    │
     └─────────┬──────────┘   └──────────┬──────────────────┘
               │                         │
               ▼                         ▼
     ┌──────────────────────────────────────────────────────┐
     │  PostgreSQL · RLS policies · SECURITY DEFINER RPCs   │
     │  triggers · enums · storage metadata                 │
     └──────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼──────────────────────┐
        ▼                    ▼                      ▼
  Lovable AI Gateway     Resend (email)       Arkesel (SMS)
```

### Two access paths

1. **Direct client → PostgREST.** Used for all normal reads/writes. Safety comes entirely from RLS policies plus `SECURITY DEFINER` helper functions (`has_role`, `get_teacher_class_ids`, `get_student_class_id`).
2. **Client → Edge Function → service role.** Used only where RLS must be bypassed: account creation, admin password resets, cross-user notifications, AI calls that must hide `LOVABLE_API_KEY`.

Edge functions run with `verify_jwt = false` and therefore **must** perform their own authorization: read the `Authorization` header, call `auth.getClaims(token)`, then verify role membership in `user_roles`. This is a project-wide standard.

---

## 4. Roles & Access Control (RBAC)

Roles live in a dedicated `public.user_roles` table — never on a profile table — to prevent privilege escalation.

```sql
create type app_role as enum ('student', 'parent', 'admin', 'teacher');
```

| Role | Scope | Landing route |
|---|---|---|
| `student` | Own attempts, own class exams/resources, own messages | `/dashboard` |
| `parent` | Linked children's results, messages with teachers | `/parent` |
| `teacher` | Only classes in `teacher_class_assignments` | `/teacher` |
| `admin` | Global: schools, classes, teachers, students, keys | `/admin` |

### Enforcement layers

1. **Database:** RLS policies calling `has_role(auth.uid(), 'admin')`, `is_admin_or_teacher()`, `get_teacher_class_ids()`.
2. **Edge functions:** explicit claim + role checks before any service-role write.
3. **Routing:** `ProtectedRoute` gates every private route by `allowedRoles`, and redirects wrong-role users to their own dashboard.
4. **UI:** conditional tabs/actions — cosmetic only, never the security boundary.

Teachers additionally have a `status` field (`pending` / `approved` / `rejected`). `ProtectedRoute` renders an "Account Pending Approval" screen instead of the dashboard for non-approved teachers.

---

## 5. Authentication

### `AuthContext` (`src/contexts/AuthContext.tsx`)

Single source of truth for `user`, `session`, `role`, `profile`, `preferences`, `loading`, `signOut`.

Key behaviours:

- Subscribes to `onAuthStateChange` **before** calling `getSession()`, and uses an `initialSessionPending` flag so the first resolved session — whichever arrives first — wins. This prevents the classic "flash logout" race.
- `loadUserData()` fetches role, student/parent/teacher profile and preferences in a single `Promise.all`, then selects the profile matching the resolved role.
- An in-memory `userDataCache` (5-minute TTL, keyed by user id) avoids refetching on every tab focus; it is invalidated on `signOut`.
- A `loadingUserIdRef` guard discards responses from a superseded user id (fast account switching).

### Login modes

| Mode | Identifier | Notes |
|---|---|---|
| Email | Real email + password | Standard Supabase auth |
| Student ID | `SCHOOLCODE-CLASSCODE-XXXX` | Resolved to an internal synthetic email before `signInWithPassword` |
| Parent access code | Issued at child registration | Parents receive credentials by email/SMS |

### Password reset

- Email-backed accounts: standard recovery email flow.
- Student-ID (synthetic email) accounts: no inbox exists, so reset is **staff-initiated** via the `reset-student-password` edge function (service role, admin/teacher only). The UI tells such students to contact their teacher.
- Parents: `reset-parent-password`.

Leaked-password protection (HIBP) is enabled on the auth provider.

---

## 6. Registration Flows

### A. Standard email registration (`register`)

Creates the auth user, the `students` row, the `user_roles` row, and (mandatorily) a linked parent account.

### B. Registration-key registration (`register-with-key`)

The school-first flow:

1. Admin generates keys in bulk (up to 500 at a time) for a specific school + class.
2. Keys are exported to a branded PDF and handed out.
3. Student enters the key; the client calls the `validate_registration_key` RPC, which returns only `key_code`, `school_name`, `class_name` for **available** keys — deliberately no ids, to block enumeration.
4. On submit, the edge function claims the key atomically, creates the student with the correct `school_id` / `class_id` / `student_id_code`, and marks the key `claimed`.

### C. Teacher registration (`register-teacher`)

Creates a `teachers` row with `status = 'pending'`. An admin approves or rejects via `approve-teacher`, which flips the status and drops a notification for the teacher.

### D. Parent accounts (`create-parent-account`)

Every student must have a parent. If the parent email already exists, the new student is linked to it; otherwise an account is created and credentials are delivered by email (Resend) and/or SMS (Arkesel). One-time credential display uses `sessionStorage` so a page refresh doesn't leak them permanently.

All registration paths use retry loops around the auth-user creation step, because propagation between auth and the public schema is not instantaneous.

---

## 7. Routing Map

Defined in `src/App.tsx`. `Index` and `Auth` are eagerly loaded; everything else is `React.lazy` + `Suspense`.

| Path | Guard | Component |
|---|---|---|
| `/` | public | `Index` (marketing homepage) |
| `/auth` | public | `Auth` |
| `/about`, `/contact`, `/faq`, `/terms`, `/privacy` | public | static pages |
| `/dashboard`, `/dashboard/:tab` | student | `Dashboard` |
| `/exam/take` | student | `ExamTaking` |
| `/exam/review/:attemptId` | student | `ExamReview` |
| `/parent` | parent | `ParentDashboard` |
| `/teacher` | teacher | `AdminDashboard` → renders `TeacherDashboard` |
| `/admin` | admin | `NewAdminDashboard` |
| `/admin/exam/:examId/questions` | admin, teacher | `ExamQuestions` |
| `/admin/exam/grade/:attemptId` | admin, teacher | `ExamGrading` |
| `/admin/analytics` | admin, teacher | `ExamAnalytics` |
| `*` | public | `NotFound` |

`usePageTracking` runs inside the router and writes `page_views` rows for analytics.

---

## 8. Student Dashboard

`/dashboard/:tab` is a **routed** dashboard — each sidebar entry is a real URL, so it is linkable, back-button friendly and independently code-split.

| Tab | Content |
|---|---|
| `home` | Hero banner, XP/streak, upcoming exams, recent results |
| `exams` | Assigned exams, due dates, start/resume, resit portal |
| `results` | Attempt history, scores, review entry point |
| `library` | Study Resources Library |
| `messages` | Full-page internal chat |
| `tutor` | Full-page AI Study Buddy with insight rail |
| `profile` | Details, preferences, notification settings |

### UI direction

Glassmorphic: `backdrop-blur-xl` panels over an animated aurora gradient, 3D floating assets in `StudentHeroBanner`, spring-based Framer Motion transitions, and a mobile bottom nav (`MobileBottomNav`) with 8 ms haptic feedback.

Messaging and the AI tutor exist **only** as pages — the earlier floating bubbles were removed to avoid redundancy.

---

## 9. Teacher Dashboard

`TeacherDashboard.tsx`, scoped by `useTeacherScope()`.

`useTeacherScope` resolves the teacher row, reads `teacher_class_assignments`, and returns `scopedClassIds`. It returns `null` for admins, meaning "no restriction", and `[]` for a teacher with no assignments (who therefore sees nothing until an admin assigns classes).

| Tab | Purpose |
|---|---|
| Exams | Create exams, author questions, AI generation, publish |
| Performance | Class analytics with Recharts (`ClassPerformanceAnalytics`) |
| Schools | Read-only view of the teacher's school |
| Assignments | Assign exams to assigned classes with due dates |
| Attempts | Live/completed attempts, entry point to grading |
| Students | Roster for assigned classes, report cards, password reset |
| Keys | Registration keys for the teacher's classes |
| Resits | Approve/deny resit requests, open resit windows |
| Library | Upload and class-scope study resources |

`ClassPerformancePortal` deliberately separates the **graphical analytics** view from the **printable report** view (`ClassAssessmentReport`), which were previously duplicated.

---

## 10. Admin Dashboard

`NewAdminDashboard.tsx` — superset of the teacher dashboard with no class scoping.

- **Schools & Classes** (`SchoolManagement`): CRUD, school codes, grade levels, statuses.
- **Teachers** (`TeacherManagement`): approve/reject, assign classes and subjects.
- **Students** (`StudentManagement`): search, paginate, edit, reset password, delete (`delete-student` cascades auth user + rows).
- **Registration Keys** (`RegistrationKeyManagement`): bulk generate, filter, export branded PDF.
- **Exams & Assignment** (`ExamAssignment`): global exam bank, class assignment, due dates.
- **Resits** (`ResitManagement`).
- **Library** (`StudyResourceManagement`).
- **Website Analytics** (`WebsiteAnalytics`): traffic from `page_views`.
- **Announcements**: role-targeted, priority-tagged, optionally expiring.

Admin promotion is a manual SQL operation — there is intentionally no self-service admin-creation endpoint (the old `create-admin` function was deleted as a hardcoded-credential risk).

---

## 11. Parent Portal

`/parent` shows, per linked child: exam results and trends, attendance of assessments, teacher feedback, downloadable report cards, and a direct message thread with the child's teachers. Access is enforced by RLS through `get_student_parent_id()`, so a parent physically cannot read another family's rows.

---

## 12. Examination Engine

`src/pages/ExamTaking.tsx` is the most safety-critical component in the product.

### Lifecycle

```text
assigned → attempt created (started_at, server timestamp)
        → question-by-question navigation, autosave per answer
        → submit (manual, timer expiry, or 3-strike malpractice)
        → status: completed → graded
```

### Question types

`question_type_enum`: `multiple_choice`, `true_false`, `short_answer`, `essay`.

- MCQ / true-false: radio selection, auto-gradable.
- **Short answer:** free-text `Textarea`, saved to `exam_answers.answer_text`, flagged for manual review.
- **Essay:** long-form `Textarea`, always manual/AI-assisted grading.

Short-answer and essay responses are included in the submit payload's upsert and set the attempt's `hasEssay` path so it lands in the grading queue rather than being auto-finalized.

### Timing

The countdown derives from the **server** `started_at` timestamp plus `duration_minutes`, not from client clock deltas, so refreshing or clock tampering cannot extend the window.

### Integrity: 3-strike system

Tab switches / visibility changes no longer force an instant submit (which produced false positives). Instead:

1. Strike 1 and 2 raise an explicit on-screen warning.
2. Strike 3 auto-submits.
3. A 1.5 s grace period absorbs transient blur events (notification popups, IME, screen rotation).

### Autosave & resume

`current_question_index` and `last_activity_at` are persisted, so a dropped session resumes exactly where the student left off. Answers are upserted atomically per question — never batched only at the end.

### Reading assistant

`useReadingAssistant` wraps the Web Speech API: read the question aloud, choose a voice and rate, and persist that preference per user (`VoiceSelectionDialog`).

---

## 13. Grading & Results

### Auto-grading

Objective questions are compared against `correct_answer` and awarded `marks` on match.

### Manual grading

`ExamGrading.tsx` presents each free-text answer with the question, the rubric marks, and an input for `marks_awarded` plus per-answer `review_text`.

### AI-assisted grading

`auto-grade-essay` sends the question, the expected answer and the student response to the AI gateway and returns a suggested mark and justification, which a human confirms.

### Score normalization (critical rule)

`marks_obtained` is always **normalized to the exam's `total_marks`**. A previous bug summed raw per-question marks and produced impossible scores such as `39/48` on a 40-mark exam. Both `ExamTaking.tsx` (auto path) and `ExamGrading.tsx` (manual path) now clamp and scale to `total_marks`.

### Presentation

Results tables use pills: **emerald** (pass/strong), **amber** (borderline), **red** (fail). Where a total is available it overrides any computed average. Report cards and certificates (`ExamCertificate`, `StudentReportCard`) export as PDF; class-level PDFs are generated server-side by `generate-pdf-report` (landscape, centre-aligned tables, embedded logo, AI-written summary).

---

## 14. Review / Resit Integrity Model

**Problem:** a student could open the full answer review of an attempt and *then* apply for a resit of the same exam — memorising the answer key first.

**Policy: mutually exclusive review and resit.**

- Opening a review stamps `exam_attempts.review_opened_at` (via the `mark_review_opened` RPC, which verifies ownership and the lock state).
- `can_request_resit(student, exam)` returns `false` once any attempt for that exam has `review_opened_at` set.
- `can_review_attempt(attempt)` returns `false` while a `pending` or `approved` resit request exists — and re-opens once the resit attempt has actually been submitted.

Both are `SECURITY DEFINER` and consulted by the UI (to show accurate, explained states and a confirmation prompt before the irreversible review) *and* enforced server-side. Resit windows themselves are opened per class via `resit_openings` with an optional deadline; each approved request grants exactly one additional attempt.

---

## 15. Study Resources Library

### Data model

`study_resources` (`book` | `video` | `worksheet`) + `study_resource_class_assignments` for class scoping. Storage lives in the **private** `study-resources` bucket.

### Staff side — `StudyResourceManagement`

- Upload documents from the local device: PDF, Word, PowerPoint, Excel, text, ePub, images, zip.
- Video: either paste an external link **or** upload a local video file, toggled in the UI.
- Optional cover-image upload.
- Assign to one or more classes, set subject/grade, publish or keep as draft.
- Teachers only see and assign their own classes; admins see all.

### Student side

`StudyLibrary` (glassmorphic filter/search grid) → `StudyResourceCard` → `ResourceViewerDialog`. Because the bucket is private, both the card cover and the viewer resolve **signed URLs** on demand; PDFs render inline, uploaded videos play in-app, external links open embedded or in a new tab.

---

## 16. AI Features

All AI runs server-side through the Lovable AI Gateway; `LOVABLE_API_KEY` never reaches the browser.

| Function | Model use | Purpose |
|---|---|---|
| `generate-questions` | Gemini (Pro for PDF grounding) | Generate questions from a topic **or** from an uploaded reference PDF; teacher specifies how many MCQ / true-false / essay questions |
| `process-exam-pdf` | Gemini | Extract an existing exam paper into structured questions |
| `auto-grade-essay` | Gemini | Suggested marks + justification for free-text answers |
| `generate-exam-reviews` | Gemini Flash | Per-question explanations for the student review screen, including stub rows for unanswered questions |
| `study-assistant` | Gemini | Context-aware tutor that reads the student's recent performance before answering |
| `generate-pdf-report` | Gemini | Narrative summary embedded in class PDF reports |

**PDF ingestion notes:** input is capped around a 128K-token budget, responses use `json_object` mode, extracted questions are de-duplicated, and long papers use a continuation strategy across calls.

Gateway failures are surfaced, never hidden: `429` → "try again shortly", `402` → credits exhausted with a billing prompt, validation errors → explicit message with the teacher's input preserved.

---

## 17. Messaging & Notifications

### Internal messaging

`messages` rows carry `conversation_id`, `sender_id`/`sender_role`, `recipient_id`/`recipient_role`, `content`, `is_read`. The UI is a two-pane glassmorphic chat with read receipts, subscribed to Realtime for instant delivery.

### Notification pipeline

```text
DB trigger  →  notifications row  →  Realtime  →  NotificationBell badge
                                            └────→  Service Worker push
```

- `trg_notify_on_new_message` notifies the recipient of any direct message.
- `trg_notify_on_resit_request` notifies every teacher assigned to the class **and** all admins (de-duplicated so an admin who also teaches the class isn't notified twice).

### Outbound channels

- **Email** via Resend: `send-grade-notification`, credential delivery, `notify-exam-assigned`.
- **SMS** via Arkesel: parent credentials and urgent alerts.
- **Web Push** via the service worker + `usePushNotifications`; `NotificationPermissionBanner` requests permission at a sensible moment, `send-test-notification` verifies the pipeline.

Announcements are a separate broadcast channel: role-targeted, priority-tagged, optionally expiring.

---

## 18. Analytics & Reporting

| Surface | Source | Output |
|---|---|---|
| `ExamAnalytics` | attempts + answers | Per-exam difficulty, score distribution, per-question success rate |
| `ClassPerformanceAnalytics` | attempts per class | Recharts bar/line/radial trends over time and subject |
| `StudentPerformanceTable` | attempts per student | Sortable table with pass/borderline/fail pills |
| `StudentReportCard` | attempts + feedback | Printable per-student card, jsPDF export |
| `ClassAssessmentReport` | class aggregate | Printable landscape report |
| `WebsiteAnalytics` | `page_views` | Sessions, devices, browsers, referrers, top pages |

Teacher performance awards use a 0–100 rating that maps to Diamond / Gold / Silver / Bronze tiers.

**Pagination is mandatory.** PostgREST returns at most 1000 rows, so every list surface implements server-side search + range pagination rather than fetching everything.

---

## 19. Gamification & Onboarding

- **XP** awarded for completing exams, hitting score thresholds and reading resources.
- **Streaks** for consecutive active study days.
- **Badges** for milestones, surfaced in `StudentGamification`.
- **Certificates** (`ExamCertificate`) generated for qualifying results and exportable as PDF.
- **Tours:** `OnboardingTour` (students) and `TeacherOnboardingTour` (teachers) are Framer Motion guided walkthroughs, gated by `user_preferences.onboarding_completed`.

---

## 20. Offline Resilience & PWA

`src/lib/examOfflineCache.ts`:

- Exam content and in-progress answers are mirrored to `localStorage`.
- Failed writes enter a sync queue and are replayed when connectivity returns.
- On reload the engine restores from cache first, then reconciles with the server.

PWA: `public/manifest.json` (installable, themed), `public/sw.js` (asset caching + push handling), `vercel.json` SPA rewrite so deep links resolve.

---

## 21. Database Schema

All tables are in `public` with RLS enabled and explicit `GRANT`s.

### Identity & organisation

| Table | Purpose |
|---|---|
| `user_roles` | `(user_id, role)` — the only source of role truth |
| `user_preferences` | Theme, language, notification toggles, onboarding flag |
| `schools` | Name, unique code, address, contact, status |
| `classes` | `school_id`, name, grade level, status |
| `students` | Profile, `school_id`, `class_id`, `parent_id`, `student_id_code`, STEM interests, skill levels |
| `teachers` | Profile, `school_id`, subject specialty, `status`, approval metadata |
| `parents` | Profile, `access_code`, relationship to student |
| `teacher_class_assignments` | `(teacher_id, class_id, subject)` — the scoping table |
| `registration_keys` | `key_code`, `school_id`, `class_id`, `status`, `claimed_by` |

### Assessment

| Table | Purpose |
|---|---|
| `exams` | Title, subject, grade, `duration_minutes`, `total_marks`, `passing_marks`, status |
| `exam_questions` | `question_text`, `question_type` (enum), `options` jsonb, `correct_answer`, `marks`, `order_number` |
| `exam_class_assignments` | Exam ↔ class, `due_date`, `is_active` |
| `exam_attempts` | `student_id`, `exam_id`, status, `marks_obtained`, timers, grading metadata, `review_opened_at` |
| `exam_answers` | `attempt_id`, `question_id`, `answer_text`, `is_correct`, `marks_awarded`, `review_text` |
| `resit_openings` | Per class+exam window with `is_open` and `deadline` |
| `resit_requests` | Student request with `status`, reviewer and `admin_note` |

### Content & communication

| Table | Purpose |
|---|---|
| `study_resources` | Title, `resource_type` enum, `file_path`, `external_url`, `cover_url`, `is_published` |
| `study_resource_class_assignments` | Resource ↔ class |
| `messages` | Conversation threads with read state |
| `notifications` | Per-user in-app notification feed |
| `announcements` | Role-targeted broadcasts with priority and expiry |

### Site & support

`page_views` (analytics events, INSERT-only), `contact_submissions` (INSERT-only, staff-read), `newsletter_subscribers`, `password_reset_tokens` (no client policies at all — service role only).

### Enums

```text
app_role            : student | parent | admin | teacher
question_type_enum  : multiple_choice | true_false | short_answer | essay
study_resource_type : book | video | worksheet
```

---

## 22. Database Functions & Triggers

### `SECURITY DEFINER` helpers

| Function | Returns | Use |
|---|---|---|
| `has_role(user, role)` | boolean | Base RBAC predicate for policies |
| `is_admin_or_teacher(user)` | boolean | Combined staff check |
| `get_teacher_class_ids(user)` | setof uuid | Class scoping in policies |
| `get_student_class_id(user)` | uuid | Student's own class |
| `get_student_parent_id(user)` | uuid | Parent linkage |
| `can_review_attempt(attempt)` | boolean | Review/resit lock, review side |
| `can_request_resit(student, exam)` | boolean | Review/resit lock, resit side |
| `mark_review_opened(attempt)` | void | Ownership-checked review stamp |
| `validate_registration_key(code)` | table | Non-enumerable key lookup |

All are `SET search_path = public` and used inside policies specifically to avoid recursive RLS evaluation.

### Triggers

| Trigger | Table | Effect |
|---|---|---|
| `on_auth_user_created` | `auth.users` | Seeds `user_preferences` |
| `update_*_updated_at` | many | Maintains `updated_at` |
| `trg_notify_on_new_message` | `messages` | Notifies recipient |
| `trg_notify_on_resit_request` | `resit_requests` | Notifies class teachers + admins |

Time-dependent validation (deadlines, expiry) uses triggers rather than `CHECK` constraints, since checks must be immutable.

---

## 23. Edge Functions (Backend API)

All live in `supabase/functions/<name>/index.ts`, all declare `verify_jwt = false` in `supabase/config.toml`, all handle CORS preflight, and all privileged ones authenticate via `auth.getClaims(token)` then verify role.

| Function | Auth required | Purpose |
|---|---|---|
| `register` | public | Standard student registration |
| `register-with-key` | public | Registration-key student registration |
| `register-teacher` | public | Teacher signup as `pending` |
| `approve-teacher` | admin | Approve/reject teacher + notify |
| `create-parent-account` | staff | Create/link parent, deliver credentials |
| `resend-parent-credentials` | staff | Re-deliver parent credentials |
| `reset-student-password` | admin/teacher | Service-role password reset |
| `reset-parent-password` | admin/teacher | Service-role password reset |
| `delete-student` | admin | Cascade delete auth user + rows |
| `generate-questions` | staff | AI question generation (topic or PDF, per-type counts) |
| `process-exam-pdf` | staff | Extract questions from an exam PDF |
| `auto-grade-essay` | staff | AI-suggested essay marks |
| `generate-exam-reviews` | student/staff | AI per-question explanations |
| `study-assistant` | student | Performance-aware AI tutor |
| `generate-pdf-report` | staff | Server-side class PDF with AI summary |
| `notify-exam-assigned` | staff | Email students/parents on assignment |
| `send-grade-notification` | staff | Email results |
| `send-test-notification` | any user | Verify the push pipeline |

Third-party calls (Resend, Arkesel) use native `fetch` rather than SDKs, for Deno compatibility and cold-start speed. Errors are returned as structured JSON so the client can surface the specific validation message instead of a generic failure.

---

## 24. Storage

| Bucket | Public | Contents |
|---|---|---|
| `study-resources` | No | Documents, uploaded videos, cover images |

Because the bucket is private, every read path (`StudyResourceCard` covers, `ResourceViewerDialog` documents and videos, downloads) creates a short-lived **signed URL** at access time. Uploads are namespaced per resource and written by staff only, enforced by both storage policies and the resource RLS policies.

---

## 25. Security Architecture

1. **RLS on every table.** No table in `public` is readable without a matching policy; grants are issued per role (`authenticated`, `service_role`, and `anon` only where a public read is genuinely intended).
2. **Roles in a separate table.** Never on `students`/`teachers`/`profiles`.
3. **`SECURITY DEFINER` predicates** to break RLS recursion, all with a pinned `search_path`.
4. **Edge-function authorization** via `auth.getClaims(token)` — never trusting a client-supplied user id.
5. **No client-side admin checks.** No localStorage flags, no hardcoded credentials. `AdminSetup.tsx` and the `create-admin` function were deleted precisely for this reason.
6. **Enumeration resistance.** `validate_registration_key` returns display data only; `registration_keys` itself is staff-scoped.
7. **Insert-only public tables.** `page_views` and `contact_submissions` accept anonymous inserts with size validation, but never allow public reads or updates.
8. **Secrets stay server-side.** `LOVABLE_API_KEY`, `RESEND_API_KEY`, `ARKESEL_API_KEY`, service-role key — never exposed to the client, never prefixed `VITE_`.
9. **HIBP leaked-password protection** enabled.
10. **Dependency hygiene:** `jspdf` upgraded to `^4.2.1` to clear critical/high advisories.
11. **Exam integrity:** server-timestamped timers, strike-based malpractice handling, review/resit mutual exclusion.

---

## 26. Design System

Palette (the "EduLe" direction), defined as HSL CSS variables in `src/index.css` and mapped in `tailwind.config.ts`:

| Token | Hex | Role |
|---|---|---|
| Darkest | `#021024` | Deep background, dark surfaces |
| Primary | `#052659` | Brand primary |
| Secondary | `#5483B3` | Muted accent |
| Soft accent | `#7DA0CA` | Highlights, borders |
| Light | `#C1E8FF` | Light background, foreground on dark |

Rules:

- **Always** use semantic tokens (`hsl(var(--primary))`, `bg-primary`). Never hardcode `text-white`, `bg-black`, or arbitrary hex in components — it breaks theming.
- Glassmorphism (`backdrop-blur-xl`, translucent borders, layered gradients) is the signature treatment on dashboards.
- Mobile-first: layouts stack, with a blurred bottom nav and 8 ms haptic feedback on tap.
- Portals and modals toggle CSS `visibility` (`hidden`/`block`) rather than conditionally unmounting, which previously destroyed form state.
- Forms use stable `key`s to prevent remount-on-render input loss.
- Branding: "Mighty Test — STEM Excellence", golden shield logo, kid-friendly but professional.

---

## 27. Performance Strategy

- Route-level `React.lazy` + `Suspense`, with only `Index` and `Auth` eager.
- TanStack Query defaults: `staleTime` 5 min, `gcTime` 30 min, `refetchOnWindowFocus: false`, one retry.
- 5-minute in-memory auth/profile cache to avoid refetch storms on tab focus.
- Parallel `Promise.all` fetches instead of waterfalls in the auth bootstrap.
- Server-side pagination and search on all large lists (1000-row PostgREST ceiling).
- Signed URLs generated lazily, only for resources actually opened.

---

## 28. SEO

`react-helmet-async` + a shared `SEO.tsx` component apply per-route `<title>` (<60 chars), meta description (<160), canonical, Open Graph and Twitter card tags, plus JSON-LD (`EducationalOrganization`, `Course`, `FAQPage`) where applicable. `public/sitemap.xml`, `public/robots.txt` and `public/llms.txt` are maintained for crawlers and AI search. Semantic HTML, a single `<h1>` per page, alt text on all imagery, and lazy-loaded images round it out.

---

## 29. File Structure

```text
src/
├── App.tsx                       # Routes, providers, lazy loading
├── main.tsx
├── index.css                     # Design tokens (HSL)
├── contexts/AuthContext.tsx      # Session, role, profile, cache
├── components/
│   ├── ProtectedRoute.tsx        # Central route guard
│   ├── Navbar.tsx / Footer.tsx / Hero.tsx / CoursesSection.tsx / CTABanner.tsx
│   ├── TeacherDashboard.tsx
│   ├── ChatBubble.tsx            # Messaging (page mode)
│   ├── AIStudyAssistant.tsx      # Study Buddy (page mode)
│   ├── NotificationBell.tsx / NotificationPermissionBanner.tsx
│   ├── OnboardingTour.tsx / TeacherOnboardingTour.tsx
│   ├── StudentGamification.tsx / ExamCertificate.tsx
│   ├── SEO.tsx / ErrorBoundary.tsx / MobileBottomNav.tsx
│   ├── admin/                    # School, Teacher, Student, Keys, Resits,
│   │                             # Assignment, Analytics, Reports, Library
│   ├── student/                  # HeroBanner, Sidebar, StudyLibrary,
│   │                             # ResourceCard, ResourceViewerDialog
│   ├── auth/StudentRegistration.tsx
│   └── ui/                       # shadcn primitives
├── pages/                        # Index, Auth, Dashboard, ParentDashboard,
│                                 # AdminDashboard, NewAdminDashboard,
│                                 # ExamTaking/Questions/Grading/Review/Analytics,
│                                 # About, Contact, FAQ, Terms, Privacy, NotFound
├── hooks/                        # useTeacherScope, usePageTracking,
│                                 # usePushNotifications, useReadingAssistant,
│                                 # use-mobile, use-toast
├── lib/                          # examOfflineCache, examUtils, exportUtils, utils
└── integrations/supabase/        # client.ts, types.ts  (auto-generated)

supabase/
├── config.toml                   # Per-function verify_jwt settings
└── functions/                    # 18 Deno edge functions

public/                           # manifest.json, sw.js, robots.txt,
                                  # sitemap.xml, llms.txt
```

---

## 30. Configuration & Environment

### Client env (auto-generated, do not edit)

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

### Server secrets (edge functions only)

```text
LOVABLE_API_KEY            # AI Gateway
RESEND_API_KEY             # Email
ARKESEL_API_KEY            # SMS
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
```

### Files that must never be hand-edited

`src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`, and project-level settings in `supabase/config.toml` — all are regenerated.

### Deployment

Vite build → static hosting; `vercel.json` provides the SPA rewrite. Edge functions deploy alongside the project.

---

## 31. Operational Runbook

| Task | How |
|---|---|
| Promote an admin | Insert `('admin')` into `user_roles` for that user id via SQL |
| Onboard a school | Create school → create classes → create/approve teachers → assign classes |
| Enrol a cohort | Generate registration keys for the class → export PDF → distribute |
| Approve a teacher | Admin dashboard → Teachers → Approve (fires `approve-teacher`) |
| Assign an exam | Exams → publish → Assignment → pick class + due date |
| Reset a student password | Students → Reset password (staff-only edge function) |
| Open a resit window | Resits → open for exam + class, optionally set a deadline |
| Publish a resource | Library → upload → assign classes → publish |
| Diagnose an AI failure | Check edge function logs; `429` = rate limit, `402` = credits |

---

## 32. Known Constraints & Design Decisions

- **No payment or billing integrations.** Deliberate and permanent — the platform is school-funded, not consumer-billed.
- **No in-browser coding system.** CodeMirror and the Piston execution API were removed and will not return.
- **One class per student.** The hierarchy assumes a single class membership; multi-class students would require a join table.
- **1000-row API ceiling.** Any new list surface must ship with pagination from day one.
- **Edge functions self-authorize.** Because `verify_jwt = false` is project-wide, forgetting the `getClaims` + role check in a new function is the single most likely way to introduce a hole.
- **Review is irreversible.** Opening an exam review permanently forfeits the resit option for that exam; the UI warns explicitly before committing.
- **Synthetic-email accounts cannot self-recover.** Student-ID logins have no inbox, so password recovery is necessarily staff-mediated.

---

*End of documentation.*
