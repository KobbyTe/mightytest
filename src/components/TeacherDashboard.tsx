import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SchoolManagement from '@/components/admin/SchoolManagement';
import ExamAssignment from '@/components/admin/ExamAssignment';
import StudentManagement from '@/components/admin/StudentManagement';
import RegistrationKeyManagement from '@/components/admin/RegistrationKeyManagement';
import ResitManagement from '@/components/admin/ResitManagement';
import { ChatBubble } from '@/components/ChatBubble';
import { NotificationBell } from '@/components/NotificationBell';
import { TeacherOnboardingTour } from '@/components/TeacherOnboardingTour';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  LogOut, GraduationCap, Plus, Calendar, Users, FileText, Building2,
  HelpCircle, FileQuestion, Edit, Trash2, Eye, CheckCircle, Clock,
  ShieldCheck, Mail, Phone, BookOpen, Award, User, Copy, ClipboardList, Key, Briefcase,
  Trophy, Diamond, Star, TrendingUp, Target, Zap
} from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

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
  student: { full_name: string; email: string; grade: string } | null;
  exam: { title: string; total_marks: number } | null;
}

interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  subject_specialty: string | null;
  status: string;
  school_id: string | null;
  created_at: string | null;
  approved_at: string | null;
  user_id: string;
}

