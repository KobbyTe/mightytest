import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Users, Target, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface AnalyticsData {
  totalAttempts: number;
  averageScore: number;
  passRate: number;
  subjectBreakdown: { subject: string; avgScore: number; count: number }[];
  gradeDistribution: { range: string; count: number }[];
  performanceTrend: { date: string; avgScore: number }[];
}

export default function ExamAnalytics() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (role !== 'admin' && role !== 'teacher')) {
      navigate(role === 'teacher' ? '/teacher' : '/admin');
      return;
    }
    loadAnalytics();
  }, [user, role, navigate]);

  const loadAnalytics = async () => {
    try {
      // Load all graded attempts with exam details
      const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          exam:exams(title, subject, total_marks, passing_marks)
        `)
        .eq('status', 'graded');

      if (error) throw error;

      if (!attempts || attempts.length === 0) {
        setAnalytics({
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          subjectBreakdown: [],
          gradeDistribution: [],
          performanceTrend: []
        });
        setLoading(false);
        return;
      }

      // Calculate metrics
      const totalAttempts = attempts.length;
      const totalScore = attempts.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
      const averageScore = totalScore / totalAttempts;

      const passedCount = attempts.filter(a => 
        a.marks_obtained && a.exam?.passing_marks && 
        a.marks_obtained >= a.exam.passing_marks
      ).length;
      const passRate = (passedCount / totalAttempts) * 100;

      // Subject breakdown
      const subjectMap = new Map<string, { total: number; count: number }>();
      attempts.forEach(a => {
        const subject = a.exam?.subject || 'Unknown';
        const current = subjectMap.get(subject) || { total: 0, count: 0 };
        subjectMap.set(subject, {
          total: current.total + (a.marks_obtained || 0),
          count: current.count + 1
        });
      });

      const subjectBreakdown = Array.from(subjectMap.entries()).map(([subject, data]) => ({
        subject,
        avgScore: Math.round(data.total / data.count),
        count: data.count
      }));

      // Grade distribution
      const gradeRanges = [
        { range: '0-20', min: 0, max: 20 },
        { range: '21-40', min: 21, max: 40 },
        { range: '41-60', min: 41, max: 60 },
        { range: '61-80', min: 61, max: 80 },
        { range: '81-100', min: 81, max: 100 }
      ];

      const gradeDistribution = gradeRanges.map(range => ({
        range: range.range,
        count: attempts.filter(a => {
          const percentage = a.exam?.total_marks 
            ? ((a.marks_obtained || 0) / a.exam.total_marks) * 100 
            : 0;
          return percentage >= range.min && percentage <= range.max;
        }).length
      }));

      // Performance trend (last 30 days)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const recentAttempts = attempts.filter(a => 
        new Date(a.graded_at || a.attempted_at) >= last30Days
      );

      const dateMap = new Map<string, { total: number; count: number }>();
      recentAttempts.forEach(a => {
        const date = new Date(a.graded_at || a.attempted_at).toLocaleDateString();
        const current = dateMap.get(date) || { total: 0, count: 0 };
        dateMap.set(date, {
          total: current.total + (a.marks_obtained || 0),
          count: current.count + 1
        });
      });

      const performanceTrend = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          avgScore: Math.round(data.total / data.count)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-10); // Last 10 data points

      setAnalytics({
        totalAttempts,
        averageScore: Math.round(averageScore),
        passRate: Math.round(passRate),
        subjectBreakdown,
        gradeDistribution,
        performanceTrend
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading analytics...</div>
      </div>
    );
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--destructive))'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Exam Analytics</h1>
              <p className="text-sm text-muted-foreground">Comprehensive performance insights</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attempts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalAttempts || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.averageScore || 0}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.passRate || 0}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Subject</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.subjectBreakdown[0]?.subject || 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Performance</CardTitle>
            <CardDescription>Average scores across different subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.subjectBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Average Score" />
                <Bar dataKey="count" fill="hsl(var(--secondary))" name="Attempts" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Student performance breakdown by score range</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics?.gradeDistribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, percent }) => `${range}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="count"
                  >
                    {(analytics?.gradeDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Average scores over time (last 10 sessions)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics?.performanceTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgScore" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Average Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics && analytics.totalAttempts > 0 ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Overall Performance</p>
                    <p className="text-sm text-muted-foreground">
                      Students are scoring an average of {analytics.averageScore}% across all exams.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Pass Rate Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      {analytics.passRate}% of students are meeting the passing criteria.
                    </p>
                  </div>
                </div>
                {analytics.subjectBreakdown.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Top Performing Subject</p>
                      <p className="text-sm text-muted-foreground">
                        {analytics.subjectBreakdown[0].subject} leads with an average score of {analytics.subjectBreakdown[0].avgScore}%.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No graded exams yet. Insights will appear once students complete exams.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
