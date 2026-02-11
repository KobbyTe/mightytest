
# Fix Platform Speed and Login Redirect Issues

## Problems Identified

1. **Artificial delay in login**: The role verification loop waits 200ms before even the FIRST attempt, then 400ms and 600ms for retries -- adding up to 1.2 seconds of unnecessary wait time on every login.

2. **Dashboard redirects back to /auth**: After login, the user navigates to `/dashboard`. But the Dashboard's redirect logic runs `if (!user) navigate('/auth')` before AuthContext has finished loading the session. The `loading` state can briefly be `false` while the auth listener hasn't fired yet, causing a flash redirect back to the auth page.

3. **Sequential data loading**: AuthContext loads role/profile first, THEN Dashboard starts loading its own data (exams, parent info). These could overlap.

4. **Large hero video**: The video is UHD (2560x1440) which is unnecessarily large and slows down the homepage.

## Changes

### 1. Speed Up Role Verification in Login (File: `src/pages/Auth.tsx`)

- Remove the artificial delay before the FIRST role verification attempt -- query immediately after sign-in
- Only apply backoff delay on retry attempts (2nd and 3rd)
- This alone saves 200-600ms on every login

### 2. Fix Dashboard Redirect Race Condition (File: `src/pages/Dashboard.tsx`)

- Change the redirect logic from:
  ```
  if (loading) return;
  if (!user) navigate('/auth');
  ```
  To:
  ```
  if (loading) return; // still loading, do nothing
  if (!user) navigate('/auth'); // only redirect when loading is definitively done AND no user
  ```
- The real fix: also gate on `role` being resolved. Currently, `loading` becomes `false` when `loadUserData` finishes, but there's a window where `onAuthStateChange` fires, sets `user`, but `loadUserData` hasn't finished yet -- so `role` is null. The redirect should only happen when `loading` is false AND there's no user. If user exists but role is null, we should wait, not redirect.
- Updated logic:
  ```
  if (loading) return;
  if (!user) { navigate('/auth'); return; }
  if (role && role !== 'student') { /* redirect to correct dashboard */ }
  // If user exists but role is still null, just wait (loadUserData is in progress)
  ```

### 3. Prevent Dashboard Data-Load Spinner When Auth Is Already Cached (File: `src/pages/Dashboard.tsx`)

- Initialize `loadingData` as `true` but immediately check if profile is already available from the AuthContext cache
- Start loading dashboard data as soon as `profile?.id` is available, without waiting for a re-render cycle

### 4. Remove Redundant First-Attempt Delay in Auth (File: `src/pages/Auth.tsx`)

- Change the retry loop so the first query fires immediately (no `setTimeout`), and only retries 2 and 3 have the backoff

### 5. Optimize Hero Video Size (File: `src/components/Hero.tsx`)

- Switch from UHD (2560x1440) to a smaller HD version of the same Pexels video, or use `poster` attribute + `preload="none"` so the video doesn't block page load
- Add `preload="none"` and a `poster` frame so the page renders instantly with the gradient fallback, then the video loads in the background

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Remove 200ms delay before first role check; only backoff on retries |
| `src/pages/Dashboard.tsx` | Fix redirect logic to not bounce to /auth when role is still loading; wait for role to resolve before redirecting |
| `src/components/Hero.tsx` | Add `preload="none"` to video element; use smaller resolution video URL |

## Expected Impact

- Login to dashboard load time reduced by ~1-2 seconds
- Eliminates the "bounce back to auth page" bug entirely
- Homepage loads faster with deferred video loading
