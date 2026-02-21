import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, GraduationCap } from "lucide-react";

interface School {
  id: string;
  name: string;
  code: string;
}

interface ClassItem {
  id: string;
  school_id: string;
  name: string;
  grade_level: string | null;
}

export const StudentRegistration = () => {
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassItem[]>([]);
  
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "prefer_not_to_say",
    email: "",
    phoneNumber: "",
    addressCity: "",
    addressCountry: "",
    schoolId: "",
    classId: "",
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

  useEffect(() => {
    loadSchoolsAndClasses();
  }, []);

  useEffect(() => {
    if (formData.schoolId) {
      const filtered = classes.filter(c => c.school_id === formData.schoolId);
      setFilteredClasses(filtered);
      // Reset class selection when school changes
      if (!filtered.find(c => c.id === formData.classId)) {
        setFormData(prev => ({ ...prev, classId: '' }));
      }
    } else {
      setFilteredClasses([]);
    }
  }, [formData.schoolId, classes]);

  const loadSchoolsAndClasses = async () => {
    try {
      const [schoolsRes, classesRes] = await Promise.all([
        supabase.from('schools').select('id, name, code').eq('status', 'active').order('name'),
        supabase.from('classes').select('id, school_id, name, grade_level').eq('status', 'active').order('name')
      ]);

      if (schoolsRes.data) setSchools(schoolsRes.data);
      if (classesRes.data) setClasses(classesRes.data);
    } catch (error) {
      console.error('Error loading schools:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-populate school name and grade when selecting from dropdowns
    if (field === 'schoolId') {
      const school = schools.find(s => s.id === value);
      if (school) {
        setFormData(prev => ({ ...prev, schoolId: value, schoolName: school.name }));
      }
    }
    if (field === 'classId') {
      const cls = classes.find(c => c.id === value);
      if (cls) {
        setFormData(prev => ({ ...prev, classId: value, grade: cls.grade_level || cls.name }));
      }
    }
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

    if (!formData.schoolId || !formData.classId) {
      toast({
        title: "School & Class Required",
        description: "Please select your school and class to continue",
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

  // Extract the real error message from a FunctionsHttpError (supabase-js wraps non-2xx bodies)
  const extractErrorMessage = async (error: any): Promise<string> => {
    try {
      // FunctionsHttpError stores the Response in error.context
      if (error?.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        return body?.error || body?.message || error.message || 'Unknown error';
      }
    } catch { /* ignore parse failures */ }
    return error?.message || 'Unknown error';
  };

  // Retry helper for transient network failures (e.g. Edge browser fetch issues)
  const invokeWithRetry = async (fnName: string, body: any, maxRetries = 2) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke(fnName, { body });
        
        if (error) {
          const msg = error.message || '';
          const isNetworkError = msg.includes('Failed to send') || 
                                  msg.includes('Failed to fetch') ||
                                  msg.includes('NetworkError') ||
                                  msg.includes('network');
          
          if (isNetworkError && attempt < maxRetries) {
            console.warn(`Network error on attempt ${attempt + 1}, retrying in ${(attempt + 1)}s...`, msg);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          
          // Extract the real error message from the response body
          const realMessage = await extractErrorMessage(error);
          return { data: null, error: new Error(realMessage) };
        }
        
        // Also check for error in the response body (function returned 200 but with error field)
        if (data?.error) {
          return { data: null, error: new Error(data.error) };
        }
        
        return { data, error: null };
      } catch (err: any) {
        const isNetworkError = err.message?.includes('Failed to fetch') ||
                                err.message?.includes('NetworkError') ||
                                err.message?.includes('network') ||
                                err.name === 'TypeError';
        
        if (isNetworkError && attempt < maxRetries) {
          console.warn(`Fetch exception on attempt ${attempt + 1}, retrying...`, err.message);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return { data: null, error: err };
      }
    }
    return { data: null, error: new Error('Registration request failed after multiple attempts. Please check your internet connection and try again.') };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data, error } = await invokeWithRetry('register', formData);

      if (error) {
        // Provide user-friendly error messages
        const msg = error.message || '';
        if (msg.includes('Failed to send') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          throw new Error('Could not reach the server. Please check your internet connection and try again.');
        }
        throw error;
      }

      if (data?.success) {
        // Store parent credentials temporarily to display on dashboard
        sessionStorage.setItem('parentCredentials', JSON.stringify({
          email: data.parentEmail,
          accessCode: data.parentAccessCode,
          password: data.parentPassword,
          name: formData.parentFullName
        }));

        toast({
          title: "Registration successful! 🎉",
          description: data.emailSent 
            ? `Parent credentials sent to ${formData.parentEmail}`
            : `Parent credentials shown on dashboard (email not sent)`,
        });

        // Auto-login the student
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (signInError) {
          console.error('Auto-login failed after registration:', signInError);
          toast({
            title: "Account created!",
            description: "Registration successful. Please log in with your new credentials.",
          });
          navigate('/auth');
          return;
        }

        navigate('/dashboard');
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

           {/* School & Class Selection - NEW */}
           <div className="pt-4 border-t">
             <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
               <Building2 className="h-5 w-5 text-primary" />
               School & Class Information *
             </h3>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label htmlFor="schoolId">Select School *</Label>
                 <select
                   id="schoolId"
                   className="w-full h-10 px-3 rounded-md border border-input bg-background"
                   value={formData.schoolId}
                   onChange={(e) => handleChange('schoolId', e.target.value)}
                 >
                   <option value="">Choose your school</option>
                   {schools.map(school => (
                     <option key={school.id} value={school.id}>
                       {school.name} ({school.code})
                     </option>
                   ))}
                 </select>
                 {schools.length === 0 && (
                   <p className="text-xs text-muted-foreground">No schools available. Contact admin.</p>
                 )}
               </div>

               <div className="space-y-2">
                 <Label htmlFor="classId">Select Class *</Label>
                 <select
                   id="classId"
                   className="w-full h-10 px-3 rounded-md border border-input bg-background disabled:opacity-50"
                   value={formData.classId}
                   onChange={(e) => handleChange('classId', e.target.value)}
                   disabled={!formData.schoolId}
                 >
                   <option value="">{formData.schoolId ? "Choose your class" : "Select school first"}</option>
                   {filteredClasses.map(cls => (
                     <option key={cls.id} value={cls.id}>
                       {cls.name} {cls.grade_level && `(${cls.grade_level})`}
                     </option>
                   ))}
                 </select>
                 {formData.schoolId && filteredClasses.length === 0 && (
                   <p className="text-xs text-muted-foreground">No classes in this school yet.</p>
                 )}
               </div>
             </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="studentSchoolId">Student ID (Optional)</Label>
              <Input
                id="studentSchoolId"
                value={formData.studentSchoolId}
                onChange={(e) => handleChange('studentSchoolId', e.target.value)}
                placeholder="Your school-issued student ID"
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
