

# Fix Exam Redirect and Missing Questions Issues

## Problems Found

### 1. Victoria's Redirect Issue (ExamTaking.tsx)
The `ExamTaking` page has the **same auth race condition** we fixed in Dashboard. On line 172, it checks `if (!user)` but does NOT check `loading`. When a student navigates to `/exam/take?attempt=...`, the auth context hasn't finished loading yet, so `user` is `null` and the page immediately redirects to `/dashboard`, which in turn may redirect to `/auth`.

The same bug exists in `ExamQuestions.tsx` and `ExamGrading.tsx` (admin pages) -- they check `user` and `role` without waiting for `loading` to finish.

### 2. "No Questions Found" for BALLOON CAR Exam
The exam titled **"1st ASSESSMENT TEST (BALLOON CAR)"** (id: `14a435a1-...`) has **0 questions** in the database. This is a duplicate/incomplete exam -- the correct one is **"1st ASSESSMENT TEST (DIY BALLOON CAR)"** which has 30 questions. This is a data issue, not a code bug. The admin likely created the exam but never added questions to it.

## Changes

### 1. Fix ExamTaking Auth Guard (File: `src/pages/ExamTaking.tsx`)

Add `loading` from `useAuth()` and gate the redirect on `loading` being false:

```
const { user, loading: authLoading } = useAuth();

useEffect(() => {
  if (authLoading) return; // wait for auth to resolve
  if (!user || !attemptId) {
    navigate('/dashboard');
    return;
  }
  loadExamData();
}, [user, authLoading, attemptId, navigate]);
```

Also gate the loading spinner to show while `authLoading` is true.

### 2. Fix ExamQuestions Auth Guard (File: `src/pages/ExamQuestions.tsx`)

Add `loading` from `useAuth()` and wait for it:

```
const { user, role, loading: authLoading } = useAuth();

useEffect(() => {
  if (authLoading) return;
  if (!user || role !== 'admin') {
    navigate('/admin');
    return;
  }
  loadData();
}, [user, role, authLoading, examId, navigate]);
```

### 3. Fix ExamGrading Auth Guard (File: `src/pages/ExamGrading.tsx`)

Same pattern -- add `authLoading` check before the redirect.

### 4. Improve "No Questions" UX (File: `src/pages/ExamTaking.tsx`)

Instead of silently redirecting to dashboard when no questions are found, show a clearer error message so students know the exam has no questions yet and they should contact their teacher.

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/ExamTaking.tsx` | Add `loading` check to auth guard so it waits for session before redirecting; improve no-questions error message |
| `src/pages/ExamQuestions.tsx` | Add `loading` check to auth guard |
| `src/pages/ExamGrading.tsx` | Add `loading` check to auth guard |

## Data Note
The "BALLOON CAR" exam with 0 questions is a separate exam entry from "DIY BALLOON CAR" (which has 30 questions). The admin should either add questions to it or delete the empty exam to avoid student confusion.

