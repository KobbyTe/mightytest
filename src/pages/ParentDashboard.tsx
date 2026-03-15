import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  LogOut, GraduationCap, User, Calendar, TrendingUp, 
  BookOpen, Trophy, Star, Target, Sparkles, ChevronRight,
  CheckCircle, XCircle, Clock, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatBubble } from '@/components/ChatBubble';
import { NotificationBell } from '@/components/NotificationBell';
import { getSubjectIcon, calcAvgScore } from '@/lib/examUtils';
import { MobileBottomNav, type BottomNavItem } from '@/components/MobileBottomNav';

const parentNavItems: BottomNavItem[] = [
  { id: 'parent-top', label: 'Overview', icon: Star },
  { id: 'parent-stats', label: 'Stats', icon: TrendingUp },
  { id: 'parent-children', label: 'Children', icon: GraduationCap },
];

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
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth'); }
    else if (role === 'student') { navigate('/dashboard'); }
    else if (role === 'admin') { navigate('/admin'); }
    else if (role === 'parent' && profile?.id && !dataLoaded) { loadDashboardData(); }
  }, [user, loading, role, profile, navigate, dataLoaded]);

  const loadDashboardData = async () => {
    try {
      const { data: childrenData, error: childrenError } = await supabase
        .from('students')
        .select('id,full_name,email,grade,school_name')
        .eq('parent_id', profile.id);
      if (childrenError) throw childrenError;
      setChildren(childrenData || []);

      if (childrenData && childrenData.length > 0) {
        const childIds = childrenData.map(c => c.id);
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('exam_attempts')
          .select('id,student_id,status,marks_obtained,attempted_at,completed_at,graded_at,feedback,exams(id,title,subject,total_marks,passing_marks)')
          .in('student_id', childIds)
          .order('attempted_at', { ascending: false })
          .limit(100);
        if (attemptsError) throw attemptsError;
        setExamAttempts(attemptsData || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoadingData(false);
      setDataLoaded(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-accent/30 rounded-full animate-spin border-t-accent" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-accent animate-pulse" />
          </div>
          <p className="text-lg font-medium text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalAttempts = examAttempts.length;
  const completedAttempts = examAttempts.filter(a => a.status === 'graded' || a.status === 'completed').length;
  const passedAttempts = examAttempts.filter(a => 
    a.status === 'graded' && a.marks_obtained !== null && a.marks_obtained >= a.exams.passing_marks
  ).length;
  const avgScore = calcAvgScore(examAttempts);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header — mobile-first */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 text-accent" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 text-primary animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent truncate">
                Parent Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Monitor your child's learning journey</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hover-lift text-xs sm:text-sm h-8 sm:h-9">
              <LogOut className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main id="parent-top" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 sm:pb-8 space-y-4 sm:space-y-8">
        {/* Profile Card */}
        <Card className="hover-lift overflow-hidden">
          <div className="h-1.5 sm:h-2 bg-gradient-to-r from-accent via-primary to-secondary" />
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-2xl">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
              </div>
              Welcome, {profile?.full_name}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{profile?.email}</CardDescription>
          </CardHeader>
        </Card>

        {/* Overall Stats */}
        <div id="parent-stats" />
        {children.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <Card className="hover-lift bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
              <CardContent className="p-3 sm:p-6 text-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-accent/20 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-accent" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-accent">{totalAttempts}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Exams</p>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-gradient-to-br from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20">
              <CardContent className="p-3 sm:p-6 text-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center">
                  <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--success))]" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-[hsl(var(--success))]">{passedAttempts}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Passed</p>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-gradient-to-br from-[hsl(var(--purple))]/10 to-[hsl(var(--purple))]/5 border-[hsl(var(--purple))]/20">
              <CardContent className="p-3 sm:p-6 text-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-[hsl(var(--purple))]/20 flex items-center justify-center">
                  <Star className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--purple))]" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-[hsl(var(--purple))]">{avgScore}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Avg Score</p>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-3 sm:p-6 text-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                  <Target className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                </div>
                <p className="text-xl sm:text-3xl font-bold text-primary">{children.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Children</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Children Overview */}
        <div id="parent-children" />
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-accent to-[hsl(var(--fun-teal))] flex items-center justify-center shadow-lg">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">Children's Progress</h2>
              <p className="text-xs sm:text-base text-muted-foreground">Track academic performance and achievements</p>
            </div>
          </div>

          {children.length === 0 ? (
            <Card className="hover-lift">
              <CardContent className="py-8 sm:py-12 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No Children Linked</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  No children are linked to your account yet. Your child will be linked when they register with your details.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {children.map((child) => {
                const childAttempts = examAttempts.filter(a => a.student_id === child.id);
                const gradedAttempts = childAttempts.filter(a => a.status === 'graded');
                const passedCount = gradedAttempts.filter(a => a.marks_obtained !== null && a.marks_obtained >= a.exams.passing_marks).length;
                const childAvgScore = calcAvgScore(gradedAttempts);
                const passRate = gradedAttempts.length > 0 ? Math.round((passedCount / gradedAttempts.length) * 100) : 0;

                return (
                  <Card key={child.id} className="hover-lift overflow-hidden">
                    <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
                    <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg sm:text-xl font-bold text-primary-foreground shrink-0">
                            {child.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base sm:text-xl truncate">{child.full_name}</CardTitle>
                            <div className="flex gap-1.5 sm:gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">{child.grade || 'Grade N/A'}</Badge>
                              <Badge variant="outline" className="text-[10px] sm:text-xs">{child.school_name || 'School N/A'}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                          {passRate >= 80 && <Badge className="bg-[hsl(var(--success))] text-[10px] sm:text-xs"><Award className="h-3 w-3 mr-1" /> High Achiever</Badge>}
                          {childAttempts.length >= 5 && <Badge className="bg-[hsl(var(--purple))] text-[10px] sm:text-xs"><Star className="h-3 w-3 mr-1" /> Active Learner</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6 pb-3 sm:pb-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                        <div className="p-2.5 sm:p-4 rounded-xl bg-muted/50 text-center">
                          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 sm:mb-2 text-muted-foreground" />
                          <p className="text-lg sm:text-2xl font-bold">{childAttempts.length}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Attempts</p>
                        </div>
                        <div className="p-2.5 sm:p-4 rounded-xl bg-[hsl(var(--success))]/10 text-center">
                          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 sm:mb-2 text-[hsl(var(--success))]" />
                          <p className="text-lg sm:text-2xl font-bold text-[hsl(var(--success))]">{passedCount}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Passed</p>
                        </div>
                        <div className="p-2.5 sm:p-4 rounded-xl bg-[hsl(var(--purple))]/10 text-center">
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 sm:mb-2 text-[hsl(var(--purple))]" />
                          <p className="text-lg sm:text-2xl font-bold text-[hsl(var(--purple))]">{childAvgScore}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Score</p>
                        </div>
                        <div className="p-2.5 sm:p-4 rounded-xl bg-primary/10 text-center">
                          <Target className="h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1.5 sm:mb-2 text-primary" />
                          <p className="text-lg sm:text-2xl font-bold text-primary">{passRate}%</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Pass Rate</p>
                        </div>
                      </div>

                      {/* Test Results */}
                      {(() => {
                        const gradedAttemptsSorted = childAttempts
                          .filter(a => a.status === 'graded' && a.marks_obtained !== null)
                          .sort((a, b) => new Date(a.attempted_at).getTime() - new Date(b.attempted_at).getTime());
                        if (gradedAttemptsSorted.length === 0) return null;
                        const childAvgPercent = gradedAttemptsSorted.reduce((sum, a) => sum + ((a.marks_obtained! / a.exams.total_marks) * 100), 0) / gradedAttemptsSorted.length;

                        return (
                          <div>
                            <h4 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              Test Results
                            </h4>
                            <div className="space-y-1.5 sm:space-y-2">
                              {gradedAttemptsSorted.map((attempt, idx) => {
                                const isPassed = attempt.marks_obtained !== null && attempt.marks_obtained >= attempt.exams.passing_marks;
                                return (
                                  <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 p-2.5 sm:p-3 rounded-xl border bg-card hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                      <span className="text-xs sm:text-sm font-bold text-muted-foreground w-12 sm:w-14 shrink-0">Test {idx + 1}</span>
                                      <div className="text-lg sm:text-xl">{getSubjectIcon(attempt.exams.subject)}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                          <p className="font-medium truncate text-sm sm:text-base">{attempt.exams.title}</p>
                                          <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0 hidden sm:inline-flex">{attempt.exams.subject}</Badge>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 pl-12 sm:pl-0">
                                      <span className="font-semibold text-sm sm:text-base">{attempt.marks_obtained}/{attempt.exams.total_marks}</span>
                                      {isPassed ? (
                                        <div className="flex items-center gap-1 text-[hsl(var(--success))]">
                                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          <span className="text-xs sm:text-sm font-medium">Passed</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-destructive">
                                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          <span className="text-xs sm:text-sm font-medium">Failed</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t-2 border-primary/20">
                              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-primary/10">
                                <span className="text-sm sm:text-lg font-bold">Overall Average</span>
                                <span className="text-lg sm:text-2xl font-bold text-primary">{childAvgPercent.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {childAttempts.length === 0 && (
                        <div className="text-center py-4 sm:py-6 text-muted-foreground">
                          <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm sm:text-base">No exam attempts yet. Encourage your child to take some exams!</p>
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
      <ChatBubble />
      <MobileBottomNav items={parentNavItems} />
    </div>
  );
}
