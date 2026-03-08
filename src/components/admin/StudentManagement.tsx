import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ArrowRightLeft, Trash2, Users, Eye, AlertTriangle, UserPlus, Download, CheckSquare } from 'lucide-react';
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

interface School { id: string; name: string; }
interface ClassItem { id: string; name: string; school_id: string; grade_level: string | null; }

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Change class dialog (single & bulk)
  const [changeClassOpen, setChangeClassOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [saving, setSaving] = useState(false);
  const [isBulkClassAssign, setIsBulkClassAssign] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  // View details dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);

  // Link parent dialog
  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [linkParentStudent, setLinkParentStudent] = useState<Student | null>(null);
  const [parentForm, setParentForm] = useState({ name: '', email: '', phone: '', relationship: '' });
  const [linkingParent, setLinkingParent] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [studentsRes, schoolsRes, classesRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, email, student_id_code, grade, school_id, class_id, user_id, date_of_birth, gender, phone_number, parent_id, school:schools(id, name), class:classes(id, name), parent:parents(full_name, phone_number, relationship_to_student)')
          .order('full_name')
          .limit(1000),
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

  // Selection helpers
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

  const selectedStudents = students.filter(s => selectedIds.has(s.id));

  // Single class change
  const openChangeClass = (student: Student) => {
    setSelectedStudent(student);
    setSelectedSchoolId(student.school_id || '');
    setSelectedClassId(student.class_id || '');
    setIsBulkClassAssign(false);
    setChangeClassOpen(true);
  };

  // Bulk class change
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

  // Delete (single & bulk)
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

  // Bulk grade export
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
        return [
          s?.full_name || 'Unknown',
          s?.student_id_code || 'N/A',
          s?.email || 'N/A',
          a.exams?.title || 'Unknown',
          a.exams?.subject || 'N/A',
          a.marks_obtained ?? 'N/A',
          a.exams?.total_marks || 'N/A',
          pct,
          passed,
        ];
      });

      const csv = [
        `Bulk Grade Export - ${new Date().toLocaleDateString()}`,
        '',
        headers.join(','),
        ...rows.map(r => r.map(c => `"${c}"`).join(','))
      ].join('\n');

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

  // Link parent
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
    return <div className="flex items-center justify-center py-12"><div className="animate-pulse text-lg">Loading students...</div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Students Missing Parent Accounts */}
      {studentsWithoutParent.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Students Missing Parent Accounts ({studentsWithoutParent.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">These students don't have a linked parent account.</p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsWithoutParent.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>{student.student_id_code ? <Badge variant="outline" className="font-mono text-xs">{student.student_id_code}</Badge> : '—'}</TableCell>
                      <TableCell>{student.school?.name || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openLinkParent(student)}>
                          <UserPlus className="h-4 w-4 mr-1" /> Link Parent
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Management ({students.length} students)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search, Filter, and Bulk Actions */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={schoolFilter} onValueChange={setSchoolFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
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

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="flex-1" />
                <Button size="sm" variant="outline" onClick={openBulkClassAssign}>
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Assign Class
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkGradeExport}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export Grades
                </Button>
                <Button size="sm" variant="destructive" onClick={openBulkDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
            )}
          </div>

          {/* Students Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {search || schoolFilter !== 'all' ? 'No students match your search' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id} className={selectedIds.has(student.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => toggleSelect(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {student.full_name}
                          {!student.parent_id && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">No Parent</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.student_id_code ? <Badge variant="outline" className="font-mono text-xs">{student.student_id_code}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.email}</TableCell>
                      <TableCell>{student.school ? <Badge variant="outline">{student.school.name}</Badge> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                      <TableCell>{student.class ? <Badge variant="secondary">{student.class.name}</Badge> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                      <TableCell>{student.grade || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setViewStudent(student); setViewOpen(true); }} title="View Details">
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          {!student.parent_id && (
                            <Button variant="ghost" size="sm" onClick={() => openLinkParent(student)} className="text-yellow-600 hover:text-yellow-700">
                              <UserPlus className="h-4 w-4 mr-1" /> Parent
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openChangeClass(student)} title="Change Class">
                            <ArrowRightLeft className="h-4 w-4 mr-1" /> Class
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(student)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Change Class Dialog (single & bulk) */}
      <Dialog open={changeClassOpen} onOpenChange={setChangeClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBulkClassAssign ? `Assign Class to ${selectedIds.size} Students` : `Change Class for ${selectedStudent?.full_name}`}</DialogTitle>
            <DialogDescription>
              {isBulkClassAssign ? 'All selected students will be moved to the chosen class.' : 'Select the correct school and class for this student.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!isBulkClassAssign && selectedStudent && (
              <div>
                <Label>Current Class</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedStudent.school?.name || 'No school'} → {selectedStudent.class?.name || 'No class'}
                </p>
              </div>
            )}
            <div>
              <Label>School</Label>
              <Select value={selectedSchoolId} onValueChange={(v) => { setSelectedSchoolId(v); setSelectedClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map((school) => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder={selectedSchoolId ? 'Select class' : 'Select a school first'} /></SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((cls) => <SelectItem key={cls.id} value={cls.id}>{cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleChangeClass} disabled={saving || !selectedClassId} className="w-full">
              {saving ? 'Saving...' : isBulkClassAssign ? `Assign ${selectedIds.size} Students` : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (single & bulk) */}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>{viewStudent?.full_name}</DialogDescription>
          </DialogHeader>
          {viewStudent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Student Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Student ID</span>
                  <span className="font-mono">{viewStudent.student_id_code || '—'}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{viewStudent.email}</span>
                  <span className="text-muted-foreground">Date of Birth</span>
                  <span>{viewStudent.date_of_birth ? new Date(viewStudent.date_of_birth).toLocaleDateString() : '—'}</span>
                  <span className="text-muted-foreground">Gender</span>
                  <span className="capitalize">{viewStudent.gender || '—'}</span>
                  <span className="text-muted-foreground">Phone</span>
                  <span>{viewStudent.phone_number || '—'}</span>
                  <span className="text-muted-foreground">Grade</span>
                  <span>{viewStudent.grade || '—'}</span>
                  <span className="text-muted-foreground">School</span>
                  <span>{viewStudent.school?.name || '—'}</span>
                  <span className="text-muted-foreground">Class</span>
                  <span>{viewStudent.class?.name || '—'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Parent / Guardian</h4>
                {viewStudent.parent ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span>{viewStudent.parent.full_name}</span>
                    <span className="text-muted-foreground">Phone</span>
                    <span>{viewStudent.parent.phone_number || '—'}</span>
                    <span className="text-muted-foreground">Relationship</span>
                    <span className="capitalize">{viewStudent.parent.relationship_to_student || '—'}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> No parent linked
                    </p>
                    <Button size="sm" variant="outline" onClick={() => { setViewOpen(false); openLinkParent(viewStudent); }}>
                      <UserPlus className="h-4 w-4 mr-1" /> Create Parent Account
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Parent Dialog */}
      <Dialog open={linkParentOpen} onOpenChange={setLinkParentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
            <DialogDescription>
              Create and link a parent account for <strong>{linkParentStudent?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Parent Full Name *</Label>
              <Input value={parentForm.name} onChange={(e) => setParentForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John Doe" />
            </div>
            <div>
              <Label>Parent Email *</Label>
              <Input type="email" value={parentForm.email} onChange={(e) => setParentForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. parent@example.com" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input value={parentForm.phone} onChange={(e) => setParentForm(p => ({ ...p, phone: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Relationship</Label>
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
            <Button onClick={handleLinkParent} disabled={linkingParent || !parentForm.name || !parentForm.email} className="w-full">
              {linkingParent ? 'Creating...' : 'Create & Link Parent Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
