

# Plan: Fix Parent Authentication + Add Student Onboarding Tour

## Part 1: Parent Authentication Fix

### Root Cause Analysis

After thorough investigation, the parent auth data is correctly set up in the database:
- 3 parent accounts exist with proper `user_roles` entries (role = 'parent')
- Parent profiles exist in the `parents` table with matching `user_id`
- RLS policies are correctly configured for parents to read their own roles and profiles
- `exam_attempts` RLS also correctly allows parents to view children's attempts

The likely failure points are:

1. **Password mismatch**: Parent passwords are auto-generated during student registration and reset every time a sibling registers with the same parent email. If the parent doesn't use the emailed/displayed password, login fails silently with "Invalid email or password."

2. **Session race condition**: After `signInWithPassword` succeeds, `AuthContext.onAuthStateChange` fires and calls `loadUserData`. Simultaneously, the `handleLogin` function in `Auth.tsx` queries `user_roles` with retry logic. If `loadUserData` sets the role and triggers the redirect `useEffect` before `handleLogin` finishes its retries, the redirect and the login handler can conflict -- in some cases, the handler might call `signOut()` after the redirect already navigated the user.

3. **No parent-specific password recovery on the login page**: Parents have no way to recover credentials from the login screen itself; the only recovery mechanism (resend-parent-credentials) requires a student to be logged in.

### Fixes

#### Fix 1: Eliminate race condition in Auth.tsx login handler

Prevent the `useEffect` redirect from firing during an active login by adding a `loginInProgress` ref. This ensures only the `handleLogin` function controls the navigation after login.

#### Fix 2: Add "Forgot Password" flow for parents on the Auth page

Add a "Forgot your credentials?" link on the parent login tab that shows a small form where parents can enter their email. This calls a new edge function `reset-parent-password` that:
- Verifies the email belongs to a parent account
- Generates a new password
- Emails the new credentials to the parent
- Uses the service role key (no auth required)

#### Fix 3: Improve error messaging for parent login

Add specific error messages when parent login fails:
- "Invalid email or password. If you forgot your auto-generated password, use 'Resend Credentials' below."
- Show the parent's access code hint if available

#### Fix 4: Create `reset-parent-password` edge function

A new edge function that:
- Accepts `{ email: string }`
- Checks `parents` table for a matching email
- Generates a new password and updates the auth user
- Sends an email with the new credentials via Resend API
- Returns success/failure

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/Auth.tsx` | Modify | Add `loginInProgress` ref to prevent redirect race; add "Forgot credentials" UI for parents |
| `supabase/functions/reset-parent-password/index.ts` | Create | New edge function for parent password recovery |
| `supabase/config.toml` | Modify (auto) | Add `verify_jwt = false` for new function |

---

## Part 2: Student Onboarding Tour

### Design

A step-by-step guided tour overlay that highlights key dashboard elements for first-time students.

**Tour Steps:**
1. **Welcome** - "Welcome to your STEM Dashboard! Let us show you around."
2. **Profile Card** - "This is your profile. View your name, school, and grade here."
3. **Stats Cards** - "Track your progress: exams taken, passed, average score, and available exams."
4. **Available Exams** - "Browse and register for available STEM exams here."
5. **Exam History** - "View your past exam results, scores, and certificates."
6. **Parent Info Card** - "Share these credentials with your parent so they can monitor your progress."

**Behavior:**
- Auto-starts on first login (tracked via `user_preferences.onboarding_completed` flag)
- Skippable at any time
- "Take Tour Again" button on the dashboard header
- Uses a spotlight/tooltip overlay pattern (no external library -- custom built with Tailwind)

### Implementation

**Tour Component**: A reusable `OnboardingTour` component that:
- Accepts an array of step definitions (target element ID, title, description, position)
- Renders a backdrop overlay with a cutout around the target element
- Shows a tooltip with step info, "Next", "Skip", and progress dots
- Uses `getBoundingClientRect()` to position the spotlight
- Animates transitions between steps

**Persistence**: Add `onboarding_completed` column to `user_preferences` table.

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/OnboardingTour.tsx` | Create | Reusable tour overlay component |
| `src/pages/Dashboard.tsx` | Modify | Add tour step target IDs to key elements; integrate OnboardingTour; add "Take Tour" button |
| Database migration | Create | Add `onboarding_completed` boolean column to `user_preferences` |

---

## Technical Details

### Auth.tsx Race Condition Fix

```typescript
const loginInProgressRef = useRef(false);

useEffect(() => {
  if (!authLoading && user && role && !loginInProgressRef.current) {
    // Only auto-redirect if not in the middle of a login
    if (role === 'admin') navigate('/admin');
    else if (role === 'parent') navigate('/parent');
    else navigate('/dashboard');
  }
}, [user, role, authLoading, navigate]);

const handleLogin = async (e, userType) => {
  e.preventDefault();
  loginInProgressRef.current = true;
  setLoading(true);
  try {
    // ... existing signIn + role check logic ...
    // Navigate on success
    navigate(userType === 'admin' ? '/admin' : userType === 'parent' ? '/parent' : '/dashboard');
  } catch (error) {
    // ... error handling ...
  } finally {
    setLoading(false);
    loginInProgressRef.current = false;
  }
};
```

### Reset Parent Password Edge Function

```typescript
// Accepts { email } -> verifies parent -> generates new password -> emails it
// Uses SUPABASE_SERVICE_ROLE_KEY to update auth user
// Uses RESEND_API_KEY to send email
// No JWT required (configured in config.toml)
```

### Onboarding Tour Component

```typescript
interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Renders: backdrop overlay + spotlight cutout + tooltip
// Uses ResizeObserver for responsive positioning
// Controlled via currentStep state
// On completion: updates user_preferences.onboarding_completed = true
```

### Database Migration

```sql
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
```

---

## Implementation Order

1. Database migration (add `onboarding_completed` column)
2. Fix `Auth.tsx` race condition with `loginInProgressRef`
3. Create `reset-parent-password` edge function
4. Add "Forgot credentials" UI to parent login tab
5. Create `OnboardingTour` component
6. Integrate tour into `Dashboard.tsx`
7. Deploy edge functions and test end-to-end

