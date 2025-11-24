import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, GraduationCap, User, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  full_name: string;
  email: string;
  grade: string;
  school_name: string;
}

interface ExamAttempt {
  id: string;
  student_id: string;
  status: string;
  marks_obtained: number | null;
  attempted_at: string;
  completed_at: string | null;
  graded_at: string | null;
  feedback: string | null;
  exams: {
    id: string;
    title: string;
    subject: string;
    total_marks: number;
    passing_marks: number;
  };
}

export default function ParentDashboard() {
  const { user, role, profile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<Student[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && role !== 'parent') {
      navigate('/dashboard');
    } else if (!loading && user && role === 'parent' && profile?.id) {
      loadDashboardData();
    }
  }, [user, loading, role, profile, navigate]);

  const loadDashboardData = async () => {
    try {
      // Load children
      const { data: childrenData, error: childrenError } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', profile.id);

      if (childrenError) throw childrenError;
      setChildren(childrenData || []);

      // Load exam attempts for all children
      if (childrenData && childrenData.length > 0) {
        const childIds = childrenData.map(c => c.id);
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('exam_attempts')
          .select('*, exams(*)')
          .in('student_id', childIds)
          .order('attempted_at', { ascending: false });

        if (attemptsError) throw attemptsError;
        setExamAttempts(attemptsData || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoadingData(false);
    }
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

  const getAttemptsByChild = (childId: string) => {
    return examAttempts.filter(a => a.student_id === childId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Parent Dashboard</h1>
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
          </CardContent>
        </Card>

        {/* Children Overview */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Children's Progress
          </h2>

          {children.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No children linked to your account yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {children.map((child) => {
                const childAttempts = examAttempts.filter(a => a.student_id === child.id);
                const gradedAttempts = childAttempts.filter(a => a.status === 'graded');
                const avgScore = gradedAttempts.length > 0
                  ? (gradedAttempts.reduce((sum, a) => sum + (a.marks_obtained || 0), 0) / gradedAttempts.length).toFixed(1)
                  : 'N/A';

                return (
                  <Card key={child.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{child.full_name}</span>
                        <Badge variant="outline">{child.grade}</Badge>
                      </CardTitle>
                      <CardDescription>{child.school_name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold">{childAttempts.length}</div>
                          <div className="text-sm text-muted-foreground">Total Attempts</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold">{gradedAttempts.length}</div>
                          <div className="text-sm text-muted-foreground">Graded</div>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-2xl font-bold flex items-center justify-center gap-1">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            {avgScore}
                          </div>
                          <div className="text-sm text-muted-foreground">Average Score</div>
                        </div>
                      </div>

                      {childAttempts.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Recent Exam Attempts</h4>
                          <div className="space-y-2">
                            {childAttempts.slice(0, 5).map((attempt) => (
                              <div key={attempt.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex-1">
                                  <p className="font-medium">{attempt.exams.title}</p>
                                  <p className="text-sm text-muted-foreground">{attempt.exams.subject}</p>
                                </div>
                                <div className="text-right">
                                  {attempt.status === 'graded' && attempt.marks_obtained !== null ? (
                                    <div>
                                      <Badge variant={attempt.marks_obtained >= attempt.exams.passing_marks ? 'default' : 'destructive'}>
                                        {attempt.marks_obtained}/{attempt.exams.total_marks}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(attempt.graded_at!).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ) : (
                                    <Badge variant="secondary">{attempt.status}</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
