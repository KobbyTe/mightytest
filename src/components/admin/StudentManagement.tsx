import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowRightLeft, Trash2, Users, Eye, AlertTriangle, UserPlus, Download, CheckSquare, Mail, Phone, Calendar, GraduationCap, School, BookOpen, User, Heart, MoreHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Student {
  id: string;
  full_name: string;
  email: string;
  student_id_code: string | null;
  grade: string | null;
  school_id: string | null;
  class_id: string | null;
  user_id: string;
  date_of_birth: string;
  gender: string | null;
  phone_number: string | null;
  parent_id: string | null;
  school: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  parent: { full_name: string; phone_number: string | null; relationship_to_student: string | null } | null;
}

interface SchoolItem { id: string; name: string; }
interface ClassItem { id: string; name: string; school_id: string; grade_level: string | null; }

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const AVATAR_COLORS = [
  'from-[hsl(var(--primary))] to-[hsl(var(--secondary))]',
  'from-[hsl(var(--accent))] to-[hsl(var(--purple))]',
  'from-[hsl(var(--success))] to-[hsl(var(--accent))]',
  'from-[hsl(var(--secondary))] to-[hsl(var(--destructive))]',
  'from-[hsl(var(--purple))] to-[hsl(var(--primary))]',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const { scopedClassIds, loading: scopeLoading } = useTeacherScope();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [changeClassOpen, setChangeClassOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [isBulkClassAssign, setIsBulkClassAssign] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);

  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [linkParentStudent, setLinkParentStudent] = useState<Student | null>(null);
  const [parentForm, setParentForm] = useState({ name: '', email: '', phone: '', relationship: '' });
  const [linkingParent, setLinkingParent] = useState(false);
  const [showMissingParents, setShowMissingParents] = useState(false);

  useEffect(() => { if (!scopeLoading) loadData(); }, [scopeLoading]);

  const loadData = async () => {
    try {
      let studentsQuery = supabase
        .from('students')
        .select('id, full_name, email, student_id_code, grade, school_id, class_id, user_id, date_of_birth, gender, phone_number, parent_id, school:schools(id, name), class:classes(id, name), parent:parents(full_name, phone_number, relationship_to_student)')
        .order('full_name')
        .limit(1000);

      if (scopedClassIds !== null) {
        if (scopedClassIds.length > 0) {
          studentsQuery = studentsQuery.in('class_id', scopedClassIds);
        } else {
          studentsQuery = studentsQuery.eq('class_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      const [studentsRes, schoolsRes, classesRes] = await Promise.all([
        studentsQuery,
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('classes').select('id, name, school_id, grade_level').order('name'),
      ]);
      if (studentsRes.error) throw studentsRes.error;
      setStudents((studentsRes.data as any) || []);
      setSchools(schoolsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
    const matchesSchool = schoolFilter === 'all' || s.school_id === schoolFilter;
    return matchesSearch && matchesSchool;
  });

  const studentsWithoutParent = students.filter(s => !s.parent_id);
  const filteredClasses = classes.filter((c) => c.school_id === selectedSchoolId);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const openChangeClass = (student: Student) => {
    setSelectedStudent(student);
    setSelectedSchoolId(student.school_id || '');
    setSelectedClassId(student.class_id || '');
    setIsBulkClassAssign(false);
    setChangeClassOpen(true);
  };

  const openBulkClassAssign = () => {
    setSelectedStudent(null);
    setSelectedSchoolId('');
    setSelectedClassId('');
    setIsBulkClassAssign(true);
    setChangeClassOpen(true);
  };

  const handleChangeClass = async () => {
    if (!selectedClassId || !selectedSchoolId) {
      toast.error('Please select both a school and class');
      return;
    }
    setSaving(true);
    try {
      if (isBulkClassAssign) {
        const ids = Array.from(selectedIds);
        const { error } = await supabase
          .from('students')
          .update({ class_id: selectedClassId, school_id: selectedSchoolId })
          .in('id', ids);
        if (error) throw error;
        toast.success(`${ids.length} students reassigned successfully`);
        setSelectedIds(new Set());
      } else if (selectedStudent) {
        const { error } = await supabase
          .from('students')
          .update({ class_id: selectedClassId, school_id: selectedSchoolId })
          .eq('id', selectedStudent.id);
        if (error) throw error;
        toast.success(`${selectedStudent.full_name}'s class updated successfully`);
      }
      setChangeClassOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating class:', error);
      toast.error('Failed to update student class');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (student: Student) => {
    setStudentToDelete(student);
    setIsBulkDelete(false);
    setDeleteOpen(true);
  };

  const openBulkDelete = () => {
    setStudentToDelete(null);
    setIsBulkDelete(true);
    setDeleteOpen(true);
  };

  const handleDeleteStudent = async () => {
    setDeleting(true);
    try {
      if (isBulkDelete) {
        const ids = Array.from(selectedIds);
        let successCount = 0;
        for (const id of ids) {
          const { error } = await supabase.functions.invoke('delete-student', { body: { student_id: id } });
          if (!error) successCount++;
        }
        toast.success(`${successCount} of ${ids.length} students deleted`);
        setSelectedIds(new Set());
      } else if (studentToDelete) {
        const { data, error } = await supabase.functions.invoke('delete-student', { body: { student_id: studentToDelete.id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success(`${studentToDelete.full_name} has been deleted`);
      }
      setDeleteOpen(false);
      setStudentToDelete(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast.error(error.message || 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkGradeExport = async () => {
    try {
      const ids = Array.from(selectedIds);
      const { data: attempts, error } = await supabase
        .from('exam_attempts')
        .select('student_id, status, marks_obtained, exams(title, subject, total_marks, passing_marks)')
        .in('student_id', ids)
        .in('status', ['graded', 'completed'])
        .order('student_id');

      if (error) throw error;

      const studentMap = new Map(students.map(s => [s.id, s]));
      const headers = ['Student Name', 'Student ID', 'Email', 'Exam', 'Subject', 'Score', 'Total', 'Percentage', 'Status'];
      const rows = (attempts || []).map((a: any) => {
        const s = studentMap.get(a.student_id);
        const pct = a.marks_obtained !== null && a.exams?.total_marks ? ((a.marks_obtained / a.exams.total_marks) * 100).toFixed(1) : 'N/A';
        const passed = a.marks_obtained !== null && a.exams?.passing_marks ? (a.marks_obtained >= a.exams.passing_marks ? 'Passed' : 'Failed') : 'N/A';
        return [s?.full_name || 'Unknown', s?.student_id_code || 'N/A', s?.email || 'N/A', a.exams?.title || 'Unknown', a.exams?.subject || 'N/A', a.marks_obtained ?? 'N/A', a.exams?.total_marks || 'N/A', pct, passed];
      });

      const csv = [`Bulk Grade Export - ${new Date().toLocaleDateString()}`, '', headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `grade-export-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`Exported grades for ${ids.length} students`);
    } catch (error) {
      console.error('Error exporting grades:', error);
      toast.error('Failed to export grades');
    }
  };

  const openLinkParent = (student: Student) => {
    setLinkParentStudent(student);
    setParentForm({ name: '', email: '', phone: '', relationship: '' });
    setLinkParentOpen(true);
  };

  const handleLinkParent = async () => {
    if (!linkParentStudent || !parentForm.name || !parentForm.email) {
      toast.error('Parent name and email are required');
      return;
    }
    setLinkingParent(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-parent-account', {
        body: {
          studentId: linkParentStudent.id,
          parentName: parentForm.name,
          parentEmail: parentForm.email,
          parentPhone: parentForm.phone || null,
          parentRelationship: parentForm.relationship || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.credentials) {
        toast.success(`Parent account created! Password: ${data.credentials.password}`, { duration: 10000 });
      } else {
        toast.success(`Linked existing parent account to ${linkParentStudent.full_name}`);
      }
      setLinkParentOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating parent account:', error);
      toast.error(error.message || 'Failed to create parent account');
    } finally {
      setLinkingParent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading students…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Missing Parent Alert */}
      {studentsWithoutParent.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[hsl(var(--secondary))]/30 bg-[hsl(var(--secondary))]/5 backdrop-blur-sm p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))]/15">
              <AlertTriangle className="h-4.5 w-4.5 text-[hsl(var(--secondary))]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-foreground">
                {studentsWithoutParent.length} student{studentsWithoutParent.length !== 1 ? 's' : ''} missing parent accounts
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">Link parent accounts for full platform access and communication.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-[hsl(var(--secondary))] hover:text-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/10 rounded-lg"
              onClick={() => {
                setSearch('');
                setSchoolFilter('all');
                setShowMissingParents(prev => !prev);
              }}
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-xs font-semibold">Link Parents</span>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Main Card */}
      <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--secondary))] shadow-md">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">Student Management</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredStudents.length} of {students.length} students
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-muted/50 border-border/60 focus:bg-card transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-10 bg-muted/50 border-border/60">
                <SelectValue placeholder="Filter by school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mx-6 mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(var(--primary))]/8 border border-[hsl(var(--primary))]/20">
                <CheckSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
                <span className="text-sm font-semibold text-foreground">{selectedIds.size} selected</span>
                <div className="flex-1" />
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={openBulkClassAssign} className="h-8 text-xs gap-1.5 rounded-lg">
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Assign Class
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkGradeExport} className="h-8 text-xs gap-1.5 rounded-lg">
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                  <Button size="sm" variant="destructive" onClick={openBulkDelete} className="h-8 text-xs gap-1.5 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-8 text-xs rounded-lg text-muted-foreground">
                    Clear
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-t">
                  <TableHead className="w-12 pl-6">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Student</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">School</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Class</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Grade</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground font-medium">
                          {search || schoolFilter !== 'all' ? 'No students match your filters' : 'No students found'}
                        </p>
                        {(search || schoolFilter !== 'all') && (
                          <Button variant="link" size="sm" onClick={() => { setSearch(''); setSchoolFilter('all'); }} className="text-xs">
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student, index) => (
                    <motion.tr
                      key={student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.015, 0.3) }}
                      className={`border-b transition-colors group cursor-pointer ${
                        selectedIds.has(student.id)
                          ? 'bg-[hsl(var(--primary))]/5'
                          : 'hover:bg-muted/30'
                      }`}
                      onClick={() => { setViewStudent(student); setViewOpen(true); }}
                    >
                      <td className="p-4 pl-6" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => toggleSelect(student.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0 shadow-sm">
                            <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(student.full_name)} text-white text-xs font-bold`}>
                              {getInitials(student.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{student.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {student.school ? (
                          <span className="text-sm text-foreground">{student.school.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {student.class ? (
                          <Badge variant="secondary" className="font-medium text-xs rounded-md">
                            {student.class.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {student.grade ? (
                          <Badge variant="outline" className="font-medium text-xs rounded-md">
                            {student.grade}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {!student.parent_id ? (
                          <Badge variant="destructive" className="text-[10px] font-medium rounded-md gap-1">
                            <AlertTriangle className="h-3 w-3" /> No Parent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-medium rounded-md bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/30">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 pr-6" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => { setViewStudent(student); setViewOpen(true); }}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openChangeClass(student)}>
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Change Class
                            </DropdownMenuItem>
                            {!student.parent_id && (
                              <DropdownMenuItem onClick={() => openLinkParent(student)}>
                                <UserPlus className="h-3.5 w-3.5 mr-2" /> Link Parent
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDeleteDialog(student)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          {filteredStudents.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {filteredStudents.length} of {students.length} students
              </p>
              {selectedIds.size > 0 && (
                <p className="text-xs font-medium text-[hsl(var(--primary))]">
                  {selectedIds.size} selected
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Class Dialog */}
      <Dialog open={changeClassOpen} onOpenChange={setChangeClassOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isBulkClassAssign ? `Assign Class to ${selectedIds.size} Students` : `Change Class for ${selectedStudent?.full_name}`}</DialogTitle>
            <DialogDescription>
              {isBulkClassAssign ? 'All selected students will be moved to the chosen class.' : 'Select the correct school and class for this student.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!isBulkClassAssign && selectedStudent && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Current placement</p>
                <p className="text-sm font-medium mt-0.5">
                  {selectedStudent.school?.name || 'No school'} → {selectedStudent.class?.name || 'No class'}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-medium">School</Label>
              <Select value={selectedSchoolId} onValueChange={(v) => { setSelectedSchoolId(v); setSelectedClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder={selectedSchoolId ? 'Select class' : 'Select a school first'} /></SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((cls) => <SelectItem key={cls.id} value={cls.id}>{cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleChangeClass} disabled={saving || !selectedClassId} className="w-full h-10">
              {saving ? 'Saving...' : isBulkClassAssign ? `Assign ${selectedIds.size} Students` : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isBulkDelete ? `Delete ${selectedIds.size} Students` : 'Delete Student'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isBulkDelete
                ? `Are you sure you want to delete ${selectedIds.size} selected students? This will permanently remove their accounts and all associated data.`
                : <>Are you sure you want to delete <strong>{studentToDelete?.full_name}</strong>? This will permanently remove their account and all associated data.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStudent} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : isBulkDelete ? `Delete ${selectedIds.size} Students` : 'Delete Student'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Student Details */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
          <AnimatePresence>
            {viewStudent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="bg-card rounded-2xl overflow-y-auto max-h-[85vh]"
              >
                {/* Hero Banner */}
                <div className="relative bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary-light))] to-[hsl(var(--accent))] h-28">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                  <motion.div
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.35 }}
                    className="absolute -bottom-10 left-6"
                  >
                    <Avatar className="h-20 w-20 border-4 border-card shadow-xl">
                      <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(viewStudent.full_name)} text-white text-xl font-bold`}>
                        {getInitials(viewStudent.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <DialogHeader className="sr-only">
                    <DialogTitle>Student Details</DialogTitle>
                    <DialogDescription>{viewStudent.full_name}</DialogDescription>
                  </DialogHeader>
                </div>

                {/* Name Section */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                  className="pt-14 px-6 pb-2"
                >
                  <h2 className="text-xl font-bold text-foreground">{viewStudent.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {viewStudent.student_id_code && (
                      <Badge variant="secondary" className="font-mono text-xs rounded-md">{viewStudent.student_id_code}</Badge>
                    )}
                    {viewStudent.grade && (
                      <Badge variant="outline" className="text-xs rounded-md">{viewStudent.grade}</Badge>
                    )}
                  </div>
                </motion.div>

                {/* Info Cards */}
                <div className="px-6 pb-5 pt-3 space-y-3">
                  {/* Personal Details */}
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.35 }}
                    className="rounded-xl border bg-muted/30 p-4 space-y-3"
                  >
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h4>
                    <div className="grid gap-2.5">
                      {viewStudent.email && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                            <Mail className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-muted-foreground">Email</p>
                            <p className="text-sm font-medium text-foreground truncate">{viewStudent.email}</p>
                          </div>
                        </div>
                      )}
                      {viewStudent.phone_number && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                            <Phone className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium text-foreground">{viewStudent.phone_number}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                          <Calendar className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Date of Birth</p>
                          <p className="text-sm font-medium text-foreground">
                            {viewStudent.date_of_birth ? new Date(viewStudent.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                          </p>
                        </div>
                      </div>
                      {viewStudent.gender && (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10">
                            <User className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted-foreground">Gender</p>
                            <p className="text-sm font-medium text-foreground capitalize">{viewStudent.gender}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Academic Details */}
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.35 }}
                    className="rounded-xl border bg-muted/30 p-4 space-y-3"
                  >
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Academic Info</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent))]/15">
                          <School className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted-foreground">School</p>
                          <p className="text-sm font-medium text-foreground truncate">{viewStudent.school?.name || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent))]/15">
                          <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Class</p>
                          <p className="text-sm font-medium text-foreground">{viewStudent.class?.name || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent))]/15">
                          <GraduationCap className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Grade</p>
                          <p className="text-sm font-medium text-foreground">{viewStudent.grade || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Parent / Guardian */}
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.35 }}
                    className="rounded-xl border bg-muted/30 p-4 space-y-3"
                  >
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parent / Guardian</h4>
                    {viewStudent.parent ? (
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 mt-0.5">
                          <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--primary))] text-white text-sm font-semibold">
                            {getInitials(viewStudent.parent.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">{viewStudent.parent.full_name}</p>
                          {viewStudent.parent.relationship_to_student && (
                            <Badge variant="outline" className="text-xs capitalize rounded-md">{viewStudent.parent.relationship_to_student}</Badge>
                          )}
                          {viewStudent.parent.phone_number && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" /> {viewStudent.parent.phone_number}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-destructive" /> No parent linked
                        </p>
                        <Button size="sm" variant="outline" onClick={() => { setViewOpen(false); openLinkParent(viewStudent); }} className="gap-1.5 rounded-lg">
                          <UserPlus className="h-4 w-4" /> Create Parent Account
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Link Parent Dialog */}
      <Dialog open={linkParentOpen} onOpenChange={setLinkParentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
            <DialogDescription>
              Create and link a parent account for <strong>{linkParentStudent?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Parent Full Name *</Label>
              <Input value={parentForm.name} onChange={(e) => setParentForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Parent Email *</Label>
              <Input type="email" value={parentForm.email} onChange={(e) => setParentForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. parent@example.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Phone Number</Label>
              <Input value={parentForm.phone} onChange={(e) => setParentForm(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Relationship</Label>
              <Select value={parentForm.relationship} onValueChange={(v) => setParentForm(p => ({ ...p, relationship: v }))}>
                <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">Father</SelectItem>
                  <SelectItem value="mother">Mother</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleLinkParent} disabled={linkingParent || !parentForm.name || !parentForm.email} className="w-full h-10">
              {linkingParent ? 'Creating...' : 'Create & Link Parent Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
