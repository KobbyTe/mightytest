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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Users, 
  TrendingUp, 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Loader2,
  ArrowLeft,
  Trophy
} from 'lucide-react';
import { motion } from 'framer-motion';
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
  const [activeTab, setActiveTab] = useState<'rankings' | 'students' | 'performance' | 'reports'>('rankings');

  const REPORT_EXPORT_ID = 'class-assessment-report-export';

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

      // Group all attempts by student, then deduplicate per exam (keep best score)
      const allAttemptsByStudent: Record<string, ExamAttemptWithExam[]> = {};
      (attemptsData || []).forEach((attempt: any) => {
        if (!attempt.exam) return;
        const studentId = attempt.student_id;
        if (!allAttemptsByStudent[studentId]) {
          allAttemptsByStudent[studentId] = [];
        }
        allAttemptsByStudent[studentId].push({
          id: attempt.id,
          student_id: attempt.student_id,
          marks_obtained: attempt.marks_obtained,
          completed_at: attempt.completed_at,
          status: attempt.status,
          exam: attempt.exam
        });
      });

      // Deduplicate: keep only best-scoring attempt per exam per student
      const attemptsByStudent: Record<string, ExamAttemptWithExam[]> = {};
      Object.entries(allAttemptsByStudent).forEach(([studentId, attempts]) => {
        const bestByExam: Record<string, ExamAttemptWithExam> = {};
        attempts.forEach(a => {
          const examId = a.exam.id;
          if (!bestByExam[examId] || (a.marks_obtained || 0) > (bestByExam[examId].marks_obtained || 0)) {
            bestByExam[examId] = a;
          }
        });
        attemptsByStudent[studentId] = Object.values(bestByExam);
      });

      setRawAttempts(attemptsByStudent);

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
      // Fetch AI summary from edge function
      let aiSummary = '';
      try {
        const { data, error } = await supabase.functions.invoke('generate-pdf-report', {
          body: { class_id: classId },
        });
        if (!error && data?.report?.aiSummary) {
          aiSummary = data.report.aiSummary;
        }
      } catch (e) {
        console.warn('AI summary unavailable, continuing without it');
      }

      const { default: jsPDF } = await import('jspdf');
      const pw = 297; // A4 landscape width mm
      const ph = 210; // A4 landscape height mm
      const margin = 14;

      // ── Color palette (refined, professional) ──
      const brandDark = [15, 30, 55];      // rich deep navy
      const brandMid = [20, 78, 110];      // deep teal
      const brandAccent = [38, 120, 150];   // teal accent
      const white = [255, 255, 255];
      const textDark = [17, 24, 39];
      const textMid = [100, 116, 139];      // slate-500
      const rowAlt = [248, 250, 252];       // slate-50 (very subtle)
      const greenBg = [220, 252, 231]; const greenTxt = [21, 128, 61];
      const amberBg = [254, 243, 199]; const amberTxt = [146, 64, 14];
      const redBg = [254, 226, 226]; const redTxt = [185, 28, 28];
      const goldBg = [254, 249, 195]; const silverBg = [241, 245, 249]; const bronzeBg = [254, 237, 213];
      const summaryBg = [241, 245, 249];    // slate-100

      // ── Helper: draw colored rect (uses `p` which is created below) ──
      let p: any;
      const fillRect = (x: number, y: number, w: number, h: number, color: number[]) => {
        p.setFillColor(color[0], color[1], color[2]);
        p.rect(x, y, w, h, 'F');
      };

      // ── Helper: get remark ──
      const getRemark = (pct: number) => {
        if (pct >= 90) return 'Excellent';
        if (pct >= 75) return 'Very Good';
        if (pct >= 60) return 'Good';
        if (pct >= 50) return 'Fair';
        return 'Needs Imp.';
      };

      // ── Column layout ──
      const testCount = examOrder.length;
      const studentColW = 44;
      const totalColW = 20;
      const avgColW = 18;
      const pctColW = 22;
      const posColW = 14;
      const remarkColW = 28;
      const fixedW = studentColW + totalColW + avgColW + pctColW + posColW + remarkColW;
      const availableForTests = (pw - margin * 2) - fixedW;
      const testColW = testCount > 0 ? Math.min(24, Math.max(14, availableForTests / testCount)) : 0;
      const actualTableW = studentColW + (testColW * testCount) + totalColW + avgColW + pctColW + posColW + remarkColW;

      // ── Center table horizontally ──
      const tableStartX = (pw - actualTableW) / 2;

      // Column x-positions (centered)
      const cols: number[] = [];
      let cx = tableStartX;
      cols.push(cx); cx += studentColW; // 0: Student
      for (let i = 0; i < testCount; i++) { cols.push(cx); cx += testColW; } // 1..N: Tests
      const totalIdx = cols.length; cols.push(cx); cx += totalColW;
      const avgIdx = cols.length; cols.push(cx); cx += avgColW;
      const pctIdx = cols.length; cols.push(cx); cx += pctColW;
      const posIdx = cols.length; cols.push(cx); cx += posColW;
      const remarkIdx = cols.length; cols.push(cx);

      const rowH = 8;
      const headerH = 10;

      // ── First pass: figure out page count ──
      // Simulate layout to count pages
      let simY = 50; // approximate header height
      let pageCount = 1;
      for (let i = 0; i < rankedStudents.length; i++) {
        if (simY + rowH > ph - 12) {
          pageCount++;
          simY = 14 + headerH + 1;
        }
        simY += rowH;
      }

      // ── Actual rendering ──
      p = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let currentPage = 1;
      let y = 0;

      // ── Load logo as base64 for PDF embedding ──
      let logoBase64: string | null = null;
      try {
        const logoModule = await import('@/assets/mighty-test-logo.png');
        const response = await fetch(logoModule.default);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Could not load logo for PDF, continuing without it');
      }

      // ── Draw page header ──
      function drawPageHeaderOn(doc: any) {
        let y = 0;
        // Elegant navy-to-teal gradient band (simulated with gradient stops)
        const bandH = 22;
        const steps = 20;
        const stepW = pw / steps;
        for (let i = 0; i < steps; i++) {
          const ratio = i / (steps - 1);
          const r = Math.round(brandDark[0] + (brandAccent[0] - brandDark[0]) * ratio);
          const g = Math.round(brandDark[1] + (brandAccent[1] - brandDark[1]) * ratio);
          const b = Math.round(brandDark[2] + (brandAccent[2] - brandDark[2]) * ratio);
          doc.setFillColor(r, g, b);
          doc.rect(i * stepW, 0, stepW + 0.5, bandH, 'F');
        }

        // Add logo to header band (left side)
        const logoSize = 16;
        const logoX = margin + 2;
        const logoY = (bandH - logoSize) / 2;
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
          } catch (e) {
            console.warn('Failed to add logo to PDF page');
          }
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(schoolName.toUpperCase(), pw / 2, 10, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 230, 240);
        doc.text(`${className}  •  ${gradeLevel || 'Grade N/A'}  •  Class Performance Report`, pw / 2, 17, { align: 'center' });

        y = 26;

        // Meta row — centered
        doc.setTextColor(textMid[0], textMid[1], textMid[2]);
        doc.setFontSize(8);
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const metaItems = [
          `Generated: ${dateStr}`,
          `Students: ${totalStudents}`,
          `Class Average: ${classAverage.toFixed(1)}%`,
          `Tests: ${testCount}`
        ];
        const metaStr = metaItems.join('    •    ');
        doc.text(metaStr, pw / 2, y, { align: 'center' });
        y += 5;

        // AI Summary box
        if (aiSummary) {
          doc.setFillColor(brandMid[0], brandMid[1], brandMid[2]);
          doc.rect(tableStartX, y, actualTableW, 0.8, 'F');
          y += 2.5;
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(textMid[0], textMid[1], textMid[2]);
          const lines = doc.splitTextToSize(aiSummary, actualTableW - 6);
          const boxH = lines.length * 3.2 + 4;
          doc.setFillColor(summaryBg[0], summaryBg[1], summaryBg[2]);
          doc.rect(tableStartX, y, actualTableW, boxH, 'F');
          doc.text(lines, tableStartX + 3, y + 3.5);
          y += boxH + 2;
        }

        // Thin separator line above table
        y += 1;
        doc.setDrawColor(200, 210, 220);
        doc.setLineWidth(0.3);
        doc.line(tableStartX, y, tableStartX + actualTableW, y);
        y += 2;
        return y;
      }

      // ── Draw table header row ──
      function drawTableHeaderOn(doc: any, startY: number) {
        doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
        doc.rect(tableStartX, startY - 1, actualTableW, headerH, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        const hY = startY + 5;
        // Student — left aligned
        doc.text('Student', cols[0] + 2, hY);
        // Tests — center aligned
        examOrder.forEach((_, idx) => {
          doc.text(`Test ${idx + 1}`, cols[idx + 1] + testColW / 2, hY, { align: 'center' });
        });
        // Numeric headers — center aligned
        doc.text('Total', cols[totalIdx] + totalColW / 2, hY, { align: 'center' });
        doc.text('Average', cols[avgIdx] + avgColW / 2, hY, { align: 'center' });
        doc.text('Pct (%)', cols[pctIdx] + pctColW / 2, hY, { align: 'center' });
        doc.text('Pos', cols[posIdx] + posColW / 2, hY, { align: 'center' });
        // Remark — left aligned
        doc.text('Remark', cols[remarkIdx] + 2, hY);
        return startY + headerH + 1;
      }

      // ── Draw footer ──
      function drawFooterOn(doc: any, pageNum: number, totalPages: number) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textMid[0], textMid[1], textMid[2]);
        doc.text(`${schoolName} • ${className} Assessment Report`, tableStartX, ph - 5);
        doc.text(`Page ${pageNum} of ${totalPages}`, tableStartX + actualTableW, ph - 5, { align: 'right' });
        // Bottom brand line
        doc.setFillColor(brandMid[0], brandMid[1], brandMid[2]);
        doc.rect(tableStartX, ph - 3, actualTableW, 0.5, 'F');
      }

      y = drawPageHeaderOn(p);
      y = drawTableHeaderOn(p, y);

      for (let rowIdx = 0; rowIdx < rankedStudents.length; rowIdx++) {
        if (y + rowH > ph - 12) {
          drawFooterOn(p, currentPage, pageCount);
          p.addPage();
          currentPage++;
          y = 10;
          y = drawTableHeaderOn(p, y);
        }

        const student = rankedStudents[rowIdx];
        const studentAttempts = rawAttempts[student.studentId] || [];
        const isAlt = rowIdx % 2 === 1;

        // Row background
        if (isAlt) fillRect(tableStartX, y - 1, actualTableW, rowH, rowAlt as any);

        const rY = y + 4.5;
        p.setFontSize(7);
        p.setFont('helvetica', 'normal');
        p.setTextColor(textDark[0], textDark[1], textDark[2]);

        // Student name — left aligned (bold for top 3)
        if ((student as any).position <= 3) {
          p.setFont('helvetica', 'bold');
        }
        p.text(student.studentName.substring(0, 26), cols[0] + 2, rY);
        p.setFont('helvetica', 'normal');

        // Test scores — center aligned
        examOrder.forEach((exam, idx) => {
          const attempt = studentAttempts.find(a => a.exam.id === exam.examId);
          if (attempt) {
            const marks = attempt.marks_obtained || 0;
            const pct = exam.totalMarks > 0 ? (marks / exam.totalMarks) * 100 : 0;
            const color = pct >= 75 ? greenTxt : pct >= 60 ? amberTxt : redTxt;
            p.setTextColor(color[0], color[1], color[2]);
            p.text(`${marks}/${exam.totalMarks}`, cols[idx + 1] + testColW / 2, rY, { align: 'center' });
          } else {
            p.setTextColor(textMid[0], textMid[1], textMid[2]);
            p.text('—', cols[idx + 1] + testColW / 2, rY, { align: 'center' });
          }
        });

        // Total — center aligned
        p.setTextColor(textDark[0], textDark[1], textDark[2]);
        p.setFont('helvetica', 'bold');
        p.text(`${student.marksObtained}/${student.totalMarks}`, cols[totalIdx] + totalColW / 2, rY, { align: 'center' });

        // Average — center aligned
        p.setFont('helvetica', 'normal');
        const avg = student.examsTaken > 0 ? (student.marksObtained / student.examsTaken).toFixed(1) : '0';
        p.text(avg, cols[avgIdx] + avgColW / 2, rY, { align: 'center' });

        // Percentage pill — center aligned
        const pctVal = student.averagePercentage;
        const pillBg = pctVal >= 75 ? greenBg : pctVal >= 60 ? amberBg : redBg;
        const pillTxt = pctVal >= 75 ? greenTxt : pctVal >= 60 ? amberTxt : redTxt;
        const pctStr = `${pctVal.toFixed(1)}%`;
        fillRect(cols[pctIdx] + 1, y, pctColW - 2, rowH - 2, pillBg as any);
        p.setFont('helvetica', 'bold');
        p.setTextColor(pillTxt[0], pillTxt[1], pillTxt[2]);
        p.text(pctStr, cols[pctIdx] + pctColW / 2, rY, { align: 'center' });

        // Position badge — center aligned
        const pos = (student as any).position;
        const posBg = pos === 1 ? goldBg : pos === 2 ? silverBg : pos === 3 ? bronzeBg : [255, 255, 255];
        if (pos <= 3) {
          fillRect(cols[posIdx] + 2, y, posColW - 4, rowH - 2, posBg as any);
        }
        p.setFont('helvetica', 'bold');
        p.setTextColor(textDark[0], textDark[1], textDark[2]);
        p.text(String(pos), cols[posIdx] + posColW / 2, rY, { align: 'center' });

        // Remark — left aligned with pill bg
        const remark = getRemark(pctVal);
        const remBg = pctVal >= 75 ? greenBg : pctVal >= 60 ? amberBg : redBg;
        const remTxt = pctVal >= 75 ? greenTxt : pctVal >= 60 ? amberTxt : redTxt;
        fillRect(cols[remarkIdx] + 1, y, remarkColW - 2, rowH - 2, remBg as any);
        p.setFont('helvetica', 'bold');
        p.setFontSize(6.5);
        p.setTextColor(remTxt[0], remTxt[1], remTxt[2]);
        p.text(remark, cols[remarkIdx] + 2, rY);

        // Row bottom border
        p.setDrawColor(220, 225, 230);
        p.setLineWidth(0.15);
        p.line(tableStartX, y + rowH - 1, tableStartX + actualTableW, y + rowH - 1);

        y += rowH;
      }

      // Final footer
      drawFooterOn(p, currentPage, pageCount);
      p.save(`${className}-Assessment-Report.pdf`);
      toast.success('PDF exported successfully');

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF. Please try again.');
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

  // Rank students by total marks obtained (primary), then percentage (tiebreaker)
  const rankedStudents = [...students]
    .sort((a, b) => {
      if (b.marksObtained !== a.marksObtained) return b.marksObtained - a.marksObtained;
      return b.averagePercentage - a.averagePercentage;
    })
    .map((s, idx) => ({ ...s, position: idx + 1 }));

  // Build a unified exam list (sorted chronologically by earliest attempt)
  const allExamIds = [...new Set(
    Object.values(rawAttempts).flat().map(a => a.exam.id)
  )];
  const examOrder = allExamIds.map(examId => {
    const firstAttempt = Object.values(rawAttempts).flat()
      .filter(a => a.exam.id === examId)
      .sort((a, b) => {
        const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return da - db;
      })[0];
    return { examId, title: firstAttempt?.exam.title || 'Exam', totalMarks: firstAttempt?.exam.total_marks || 0, date: firstAttempt?.completed_at || '' };
  }).sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });

  // Calculate summary stats
  const totalStudents = students.length;
  const studentsWithExams = students.filter(s => s.examsTaken > 0);
  const classAverage = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.averagePercentage, 0) / studentsWithExams.length
    : 0;
  const overallPassRate = studentsWithExams.length > 0
    ? studentsWithExams.reduce((sum, s) => sum + s.passRate, 0) / studentsWithExams.length
    : 0;

  const getPercentageColor = (pct: number) => {
    if (pct >= 75) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-destructive';
  };

  const getRemarkText = (pct: number) => {
    if (pct >= 90) return 'Excellent';
    if (pct >= 75) return 'Very Good';
    if (pct >= 60) return 'Good';
    if (pct >= 50) return 'Fair';
    return 'Needs Improvement';
  };

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
              position={rankedStudents.find(s => s.studentId === selectedStudent.studentId)?.position}
            />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="backdrop-blur-xl bg-card/80 border-border/50">
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
              <Card className="backdrop-blur-xl bg-card/80 border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-2xl font-bold">{classAverage.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Class Average</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="rankings">
                  <Trophy className="h-4 w-4 mr-2" />
                  Rankings
                </TabsTrigger>
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

              <TabsContent value="rankings">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden border-0 shadow-xl bg-card">
                    {/* Premium gradient header */}
                    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-white/20 p-2">
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Class Rankings</h3>
                            <p className="text-white/70 text-xs">{className} • {schoolName}</p>
                          </div>
                        </div>
                        <Badge className="bg-white/20 text-white border-0 text-xs font-medium">
                          {totalStudents} Students
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {rankedStudents.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">No exam data available yet.</p>
                      ) : (
                        <div className="relative w-full overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b-2 border-indigo-200 dark:border-indigo-800">
                                <TableHead className="font-extrabold text-foreground whitespace-nowrap text-sm sticky left-0 bg-gradient-to-r from-indigo-50 to-indigo-50 dark:from-indigo-950/30 dark:to-indigo-950/30 z-10">Student</TableHead>
                                {examOrder.map((exam, idx) => (
                                  <TableHead key={exam.examId} className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">
                                    Test {idx + 1}
                                  </TableHead>
                                ))}
                                <TableHead className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">Total</TableHead>
                                <TableHead className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">Average</TableHead>
                                <TableHead className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">Percentage (100%)</TableHead>
                                <TableHead className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">Position</TableHead>
                                <TableHead className="font-extrabold text-foreground text-center whitespace-nowrap text-sm">Remark</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rankedStudents.map((student, rowIdx) => {
                                const studentAttempts = rawAttempts[student.studentId] || [];
                                let totalObtained = 0;
                                let totalPossible = 0;
                                
                                return (
                                  <TableRow 
                                    key={student.studentId} 
                                    className={`cursor-pointer transition-colors hover:bg-primary/5 ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
                                    onClick={() => handleViewStudent(student)}
                                  >
                                    <TableCell className={`font-semibold whitespace-nowrap sticky left-0 z-10 ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}>
                                      <div className="flex items-center gap-2">
                                        {student.position <= 3 && (
                                          <span className={`inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-bold ${
                                            student.position === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                            student.position === 2 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                          }`}>
                                            {student.position}
                                          </span>
                                        )}
                                        {student.studentName}
                                      </div>
                                    </TableCell>
                                    {examOrder.map((exam) => {
                                      const attempt = studentAttempts.find(a => a.exam.id === exam.examId);
                                      const marks = attempt?.marks_obtained || 0;
                                      const total = exam.totalMarks;
                                      if (attempt) {
                                        totalObtained += marks;
                                        totalPossible += total;
                                      }
                                      const pct = total > 0 ? (marks / total) * 100 : 0;
                                      return (
                                        <TableCell key={exam.examId} className="text-center whitespace-nowrap">
                                          {attempt ? (
                                            <>
                                              <span className={`font-semibold ${getPercentageColor(pct)}`}>
                                                {marks}
                                              </span>
                                              <span className="text-muted-foreground text-xs">/{total}</span>
                                            </>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                    <TableCell className="text-center font-bold whitespace-nowrap">
                                      {student.marksObtained}<span className="text-muted-foreground text-xs font-normal">/{student.totalMarks}</span>
                                    </TableCell>
                                    <TableCell className="text-center font-semibold whitespace-nowrap">
                                      {student.examsTaken > 0 ? (student.marksObtained / student.examsTaken).toFixed(1) : '0'}
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                        student.averagePercentage >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                                        student.averagePercentage >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                      }`}>
                                        {student.averagePercentage.toFixed(1)}%
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary w-8 h-8 text-sm font-bold">
                                        {student.position}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-center whitespace-nowrap">
                                      <Badge className={`text-xs font-semibold border-0 ${
                                        student.averagePercentage >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                                        student.averagePercentage >= 75 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                                        student.averagePercentage >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                                        student.averagePercentage >= 50 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                      }`}>
                                        {getRemarkText(student.averagePercentage)}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

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
                  reportId="class-assessment-report-performance"
                />
              </TabsContent>

              <TabsContent value="reports">
                <ClassAssessmentReport
                  classInfo={classInfo}
                  students={students}
                  examData={examData}
                  adminRemarks={adminRemarks}
                  onRemarksChange={setAdminRemarks}
                  reportId={REPORT_EXPORT_ID}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
