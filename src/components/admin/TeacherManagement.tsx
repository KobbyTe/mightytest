import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, UserCheck, Loader2, BookOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  subject_specialty: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  school: { name: string } | null;
  school_id: string | null;
}

interface ClassAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject: string;
  assigned_at: string;
  class_info?: { name: string; school?: { name: string } };
}

interface SchoolItem { id: string; name: string; }
interface ClassItem { id: string; name: string; school_id: string; grade_level: string | null; }

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Assign classes state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignSchoolId, setAssignSchoolId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubject, setAssignSubject] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  useEffect(() => {
    loadTeachers();
    loadSchoolsAndClasses();
  }, []);

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, user_id, full_name, email, phone_number, subject_specialty, status, created_at, approved_at, school_id, school:schools(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeachers((data as any) || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const loadSchoolsAndClasses = async () => {
    const [schoolsRes, classesRes] = await Promise.all([
      supabase.from('schools').select('id, name').eq('status', 'active').order('name'),
      supabase.from('classes').select('id, name, school_id, grade_level').eq('status', 'active').order('name'),
    ]);
    setSchools(schoolsRes.data || []);
    setClasses(classesRes.data || []);
  };

  const loadAssignments = async (teacherId: string) => {
    const { data, error } = await supabase
      .from('teacher_class_assignments')
      .select('id, teacher_id, class_id, subject, assigned_at')
      .eq('teacher_id', teacherId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error loading assignments:', error);
      return;
    }

    // Enrich with class info
    const enriched: ClassAssignment[] = (data || []).map((a: any) => {
      const cls = classes.find(c => c.id === a.class_id);
      const school = cls ? schools.find(s => s.id === cls.school_id) : null;
      return {
        ...a,
        class_info: cls ? { name: cls.name, school: school ? { name: school.name } : undefined } : undefined,
      };
    });
    setAssignments(enriched);
  };

  const openAssignDialog = async (teacher: Teacher) => {
    setAssignTeacher(teacher);
    setAssignSchoolId(teacher.school_id || '');
    setAssignClassId('');
    setAssignSubject(teacher.subject_specialty || '');
    setAssignOpen(true);
    await loadAssignments(teacher.id);
  };

  const handleAddAssignment = async () => {
    if (!assignTeacher || !assignClassId || !assignSubject) {
      toast.error('Please select a class and enter a subject');
      return;
    }
    setAssignSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('teacher_class_assignments').insert({
        teacher_id: assignTeacher.id,
        class_id: assignClassId,
        subject: assignSubject,
        assigned_by: user?.id || null,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('This teacher is already assigned to this class for this subject');
        } else {
          throw error;
        }
        return;
      }
      toast.success('Class assignment added');
      await loadAssignments(assignTeacher.id);
      setAssignClassId('');
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      toast.error(error.message || 'Failed to add assignment');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!assignTeacher) return;
    try {
      const { error } = await supabase.from('teacher_class_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      toast.success('Assignment removed');
      await loadAssignments(assignTeacher.id);
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove assignment');
    }
  };

  const handleAction = async (teacherId: string, action: 'approved' | 'rejected') => {
    setActionLoading(teacherId);
    try {
      const { data, error } = await supabase.functions.invoke('approve-teacher', {
        body: { teacherId, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Teacher ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
      loadTeachers();
    } catch (error: any) {
      console.error('Action error:', error);
      toast.error(error.message || `Failed to ${action} teacher`);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = teachers.filter(t => t.status === 'pending');
  const approved = teachers.filter(t => t.status === 'approved');
  const rejected = teachers.filter(t => t.status === 'rejected');

  const filteredAssignClasses = classes.filter(c => c.school_id === assignSchoolId);

  const subjects = ['Science', 'Technology', 'Engineering', 'Mathematics', 'Robotics', 'AI'];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const TeacherTable = ({ items, showActions }: { items: Teacher[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>School</TableHead>
          <TableHead>Applied</TableHead>
          <TableHead>Classes</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 7 : 6} className="text-center text-muted-foreground py-8">
              No teachers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.full_name}</TableCell>
              <TableCell>{teacher.email}</TableCell>
              <TableCell>{teacher.subject_specialty || 'N/A'}</TableCell>
              <TableCell>{teacher.school?.name || 'N/A'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(teacher.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {teacher.status === 'approved' && (
                  <Button size="sm" variant="outline" onClick={() => openAssignDialog(teacher)}>
                    <BookOpen className="h-3.5 w-3.5 mr-1" />
                    Assign
                  </Button>
                )}
              </TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAction(teacher.id, 'approved')}
                      disabled={actionLoading === teacher.id}
                    >
                      {actionLoading === teacher.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(teacher.id, 'rejected')}
                      disabled={actionLoading === teacher.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Teacher Management
          </CardTitle>
          <CardDescription>Review and manage teacher/educator accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="h-4 w-4" />
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-1">
                <CheckCircle className="h-4 w-4" />
                Approved ({approved.length})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-1">
                <XCircle className="h-4 w-4" />
                Rejected ({rejected.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <TeacherTable items={pending} showActions />
            </TabsContent>
            <TabsContent value="approved">
              <TeacherTable items={approved} />
            </TabsContent>
            <TabsContent value="rejected">
              <TeacherTable items={rejected} showActions />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Assign Classes Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Classes — {assignTeacher?.full_name}</DialogTitle>
            <DialogDescription>
              Manage which classes and subjects this teacher can access
            </DialogDescription>
          </DialogHeader>

          {/* Current assignments */}
          {assignments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Assignments</Label>
              <div className="space-y-1">
                {assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                    <div className="text-sm">
                      <span className="font-medium">{a.class_info?.name || 'Unknown Class'}</span>
                      {a.class_info?.school && <span className="text-muted-foreground"> — {a.class_info.school.name}</span>}
                      <Badge variant="secondary" className="ml-2 text-xs">{a.subject}</Badge>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => handleRemoveAssignment(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new assignment */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">Add Assignment</Label>
            <div className="space-y-2">
              <Select value={assignSchoolId} onValueChange={(v) => { setAssignSchoolId(v); setAssignClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={assignClassId} onValueChange={setAssignClassId} disabled={!assignSchoolId}>
                <SelectTrigger><SelectValue placeholder={assignSchoolId ? "Select class" : "Select school first"} /></SelectTrigger>
                <SelectContent>
                  {filteredAssignClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.grade_level && `(${c.grade_level})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddAssignment} disabled={assignSaving || !assignClassId || !assignSubject} className="w-full">
              {assignSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
