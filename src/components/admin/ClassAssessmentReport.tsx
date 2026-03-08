import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  StudentPerformance, 
  ClassInfo, 
  getStatusColor, 
  getStatusLabel,
  generateRemarks 
} from '@/lib/exportUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Users, TrendingUp, Award, AlertCircle, BookOpen } from 'lucide-react';

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

interface ClassAssessmentReportProps {
  classInfo: ClassInfo;
  students: StudentPerformance[];
  examData: ExamData[];
  adminRemarks?: string;
  onRemarksChange?: (remarks: string) => void;
  reportId?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function ClassAssessmentReport({
  classInfo,
  students,
  examData,
  adminRemarks = '',
  onRemarksChange,
  reportId = 'class-assessment-report'
}: ClassAssessmentReportProps) {
  // Calculate class-wide statistics
  const totalStudents = students.length;
  const studentsWithExams = students.filter(s => s.examsTaken > 0);
  const classAverage = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.averagePercentage, 0) / studentsWithExams.length
    : 0;
  const overallPassRate = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.passRate, 0) / studentsWithExams.length
    : 0;

  // Grade distribution
  const gradeDistribution = [
    { name: 'Excellent', value: students.filter(s => s.status === 'excellent').length, color: '#10b981' },
    { name: 'Good', value: students.filter(s => s.status === 'good').length, color: '#3b82f6' },
    { name: 'Satisfactory', value: students.filter(s => s.status === 'satisfactory').length, color: '#f59e0b' },
    { name: 'Needs Improvement', value: students.filter(s => s.status === 'needs-improvement').length, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Subject-wise performance
  const subjectPerformance = examData.reduce((acc, exam) => {
    const subject = exam.subject || 'General';
    if (!acc[subject]) {
      acc[subject] = { totalAttempts: 0, totalMarks: 0, marksObtained: 0 };
    }
    exam.attempts.forEach(attempt => {
      acc[subject].totalAttempts += 1;
      acc[subject].totalMarks += exam.totalMarks;
      acc[subject].marksObtained += attempt.marksObtained;
    });
    return acc;
  }, {} as Record<string, { totalAttempts: number; totalMarks: number; marksObtained: number }>);

  const subjectChartData = Object.entries(subjectPerformance).map(([subject, data]) => ({
    subject,
    average: data.totalMarks > 0 ? (data.marksObtained / data.totalMarks) * 100 : 0
  }));

  // Top performers
  const topPerformers = [...students]
    .filter(s => s.examsTaken > 0)
    .sort((a, b) => b.averagePercentage - a.averagePercentage)
    .slice(0, 5);

  // Students needing attention
  const needsAttention = students
    .filter(s => s.status === 'needs-improvement' || (s.examsTaken > 0 && s.passRate < 50));

  return (
    <div id="class-assessment-report" className="space-y-6">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold">{classInfo.schoolName}</h1>
        <h2 className="text-lg text-muted-foreground">
          Class Assessment Report - {classInfo.name}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Grade Level: {classInfo.gradeLevel || 'N/A'} | Generated: {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classAverage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Class Average</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallPassRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{examData.length}</p>
                <p className="text-xs text-muted-foreground">Exams Conducted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Subject-wise Performance */}
        {subjectChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subject-wise Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Grade Distribution */}
        {gradeDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grade Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={gradeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {gradeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Performers & Students Needing Attention */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-emerald-600">
              <Award className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.map((student, idx) => (
                  <div key={student.studentId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{student.studentName}</span>
                    </div>
                    <Badge variant="outline">{student.averagePercentage.toFixed(1)}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No exam data available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-red-600">
              <AlertCircle className="h-5 w-5" />
              Students Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length > 0 ? (
              <div className="space-y-3">
                {needsAttention.slice(0, 5).map((student) => (
                  <div key={student.studentId} className="flex items-center justify-between">
                    <span className="font-medium">{student.studentName}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(student.status)}>
                        {getStatusLabel(student.status)}
                      </Badge>
                      {student.examsTaken > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {student.averagePercentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {needsAttention.length > 5 && (
                  <p className="text-sm text-muted-foreground">
                    +{needsAttention.length - 5} more students
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">All students are performing well!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exam-by-Exam Breakdown */}
      {examData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exam-by-Exam Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {examData.map((exam) => {
                const avgScore = exam.attempts.length > 0
                  ? exam.attempts.reduce((sum, a) => sum + a.marksObtained, 0) / exam.attempts.length
                  : 0;
                const passCount = exam.attempts.filter(a => a.passed).length;
                const passRate = exam.attempts.length > 0 
                  ? (passCount / exam.attempts.length) * 100 
                  : 0;

                return (
                  <div key={exam.examId} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold">{exam.examTitle}</h4>
                        <p className="text-sm text-muted-foreground">
                          {exam.subject || 'General'} • Total Marks: {exam.totalMarks}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{exam.attempts.length} attempts</p>
                        <p className="text-sm text-muted-foreground">
                          Avg: {avgScore.toFixed(1)} | Pass: {passRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Remarks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Administrator Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          {onRemarksChange ? (
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add your remarks about this class's performance..."
              value={adminRemarks}
              onChange={(e) => onRemarksChange(e.target.value)}
            />
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
              {adminRemarks || 'No remarks added.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
