import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StudentPerformance, getStatusColor, getStatusLabel } from '@/lib/exportUtils';
import { Eye, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface StudentPerformanceTableProps {
  students: StudentPerformance[];
  onViewStudent: (student: StudentPerformance) => void;
}

export default function StudentPerformanceTable({ 
  students, 
  onViewStudent 
}: StudentPerformanceTableProps) {
  if (students.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No students enrolled in this class yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-center">Exams Taken</TableHead>
            <TableHead className="text-center">Average Score</TableHead>
            <TableHead className="text-center">Pass Rate</TableHead>
            <TableHead className="text-center">Last Exam</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.studentId}>
              <TableCell className="font-medium">{student.studentName}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="text-sm">{student.email}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{student.examsTaken}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <span className="font-semibold">
                  {student.examsTaken > 0 ? `${student.averagePercentage.toFixed(1)}%` : '-'}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <span className={student.passRate >= 50 ? 'text-emerald-600' : 'text-red-600'}>
                  {student.examsTaken > 0 ? `${student.passRate.toFixed(0)}%` : '-'}
                </span>
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {student.lastExamDate 
                  ? format(new Date(student.lastExamDate), 'MMM d, yyyy')
                  : '-'}
              </TableCell>
              <TableCell className="text-center">
                <Badge className={getStatusColor(student.status)}>
                  {getStatusLabel(student.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewStudent(student)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