const subjectColors: Record<string, string> = {
  Science: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Technology: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Engineering: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Mathematics: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Robotics: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  AI: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { scopedClassIds, assignments, loading: scopeLoading } = useTeacherScope();

  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [studentCount, setStudentCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Exam dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [formData, setFormData] = useState({
    title: '', description: '', subject: '', grade_level: '',
    duration_minutes: 60, total_marks: 100, passing_marks: 50, exam_date: '', status: 'active',
  });

  useEffect(() => {
    if (scopeLoading || !user) return;
    loadTeacherProfile();
    loadExams();
    checkTeacherOnboarding();
  }, [user, scopeLoading]);

  const loadTeacherProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setTeacher(data);
      if (data.school_id) {
        const { data: school } = await supabase.from('schools').select('name').eq('id', data.school_id).maybeSingle();
        if (school) setSchoolName(school.name);
      }
    }
    // Count students in scoped classes
    if (scopedClassIds && scopedClassIds.length > 0) {
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .in('class_id', scopedClassIds);
      setStudentCount(count || 0);
    }
  };

  const checkTeacherOnboarding = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data || !data.onboarding_completed) {
      setTimeout(() => setShowTour(true), 1000);
    }
  };

  const handleTourComplete = async () => {
    setShowTour(false);
    if (!user) return;
    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: 'user_id' });
  };

  const loadExams = async () => {
    try {
      let examIds: string[] | null = null;
      if (scopedClassIds !== null && scopedClassIds.length > 0) {
        const { data: classExams } = await supabase
          .from('exam_class_assignments')
          .select('exam_id')
          .in('class_id', scopedClassIds);
        examIds = [...new Set((classExams || []).map(ce => ce.exam_id))];
      }

      let examsQuery = supabase
        .from('exams')
        .select('id,title,description,subject,grade_level,duration_minutes,total_marks,passing_marks,exam_date,status')
        .order('created_at', { ascending: false })
        .limit(100);

      if (scopedClassIds !== null) {
        if (examIds && examIds.length > 0) {
          examsQuery = examsQuery.or(`id.in.(${examIds.join(',')}),created_by.eq.${user?.id}`);
        } else {
          examsQuery = examsQuery.eq('created_by', user?.id || '');
        }
      }

      let attemptsQuery = supabase
        .from('exam_attempts')
        .select('id,exam_id,student_id,attempted_at,completed_at,status,marks_obtained,student:students(full_name,email,grade),exam:exams(title,total_marks)')
        .order('attempted_at', { ascending: false })
        .limit(200);

      if (scopedClassIds !== null && examIds && examIds.length > 0) {
        attemptsQuery = attemptsQuery.in('exam_id', examIds);
      } else if (scopedClassIds !== null) {
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
        const { error } = await supabase.from('exams').update(formData).eq('id', editingExam.id);
        if (error) throw error;
        toast.success('Exam updated successfully!');
      } else {
        const { error } = await supabase.from('exams').insert({ ...formData, created_by: user?.id });
        if (error) throw error;
        toast.success('Exam created successfully!');
      }
      setIsDialogOpen(false);
      setEditingExam(null);
      resetForm();
      loadExams();
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Failed to save exam');
    }
  };

  const resetForm = () => setFormData({
    title: '', description: '', subject: '', grade_level: '',
    duration_minutes: 60, total_marks: 100, passing_marks: 50, exam_date: '', status: 'active',
  });

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title, description: exam.description || '', subject: exam.subject || '',
      grade_level: exam.grade_level || '', duration_minutes: exam.duration_minutes || 60,
      total_marks: exam.total_marks, passing_marks: exam.passing_marks,
      exam_date: exam.exam_date ? new Date(exam.exam_date).toISOString().slice(0, 16) : '',
      status: exam.status || 'active',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId);
      if (error) throw error;
      toast.success('Exam deleted successfully!');
      loadExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error('Failed to delete exam');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const activeExams = exams.filter(e => e.status === 'active').length;
  const initials = teacher?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'T';
  const accountAge = teacher?.created_at
    ? Math.floor((Date.now() - new Date(teacher.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // ─── PERFORMANCE CALCULATIONS ───
  const gradedAttempts = attempts.filter(a => a.status === 'graded' && a.marks_obtained !== null && a.exam?.total_marks);
  
  const avgStudentScore = gradedAttempts.length > 0
    ? gradedAttempts.reduce((sum, a) => sum + ((a.marks_obtained! / (a.exam?.total_marks || 1)) * 100), 0) / gradedAttempts.length
    : 0;

  const passRate = gradedAttempts.length > 0
    ? (gradedAttempts.filter(a => {
        const exam = exams.find(e => e.id === a.exam_id);
        return a.marks_obtained! >= (exam?.passing_marks || 50);
      }).length / gradedAttempts.length) * 100
    : 0;

  const completedAttempts = attempts.filter(a => ['completed', 'graded'].includes(a.status || ''));
  const completionRate = attempts.length > 0 ? (completedAttempts.length / attempts.length) * 100 : 0;

  const engagementFactor = Math.min(100, (studentCount / Math.max(1, assignments.length * 10)) * 100);

  const performanceScore = Math.round(
    (avgStudentScore * 0.4) + (passRate * 0.3) + (completionRate * 0.2) + (engagementFactor * 0.1)
  );

  const getAwardTier = (score: number) => {
    if (score >= 90) return { label: 'Diamond Educator', icon: Diamond, color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30', gradient: 'from-cyan-500/20 to-cyan-500/5' };
    if (score >= 75) return { label: 'Gold Educator', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', gradient: 'from-yellow-500/20 to-yellow-500/5' };
    if (score >= 60) return { label: 'Silver Educator', icon: Star, color: 'text-slate-300', bg: 'bg-slate-400/15 border-slate-400/30', gradient: 'from-slate-400/20 to-slate-400/5' };
    return { label: 'Bronze Educator', icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/15 border-amber-600/30', gradient: 'from-amber-600/20 to-amber-600/5' };
  };

  const awardTier = getAwardTier(performanceScore);

  // Top performing students
  const studentScores: Record<string, { name: string; totalPercent: number; count: number }> = {};
  gradedAttempts.forEach(a => {
    const key = a.student_id;
    const pct = (a.marks_obtained! / (a.exam?.total_marks || 1)) * 100;
    if (!studentScores[key]) studentScores[key] = { name: a.student?.full_name || 'Unknown', totalPercent: 0, count: 0 };
    studentScores[key].totalPercent += pct;
    studentScores[key].count += 1;
  });
  const topStudents = Object.entries(studentScores)
    .map(([id, s]) => ({ id, name: s.name, avg: Math.round(s.totalPercent / s.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  const performanceMetrics = [
    { label: 'Avg Student Score', value: Math.round(avgStudentScore), icon: Target, color: 'text-primary', weight: '40%' },
    { label: 'Pass Rate', value: Math.round(passRate), icon: CheckCircle, color: 'text-emerald-500', weight: '30%' },
    { label: 'Completion Rate', value: Math.round(completionRate), icon: TrendingUp, color: 'text-amber-500', weight: '20%' },
    { label: 'Engagement', value: Math.round(engagementFactor), icon: Zap, color: 'text-violet-500', weight: '10%' },
  ];

  const gaugeData = [{ name: 'Score', value: performanceScore, fill: performanceScore >= 90 ? 'hsl(var(--primary))' : performanceScore >= 75 ? '#facc15' : performanceScore >= 60 ? '#94a3b8' : '#d97706' }];

  if (loadingData || scopeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* ─── HEADER ─── */}
      <header className="relative overflow-hidden border-b bg-background/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-accent/5 to-secondary/8 pointer-events-none" />
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-0 relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative cursor-pointer shrink-0" onClick={() => setShowProfile(true)}>
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/40 shadow-lg">
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-base sm:text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-foreground tracking-tight truncate">
                Welcome back, {teacher?.full_name?.split(' ')[0] || 'Educator'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                Verified Educator
                {schoolName && <span className="text-muted-foreground/60 hidden sm:inline">• {schoolName}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={() => setShowProfile(true)} className="hidden sm:flex gap-2 text-xs h-8">
              <User className="h-3.5 w-3.5" />
              My Profile
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTour(true)} title="Take Tour">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* ─── STAT CARDS ─── */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {[
            { label: 'Total Exams', value: exams.length, icon: FileText, gradient: 'from-primary/15 to-primary/5', iconColor: 'text-primary' },
            { label: 'Active Exams', value: activeExams, icon: Calendar, gradient: 'from-emerald-500/15 to-emerald-500/5', iconColor: 'text-emerald-500' },
            { label: 'Assigned Classes', value: assignments.length, icon: Building2, gradient: 'from-amber-500/15 to-amber-500/5', iconColor: 'text-amber-500' },
            { label: 'Students', value: studentCount, icon: Users, gradient: 'from-violet-500/15 to-violet-500/5', iconColor: 'text-violet-500' },
            { label: 'Performance', value: `${performanceScore}%`, icon: awardTier.icon, gradient: awardTier.gradient, iconColor: awardTier.color, extra: awardTier.label },
          ].map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="border-border/50 bg-background/60 backdrop-blur-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                  <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.extra || stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* ─── TABS ─── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Tabs defaultValue="exams" className="w-full">
            <Card className="border-border/50 bg-background/60 backdrop-blur-sm mb-4">
              <CardContent className="p-1.5">
                <TabsList className="w-full bg-transparent gap-1 flex overflow-x-auto">
                  {[
                    { value: 'exams', label: 'Exams', icon: FileText, count: exams.length },
                    { value: 'performance', label: 'Performance', icon: Trophy },
                    { value: 'schools', label: 'Schools', icon: Building2 },
                    { value: 'assignments', label: 'Assignments', icon: ClipboardList },
                    { value: 'attempts', label: 'Attempts', icon: Eye, count: attempts.length },
                    { value: 'students', label: 'Students', icon: Users },
                    { value: 'keys', label: 'Keys', icon: Key },
                    { value: 'resits', label: 'Resits', icon: Award },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      id={`teacher-tour-${tab.value}`}
                      className="flex items-center gap-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-3 py-2 transition-all"
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className="ml-1 text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium">
                          {tab.count}
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </CardContent>
            </Card>

            {/* ── Exams Tab ── */}
            <TabsContent value="exams" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-foreground">Manage Exams</h2>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) { setEditingExam(null); resetForm(); }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Exam
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
                      <DialogDescription>
                        {editingExam ? 'Update the exam details below.' : 'Fill in the details to create a new exam.'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateExam} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Exam Title</Label>
                        <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Subject</Label>
                          <Select value={formData.subject} onValueChange={(v) => setFormData({ ...formData, subject: v })}>
                            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                            <SelectContent>
                              {['Science', 'Technology', 'Engineering', 'Mathematics', 'Robotics', 'AI'].map(s => (
                                <SelectItem key={s} value={s}>{s === 'AI' ? 'Artificial Intelligence' : s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Grade Level</Label>
                          <Select value={formData.grade_level} onValueChange={(v) => setFormData({ ...formData, grade_level: v })}>
                            <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                            <SelectContent>
                              {['Grade 1-3', 'Grade 4-6', 'Grade 7-9', 'Grade 10-12'].map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div><Label>Duration (min)</Label><Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })} /></div>
                        <div><Label>Total Marks</Label><Input type="number" value={formData.total_marks} onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })} /></div>
                        <div><Label>Passing Marks</Label><Input type="number" value={formData.passing_marks} onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })} /></div>
                      </div>
                      <div>
                        <Label>Exam Date & Time</Label>
                        <Input type="datetime-local" value={formData.exam_date} onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })} />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full">{editingExam ? 'Update Exam' : 'Create Exam'}</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exams.map((exam) => (
                  <Card key={exam.id} className="group border-border/50 bg-background/60 backdrop-blur-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base flex-1 leading-tight">{exam.title}</CardTitle>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/admin/exam/${exam.id}/questions`)} title="Questions">
                            <FileQuestion className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditExam(exam)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteExam(exam.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <Badge variant="secondary" className={`text-[10px] border ${subjectColors[exam.subject] || ''}`}>{exam.subject}</Badge>
                        <Badge variant="outline" className="text-[10px]">{exam.grade_level}</Badge>
                        <Badge variant={exam.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{exam.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {exam.description && <p className="text-xs text-muted-foreground line-clamp-2">{exam.description}</p>}
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                        <span>{exam.duration_minutes}min</span>
                        <span className="text-right">{exam.total_marks}pts (Pass: {exam.passing_marks})</span>
                        {exam.exam_date && <span className="col-span-2">{new Date(exam.exam_date).toLocaleDateString()}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {exams.length === 0 && (
                  <Card className="col-span-full border-dashed">
                    <CardContent className="py-12 text-center">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">No exams yet. Create your first exam to get started.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── Performance Tab ── */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score Gauge */}
                <Card className="border-border/50 bg-background/60 backdrop-blur-sm lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <awardTier.icon className={`h-5 w-5 ${awardTier.color}`} />
                      {awardTier.label}
                    </CardTitle>
                    <CardDescription>Your educator effectiveness rating</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="relative w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={14}>
                          <RadialBar background dataKey="value" cornerRadius={10} max={100} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          className="text-4xl font-bold text-foreground"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, type: 'spring' }}
                        >
                          {performanceScore}
                        </motion.span>
                        <span className="text-xs text-muted-foreground">out of 100</span>
                      </div>
                    </div>
                    {gradedAttempts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">No graded attempts yet. Score will update as students complete exams.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Metrics Breakdown */}
                <Card className="border-border/50 bg-background/60 backdrop-blur-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Breakdown</CardTitle>
                    <CardDescription>Weighted metrics that determine your score</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {performanceMetrics.map((metric) => (
                      <div key={metric.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <metric.icon className={`h-4 w-4 ${metric.color}`} />
                            <span className="text-sm font-medium">{metric.label}</span>
                            <Badge variant="outline" className="text-[10px]">{metric.weight}</Badge>
                          </div>
                          <span className="text-sm font-bold">{metric.value}%</span>
                        </div>
                        <Progress value={metric.value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Students Leaderboard */}
                <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-400" />
                      Top Performing Students
                    </CardTitle>
                    <CardDescription>Your highest-scoring students by average</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No graded results yet</p>
                    ) : (
                      <div className="space-y-3">
                        {topStudents.map((student, idx) => (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                          >
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                              idx === 0 ? 'bg-yellow-500/15 text-yellow-400' :
                              idx === 1 ? 'bg-slate-400/15 text-slate-300' :
                              idx === 2 ? 'bg-amber-600/15 text-amber-500' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              #{idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{student.name}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs font-bold">{student.avg}%</Badge>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Award Tiers Guide */}
                <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Award Tiers</CardTitle>
                    <CardDescription>Performance milestones and recognition levels</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'Diamond Educator', range: '90-100', icon: Diamond, color: 'text-cyan-400', bg: 'bg-cyan-500/10', active: performanceScore >= 90 },
                      { label: 'Gold Educator', range: '75-89', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10', active: performanceScore >= 75 && performanceScore < 90 },
                      { label: 'Silver Educator', range: '60-74', icon: Star, color: 'text-slate-300', bg: 'bg-slate-400/10', active: performanceScore >= 60 && performanceScore < 75 },
                      { label: 'Bronze Educator', range: '0-59', icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10', active: performanceScore < 60 },
                    ].map((tier) => (
                      <div
                        key={tier.label}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          tier.active ? `${tier.bg} border-current/20 ring-1 ring-current/10` : 'bg-muted/20 border-border/50 opacity-60'
                        }`}
                      >
                        <tier.icon className={`h-5 w-5 ${tier.color} shrink-0`} />
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${tier.active ? tier.color : 'text-muted-foreground'}`}>{tier.label}</p>
                          <p className="text-xs text-muted-foreground">Score: {tier.range}</p>
                        </div>
                        {tier.active && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Current</Badge>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="schools"><SchoolManagement /></TabsContent>
            <TabsContent value="assignments"><ExamAssignment /></TabsContent>

            {/* ── Attempts Tab ── */}
            <TabsContent value="attempts">
              <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Student Exam Attempts</CardTitle>
                  <CardDescription>View and manage all student submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Student</TableHead>
                          <TableHead className="min-w-[180px]">Exam</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead className="min-w-[130px]">Submitted</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attempts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No exam attempts yet</TableCell>
                          </TableRow>
                        ) : (
                          attempts.map((attempt) => (
                            <TableRow key={attempt.id} className="hover:bg-muted/30">
                              <TableCell>
                                <p className="font-medium text-sm">{attempt.student?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{attempt.student?.email || ''}</p>
                              </TableCell>
                              <TableCell className="font-medium text-sm">{attempt.exam?.title || 'Unknown'}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px]">{attempt.student?.grade || 'N/A'}</Badge></TableCell>
                              <TableCell>
                                {attempt.status === 'graded' && <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><CheckCircle className="h-3 w-3" />Graded</Badge>}
                                {attempt.status === 'completed' && <Badge className="gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Completed</Badge>}
                                {attempt.status === 'pending' && <Badge variant="secondary" className="gap-1 text-[10px]"><Clock className="h-3 w-3" />In Progress</Badge>}
                                {attempt.status === 'grading' && <Badge variant="secondary" className="gap-1 text-[10px]"><Clock className="h-3 w-3" />Awaiting Grade</Badge>}
                              </TableCell>
                              <TableCell>
                                {attempt.marks_obtained !== null
                                  ? <span className="font-semibold text-sm">{attempt.marks_obtained}/{attempt.exam?.total_marks || 0}</span>
                                  : <span className="text-muted-foreground text-xs">—</span>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(attempt.attempted_at).toLocaleDateString()} {new Date(attempt.attempted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/admin/exam/grade/${attempt.id}`)}>
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  {attempt.status === 'graded' ? 'View' : 'Grade'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students"><StudentManagement /></TabsContent>
            <TabsContent value="keys"><RegistrationKeyManagement /></TabsContent>
            <TabsContent value="resits"><ResitManagement /></TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* ─── MY PROFILE DIALOG ─── */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[85vh]">
          {/* Hero Banner */}
          <div className="relative h-28 bg-gradient-to-br from-primary via-accent to-secondary shrink-0">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-60" />
          </div>

          {/* Profile Header */}
          <div className="relative px-6 pb-3 -mt-10 flex items-end gap-4 shrink-0">
            <Avatar className="h-20 w-20 border-4 border-background shadow-xl rounded-2xl">
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold rounded-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="pb-1 flex-1">
              <h3 className="text-xl font-bold text-foreground">{teacher?.full_name || 'Teacher'}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {teacher?.status === 'approved' && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" />Verified Educator
                  </Badge>
                )}
                <Badge className={`${awardTier.bg} ${awardTier.color} gap-1 text-[10px] border`}>
                  <awardTier.icon className="h-3 w-3" />{awardTier.label} • {performanceScore}%
                </Badge>
                {teacher?.subject_specialty && (
                  <Badge className={`text-[10px] border ${subjectColors[teacher.subject_specialty] || 'bg-muted'}`}>
                    {teacher.subject_specialty}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto px-6 pb-6 space-y-4">
            {/* Teaching Scope */}
            {assignments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Teaching Scope
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assignments.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.class_name || 'Class'}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`text-[10px] border ${subjectColors[a.subject] || 'bg-muted'}`}>{a.subject}</Badge>
                          {a.school_name && <span className="text-[10px] text-muted-foreground truncate">{a.school_name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => copyToClipboard(teacher?.email || '')}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                  <p className="text-sm font-medium truncate">{teacher?.email}</p>
                </div>
                <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => copyToClipboard(teacher?.phone_number || '')}
              >
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium">{teacher?.phone_number || 'Not provided'}</p>
                </div>
                {teacher?.phone_number && <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
            </div>

            {/* Professional Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
                <BookOpen className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Specialty</p>
                <p className="text-sm font-medium">{teacher?.subject_specialty || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
                <Building2 className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">School</p>
                <p className="text-sm font-medium truncate">{schoolName || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
                <GraduationCap className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Teacher ID</p>
                <p className="text-sm font-mono font-medium">TCH-{teacher?.id?.slice(0, 4).toUpperCase()}</p>
              </div>
            </div>

            {/* Account Timeline */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Account Timeline</h4>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary border-2 border-primary/30" />
                  <div className="w-0.5 h-8 bg-border" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-emerald-500/30" />
                </div>
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-medium">Account Registered</p>
                    <p className="text-xs text-muted-foreground">
                      {teacher?.created_at ? new Date(teacher.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Verified & Approved</p>
                    <p className="text-xs text-muted-foreground">
                      {teacher?.approved_at ? new Date(teacher.approved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Badge */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Identity Verified</p>
                <p className="text-xs text-muted-foreground">Active for {accountAge} days • Secure educator account</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChatBubble />
      <TeacherOnboardingTour isActive={showTour} onComplete={handleTourComplete} />
    </div>
  );
}
