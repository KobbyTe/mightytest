import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  LogOut, GraduationCap, Users, FileText, BarChart3, TrendingUp, Target, Award,
  UserCheck, Building2, Activity, BookOpen, Shield, ChevronUp, ChevronDown, Zap,
  Eye, Clock, Sparkles, ArrowUpRight, LayoutDashboard, School, UserCog, Globe
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import SchoolManagement from '@/components/admin/SchoolManagement';
import TeacherManagement from '@/components/admin/TeacherManagement';
import StudentManagement from '@/components/admin/StudentManagement';
import WebsiteAnalytics from '@/components/admin/WebsiteAnalytics';
import { NotificationBell } from '@/components/NotificationBell';

const CHART_COLORS = [
  'hsl(166, 73%, 42%)',   // success green
  'hsl(194, 100%, 42%)',  // accent blue
  'hsl(45, 100%, 51%)',   // primary gold
  'hsl(277, 81%, 59%)',   // purple
  'hsl(0, 84%, 60%)',     // destructive red
];

const GRADE_COLORS: Record<string, string> = {
  A: 'hsl(166, 73%, 42%)',
  B: 'hsl(194, 100%, 42%)',
  C: 'hsl(45, 100%, 51%)',
  D: 'hsl(18, 100%, 60%)',
  F: 'hsl(0, 84%, 60%)',
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  gradient: string;
  delay: number;
}

