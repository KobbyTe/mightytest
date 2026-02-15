

# Two-Step Student ID Authentication System

## Overview

Replace the current email-based student sign-up with a two-step flow: (1) validate a pre-generated Student ID, then (2) create a profile with password -- no email required. Admins can generate and manage batches of Student IDs.

## Database Changes

### New Table: `registration_keys`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| key_code | text | Unique, format: SCHOOLCODE-CLASSCODE-XXXX |
| school_id | uuid | FK to schools |
| class_id | uuid | FK to classes |
| status | text | 'available' or 'claimed' |
| claimed_by | uuid | Nullable, FK to students.id |
| claimed_at | timestamptz | Nullable |
| created_by | uuid | Admin who generated it |
| created_at | timestamptz | Default now() |

RLS: Admins can manage all; unauthenticated users can SELECT where status = 'available' (needed for the validation step before login).

### Students Table Update

- Make `email` column nullable (currently NOT NULL)
- Add `student_id_code` text column to store the registration key used

## Authentication Architecture

Since the backend auth system requires an email, we use a synthetic email pattern:

- When registering via Student ID, the system generates a fake email: `{STUDENT_ID}@studentid.internal`
- This is invisible to the user -- they only ever see/use their Student ID
- Login accepts Student ID, resolves it to the synthetic email, then authenticates normally

## New Edge Function: `register-with-key`

1. Receives: `keyCode`, `firstName`, `lastName`, `password`
2. Validates key exists and status = 'available'
3. Looks up school_id/class_id from the key
4. Creates auth user with synthetic email + password
5. Creates student profile (no parent account created)
6. Assigns 'student' role
7. Marks key as 'claimed'
8. Auto-enrolls in class exams
9. Returns session data for auto-login

## Frontend Changes

### Auth.tsx -- Login Form

- Change the Email input to accept "Email or Student ID"
- On submit, detect if the input looks like a Student ID (contains dashes, no @)
- If Student ID: resolve to synthetic email `{id}@studentid.internal`, then call `signInWithPassword`
- If email: proceed as before

### Auth.tsx -- Sign Up Options

Add a toggle/button: "Sign Up With Student ID" vs current email registration.

**Student ID Sign-Up Flow (new):**
- Step 1: Single input for Student ID + "Verify" button
- Step 2 (on success): Show read-only School Name and Class Name, plus First Name, Last Name, Password, Confirm Password fields. No email field.

The existing email-based registration remains available as an alternative path.

### Admin Dashboard -- Key Management Tab

Add a "Registration Keys" tab to the admin dashboard:

- **Generate Keys**: Select a school and class, enter quantity (batch size), click "Generate". Creates keys in format `SCHOOLCODE-CLASSCODE-XXXX`.
- **View Keys**: Table showing key_code, school, class, status (Available / Claimed by [Student Name]), created date.
- **Filter/Search**: Filter by school, class, or status.

## Step-by-Step Implementation

1. **Database migration**: Create `registration_keys` table with RLS policies. Alter `students.email` to be nullable. Add `student_id_code` column.

2. **Edge function `register-with-key`**: Validate key, create auth user with synthetic email, create student profile, mark key claimed, auto-enroll in exams.

3. **Auth.tsx login update**: Accept Student ID or email in the login field. Detect format and resolve accordingly.

4. **Auth.tsx sign-up update**: Add "Sign Up With Student ID" option. Implement two-step form (validate key, then profile creation with auto-filled school/class).

5. **Admin key management**: Add "Registration Keys" tab with generate batch and view/filter functionality.

6. **Register edge function update**: Update existing `register` function to handle nullable email in student profile.

## Technical Details

**Key format generation** (in admin UI or edge function):
```
SCHOOLCODE-CLASSCODE-XXXX
```
Where XXXX is a random 4-character alphanumeric string. Uniqueness enforced by database constraint.

**Login detection logic:**
```typescript
const isStudentId = !loginData.email.includes('@') && loginData.email.includes('-');
const email = isStudentId 
  ? `${loginData.email.toLowerCase()}@studentid.internal` 
  : loginData.email;
```

**Forgot password**: Student ID users cannot use "Forgot Password" (no real email). The UI will hide this option when Student ID is detected, and show a message to contact their teacher instead.

**AuthContext**: No changes needed -- it already loads roles and profiles by user_id regardless of email.

