// Shared exam utility types and functions to reduce redundancy across dashboards

export interface ExamInfo {
  id: string;
  title: string;
  subject?: string;
  grade_level?: string;
  description?: string;
  duration_minutes?: number;
  total_marks: number;
  passing_marks: number;
  exam_date?: string;
}

export interface StudentExamAttempt {
  id: string;
  status: string;
  marks_obtained: number | null;
  attempted_at: string;
  completed_at: string | null;
  graded_at: string | null;
  exam_id: string;
  exams: ExamInfo;
}

export interface AdminExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  attempted_at: string;
  completed_at: string | null;
  status: string;
  marks_obtained: number | null;
  student: { full_name: string; email: string; grade: string } | null;
  exam: { title: string; total_marks: number } | null;
}

export const getSubjectIcon = (subject?: string): string => {
  const icons: Record<string, string> = {
    Science: '🔬',
    Technology: '💻',
    Engineering: '⚙️',
    Mathematics: '📐',
    Robotics: '🤖',
    AI: '🧠',
  };
  return icons[subject || ''] || '📚';
};

export const getSubjectColor = (subject?: string): string => {
  const colors: Record<string, string> = {
    Science: 'bg-[hsl(var(--stem-science))]',
    Technology: 'bg-[hsl(var(--stem-technology))]',
    Engineering: 'bg-[hsl(var(--stem-engineering))]',
    Mathematics: 'bg-[hsl(var(--stem-mathematics))]',
    Robotics: 'bg-[hsl(var(--stem-robotics))]',
    AI: 'bg-[hsl(var(--stem-ai))]',
  };
  return colors[subject || ''] || 'bg-primary';
};

/** Calculate percentage-based average score from graded attempts */
export const calcAvgScore = (
  attempts: { marks_obtained: number | null; exams: { total_marks: number } }[]
): number => {
  const graded = attempts.filter(
    (a) => a.marks_obtained !== null && a.exams?.total_marks > 0
  );
  if (graded.length === 0) return 0;
  return Math.round(
    graded.reduce(
      (sum, a) => sum + (a.marks_obtained! / a.exams.total_marks) * 100,
      0
    ) / graded.length
  );
};

/** Get status display info */
export const getAttemptStatusInfo = (
  status: string,
  marksObtained: number | null,
  passingMarks: number
): { label: string; variant: 'default' | 'secondary' | 'destructive'; passed: boolean } => {
  if (status === 'graded' && marksObtained !== null) {
    const passed = marksObtained >= passingMarks;
    return {
      label: passed ? '✓ Passed' : '✗ Failed',
      variant: passed ? 'default' : 'destructive',
      passed,
    };
  }
  if (status === 'completed') return { label: 'Completed', variant: 'secondary', passed: false };
  if (status === 'pending') return { label: 'Pending', variant: 'secondary', passed: false };
  if (status === 'in_progress') return { label: 'In Progress', variant: 'secondary', passed: false };
  return { label: status, variant: 'secondary', passed: false };
};
