

# Fix: Parent Account Creation for Key-Based Registration

## Problem

Setor Enam Agbenu and Sedem Agbenu registered using the Student ID (key-based) flow. Their `parent_id` is NULL in the database, meaning their parent accounts were never created or linked. The root cause is in the `register-with-key` edge function: parent creation errors are treated as **non-fatal**, so when parent auth/profile creation fails for any reason, the student is still created but with `parent_id: null` and no parent account.

## Solution

### 1. Fix the `register-with-key` edge function

Make parent account creation **required** (fatal on failure), matching the behavior of the `register` function:

- If parent auth user creation fails (and it's not an "email already exists" case), return an error and do NOT proceed with student creation.
- If parent profile insertion fails, clean up the student auth user and return an error.
- Add a `user_roles` insert for the parent (currently missing in the "new parent" success path -- the role is only assigned if the parent email already exists and needs lookup, but NOT when a fresh parent is created).
- Ensure the student row always has `parent_id` set.

### 2. Fix existing students (Setor and Sedem)

Since these two students already exist without parent accounts, the admin needs to provide their parent emails so we can create the parent accounts and link them. To handle this gracefully, we'll add an **admin tool** in the `ResitManagement` or `StudentManagement` component that lets the admin manually create/link a parent account for a student who is missing one.

However, the simpler immediate fix is: add a section in the `StudentManagement` admin panel that shows students with missing parent accounts and lets the admin enter parent details to create and link them.

## Technical Details

### File: `supabase/functions/register-with-key/index.ts`

Changes:
- After successful parent auth creation (line 203), add `user_roles` insert for the parent role (currently missing -- this means fresh parents created via key registration never get the `parent` role assigned, which would block RLS access to the parent dashboard).
- Make parent creation failure a **hard error**: if `parentId` is still null after the parent creation block, return an error response instead of continuing.
- Add explicit error logging for each failure path.

Key code change (pseudocode):
```text
// After the parent creation block (line ~227), add:
if (!parentId) {
  // Clean up student auth user
  await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
  return error response: "Failed to create parent account"
}
```

Also fix the missing role assignment on new parent creation:
```text
// Line ~206: Add after creating parent auth user
await supabaseAdmin.from('user_roles').insert({ 
  user_id: parentAuthData.user.id, role: 'parent' 
});
```

### File: `src/components/admin/StudentManagement.tsx`

Add a UI section or button for students with `parent_id = null`:
- Show a warning badge next to students missing parent accounts
- Allow admin to enter parent name, email, phone, and relationship
- On submit, call a new edge function or directly use the admin client to:
  1. Create auth user for parent
  2. Create `parents` table row
  3. Assign `parent` role in `user_roles`
  4. Update student's `parent_id`
  5. Send credential email to parent

### File: New edge function `supabase/functions/create-parent-account/index.ts`

A dedicated edge function for admins to create a parent account for an existing student:
- Accepts: `studentId`, `parentName`, `parentEmail`, `parentPhone`, `parentRelationship`
- Creates parent auth user, profile, role, and links to student
- Sends credential email
- Returns success with credentials

### Summary of Changes

| File | Action |
|------|--------|
| `supabase/functions/register-with-key/index.ts` | Fix: add parent role assignment, make parent creation fatal |
| `supabase/functions/create-parent-account/index.ts` | Create: admin endpoint to create parent for existing student |
| `src/components/admin/StudentManagement.tsx` | Update: add "Link Parent" button for students missing parents |

