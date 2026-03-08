import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LogOut, GraduationCap, Users, FileText, BarChart3, TrendingUp, Target, Award,
  UserCheck, Building2, Activity, BookOpen, Shield
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { toast } from 'sonner';
import SchoolManagement from '@/components/admin/SchoolManagement';
import TeacherManagement from '@/components/admin/TeacherManagement';
import StudentManagement from '@/components/admin/StudentManagement';
import WebsiteAnalytics from '@/components/admin/WebsiteAnalytics';
import { NotificationBell } from '@/components/NotificationBell';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--destructive))',
];

export default function NewAdminDashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    pendingTeachers: 0,
    totalExams: 0,
    activeExams: 0,
    totalAttempts: 0,
    passRate: 0,
    averageScore: 0,
  });
  const [enrollmentData, setEnrollmentData] = useState<{ month: string; count: number }[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<{ subject: string; avgScore: number; count: number }[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ grade: string; count: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<{ name: string; email: string; avgScore: number; exams: number }[]>([]);
  const [examRanking, setExamRanking] = useState<{ title: string; attempts: number; avgScore: number }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

      // KPI Stats
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

      // Enrollment trends (last 6 months)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const enrollMap = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        enrollMap.set(`${monthNames[d.getMonth()]} ${d.getFullYear()}`, 0);
      }
      students.forEach(s => {
        const d = new Date(s.created_at);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
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

      // Grade distribution (A/B/C/D/F)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-8 h-8 border-4 border-primary/30 rounded-full animate-spin border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Platform Overview & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="teachers">
              Teachers
              {stats.pendingTeachers > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
                  {stats.pendingTeachers}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="exams">Exam Analytics</TabsTrigger>
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="traffic">Site Traffic</TabsTrigger>
          </TabsList>

          {/* ====== OVERVIEW TAB ====== */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalStudents}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Teachers</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalTeachers}</div>
                  {stats.pendingTeachers > 0 && (
                    <p className="text-xs text-destructive">{stats.pendingTeachers} pending</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalExams}</div>
                  <p className="text-xs text-muted-foreground">{stats.activeExams} active</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.passRate}%</div></CardContent>
              </Card>
            </div>

            {/* Additional KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Graded Attempts</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalAttempts}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.averageScore}%</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Subject</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{subjectPerformance[0]?.subject || 'N/A'}</div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enrollment Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Student Enrollment Trends</CardTitle>
                  <CardDescription>New student registrations (last 6 months)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={enrollmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Students" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Grade Distribution Pie */}
              <Card>
                <CardHeader>
                  <CardTitle>Grade Distribution</CardTitle>
                  <CardDescription>Overall grade breakdown (A/B/C/D/F)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ grade, percent }) => percent > 0 ? `${grade}: ${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={100}
                        dataKey="count"
                        nameKey="grade"
                      >
                        {gradeDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Subject Performance + Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subject Performance</CardTitle>
                  <CardDescription>Average scores by subject</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={subjectPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Performers</CardTitle>
                  <CardDescription>Highest average scores across all exams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Avg %</TableHead>
                          <TableHead>Exams</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPerformers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No data yet</TableCell>
                          </TableRow>
                        ) : topPerformers.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-semibold">{i + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.avgScore >= 70 ? 'default' : 'secondary'}>{s.avgScore}%</Badge>
                            </TableCell>
                            <TableCell>{s.exams}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Most Attempted Exams */}
            <Card>
              <CardHeader>
                <CardTitle>Most Attempted Exams</CardTitle>
                <CardDescription>Ranked by number of student attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={examRanking} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="title" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attempts" fill="hsl(var(--primary))" name="Attempts" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="avgScore" fill="hsl(var(--chart-2, 160 60% 45%))" name="Avg Score %" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== STUDENTS TAB ====== */}
          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          {/* ====== TEACHERS TAB ====== */}
          <TabsContent value="teachers">
            <TeacherManagement />
          </TabsContent>

          {/* ====== EXAM ANALYTICS TAB ====== */}
          <TabsContent value="exams" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.totalAttempts}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.averageScore}%</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.passRate}%</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Exams</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.activeExams}</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subject Performance</CardTitle>
                  <CardDescription>Average scores and attempt counts by subject</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subjectPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score %" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="count" fill="hsl(var(--chart-2, 160 60% 45%))" name="Attempts" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Grade Distribution</CardTitle>
                  <CardDescription>Performance breakdown across all exams</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={gradeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ grade, percent }) => percent > 0 ? `${grade}: ${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={100}
                        dataKey="count"
                        nameKey="grade"
                      >
                        {gradeDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== SCHOOLS TAB ====== */}
          <TabsContent value="schools">
            <SchoolManagement />
          </TabsContent>

          {/* ====== SITE TRAFFIC TAB ====== */}
          <TabsContent value="traffic">
            <WebsiteAnalytics />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
