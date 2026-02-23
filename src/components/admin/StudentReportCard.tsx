import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { StudentPerformance, generateRemarks, getStatusColor, getStatusLabel } from '@/lib/exportUtils';
import { User, Mail, BookOpen, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ExamAttemptDetail {
  examTitle: string;
  subject: string | null;
  marksObtained: number;
  totalMarks: number;
  passingMarks: number;
  completedAt: string | null;
}

interface StudentReportCardProps {
  student: StudentPerformance;
  examAttempts: ExamAttemptDetail[];
  className?: string;
}

export default function StudentReportCard({ 
  student, 
  examAttempts,
  className 
}: StudentReportCardProps) {
  const remarks = generateRemarks(student);
  
  // Group exams by subject for subject-wise breakdown
  const subjectPerformance = examAttempts.reduce((acc, attempt) => {
    const subject = attempt.subject || 'General';
    if (!acc[subject]) {
      acc[subject] = { totalMarks: 0, marksObtained: 0, count: 0 };
    }
    acc[subject].totalMarks += attempt.totalMarks;
    acc[subject].marksObtained += attempt.marksObtained;
    acc[subject].count += 1;
    return acc;
  }, {} as Record<string, { totalMarks: number; marksObtained: number; count: number }>);

  const strengths = Object.entries(subjectPerformance)
    .filter(([_, data]) => (data.marksObtained / data.totalMarks) * 100 >= 75)
    .map(([subject]) => subject);

  const weakAreas = Object.entries(subjectPerformance)
    .filter(([_, data]) => (data.marksObtained / data.totalMarks) * 100 < 60)
    .map(([subject]) => subject);

  return (
    <div className={className} id="student-report-card">
      {/* Profile Summary */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{student.studentName}</CardTitle>
                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                  <Mail className="h-3 w-3" />
                  {student.email}
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(student.status)}>
              {getStatusLabel(student.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{student.examsTaken}</p>
              <p className="text-xs text-muted-foreground">Exams Taken</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{student.averagePercentage.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Average Score</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{student.passRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Pass Rate</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{student.marksObtained}</p>
              <p className="text-xs text-muted-foreground">Total Marks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject-wise Performance */}
      {Object.keys(subjectPerformance).length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Subject-wise Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(subjectPerformance).map(([subject, data]) => {
              const percentage = (data.marksObtained / data.totalMarks) * 100;
              return (
                <div key={subject}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{subject}</span>
                    <span className="text-sm text-muted-foreground">
                      {data.marksObtained}/{data.totalMarks} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Strengths & Areas for Improvement */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-emerald-600">
              <Award className="h-5 w-5" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strengths.length > 0 ? (
              <ul className="space-y-1">
                {strengths.map((subject) => (
                  <li key={subject} className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    {subject}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Keep working to build strengths!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakAreas.length > 0 ? (
              <ul className="space-y-1">
                {weakAreas.map((subject) => (
                  <li key={subject} className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {subject}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Great job! No weak areas identified.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Exam History */}
      {examAttempts.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Exam History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...examAttempts]
                .sort((a, b) => {
                  const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                  const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                  return dateA - dateB;
                })
                .map((attempt, idx) => {
                const percentage = (attempt.marksObtained / attempt.totalMarks) * 100;
                const passed = attempt.marksObtained >= attempt.passingMarks;
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-14 shrink-0">Test {idx + 1}</span>
                      <div>
                        <p className="font-medium">{attempt.examTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.subject || 'General'} • {attempt.completedAt 
                            ? format(new Date(attempt.completedAt), 'MMM d, yyyy')
                            : 'Not completed'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{attempt.marksObtained}/{attempt.totalMarks}</p>
                      <Badge variant={passed ? 'default' : 'destructive'} className="text-xs">
                        {passed ? 'Passed' : 'Failed'} ({percentage.toFixed(0)}%)
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Average Summary */}
            <div className="mt-4 pt-4 border-t-2 border-primary/20">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10">
                <span className="text-lg font-bold">Overall Average</span>
                <span className="text-2xl font-bold text-primary">
                  {(examAttempts.reduce((sum, a) => sum + (a.marksObtained / a.totalMarks) * 100, 0) / examAttempts.length).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remarks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teacher's Remarks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground bg-muted/30 p-4 rounded-lg">
            {remarks}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
