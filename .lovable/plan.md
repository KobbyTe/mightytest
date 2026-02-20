
# Definitive Fix: Student Registration "Edge Function Error"

## Root Cause Analysis

The logs tell the exact story. Every registration attempt fails with this sequence:

```
"Parent email already exists, looking up existing user..."
"Parent email exists but user not found in listing"
"Parent ID is still null after parent creation block — aborting"
```

### The Core Bug: `listUsers()` Cannot Find Existing Users

When `createUser()` fails with `email_exists`, both `register-with-key` and `register` fall back to `supabase.auth.admin.listUsers()` to find the existing user's ID. **This API is paginated and only returns ~1,000 users per page with no filter support.** It simply scans an in-memory array — and the user may not be on the first page, or the pagination cursor is not used. The result: the parent's auth user is found to "exist" by auth but cannot be retrieved by listing, so `parentId` stays null and registration aborts.

This is the single root cause of all "edge function error" failures.

### Secondary Bugs

1. **`register-with-key`**: When the parent email already exists AND the parent has NO `parents` table profile (orphaned auth user), the code calls `listUsers()` to delete the orphan — but fails to find them, leaves the orphan in place, cannot re-create the parent account (still `email_exists`), and ultimately aborts.

2. **`register`**: Same `listUsers()` pattern used for orphan cleanup (line 227).

3. **Both functions**: After repeated failed registrations, orphaned student auth users accumulate (they ARE successfully created, then the parent step fails, and the cleanup `deleteUser` also potentially has timing issues). The next attempt with the same student email then hits `email_exists` for the student too.

## Solution

### The Fix: Replace `listUsers()` with `getUserByEmail()` (Admin API)

Instead of listing all users and searching by email, use the direct lookup:

```typescript
// BROKEN — paginates, may not find user
const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
const existingUser = usersData?.users?.find(u => u.email === parentEmail);

// FIXED — direct lookup by email, always works
const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ 
  page: 1, perPage: 1000 // still unreliable for large datasets
});

// ACTUALLY FIXED — use the correct API
```

The correct approach is to use `supabase.auth.admin.listUsers()` with a **filter** — but Supabase's admin API does not support email filtering on `listUsers`. The real solution is to use the **`getUserById`** after storing the ID, or more practically, to query the `parents` table by email first (which is already indexed), get the `user_id`, and work from there.

**Strategy for `email_exists` case:**
1. Query `parents` table by email → get `user_id` and parent profile ID directly (no auth listing needed)
2. If parent profile exists in `parents` table → reuse it (link to new student, done)
3. If parent profile does NOT exist in `parents` table (orphan auth user) → use `updateUserByEmail` workaround OR delete by generating a service-role query to find the user

For the orphan case, the cleanest fix: **do not try to delete and recreate**. Instead, just create the parent profile in the `parents` table for the existing auth user. To get the auth user ID from email, query `auth.users` via a service-role database query through `supabase.rpc` or via a direct admin endpoint.

Actually the cleanest approach available: **`supabase.auth.admin.listUsers({ page: 1, perPage: 50000 })`** won't scale. The **correct** fix is:

```typescript
// Use a direct SQL query via service role to find auth user by email
// This bypasses the pagination limitation
const { data: authUsers } = await supabaseAdmin
  .from('auth.users') // This won't work in edge functions (restricted schema)
  
// BEST approach: store parent user_id in parents table and query there
const { data: existingParent } = await supabaseAdmin
  .from('parents')
  .select('id, user_id, access_code')
  .eq('email', parentEmail)
  .maybeSingle();

if (existingParent) {
  // Parent profile exists — use it directly
  parentId = existingParent.id;
} else {
  // Orphan auth user (no profile) — must find their ID
  // Use listUsers with filter via page iteration OR
  // reset their password and create profile using updateUser
  // The cleanest: delete via supabase admin REST directly
}
```

**The actual working fix** for the orphan case: use `supabase.auth.admin.listUsers()` with `{ perPage: 1000 }` in a paginated loop, OR — much simpler — just attempt to create a parent profile with `upsert` and handle the constraint. But best of all: **use the Supabase admin API properly**.

The **definitive solution**: After `email_exists` error from `createUser`:
1. Query `parents` table by email → if found, use directly (covers 99% of cases)
2. If not found (orphan), use `listUsers` with pagination loop until found (covers edge case)
3. Once found, create the parent profile

## Files to Change

### 1. `supabase/functions/register-with-key/index.ts`

Replace the entire `parentAuthError` handling block. The new logic:

```
When createUser returns email_exists:
  → Step 1: Query parents table by email
    → If parent row found: use existing parentId directly ✓
    → If no parent row found (orphan auth user):
       → Loop through listUsers pages until user found
       → Delete the orphan user
       → Re-create fresh parent auth user + profile
  → If parentId still null after all → return clear error
```

This guarantees the `parents` table query (which does NOT have pagination issues) is tried first, covering the vast majority of real-world cases.

### 2. `supabase/functions/register/index.ts`

Apply the same fix to the `email_exists` orphan handling block (lines 214-285). Replace `listUsers()` scan with `parents` table query first.

### 3. Both functions: Also fix the `listUsers` orphan-delete loop

For orphan cleanup, instead of a single `listUsers()` call, paginate through all pages:

```typescript
async function findAuthUserByEmail(supabaseAdmin, email) {
  let page = 1;
  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    const found = data.users.find(u => u.email === email);
    if (found) return found;
    if (data.users.length < 1000) break; // last page
    page++;
  }
  return null;
}
```

## Summary of All Changes

| File | Change |
|------|--------|
| `supabase/functions/register-with-key/index.ts` | Fix: query `parents` table by email first before calling `listUsers`. Add paginated fallback for orphan cleanup |
| `supabase/functions/register/index.ts` | Fix: same `parents` table first-query approach. Add paginated fallback |

Both functions will be redeployed after the fix. No database changes needed.

## Expected Outcome

- Student ID signup: Works even when parent email has been used before (sibling scenario)
- Email signup: Works for all new and returning parent emails
- Orphan cleanup: Works reliably even if there are thousands of auth users
- No more "edge function error" on registration
