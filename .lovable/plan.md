

# Fix: Student Registration Failing on Edge and Other Browsers

## Root Cause

Two separate issues are causing registration failures:

### Issue 1: Orphan Parent Auth Accounts
When a parent email exists in the authentication system but has no corresponding profile in the parents table, registration fails with "Parent email already exists. Please use a different parent email or contact support." This is happening because a test parent account (`parent-cors@example.com`) was created but its profile was never added. The register function handles orphan **student** accounts but does NOT handle orphan **parent** accounts.

### Issue 2: Browser Fetch Reliability
The Supabase JS client's `functions.invoke()` method can fail with "Failed to send a request to the edge function" on Microsoft Edge and other browsers due to:
- Stricter connection handling in Edge
- No retry mechanism for transient network errors
- Poor error messages when the function returns a non-200 status

---

## Fixes

### Fix 1: Handle Orphan Parent Accounts in the Register Function
**File**: `supabase/functions/register/index.ts`

Add orphan parent detection logic (similar to existing orphan student logic). When a parent email exists in auth but has no parents table profile:
1. Delete the orphan auth account
2. Re-create the parent account fresh
3. Continue with normal registration

This ensures stale/test parent accounts never block real registrations.

### Fix 2: Add Retry Logic and Better Error Handling on the Client
**File**: `src/components/auth/StudentRegistration.tsx`

- Wrap the `supabase.functions.invoke('register', ...)` call in a retry helper (up to 2 retries with a short delay)
- Distinguish between network errors ("Failed to fetch") and server errors (400/500 responses)
- Show more descriptive error messages to the user

### Fix 3: Clean Up Orphan Data
Run a one-time cleanup to delete the existing orphan parent auth account that has no profile, so current registrations are unblocked immediately.

---

## Technical Details

### Orphan Parent Handler (register edge function)

When `parentAuthError?.code === 'email_exists'` and no parent profile is found, instead of failing:

```text
1. Look up the existing auth user by email
2. Delete the orphan auth user
3. Re-create the parent auth user with new credentials
4. Continue creating the parent profile as normal
```

### Client Retry Logic

```text
async function invokeWithRetry(fnName, body, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (!error) return { data, error: null };
    if (error.message?.includes('Failed to send') && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    return { data, error };
  }
}
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/register/index.ts` | Add orphan parent detection and cleanup logic in the `email_exists` handler |
| `src/components/auth/StudentRegistration.tsx` | Add retry logic for network failures; improve error messages |

### Data Cleanup

Delete the orphan parent auth account (`parent-cors@example.com`) that has no profile in the parents table, along with the test accounts created during debugging.
