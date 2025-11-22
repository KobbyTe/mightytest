import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const StudentRegistration = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "prefer_not_to_say",
    email: "",
    phoneNumber: "",
    addressCity: "",
    addressCountry: "",
    grade: "",
    schoolName: "",
    studentSchoolId: "",
    stemInterests: [] as string[],
    programmingExperience: "beginner",
    programmingLanguages: [] as string[],
    parentFullName: "",
    parentEmail: "",
    parentPhone: "",
    parentRelationship: "guardian",
    password: "",
    confirmPassword: ""
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.dateOfBirth || !formData.email || !formData.password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return false;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.parentFullName || !formData.parentEmail) {
      toast({
        title: "Parent info required",
        description: "Please provide parent/guardian information",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('register', {
        body: formData
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Registration successful! 🎉",
          description: `Parent credentials sent to ${formData.parentEmail}`,
        });

        // Auto-login the student
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        navigate('/');
      } else {
        throw new Error(data?.error || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-2xl">Student Registration</CardTitle>
        <CardDescription>Join the STEM learning adventure!</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Personal Info */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="student@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              placeholder="+1234567890"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressCity">City</Label>
              <Input
                id="addressCity"
                value={formData.addressCity}
                onChange={(e) => handleChange('addressCity', e.target.value)}
                placeholder="Your city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCountry">Country</Label>
              <Input
                id="addressCountry"
                value={formData.addressCountry}
                onChange={(e) => handleChange('addressCountry', e.target.value)}
                placeholder="Your country"
              />
            </div>
          </div>

          {/* School Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Grade/Class</Label>
              <Input
                id="grade"
                value={formData.grade}
                onChange={(e) => handleChange('grade', e.target.value)}
                placeholder="Grade 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name</Label>
              <Input
                id="schoolName"
                value={formData.schoolName}
                onChange={(e) => handleChange('schoolName', e.target.value)}
                placeholder="Your school"
              />
            </div>
          </div>

          {/* Parent Info */}
          <div className="pt-4 border-t">
            <h3 className="text-lg font-semibold mb-4">Parent/Guardian Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="parentFullName">Parent/Guardian Name *</Label>
              <Input
                id="parentFullName"
                value={formData.parentFullName}
                onChange={(e) => handleChange('parentFullName', e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="parentEmail">Parent/Guardian Email *</Label>
              <Input
                id="parentEmail"
                type="email"
                value={formData.parentEmail}
                onChange={(e) => handleChange('parentEmail', e.target.value)}
                placeholder="parent@example.com"
                required
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="parentPhone">Parent/Guardian Phone</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => handleChange('parentPhone', e.target.value)}
                placeholder="+1234567890"
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="parentRelationship">Relationship</Label>
              <select
                id="parentRelationship"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={formData.parentRelationship}
                onChange={(e) => handleChange('parentRelationship', e.target.value)}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="guardian">Guardian</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Password */}
          <div className="pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full shadow-primary hover:shadow-glow transition-all"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Register"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};