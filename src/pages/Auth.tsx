import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, GraduationCap, Users, Shield } from "lucide-react";

const Auth = () => {
  const [activeTab, setActiveTab] = useState("student");

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary-light to-accent relative overflow-hidden">
        <div className="absolute inset-0 circuit-pattern opacity-20" />
        
        <div className="relative z-10 flex flex-col justify-center items-center text-primary-foreground p-12">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-secondary/20 backdrop-blur-sm border-2 border-secondary-foreground/20">
              <Cpu className="w-10 h-10" />
            </div>
            <span className="text-4xl font-bold">Nsɔhwɛ</span>
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
              <div className="p-2 rounded-lg bg-primary/10 border-2 border-primary">
                <Cpu className="w-6 h-6 text-primary" />
              </div>
              <span className="text-2xl font-bold text-gradient-primary">Nsɔhwɛ</span>
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
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Student Login</CardTitle>
                  <CardDescription>Access your STEM learning dashboard</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email</Label>
                    <Input id="student-email" type="email" placeholder="student@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password">Password</Label>
                    <Input id="student-password" type="password" placeholder="••••••••" />
                  </div>
                  <Button className="w-full shadow-primary hover:shadow-glow transition-all">
                    Sign In
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <a href="#" className="text-primary hover:underline font-medium">
                      Sign up
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parent" className="mt-6">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Parent Login</CardTitle>
                  <CardDescription>Monitor your child's STEM progress</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="parent-email">Email</Label>
                    <Input id="parent-email" type="email" placeholder="parent@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-password">Password</Label>
                    <Input id="parent-password" type="password" placeholder="••••••••" />
                  </div>
                  <Button className="w-full shadow-primary hover:shadow-glow transition-all">
                    Sign In
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    Access code from your child's registration
                  </div>
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
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input id="admin-email" type="email" placeholder="admin@nsohwe.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input id="admin-password" type="password" placeholder="••••••••" />
                  </div>
                  <Button className="w-full shadow-primary hover:shadow-glow transition-all">
                    Sign In
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    Admin access only
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
