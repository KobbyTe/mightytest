import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, Calendar, Clock, User, LogOut, GraduationCap, Download, 
  Users, Mail, Key, Copy, Check, Trophy, Star, Zap, Target, 
  Sparkles, Award, TrendingUp, Play, Brain, RefreshCw, Send, HelpCircle, RotateCcw,
  XCircle, CheckCircle, LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExamCertificate } from '@/components/ExamCertificate';
import { OnboardingTour } from '@/components/OnboardingTour';
import { ChatBubble } from '@/components/ChatBubble';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import { AIStudyAssistant } from '@/components/AIStudyAssistant';
import { StudentGamification } from '@/components/StudentGamification';
import { getSubjectIcon, getSubjectColor, calcAvgScore } from '@/lib/examUtils';
import { VoiceSelectionDialog } from '@/components/VoiceSelectionDialog';
import { useReadingAssistant } from '@/hooks/useReadingAssistant';
import { MobileBottomNav, type BottomNavItem } from '@/components/MobileBottomNav';

interface Exam {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  grade_level?: string;
  duration_minutes?: number;
  total_marks: number;
  passing_marks: number;
  exam_date?: string;
  status?: string;
}

interface ExamAttempt {
  id: string;
  status: string;
  marks_obtained: number | null;
  attempted_at: string;
  completed_at: string | null;
  graded_at: string | null;
  exam_id: string;
  exams: {
    id: string;
    title: string;
    subject?: string;
    grade_level?: string;
    description?: string;
    duration_minutes?: number;
    total_marks: number;
    passing_marks: number;
    exam_date?: string;
  };
}

interface ParentInfo {
  email: string;
  accessCode: string;
  password?: string;
  name: string;
}
const studentNavItems: BottomNavItem[] = [
  { id: 'dashboard-top', label: 'Home', icon: LayoutDashboard },
  { id: 'section-exams', label: 'Exams', icon: BookOpen },
  { id: 'section-available', label: 'Browse', icon: Zap },
  { id: 'section-results', label: 'Results', icon: Trophy },
  { id: 'section-profile', label: 'Profile', icon: User },
];

