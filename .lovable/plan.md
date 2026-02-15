

# Two-Part Fix: Official Student ID Generation and Parent Credentials Display

## Problem 1: Student ID Should Be Generated After Signup

Currently, the admin-generated key (e.g., `SCHOOL-CLASS-A1B2`) is reused as the student's permanent login ID. The user wants a different flow:
- The admin key is only a **temporary validation code** to prove eligibility
- After successful registration, the system generates a **unique official Student ID** (different format) that becomes the student's permanent login credential

### Solution

**Edge function (`register-with-key`):**
- After validating the temporary key and creating the student, generate a new official Student ID in a distinct format, e.g., `STU-SCHOOLCODE-XXXX` (where XXXX is a random 4-character alphanumeric)
- Use this official ID as the synthetic email: `{officialId}@studentid.internal`
- Store the official ID in `students.student_id_code`
- Return the official Student ID in the response so the frontend can display it

**Auth.tsx login:**
- Update the Student ID detection logic to also recognize the new format (any input with dashes and no `@`)
- No change needed since the detection logic already handles this

**Auth.tsx signup success:**
- After successful registration, display the generated official Student ID to the student so they know what to use for future logins

**Admin key management:**
- No changes needed -- keys remain as temporary validation codes

---

## Problem 2: Parent Credentials Not Showing on Student Dashboard

Currently, after Student ID signup:
1. The edge function returns `parentCredentials` (email, password, accessCode) in its response
2. Auth.tsx receives `data.parentCredentials` but **never stores it** in `sessionStorage`
3. Dashboard.tsx checks `sessionStorage.getItem('parentCredentials')` -- finds nothing
4. Dashboard falls back to querying the `parents` table, but it only gets `email`, `access_code`, and `full_name` (no password), so the password shows as "not available"

### Solution

**Auth.tsx:** After successful Student ID registration, store `data.parentCredentials` in `sessionStorage` before navigating to the dashboard. This ensures the temporary password is visible on first login.

---

## Technical Changes

### 1. Edge Function `register-with-key/index.ts`

- Add a function to generate an official Student ID: `generateStudentId(schoolCode)` producing format `STU-{SCHOOLCODE}-{RANDOM4}`
- Use this generated ID (instead of the temporary key code) for:
  - The synthetic email: `{officialId.toLowerCase()}@studentid.internal`
  - The `student_id_code` field in the students table
- Return `officialStudentId` in the response JSON alongside `parentCredentials`

### 2. Auth.tsx -- Student ID Signup Success Handler

- After successful registration, store `data.parentCredentials` in `sessionStorage`:
  ```
  sessionStorage.setItem('parentCredentials', JSON.stringify({
    email: data.parentCredentials.email,
    password: data.parentCredentials.password,
    accessCode: data.parentCredentials.accessCode,
    name: studentIdForm.parentName
  }));
  ```
- Display the new official Student ID to the student (toast or brief dialog) so they know their login credential

### 3. Dashboard.tsx -- No Changes Needed

The dashboard already reads from `sessionStorage` first and falls back to the database. Once Auth.tsx stores the credentials, it will work.

### 4. Login Detection

The existing login detection logic (`!includes('@') && includes('-')`) already handles both formats, so no changes needed.

---

## Summary of Files to Change

| File | Change |
|------|--------|
| `supabase/functions/register-with-key/index.ts` | Generate official Student ID instead of reusing temp key; return it in response |
| `src/pages/Auth.tsx` | Store parentCredentials in sessionStorage after signup; show official Student ID to user |

