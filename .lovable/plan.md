

# Fix: Student Registration Form Resetting

## Root Cause

In `Auth.tsx` line 325, the `StudentRegistration` component has a dynamic key using `Date.now()`:

```
key={`registration-${Date.now()}`}
```

`Date.now()` returns a different value on every render. When the parent `Auth` component re-renders for any reason (state updates, auth state changes, etc.), React sees a new key, treats `StudentRegistration` as a brand-new component, unmounts the old one (losing all form state), and mounts a fresh one. This is why all fields get erased and the form jumps back to the top.

## Fix

Replace the unstable `Date.now()` key with a stable key that only changes when the user explicitly toggles to/from the registration view.

**File:** `src/pages/Auth.tsx`

1. Add a `registrationKey` state counter (e.g., `useState(0)`) that increments only when `setShowRegistration(true)` is called -- this ensures a fresh form only when the user intentionally opens registration, not on every render.
2. Change the key from `registration-${Date.now()}` to `registration-${registrationKey}`.

This is a one-line state addition and two small edits. No other files need to change.

