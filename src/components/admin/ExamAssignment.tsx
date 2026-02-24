import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ClipboardList, Plus, Trash2, Search, Filter, Calendar, GraduationCap, Building2 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Exam {
  id: string;
  title: string;
  subject: string | null;
  status: string;
  total_marks: number;
  duration_minutes: number | null;
}

interface School {
  id: string;
  name: string;
  code: string;
}

interface Class {
  id: string;
  name: string;
  school_id: string;
  grade_level: string | null;
  school?: School;
}

interface ExamAssignment {
  id: string;
  exam_id: string;
  class_id: string;
  assigned_at: string;
  due_date: string | null;
  is_active: boolean;
  exam?: Exam;
  class?: Class;
}

export default function ExamAssignment() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<ExamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [assignForm, setAssignForm] = useState({
    exam_id: '',
    school_id: '',
    class_id: '',
    due_date: ''
  });

  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (assignForm.school_id) {
      setFilteredClasses(classes.filter(c => c.school_id === assignForm.school_id));
      setAssignForm(prev => ({ ...prev, class_id: '' }));
    } else {
      setFilteredClasses([]);
    }
  }, [assignForm.school_id, classes]);

  const loadData = async () => {
    try {
      const [examsRes, schoolsRes, classesRes, assignmentsRes] = await Promise.all([
        supabase.from('exams').select('id, title, subject, status, total_marks, duration_minutes').eq('status', 'active').order('title'),
        supabase.from('schools').select('id, name, code').eq('status', 'active').order('name'),
        supabase.from('classes').select('*, school:schools(id, name, code)').eq('status', 'active').order('name'),
        supabase.from('exam_class_assignments').select('*, exam:exams(id, title, subject, status, total_marks, duration_minutes), class:classes(id, name, school_id, grade_level, school:schools(id, name, code))').order('assigned_at', { ascending: false })
      ]);

      if (examsRes.error) throw examsRes.error;
      if (schoolsRes.error) throw schoolsRes.error;
      if (classesRes.error) throw classesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      setExams(examsRes.data || []);
      setSchools(schoolsRes.data || []);
      setClasses(classesRes.data || []);
      setAssignments(assignmentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignForm.exam_id || !assignForm.class_id) {
      toast.error('Please select an exam and a class');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('exam_class_assignments')
        .insert({
          exam_id: assignForm.exam_id,
          class_id: assignForm.class_id,
          due_date: assignForm.due_date || null,
          is_active: true
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This exam is already assigned to this class');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Exam assigned successfully');
      setShowAssignDialog(false);
      
      // Automatically notify students via email & SMS (fire-and-forget)
      supabase.functions.invoke('notify-exam-assigned', {
        body: {
          exam_id: assignForm.exam_id,
          class_id: assignForm.class_id,
          due_date: assignForm.due_date || null,
        },
      }).then(({ data, error }) => {
        if (error) {
          console.error('Failed to send notifications:', error);
        } else {
          const emails = data?.emailsSent || 0;
          const smsStudents = data?.smsStudentsSent || 0;
          const smsParents = data?.smsParentsSent || 0;
          const parts = [];
          if (emails > 0) parts.push(`${emails} email${emails > 1 ? 's' : ''}`);
          if (smsStudents > 0) parts.push(`${smsStudents} student SMS`);
          if (smsParents > 0) parts.push(`${smsParents} parent SMS`);
          if (parts.length > 0) {
            toast.success(`Notifications sent: ${parts.join(', ')}`);
          }
        }
      });

      setAssignForm({ exam_id: '', school_id: '', class_id: '', due_date: '' });
      loadData();
    } catch (error: any) {
      console.error('Error assigning exam:', error);
      toast.error(error.message || 'Failed to assign exam');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignment: ExamAssignment) => {
    if (!confirm('Remove this exam assignment?')) return;

    try {
      const { error } = await supabase
        .from('exam_class_assignments')
        .delete()
        .eq('id', assignment.id);

      if (error) throw error;
      toast.success('Assignment removed');
      loadData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment');
    }
  };

  const filteredAssignments = assignments.filter(a => {
    const classData = a.class as any;
    const examData = a.exam as any;
    const schoolId = classData?.school_id;
    
    const matchesSchool = selectedSchoolFilter === 'all' || schoolId === selectedSchoolFilter;
    const matchesSearch = 
      examData?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classData?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classData?.school?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSchool && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Exam Assignments
          </CardTitle>
          <CardDescription>Assign exams to specific classes</CardDescription>
        </div>
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogTrigger asChild>
            <Button disabled={exams.length === 0 || classes.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Exam
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Exam to Class</DialogTitle>
              <DialogDescription>
                Select an exam and assign it to a specific class
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Select Exam *</Label>
                <Select
                  value={assignForm.exam_id}
                  onValueChange={(value) => setAssignForm(prev => ({ ...prev, exam_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an exam" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map(exam => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title} ({exam.subject || 'No subject'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select School *</Label>
                <Select
                  value={assignForm.school_id}
                  onValueChange={(value) => setAssignForm(prev => ({ ...prev, school_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(school => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name} ({school.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Class *</Label>
                <Select
                  value={assignForm.class_id}
                  onValueChange={(value) => setAssignForm(prev => ({ ...prev, class_id: value }))}
                  disabled={!assignForm.school_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={assignForm.school_id ? "Choose a class" : "Select a school first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.grade_level && `(${cls.grade_level})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={assignForm.due_date}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign Exam
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exams or classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by school" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map(school => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Assigned On</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map(assignment => {
              const examData = assignment.exam as any;
              const classData = assignment.class as any;
              
              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="font-medium">{examData?.title || 'Unknown Exam'}</div>
                    <div className="text-xs text-muted-foreground">{examData?.subject || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {classData?.school?.name || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      {classData?.name || '-'}
                      {classData?.grade_level && (
                        <Badge variant="outline" className="text-xs">{classData.grade_level}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {assignment.due_date 
                      ? format(new Date(assignment.due_date), 'MMM d, yyyy HH:mm')
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                      {assignment.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemoveAssignment(assignment)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAssignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {exams.length === 0 || classes.length === 0
                    ? 'Create exams and classes first before assigning.'
                    : 'No exam assignments yet. Click "Assign Exam" to get started.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
