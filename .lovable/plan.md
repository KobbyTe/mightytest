

## Fix Plan: Complete Auth System Debugging for Vercel Deployment

### Issues Identified

Based on my investigation, here are the problems causing auth failures after Vercel deployment:

---

### Issue 1: Registration Error - "A user with this email address has already been registered"

**Root Cause:** The `register` edge function checks if a student email exists in the `students` table, but it doesn't account for cases where:
1. The email exists in `auth.users` but NOT in the `students` table (e.g., failed registration cleanup)
2. The student email check passes but the auth user creation fails with `email_exists`

**Current Code Problem (register/index.ts line 120):**
```typescript
// Creates user but doesn't handle email_exists error properly for students
const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({...})
```

**Fix:** Add proper handling for existing student auth users similar to how parent accounts are handled.

---

### Issue 2: Refresh Token Error - "Invalid Refresh Token: Refresh Token Not Found"

**Root Cause:** This happens when:
1. A session exists in localStorage but the refresh token has expired/been revoked on the server
2. Common after clearing server-side sessions or when switching between environments

**Current Code:** The `AuthContext.tsx` doesn't handle this error gracefully - it logs it but doesn't clear the stale session.

**Fix:** Add error handling in AuthContext to clear localStorage when refresh token is invalid.

---

### Issue 3: Session Propagation Delay on Vercel

**Root Cause:** Network latency on Vercel means the 150ms delay in Auth.tsx might not be enough for the RLS context to propagate.

**Current Code (Auth.tsx line 54):**
```typescript
await new Promise(resolve => setTimeout(resolve, 150));
```

**Fix:** Increase delay and add retry logic for role verification.

---

### Issue 4: Parent Profile Query Returning Empty

**Root Cause:** When loading parent info, the query searches by `user_id` but the student's `parent_id` references the parent's profile `id`, not `user_id`. The existing code at Dashboard.tsx line 101-105 is correct, but there's a disconnect when the parent profile wasn't created properly during registration.

---

### Implementation Plan

#### Step 1: Fix Register Edge Function

Update `supabase/functions/register/index.ts`:

1. Add handling for student `email_exists` error (similar to parent handling)
2. If student auth user exists but no student profile, delete the orphan auth user and retry
3. Add better error messages for debugging

Key changes:
- Check for `email_exists` error code on student auth creation
- Attempt to find orphan auth user and clean up
- Log detailed information for debugging

#### Step 2: Fix AuthContext Refresh Token Handling

Update `src/contexts/AuthContext.tsx`:

1. Add error handling in the auth state listener for refresh token errors
2. Clear stale session data when refresh token is invalid
3. Add a recovery mechanism that redirects to login

Key changes:
- Wrap session refresh in try-catch
- Clear localStorage on specific error codes (`refresh_token_not_found`)
- Force sign out on irrecoverable auth errors

#### Step 3: Improve Login Session Propagation

Update `src/pages/Auth.tsx`:

1. Increase session propagation delay from 150ms to 300ms
2. Add retry logic for role verification (3 attempts with 200ms between)
3. Add better error messages for specific failure cases

Key changes:
- Retry loop for role check
- Exponential backoff
- Clear error feedback to users

#### Step 4: Add Vercel Environment Variable Validation

Update `src/integrations/supabase/client.ts`:

1. Add runtime validation that environment variables are set
2. Log helpful error if Supabase URL is missing (common Vercel misconfiguration)

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/register/index.ts` | Handle student email_exists error, cleanup orphan auth users |
| `src/contexts/AuthContext.tsx` | Handle refresh token errors, clear stale sessions |
| `src/pages/Auth.tsx` | Increase delay, add retry logic for role verification |

---

### Vercel Environment Variables Checklist

After these code changes, ensure your Vercel project has these environment variables set:

1. `VITE_SUPABASE_URL` = `https://kzxqhtdxjyuktrghzmsp.supabase.co`
2. `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key)
3. `VITE_SUPABASE_PROJECT_ID` = `kzxqhtdxjyuktrghzmsp`

Then redeploy the project from Vercel dashboard.

---

### Technical Details

#### Register Edge Function Fix

```typescript
// Handle case where student email exists in auth but not in students table
if (authError?.code === 'email_exists') {
  // Try to find if there's an orphan auth user (exists in auth but not in students)
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const orphanUser = existingUsers?.users?.find(u => u.email === email);
  
  if (orphanUser) {
    // Check if student profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('user_id', orphanUser.id)
      .maybeSingle();
    
    if (!existingProfile) {
      // Orphan auth user - delete and retry
      await supabaseAdmin.auth.admin.deleteUser(orphanUser.id);
      // Retry creation...
    }
  }
}
```

#### AuthContext Refresh Token Fix

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // Token refresh failed - clear stale data
    localStorage.removeItem('sb-kzxqhtdxjyuktrghzmsp-auth-token');
    setUser(null);
    setSession(null);
    clearUserState();
    setLoading(false);
    return;
  }
  // ... rest of handler
});
```

#### Login Retry Logic Fix

```typescript
// Retry role verification with backoff
let roleData = null;
let attempts = 0;
const maxAttempts = 3;

while (!roleData && attempts < maxAttempts) {
  await new Promise(resolve => setTimeout(resolve, 200 * (attempts + 1)));
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('role', userType)
    .maybeSingle();
  
  if (!error && data) {
    roleData = data;
    break;
  }
  attempts++;
}

if (!roleData) {
  await supabase.auth.signOut();
  throw new Error(`Unable to verify ${userType} role after ${maxAttempts} attempts`);
}
```

---

### Summary

This plan addresses:

1. Registration failures due to orphan auth users
2. Refresh token errors causing login loops
3. Session propagation delays on Vercel's network
4. Proper error handling and user feedback

After implementation, the auth system should work reliably on both preview and Vercel production environments.

