import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, UserCheck, Loader2, BookOpen, Plus, Trash2, Mail, Phone, GraduationCap, Building2, CalendarDays, Sparkles, Eye, Shield, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

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

const subjectColorMap: Record<string, string> = {
  Science: 'bg-stem-science/15 text-stem-science border-stem-science/30',
  Technology: 'bg-stem-technology/15 text-stem-technology border-stem-technology/30',
  Engineering: 'bg-stem-engineering/15 text-stem-engineering border-stem-engineering/30',
  Mathematics: 'bg-stem-mathematics/15 text-stem-mathematics border-stem-mathematics/30',
  Robotics: 'bg-stem-robotics/15 text-stem-robotics border-stem-robotics/30',
  AI: 'bg-stem-ai/15 text-stem-ai border-stem-ai/30',
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignSchoolId, setAssignSchoolId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubject, setAssignSubject] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Profile dialog state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTeacher, setProfileTeacher] = useState<Teacher | null>(null);
  const [profileAssignments, setProfileAssignments] = useState<ClassAssignment[]>([]);

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
    if (error) { console.error('Error loading assignments:', error); return; }
    const enriched: ClassAssignment[] = (data || []).map((a: any) => {
      const cls = classes.find(c => c.id === a.class_id);
      const school = cls ? schools.find(s => s.id === cls.school_id) : null;
      return { ...a, class_info: cls ? { name: cls.name, school: school ? { name: school.name } : undefined } : undefined };
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

  const openProfileDialog = async (teacher: Teacher) => {
    setProfileTeacher(teacher);
    setProfileOpen(true);
    // Load assignments for this teacher
    const { data } = await supabase
      .from('teacher_class_assignments')
      .select('id, teacher_id, class_id, subject, assigned_at')
      .eq('teacher_id', teacher.id)
      .order('assigned_at', { ascending: false });
    const enriched: ClassAssignment[] = (data || []).map((a: any) => {
      const cls = classes.find(c => c.id === a.class_id);
      const school = cls ? schools.find(s => s.id === cls.school_id) : null;
      return { ...a, class_info: cls ? { name: cls.name, school: school ? { name: school.name } : undefined } : undefined };
    });
    setProfileAssignments(enriched);
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
        if (error.code === '23505') { toast.error('Already assigned to this class for this subject'); } else { throw error; }
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
      const { data, error } = await supabase.functions.invoke('approve-teacher', { body: { teacherId, action } });
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
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <Sparkles className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading teachers…</p>
      </div>
    );
  }

  const TeacherCard = ({ teacher, index, showActions }: { teacher: Teacher; index: number; showActions?: boolean }) => {
    const initials = teacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const subjectClass = teacher.subject_specialty ? subjectColorMap[teacher.subject_specialty] || 'bg-muted text-muted-foreground' : '';

    return (
      <motion.div
        custom={index}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <Card className="group relative overflow-hidden border border-border/60 hover:border-primary/40 transition-all duration-300 hover:shadow-[var(--shadow-card)] hover:-translate-y-1">
          {/* Subtle gradient accent at top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-purple opacity-60 group-hover:opacity-100 transition-opacity" />

          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-sm font-bold text-foreground border border-border/50">
                  {initials}
                </div>
                <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card ${
                  teacher.status === 'approved' ? 'bg-success' : teacher.status === 'pending' ? 'bg-primary' : 'bg-destructive'
                }`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">{teacher.full_name}</h3>
                  {teacher.subject_specialty && (
                    <Badge variant="outline" className={`text-[10px] font-medium border ${subjectClass} shrink-0`}>
                      {teacher.subject_specialty}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{teacher.email}</span>
                  </div>
                  {teacher.phone_number && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{teacher.phone_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {teacher.school?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {teacher.school.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(teacher.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openProfileDialog(teacher)}
                className="text-xs gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              >
                <Eye className="h-3.5 w-3.5" />
                View Profile
              </Button>
              {teacher.status === 'approved' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAssignDialog(teacher)}
                  className="text-xs gap-1.5 hover:bg-accent/10 hover:text-accent hover:border-accent/40"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Assign Classes
                </Button>
              )}
              {showActions && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleAction(teacher.id, 'approved')}
                    disabled={actionLoading === teacher.id}
                    className="text-xs gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                  >
                    {actionLoading === teacher.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(teacher.id, 'rejected')}
                    disabled={actionLoading === teacher.id}
                    className="text-xs gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const TeacherGrid = ({ items, showActions }: { items: Teacher[]; showActions?: boolean }) => (
    <AnimatePresence mode="wait">
      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-3"
        >
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">No teachers found in this category</p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {items.map((teacher, i) => (
            <TeacherCard key={teacher.id} teacher={teacher} index={i} showActions={showActions} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-border/50 shadow-[var(--shadow-card)] overflow-hidden">
          {/* Header with gradient */}
          <CardHeader className="relative pb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-purple/5" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                  <UserCheck className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Teacher Management</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Review, approve, and manage educator accounts</p>
                </div>
              </div>
              {/* Summary badges */}
              <div className="hidden sm:flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs font-normal border-primary/30 bg-primary/5 text-foreground">
                  <span className="font-bold text-primary">{teachers.length}</span> Total
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs font-normal border-success/30 bg-success/5 text-foreground">
                  <span className="font-bold text-success">{approved.length}</span> Active
                </Badge>
                {pending.length > 0 && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal border-primary/30 bg-primary/10 text-foreground animate-pulse-scale">
                    <span className="font-bold text-primary">{pending.length}</span> Pending
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <Tabs defaultValue="pending">
              <TabsList className="w-full grid grid-cols-3 h-11 bg-muted/50 p-1">
                <TabsTrigger value="pending" className="gap-1.5 text-xs font-medium data-[state=active]:shadow-md">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pending</span>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold px-1.5">
                    {pending.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="approved" className="gap-1.5 text-xs font-medium data-[state=active]:shadow-md">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Approved</span>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-success/15 text-success text-[10px] font-bold px-1.5">
                    {approved.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-1.5 text-xs font-medium data-[state=active]:shadow-md">
                  <XCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Rejected</span>
                  <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold px-1.5">
                    {rejected.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="pending" className="mt-0">
                  <TeacherGrid items={pending} showActions />
                </TabsContent>
                <TabsContent value="approved" className="mt-0">
                  <TeacherGrid items={approved} />
                </TabsContent>
                <TabsContent value="rejected" className="mt-0">
                  <TeacherGrid items={rejected} showActions />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Assign Classes Dialog — modernized */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-purple flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg">Assign Classes</DialogTitle>
                <DialogDescription className="text-xs">
                  {assignTeacher?.full_name} — Manage class & subject access
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Current assignments */}
          <AnimatePresence>
            {assignments.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Assignments</Label>
                <div className="space-y-2">
                  {assignments.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {a.class_info?.name || 'Unknown Class'}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] border ${subjectColorMap[a.subject] || 'bg-muted'}`}>
                              {a.subject}
                            </Badge>
                            {a.class_info?.school && (
                              <span className="text-[10px] text-muted-foreground">{a.class_info.school.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveAssignment(a.id)}
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add new assignment */}
          <div className="space-y-3 pt-3 border-t border-border/50">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New Assignment</Label>
            <div className="space-y-2.5">
              <Select value={assignSchoolId} onValueChange={(v) => { setAssignSchoolId(v); setAssignClassId(''); }}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={assignClassId} onValueChange={setAssignClassId} disabled={!assignSchoolId}>
                <SelectTrigger className="h-10"><SelectValue placeholder={assignSchoolId ? "Select class" : "Select school first"} /></SelectTrigger>
                <SelectContent>
                  {filteredAssignClasses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.grade_level && `(${c.grade_level})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddAssignment}
              disabled={assignSaving || !assignClassId || !assignSubject}
              className="w-full gap-2"
            >
              {assignSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {profileTeacher && (() => {
            const initials = profileTeacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const statusConfig = {
              approved: { label: 'Approved', cls: 'bg-success/15 text-success border-success/30' },
              pending: { label: 'Pending', cls: 'bg-primary/15 text-primary border-primary/30' },
              rejected: { label: 'Rejected', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
            }[profileTeacher.status] || { label: profileTeacher.status, cls: 'bg-muted text-muted-foreground' };

            return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="flex flex-col items-center text-center pb-5 border-b border-border/50">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center text-2xl font-bold text-foreground border-2 border-border/50 shadow-lg mb-3">
                    {initials}
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{profileTeacher.full_name}</h2>
                  <Badge variant="outline" className={`mt-2 text-xs border ${statusConfig.cls}`}>
                    {statusConfig.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 py-5">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email</p>
                      <p className="text-sm text-foreground truncate">{profileTeacher.email}</p>
                    </div>
                  </div>

                  {profileTeacher.phone_number && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Phone</p>
                        <p className="text-sm text-foreground">{profileTeacher.phone_number}</p>
                      </div>
                    </div>
                  )}

                  {profileTeacher.subject_specialty && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <GraduationCap className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Subject Specialty</p>
                        <Badge variant="outline" className={`text-xs border ${subjectColorMap[profileTeacher.subject_specialty] || 'bg-muted'}`}>
                          {profileTeacher.subject_specialty}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {profileTeacher.school && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">School</p>
                        <p className="text-sm text-foreground">{profileTeacher.school.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Joined</p>
                        <p className="text-sm text-foreground">{new Date(profileTeacher.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {profileTeacher.approved_at && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                        <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                          <Shield className="h-4 w-4 text-success" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Approved</p>
                          <p className="text-sm text-foreground">{new Date(profileTeacher.approved_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">User ID</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{profileTeacher.user_id}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assigned Classes ({profileAssignments.length})
                  </Label>
                  {profileAssignments.length > 0 ? (
                    <div className="space-y-2 mt-3">
                      {profileAssignments.map((a, i) => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-muted/20"
                        >
                          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.class_info?.name || 'Unknown Class'}</p>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`text-[10px] border ${subjectColorMap[a.subject] || 'bg-muted'}`}>
                                {a.subject}
                              </Badge>
                              {a.class_info?.school && (
                                <span className="text-[10px] text-muted-foreground">{a.class_info.school.name}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">No classes assigned yet.</p>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
