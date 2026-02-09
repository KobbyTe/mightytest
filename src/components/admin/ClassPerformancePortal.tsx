import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Users, 
  TrendingUp, 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Loader2,
  ArrowLeft,
  X
} from 'lucide-react';
import StudentPerformanceTable from './StudentPerformanceTable';
import StudentReportCard from './StudentReportCard';
import ClassAssessmentReport from './ClassAssessmentReport';
import { 
  StudentPerformance, 
  ClassInfo, 
  calculateStatus, 
  exportToPDF, 
  exportToCSV 
} from '@/lib/exportUtils';

interface ClassPerformancePortalProps {
  classId: string;
  className: string;
  schoolName: string;
  gradeLevel: string | null;
  open: boolean;
  onClose: () => void;
}

interface ExamAttemptWithExam {
  id: string;
  student_id: string;
  marks_obtained: number | null;
  completed_at: string | null;
  status: string | null;
  exam: {
    id: string;
    title: string;
    subject: string | null;
    total_marks: number;
    passing_marks: number;
  };
}

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

export default function ClassPerformancePortal({
  classId,
  className,
  schoolName,
  gradeLevel,
  open,
  onClose
}: ClassPerformancePortalProps) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [examData, setExamData] = useState<ExamData[]>([]);
  const [rawAttempts, setRawAttempts] = useState<Record<string, ExamAttemptWithExam[]>>({});
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformance | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [exporting, setExporting] = useState(false);

  const classInfo: ClassInfo = {
    id: classId,
    name: className,
    gradeLevel,
    schoolName
  };

  useEffect(() => {
    if (open && classId) {
      loadData();
    }
  }, [open, classId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get all students in this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, full_name, email, grade, created_at')
        .eq('class_id', classId);

      if (studentsError) throw studentsError;

      if (!studentsData || studentsData.length === 0) {
        setStudents([]);
        setExamData([]);
        setLoading(false);
        return;
      }

      const studentIds = studentsData.map(s => s.id);

      // 2. Get all exam attempts for these students (graded ones)
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exam_attempts')
        .select(`
          id,
          student_id,
          marks_obtained,
          completed_at,
          status,
          exam:exams(id, title, subject, total_marks, passing_marks)
        `)
        .in('student_id', studentIds)
        .in('status', ['graded', 'completed']);

      if (attemptsError) throw attemptsError;

      // Group attempts by student
      const attemptsByStudent: Record<string, ExamAttemptWithExam[]> = {};
      (attemptsData || []).forEach((attempt: any) => {
        if (!attempt.exam) return;
        const studentId = attempt.student_id;
        if (!attemptsByStudent[studentId]) {
          attemptsByStudent[studentId] = [];
        }
        attemptsByStudent[studentId].push({
          id: attempt.id,
          student_id: attempt.student_id,
          marks_obtained: attempt.marks_obtained,
          completed_at: attempt.completed_at,
          status: attempt.status,
          exam: attempt.exam
        });
      });

      setRawAttempts(attemptsByStudent);

      // 3. Calculate performance for each student
      const studentPerformances: StudentPerformance[] = studentsData.map(student => {
        const attempts = attemptsByStudent[student.id] || [];
        const examsTaken = attempts.length;
        const totalMarks = attempts.reduce((sum, a) => sum + (a.exam?.total_marks || 0), 0);
        const marksObtained = attempts.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
        const averagePercentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
        
        const passedExams = attempts.filter(a => 
          (a.marks_obtained || 0) >= (a.exam?.passing_marks || 0)
        ).length;
        const passRate = examsTaken > 0 ? (passedExams / examsTaken) * 100 : 0;

        const lastExam = attempts
          .filter(a => a.completed_at)
          .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

        return {
          studentId: student.id,
          studentName: student.full_name,
          email: student.email,
          grade: student.grade,
          examsTaken,
          totalMarks,
          marksObtained,
          averagePercentage,
          passRate,
          status: calculateStatus(averagePercentage),
          lastExamDate: lastExam?.completed_at || null
        };
      });

      setStudents(studentPerformances);

      // 4. Build exam data for class assessment
      const examMap: Record<string, ExamData> = {};
      (attemptsData || []).forEach((attempt: any) => {
        if (!attempt.exam) return;
        const examId = attempt.exam.id;
        if (!examMap[examId]) {
          examMap[examId] = {
            examId,
            examTitle: attempt.exam.title,
            subject: attempt.exam.subject,
            totalMarks: attempt.exam.total_marks,
            passingMarks: attempt.exam.passing_marks,
            attempts: []
          };
        }
        const student = studentsData.find(s => s.id === attempt.student_id);
        examMap[examId].attempts.push({
          studentId: attempt.student_id,
          studentName: student?.full_name || 'Unknown',
          marksObtained: attempt.marks_obtained || 0,
          passed: (attempt.marks_obtained || 0) >= attempt.exam.passing_marks
        });
      });

      setExamData(Object.values(examMap));

    } catch (error: any) {
      console.error('Error loading class data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportToPDF('class-assessment-report', `${className}-assessment-report`, classInfo);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(students, classInfo, `${className}-students`);
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleViewStudent = (student: StudentPerformance) => {
    setSelectedStudent(student);
  };

  const getStudentExamAttempts = (studentId: string) => {
    const attempts = rawAttempts[studentId] || [];
    return attempts.map(a => ({
      examTitle: a.exam.title,
      subject: a.exam.subject,
      marksObtained: a.marks_obtained || 0,
      totalMarks: a.exam.total_marks,
      passingMarks: a.exam.passing_marks,
      completedAt: a.completed_at
    }));
  };

  // Calculate summary stats
  const totalStudents = students.length;
  const studentsWithExams = students.filter(s => s.examsTaken > 0);
  const classAverage = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.averagePercentage, 0) / studentsWithExams.length
    : 0;
  const overallPassRate = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.passRate, 0) / studentsWithExams.length
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{className}</DialogTitle>
              <DialogDescription>
                {schoolName} • {gradeLevel || 'Grade N/A'}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading || exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : selectedStudent ? (
          <div>
            <Button 
              variant="ghost" 
              className="mb-4" 
              onClick={() => setSelectedStudent(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Students
            </Button>
            <StudentReportCard
              student={selectedStudent}
              examAttempts={getStudentExamAttempts(selectedStudent.studentId)}
            />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{totalStudents}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{classAverage.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Class Average</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-2xl font-bold">{overallPassRate.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Pass Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="students" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="students">
                  <Users className="h-4 w-4 mr-2" />
                  Students
                </TabsTrigger>
                <TabsTrigger value="performance">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="reports">
                  <FileText className="h-4 w-4 mr-2" />
                  Reports
                </TabsTrigger>
              </TabsList>

              <TabsContent value="students">
                <StudentPerformanceTable 
                  students={students} 
                  onViewStudent={handleViewStudent}
                />
              </TabsContent>

              <TabsContent value="performance">
                <ClassAssessmentReport
                  classInfo={classInfo}
                  students={students}
                  examData={examData}
                  adminRemarks={adminRemarks}
                  onRemarksChange={setAdminRemarks}
                />
              </TabsContent>

              <TabsContent value="reports">
                <ClassAssessmentReport
                  classInfo={classInfo}
                  students={students}
                  examData={examData}
                  adminRemarks={adminRemarks}
                  onRemarksChange={setAdminRemarks}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
