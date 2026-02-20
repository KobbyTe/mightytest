import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Shield, Loader2, Mail, ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StudentRegistration } from "@/components/auth/StudentRegistration";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/mighty-test-logo.png";

const Auth = () => {
  const [activeTab, setActiveTab] = useState("student");
  const [showRegistration, setShowRegistration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showForgotCredentials, setShowForgotCredentials] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Student forgot password state
  const [showStudentForgotPassword, setShowStudentForgotPassword] = useState(false);
  const [studentForgotEmail, setStudentForgotEmail] = useState("");
  const [studentForgotLoading, setStudentForgotLoading] = useState(false);

  // Password reset (after clicking email link) state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [registrationKey, setRegistrationKey] = useState(0);
  const [showStudentIdSignup, setShowStudentIdSignup] = useState(false);
  const [studentIdStep, setStudentIdStep] = useState<'verify' | 'profile'>('verify');
  const [studentIdCode, setStudentIdCode] = useState('');
  const [verifiedKeyInfo, setVerifiedKeyInfo] = useState<{ schoolName: string; className: string; keyCode: string } | null>(null);
  const [studentIdVerifying, setStudentIdVerifying] = useState(false);
  const [studentIdForm, setStudentIdForm] = useState({
    firstName: '', lastName: '', password: '', confirmPassword: '',
    dateOfBirth: '', gender: '', phoneNumber: '', city: '', country: '',
    parentName: '', parentGender: '', parentEmail: '', parentPhone: '', parentRelationship: '',
  });
  const [studentIdRegistering, setStudentIdRegistering] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();
  const loginInProgressRef = useRef(false);

  // Listen for PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setShowRegistration(false);
        setShowStudentForgotPassword(false);
        setActiveTab("student");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect authenticated users — but NOT during an active login or password reset
  useEffect(() => {
    if (!authLoading && user && role && !loginInProgressRef.current && !showResetPassword) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'parent') navigate('/parent');
      else navigate('/dashboard');
    }
  }, [user, role, authLoading, navigate, showResetPassword]);

  const handleLogin = async (e: React.FormEvent, userType: 'student' | 'parent' | 'admin') => {
    e.preventDefault();
    loginInProgressRef.current = true;
    setLoading(true);

    try {
      // Detect Student ID format: contains dashes, no @
      const inputEmail = loginData.email;
      const isStudentId = !inputEmail.includes('@') && inputEmail.includes('-');
      const resolvedEmail = isStudentId
        ? `${inputEmail.toLowerCase()}@studentid.internal`
        : inputEmail;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginData.password,
      });

      if (authError || !authData.session) {
        if (authError?.message?.includes('refresh_token') || 
            authError?.message?.includes('Invalid Refresh Token')) {
          localStorage.removeItem('sb-kzxqhtdxjyuktrghzmsp-auth-token');
          sessionStorage.removeItem('sb-kzxqhtdxjyuktrghzmsp-auth-token');
          throw new Error('Session expired. Please try again.');
        }
        throw new Error(authError?.message || 'Invalid email or password');
      }

      let roleData = null;
      let lastError = null;
      const maxAttempts = 3;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
        
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
        lastError = error;
        console.log(`Role verification attempt ${attempt + 1}/${maxAttempts} failed:`, error?.message);
      }

      if (!roleData && lastError) {
        console.error('Role check failed after retries:', lastError);
        await supabase.auth.signOut();
        throw new Error('Unable to verify account role. Please try again in a moment.');
      }

      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error(`This account is not registered as a ${userType}`);
      }

      toast({
        title: "Welcome back! 🎉",
        description: `Logged in as ${userType}`,
      });
      
      if (userType === 'admin') navigate('/admin');
      else if (userType === 'parent') navigate('/parent');
      else navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      const isParent = userType === 'parent';
      toast({
        title: "Login failed",
        description: isParent && error.message === 'Invalid login credentials'
          ? "Invalid email or password. Try 'Forgot Credentials' below to get a new password."
          : error.message || "Invalid credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      loginInProgressRef.current = false;
    }
  };

  const handleForgotCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-parent-password', {
        body: { email: forgotEmail }
      });

      if (error) throw error;

      toast({
        title: "Credentials sent! ✉️",
        description: "If a parent account exists with that email, new login credentials have been sent.",
      });
      setShowForgotCredentials(false);
      setForgotEmail("");
    } catch (error: any) {
      console.error('Forgot credentials error:', error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleStudentForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(studentForgotEmail, {
        redirectTo: window.location.origin + '/auth',
      });
      if (error) throw error;

      toast({
        title: "Reset link sent! ✉️",
        description: "If an account exists with that email, a password reset link has been sent.",
      });
      setShowStudentForgotPassword(false);
      setStudentForgotEmail("");
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setStudentForgotLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: "Password updated! 🎉", description: "You can now log in with your new password." });
      setShowResetPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({ title: "Error", description: error.message || "Failed to reset password.", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  // If showing password reset form (user came from email link)
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <Card className="border-2">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Set New Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input id="new-password" type={showNewPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="pr-10" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary-light to-accent relative overflow-hidden">
        <div className="absolute inset-0 circuit-pattern opacity-20" />
        <div className="relative z-10 flex flex-col justify-center items-center text-primary-foreground p-12">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Mighty Test" className="h-16 w-auto rounded-xl" />
          </Link>
          <div className="space-y-6 text-center max-w-md">
            <h2 className="text-3xl font-bold">Welcome to STEM Excellence</h2>
            <p className="text-lg text-primary-foreground/80">
              Master Science, Technology, Engineering, Mathematics, Robotics, and AI through intelligent assessments
            </p>
            <div className="grid grid-cols-2 gap-4 pt-8">
              <div className="p-4 rounded-xl bg-secondary-foreground/10 backdrop-blur-sm">
                <div className="text-3xl font-bold mb-1">10K+</div>
                <div className="text-sm opacity-80">Students</div>
              </div>
              <div className="p-4 rounded-xl bg-secondary-foreground/10 backdrop-blur-sm">
                <div className="text-3xl font-bold mb-1">500+</div>
                <div className="text-sm opacity-80">STEM Exams</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <img src={logo} alt="Mighty Test" className="h-10 w-auto rounded-lg" />
            </Link>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
              <TabsTrigger value="student" className="flex items-center gap-2 py-3">
                <GraduationCap className="w-4 h-4" />
                <span className="hidden sm:inline">Student</span>
              </TabsTrigger>
              <TabsTrigger value="parent" className="flex items-center gap-2 py-3">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Parent</span>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2 py-3">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            </TabsList>

             <TabsContent value="student" className="mt-6">
               {showStudentIdSignup ? (
                 <div className="space-y-4">
                   <Button variant="outline" onClick={() => { setShowStudentIdSignup(false); setStudentIdStep('verify'); setVerifiedKeyInfo(null); setStudentIdCode(''); }} className="mb-4">
                     ← Back to Login
                   </Button>
                   <Card className="border-2">
                     <CardHeader>
                       <CardTitle className="text-2xl">Sign Up with Student ID</CardTitle>
                       <CardDescription>
                         {studentIdStep === 'verify' ? 'Enter the Student ID provided by your teacher' : 'Complete your profile to create your account'}
                       </CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
                       {studentIdStep === 'verify' ? (
                         <div className="space-y-4">
                           <div className="space-y-2">
                             <Label htmlFor="student-id-input">Student ID</Label>
                             <Input
                               id="student-id-input"
                               type="text"
                               placeholder="SCHOOL-CLASS-XXXX"
                               value={studentIdCode}
                               onChange={e => setStudentIdCode(e.target.value.toUpperCase())}
                               required
                             />
                           </div>
                           <Button
                             className="w-full"
                             disabled={studentIdVerifying || !studentIdCode.trim()}
                             onClick={async () => {
                               setStudentIdVerifying(true);
                               try {
                                 const { data, error } = await supabase
                                   .from('registration_keys')
                                   .select('key_code, status, school:schools(name), class:classes(name)')
                                   .eq('key_code', studentIdCode.trim().toUpperCase())
                                   .eq('status', 'available')
                                   .maybeSingle();
                                 if (error || !data) {
                                   toast({ title: "Invalid Student ID", description: "Invalid or already-claimed ID. Please contact your teacher.", variant: "destructive" });
                                   return;
                                 }
                                 setVerifiedKeyInfo({
                                   schoolName: (data.school as any)?.name || 'Unknown',
                                   className: (data.class as any)?.name || 'Unknown',
                                   keyCode: data.key_code,
                                 });
                                 setStudentIdStep('profile');
                               } catch (err: any) {
                                 toast({ title: "Error", description: err.message || "Verification failed", variant: "destructive" });
                               } finally {
                                 setStudentIdVerifying(false);
                               }
                             }}
                           >
                             {studentIdVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify Student ID'}
                           </Button>
                         </div>
                       ) : verifiedKeyInfo ? (
                         <form onSubmit={async (e) => {
                           e.preventDefault();
                           if (!studentIdForm.firstName.trim() || !studentIdForm.lastName.trim()) {
                             toast({ title: "Name required", description: "Please enter your first and last name", variant: "destructive" });
                             return;
                           }
                           if (!studentIdForm.dateOfBirth) {
                             toast({ title: "Date of birth required", variant: "destructive" });
                             return;
                           }
                           if (!studentIdForm.gender) {
                             toast({ title: "Gender required", description: "Please select your gender", variant: "destructive" });
                             return;
                           }
                           if (!studentIdForm.parentName.trim() || !studentIdForm.parentEmail.trim()) {
                             toast({ title: "Parent info required", description: "Please enter parent name and email", variant: "destructive" });
                             return;
                           }
                           if (studentIdForm.password !== studentIdForm.confirmPassword) {
                             toast({ title: "Passwords don't match", variant: "destructive" });
                             return;
                           }
                           if (studentIdForm.password.length < 6) {
                             toast({ title: "Password too short", description: "At least 6 characters required", variant: "destructive" });
                             return;
                           }
                           setStudentIdRegistering(true);
                           loginInProgressRef.current = true;
                           try {
                              const { data, error } = await supabase.functions.invoke('register-with-key', {
                                body: {
                                  keyCode: verifiedKeyInfo.keyCode,
                                  firstName: studentIdForm.firstName,
                                  lastName: studentIdForm.lastName,
                                  password: studentIdForm.password,
                                  dateOfBirth: studentIdForm.dateOfBirth,
                                  gender: studentIdForm.gender,
                                  phoneNumber: studentIdForm.phoneNumber,
                                  city: studentIdForm.city,
                                  country: studentIdForm.country,
                                  parentName: studentIdForm.parentName,
                                  parentGender: studentIdForm.parentGender,
                                  parentEmail: studentIdForm.parentEmail,
                                  parentPhone: studentIdForm.parentPhone,
                                  parentRelationship: studentIdForm.parentRelationship,
                                },
                              });
                             if (error) throw error;
                             if (data?.error) throw new Error(data.error);
                              if (data?.session) {
                                await supabase.auth.setSession({
                                  access_token: data.session.access_token,
                                  refresh_token: data.session.refresh_token,
                                });
                              }
                              // Store parent credentials in sessionStorage for dashboard display
                              if (data?.parentCredentials) {
                                sessionStorage.setItem('parentCredentials', JSON.stringify({
                                  email: data.parentCredentials.email,
                                  password: data.parentCredentials.password,
                                  accessCode: data.parentCredentials.accessCode,
                                  name: studentIdForm.parentName,
                                }));
                              }
                              // Show official Student ID to user
                              const officialId = data?.officialStudentId;
                              toast({
                                title: "Account created! 🎉",
                                description: officialId
                                  ? `Your official Student ID is: ${officialId}. Use this to log in.`
                                  : "Welcome to the platform!",
                                duration: 15000,
                              });
                              navigate('/dashboard');
                           } catch (err: any) {
                             toast({ title: "Registration failed", description: err.message || "Please try again", variant: "destructive" });
                           } finally {
                             setStudentIdRegistering(false);
                             loginInProgressRef.current = false;
                           }
                         }} className="space-y-4">
                           <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                             <p className="text-sm"><span className="font-medium">School:</span> {verifiedKeyInfo.schoolName}</p>
                             <p className="text-sm"><span className="font-medium">Class:</span> {verifiedKeyInfo.className}</p>
                             <p className="text-sm font-mono"><span className="font-medium font-sans">Student ID:</span> {verifiedKeyInfo.keyCode}</p>
                           </div>
                            {/* Student Details */}
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold text-foreground">Student Details</h3>
                              <div className="h-px bg-border" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="sid-first">First Name</Label>
                                <Input id="sid-first" value={studentIdForm.firstName} onChange={e => setStudentIdForm(f => ({ ...f, firstName: e.target.value }))} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sid-last">Last Name</Label>
                                <Input id="sid-last" value={studentIdForm.lastName} onChange={e => setStudentIdForm(f => ({ ...f, lastName: e.target.value }))} required />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="sid-dob">Date of Birth</Label>
                                <Input id="sid-dob" type="date" value={studentIdForm.dateOfBirth} onChange={e => setStudentIdForm(f => ({ ...f, dateOfBirth: e.target.value }))} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sid-gender">Gender</Label>
                                <select id="sid-gender" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={studentIdForm.gender} onChange={e => setStudentIdForm(f => ({ ...f, gender: e.target.value }))} required>
                                  <option value="">Select</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="sid-phone">Phone Number</Label>
                                <Input id="sid-phone" type="tel" placeholder="+1234567890" value={studentIdForm.phoneNumber} onChange={e => setStudentIdForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sid-city">City</Label>
                                <Input id="sid-city" value={studentIdForm.city} onChange={e => setStudentIdForm(f => ({ ...f, city: e.target.value }))} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sid-country">Country</Label>
                              <Input id="sid-country" value={studentIdForm.country} onChange={e => setStudentIdForm(f => ({ ...f, country: e.target.value }))} />
                            </div>

                            {/* Parent / Guardian Details */}
                            <div className="space-y-1 pt-2">
                              <h3 className="text-sm font-semibold text-foreground">Parent / Guardian Details</h3>
                              <div className="h-px bg-border" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="sid-pname">Full Name</Label>
                                <Input id="sid-pname" value={studentIdForm.parentName} onChange={e => setStudentIdForm(f => ({ ...f, parentName: e.target.value }))} required />
                              </div>
                               <div className="space-y-2">
                                <Label htmlFor="sid-pgender">Gender (optional)</Label>
                                <select id="sid-pgender" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={studentIdForm.parentGender} onChange={e => setStudentIdForm(f => ({ ...f, parentGender: e.target.value }))}>
                                  <option value="">Select (optional)</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="sid-pemail">Email *</Label>
                                <Input id="sid-pemail" type="email" placeholder="parent@example.com" value={studentIdForm.parentEmail} onChange={e => setStudentIdForm(f => ({ ...f, parentEmail: e.target.value }))} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="sid-pphone">Phone Number</Label>
                                <Input id="sid-pphone" type="tel" placeholder="+1234567890" value={studentIdForm.parentPhone} onChange={e => setStudentIdForm(f => ({ ...f, parentPhone: e.target.value }))} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sid-prelation">Relationship to Student</Label>
                              <select id="sid-prelation" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={studentIdForm.parentRelationship} onChange={e => setStudentIdForm(f => ({ ...f, parentRelationship: e.target.value }))}>
                                 <option value="">Select (optional)</option>
                                <option value="father">Father</option>
                                <option value="mother">Mother</option>
                                <option value="guardian">Guardian</option>
                                <option value="other">Other</option>
                              </select>
                            </div>

                            {/* Password */}
                            <div className="space-y-1 pt-2">
                              <h3 className="text-sm font-semibold text-foreground">Account Password</h3>
                              <div className="h-px bg-border" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sid-password">Password</Label>
                              <Input id="sid-password" type="password" placeholder="••••••••" value={studentIdForm.password} onChange={e => setStudentIdForm(f => ({ ...f, password: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sid-confirm">Confirm Password</Label>
                              <Input id="sid-confirm" type="password" placeholder="••••••••" value={studentIdForm.confirmPassword} onChange={e => setStudentIdForm(f => ({ ...f, confirmPassword: e.target.value }))} required />
                            </div>
                            <Button type="submit" className="w-full" disabled={studentIdRegistering}>
                              {studentIdRegistering ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</> : 'Create Account'}
                            </Button>
                         </form>
                       ) : null}
                     </CardContent>
                   </Card>
                 </div>
               ) : showRegistration ? (
                 <div key="registration-form" className="space-y-4">
                   <Button variant="outline" onClick={() => setShowRegistration(false)} className="mb-4">
                     ← Back to Login
                   </Button>
                   <StudentRegistration key={`registration-${registrationKey}`} />
                 </div>
               ) : showStudentForgotPassword ? (
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-2xl">Reset Password</CardTitle>
                    <CardDescription>We'll send a password reset link to your email</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <button onClick={() => setShowStudentForgotPassword(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowLeft className="h-3 w-3" /> Back to login
                    </button>
                    <form onSubmit={handleStudentForgotPassword} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="student-forgot-email">Email Address</Label>
                        <Input id="student-forgot-email" type="email" placeholder="student@example.com" value={studentForgotEmail} onChange={(e) => setStudentForgotEmail(e.target.value)} required />
                      </div>
                      <Button type="submit" className="w-full" disabled={studentForgotLoading}>
                        {studentForgotLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : (<><Mail className="mr-2 h-4 w-4" />Send Reset Link</>)}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
               ) : (
                 <Card className="border-2">
                   <CardHeader>
                     <CardTitle className="text-2xl">Student Login</CardTitle>
                     <CardDescription>Access your STEM learning dashboard</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <form onSubmit={(e) => handleLogin(e, 'student')}>
                       <div className="space-y-2">
                         <Label htmlFor="student-email">Email or Student ID</Label>
                         <Input id="student-email" type="text" placeholder="student@example.com or SCHOOL-CLASS-XXXX" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
                       </div>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="student-password">Password</Label>
                        <div className="relative">
                          <Input id="student-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required className="pr-10" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full shadow-primary hover:shadow-glow transition-all mt-4" disabled={loading}>
                        {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                      </Button>
                    </form>
                     <div className="text-center space-y-2">
                       <div className="text-sm text-muted-foreground">
                         Don't have an account?{" "}
                         <button onClick={() => { setRegistrationKey(k => k + 1); setShowRegistration(true); }} className="text-primary hover:underline font-medium">Sign up with Email</button>
                         {" or "}
                         <button onClick={() => setShowStudentIdSignup(true)} className="text-primary hover:underline font-medium">Sign up with Student ID</button>
                       </div>
                       {/* Only show forgot password if input looks like email */}
                       {(!loginData.email || loginData.email.includes('@') || !loginData.email.includes('-')) && (
                         <button onClick={() => setShowStudentForgotPassword(true)} className="text-sm text-primary hover:underline font-medium">
                           Forgot your password?
                         </button>
                       )}
                       {loginData.email && !loginData.email.includes('@') && loginData.email.includes('-') && (
                         <p className="text-xs text-muted-foreground">Student ID users: contact your teacher to reset your password.</p>
                       )}
                     </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="parent" className="mt-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Parent Login</CardTitle>
                  <CardDescription>Monitor your child's STEM progress</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showForgotCredentials ? (
                    <div className="space-y-4">
                      <button onClick={() => setShowForgotCredentials(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-3 w-3" /> Back to login
                      </button>
                      <div className="p-4 rounded-xl bg-muted/50 border">
                        <h3 className="font-semibold mb-1">Reset Parent Credentials</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Enter the email used during your child's registration. We'll send new login credentials to that address.
                        </p>
                        <form onSubmit={handleForgotCredentials} className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email">Parent Email</Label>
                            <Input id="forgot-email" type="email" placeholder="parent@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                          </div>
                          <Button type="submit" className="w-full" disabled={forgotLoading}>
                            {forgotLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : (<><Mail className="mr-2 h-4 w-4" />Send New Credentials</>)}
                          </Button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <>
                      <form onSubmit={(e) => handleLogin(e, 'parent')}>
                        <div className="space-y-2">
                          <Label htmlFor="parent-email">Email</Label>
                          <Input id="parent-email" type="email" placeholder="parent@example.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
                        </div>
                        <div className="space-y-2 mt-4">
                          <Label htmlFor="parent-password">Password</Label>
                          <div className="relative">
                            <Input id="parent-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required className="pr-10" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <Button type="submit" className="w-full shadow-primary hover:shadow-glow transition-all mt-4" disabled={loading}>
                          {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                        </Button>
                      </form>
                      <div className="text-center space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Use the credentials from your child's registration email
                        </p>
                        <button onClick={() => setShowForgotCredentials(true)} className="text-sm text-primary hover:underline font-medium">
                          Forgot your credentials?
                        </button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admin" className="mt-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Admin Login</CardTitle>
                  <CardDescription>Manage STEM exams and students</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={(e) => handleLogin(e, 'admin')}>
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">Email</Label>
                      <Input id="admin-email" type="email" placeholder="admin@mightytest.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label htmlFor="admin-password">Password</Label>
                      <div className="relative">
                        <Input id="admin-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full shadow-primary hover:shadow-glow transition-all mt-4" disabled={loading}>
                      {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                    </Button>
                  </form>
                  <div className="text-center text-sm text-muted-foreground">Admin access only</div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
