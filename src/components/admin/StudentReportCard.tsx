import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentPerformance, generateRemarks, getStatusColor, getStatusLabel } from '@/lib/exportUtils';
import { User, Mail, BookOpen, Award, AlertTriangle, Trophy, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

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
  position?: number | string;
  className?: string;
}

export default function StudentReportCard({ 
  student, 
  examAttempts,
  position,
  className 
}: StudentReportCardProps) {
  const remarks = generateRemarks(student);
  
  // Sort exams chronologically
  const sortedAttempts = [...examAttempts].sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return dateA - dateB;
  });

  // Calculate totals
  const totalObtained = sortedAttempts.reduce((sum, a) => sum + a.marksObtained, 0);
  const totalPossible = sortedAttempts.reduce((sum, a) => sum + a.totalMarks, 0);
  const average = sortedAttempts.length > 0 ? totalObtained / sortedAttempts.length : 0;
  const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

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

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-destructive';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 75) return '[&>div]:bg-emerald-500';
    if (pct >= 60) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-destructive';
  };

  const getRemarkText = (pct: number) => {
    if (pct >= 90) return 'Excellent';
    if (pct >= 75) return 'Very Good';
    if (pct >= 60) return 'Good';
    if (pct >= 50) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className={className} id="student-report-card">
      {/* Profile Header with Gradient Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="mb-6 overflow-hidden border-0 shadow-lg">
          <div className="h-24 bg-gradient-to-r from-primary via-primary-light to-accent relative">
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <CardContent className="-mt-12 relative pb-6 px-6">
            <div className="flex items-end gap-4 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-card border-4 border-card shadow-lg flex items-center justify-center shrink-0">
                <User className="h-9 w-9 text-primary" />
              </div>
              <div className="flex-1 pt-14">
                <h2 className="text-2xl font-bold text-foreground">{student.studentName}</h2>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                  <Mail className="h-3.5 w-3.5" />
                  {student.email}
                </div>
              </div>
              <Badge className={`${getStatusColor(student.status)} text-sm px-3 py-1`}>
                {getStatusLabel(student.status)}
              </Badge>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Exams Taken', value: student.examsTaken, icon: BookOpen },
                { label: 'Average', value: `${student.averagePercentage.toFixed(1)}%`, icon: TrendingUp },
                { label: 'Pass Rate', value: `${student.passRate.toFixed(0)}%`, icon: Award },
                { label: 'Position', value: position || 'N/A', icon: Trophy },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * i, duration: 0.3 }}
                  className="p-3 rounded-xl bg-muted/50 backdrop-blur-xl border border-border/50 text-center"
                >
                  <stat.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Table */}
      {sortedAttempts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="mb-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Exam Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/70">
                      <TableHead className="font-bold text-foreground whitespace-nowrap">Student</TableHead>
                      {sortedAttempts.map((_, idx) => (
                        <TableHead key={idx} className="font-bold text-foreground text-center whitespace-nowrap">
                          Test {idx + 1}
                        </TableHead>
                      ))}
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Total</TableHead>
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Average</TableHead>
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Percentage (100%)</TableHead>
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Position</TableHead>
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="font-medium whitespace-nowrap">{student.studentName}</TableCell>
                      {sortedAttempts.map((attempt, idx) => {
                        const pct = (attempt.marksObtained / attempt.totalMarks) * 100;
                        return (
                          <TableCell key={idx} className="text-center whitespace-nowrap">
                            <span className={`font-semibold ${getPercentageColor(pct)}`}>
                              {attempt.marksObtained}
                            </span>
                            <span className="text-muted-foreground">/{attempt.totalMarks}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold whitespace-nowrap">
                        {totalObtained}/{totalPossible}
                      </TableCell>
                      <TableCell className="text-center font-semibold whitespace-nowrap">
                        {average.toFixed(1)}
                      </TableCell>
                      <TableCell className={`text-center font-bold whitespace-nowrap ${getPercentageColor(percentage)}`}>
                        {percentage.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center font-bold whitespace-nowrap">
                        {position || 'N/A'}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge variant="outline" className={`${getPercentageColor(percentage)} border-current`}>
                          {getRemarkText(percentage)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Subject Performance */}
      {Object.keys(subjectPerformance).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Card className="mb-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-accent" />
                Subject-wise Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(subjectPerformance).map(([subject, data]) => {
                const pct = (data.marksObtained / data.totalMarks) * 100;
                return (
                  <div key={subject}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-semibold text-foreground">{subject}</span>
                      <span className={`text-sm font-bold ${getPercentageColor(pct)}`}>
                        {data.marksObtained}/{data.totalMarks} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={pct} className={`h-2.5 ${getProgressColor(pct)}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Strengths & Weaknesses - Single Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Card className="mb-6 backdrop-blur-xl bg-card/80 border-border/50 shadow-md">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-emerald-500" />
                  Strengths
                </h4>
                <div className="flex flex-wrap gap-2">
                  {strengths.length > 0 ? strengths.map((s) => (
                    <Badge key={s} className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200">
                      {s}
                    </Badge>
                  )) : (
                    <p className="text-sm text-muted-foreground">Keep working to build strengths!</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Areas for Improvement
                </h4>
                <div className="flex flex-wrap gap-2">
                  {weakAreas.length > 0 ? weakAreas.map((s) => (
                    <Badge key={s} variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                      {s}
                    </Badge>
                  )) : (
                    <p className="text-sm text-muted-foreground">Great job! No weak areas identified.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Teacher's Remarks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Card className="backdrop-blur-xl bg-card/80 border-border/50 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Teacher's Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-4">
              <p className="text-sm leading-relaxed text-muted-foreground italic">
                {remarks}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
