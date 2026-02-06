import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, Shield, Loader2, Mail, ArrowLeft } from "lucide-react";
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();
  const loginInProgressRef = useRef(false);

  // Redirect authenticated users — but NOT during an active login
  useEffect(() => {
    if (!authLoading && user && role && !loginInProgressRef.current) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'parent') navigate('/parent');
      else navigate('/dashboard');
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent, userType: 'student' | 'parent' | 'admin') => {
    e.preventDefault();
    loginInProgressRef.current = true;
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
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

      // Retry role verification with exponential backoff
      let roleData = null;
      let lastError = null;
      const maxAttempts = 3;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
        
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
              {showRegistration ? (
                <div className="space-y-4">
                  <Button variant="outline" onClick={() => setShowRegistration(false)} className="mb-4">
                    ← Back to Login
                  </Button>
                  <StudentRegistration />
                </div>
              ) : (
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-2xl">Student Login</CardTitle>
                    <CardDescription>Access your STEM learning dashboard</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={(e) => handleLogin(e, 'student')}>
                      <div className="space-y-2">
                        <Label htmlFor="student-email">Email</Label>
                        <Input id="student-email" type="email" placeholder="student@example.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="student-password">Password</Label>
                        <Input id="student-password" type="password" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
                      </div>
                      <Button type="submit" className="w-full shadow-primary hover:shadow-glow transition-all mt-4" disabled={loading}>
                        {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : "Sign In"}
                      </Button>
                    </form>
                    <div className="text-center text-sm text-muted-foreground">
                      Don't have an account?{" "}
                      <button onClick={() => setShowRegistration(true)} className="text-primary hover:underline font-medium">Sign up</button>
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
                          <Input id="parent-password" type="password" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
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
                      <Input id="admin-password" type="password" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
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