export default function Dashboard() {
  const { user, profile, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [parentInfo, setParentInfo] = useState<ParentInfo | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [resendingCredentials, setResendingCredentials] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [resitOpenings, setResitOpenings] = useState<any[]>([]);
  const [resitRequests, setResitRequests] = useState<any[]>([]);
  const [applyingResit, setApplyingResit] = useState<string | null>(null);
  const [pendingExamAttemptId, setPendingExamAttemptId] = useState<string | null>(null);
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const readingAssistant = useReadingAssistant();

  // Redirect logic — wait for auth to fully resolve before redirecting
  useEffect(() => {
    if (loading) return; // still loading, do nothing
    if (!user) { navigate('/auth'); return; } // definitively no user
    // User exists — check role (may still be null while loadUserData runs)
    if (role === 'parent') navigate('/parent');
    else if (role === 'admin') navigate('/admin');
  }, [user, loading, role, navigate]);

  // Data loading
  useEffect(() => {
    if (!loading && user && role === 'student' && profile?.id && !dataLoaded) {
      setDataLoaded(true);
      Promise.all([loadDashboardData(), loadParentInfo(), checkOnboarding(), loadResitData()]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [user, loading, role, profile, dataLoaded]);

  const checkOnboarding = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !data.onboarding_completed) {
        setTimeout(() => setShowTour(true), 800);
      }
    } catch (e) {
      console.error('Error checking onboarding:', e);
    }
  };

  const completeTour = async () => {
    setShowTour(false);
    if (!user) return;
    try {
      await supabase
        .from('user_preferences')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error saving onboarding status:', e);
    }
  };

  const loadParentInfo = async () => {
    const storedCredentials = sessionStorage.getItem('parentCredentials');
    if (storedCredentials) {
      setParentInfo(JSON.parse(storedCredentials));
      return;
    }

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
      const studentClassId = profile?.class_id;
      
      const attemptsRes = await supabase
        .from('exam_attempts')
        .select('id,status,marks_obtained,attempted_at,completed_at,graded_at,exam_id,exams(id,title,subject,grade_level,description,duration_minutes,total_marks,passing_marks,exam_date)')
        .eq('student_id', profile.id)
        .order('attempted_at', { ascending: false })
        .limit(50);

      if (attemptsRes.error) throw attemptsRes.error;
      setExamAttempts(attemptsRes.data || []);

      let assignedExams: Exam[] = [];
      
      if (studentClassId) {
        const assignmentsRes = await supabase
          .from('exam_class_assignments')
          .select('exam_id,exams(id,title,description,subject,grade_level,duration_minutes,total_marks,passing_marks,exam_date,status)')
          .eq('class_id', studentClassId)
          .eq('is_active', true)
          .limit(20);

        if (!assignmentsRes.error && assignmentsRes.data && assignmentsRes.data.length > 0) {
          assignedExams = assignmentsRes.data
            .map((a: any) => a.exams)
            .filter((exam: any) => exam && exam.status === 'active');
        }
      }

      setAvailableExams(assignedExams);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const resendParentCredentials = async () => {
    if (!parentInfo?.email || !profile?.id) return;
    
    setResendingCredentials(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-parent-credentials', {
        body: {
          parentEmail: parentInfo.email,
          studentId: profile.id
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success('New login credentials sent to parent\'s email!');
        if (data.newPassword) {
          const updatedInfo = { ...parentInfo, password: data.newPassword };
          setParentInfo(updatedInfo);
          sessionStorage.setItem('parentCredentials', JSON.stringify(updatedInfo));
        }
      } else {
        throw new Error(data?.error || 'Failed to resend credentials');
      }
    } catch (error: any) {
      console.error('Error resending credentials:', error);
      toast.error(error.message || 'Failed to resend parent credentials');
    } finally {
      setResendingCredentials(false);
    }
  };

  const handleRegisterExam = async (examId: string) => {
    try {
      if (!profile?.id) {
        toast.error('Student profile not found. Please refresh the page.');
        return;
      }

      // Check if student already has an attempt for this exam
      const { data: existingAttempts } = await supabase
        .from('exam_attempts')
        .select('id, status')
        .eq('student_id', profile.id)
        .eq('exam_id', examId)
        .order('attempted_at', { ascending: false });

      const activeAttempt = existingAttempts?.find(a => a.status === 'pending' || a.status === 'in_progress');
      if (activeAttempt) {
        toast.info('Continuing your existing exam attempt');
        setPendingExamAttemptId(activeAttempt.id);
        setShowVoiceDialog(true);
        return;
      }

      // If there are previous completed/graded attempts, check for an approved resit
      const hasCompletedAttempt = existingAttempts?.some(a => a.status === 'completed' || a.status === 'graded');
      if (hasCompletedAttempt) {
        const { data: approvedResit } = await supabase
          .from('resit_requests')
          .select('id')
          .eq('student_id', profile.id)
          .eq('exam_id', examId)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle();

        if (!approvedResit) {
          toast.error('You have already completed this exam. Apply for a resit if available.');
          return;
        }
        // Approved resit found — mark it as used so it can't be reused
        await supabase
          .from('resit_requests')
          .update({ status: 'used', reviewed_at: new Date().toISOString() })
          .eq('id', approvedResit.id);
      }

      // Create a new attempt
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
        toast.error('Failed to register for exam. Please try again.');
        return;
      }

      toast.success('Successfully registered for exam!');
      setPendingExamAttemptId(data.id);
      setShowVoiceDialog(true);
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const loadResitData = async () => {
    if (!profile?.class_id || !profile?.id) return;
    try {
      const [openingsRes, requestsRes] = await Promise.all([
        supabase.from('resit_openings').select('*').eq('class_id', profile.class_id).eq('is_open', true),
        supabase.from('resit_requests').select('*').eq('student_id', profile.id),
      ]);
      setResitOpenings(openingsRes.data || []);
      setResitRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Error loading resit data:', error);
    }
  };

  const handleApplyResit = async (examId: string, classId: string) => {
    if (!profile?.id) return;
    const confirmed = window.confirm(
      'Requesting a resit will LOCK the review of your previous attempt for this exam until your resit is submitted. You will not be able to see the correct answers in the meantime. Continue?'
    );
    if (!confirmed) return;
    setApplyingResit(examId);
    try {
      const { error } = await supabase.from('resit_requests').insert({
        exam_id: examId,
        class_id: classId,
        student_id: profile.id,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') {
          toast.info('You have already applied for this resit');
        } else if (error.code === '42501' || /row-level security/i.test(error.message)) {
          toast.error('Resit unavailable — you have already reviewed this exam.');
        } else {
          throw error;
        }
        return;
      }
      toast.success('Resit application submitted! Awaiting admin approval.');
      loadResitData();
    } catch (error) {
      console.error('Error applying for resit:', error);
      toast.error('Failed to apply for resit');
    } finally {
      setApplyingResit(null);
    }
  };

  const hasReviewedExam = (examId: string) =>
    examAttempts.some((a: any) => a.exam_id === examId && a.review_opened_at);

  const handleTakeExam = (attemptId: string) => {
    setPendingExamAttemptId(attemptId);
    setShowVoiceDialog(true);
  };

  const handleVoiceContinue = () => {
    setShowVoiceDialog(false);
    if (pendingExamAttemptId) {
      readingAssistant.toggle(); // Enable reading assistant
      navigate(`/exam/take?attempt=${pendingExamAttemptId}`);
      setPendingExamAttemptId(null);
    }
  };

  const handleVoiceSkip = () => {
    setShowVoiceDialog(false);
    if (pendingExamAttemptId) {
      navigate(`/exam/take?attempt=${pendingExamAttemptId}`);
      setPendingExamAttemptId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 rounded-full animate-spin border-t-primary" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-lg font-medium text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const registeredExamIds = examAttempts.map(e => e.exam_id);
  const unregisteredExams = availableExams.filter(e => !registeredExamIds.includes(e.id));

  const completedExams = examAttempts.filter(a => a.status === 'graded' || a.status === 'completed');
  const passedExams = examAttempts.filter(a => a.status === 'graded' && a.marks_obtained !== null && a.marks_obtained >= a.exams.passing_marks);
  const avgScore = calcAvgScore(completedExams);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Onboarding Tour */}
      <OnboardingTour isActive={showTour} onComplete={completeTour} />

      {/* Voice Selection Dialog */}
      <VoiceSelectionDialog
        open={showVoiceDialog}
        onContinue={handleVoiceContinue}
        onSkip={handleVoiceSkip}
        availableVoices={readingAssistant.availableVoices}
        selectedVoice={readingAssistant.selectedVoice}
        onSelectVoice={readingAssistant.setSelectedVoice}
        speed={readingAssistant.speed}
        onSpeedChange={readingAssistant.setSpeed}
        isSpeaking={readingAssistant.isSpeaking}
        onPreview={readingAssistant.previewVoice}
        onStopPreview={readingAssistant.stop}
      />

      {/* Header — mobile-first */}
      <header id="tour-welcome" className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative shrink-0">
              <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 text-secondary animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
                Welcome back, {profile?.full_name?.split(' ')[0]}! 🎉
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Ready to conquer some exams today?</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setShowTour(true)} title="Take a tour" className="h-8 w-8 sm:h-9 sm:w-9">
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hover-lift text-xs sm:text-sm h-8 sm:h-9">
              <LogOut className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Sign Out</span>
              <span className="xs:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="dashboard-top" className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 sm:pb-8 space-y-4 sm:space-y-8">
        <NotificationPermissionBanner />
        {/* Stats Cards */}
        <div id="tour-stats" className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <Card className="hover-lift bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-primary/20 flex items-center justify-center">
                <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
              </div>
              <p className="text-xl sm:text-3xl font-bold text-primary">{examAttempts.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Exams Taken</p>
            </CardContent>
          </Card>

          <Card className="hover-lift bg-gradient-to-br from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center">
                <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--success))]" />
              </div>
              <p className="text-xl sm:text-3xl font-bold text-[hsl(var(--success))]">{passedExams.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Exams Passed</p>
            </CardContent>
          </Card>

          <Card className="hover-lift bg-gradient-to-br from-[hsl(var(--purple))]/10 to-[hsl(var(--purple))]/5 border-[hsl(var(--purple))]/20">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-[hsl(var(--purple))]/20 flex items-center justify-center">
                <Star className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--purple))]" />
              </div>
              <p className="text-xl sm:text-3xl font-bold text-[hsl(var(--purple))]">{avgScore}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Avg Score</p>
            </CardContent>
          </Card>

          <Card className="hover-lift bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="w-9 h-9 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 rounded-full bg-secondary/20 flex items-center justify-center">
                <Target className="h-4 w-4 sm:h-6 sm:w-6 text-secondary" />
              </div>
              <p className="text-xl sm:text-3xl font-bold text-secondary">{unregisteredExams.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Available</p>
            </CardContent>
          </Card>
        </div>

        {/* Gamification Section */}
        <StudentGamification examAttempts={examAttempts} studentName={profile?.full_name || ''} />

        {/* My Results Summary */}
        <div id="section-results" />
        {(() => {
          const gradedExams = examAttempts
            .filter(a => a.status === 'graded' && a.marks_obtained !== null)
            .sort((a, b) => new Date(a.attempted_at).getTime() - new Date(b.attempted_at).getTime());
          
          if (gradedExams.length === 0) return null;

          const avgPercent = gradedExams.reduce((sum, a) => sum + ((a.marks_obtained! / a.exams.total_marks) * 100), 0) / gradedExams.length;

          return (
            <Card className="hover-lift overflow-hidden">
              <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-2xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[hsl(var(--purple))] to-primary flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                  </div>
                  My Results Summary
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">All your graded test results at a glance</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="space-y-2">
                  {gradedExams.map((attempt, idx) => {
                    const percent = (attempt.marks_obtained! / attempt.exams.total_marks) * 100;
                    const passed = attempt.marks_obtained! >= attempt.exams.passing_marks;
                    return (
                      <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 rounded-xl border bg-card hover:shadow-md transition-shadow gap-1.5 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-muted-foreground w-12 sm:w-16 shrink-0">Test {idx + 1}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm sm:text-base truncate">{attempt.exams.title}</p>
                            <p className="text-xs text-muted-foreground">{attempt.exams.subject || 'General'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 pl-12 sm:pl-0">
                          <span className="font-semibold text-sm sm:text-base">{attempt.marks_obtained}/{attempt.exams.total_marks}</span>
                          <Badge variant={passed ? 'default' : 'destructive'} className={`text-xs ${passed ? 'bg-[hsl(var(--success))]' : ''}`}>
                            {passed ? 'Passed' : 'Failed'} ({percent.toFixed(0)}%)
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-primary/20">
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-primary/10">
                    <span className="text-sm sm:text-lg font-bold">Overall Average</span>
                    <span className="text-lg sm:text-2xl font-bold text-primary">{avgPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Profile & Parent Info Grid */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile Card */}
          <div id="section-profile" />
          <Card id="tour-profile" className="hover-lift overflow-hidden">
            <div className="h-1.5 sm:h-2 bg-gradient-to-r from-primary via-secondary to-accent" />
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-2xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                </div>
                My Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
              {profile?.student_id_code && (
                <div className="p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Student ID</p>
                    <p className="font-bold text-base sm:text-lg text-primary mt-1">{profile.student_id_code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(profile.student_id_code, 'studentId')}
                    className="shrink-0 h-8 w-8"
                  >
                    {copiedField === 'studentId' ? <Check className="h-4 w-4 text-[hsl(var(--success))]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Full Name</p>
                  <p className="font-semibold mt-0.5 sm:mt-1 text-sm sm:text-base">{profile?.full_name}</p>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="font-semibold mt-0.5 sm:mt-1 truncate text-sm sm:text-base">{profile?.email}</p>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Grade</p>
                  <p className="font-semibold mt-0.5 sm:mt-1 text-sm sm:text-base">{profile?.grade || 'Not specified'}</p>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">School</p>
                  <p className="font-semibold mt-0.5 sm:mt-1 text-sm sm:text-base">{profile?.school_name || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parent Info Card */}
          <Card id="tour-parent" className="hover-lift overflow-hidden border-accent/30">
            {parentInfo ? (
              <>
              <div className="h-1.5 sm:h-2 bg-gradient-to-r from-accent via-[hsl(var(--fun-teal))] to-[hsl(var(--success))]" />
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-2xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent to-[hsl(var(--fun-teal))] flex items-center justify-center">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                  </div>
                  Parent/Guardian Access
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Share these with your parent so they can track your progress! 📱
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-accent/10 border border-accent/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <User className="h-3 w-3" />
                      Parent Name
                    </div>
                    <p className="font-semibold text-sm sm:text-base">{parentInfo.name}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-accent/10 border border-accent/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold truncate text-xs sm:text-sm">{parentInfo.email}</p>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(parentInfo.email, 'email')}>
                        {copiedField === 'email' ? <Check className="h-3 w-3 text-[hsl(var(--success))]" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Key className="h-3 w-3" />
                      Access Code
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-base sm:text-lg font-mono font-bold tracking-wider text-primary">
                        {parentInfo.accessCode}
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(parentInfo.accessCode, 'accessCode')}>
                        {copiedField === 'accessCode' ? <Check className="h-3 w-3 text-[hsl(var(--success))]" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {parentInfo.password ? (
                    <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Key className="h-3 w-3" />
                        Temp Password
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-base sm:text-lg font-mono font-bold tracking-wider text-secondary">
                          {parentInfo.password}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(parentInfo.password!, 'password')}>
                          {copiedField === 'password' ? <Check className="h-3 w-3 text-[hsl(var(--success))]" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-muted">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Key className="h-3 w-3" />
                        Password
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">Password not available</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={resendParentCredentials}
                        disabled={resendingCredentials}
                        className="w-full text-xs"
                      >
                        {resendingCredentials ? (
                          <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-3 w-3" />
                        )}
                        {resendingCredentials ? 'Sending...' : 'Resend Credentials'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
              </>
            ) : (
              <>
              <div className="h-1.5 sm:h-2 bg-gradient-to-r from-accent via-[hsl(var(--fun-teal))] to-[hsl(var(--success))]" />
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-2xl">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-accent to-[hsl(var(--fun-teal))] flex items-center justify-center">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                  </div>
                  Parent/Guardian Access
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                <p className="text-muted-foreground text-xs sm:text-sm">
                  No parent/guardian account is linked to your profile yet. A parent account is automatically created when you register with a parent email. Contact your administrator if you need help.
                </p>
              </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* My Exams Section */}
        <div id="section-exams" />
        <div id="tour-exams">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-primary">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">My Exams</h2>
              <p className="text-xs sm:text-base text-muted-foreground">Track your exam progress and achievements</p>
            </div>
          </div>

          {examAttempts.length === 0 ? (
            <Card className="hover-lift">
              <CardContent className="py-8 sm:py-12 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No Exams Yet</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  You haven't registered for any exams yet. Browse available exams below and start your journey! 🚀
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {examAttempts.map((attempt) => {
                const isPassed = attempt.status === 'graded' && attempt.marks_obtained !== null && attempt.marks_obtained >= attempt.exams.passing_marks;
                const scorePercent = attempt.marks_obtained !== null ? (attempt.marks_obtained / attempt.exams.total_marks) * 100 : 0;
                
                return (
                  <Card key={attempt.id} className="hover-lift overflow-hidden group">
                    <div className={`h-1.5 sm:h-2 ${getSubjectColor(attempt.exams.subject)}`} />
                    <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl sm:text-2xl">{getSubjectIcon(attempt.exams.subject)}</span>
                          <div className="min-w-0">
                            <CardTitle className="text-sm sm:text-lg line-clamp-1">{attempt.exams.title}</CardTitle>
                            <div className="flex gap-1.5 sm:gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">{attempt.exams.subject}</Badge>
                              <Badge variant="outline" className="text-[10px] sm:text-xs">{attempt.exams.grade_level}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{attempt.exams.description}</p>
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
                          <Badge 
                            variant={attempt.status === 'graded' ? (isPassed ? 'default' : 'destructive') : 'secondary'}
                            className={`text-[10px] sm:text-xs ${isPassed ? 'bg-[hsl(var(--success))]' : ''}`}
                          >
                            {attempt.status === 'graded' ? (isPassed ? '✓ Passed' : '✗ Failed') : attempt.status}
                          </Badge>
                        </div>
                        {attempt.status === 'graded' && attempt.marks_obtained !== null && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm text-muted-foreground">Score</span>
                              <span className="font-bold text-base sm:text-lg">{attempt.marks_obtained}/{attempt.exams.total_marks}</span>
                            </div>
                            <Progress value={scorePercent} className="h-1.5 sm:h-2" />
                          </>
                        )}
                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{attempt.exams.duration_minutes} min</span>
                          {attempt.exams.exam_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(attempt.exams.exam_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 pt-1 sm:pt-2">
                        {attempt.status === 'graded' && isPassed && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="flex-1 hover-lift text-xs h-8">
                                <Award className="mr-1.5 h-3.5 w-3.5" />Certificate
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] sm:max-w-[900px]">
                              <DialogHeader><DialogTitle>🎉 Congratulations! Your Certificate</DialogTitle></DialogHeader>
                              <ExamCertificate studentName={profile?.full_name || ''} examTitle={attempt.exams.title} score={attempt.marks_obtained || 0} totalMarks={attempt.exams.total_marks} date={attempt.graded_at || attempt.completed_at || ''} />
                            </DialogContent>
                          </Dialog>
                        )}
                        {attempt.status === 'pending' && (
                          <Button size="sm" onClick={() => handleTakeExam(attempt.id)} className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-xs h-8">
                            <Play className="mr-1.5 h-3.5 w-3.5" />Start Exam
                          </Button>
                        )}
                        {attempt.status === 'graded' && (
                          <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => navigate(`/exam/review/${attempt.id}`)}>
                            <BookOpen className="mr-1.5 h-3.5 w-3.5" />Review
                          </Button>
                        )}
                        {attempt.status === 'completed' && (
                          <Button variant="outline" size="sm" className="flex-1 text-xs h-8" disabled>
                            <Check className="mr-1.5 h-3.5 w-3.5" />Awaiting Grade
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Exams Section */}
        <div id="section-available" />
        <div id="tour-available">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-secondary to-[hsl(var(--fun-coral))] flex items-center justify-center shadow-lg">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-foreground" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold">Available Exams</h2>
              <p className="text-xs sm:text-base text-muted-foreground">New challenges await! Pick an exam to start</p>
            </div>
          </div>

          {unregisteredExams.length === 0 ? (
            <Card className="hover-lift">
              <CardContent className="py-8 sm:py-12 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Zap className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No Exams Available</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  {profile?.class_id 
                    ? "No new exams are assigned to your class yet. Check back later! 📚"
                    : "You haven't been assigned to a class yet. Contact your school administrator. 🏫"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {unregisteredExams.map((exam) => (
                <Card key={exam.id} className="hover-lift overflow-hidden group border-dashed border-2 hover:border-solid hover:border-primary/50 transition-all">
                  <div className={`h-1.5 sm:h-2 ${getSubjectColor(exam.subject)} opacity-50 group-hover:opacity-100 transition-opacity`} />
                  <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center text-xl sm:text-2xl group-hover:scale-110 transition-transform shrink-0">
                        {getSubjectIcon(exam.subject)}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm sm:text-lg">{exam.title}</CardTitle>
                        <div className="flex gap-1.5 sm:gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">{exam.subject}</Badge>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{exam.grade_level}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{exam.description}</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 text-center">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-muted-foreground" /><span className="font-medium text-[10px] sm:text-xs">{exam.duration_minutes} min</span>
                      </div>
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 text-center">
                        <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-muted-foreground" /><span className="font-medium text-[10px] sm:text-xs">{exam.total_marks} marks</span>
                      </div>
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 text-center">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-muted-foreground" /><span className="font-medium text-[10px] sm:text-xs">Pass: {exam.passing_marks}</span>
                      </div>
                      {exam.exam_date && (
                        <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 text-center">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 text-muted-foreground" /><span className="font-medium text-[10px] sm:text-xs">{new Date(exam.exam_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      onClick={() => handleRegisterExam(exam.id)} 
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 group-hover:shadow-primary transition-shadow text-xs sm:text-sm h-8 sm:h-10"
                    >
                      <Brain className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />Take This Exam
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Resit Exams Section */}
        {(() => {
          // Show resit section if there are openings for this student's class
          // that the student has already completed/graded
          const completedExamIds = examAttempts
            .filter(a => a.status === 'graded' || a.status === 'completed')
            .map(a => a.exam_id);
          
          const relevantOpenings = resitOpenings.filter((o: any) => completedExamIds.includes(o.exam_id));
          
          if (relevantOpenings.length === 0) return null;

          return (
            <div>
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--warning))] to-[hsl(var(--fun-coral))] flex items-center justify-center shadow-lg">
                  <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold">Resit Exams</h2>
                  <p className="text-xs sm:text-base text-muted-foreground">Apply for a chance to retake exams</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {relevantOpenings.map((opening: any) => {
                  const exam = examAttempts.find(a => a.exam_id === opening.exam_id)?.exams;
                  const originalAttempt = examAttempts.find(a => a.exam_id === opening.exam_id && (a.status === 'graded' || a.status === 'completed'));
                  const existingRequest = resitRequests.find((r: any) => r.exam_id === opening.exam_id);
                  const hasApprovedResitAttempt = examAttempts.some(a => a.exam_id === opening.exam_id && (a.status === 'pending' || a.status === 'in_progress'));
                  
                  if (!exam) return null;

                  return (
                    <Card key={opening.id} className="hover-lift overflow-hidden border-[hsl(var(--warning))]/30">
                      <div className="h-1.5 sm:h-2 bg-gradient-to-r from-[hsl(var(--warning))] to-[hsl(var(--fun-coral))]" />
                      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm sm:text-lg">{exam.title}</CardTitle>
                            <div className="flex gap-1.5 sm:gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] sm:text-xs">{exam.subject}</Badge>
                              <Badge variant="outline" className="text-[10px] sm:text-xs bg-[hsl(var(--warning))]/10">Resit</Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                        {originalAttempt && originalAttempt.marks_obtained !== null && (
                          <div className="p-2.5 sm:p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Original Score</p>
                            <p className="font-bold text-base sm:text-lg">{originalAttempt.marks_obtained}/{exam.total_marks}</p>
                          </div>
                        )}
                        
                        {opening.deadline && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Deadline: {new Date(opening.deadline).toLocaleString()}
                          </p>
                        )}

                        {!existingRequest && !hasApprovedResitAttempt && (
                          <Button 
                            onClick={() => handleApplyResit(opening.exam_id, opening.class_id)}
                            disabled={applyingResit === opening.exam_id}
                            className="w-full text-xs sm:text-sm h-8 sm:h-10"
                            variant="outline"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                            {applyingResit === opening.exam_id ? 'Applying...' : 'Apply for Resit'}
                          </Button>
                        )}

                        {existingRequest?.status === 'pending' && (
                          <Badge variant="secondary" className="w-full justify-center py-1.5 sm:py-2 text-xs">
                            <Clock className="mr-1.5 h-3.5 w-3.5" /> Awaiting Approval
                          </Badge>
                        )}

                        {existingRequest?.status === 'approved' && !hasApprovedResitAttempt && (
                          <Button 
                            onClick={() => handleRegisterExam(opening.exam_id)}
                            className="w-full bg-gradient-to-r from-[hsl(var(--success))] to-primary hover:opacity-90 text-xs sm:text-sm h-8 sm:h-10"
                          >
                            <Play className="mr-1.5 h-3.5 w-3.5" /> Take Resit Exam
                          </Button>
                        )}

                        {existingRequest?.status === 'rejected' && (
                          <div className="space-y-1">
                            <Badge variant="destructive" className="w-full justify-center py-1.5 sm:py-2 text-xs">
                              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Rejected
                            </Badge>
                            {existingRequest.admin_note && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground text-center">{existingRequest.admin_note}</p>
                            )}
                          </div>
                        )}

                        {hasApprovedResitAttempt && (
                          <Badge variant="default" className="w-full justify-center py-1.5 sm:py-2 bg-primary text-xs">
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" /> Resit Registered
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </main>
      <ChatBubble />
      <AIStudyAssistant />
      <MobileBottomNav items={studentNavItems} />
    </div>
  );
}
