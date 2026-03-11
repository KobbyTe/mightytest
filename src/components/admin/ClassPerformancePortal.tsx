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
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const tableWidth = pw - margin * 2;

      // ── Color palette ──
      const brandDark = [30, 41, 82];     // deep navy
      const brandMid = [79, 70, 229];     // indigo-600
      const brandLight = [236, 72, 153];  // pink-500
      const white = [255, 255, 255];
      const textDark = [17, 24, 39];
      const textMid = [75, 85, 99];
      const headerBg = [238, 242, 255];   // indigo-50
      const rowAlt = [249, 250, 251];     // gray-50
      const greenBg = [220, 252, 231]; const greenTxt = [21, 128, 61];
      const amberBg = [254, 243, 199]; const amberTxt = [146, 64, 14];
      const redBg = [254, 226, 226]; const redTxt = [185, 28, 28];
      const goldBg = [254, 249, 195]; const silverBg = [243, 244, 246]; const bronzeBg = [254, 237, 213];

      // ── Helper: draw colored rect ──
      const fillRect = (x: number, y: number, w: number, h: number, color: number[]) => {
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(x, y, w, h, 'F');
      };

      // ── Helper: draw gradient band (simulated with 2 rects) ──
      const drawBrandBand = (y: number, h: number) => {
        fillRect(margin, y, tableWidth / 2, h, brandMid as any);
        fillRect(margin + tableWidth / 2, y, tableWidth / 2, h, brandLight as any);
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
      const availableForTests = tableWidth - fixedW;
      const testColW = testCount > 0 ? Math.min(24, Math.max(14, availableForTests / testCount)) : 0;
      const actualTableW = studentColW + (testColW * testCount) + totalColW + avgColW + pctColW + posColW + remarkColW;

      // Column x-positions
      const cols: number[] = [];
      let cx = margin;
      cols.push(cx); cx += studentColW; // 0: Student
      for (let i = 0; i < testCount; i++) { cols.push(cx); cx += testColW; } // 1..N: Tests
      const totalIdx = cols.length; cols.push(cx); cx += totalColW;
      const avgIdx = cols.length; cols.push(cx); cx += avgColW;
      const pctIdx = cols.length; cols.push(cx); cx += pctColW;
      const posIdx = cols.length; cols.push(cx); cx += posColW;
      const remarkIdx = cols.length; cols.push(cx);

      const rowH = 7;
      const headerH = 9;

      // ── Draw page header ──
      const drawPageHeader = () => {
        let y = 0;

        // Brand band
        drawBrandBand(0, 22);

        // School name
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(white[0], white[1], white[2]);
        pdf.text(schoolName.toUpperCase(), pw / 2, 10, { align: 'center' });

        // Class info
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${className}  •  ${gradeLevel || 'Grade N/A'}  •  Class Performance Report`, pw / 2, 17, { align: 'center' });

        y = 26;

        // Meta row
        pdf.setTextColor(textMid[0], textMid[1], textMid[2]);
        pdf.setFontSize(8);
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        pdf.text(`Generated: ${dateStr}`, margin, y);
        pdf.text(`Students: ${totalStudents}`, margin + 70, y);
        pdf.text(`Class Average: ${classAverage.toFixed(1)}%`, margin + 110, y);
        pdf.text(`Tests: ${testCount}`, margin + 165, y);
        y += 5;

        // AI Summary box
        if (aiSummary) {
          fillRect(margin, y, actualTableW, 1, brandMid as any);
          y += 3;
          fillRect(margin, y, actualTableW, 0, headerBg as any);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(textMid[0], textMid[1], textMid[2]);
          const lines = pdf.splitTextToSize(aiSummary, actualTableW - 6);
          const boxH = lines.length * 3.2 + 4;
          fillRect(margin, y, actualTableW, boxH, headerBg as any);
          pdf.text(lines, margin + 3, y + 3.5);
          y += boxH + 2;
        }

        y += 2;
        return y;
      };

      // ── Draw table header row ──
      const drawTableHeader = (y: number) => {
        fillRect(margin, y - 1, actualTableW, headerH, brandDark as any);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(white[0], white[1], white[2]);
        const hY = y + 4.5;
        pdf.text('Student', cols[0] + 2, hY);
        examOrder.forEach((_, idx) => {
          pdf.text(`Test ${idx + 1}`, cols[idx + 1] + 1, hY);
        });
        pdf.text('Total', cols[totalIdx] + 1, hY);
        pdf.text('Average', cols[avgIdx] + 1, hY);
        pdf.text('Pct (%)', cols[pctIdx] + 1, hY);
        pdf.text('Pos', cols[posIdx] + 1, hY);
        pdf.text('Remark', cols[remarkIdx] + 1, hY);
        return y + headerH + 1;
      };

      // ── Draw footer ──
      const drawFooter = (pageNum: number, totalPages: number) => {
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(textMid[0], textMid[1], textMid[2]);
        pdf.text(`${schoolName} • ${className} Assessment Report`, margin, ph - 5);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pw - margin, ph - 5, { align: 'right' });
        // Bottom brand line
        fillRect(margin, ph - 3, actualTableW, 0.5, brandMid as any);
      };

      // ── First pass: figure out page count ──
      let y = drawPageHeader();
      y = drawTableHeader(y);
      let pageCount = 1;
      for (let i = 0; i < rankedStudents.length; i++) {
        if (y + rowH > ph - 12) {
          pageCount++;
          y = 14;
          y = drawTableHeader(y);
        }
        y += rowH;
      }

      // ── Actual rendering ──
      // Reset
      const pdf2 = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const p = pdf2;
      let currentPage = 1;

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
        if (isAlt) fillRect(margin, y - 1, actualTableW, rowH, rowAlt as any);

        const rY = y + 4;
        p.setFontSize(7);
        p.setFont('helvetica', 'normal');
        p.setTextColor(textDark[0], textDark[1], textDark[2]);

        // Student name (bold for top 3)
        if ((student as any).position <= 3) {
          p.setFont('helvetica', 'bold');
        }
        p.text(student.studentName.substring(0, 26), cols[0] + 2, rY);
        p.setFont('helvetica', 'normal');

        // Test scores
        examOrder.forEach((exam, idx) => {
          const attempt = studentAttempts.find(a => a.exam.id === exam.examId);
          if (attempt) {
            const marks = attempt.marks_obtained || 0;
            const pct = exam.totalMarks > 0 ? (marks / exam.totalMarks) * 100 : 0;
            const color = pct >= 75 ? greenTxt : pct >= 60 ? amberTxt : redTxt;
            p.setTextColor(color[0], color[1], color[2]);
            p.text(`${marks}/${exam.totalMarks}`, cols[idx + 1] + 1, rY);
          } else {
            p.setTextColor(textMid[0], textMid[1], textMid[2]);
            p.text('—', cols[idx + 1] + 1, rY);
          }
        });

        // Total
        p.setTextColor(textDark[0], textDark[1], textDark[2]);
        p.setFont('helvetica', 'bold');
        p.text(`${student.marksObtained}/${student.totalMarks}`, cols[totalIdx] + 1, rY);

        // Average
        p.setFont('helvetica', 'normal');
        const avg = student.examsTaken > 0 ? (student.marksObtained / student.examsTaken).toFixed(1) : '0';
        p.text(avg, cols[avgIdx] + 1, rY);

        // Percentage pill
        const pctVal = student.averagePercentage;
        const pillBg = pctVal >= 75 ? greenBg : pctVal >= 60 ? amberBg : redBg;
        const pillTxt = pctVal >= 75 ? greenTxt : pctVal >= 60 ? amberTxt : redTxt;
        const pctStr = `${pctVal.toFixed(1)}%`;
        fillRect(cols[pctIdx] + 0.5, y - 0.5, pctColW - 2, rowH - 1, pillBg as any);
        p.setFont('helvetica', 'bold');
        p.setTextColor(pillTxt[0], pillTxt[1], pillTxt[2]);
        p.text(pctStr, cols[pctIdx] + 1.5, rY);

        // Position badge
        const pos = (student as any).position;
        const posBg = pos === 1 ? goldBg : pos === 2 ? silverBg : pos === 3 ? bronzeBg : [255, 255, 255];
        if (pos <= 3) {
          fillRect(cols[posIdx] + 1, y, 10, rowH - 2, posBg as any);
        }
        p.setFont('helvetica', 'bold');
        p.setTextColor(textDark[0], textDark[1], textDark[2]);
        p.text(String(pos), cols[posIdx] + 4, rY);

        // Remark
        const remark = getRemark(pctVal);
        const remBg = pctVal >= 75 ? greenBg : pctVal >= 60 ? amberBg : redBg;
        const remTxt = pctVal >= 75 ? greenTxt : pctVal >= 60 ? amberTxt : redTxt;
        fillRect(cols[remarkIdx] + 0.5, y - 0.5, remarkColW - 2, rowH - 1, remBg as any);
        p.setFont('helvetica', 'bold');
        p.setFontSize(6.5);
        p.setTextColor(remTxt[0], remTxt[1], remTxt[2]);
        p.text(remark, cols[remarkIdx] + 1.5, rY);

        // Row bottom border
        p.setDrawColor(230, 230, 230);
        p.line(margin, y + rowH - 1, margin + actualTableW, y + rowH - 1);

        y += rowH;
      }

      // Final footer
      drawFooterOn(p, currentPage, pageCount);
      p.save(`${className}-Assessment-Report.pdf`);
      toast.success('PDF exported successfully');

      // ── Inline helpers that reference the same pdf instance ──
      function drawPageHeaderOn(doc: any) {
        let y = 0;
        // Brand band
        doc.setFillColor(brandMid[0], brandMid[1], brandMid[2]);
        doc.rect(0, 0, pw / 2, 22, 'F');
        doc.setFillColor(brandLight[0], brandLight[1], brandLight[2]);
        doc.rect(pw / 2, 0, pw / 2, 22, 'F');

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(schoolName.toUpperCase(), pw / 2, 10, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${className}  •  ${gradeLevel || 'Grade N/A'}  •  Class Performance Report`, pw / 2, 17, { align: 'center' });

        y = 26;
        doc.setTextColor(textMid[0], textMid[1], textMid[2]);
        doc.setFontSize(8);
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(`Generated: ${dateStr}`, margin, y);
        doc.text(`Students: ${totalStudents}`, margin + 70, y);
        doc.text(`Class Average: ${classAverage.toFixed(1)}%`, margin + 110, y);
        doc.text(`Tests: ${testCount}`, margin + 165, y);
        y += 5;

        if (aiSummary) {
          doc.setFillColor(brandMid[0], brandMid[1], brandMid[2]);
          doc.rect(margin, y, actualTableW, 0.8, 'F');
          y += 2.5;
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(textMid[0], textMid[1], textMid[2]);
          const lines = doc.splitTextToSize(aiSummary, actualTableW - 6);
          const boxH = lines.length * 3.2 + 4;
          doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
          doc.rect(margin, y, actualTableW, boxH, 'F');
          doc.text(lines, margin + 3, y + 3.5);
          y += boxH + 2;
        }
        y += 2;
        return y;
      }

      function drawTableHeaderOn(doc: any, startY: number) {
        doc.setFillColor(brandDark[0], brandDark[1], brandDark[2]);
        doc.rect(margin, startY - 1, actualTableW, headerH, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        const hY = startY + 4.5;
        doc.text('Student', cols[0] + 2, hY);
        examOrder.forEach((_, idx) => { doc.text(`Test ${idx + 1}`, cols[idx + 1] + 1, hY); });
        doc.text('Total', cols[totalIdx] + 1, hY);
        doc.text('Average', cols[avgIdx] + 1, hY);
        doc.text('Pct (%)', cols[pctIdx] + 1, hY);
        doc.text('Pos', cols[posIdx] + 1, hY);
        doc.text('Remark', cols[remarkIdx] + 1, hY);
        return startY + headerH + 1;
      }

      function drawFooterOn(doc: any, pageNum: number, totalPages: number) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(textMid[0], textMid[1], textMid[2]);
        doc.text(`${schoolName} • ${className} Assessment Report`, margin, ph - 5);
        doc.text(`Page ${pageNum} of ${totalPages}`, pw - margin, ph - 5, { align: 'right' });
        doc.setFillColor(brandMid[0], brandMid[1], brandMid[2]);
        doc.rect(margin, ph - 3, actualTableW, 0.5, 'F');
      }

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

  // Rank students by percentage
  const rankedStudents = [...students]
    .sort((a, b) => b.averagePercentage - a.averagePercentage)
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
