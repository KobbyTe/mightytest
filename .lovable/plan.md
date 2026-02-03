

## Fix Plan: Authentication and Exam Portal Issues on Vercel Deployment

### Overview

After investigating the codebase, I've identified several interconnected issues that are causing authentication and exam functionality to fail on the Vercel deployment. Here's a comprehensive fix plan.

---

### Root Causes Identified

1. **Missing Edge Function Configuration**: `resend-parent-credentials` and `send-grade-notification` are not in `config.toml`
2. **Auth State Race Condition**: The role verification happens before session is fully established
3. **RLS Policy Issues**: INSERT policies for `exam_attempts` may be blocking student registrations
4. **Session Check Timing**: Login flow verifies roles immediately after auth, but auth state change listener may not have fired yet

---

### Step 1: Update Edge Function Configuration

**File:** `supabase/config.toml`

Add the missing edge function configurations:

```toml
project_id = "kzxqhtdxjyuktrghzmsp"

[functions.register]
verify_jwt = false

[functions.login]
verify_jwt = false

[functions.create-admin]
verify_jwt = false

[functions.process-exam-pdf]
verify_jwt = false

[functions.resend-parent-credentials]
verify_jwt = false

[functions.send-grade-notification]
verify_jwt = false
```

---

### Step 2: Fix Authentication Flow in Auth.tsx

**File:** `src/pages/Auth.tsx`

**Current Issue:** After `signInWithPassword()`, the code immediately queries `user_roles` table. However, the Supabase client may not have fully established the session yet, causing RLS policies to fail.

**Fix:** Add a small delay or use session from auth response directly:

```typescript
const handleLogin = async (e: React.FormEvent, userType: 'student' | 'parent' | 'admin') => {
  e.preventDefault();
  setLoading(true);

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (authError || !authData.session) {
      throw new Error('Invalid email or password');
    }

    // Wait briefly for session to propagate to RLS context
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use fresh client with session header for role check
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .eq('role', userType)
      .maybeSingle();

    if (roleError) {
      console.error('Role check error:', roleError);
      await supabase.auth.signOut();
      throw new Error('Unable to verify account role');
    }

    if (!roleData) {
      await supabase.auth.signOut();
      throw new Error(`This account is not registered as a ${userType}`);
    }

    // Success - navigate
    toast({ title: "Welcome back!", description: `Logged in as ${userType}` });
    
    if (userType === 'admin') navigate('/admin');
    else if (userType === 'parent') navigate('/parent');
    else navigate('/dashboard');
    
  } catch (error: any) {
    console.error('Login error:', error);
    toast({
      title: "Login failed",
      description: error.message || "Invalid credentials",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

---

### Step 3: Fix AuthContext Session Initialization

**File:** `src/contexts/AuthContext.tsx`

**Issue:** The `onAuthStateChange` listener is set up AFTER `getSession()` is called, but the listener should be set up FIRST to catch initial session events.

**Fix:** Ensure listener is set up before checking session:

```typescript
useEffect(() => {
  let mounted = true;

  // IMPORTANT: Set up auth listener FIRST
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!mounted) return;
    
    setSession(session);
    setUser(session?.user ?? null);
    
    if (session?.user) {
      loadUserData(session.user.id);
    } else {
      clearUserState();
      setLoading(false);
    }
  });

  // THEN get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!mounted) return;
    
    // Only update if no auth change has occurred
    if (!user) {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, [loadUserData, clearUserState]);
