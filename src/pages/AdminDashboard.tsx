import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LogOut, GraduationCap, Plus, Calendar, Users, FileText, BarChart3, Building2, ClipboardList, Key, UserCheck, HelpCircle, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Edit, Eye, FileQuestion, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SchoolManagement from '@/components/admin/SchoolManagement';
import ExamAssignment from '@/components/admin/ExamAssignment';
import StudentManagement from '@/components/admin/StudentManagement';
import RegistrationKeyManagement from '@/components/admin/RegistrationKeyManagement';
import WebsiteAnalytics from '@/components/admin/WebsiteAnalytics';
import ResitManagement from '@/components/admin/ResitManagement';
import TeacherManagement from '@/components/admin/TeacherManagement';
import { ChatBubble } from '@/components/ChatBubble';
import { NotificationBell } from '@/components/NotificationBell';
import { TeacherOnboardingTour } from '@/components/TeacherOnboardingTour';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import TeacherDashboard from '@/components/TeacherDashboard';

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
  exam_id: string;
  student_id: string;
  attempted_at: string;
  completed_at: string | null;
  status: string;
  marks_obtained: number | null;
  student: {
    full_name: string;
    email: string;
    grade: string;
  } | null;
  exam: {
    title: string;
    total_marks: number;
  } | null;
}

