

## Class Performance Portal - Implementation Plan

This plan adds a comprehensive class management portal that opens when an admin clicks on a class. The portal will display all students in that class, their individual performance metrics, and provide full assessment reports that can be exported.

---

## Overview

When an admin clicks on a class in the Schools tab, a detailed portal will open showing:
- List of all students enrolled in that class
- Individual student performance metrics based on their exam attempts
- Class-wide analytics with averages, pass rates, and grade distributions
- Detailed assessment reports with remarks
- Export functionality (PDF/CSV)

---

## Implementation Steps

### Step 1: Create ClassPerformancePortal Component

Create a new component `src/components/admin/ClassPerformancePortal.tsx` that serves as the main portal when a class is clicked.

**Features:**
- Header with class name, school name, and grade level
- Summary statistics (total students, class average, pass rate)
- Tabs for different views: "Students", "Performance", "Reports"

**Data to fetch:**
- Students where `class_id` matches selected class
- Exam attempts for those students with exam details
- Exam answers for detailed question-level analysis

---

### Step 2: Create Student Performance Table

Within the portal, create a table showing all students with columns:
- Student Name
- Email
- Exams Taken (count)
- Average Score (percentage)
- Pass Rate (individual)
- Last Exam Date
- Status (Excellent/Good/Needs Improvement)

**Performance calculation logic:**
```
averageScore = sum(marks_obtained) / sum(total_marks) * 100
passRate = passed_exams / total_exams * 100
```

---

### Step 3: Create Individual Student Report Component

Create `src/components/admin/StudentReportCard.tsx` for detailed individual reports:

**Sections:**
- Student profile summary
- Subject-wise performance breakdown
- Exam history with scores
- Strengths and areas for improvement
- Personalized remarks (auto-generated based on performance)

**Remarks Logic:**
- Score >= 90%: "Excellent performance! Keep up the outstanding work."
- Score 75-89%: "Good performance. Continue to build on your strengths."
- Score 60-74%: "Satisfactory performance. Focus on weaker areas."
- Score < 60%: "Needs improvement. Additional support recommended."

---

### Step 4: Create Class Assessment Report Component

Create `src/components/admin/ClassAssessmentReport.tsx` for full class reports:

**Content:**
- Class summary (school, grade, total students)
- Overall class statistics
- Subject-wise class performance (bar chart)
- Grade distribution (pie chart)
- Top performers list
- Students needing attention list
- Exam-by-exam breakdown
- Admin remarks section (editable)

---

### Step 5: Add Export Functionality

Create export utilities in `src/lib/exportUtils.ts`:

**PDF Export:**
- Use existing `html2canvas` and `jspdf` libraries
- Generate formatted class report PDF
- Include charts, tables, and remarks

**CSV Export:**
- Student performance data export
- Columns: Name, Email, Exams Taken, Average Score, Pass Rate, Status

---

### Step 6: Update SchoolManagement Component

Modify `src/components/admin/SchoolManagement.tsx`:

**Changes:**
- Add click handler on class rows in the table
- Add state for `selectedClass` and `showClassPortal`
- Render the ClassPerformancePortal as a Dialog/Sheet when a class is selected
- Add "View Class" button in the Actions column

---

### Step 7: Add Route for Direct Class Access (Optional)

Add a new route in `App.tsx`:
```
/admin/class/:classId
```

This allows direct linking to a class portal.

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/ClassPerformancePortal.tsx` | Main portal component with tabs |
| `src/components/admin/StudentPerformanceTable.tsx` | Table of all students with metrics |
| `src/components/admin/StudentReportCard.tsx` | Individual student detailed report |
| `src/components/admin/ClassAssessmentReport.tsx` | Full class assessment with charts |
| `src/lib/exportUtils.ts` | PDF and CSV export utilities |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/SchoolManagement.tsx` | Add class click handler, portal dialog |
| `src/App.tsx` | Add optional direct route to class portal |

---

## Database Queries Required

**1. Get students in a class:**
```typescript
supabase
  .from('students')
  .select('id, full_name, email, grade, created_at')
  .eq('class_id', classId)
```

**2. Get exam attempts for class students:**
```typescript
supabase
  .from('exam_attempts')
  .select('*, exam:exams(title, subject, total_marks, passing_marks)')
  .in('student_id', studentIds)
  .eq('status', 'graded')
```

**3. Get assigned exams for the class:**
```typescript
supabase
  .from('exam_class_assignments')
  .select('*, exam:exams(*)')
  .eq('class_id', classId)
  .eq('is_active', true)
```

---

## UI Components Used

The implementation will leverage existing UI components:
- `Dialog` / `Sheet` for the portal overlay
- `Tabs` for switching between views
- `Table` for student listings
- `Card` for summary statistics
- `Badge` for status indicators
- `Button` for actions and export
- `recharts` for performance visualizations (already installed)

---

## Technical Details

### Performance Metrics Calculation

```typescript
interface StudentPerformance {
  studentId: string;
  studentName: string;
  email: string;
  examsTaken: number;
  totalMarks: number;
  marksObtained: number;
  averagePercentage: number;
  passRate: number;
  status: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement';
  lastExamDate: string | null;
}

function calculatePerformance(attempts: ExamAttempt[]): StudentPerformance {
  const examsTaken = attempts.length;
  const totalMarks = attempts.reduce((sum, a) => sum + (a.exam?.total_marks || 0), 0);
  const marksObtained = attempts.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
  const averagePercentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
  
  const passedExams = attempts.filter(a => 
    a.marks_obtained >= (a.exam?.passing_marks || 0)
  ).length;
  const passRate = examsTaken > 0 ? (passedExams / examsTaken) * 100 : 0;
  
  // Determine status
  let status: string;
  if (averagePercentage >= 90) status = 'excellent';
  else if (averagePercentage >= 75) status = 'good';
  else if (averagePercentage >= 60) status = 'satisfactory';
  else status = 'needs-improvement';
  
  return { ... };
}
```

### Auto-Generated Remarks

```typescript
function generateRemarks(performance: StudentPerformance): string {
  const { averagePercentage, passRate, examsTaken } = performance;
  
  let remarks = '';
  
  if (examsTaken === 0) {
    return 'No exams attempted yet. Encourage participation.';
  }
  
  if (averagePercentage >= 90) {
    remarks = 'Exceptional academic performance. Demonstrates strong mastery of concepts. ';
    remarks += 'Recommended for advanced challenges.';
  } else if (averagePercentage >= 75) {
    remarks = 'Good academic standing with consistent performance. ';
    remarks += 'Continue current study habits while focusing on areas scoring below average.';
  } else if (averagePercentage >= 60) {
    remarks = 'Satisfactory performance with room for improvement. ';
    remarks += 'Recommend additional practice in weaker subjects.';
  } else {
    remarks = 'Performance below expectations. Requires immediate attention. ';
    remarks += 'Suggest one-on-one tutoring and parent-teacher consultation.';
  }
  
  return remarks;
}
```

### PDF Export Structure

The class assessment PDF will include:
1. **Cover page** - School name, class name, report date
2. **Executive summary** - Key statistics and highlights
3. **Class performance charts** - Visual representations
4. **Student roster** - All students with individual scores
5. **Detailed analysis** - Subject breakdown, trends
6. **Recommendations** - Based on class performance

---

## Summary

This implementation adds a comprehensive class management portal that provides admins with full visibility into class performance. The feature includes:

- Click-to-open class portal from Schools tab
- Complete student roster with performance metrics
- Individual student report cards with auto-generated remarks
- Class-wide assessment reports with visualizations
- Export capabilities for PDF and CSV formats