function KPICard({ title, value, subtitle, icon, trend, gradient, delay }: KPICardProps) {
  return (
    <motion.div custom={delay} variants={fadeUp} initial="hidden" animate="visible">
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-1 group">
        <div className={`absolute inset-0 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity duration-500 ${gradient}`} />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`p-2 rounded-xl ${gradient} text-white shadow-md`}>
            {icon}
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          <div className="flex items-center gap-2 mt-1">
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend !== undefined && (
              <span className={`inline-flex items-center text-xs font-semibold ${trend >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                {trend >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl p-3 shadow-xl">
      <p className="text-sm font-semibold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const tabItems = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'students', label: 'Students', icon: GraduationCap },
  { value: 'teachers', label: 'Teachers', icon: UserCog },
  { value: 'exams', label: 'Exam Analytics', icon: BarChart3 },
  { value: 'schools', label: 'Schools', icon: School },
  { value: 'traffic', label: 'Site Traffic', icon: Globe },
];

export default function NewAdminDashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0, totalTeachers: 0, pendingTeachers: 0,
    totalExams: 0, activeExams: 0, totalAttempts: 0, passRate: 0, averageScore: 0,
  });
  const [enrollmentData, setEnrollmentData] = useState<{ month: string; count: number }[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<{ subject: string; avgScore: number; count: number }[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ grade: string; count: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<{ name: string; email: string; avgScore: number; exams: number }[]>([]);
  const [examRanking, setExamRanking] = useState<{ title: string; attempts: number; avgScore: number }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth'); return; }
    if (role !== 'admin') { navigate('/dashboard'); return; }
    loadDashboardData();
  }, [user, loading, role, navigate]);

  const loadDashboardData = async () => {
    try {
      const [studentsRes, teachersRes, examsRes, attemptsRes] = await Promise.all([
        supabase.from('students').select('id,full_name,email,created_at,class_id,school_id'),
        supabase.from('teachers').select('id,full_name,email,status,created_at,subject_specialty,school_id'),
        supabase.from('exams').select('id,title,subject,status,total_marks,passing_marks,created_at'),
        supabase.from('exam_attempts').select('id,student_id,exam_id,marks_obtained,status,attempted_at,completed_at,exam:exams(title,subject,total_marks,passing_marks),student:students(full_name,email)').eq('status', 'graded'),
      ]);

      const students = studentsRes.data || [];
      const teachers = teachersRes.data || [];
      const exams = examsRes.data || [];
      const attempts = attemptsRes.data || [];

      const passedCount = attempts.filter(a =>
        a.marks_obtained != null && a.exam?.passing_marks != null &&
        a.marks_obtained >= a.exam.passing_marks
      ).length;

      const totalScorePercent = attempts.reduce((sum, a) => {
        if (a.marks_obtained != null && a.exam?.total_marks) {
          return sum + (a.marks_obtained / a.exam.total_marks) * 100;
        }
        return sum;
      }, 0);

      setStats({
        totalStudents: students.length,
        totalTeachers: teachers.filter(t => t.status === 'approved').length,
        pendingTeachers: teachers.filter(t => t.status === 'pending').length,
        totalExams: exams.length,
        activeExams: exams.filter(e => e.status === 'active').length,
        totalAttempts: attempts.length,
        passRate: attempts.length > 0 ? Math.round((passedCount / attempts.length) * 100) : 0,
        averageScore: attempts.length > 0 ? Math.round(totalScorePercent / attempts.length) : 0,
      });

      // Enrollment trends
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const enrollMap = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        enrollMap.set(`${monthNames[d.getMonth()]}`, 0);
      }
      students.forEach(s => {
        const d = new Date(s.created_at);
        const key = `${monthNames[d.getMonth()]}`;
        if (enrollMap.has(key)) enrollMap.set(key, (enrollMap.get(key) || 0) + 1);
      });
      setEnrollmentData(Array.from(enrollMap.entries()).map(([month, count]) => ({ month, count })));

      // Subject performance
      const subjectMap = new Map<string, { total: number; count: number }>();
      attempts.forEach(a => {
        const subject = a.exam?.subject || 'Unknown';
        const pct = a.exam?.total_marks ? ((a.marks_obtained || 0) / a.exam.total_marks) * 100 : 0;
        const cur = subjectMap.get(subject) || { total: 0, count: 0 };
        subjectMap.set(subject, { total: cur.total + pct, count: cur.count + 1 });
      });
      setSubjectPerformance(Array.from(subjectMap.entries()).map(([subject, d]) => ({
        subject, avgScore: Math.round(d.total / d.count), count: d.count,
      })).sort((a, b) => b.avgScore - a.avgScore));

      // Grade distribution
      const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      attempts.forEach(a => {
        const pct = a.exam?.total_marks ? ((a.marks_obtained || 0) / a.exam.total_marks) * 100 : 0;
        if (pct >= 80) grades.A++;
        else if (pct >= 70) grades.B++;
        else if (pct >= 60) grades.C++;
        else if (pct >= 50) grades.D++;
        else grades.F++;
      });
      setGradeDistribution(Object.entries(grades).map(([grade, count]) => ({ grade, count })));

      // Top performers
      const studentScores = new Map<string, { name: string; email: string; total: number; count: number }>();
      attempts.forEach(a => {
        const sid = a.student_id;
        const pct = a.exam?.total_marks ? ((a.marks_obtained || 0) / a.exam.total_marks) * 100 : 0;
        const cur = studentScores.get(sid) || { name: a.student?.full_name || 'Unknown', email: a.student?.email || '', total: 0, count: 0 };
        studentScores.set(sid, { ...cur, total: cur.total + pct, count: cur.count + 1 });
      });
      setTopPerformers(
        Array.from(studentScores.values())
          .map(s => ({ name: s.name, email: s.email, avgScore: Math.round(s.total / s.count), exams: s.count }))
          .sort((a, b) => b.avgScore - a.avgScore)
          .slice(0, 10)
      );

      // Exam ranking
      const examScores = new Map<string, { title: string; total: number; count: number }>();
      attempts.forEach(a => {
        const eid = a.exam_id;
        const pct = a.exam?.total_marks ? ((a.marks_obtained || 0) / a.exam.total_marks) * 100 : 0;
        const cur = examScores.get(eid) || { title: a.exam?.title || 'Unknown', total: 0, count: 0 };
        examScores.set(eid, { ...cur, total: cur.total + pct, count: cur.count + 1 });
      });
      setExamRanking(
        Array.from(examScores.values())
          .map(e => ({ title: e.title, attempts: e.count, avgScore: Math.round(e.total / e.count) }))
          .sort((a, b) => b.attempts - a.attempts)
          .slice(0, 10)
      );
    } catch (error) {
      console.error('Error loading dashboard:', error);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
            <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading analytics...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 dots-pattern pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60"
      >
        <div className="container mx-auto px-4 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-light shadow-md">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold font-heading tracking-tight">Admin Console</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Platform Overview & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 lg:px-8 py-6 space-y-6 relative">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Modern tab navigation */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <TabsList className="inline-flex h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-2xl gap-0.5 flex-wrap">
              {tabItems.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-card data-[state=active]:shadow-md rounded-xl px-3 py-2 text-xs lg:text-sm font-medium transition-all duration-300 gap-1.5"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.value === 'teachers' && stats.pendingTeachers > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 min-w-4 rounded-full p-0 px-1 text-[9px]">
                      {stats.pendingTeachers}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* ====== OVERVIEW TAB ====== */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Total Students" value={stats.totalStudents}
                  icon={<GraduationCap className="h-4 w-4" />}
                  gradient="bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-cyan))]"
                  delay={0}
                />
                <KPICard
                  title="Teachers" value={stats.totalTeachers}
                  subtitle={stats.pendingTeachers > 0 ? `${stats.pendingTeachers} pending` : undefined}
                  icon={<UserCheck className="h-4 w-4" />}
                  gradient="bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--fun-mint))]"
                  delay={1}
                />
                <KPICard
                  title="Pass Rate" value={`${stats.passRate}%`}
                  icon={<Target className="h-4 w-4" />}
                  gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-light))]"
                  delay={2}
                />
                <KPICard
                  title="Avg Score" value={`${stats.averageScore}%`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  gradient="bg-gradient-to-br from-[hsl(var(--purple))] to-[hsl(var(--fun-lavender))]"
                  delay={3}
                />
              </div>

              {/* Secondary KPIs */}
              <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Exams', value: stats.totalExams, sub: `${stats.activeExams} active`, icon: <FileText className="h-4 w-4" /> },
                    { label: 'Graded Attempts', value: stats.totalAttempts, icon: <Activity className="h-4 w-4" /> },
                    { label: 'Top Subject', value: subjectPerformance[0]?.subject || 'N/A', icon: <Award className="h-4 w-4" /> },
                  ].map((item, i) => (
                    <Card key={i} className="border border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card transition-colors duration-300">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">{item.icon}</div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                          <p className="text-lg font-bold truncate">{item.value}</p>
                          {item.sub && <p className="text-[10px] text-muted-foreground">{item.sub}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                {/* Enrollment Trends - wider */}
                <motion.div variants={scaleIn} initial="hidden" animate="visible" className="lg:col-span-4">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold">Enrollment Trends</CardTitle>
                          <CardDescription className="text-xs">Last 6 months</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs font-normal gap-1">
                          <Eye className="h-3 w-3" /> Live
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={enrollmentData}>
                          <defs>
                            <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(194, 100%, 42%)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(194, 100%, 42%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="count" stroke="hsl(194, 100%, 42%)" strokeWidth={2.5} fill="url(#enrollGrad)" name="Students" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Grade Distribution */}
                <motion.div variants={scaleIn} initial="hidden" animate="visible" className="lg:col-span-3">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Grade Distribution</CardTitle>
                      <CardDescription className="text-xs">A / B / C / D / F breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={gradeDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="count"
                            nameKey="grade"
                            strokeWidth={0}
                          >
                            {gradeDistribution.map((entry) => (
                              <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || CHART_COLORS[0]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-3 mt-2">
                        {gradeDistribution.map((entry) => (
                          <div key={entry.grade} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRADE_COLORS[entry.grade] }} />
                            <span className="text-xs font-medium">{entry.grade}</span>
                            <span className="text-xs text-muted-foreground">({entry.count})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Subject Performance + Top Performers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Subject Performance</CardTitle>
                      <CardDescription className="text-xs">Average scores by subject</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={subjectPerformance} barSize={32}>
                          <defs>
                            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(194, 100%, 42%)" />
                              <stop offset="100%" stopColor="hsl(194, 100%, 42%)" stopOpacity={0.6} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                          <XAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="avgScore" fill="url(#barGrad)" name="Avg Score %" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={fadeUp} custom={7} initial="hidden" animate="visible">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-semibold">Top Performers</CardTitle>
                          <CardDescription className="text-xs">Highest averages across all exams</CardDescription>
                        </div>
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Award className="h-3 w-3 text-primary" /> Top 10
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                        {topPerformers.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
                        ) : topPerformers.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-gradient-to-br from-primary to-primary-light text-primary-foreground' :
                              i === 1 ? 'bg-muted text-foreground' :
                              i === 2 ? 'bg-[hsl(var(--secondary))] text-secondary-foreground' :
                              'bg-muted/60 text-muted-foreground'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold">{s.avgScore}%</p>
                              <p className="text-[10px] text-muted-foreground">{s.exams} exams</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Most Attempted Exams */}
              <motion.div variants={fadeUp} custom={8} initial="hidden" animate="visible">
                <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">Most Attempted Exams</CardTitle>
                        <CardDescription className="text-xs">Ranked by student participation</CardDescription>
                      </div>
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {examRanking.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-8">No data yet</p>
                    ) : (
                      <div className="space-y-3">
                        {examRanking.map((exam, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{exam.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <Progress value={exam.avgScore} className="flex-1 h-2" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{exam.avgScore}% avg</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">{exam.attempts} attempts</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* ====== STUDENTS TAB ====== */}
            <TabsContent value="students" className="mt-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <StudentManagement />
              </motion.div>
            </TabsContent>

            {/* ====== TEACHERS TAB ====== */}
            <TabsContent value="teachers" className="mt-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <TeacherManagement />
              </motion.div>
            </TabsContent>

            {/* ====== EXAM ANALYTICS TAB ====== */}
            <TabsContent value="exams" className="space-y-6 mt-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total Attempts" value={stats.totalAttempts} icon={<BookOpen className="h-4 w-4" />}
                    gradient="bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-cyan))]" delay={0} />
                  <KPICard title="Average Score" value={`${stats.averageScore}%`} icon={<TrendingUp className="h-4 w-4" />}
                    gradient="bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--fun-mint))]" delay={1} />
                  <KPICard title="Pass Rate" value={`${stats.passRate}%`} icon={<Target className="h-4 w-4" />}
                    gradient="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-light))]" delay={2} />
                  <KPICard title="Active Exams" value={stats.activeExams} icon={<FileText className="h-4 w-4" />}
                    gradient="bg-gradient-to-br from-[hsl(var(--purple))] to-[hsl(var(--fun-lavender))]" delay={3} />
                </div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={scaleIn} initial="hidden" animate="visible">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Subject Performance</CardTitle>
                      <CardDescription className="text-xs">Avg scores & attempt counts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={subjectPerformance} barSize={24}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" strokeOpacity={0.5} />
                          <XAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 9%, 46%)" />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="avgScore" fill="hsl(194, 100%, 42%)" name="Avg Score %" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="count" fill="hsl(166, 73%, 42%)" name="Attempts" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={scaleIn} initial="hidden" animate="visible">
                  <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold">Grade Distribution</CardTitle>
                      <CardDescription className="text-xs">Performance breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                            paddingAngle={4} dataKey="count" nameKey="grade" strokeWidth={0}>
                            {gradeDistribution.map((entry) => (
                              <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || CHART_COLORS[0]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-3 mt-2">
                        {gradeDistribution.map((entry) => (
                          <div key={entry.grade} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRADE_COLORS[entry.grade] }} />
                            <span className="text-xs font-medium">{entry.grade} ({entry.count})</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </TabsContent>

            {/* ====== SCHOOLS TAB ====== */}
            <TabsContent value="schools" className="mt-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <SchoolManagement />
              </motion.div>
            </TabsContent>

            {/* ====== SITE TRAFFIC TAB ====== */}
            <TabsContent value="traffic" className="mt-6">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <WebsiteAnalytics />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}
