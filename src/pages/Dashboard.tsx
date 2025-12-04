import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Calendar, Clock, User, LogOut, GraduationCap, Download, Users, Mail, Key, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExamCertificate } from '@/components/ExamCertificate';

interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  exam_date: string;
  status: string;
}

interface ExamAttempt {
  id: string;
  status: string;
  marks_obtained: number | null;
  attempted_at: string;
  completed_at: string | null;
  graded_at: string | null;
  exam_id: string;
  exams: Exam;
}

interface ParentInfo {
  email: string;
  accessCode: string;
  name: string;
}

export default function Dashboard() {
  const { user, profile, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && role && role !== 'student') {
      navigate('/dashboard');
    } else if (!loading && user && role === 'student' && profile?.id) {
      loadDashboardData();
      loadParentInfo();
    }
  }, [user, loading, role, profile, navigate]);

  const loadParentInfo = async () => {
    // First check sessionStorage for newly registered parent credentials
    const storedCredentials = sessionStorage.getItem('parentCredentials');
    if (storedCredentials) {
      setParentInfo(JSON.parse(storedCredentials));
      return;
    }

    // Otherwise load from database
    if (profile?.parent_id) {
      const { data: parentData } = await supabase
        .from('parents')
        .select('email, access_code, full_name')
        .eq('id', profile.parent_id)
        .single();

      if (parentData) {
        setParentInfo({
          email: parentData.email,
          accessCode: parentData.access_code,
          name: parentData.full_name
        });
      }
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const loadDashboardData = async () => {
    try {
      // Load exam attempts with exam details
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select('*, exams(*)')
        .eq('student_id', profile.id)
        .order('attempted_at', { ascending: false });

      if (attemptsError) throw attemptsError;
      setExamAttempts(attemptsData || []);

      // Load available exams
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .eq('status', 'active')
        .order('exam_date');

      if (examsError) throw examsError;
      setAvailableExams(examsData || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleRegisterExam = async (examId: string) => {
    try {
      const { data, error } = await supabase
        .from('exam_attempts')
        .insert({
          student_id: profile.id,
          exam_id: examId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Successfully registered for exam!');
      
      // Navigate to exam taking page
      if (data?.id) {
        navigate(`/exam/take?attempt=${data.id}`);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === '23505') {
        toast.error('You are already registered for this exam');
      } else {
        toast.error('Failed to register for exam');
      }
    }
  };

  const handleTakeExam = (attemptId: string) => {
    navigate(`/exam/take?attempt=${attemptId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const registeredExamIds = examAttempts.map(e => e.exam_id);
  const unregisteredExams = availableExams.filter(e => !registeredExamIds.includes(e.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Student Dashboard</h1>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{profile?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grade</p>
              <p className="font-medium">{profile?.grade || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">School</p>
              <p className="font-medium">{profile?.school_name || 'Not specified'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Parent/Guardian Information */}
        {parentInfo && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Parent/Guardian Login Details
              </CardTitle>
              <CardDescription>
                Share these credentials with your parent/guardian so they can monitor your progress.
                An email has been sent to them with these details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Parent Name
                  </div>
                  <p className="font-medium">{parentInfo.name}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{parentInfo.email}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => copyToClipboard(parentInfo.email, 'email')}
                    >
                      {copiedField === 'email' ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Key className="h-4 w-4" />
                  Access Code
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-mono font-bold tracking-wider text-primary">
                    {parentInfo.accessCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(parentInfo.accessCode, 'accessCode')}
                  >
                    {copiedField === 'accessCode' ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Tip: The password has been sent to your parent's email. They can use it along with the email above to log in.
              </p>
            </CardContent>
          </Card>
        )}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            My Exams
          </h2>
          {examAttempts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                You haven't registered for any exams yet. Browse available exams below!
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examAttempts.map((attempt) => (
                <Card key={attempt.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{attempt.exams.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{attempt.exams.subject}</Badge>
                      <Badge variant="outline">{attempt.exams.grade_level}</Badge>
                    </CardDescription>
                  </CardHeader>
                   <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {attempt.exams.description}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                          {attempt.status}
                        </Badge>
                      </div>
                      {attempt.status === 'graded' && attempt.marks_obtained !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Score:</span>
                          <span className="font-medium">
                            {attempt.marks_obtained}/{attempt.exams.total_marks}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Duration:</span>
                        <span>{attempt.exams.duration_minutes} min</span>
                      </div>
                      {attempt.exams.exam_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Date:</span>
                          <span>{new Date(attempt.exams.exam_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {attempt.status === 'graded' && 
                       (attempt.marks_obtained || 0) >= attempt.exams.passing_marks && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1">
                              <Download className="mr-2 h-4 w-4" />
                              Certificate
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[900px]">
                            <DialogHeader>
                              <DialogTitle>Your Achievement Certificate</DialogTitle>
                            </DialogHeader>
                            <ExamCertificate
                              studentName={profile?.full_name || ''}
                              examTitle={attempt.exams.title}
                              score={attempt.marks_obtained || 0}
                              totalMarks={attempt.exams.total_marks}
                              date={attempt.graded_at || attempt.completed_at || ''}
                            />
                          </DialogContent>
                        </Dialog>
                      )}
                      {attempt.status === 'pending' && (
                        <Button size="sm" onClick={() => handleTakeExam(attempt.id)} className="flex-1">
                          Take Exam
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Available Exams */}
        {unregisteredExams.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Available Exams
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unregisteredExams.map((exam) => (
                <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{exam.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary">{exam.subject}</Badge>
                      <Badge variant="outline">{exam.grade_level}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {exam.description}
                    </p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{exam.duration_minutes} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Marks:</span>
                        <span className="font-medium">{exam.total_marks}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Passing Marks:</span>
                        <span className="font-medium">{exam.passing_marks}</span>
                      </div>
                      {exam.exam_date && (
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium">
                            {new Date(exam.exam_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={() => handleRegisterExam(exam.id)} 
                      className="w-full"
                    >
                      Register for Exam
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
