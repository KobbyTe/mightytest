# Mighty Test — STEM Assessment Platform

## Full System Documentation

**Version:** 1.0  
**Last Updated:** March 2026  
**Platform URL:** https://lovable.dev/projects/775411e5-063f-42c8-9c84-56270b568eee

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Authentication System](#5-authentication-system)
6. [Registration Flows](#6-registration-flows)
7. [Role-Based Dashboards](#7-role-based-dashboards)
8. [Examination Engine](#8-examination-engine)
9. [AI-Powered Features](#9-ai-powered-features)
10. [School & Class Management](#10-school--class-management)
11. [Teacher Management](#11-teacher-management)
12. [Parent Portal](#12-parent-portal)
13. [Notification System](#13-notification-system)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Gamification](#15-gamification)
16. [Offline Support](#16-offline-support)
17. [Database Schema](#17-database-schema)
18. [Edge Functions (Backend)](#18-edge-functions-backend)
19. [Security Architecture](#19-security-architecture)
20. [File Structure](#20-file-structure)
21. [Configuration & Environment](#21-configuration--environment)

---

## 1. Overview

**Mighty Test** is a comprehensive STEM (Science, Technology, Engineering, Mathematics, Robotics, AI) education and assessment platform designed for schools. It provides:

- **Intelligent exam creation** with AI-powered question generation
- **Automated and manual grading** for objective and essay questions
- **Multi-role access** for Students, Parents, Teachers, and Administrators
- **Real-time analytics** for student performance tracking
- **School-based class management** with teacher-subject assignments
- **Gamification** to motivate student engagement
- **Offline exam resilience** so students don't lose work during network issues
- **Accessibility features** including text-to-speech reading assistant

The platform targets K-12 STEM education with a focus on exam integrity, performance analytics, and seamless multi-stakeholder communication.

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework with hooks-based architecture |
| **TypeScript** | Type safety across the entire codebase |
| **Vite 5** | Build tool with SWC for fast compilation |
| **Tailwind CSS 3** | Utility-first CSS with custom design tokens |
| **shadcn/ui** | Accessible component library (Radix primitives) |
| **React Router 6** | Client-side routing with protected routes |
| **TanStack React Query 5** | Server state management with 5-minute stale time |
| **Framer Motion** | Animations and transitions |
| **Recharts** | Data visualization for analytics |
| **jsPDF + html2canvas** | PDF report generation (certificates, report cards) |

### Backend (Lovable Cloud / Supabase)
| Technology | Purpose |
|---|---|
| **Supabase PostgreSQL** | Primary database with Row-Level Security |
| **Supabase Auth** | Authentication with email/password |
| **Supabase Edge Functions (Deno)** | Serverless backend logic |
| **Supabase Realtime** | Live data subscriptions |
| **Lovable AI** | AI question generation and essay grading |

### External Integrations
| Service | Purpose |
|---|---|
| **Resend** | Email delivery (parent credentials, notifications) |
| **Arkesel** | SMS notifications (via `fetch`) |

---

## 3. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Student   │ │ Parent   │ │ Teacher  │ │  Admin   │   │
│  │ Dashboard │ │ Dashboard│ │ Dashboard│ │ Dashboard│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│        │              │            │            │        │
│  ┌──────────────────────────────────────────────────┐   │
│  │          AuthContext (Session Management)         │   │
│  │          ProtectedRoute (Role Gating)             │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────┘
                            │ Supabase JS Client
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 Lovable Cloud (Supabase)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │PostgreSQL│ │  Auth    │ │   Edge Functions (Deno)   │ │
│  │  + RLS   │ │  System  │ │  • register              │ │
│  │          │ │          │ │  • register-with-key      │ │
│  │ 20 tables│ │ JWT Auth │ │  • generate-questions     │ │
│  │          │ │          │ │  • auto-grade-essay       │ │
│  └──────────┘ └──────────┘ │  • send-grade-notification│ │
│                             │  • approve-teacher        │ │
│                             │  • create-parent-account  │ │
│                             │  • + 10 more              │ │
│                             └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Route Map

| Route | Component | Access |
|---|---|---|
| `/` | `Index` | Public — Landing page |
| `/auth` | `Auth` | Public — Login/Register |
| `/dashboard` | `Dashboard` | Student only |
| `/admin` | `NewAdminDashboard` | Admin only |
| `/admin-setup` | `AdminSetup` | Admin only |
| `/admin/exam/:examId/questions` | `ExamQuestions` | Admin + Teacher |
| `/admin/exam/grade/:attemptId` | `ExamGrading` | Admin + Teacher |
| `/admin/analytics` | `ExamAnalytics` | Admin + Teacher |
| `/teacher` | `AdminDashboard` (Teacher mode) | Teacher only |
| `/exam/take` | `ExamTaking` | Student only |
| `/exam/review/:attemptId` | `ExamReview` | Student only |
| `/parent` | `ParentDashboard` | Parent only |
| `/about`, `/contact`, `/faq`, `/terms`, `/privacy` | Static pages | Public |

### Code Organization

- **Lazy Loading**: All routes except `/` and `/auth` are lazy-loaded via `React.lazy()` for faster initial paint.
- **Error Boundary**: `ErrorBoundary` component wraps the entire app for graceful error recovery.
- **Query Caching**: React Query configured with 5-minute stale time and 30-minute garbage collection.

---

## 4. User Roles & Access Control

### Role Hierarchy

```
Super-Admin (admin)
    ├── Platform-wide analytics and teacher management
    ├── Full CRUD on all tables
    └── Teacher approval/rejection

Teacher (teacher)
    ├── Scoped to assigned classes + subjects
    ├── Exam creation and grading
    └── Student and key management (within scope)

Parent (parent)
    ├── View-only access to linked children's data
    └── Exam results and performance metrics

Student (student)
    ├── Take assigned exams
    ├── View own results and certificates
    └── Request exam resits
```

### Role Storage

Roles are stored in a dedicated `user_roles` table (never on the user/profile tables to prevent privilege escalation):

```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,  -- ENUM: 'student' | 'parent' | 'admin' | 'teacher'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);
```

### Role Verification Function

A `SECURITY DEFINER` function prevents recursive RLS issues:

```sql
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
```

A helper `is_admin_or_teacher()` function checks for either elevated role in a single call.

### Route Protection

The `ProtectedRoute` component:
1. Shows a loading spinner while authentication state resolves
2. Redirects unauthenticated users to `/auth`
3. Blocks pending/rejected teachers with a status screen + sign-out button
4. Redirects users who access a route not matching their role to their correct dashboard

---

## 5. Authentication System

### Session Management (`AuthContext.tsx`)

The `AuthProvider` is the central authentication state manager. It handles:

#### Initial Session Restoration (Page Refresh Fix)
```
1. Set up onAuthStateChange listener (handles INITIAL_SESSION, SIGNED_OUT, TOKEN_REFRESHED)
2. Call supabase.auth.getSession() as fallback
3. Use initialSessionPending flag to prevent race conditions
4. First responder wins — prevents double-loading
```

**Key Design Decisions:**
- `initialSessionPending` flag ensures only one source (listener OR getSession) processes the initial state
- `loadingUserIdRef` prevents stale profile data from overwriting state during rapid login/logout
- `loading` state is only set to `true` during initial load — background token refreshes do NOT trigger the loading spinner
- 5-minute user data cache (`userDataCache` Map) prevents redundant DB queries

#### Login Flow (`Auth.tsx`)
1. User selects role tab (Student / Parent / Teacher)
2. Enters email + password (or Student ID format: `SCHOOL-CLASS-XXXX`)
3. `loginInProgressRef` prevents the auth redirect effect from firing during manual login
4. After `signInWithPassword`, the system verifies the role in `user_roles` (with 3 retry attempts for consistency)
5. If role doesn't match the selected tab, login is rejected and session is signed out
6. On success, user is redirected to their role-specific dashboard

#### Student ID Login
Students can log in using their assigned Student ID (format: `STU-SCHOOLCODE-XXXX`) instead of email:
- The system detects IDs by checking for dashes and no `@` symbol
- Internally converts to `{id}@studentid.internal` email format

#### Password Reset
- **Students/Teachers**: Standard Supabase `resetPasswordForEmail` flow with redirect to `/auth`
- **Parents**: Custom `reset-parent-password` edge function that generates and emails new credentials
- Password recovery is detected via `PASSWORD_RECOVERY` auth event, showing an inline reset form

#### Session Persistence Across Refreshes
The system explicitly handles page refreshes without logging users out:
- `INITIAL_SESSION` event rehydrates the session from Supabase's internal storage
- `getSession()` serves as a fallback if the listener fires first
- Token refreshes are handled silently without showing loading states

---

## 6. Registration Flows

### Flow 1: Standard Email Registration (Students)

Handled by `StudentRegistration` component:
1. Student fills out a comprehensive form (name, DOB, gender, school, class, grade, STEM interests, programming experience)
2. Parent information is collected (name, email, phone, relationship)
3. Calls the `register` edge function which:
   - Creates auth user via `supabase.auth.admin.createUser()`
   - Inserts into `students` table
   - Inserts into `user_roles` table
   - Creates parent account (if email provided) via `create-parent-account`
4. Attempts auto-login; falls back to login page with success message

### Flow 2: Student ID Registration (Two-Step)

For schools using pre-generated registration keys:

**Step 1 — Key Verification:**
1. Student enters registration key (format: `SCHOOLCODE-CLASSNAME-XXXX`)
2. System validates key exists and status is `available`
3. Returns school name and class name for confirmation

**Step 2 — Profile Completion:**
1. Student fills out personal details + parent info
2. Calls `register-with-key` edge function which:
   - Validates the key is still available (race-condition safe)
   - Creates auth user with internal email (`{studentId}@studentid.internal`)
   - Creates student record linked to the correct school/class
   - Generates permanent Student ID (`STU-SCHOOLCODE-XXXX`)
   - Marks registration key as `claimed`
   - Creates parent account if parent email provided
3. Displays the official Student ID for the student to save

### Flow 3: Teacher Registration

1. Teacher fills out form (name, email, password, phone, school, subject specialty)
2. Calls `register-teacher` edge function which:
   - Creates auth user
   - Inserts into `teachers` table with `status: 'pending'`
   - Inserts role into `user_roles`
3. Teacher sees "Pending Approval" screen until admin approves
4. Admin uses `approve-teacher` edge function to change status to `approved`

### Flow 4: Parent Account Creation

Parents do NOT self-register. Accounts are created automatically:
- When a student registers with parent details, the `create-parent-account` edge function:
  - Creates auth user with a generated password
  - Inserts into `parents` table with a generated access code
  - Inserts into `user_roles`
  - Sends credentials via email (Resend) and optionally SMS (Arkesel)
- Admins can also manually create parent accounts and resend credentials

---

## 7. Role-Based Dashboards

### Student Dashboard (`/dashboard`)

**Features:**
- **Stats Overview**: Total exams, completed, average score, pass rate
- **Numbered Results List**: All graded exams listed chronologically (Test 1, Test 2, ...) with average at bottom
- **Active Exams**: Cards for available exams with start/continue buttons
- **Exam Results**: Detailed cards showing scores, pass/fail, certificates
- **Certificates**: Downloadable PDF certificates for passed exams
- **AI Study Assistant**: Chat-based AI tutor for STEM subjects
- **Gamification**: XP system, badges, streaks, and achievements
- **Resit Requests**: Submit requests to retake failed exams
- **Notifications**: Bell icon with unread count
- **Onboarding Tour**: First-time guided walkthrough
- **Reading Assistant**: Text-to-speech with adjustable speed and voice selection
- **Profile Management**: View/edit personal and parent information
- **Mobile Bottom Nav**: Touch-friendly navigation for mobile users

### Teacher Dashboard (`/teacher`)

The teacher dashboard uses `AdminDashboard.tsx` but renders the `TeacherDashboard` component, providing:

**Features:**
- **Teaching Scope Summary**: Classes and subjects assigned (visible in My Profile dialog)
- **Scoped Data**: All views filtered by `useTeacherScope` hook — teachers only see their assigned classes
- **Exam Management**: Create, edit, delete exams; AI question generation
- **Exam Assignment**: Assign exams to specific classes with due dates
- **Grading Interface**: Manual grading for essay questions; view auto-graded objective answers
- **Student Management**: View/manage students within assigned classes
- **Registration Key Generation**: Bulk generate up to 500 keys for assigned classes
- **Resit Management**: Open/close resit windows for specific exams and classes
- **Performance Analytics**: Class performance metrics and trends
- **Chat**: Message system for communication with admin and students
- **Teacher Onboarding Tour**: Role-specific guided walkthrough
- **My Profile Dialog**: View personal details and teaching scope

### Admin Dashboard (`/admin`)

The admin uses `NewAdminDashboard.tsx` with full platform control:

**Features:**
- **School Management**: Create/edit schools with codes, addresses, contact info
- **Class Management**: Create classes within schools; set grade levels
- **Teacher Management**: Approve/reject pending teachers; assign teachers to classes with subjects
- **Student Management**: View all students; bulk operations; link parents; view report cards
- **Exam Management**: Full CRUD on exams; assign to classes; view submissions
- **Registration Key Management**: Generate and export keys as branded PDFs
- **Website Analytics**: Page views, visitor demographics, device breakdowns
- **Announcements**: Create role-targeted announcements with priorities and expiry
- **Resit Management**: Manage resit openings and student requests
- **Notifications**: Send notifications to specific users or roles
- **Performance Portal**: Class-wide metrics with PDF landscape report exports

### Parent Dashboard (`/parent`)

**Features:**
- **Children Overview**: Cards for each linked child with school and class info
- **Performance Stats**: Total attempts, passed exams, average score, pass rate per child
- **Numbered Results List**: All graded exams per child, chronologically ordered with average
- **Chat**: Message system to communicate with teachers and admin
- **Mobile Bottom Nav**: Touch-friendly navigation

---

## 8. Examination Engine

### Exam Lifecycle

```
Create Exam → Add Questions → Assign to Classes → Students Take → Auto/Manual Grade → Results & Analytics
```

### Question Types

| Type | Auto-Graded | Description |
|---|---|---|
| `multiple_choice` | ✅ Yes | 4 options (A-D), single correct answer |
| `true_false` | ✅ Yes | Binary choice, auto-compared |
| `essay` | ❌ No | Free-text response, requires manual or AI grading |
| `short_answer` | ❌ No | Brief text response |

### AI Question Generation

The `generate-questions` edge function uses Lovable AI to create exam questions:
- Input: topic description, subject, grade level, question types, number, difficulty
- Output: Structured questions with correct answers and options
- Uses tool calling for reliable structured output

### Exam Taking (`ExamTaking.tsx`)

**Integrity Controls:**
- **Timer**: Calculates remaining time from `started_at` timestamp (prevents reset exploits via refresh)
- **Auto-Submit on Tab Switch**: `visibilitychange` event triggers immediate submission
- **Auto-Submit on Page Exit**: `beforeunload` event attempts submission
- **Progress Persistence**: Answers cached in localStorage via `examOfflineCache.ts`
- **Question Navigation**: Sequential with ability to navigate back; progress bar shows completion
- **Empty Exam Guard**: Requires explicit confirmation before submitting with unanswered questions

**Auto-Grading Logic (`useExamAutoSubmit.ts`):**
1. MCQ and True/False: Case-insensitive string comparison against `correct_answer`
2. Essay questions: Marked as `completed` (not `graded`); awaits manual review
3. If all questions are objective → status set to `graded` immediately
4. If any essay exists → status set to `completed`; `marks_obtained` left null
5. Grade notification sent via `send-grade-notification` edge function

### Results & Certificates

After submission, students see a celebratory results overlay:
- Bold score display with motivational icons
- Pass/fail indicator with percentage
- "Pending Final Score" notice if essays need grading
- Downloadable PDF certificate for passed exams (generated via `ExamCertificate` component using jsPDF)

### Resit System

1. Admin/Teacher opens a resit window for a specific exam + class (`resit_openings` table)
2. Students who failed can submit resit requests (`resit_requests` table)
3. Admin/Teacher reviews and approves/rejects requests
4. Approved students can retake the exam

---

## 9. AI-Powered Features

### AI Question Generation (`generate-questions` Edge Function)
- Takes topic, subject, grade level, question types, count, and difficulty
- Returns structured questions using Lovable AI tool calling
- Supports MCQ, True/False, Essay, and Short Answer types

### AI Essay Grading (`auto-grade-essay` Edge Function)
- Analyzes student essay responses against rubric criteria
- Provides marks and written feedback
- Teacher/Admin can override AI grades

### AI Study Assistant (`AIStudyAssistant.tsx`)
- Chat-based AI tutor integrated into student dashboard
- Supports STEM subject tutoring
- Uses `study-assistant` edge function

### AI Exam Reviews (`generate-exam-reviews` Edge Function)
- Generates personalized review content for completed exams
- Helps students understand mistakes and learn from them

---

## 10. School & Class Management

### Schools (`SchoolManagement.tsx`)

Schools are the top-level organizational unit:

| Field | Description |
|---|---|
| `name` | School name (e.g., "Labone SDA Church School") |
| `code` | Unique short code (e.g., "LABONE") — used in key generation |
| `address`, `city`, `country` | Location details |
| `phone`, `email` | Contact information |
| `status` | `active` or `inactive` |

### Classes

Classes belong to schools and organize students:

| Field | Description |
|---|---|
| `name` | Class name (e.g., "5 Rose") |
| `school_id` | FK to schools table |
| `grade_level` | Grade identifier |
| `status` | `active` or `inactive` |

### Teacher-Class Assignments (`teacher_class_assignments`)

The pivotal linking table that controls teacher scope:

| Field | Description |
|---|---|
| `teacher_id` | FK to teachers |
| `class_id` | FK to classes |
| `subject` | The subject the teacher teaches in this class |
| `assigned_by` | Admin who made the assignment |

**Important**: A teacher can be assigned to multiple classes, and multiple teachers can be assigned to the same class for different subjects.

---

## 11. Teacher Management

### Teacher Lifecycle

```
Registration → Pending Approval → Admin Reviews → Approved/Rejected
```

- **Pending State**: Teacher sees a blocking screen with ⏳ icon and "Account Pending Approval" message
- **Rejected State**: Teacher sees ❌ icon and "Account Not Approved" message
- **Both states include a Sign Out button** to prevent session trapping

### Teacher Approval (`approve-teacher` Edge Function)
- Admin calls with teacher ID and decision (approve/reject)
- Updates teacher `status`, sets `approved_by` and `approved_at`

### Teacher Scope (`useTeacherScope` Hook)

Returns:
- `scopedClassIds`: Array of class UUIDs the teacher is assigned to (null for admins = no restriction)
- `assignments`: Enriched array with class names and school names
- `isScoped`: Boolean indicating whether filtering is active

All teacher-facing components use this hook to filter data to only their assigned classes.

---

## 12. Parent Portal

### Account Creation
Parents don't self-register. Accounts are created:
1. **Automatically** when a student registers with parent email
2. **Manually** by admin via "Create Parent Account" or "Link Parent" features

### Credentials Delivery
- **Email**: Via Resend API with login credentials
- **SMS**: Via Arkesel API (optional, if phone number provided)
- **Resend**: Admin can resend credentials via `resend-parent-credentials` edge function

### Parent-Student Linking
- Students have a `parent_id` field in the `students` table
- The `get_student_parent_id()` database function enables RLS for parent data access
- "Missing Parent" alerts highlight students without linked parents

### Forgot Credentials
Parents use "Forgot Credentials" which triggers `reset-parent-password` edge function:
- Generates a new password
- Emails the new credentials

---

## 13. Notification System

### In-App Notifications (`notifications` table)

| Field | Description |
|---|---|
| `user_id` | Target user |
| `title` | Notification title |
| `message` | Notification body |
| `type` | `info`, `success`, `warning`, `error` |
| `link` | Optional deep link |
| `is_read` | Read status |

### Notification Bell (`NotificationBell.tsx`)
- Displays unread count badge
- Dropdown with recent notifications
- Mark as read functionality

### Announcements (`announcements` table)
- Platform-wide or role-targeted messages
- Priority levels: `normal`, `high`
- Optional expiry dates
- Visible to matching roles via RLS policy

### External Notifications
- **Grade Notifications**: `send-grade-notification` edge function sends email/SMS when exams are graded
- **Exam Assignment Notifications**: `notify-exam-assigned` edge function alerts students of new assignments

---

## 14. Analytics & Reporting

### Website Analytics (`WebsiteAnalytics.tsx` + `page_views` table)

Tracked automatically via `usePageTracking` hook:
- Page views and session duration
- Browser, OS, device type detection
- Geographic data (country, city)
- Referrer tracking
- Custom event tracking

### Student Performance Analytics

**Per-Student Metrics:**
- Total exams attempted
- Pass count and pass rate
- Average score (percentage-based, normalized across different exam totals)
- Individual test scores (numbered chronologically)

**Class-Level Metrics (ClassPerformancePortal):**
- Class average scores
- Score distribution
- Subject-wise breakdown
- Exportable as landscape PDF reports

### Exam Analytics (`ExamAnalytics.tsx`)
- Submission tracker with real-time statuses
- Completion rates per class
- Score distributions via charts (Recharts)

### Report Cards (`StudentReportCard.tsx`)
- Comprehensive student profiles
- Numbered exam history with pass/fail indicators
- Average score summary
- Exportable as PDF

### Export Utilities (`exportUtils.ts`)
- CSV export for data tables
- PDF generation with branded headers (jsPDF)
- Registration key PDF with professional formatting

---

## 15. Gamification

### Student Gamification (`StudentGamification.tsx`)

**XP System:**
- Earn XP for completing exams, passing, and streaks
- Level progression with milestones

**Badges:**
- Achievement-based rewards (first exam, perfect score, etc.)
- Visual badge display on dashboard

**Streaks:**
- Consecutive day activity tracking
- Streak counter with motivational messaging

---

## 16. Offline Support

### Exam Offline Cache (`examOfflineCache.ts`)

The system uses localStorage to protect against network drops during exams:

| Function | Purpose |
|---|---|
| `cacheExamData()` | Stores exam questions and metadata (24-hour TTL) |
| `cacheAnswers()` | Stores current answers and question index |
| `queuePendingSync()` | Queues failed answer saves for later sync |
| `getPendingSync()` | Retrieves queued saves |
| `onNetworkRestore()` | Registers callback for when connectivity returns |
| `isOnline()` | Checks `navigator.onLine` status |

### Behavior During Network Loss
1. Answers continue to be cached in localStorage
2. When network returns, pending syncs are flushed to the server
3. Exam timer continues based on `started_at` timestamp (server-authoritative)

---

## 17. Database Schema

### Entity Relationship Overview

```
schools ──< classes ──< students ──< exam_attempts ──< exam_answers
                │              │
                │              └──> parents
                │
                └──< teacher_class_assignments ──> teachers
                │
                └──< registration_keys
                │
                └──< exam_class_assignments ──> exams ──< exam_questions
                │
                └──< resit_openings
                └──< resit_requests
```

### Table Summary (20 Tables)

| Table | Rows Purpose | RLS |
|---|---|---|
| `schools` | School entities with codes | Admins: ALL; Teachers: ALL; Public: SELECT active |
| `classes` | Classes within schools | Admins: ALL; Teachers: ALL; Public: SELECT active |
| `students` | Student profiles | Admins/Teachers: ALL; Students: own; Parents: linked children |
| `parents` | Parent profiles | Admins/Teachers: ALL; Parents: own; Students: linked parent |
| `teachers` | Teacher profiles | Admins: ALL; Teachers: own |
| `user_roles` | Role assignments (ENUM) | Admins: ALL+SELECT; Teachers: SELECT; Users: own SELECT |
| `user_preferences` | Theme, language, notifications | Users: own INSERT/UPDATE/SELECT |
| `exams` | Exam definitions | Admins/Teachers: ALL; Students/Parents: SELECT active |
| `exam_questions` | Questions per exam | Admins/Teachers: ALL; Students: SELECT (active exams) |
| `exam_attempts` | Student exam sessions | Admins/Teachers: ALL; Students: own; Parents: children's |
| `exam_answers` | Individual question responses | Admins/Teachers: SELECT+UPDATE; Students: own CRUD |
| `exam_class_assignments` | Exam→Class links with due dates | Admins/Teachers: ALL; Students/Parents: own class SELECT |
| `registration_keys` | Temporary signup keys | Admins/Teachers: ALL; Public: SELECT available |
| `teacher_class_assignments` | Teacher→Class→Subject links | Admins: ALL; Teachers: own SELECT |
| `resit_openings` | Resit windows | Admins/Teachers: ALL; Students: own class SELECT |
| `resit_requests` | Student resit applications | Admins/Teachers: ALL; Students: own |
| `notifications` | In-app notifications | Admins/Teachers: ALL; Users: own SELECT+UPDATE |
| `announcements` | Platform announcements | Admins/Teachers: ALL; Users: SELECT matching role |
| `messages` | Chat messages | Admins/Teachers: ALL; Users: own SELECT+INSERT |
| `contact_submissions` | Public contact form | Admins: SELECT+DELETE; Public: INSERT |
| `newsletter_subscribers` | Newsletter signups | Admins: ALL; Public: INSERT |
| `page_views` | Website analytics | Admins: SELECT+DELETE; Public: INSERT |
| `password_reset_tokens` | Reset token storage | Admins only |

### Database Functions

| Function | Purpose |
|---|---|
| `has_role(user_id, role)` | Check if user has specific role (SECURITY DEFINER) |
| `is_admin_or_teacher(user_id)` | Check for either elevated role |
| `get_student_parent_id(user_id)` | Get parent_id for a student |
| `get_teacher_class_ids(user_id)` | Get all class IDs assigned to a teacher |
| `handle_new_user()` | Trigger: auto-create user_preferences on signup |
| `update_updated_at_column()` | Trigger: auto-update timestamps |

---

## 18. Edge Functions (Backend)

All edge functions run on Deno with `verify_jwt = false` for flexible token handling.

| Function | Purpose | Trigger |
|---|---|---|
| `register` | Standard student registration | Auth form submission |
| `register-with-key` | Student ID-based registration | Student ID signup form |
| `register-teacher` | Teacher registration (pending) | Teacher signup form |
| `login` | Custom login with role validation | Login form |
| `approve-teacher` | Admin approves/rejects teacher | Admin dashboard action |
| `create-admin` | Bootstrap admin account | Admin setup page |
| `create-parent-account` | Auto-create parent during registration | Student registration |
| `resend-parent-credentials` | Re-email parent login details | Admin action |
| `reset-parent-password` | Generate new parent password | Forgot credentials form |
| `delete-student` | Remove student and cleanup | Admin action |
| `generate-questions` | AI exam question creation | Exam builder |
| `auto-grade-essay` | AI essay grading | Grading interface |
| `generate-exam-reviews` | AI review content | Post-exam review |
| `study-assistant` | AI tutor chat | Student dashboard |
| `send-grade-notification` | Email/SMS grade alerts | Post-grading |
| `notify-exam-assigned` | Alert students of new exams | Exam assignment |
| `generate-pdf-report` | Server-side PDF generation | Report exports |
| `process-exam-pdf` | Parse uploaded exam PDFs | Exam import |

### Edge Function Secrets

| Secret | Service |
|---|---|
| `SUPABASE_URL` | Backend URL |
| `SUPABASE_ANON_KEY` | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key |
| `SUPABASE_DB_URL` | Direct DB connection |
| `RESEND_API_KEY` | Email delivery |
| `ARKESEL_API_KEY` | SMS delivery |
| `LOVABLE_API_KEY` | AI model access |

---

## 19. Security Architecture

### Row-Level Security (RLS)

Every table has RLS enabled with granular policies:

- **Admin**: Full access to all tables via `has_role(auth.uid(), 'admin')`
- **Teacher**: Full access to most tables via `has_role(auth.uid(), 'teacher')` (application-level scoping via `useTeacherScope` further restricts to assigned classes)
- **Student**: Read/write own data only, verified via `user_id = auth.uid()` or subqueries
- **Parent**: Read-only access to linked children's data via `parent_id` join

### Authentication Security

- **No anonymous signups** — all registration goes through edge functions
- **Email verification** required (unless explicitly disabled)
- **Password minimum**: 6 characters
- **Role validation on login**: After authentication, the system verifies the user has the correct role in `user_roles` before granting access
- **Session tokens**: Managed by Supabase Auth with automatic refresh
- **Stale token cleanup**: Invalid refresh tokens are detected and localStorage is cleared

### Exam Integrity

- **Tab switching = immediate auto-submit**: Prevents cheating via switching tabs
- **Page close/refresh = auto-submit attempt**: Uses `beforeunload` event
- **Server-authoritative timer**: Time remaining calculated from `started_at` (prevents client-side manipulation)
- **Atomic answer persistence**: Upsert pattern prevents data loss

### Data Access Patterns

- **SECURITY DEFINER functions** bypass RLS to prevent recursive policy evaluation
- **Service role key** used only in edge functions (never exposed to client)
- **Anon key** used in client-side Supabase client (safe to expose)

---

## 20. File Structure

```
src/
├── App.tsx                          # Main router with lazy loading
├── main.tsx                         # Entry point
├── index.css                        # Design system tokens (HSL variables)
├── contexts/
│   └── AuthContext.tsx               # Central authentication state
├── components/
│   ├── ProtectedRoute.tsx            # Role-based route gating
│   ├── Navbar.tsx                    # Navigation bar
│   ├── Footer.tsx                    # Site footer
│   ├── AIStudyAssistant.tsx          # AI tutor chat
│   ├── ChatBubble.tsx                # Messaging interface
│   ├── ExamCertificate.tsx           # PDF certificate generator
│   ├── MobileBottomNav.tsx           # Mobile navigation
│   ├── NotificationBell.tsx          # Notification dropdown
│   ├── OnboardingTour.tsx            # Student onboarding
│   ├── TeacherOnboardingTour.tsx     # Teacher onboarding
│   ├── StudentGamification.tsx       # XP, badges, streaks
│   ├── TeacherDashboard.tsx          # Teacher-specific dashboard
│   ├── VoiceSelectionDialog.tsx      # TTS voice picker
│   ├── ErrorBoundary.tsx             # Error recovery wrapper
│   ├── auth/
│   │   └── StudentRegistration.tsx   # Standard registration form
│   ├── admin/
│   │   ├── SchoolManagement.tsx      # CRUD for schools
│   │   ├── StudentManagement.tsx     # Student roster + operations
│   │   ├── TeacherManagement.tsx     # Teacher approval + assignments
│   │   ├── ExamAssignment.tsx        # Assign exams to classes
│   │   ├── RegistrationKeyManagement.tsx  # Bulk key generation
│   │   ├── ClassPerformancePortal.tsx     # Class metrics + reports
│   │   ├── ClassAssessmentReport.tsx      # Assessment analytics
│   │   ├── StudentReportCard.tsx     # Individual report cards
│   │   ├── StudentPerformanceTable.tsx    # Performance data table
│   │   ├── ResitManagement.tsx       # Resit windows + requests
│   │   └── WebsiteAnalytics.tsx      # Page view analytics
│   └── ui/                           # shadcn/ui components (40+ files)
├── pages/
│   ├── Index.tsx                     # Landing page
│   ├── Auth.tsx                      # Login/Register (all roles)
│   ├── Dashboard.tsx                 # Student dashboard
│   ├── AdminDashboard.tsx            # Teacher dashboard wrapper
│   ├── NewAdminDashboard.tsx         # Admin dashboard
│   ├── ParentDashboard.tsx           # Parent dashboard
│   ├── ExamTaking.tsx                # Exam interface
│   ├── ExamQuestions.tsx             # Question management
│   ├── ExamGrading.tsx               # Manual grading interface
│   ├── ExamAnalytics.tsx             # Submission analytics
│   └── ExamReview.tsx                # Post-exam review
├── hooks/
│   ├── useTeacherScope.ts            # Teacher class scoping
│   ├── useExamAutoSubmit.ts          # Auto-submit on tab switch
│   ├── usePageTracking.ts            # Analytics tracking
│   ├── useReadingAssistant.ts        # Text-to-speech
│   └── use-mobile.tsx                # Mobile detection
├── lib/
│   ├── examUtils.ts                  # Shared exam types & functions
│   ├── examOfflineCache.ts           # Offline answer persistence
│   ├── exportUtils.ts                # CSV/PDF export helpers
│   └── utils.ts                      # Tailwind merge utility
└── integrations/supabase/
    ├── client.ts                     # Supabase client (auto-generated)
    └── types.ts                      # Database types (auto-generated)

supabase/
├── config.toml                       # Supabase configuration
└── functions/
    ├── register/                     # Student registration
    ├── register-with-key/            # Student ID registration
    ├── register-teacher/             # Teacher registration
    ├── login/                        # Custom login
    ├── approve-teacher/              # Teacher approval
    ├── create-admin/                 # Admin bootstrap
    ├── create-parent-account/        # Parent creation
    ├── delete-student/               # Student deletion
    ├── resend-parent-credentials/    # Re-email parent creds
    ├── reset-parent-password/        # Parent password reset
    ├── generate-questions/           # AI question generation
    ├── auto-grade-essay/             # AI essay grading
    ├── generate-exam-reviews/        # AI exam reviews
    ├── study-assistant/              # AI tutor
    ├── send-grade-notification/      # Grade email/SMS
    ├── notify-exam-assigned/         # Assignment alerts
    ├── generate-pdf-report/          # Server PDF generation
    └── process-exam-pdf/             # PDF exam import
```

---

## 21. Configuration & Environment

### Environment Variables (`.env` — auto-managed)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier |

### Tailwind Configuration (`tailwind.config.ts`)

Custom design system with:
- STEM subject colors (`--stem-science`, `--stem-technology`, etc.)
- Semantic tokens (`--primary`, `--secondary`, `--accent`, etc.)
- Dark/light mode support via CSS variables
- Custom animations (fade-in, slide-up, etc.)

### Build Configuration (`vite.config.ts`)

- SWC-based React plugin for fast builds
- Path aliases (`@/` → `src/`)
- Development server on port 8080

### Query Client Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 30,       // 30 minutes
      refetchOnWindowFocus: false,   // Prevent unnecessary refetches
      retry: 1,                      // Single retry on failure
    },
  },
});
```

---

## Appendix A: Common Operations

### Adding a New School
1. Admin → Schools tab → "Add School"
2. Enter name, code, address, contact info
3. School appears in all dropdowns system-wide

### Enrolling Students via Keys
1. Admin/Teacher → Registration Keys tab
2. Select school + class
3. Generate keys (up to 500 at once)
4. Export as PDF
5. Distribute keys to students
6. Students sign up at `/auth` → "Sign Up with Student ID"

### Creating and Assigning an Exam
1. Admin/Teacher → Exams tab → "Create Exam"
2. Fill exam details (title, subject, grade, duration, marks)
3. Add questions manually or via AI generation
4. Go to Exam Assignment tab
5. Select exam → Select class → Set due date → Assign
6. Students see the exam on their dashboard

### Grading an Essay Exam
1. Admin/Teacher → Submissions tab
2. Find "Completed" attempts (pending grading)
3. Click grade icon → Opens grading interface
4. Review each essay answer
5. Optionally use AI grading as suggestion
6. Enter marks and feedback
7. Submit grades → Student notified via email/SMS

---

*This documentation is auto-generated and maintained alongside the codebase. For the latest updates, refer to the source code and Lovable project settings.*
