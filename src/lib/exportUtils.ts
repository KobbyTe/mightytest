import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  email: string;
  grade: string | null;
  examsTaken: number;
  totalMarks: number;
  marksObtained: number;
  averagePercentage: number;
  passRate: number;
  status: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement';
  lastExamDate: string | null;
}

export interface ClassInfo {
  id: string;
  name: string;
  gradeLevel: string | null;
  schoolName: string;
}

export function calculateStatus(averagePercentage: number): StudentPerformance['status'] {
  if (averagePercentage >= 90) return 'excellent';
  if (averagePercentage >= 75) return 'good';
  if (averagePercentage >= 60) return 'satisfactory';
  return 'needs-improvement';
}

export function generateRemarks(performance: StudentPerformance): string {
  const { averagePercentage, passRate, examsTaken } = performance;
  
  if (examsTaken === 0) {
    return 'No exams attempted yet. Encourage participation in upcoming assessments.';
  }
  
  let remarks = '';
  
  if (averagePercentage >= 90) {
    remarks = 'Exceptional academic performance. Demonstrates strong mastery of concepts. ';
    remarks += 'Recommended for advanced challenges and leadership opportunities.';
  } else if (averagePercentage >= 75) {
    remarks = 'Good academic standing with consistent performance. ';
    remarks += 'Continue current study habits while focusing on areas scoring below average.';
  } else if (averagePercentage >= 60) {
    remarks = 'Satisfactory performance with room for improvement. ';
    remarks += 'Recommend additional practice in weaker subjects and regular revision.';
  } else {
    remarks = 'Performance below expectations. Requires immediate attention. ';
    remarks += 'Suggest one-on-one tutoring and parent-teacher consultation.';
  }
  
  if (passRate < 50 && examsTaken > 0) {
    remarks += ' Pass rate is concerning - extra support needed.';
  }
  
  return remarks;
}

export function getStatusColor(status: StudentPerformance['status']): string {
  switch (status) {
    case 'excellent': return 'text-emerald-600 bg-emerald-100';
    case 'good': return 'text-blue-600 bg-blue-100';
    case 'satisfactory': return 'text-amber-600 bg-amber-100';
    case 'needs-improvement': return 'text-red-600 bg-red-100';
    default: return 'text-muted-foreground bg-muted';
  }
}

export function getStatusLabel(status: StudentPerformance['status']): string {
  switch (status) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'satisfactory': return 'Satisfactory';
    case 'needs-improvement': return 'Needs Improvement';
    default: return 'Unknown';
  }
}

export async function exportToPDF(
  elementId: string, 
  filename: string,
  classInfo: ClassInfo
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found for PDF export');
  }

  // Clone the element outside the dialog to avoid html2canvas issues
  // with backdrop-filter, transforms, and dialog overlays
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.width = `${element.scrollWidth}px`;
  clone.style.backgroundColor = '#ffffff';
  clone.style.padding = '24px';
  clone.style.zIndex = '-1';
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      // Ignore SVG chart elements that html2canvas can't render well
      onclone: (clonedDoc) => {
        // Force all text to be visible
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            htmlEl.style.backdropFilter = 'none';
            htmlEl.style.webkitBackdropFilter = 'none';
          }
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    
    // Add header
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(classInfo.schoolName, pageWidth / 2, 15, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Class: ${classInfo.name} (${classInfo.gradeLevel || 'N/A'})`, pageWidth / 2, 23, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });

    // Calculate image dimensions
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const startY = 35;
    const maxContentHeight = pageHeight - startY - margin;

    // Multi-page support
    if (imgHeight <= maxContentHeight) {
      // Fits on one page
      pdf.addImage(imgData, 'PNG', margin, startY, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Split across multiple pages
      let currentY = 0;
      let pageNum = 0;
      const totalSourceHeight = canvas.height;
      const sourceWidth = canvas.width;

      while (currentY < totalSourceHeight) {
        if (pageNum > 0) {
          pdf.addPage();
        }

        const availableHeight = pageNum === 0 ? maxContentHeight : pageHeight - margin * 2;
        const sourceSliceHeight = (availableHeight / imgWidth) * sourceWidth;
        const sliceHeight = Math.min(sourceSliceHeight, totalSourceHeight - currentY);

        // Create a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sourceWidth;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, currentY, sourceWidth, sliceHeight, 0, 0, sourceWidth, sliceHeight);
          const sliceData = sliceCanvas.toDataURL('image/png');
          const sliceImgHeight = (sliceHeight * imgWidth) / sourceWidth;
          pdf.addImage(sliceData, 'PNG', margin, pageNum === 0 ? startY : margin, imgWidth, sliceImgHeight, undefined, 'FAST');
        }

        currentY += sliceHeight;
        pageNum++;
      }
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    // Always clean up the clone
    document.body.removeChild(clone);
  }
}

export function exportToCSV(
  students: StudentPerformance[], 
  classInfo: ClassInfo,
  filename: string
): void {
  const headers = [
    'Student Name',
    'Email',
    'Grade',
    'Exams Taken',
    'Total Marks',
    'Marks Obtained',
    'Average (%)',
    'Pass Rate (%)',
    'Status',
    'Last Exam Date'
  ];

  const rows = students.map(student => [
    student.studentName,
    student.email,
    student.grade || 'N/A',
    student.examsTaken.toString(),
    student.totalMarks.toString(),
    student.marksObtained.toString(),
    student.averagePercentage.toFixed(1),
    student.passRate.toFixed(1),
    getStatusLabel(student.status),
    student.lastExamDate || 'N/A'
  ]);

  const csvContent = [
    `Class Performance Report - ${classInfo.name}`,
    `School: ${classInfo.schoolName}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
