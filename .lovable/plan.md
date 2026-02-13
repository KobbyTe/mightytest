

# Add Forgot Password for Student Login

## What Changes

Add a "Forgot password?" link to the Student Login tab that lets students reset their password via email. This uses the built-in password reset flow -- when a student enters their email, they receive a reset link, and clicking it redirects them back to the app where they can set a new password.

## How It Works

1. Student clicks "Forgot password?" on the login form
2. A small form appears asking for their email
3. The system sends a password reset email with a magic link
4. Student clicks the link, returns to the app, and sets a new password
5. Student is redirected to their dashboard

## Steps

### 1. Add Forgot Password UI to Student Tab (Auth.tsx)

- Add a "Forgot password?" link below the student login form (similar to the parent "Forgot credentials?" link)
- Show an inline form with email input and "Send Reset Link" button
- Use a new state variable `showStudentForgotPassword` to toggle between login and reset views
- Call `supabase.auth.resetPasswordForEmail()` with `redirectTo` set to the app's `/auth` page

### 2. Handle Password Reset Callback (Auth.tsx)

- Detect the `PASSWORD_RECOVERY` event from `onAuthStateChange` in the Auth page
- When detected, show a "Set New Password" form with password input and confirm
- Call `supabase.auth.updateUser({ password })` to save the new password
- Redirect to the student dashboard on success

## Technical Details

**Auth.tsx changes:**
- New state: `showStudentForgotPassword`, `studentForgotEmail`, `studentForgotLoading`, `showResetPassword`, `newPassword`, `confirmPassword`, `resetLoading`
- New handler: `handleStudentForgotPassword` -- calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth' })`
- New handler: `handlePasswordReset` -- calls `supabase.auth.updateUser({ password: newPassword })`
- New `useEffect`: listens for `PASSWORD_RECOVERY` event on `supabase.auth.onAuthStateChange` to toggle the reset password form
- UI: Add "Forgot password?" button below the student sign-in button, and a reset password card that appears when the recovery link is clicked

