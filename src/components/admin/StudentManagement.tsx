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
import { Search, ArrowRightLeft, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  full_name: string;
  email: string;
  grade: string | null;
  school_id: string | null;
  class_id: string | null;
  user_id: string;
  school: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
}

interface School {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
  school_id: string;
  grade_level: string | null;
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');

  // Change class dialog
  const [changeClassOpen, setChangeClassOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, schoolsRes, classesRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, full_name, email, grade, school_id, class_id, user_id, school:schools(id, name), class:classes(id, name)')
          .order('full_name')
          .limit(1000),
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('classes').select('id, name, school_id, grade_level').order('name'),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (schoolsRes.error) throw schoolsRes.error;
      if (classesRes.error) throw classesRes.error;

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
    const matchesSearch =
      !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchesSchool = schoolFilter === 'all' || s.school_id === schoolFilter;
    return matchesSearch && matchesSchool;
  });

  const openChangeClass = (student: Student) => {
    setSelectedStudent(student);
    setSelectedSchoolId(student.school_id || '');
    setSelectedClassId(student.class_id || '');
    setChangeClassOpen(true);
  };

  const handleChangeClass = async () => {
    if (!selectedStudent || !selectedClassId || !selectedSchoolId) {
      toast.error('Please select both a school and class');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: selectedClassId, school_id: selectedSchoolId })
        .eq('id', selectedStudent.id);

      if (error) throw error;
      toast.success(`${selectedStudent.full_name}'s class updated successfully`);
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
    setDeleteOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-student', {
        body: { student_id: studentToDelete.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${studentToDelete.full_name} has been deleted`);
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

  const filteredClasses = classes.filter((c) => c.school_id === selectedSchoolId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-lg">Loading students...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Management ({students.length} students)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={schoolFilter} onValueChange={setSchoolFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Students Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {search || schoolFilter !== 'all' ? 'No students match your search' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{student.email}</TableCell>
                      <TableCell>
                        {student.school ? (
                          <Badge variant="outline">{student.school.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.class ? (
                          <Badge variant="secondary">{student.class.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{student.grade || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openChangeClass(student)}
                            title="Change Class"
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Class
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(student)}
                            title="Delete Student"
                            className="text-destructive hover:text-destructive"
                          >
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

      {/* Change Class Dialog */}
      <Dialog open={changeClassOpen} onOpenChange={setChangeClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Class for {selectedStudent?.full_name}</DialogTitle>
            <DialogDescription>
              Select the correct school and class for this student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Current Class</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedStudent?.school?.name || 'No school'} → {selectedStudent?.class?.name || 'No class'}
              </p>
            </div>
            <div>
              <Label>School</Label>
              <Select
                value={selectedSchoolId}
                onValueChange={(v) => {
                  setSelectedSchoolId(v);
                  setSelectedClassId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedSchoolId ? 'Select class' : 'Select a school first'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleChangeClass} disabled={saving || !selectedClassId} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{studentToDelete?.full_name}</strong> ({studentToDelete?.email})?
              This will permanently remove their account and all associated data including exam attempts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Student'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
