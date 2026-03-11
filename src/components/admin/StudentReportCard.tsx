import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentPerformance, generateRemarks, getStatusColor, getStatusLabel } from '@/lib/exportUtils';
import { User, BookOpen, Award, AlertTriangle, Trophy, TrendingUp, Quote } from 'lucide-react';
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
  
  const sortedAttempts = [...examAttempts].sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return dateA - dateB;
  });

  const totalObtained = sortedAttempts.reduce((sum, a) => sum + a.marksObtained, 0);
  const totalPossible = sortedAttempts.reduce((sum, a) => sum + a.totalMarks, 0);
  const average = sortedAttempts.length > 0 ? totalObtained / sortedAttempts.length : 0;
  const percentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

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

  const getPercentagePill = (pct: number) => {
    if (pct >= 75) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (pct >= 60) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getProgressGradient = (pct: number) => {
    if (pct >= 75) return '[&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-emerald-600';
    if (pct >= 60) return '[&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-600';
    return '[&>div]:bg-gradient-to-r [&>div]:from-red-400 [&>div]:to-red-600';
  };

  const getRemarkBadge = (pct: number) => {
    if (pct >= 90) return { text: 'Excellent', classes: 'bg-emerald-500 text-white border-emerald-600' };
    if (pct >= 75) return { text: 'Very Good', classes: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (pct >= 60) return { text: 'Good', classes: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (pct >= 50) return { text: 'Fair', classes: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { text: 'Needs Improvement', classes: 'bg-red-100 text-red-800 border-red-300' };
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 75) return 'text-emerald-600 font-bold';
    if (pct >= 60) return 'text-amber-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  const remark = getRemarkBadge(percentage);

  return (
    <div className={className} id="student-report-card">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="mb-6 overflow-hidden border-0 shadow-xl">
          <div className="h-28 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6TTAgMzR2LTJoMnYyem0wLTR2LTJoMnYyem0wLTR2LTJoMnYyem0wLTR2LTJoMnYyem0wLTR2LTJoMnYyem0wLTRWOGgydjJ6bTAtNFY0aDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
            {position && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5">
                <Trophy className="h-4 w-4 text-yellow-300" />
                <span className="text-white font-bold text-sm">#{position}</span>
              </div>
            )}
          </div>
          <CardContent className="-mt-10 relative pb-6 px-6">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-card shadow-xl flex items-center justify-center shrink-0">
                <User className="h-9 w-9 text-white" />
              </div>
              <div className="flex-1 pt-12">
                <h2 className="text-2xl font-extrabold text-foreground tracking-tight">{student.studentName}</h2>
              </div>
              <Badge className={`${getStatusColor(student.status)} text-sm px-3 py-1 shadow-sm`}>
                {getStatusLabel(student.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Table */}
      {sortedAttempts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <Card className="mb-6 border-0 shadow-xl overflow-hidden">
            <CardHeader className="pb-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                Exam Results
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-500 border-0">
                      <TableHead className="font-bold text-white whitespace-nowrap text-sm">Student</TableHead>
                      {sortedAttempts.map((_, idx) => (
                        <TableHead key={idx} className="font-bold text-white text-center whitespace-nowrap text-sm">
                          Test {idx + 1}
                        </TableHead>
                      ))}
                      <TableHead className="font-bold text-white text-center whitespace-nowrap text-sm">Total</TableHead>
                      <TableHead className="font-bold text-white text-center whitespace-nowrap text-sm">Average</TableHead>
                      <TableHead className="font-bold text-white text-center whitespace-nowrap text-sm">Percentage (100%)</TableHead>
                      <TableHead className="font-bold text-white text-center whitespace-nowrap text-sm">Position</TableHead>
                      <TableHead className="font-bold text-white text-center whitespace-nowrap text-sm">Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-card hover:bg-muted/40 border-b border-border/50">
                      <TableCell className="font-semibold whitespace-nowrap text-foreground py-4">
                        {student.studentName}
                      </TableCell>
                      {sortedAttempts.map((attempt, idx) => {
                        const pct = (attempt.marksObtained / attempt.totalMarks) * 100;
                        return (
                          <TableCell key={idx} className="text-center whitespace-nowrap py-4">
                            <span className={getScoreColor(pct)}>
                              {attempt.marksObtained}
                            </span>
                            <span className="text-muted-foreground text-xs">/{attempt.totalMarks}</span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold whitespace-nowrap py-4 text-foreground">
                        {totalObtained}/{totalPossible}
                      </TableCell>
                      <TableCell className="text-center font-bold whitespace-nowrap py-4 text-foreground">
                        {average.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${getPercentagePill(percentage)}`}>
                          {percentage.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm dark:bg-indigo-900/50 dark:text-indigo-300">
                          {position || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap py-4">
                        <Badge className={`${remark.classes} border text-xs font-semibold px-3 py-1`}>
                          {remark.text}
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
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="mb-6 border-0 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.entries(subjectPerformance).map(([subject, data]) => {
                const pct = (data.marksObtained / data.totalMarks) * 100;
                return (
                  <div key={subject}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">{subject}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{data.marksObtained}/{data.totalMarks}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getPercentagePill(pct)}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} className={`h-3 rounded-full ${getProgressGradient(pct)}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Strengths & Weaknesses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Card className="mb-6 border-0 shadow-xl">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-200 dark:bg-emerald-800/50">
                    <Award className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  Strengths
                </h4>
                <div className="flex flex-wrap gap-2">
                  {strengths.length > 0 ? strengths.map((s) => (
                    <Badge key={s} className="bg-emerald-500 text-white border-0 shadow-sm hover:bg-emerald-600">
                      {s}
                    </Badge>
                  )) : (
                    <p className="text-sm text-muted-foreground italic">Keep working to build strengths!</p>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-200 dark:bg-amber-800/50">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                  </div>
                  Areas for Improvement
                </h4>
                <div className="flex flex-wrap gap-2">
                  {weakAreas.length > 0 ? weakAreas.map((s) => (
                    <Badge key={s} className="bg-amber-500 text-white border-0 shadow-sm hover:bg-amber-600">
                      {s}
                    </Badge>
                  )) : (
                    <p className="text-sm text-muted-foreground italic">Great job! No weak areas identified.</p>
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
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                <Quote className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              Teacher's Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800/30">
              <Quote className="absolute top-3 left-3 h-6 w-6 text-indigo-200 dark:text-indigo-800 rotate-180" />
              <p className="text-sm leading-relaxed text-foreground/80 italic pl-6">
                {remarks}
              </p>
              <Quote className="absolute bottom-3 right-3 h-6 w-6 text-indigo-200 dark:text-indigo-800" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
