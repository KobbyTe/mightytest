import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { motion } from 'framer-motion';
import { Award, TrendingUp, Target, Users, AlertTriangle, Sparkles, BarChart3, Activity } from 'lucide-react';
import { StudentPerformance } from '@/lib/exportUtils';

interface ExamData {
  examId: string;
  examTitle: string;
  subject: string | null;
  totalMarks: number;
  passingMarks: number;
  attempts: {
    studentId: string;
    studentName: string;
    marksObtained: number;
    passed: boolean;
  }[];
}

interface Props {
  students: StudentPerformance[];
  examData: ExamData[];
  className: string;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6'];

export default function ClassPerformanceAnalytics({ students, examData, className }: Props) {
  const stats = useMemo(() => {
    const total = students.length;
    if (total === 0) {
      return { total: 0, avg: 0, top: 0, lowest: 0, passRate: 0, atRisk: 0, excellent: 0 };
    }
    const avg = students.reduce((s, x) => s + x.averagePercentage, 0) / total;
    const top = Math.max(...students.map(s => s.averagePercentage));
    const lowest = Math.min(...students.map(s => s.averagePercentage));
    const passRate = (students.filter(s => s.averagePercentage >= 50).length / total) * 100;
    const atRisk = students.filter(s => s.averagePercentage < 50).length;
    const excellent = students.filter(s => s.averagePercentage >= 90).length;
    return { total, avg, top, lowest, passRate, atRisk, excellent };
  }, [students]);

  const gradeDistribution = useMemo(() => {
    const buckets = [
      { range: 'A (90-100)', min: 90, max: 100, count: 0 },
      { range: 'B (75-89)', min: 75, max: 89.99, count: 0 },
      { range: 'C (60-74)', min: 60, max: 74.99, count: 0 },
      { range: 'D (50-59)', min: 50, max: 59.99, count: 0 },
      { range: 'F (0-49)', min: 0, max: 49.99, count: 0 },
    ];
    students.forEach(s => {
      const b = buckets.find(b => s.averagePercentage >= b.min && s.averagePercentage <= b.max);
      if (b) b.count++;
    });
    return buckets;
  }, [students]);

  const examAverages = useMemo(() => {
    return examData.map(e => {
      const totalPct = e.attempts.reduce((sum, a) => sum + (a.marksObtained / (e.totalMarks || 1)) * 100, 0);
      const avg = e.attempts.length > 0 ? totalPct / e.attempts.length : 0;
      const passed = e.attempts.filter(a => a.passed).length;
      const passRate = e.attempts.length > 0 ? (passed / e.attempts.length) * 100 : 0;
      return {
        name: e.examTitle.length > 14 ? e.examTitle.slice(0, 14) + '…' : e.examTitle,
        fullName: e.examTitle,
        average: Math.round(avg * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        attempts: e.attempts.length,
      };
    });
  }, [examData]);

  const subjectRadar = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    examData.forEach(e => {
      const subject = e.subject || 'General';
      e.attempts.forEach(a => {
        const pct = (a.marksObtained / (e.totalMarks || 1)) * 100;
        const cur = map.get(subject) || { total: 0, count: 0 };
        map.set(subject, { total: cur.total + pct, count: cur.count + 1 });
      });
    });
    return Array.from(map.entries()).map(([subject, d]) => ({
      subject,
      score: Math.round((d.total / d.count) * 10) / 10,
    }));
  }, [examData]);

  const top5 = useMemo(() =>
    [...students]
      .sort((a, b) => b.averagePercentage - a.averagePercentage)
      .slice(0, 5)
      .map(s => ({ name: s.studentName.split(' ')[0], score: Math.round(s.averagePercentage * 10) / 10 })),
    [students]
  );

  const bottom5 = useMemo(() =>
    [...students]
      .filter(s => s.examsTaken > 0)
      .sort((a, b) => a.averagePercentage - b.averagePercentage)
      .slice(0, 5)
      .map(s => ({ name: s.studentName.split(' ')[0], score: Math.round(s.averagePercentage * 10) / 10 })),
    [students]
  );

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No performance data available yet for {className}.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: 'Students', value: stats.total, gradient: 'from-indigo-500 to-purple-500' },
          { icon: TrendingUp, label: 'Class Avg', value: `${stats.avg.toFixed(1)}%`, gradient: 'from-emerald-500 to-teal-500' },
          { icon: Target, label: 'Pass Rate', value: `${stats.passRate.toFixed(0)}%`, gradient: 'from-amber-500 to-orange-500' },
          { icon: Sparkles, label: 'Excellent', value: stats.excellent, gradient: 'from-pink-500 to-rose-500' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="overflow-hidden border-0 shadow-md backdrop-blur-xl bg-card/80">
              <div className={`h-1 bg-gradient-to-r ${kpi.gradient}`} />
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl bg-gradient-to-br ${kpi.gradient} p-2.5 shadow-lg`}>
                    <kpi.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold leading-tight">{kpi.value}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Grade distribution + Subject radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md backdrop-blur-xl bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Grade Distribution</CardTitle>
            </div>
            <CardDescription className="text-xs">Students grouped by performance band</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={gradeDistribution.filter(g => g.count > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, count }) => `${range.split(' ')[0]}: ${count}`}
                  outerRadius={90}
                  innerRadius={45}
                  dataKey="count"
                  paddingAngle={3}
                >
                  {gradeDistribution.filter(g => g.count > 0).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md backdrop-blur-xl bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Subject Strength</CardTitle>
            </div>
            <CardDescription className="text-xs">Average % per subject</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              {subjectRadar.length >= 3 ? (
                <RadarChart data={subjectRadar}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Avg %" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                  <Tooltip />
                </RadarChart>
              ) : (
                <BarChart data={subjectRadar}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Exam averages line chart */}
      <Card className="border-0 shadow-md backdrop-blur-xl bg-card/80">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Exam Performance Trend</CardTitle>
          </div>
          <CardDescription className="text-xs">Class average vs pass rate per exam</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={examAverages}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => `${v}%`}
                labelFormatter={(l, p) => p?.[0]?.payload?.fullName || l}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="average" stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} name="Avg %" />
              <Line type="monotone" dataKey="passRate" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} name="Pass %" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top + Bottom performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md backdrop-blur-xl bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Top Performers</CardTitle>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">TOP 5</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={top5} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="score" fill="#f59e0b" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md backdrop-blur-xl bg-card/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-base">Needs Support</CardTitle>
              </div>
              <Badge className="bg-rose-100 text-rose-700 border-0 text-[10px]">{stats.atRisk} AT RISK</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={bottom5} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="score" fill="#ef4444" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
