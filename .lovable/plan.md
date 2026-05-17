
# Plan: Mutually Exclusive Review / Resit Lock

Prevent students from seeing the correct answers of an exam and then resitting it (or vice-versa). The student picks one path per exam, enforced both in the UI and at the database level.

## Rules Enforced

For each (student, exam) pair:
- If the student **opens Review** on any attempt → all future resit requests for that exam are blocked.
- If the student **has a pending/approved resit request OR an in-progress resit attempt** → Review of the original attempt is blocked.
- Once the resit attempt is **submitted**, Review of *both* attempts becomes available (no further resit is possible — single-resit system already exists).
- Admin can override either lock from `ResitManagement`.

Both actions show a confirmation dialog explaining the consequence before committing.

## Database Changes (migration)

1. Add columns to `exam_attempts`:
   - `review_opened_at timestamptz` — set the first time the student loads ExamReview for that attempt.
2. Add SECURITY DEFINER helpers:
   - `can_review_attempt(_attempt_id uuid) returns boolean` — false if a pending/approved `resit_request` exists for that (student, exam) without a submitted resit attempt, OR if an open `resit_opening` has been claimed and the resit attempt is not yet `completed`/`graded`.
   - `can_request_resit(_student_id uuid, _exam_id uuid) returns boolean` — false if ANY attempt for that (student, exam) has `review_opened_at IS NOT NULL` AND the student has not already been granted/used a resit.
   - `mark_review_opened(_attempt_id uuid) returns void` — sets `review_opened_at = now()` if the caller owns the attempt and `can_review_attempt` is true. Used by the client on first Review load.
3. Tighten RLS on `exam_answers`:
   - Replace the student SELECT policy so it additionally requires `can_review_attempt(attempt_id)` (admins/teachers unaffected).
4. Tighten RLS on `resit_requests`:
   - INSERT policy adds `can_request_resit(student_id, exam_id)` check.

## Frontend Changes

- **`src/pages/ExamReview.tsx`**
  - On mount: call `can_review_attempt`. If false → render a "Review locked — resit in progress" state with explanation, no answers fetched.
  - If true → show a one-time confirmation: *"Opening this review will permanently disable any resit request for this exam. Continue?"* On confirm, call `mark_review_opened`, then load answers as today.
- **Student Dashboard / Resit request button** (in `src/pages/Dashboard.tsx` and any resit-request entry point)
  - Compute `can_request_resit` per exam; disable button with tooltip *"You already reviewed this exam — resit unavailable"* when false.
  - Confirmation dialog on click: *"Requesting a resit will lock the review of your previous attempt until the resit is submitted."*
- **`src/components/admin/ResitManagement.tsx`**
  - Show a "Locked" badge with the reason on requests that were auto-blocked.
  - Add an admin "Force allow" action that inserts the resit request bypassing the check (uses existing admin RLS).

## Out of Scope
- No change to scoring, auto-submit, short-answer flow, AI explanations, or grading.
- No change to teacher/admin visibility of any answers.

## Technical Details

```text
Student flow per exam:
  ┌─ completed attempt ─┐
  │                     │
  ▼                     ▼
[Review] ──locks──> resit blocked forever
[Request Resit] ──locks──> review blocked until resit submitted
                          └─ after resit submitted: review of both unlocks
```

RLS enforcement is the source of truth; UI checks are for UX only. Even if a student crafts a direct query, `exam_answers` SELECT will fail while a resit is pending, and `resit_requests` INSERT will fail after review.