export default function AdminDashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [bulkGrading, setBulkGrading] = useState(false);
  const [bulkGradingProgress, setBulkGradingProgress] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    grade_level: '',
    duration_minutes: 60,
    total_marks: 100,
    passing_marks: 50,
    exam_date: '',
    status: 'active'
  });

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const dashboardTitle = isAdmin ? 'Admin Dashboard' : 'Teacher/Educator Dashboard';
  const { scopedClassIds, assignments, loading: scopeLoading } = useTeacherScope();

  useEffect(() => {
    if (loading || scopeLoading) return;
    
    if (!user) {
      navigate('/auth');
    } else if (role !== 'admin' && role !== 'teacher') {
      navigate('/dashboard');
    } else {
      loadExams();
      // Check if teacher needs onboarding tour
      if (role === 'teacher') {
        checkTeacherOnboarding();
      }
    }
  }, [user, loading, scopeLoading, role, navigate]);

  const checkTeacherOnboarding = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!data || !data.onboarding_completed) {
        // Delay slightly so the UI renders first
        setTimeout(() => setShowTour(true), 1000);
      }
    } catch (err) {
      console.error('Error checking onboarding:', err);
    }
  };

  const handleTourComplete = async () => {
    setShowTour(false);
    if (!user) return;
    try {
      await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Error saving onboarding status:', err);
    }
  };

  const loadExams = async () => {
    try {
      // If teacher is scoped to specific classes, only load relevant exams
      let examIds: string[] | null = null;

      if (scopedClassIds !== null && scopedClassIds.length > 0) {
        // Get exam IDs assigned to the teacher's classes
        const { data: classExams } = await supabase
          .from('exam_class_assignments')
          .select('exam_id')
          .in('class_id', scopedClassIds);
        examIds = [...new Set((classExams || []).map(ce => ce.exam_id))];
      }

      // Build exam query
      let examsQuery = supabase
        .from('exams')
        .select('id,title,description,subject,grade_level,duration_minutes,total_marks,passing_marks,exam_date,status')
        .order('created_at', { ascending: false })
        .limit(100);

      // If scoped, filter by exam IDs or created_by
      if (scopedClassIds !== null) {
        if (examIds && examIds.length > 0) {
          // Show exams assigned to teacher's classes OR created by this teacher
          examsQuery = examsQuery.or(`id.in.(${examIds.join(',')}),created_by.eq.${user?.id}`);
        } else {
          // No class assignments yet — only show exams created by this teacher
          examsQuery = examsQuery.eq('created_by', user?.id || '');
        }
      }

      // Build attempts query
      let attemptsQuery = supabase
        .from('exam_attempts')
        .select('id,exam_id,student_id,attempted_at,completed_at,status,marks_obtained,student:students(full_name,email,grade),exam:exams(title,total_marks)')
        .order('attempted_at', { ascending: false })
        .limit(200);

      if (scopedClassIds !== null && examIds && examIds.length > 0) {
        attemptsQuery = attemptsQuery.in('exam_id', examIds);
      } else if (scopedClassIds !== null) {
        // No exams → no attempts
        attemptsQuery = attemptsQuery.eq('exam_id', '00000000-0000-0000-0000-000000000000');
      }

      const [examsRes, attemptsRes] = await Promise.all([examsQuery, attemptsQuery]);

      if (examsRes.error) throw examsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;

      setExams(examsRes.data || []);
      setAttempts(attemptsRes.data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
      toast.error('Failed to load exams');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExam) {
        const { error } = await supabase
          .from('exams')
          .update(formData)
          .eq('id', editingExam.id);

        if (error) throw error;
        toast.success('Exam updated successfully!');
      } else {
        const { error } = await supabase
          .from('exams')
          .insert({
            ...formData,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success('Exam created successfully!');
      }
      
      setIsDialogOpen(false);
      setEditingExam(null);
      setFormData({
        title: '',
        description: '',
        subject: '',
        grade_level: '',
        duration_minutes: 60,
        total_marks: 100,
        passing_marks: 50,
        exam_date: '',
        status: 'active'
      });
      loadExams();
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Failed to save exam');
    }
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description || '',
      subject: exam.subject || '',
      grade_level: exam.grade_level || '',
      duration_minutes: exam.duration_minutes || 60,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks,
      exam_date: exam.exam_date ? new Date(exam.exam_date).toISOString().slice(0, 16) : '',
      status: exam.status || 'active'
    });
    setIsDialogOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    
    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (error) throw error;
      toast.success('Exam deleted successfully!');
      loadExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error('Failed to delete exam');
    }
  };

  const handleBulkAiGrade = async () => {
    // Find all completed/grading attempts that haven't been graded yet
    const ungradedAttempts = attempts.filter(a => a.status === 'completed' || a.status === 'grading');
    
    if (ungradedAttempts.length === 0) {
      toast.info('No ungraded submissions to process');
      return;
    }

    setBulkGrading(true);
    let gradedCount = 0;
    let failedCount = 0;

    for (const attempt of ungradedAttempts) {
      setBulkGradingProgress(`Grading ${gradedCount + 1} of ${ungradedAttempts.length}...`);
      
      try {
        // Fetch essay answers for this attempt
        const { data: answersData } = await supabase
          .from('exam_answers')
          .select('id, answer_text, question:exam_questions(question_text, question_type, correct_answer, marks)')
          .eq('attempt_id', attempt.id);

        const essayAnswers = (answersData || []).filter(
          (a: any) => a.question?.question_type === 'essay' || a.question?.question_type === 'short_answer'
        );

        if (essayAnswers.length === 0) {
          // All MCQ/TF — just calculate existing marks
          const { data: allAnswers } = await supabase
            .from('exam_answers')
            .select('marks_awarded')
            .eq('attempt_id', attempt.id);
          
          const totalMarks = (allAnswers || []).reduce((sum: number, a: any) => sum + (a.marks_awarded || 0), 0);
          
          await supabase
            .from('exam_attempts')
            .update({ marks_obtained: totalMarks, status: 'graded', graded_by: user?.id, graded_at: new Date().toISOString() })
            .eq('id', attempt.id);
          
          gradedCount++;
          continue;
        }

        // Call AI auto-grade
        const payload = essayAnswers.map((a: any) => ({
          answerId: a.id,
          questionText: a.question.question_text,
          studentAnswer: a.answer_text,
          correctAnswer: a.question.correct_answer,
          maxMarks: a.question.marks,
        }));

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-grade-essay`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ answers: payload }),
          }
        );

        if (response.status === 429) {
          toast.error('Rate limited. Stopping bulk grading. Try again in a moment.');
          break;
        }
        if (response.status === 402) {
          toast.error('AI credits exhausted. Stopping bulk grading.');
          break;
        }
        if (!response.ok) {
          failedCount++;
          continue;
        }

        const data = await response.json();

        // Apply AI grades to each answer
        for (const result of data.results) {
          await supabase
            .from('exam_answers')
            .update({ marks_awarded: result.suggestedMarks, is_correct: result.suggestedMarks > 0 })
            .eq('id', result.answerId);
        }

        // Calculate total marks across all answers for this attempt
        const { data: allAnswers } = await supabase
          .from('exam_answers')
          .select('marks_awarded')
          .eq('attempt_id', attempt.id);

        const totalMarks = (allAnswers || []).reduce((sum: number, a: any) => sum + (a.marks_awarded || 0), 0);

        await supabase
          .from('exam_attempts')
          .update({
            marks_obtained: totalMarks,
            status: 'graded',
            feedback: 'Graded by AI — review recommended',
            graded_by: user?.id,
            graded_at: new Date().toISOString(),
          })
          .eq('id', attempt.id);

        gradedCount++;
      } catch (error) {
        console.error('Error grading attempt:', attempt.id, error);
        failedCount++;
      }
    }

    setBulkGrading(false);
    setBulkGradingProgress('');
    
    if (gradedCount > 0) {
      toast.success(`AI graded ${gradedCount} submission(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}. Review grades in each attempt.`);
      loadExams();
    } else if (failedCount > 0) {
      toast.error(`Failed to grade ${failedCount} submission(s)`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || loadingData || scopeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  // Render dedicated teacher dashboard
  if (isTeacher) {
    return <TeacherDashboard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header — mobile-first */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3" id="teacher-tour-welcome">
            <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            <h1 className="text-lg sm:text-2xl font-bold truncate">{dashboardTitle}</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <NotificationBell />
            {isTeacher && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTour(true)} title="Take Tour">
                <HelpCircle className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/analytics')} className="h-8 sm:h-9 text-xs sm:text-sm">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 sm:h-9 text-xs sm:text-sm">
              <LogOut className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        <NotificationPermissionBanner />
        {/* Teacher Scope Indicator */}
        {isTeacher && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Your Assigned Classes</p>
                  {assignments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {assignments.map((a, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {a.class_name || 'Unknown'} — {a.subject}
                          {a.school_name && <span className="text-muted-foreground ml-1">({a.school_name})</span>}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      No classes assigned yet. Contact an administrator to get access to specific classes.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="exams" className="w-full">
          {/* Bug #12 fix: Scrollable tabs on small screens */}
           <TabsList className="flex w-full overflow-x-auto scrollbar-none gap-0.5 sm:gap-1 h-auto p-1">
              <TabsTrigger value="exams" id="teacher-tour-exams" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Exams</TabsTrigger>
              <TabsTrigger value="schools" id="teacher-tour-schools" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Schools</TabsTrigger>
              <TabsTrigger value="assignments" id="teacher-tour-assignments" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5"><span className="hidden sm:inline">Assign</span><span className="sm:hidden">Asgn</span></TabsTrigger>
              <TabsTrigger value="attempts" id="teacher-tour-attempts" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5"><span className="hidden sm:inline">Attempts</span><span className="sm:hidden">Atpt</span></TabsTrigger>
              <TabsTrigger value="students" id="teacher-tour-students" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5"><span className="hidden sm:inline">Students</span><span className="sm:hidden">Stud</span></TabsTrigger>
              <TabsTrigger value="keys" id="teacher-tour-keys" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Keys</TabsTrigger>
              <TabsTrigger value="resits" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Resits</TabsTrigger>
            </TabsList>

          <TabsContent value="exams" className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Exams</CardTitle>
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">{exams.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">
                {exams.filter(e => e.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Draft</CardTitle>
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold">
                {exams.filter(e => e.status === 'draft').length}
              </div>
            </CardContent>
          </Card>
            </div>

            {/* Exams Management */}
            <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-2xl font-bold">Manage Exams</h2>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingExam(null);
                setFormData({
                  title: '',
                  description: '',
                  subject: '',
                  grade_level: '',
                  duration_minutes: 60,
                  total_marks: 100,
                  passing_marks: 50,
                  exam_date: '',
                  status: 'active'
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
                  <DialogDescription>
                    {editingExam ? 'Update the exam details below.' : 'Fill in the details to create a new exam for students.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateExam} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Exam Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Select value={formData.subject} onValueChange={(value) => setFormData({ ...formData, subject: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Engineering">Engineering</SelectItem>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="Robotics">Robotics</SelectItem>
                          <SelectItem value="AI">Artificial Intelligence</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="grade_level">Grade Level</Label>
                      <Select value={formData.grade_level} onValueChange={(value) => setFormData({ ...formData, grade_level: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Grade 1-3">Grade 1-3</SelectItem>
                          <SelectItem value="Grade 4-6">Grade 4-6</SelectItem>
                          <SelectItem value="Grade 7-9">Grade 7-9</SelectItem>
                          <SelectItem value="Grade 10-12">Grade 10-12</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="duration">Duration (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration_minutes}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="total_marks">Total Marks</Label>
                      <Input
                        id="total_marks"
                        type="number"
                        value={formData.total_marks}
                        onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="passing_marks">Passing Marks</Label>
                      <Input
                        id="passing_marks"
                        type="number"
                        value={formData.passing_marks}
                        onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="exam_date">Exam Date & Time</Label>
                    <Input
                      id="exam_date"
                      type="datetime-local"
                      value={formData.exam_date}
                      onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">{editingExam ? 'Update Exam' : 'Create Exam'}</Button>
                </form>
              </DialogContent>
            </Dialog>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex-1">{exam.title}</CardTitle>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/admin/exam/${exam.id}/questions`)}
                        title="Manage Questions"
                      >
                        <FileQuestion className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditExam(exam)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExam(exam.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs flex-wrap">
                    <Badge variant="secondary">{exam.subject}</Badge>
                    <Badge variant="outline">{exam.grade_level}</Badge>
                    <Badge variant={exam.status === 'active' ? 'default' : 'secondary'}>
                      {exam.status}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {exam.description}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{exam.duration_minutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Marks:</span>
                      <span className="font-medium">{exam.total_marks} (Pass: {exam.passing_marks})</span>
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
                </CardContent>
              </Card>
                ))}
              </div>
            </div>
          </TabsContent>

            <TabsContent value="schools" className="space-y-6">
              <SchoolManagement />
            </TabsContent>

            <TabsContent value="assignments" className="space-y-6">
              <ExamAssignment />
            </TabsContent>

          <TabsContent value="attempts" className="space-y-3 sm:space-y-4">
            {/* Bulk AI Grading */}
            {attempts.some(a => a.status === 'completed' || a.status === 'grading') && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 sm:py-4 px-3 sm:px-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm sm:text-base">Bulk AI Grading</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {bulkGrading ? bulkGradingProgress : `Auto-grade ${attempts.filter(a => a.status === 'completed' || a.status === 'grading').length} pending submission(s)`}
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleBulkAiGrade} disabled={bulkGrading} size="sm" className="self-end sm:self-auto text-xs sm:text-sm h-8 sm:h-9">
                    {bulkGrading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Grading...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Auto-Grade All
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="text-base sm:text-2xl">Student Exam Attempts</CardTitle>
                <CardDescription className="text-xs sm:text-sm">View and manage all student exam submissions</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Student</TableHead>
                        <TableHead className="min-w-[200px]">Exam</TableHead>
                        <TableHead className="min-w-[100px]">Grade</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Score</TableHead>
                        <TableHead className="min-w-[150px]">Submitted</TableHead>
                        <TableHead className="min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {attempts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No exam attempts yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        attempts.map((attempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{attempt.student?.full_name || 'Unknown Student'}</p>
                                <p className="text-xs text-muted-foreground">{attempt.student?.email || 'No email'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{attempt.exam?.title || 'Unknown Exam'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{attempt.student?.grade || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              {attempt.status === 'graded' && (
                                <Badge variant="default" className="gap-1 bg-[hsl(var(--success))]">
                                  <CheckCircle className="h-3 w-3" />Graded
                                </Badge>
                              )}
                              {attempt.status === 'completed' && (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle className="h-3 w-3" />Completed
                                </Badge>
                              )}
                              {attempt.status === 'pending' && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />In Progress
                                </Badge>
                              )}
                              {attempt.status === 'grading' && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />Awaiting Grading
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {attempt.marks_obtained !== null ? (
                                <span className="font-semibold">
                                  {attempt.marks_obtained}/{attempt.exam?.total_marks || 0}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not graded</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(attempt.attempted_at).toLocaleDateString()} {new Date(attempt.attempted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/admin/exam/grade/${attempt.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {attempt.status === 'graded' ? 'View' : 'Grade'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden space-y-2">
                  {attempts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">No exam attempts yet</p>
                  ) : (
                    attempts.map((attempt) => (
                      <div key={attempt.id} className="p-3 rounded-xl border bg-card space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{attempt.student?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{attempt.exam?.title || 'Unknown Exam'}</p>
                          </div>
                          {attempt.status === 'graded' && (
                            <Badge className="bg-[hsl(var(--success))] text-[10px] shrink-0">Graded</Badge>
                          )}
                          {attempt.status === 'completed' && (
                            <Badge className="text-[10px] shrink-0">Completed</Badge>
                          )}
                          {(attempt.status === 'pending' || attempt.status === 'grading') && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">{attempt.status === 'pending' ? 'In Progress' : 'Awaiting'}</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {new Date(attempt.attempted_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {attempt.marks_obtained !== null && (
                              <span className="font-semibold">{attempt.marks_obtained}/{attempt.exam?.total_marks || 0}</span>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => navigate(`/admin/exam/grade/${attempt.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              {attempt.status === 'graded' ? 'View' : 'Grade'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="keys">
            <RegistrationKeyManagement />
          </TabsContent>

          <TabsContent value="resits">
            <ResitManagement />
          </TabsContent>

        </Tabs>
      </main>
      <ChatBubble />
      {isTeacher && (
        <TeacherOnboardingTour isActive={showTour} onComplete={handleTourComplete} />
      )}
    </div>
  );
}