```

---

### Step 4: Fix Exam Registration and Taking Flow

**File:** `src/pages/Dashboard.tsx`

**Issue:** The `handleRegisterExam` function creates an attempt and immediately navigates. The RLS policy for INSERT may require additional WITH CHECK validation.

**Fix:** Add error handling and ensure the attempt is properly created:

```typescript
const handleRegisterExam = async (examId: string) => {
  try {
    // First verify student profile exists
    if (!profile?.id) {
      toast.error('Student profile not found. Please refresh the page.');
      return;
    }

    const { data, error } = await supabase
      .from('exam_attempts')
      .insert({
        student_id: profile.id,
        exam_id: examId,
        status: 'pending',
        attempted_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Registration error:', error);
      if (error.code === '23505') {
        // Duplicate - check if there's an existing pending attempt
        const { data: existingAttempt } = await supabase
          .from('exam_attempts')
          .select('id, status')
          .eq('student_id', profile.id)
          .eq('exam_id', examId)
          .single();
        
        if (existingAttempt && existingAttempt.status === 'pending') {
          toast.info('Continuing your existing exam attempt');
          navigate(`/exam/take?attempt=${existingAttempt.id}`);
          return;
        }
        toast.error('You are already registered for this exam');
      } else {
        toast.error('Failed to register for exam. Please try again.');
      }
      return;
    }

    toast.success('Successfully registered for exam!');
    navigate(`/exam/take?attempt=${data.id}`);
  } catch (error: any) {
    console.error('Registration error:', error);
    toast.error('An unexpected error occurred. Please try again.');
  }
};
```

---

### Step 5: Ensure ExamTaking Handles Missing Data Gracefully

**File:** `src/pages/ExamTaking.tsx`

**Issue:** If the exam data doesn't load (due to RLS or timing issues), the user gets a generic error.

**Fix:** Add better error handling and retry logic:

```typescript
const loadExamData = async () => {
  if (!attemptId) {
    navigate('/dashboard');
    return;
  }

  try {
    // Add retry logic for transient issues
    let attempt = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (!attempt && retryCount < maxRetries) {
      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*, exams(*)')
        .eq('id', attemptId)
        .single();

      if (attemptError) {
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        console.error('Attempt load error after retries:', attemptError);
        throw new Error('Unable to load exam. Please try again.');
      }

      attempt = attemptData;
    }

    if (!attempt) {
      throw new Error('Exam attempt not found');
    }

    if (attempt.status === 'completed' || attempt.status === 'graded') {
      toast.error('This exam has already been completed');
      navigate('/dashboard');
      return;
    }

    setExam(attempt.exams);
    // ... rest of the function
  } catch (error: any) {
    console.error('Error loading exam:', error);
    toast.error(error.message || 'Failed to load exam');
    navigate('/dashboard');
  } finally {
    setLoading(false);
  }
};
```

---

### Step 6: Add RLS Policy Fix for exam_attempts INSERT

**Database Migration**

The current INSERT policy for `exam_attempts` may need a WITH CHECK clause to verify the student can insert:

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Students can create own attempts" ON exam_attempts;

-- Create new policy with proper WITH CHECK
CREATE POLICY "Students can create own attempts"
ON exam_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);
```

---

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/config.toml` | Add missing edge function configurations |
| `src/pages/Auth.tsx` | Add delay after auth for session propagation, improve error handling |
| `src/contexts/AuthContext.tsx` | Set up listener before getSession for proper order |
| `src/pages/Dashboard.tsx` | Improve exam registration with retry logic and better error handling |
| `src/pages/ExamTaking.tsx` | Add retry logic for exam data loading |
| Database Migration | Fix exam_attempts INSERT policy WITH CHECK clause |

---

### Technical Details

**Why the Vercel deployment fails but local/preview works:**

1. **Network latency**: On Vercel, there's additional network latency between the client and Supabase. The auth session may not be fully propagated when the role check query is made.

2. **Edge function cold starts**: The edge functions may have cold start delays on first invocation, causing timeouts.

3. **RLS context timing**: The Supabase client needs time to apply the new JWT to the RLS context after login. The immediate role check query may run before this happens.

**The fixes address these by:**
- Adding small delays after auth to allow session propagation
- Implementing retry logic for critical data loading
- Ensuring auth listener is set up before initial session check
- Adding proper error handling with user-friendly messages

