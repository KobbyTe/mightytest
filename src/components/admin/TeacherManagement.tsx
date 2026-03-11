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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {profileTeacher && (() => {
            const initials = profileTeacher.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const statusConfig = {
              approved: { label: 'Verified Educator', cls: 'bg-success/15 text-success border-success/30', icon: <CheckCircle className="h-3.5 w-3.5" /> },
              pending: { label: 'Pending Verification', cls: 'bg-primary/15 text-primary border-primary/30', icon: <Clock className="h-3.5 w-3.5" /> },
              rejected: { label: 'Access Revoked', cls: 'bg-destructive/15 text-destructive border-destructive/30', icon: <XCircle className="h-3.5 w-3.5" /> },
            }[profileTeacher.status] || { label: profileTeacher.status, cls: 'bg-muted text-muted-foreground', icon: null };

            const accountAge = Math.floor((Date.now() - new Date(profileTeacher.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const accountAgeLabel = accountAge > 365 ? `${Math.floor(accountAge / 365)}y ${accountAge % 365}d` : `${accountAge} days`;

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                {/* Hero Banner */}
                <div className="relative h-32 bg-gradient-to-br from-accent via-primary to-secondary overflow-hidden rounded-t-lg">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, hsl(var(--accent)) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--primary)) 0%, transparent 50%)' }} />
                  <div className="absolute top-3 right-3">
                    {profileTeacher.status === 'approved' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                        <Shield className="h-4 w-4 text-success" />
                        <span className="text-[11px] font-bold text-success">VERIFIED</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Avatar + Name Section */}
                <div className="relative px-6 pb-4">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.3 }}
                    className="flex items-end gap-4 -mt-12"
                  >
                    <div className="relative shrink-0">
                      <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-black text-primary-foreground border-4 border-background shadow-xl">
                        {initials}
                      </div>
                      {profileTeacher.status === 'approved' && (
                        <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-success flex items-center justify-center border-2 border-background shadow-md">
                          <CheckCircle className="h-4 w-4 text-success-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="pb-1 min-w-0">
                      <h2 className="text-xl font-black text-foreground tracking-tight truncate">{profileTeacher.full_name}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[11px] border font-semibold gap-1 ${statusConfig.cls}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                        {profileTeacher.subject_specialty && (
                          <Badge variant="outline" className={`text-[11px] border ${subjectColorMap[profileTeacher.subject_specialty] || 'bg-muted'}`}>
                            {profileTeacher.subject_specialty}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="px-6 pb-6 space-y-5">
                  {/* Contact & Professional Section */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      Contact & Professional
                      <div className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="group flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { navigator.clipboard.writeText(profileTeacher.email); toast.success('Email copied'); }}>
                        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                          <Mail className="h-5 w-5 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email Address</p>
                          <p className="text-sm font-medium text-foreground truncate">{profileTeacher.email}</p>
                        </div>
                      </div>

                      <div className="group flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { if (profileTeacher.phone_number) { navigator.clipboard.writeText(profileTeacher.phone_number); toast.success('Phone copied'); } }}>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Phone Number</p>
                          <p className="text-sm font-medium text-foreground">{profileTeacher.phone_number || 'Not provided'}</p>
                        </div>
                      </div>

                      {profileTeacher.school && (
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-sm">
                          <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-5 w-5 text-secondary" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">School Affiliation</p>
                            <p className="text-sm font-medium text-foreground">{profileTeacher.school.name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-sm">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Hash className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Teacher ID</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">TCH-{profileTeacher.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Account Timeline & Security */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      Security & Verification
                      <div className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                      {/* Timeline */}
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-0">
                          <div className="h-3 w-3 rounded-full bg-primary border-2 border-primary shadow-sm" />
                          <div className="w-0.5 h-8 bg-border" />
                          <div className={`h-3 w-3 rounded-full border-2 shadow-sm ${profileTeacher.approved_at ? 'bg-success border-success' : 'bg-muted border-border'}`} />
                        </div>
                        <div className="flex-1 space-y-4 -mt-1">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Account Registered</p>
                            <p className="text-sm font-medium text-foreground">{new Date(profileTeacher.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              {profileTeacher.approved_at ? 'Verified & Approved' : 'Awaiting Verification'}
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {profileTeacher.approved_at
                                ? new Date(profileTeacher.approved_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                : 'Pending review'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Trust indicators */}
                      <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold text-muted-foreground">Account age: {accountAgeLabel}</span>
                        </div>
                        {profileTeacher.status === 'approved' && (
                          <div className="flex items-center gap-1.5 bg-success/10 rounded-full px-3 py-1.5">
                            <Shield className="h-3.5 w-3.5 text-success" />
                            <span className="text-[11px] font-semibold text-success">Identity Verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Assigned Classes */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      Assigned Classes ({profileAssignments.length})
                      <div className="h-px flex-1 bg-border" />
                    </h3>
                    {profileAssignments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profileAssignments.map((a, i) => (
                          <motion.div
                            key={a.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 + i * 0.06 }}
                            className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                              <BookOpen className="h-5 w-5 text-accent" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{a.class_info?.name || 'Unknown Class'}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] border ${subjectColorMap[a.subject] || 'bg-muted'}`}>
                                  {a.subject}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  Since {new Date(a.assigned_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-muted/20 border border-dashed border-border/50">
                        <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No classes assigned yet</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">Assign classes from the management tab</p>
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
