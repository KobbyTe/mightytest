import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Download, Eye, FlaskConical, Loader2, Plus, RotateCcw, Save, Trash2, Archive, Users } from 'lucide-react';
import { LAB_CONFIG, LAB_TYPES, parseLabType, parseRubric, rubricTotal, isScoreValid, formatBytes, type LabType, type RubricItem } from '@/lib/labProjects';
import { openLabFile, rpcError } from '@/lib/labUpload';
import { StatusBadge, type LabAssignment, type LabSubmission, type LabFile } from '@/components/student/LabProjects';

interface ClassOpt { id: string; name: string; school_id: string; school_name?: string }
interface StudentRow { id: string; full_name: string; class_id: string | null }
type Assignment = LabAssignment & { status: string; created_by: string | null; rubric: any };

const DEFAULT_RUBRIC: RubricItem[] = [
  { name: 'Functionality', points: 30 }, { name: 'Creativity', points: 20 }, { name: 'Technical Implementation', points: 25 },
  { name: 'Problem Solving', points: 15 }, { name: 'Documentation', points: 10 },
];

export default function LabProjectManagement() {
  const { role } = useAuth();
  const { scopedClassIds, loading: scopeLoading } = useTeacherScope();
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<LabSubmission[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (scopeLoading) return;
    let cq = supabase.from('classes').select('id, name, school_id, school:schools(name)').order('name');
    if (role !== 'admin') cq = cq.in('id', scopedClassIds?.length ? scopedClassIds : ['00000000-0000-0000-0000-000000000000']);
    const [c, a, s] = await Promise.all([
      cq,
      supabase.from('lab_project_assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('lab_project_submissions').select('*').neq('status', 'draft').order('attempt_number', { ascending: false }),
    ]);
    const cls = (c.data || []).map((x: any) => ({ id: x.id, name: x.name, school_id: x.school_id, school_name: x.school?.name }));
    setClasses(cls);
    setAssignments((a.data || []) as Assignment[]);
    setSubs((s.data || []) as LabSubmission[]);
    const classIds = [...new Set((a.data || []).map((x: any) => x.class_id))];
    if (classIds.length) {
      const { data: st } = await supabase.from('students').select('id, full_name, class_id').in('class_id', classIds).order('full_name').limit(1000);
      setStudents((st || []) as StudentRow[]);
    } else setStudents([]);
    setLoading(false);
  }, [role, scopedClassIds, scopeLoading]);

  useEffect(() => { load(); }, [load]);

  const open = assignments.find((a) => a.id === openId);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (creating) return <AssignmentForm classes={classes} onDone={async (saved) => { setCreating(false); if (saved) await load(); }} />;
  if (open) return (
    <AssignmentSubmissions
      assignment={open}
      className={classes.find((c) => c.id === open.class_id)?.name || ''}
      students={students.filter((s) => s.class_id === open.class_id)}
      subs={subs.filter((s) => s.assignment_id === open.id)}
      onBack={() => setOpenId(null)}
      reload={load}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FlaskConical className="h-5 w-5 text-primary" /> Lab Projects</h2>
          <p className="text-sm text-muted-foreground">Robotics, AI and 3D lab assignments for your classes</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={classes.length === 0}><Plus className="mr-1 h-4 w-4" /> New lab project</Button>
      </div>
      {classes.length === 0 && <p className="text-sm text-muted-foreground">You need to be assigned to a class before creating lab projects.</p>}

      {assignments.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <FlaskConical className="mx-auto mb-2 h-8 w-8 opacity-50" /> No lab projects yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => {
            const cfg = LAB_CONFIG[parseLabType(a.lab_type)];
            const classStudents = students.filter((s) => s.class_id === a.class_id);
            const latest = new Map<string, LabSubmission>();
            subs.filter((s) => s.assignment_id === a.id).forEach((s) => { if (!latest.has(s.student_id)) latest.set(s.student_id, s); });
            const vals = [...latest.values()];
            const pending = vals.filter((s) => ['submitted', 'under_review'].includes(s.status)).length;
            const graded = vals.filter((s) => s.status === 'graded').length;
            const late = vals.filter((s) => s.is_late).length;
            return (
              <button key={a.id} onClick={() => setOpenId(a.id)} className="rounded-2xl border border-border/60 bg-card/70 p-4 text-left backdrop-blur-sm transition hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{a.title}</p>
                      {a.status !== 'published' && <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{cfg.label} · {classes.find((c) => c.id === a.class_id)?.name}{a.due_date ? ` · Due ${format(new Date(a.due_date), 'MMM d')}` : ''}</p>
                    <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[11px]">
                      {[['Students', classStudents.length], ['Submitted', vals.length], ['Pending', pending], ['Graded', graded], ['Late', late]].map(([l, v]) => (
                        <div key={l as string} className="rounded-lg bg-muted/50 py-1.5"><p className="text-sm font-bold">{v}</p><p className="text-muted-foreground">{l}</p></div>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignmentForm({ classes, onDone }: { classes: ClassOpt[]; onDone: (saved: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({
    title: '', class_id: classes[0]?.id || '', lab_type: 'virtual_robotics' as LabType, subject: '', description: '', instructions: '',
    max_score: 100, due_date: '', allow_late_submission: false, allow_resubmission: true, allow_supporting_files: true, require_description: false, max_mb: 50,
  });
  const [useRubric, setUseRubric] = useState(true);
  const [rubric, setRubric] = useState<RubricItem[]>(DEFAULT_RUBRIC);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const total = rubricTotal(rubric);

  const save = async () => {
    const cls = classes.find((c) => c.id === f.class_id);
    if (!f.title.trim() || !cls) return toast({ title: 'Title and class are required', variant: 'destructive' });
    if (f.max_score < 1 || f.max_score > 1000) return toast({ title: 'Max score must be 1–1000', variant: 'destructive' });
    if (useRubric && total !== f.max_score) return toast({ title: `Rubric points (${total}) must add up to the max score (${f.max_score})`, variant: 'destructive' });
    if (f.max_mb < 1 || f.max_mb > 200) return toast({ title: 'File size limit must be 1–200 MB', variant: 'destructive' });
    setSaving(true);
    const { error } = await supabase.from('lab_project_assignments').insert({
      title: f.title.trim().slice(0, 200), class_id: cls.id, school_id: cls.school_id, created_by: user!.id, lab_type: f.lab_type,
      accepted_extension: LAB_CONFIG[f.lab_type].extension, subject: f.subject.trim() || null, description: f.description.trim() || null,
      instructions: f.instructions.trim() || null, max_score: f.max_score, due_date: f.due_date ? new Date(f.due_date).toISOString() : null,
      allow_late_submission: f.allow_late_submission, allow_resubmission: f.allow_resubmission, allow_supporting_files: f.allow_supporting_files,
      require_description: f.require_description, max_file_size: f.max_mb * 1024 * 1024, rubric: useRubric ? (rubric as any) : [], status: 'published',
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not create', description: rpcError(error), variant: 'destructive' });
    toast({ title: 'Lab project created', description: 'Students in the class have been notified.' });
    onDone(true);
  };

  return (
    <Card><CardContent className="space-y-4 p-4 sm:p-6">
      <Button variant="ghost" size="sm" onClick={() => onDone(false)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
      <h3 className="text-lg font-bold">New lab project</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label>Title *</Label><Input value={f.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="Grade 8 Autonomous Rescue Robot" /></div>
        <div className="space-y-1.5"><Label>Class *</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.class_id} onChange={(e) => set('class_id', e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.school_name ? ` — ${c.school_name}` : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Lab *</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.lab_type} onChange={(e) => set('lab_type', e.target.value)}>
            {LAB_TYPES.map((t) => <option key={t} value={t}>{LAB_CONFIG[t].emoji} {LAB_CONFIG[t].label}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground">Submission format: <code>{LAB_CONFIG[f.lab_type].extension}</code></p>
        </div>
        <div className="space-y-1.5"><Label>Subject</Label><Input value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Robotics" /></div>
        <div className="space-y-1.5"><Label>Due date</Label><Input type="datetime-local" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Maximum score</Label><Input type="number" min={1} max={1000} value={f.max_score} onChange={(e) => set('max_score', parseInt(e.target.value) || 0)} /></div>
        <div className="space-y-1.5"><Label>Max file size (MB)</Label><Input type="number" min={1} max={200} value={f.max_mb} onChange={(e) => set('max_mb', parseInt(e.target.value) || 0)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Instructions</Label><Textarea rows={4} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[['allow_late_submission', 'Allow late submissions'], ['allow_resubmission', 'Allow resubmission'], ['allow_supporting_files', 'Allow supporting files'], ['require_description', 'Require project description']].map(([k, l]) => (
          <label key={k} className="flex items-center justify-between rounded-xl border p-3 text-sm">{l}<Switch checked={(f as any)[k]} onCheckedChange={(v) => set(k, v)} /></label>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border p-3">
        <label className="flex items-center justify-between text-sm font-medium">Use a rubric <Switch checked={useRubric} onCheckedChange={setUseRubric} /></label>
        {useRubric && (
          <>
            {rubric.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input value={r.name} onChange={(e) => setRubric((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input type="number" className="w-24" value={r.points} onChange={(e) => setRubric((p) => p.map((x, j) => (j === i ? { ...x, points: Math.max(0, parseInt(e.target.value) || 0) } : x)))} />
                <Button size="icon" variant="ghost" onClick={() => setRubric((p) => p.filter((_, j) => j !== i))} aria-label="Remove category"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={() => setRubric((p) => [...p, { name: 'New category', points: 0 }])}><Plus className="mr-1 h-3 w-3" /> Category</Button>
              <span className={`text-sm font-medium ${total === f.max_score ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>Total {total}/{f.max_score}</span>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Create & assign</Button></div>
    </CardContent></Card>
  );
}

function AssignmentSubmissions({ assignment: a, className, students, subs, onBack, reload }: {
  assignment: Assignment; className: string; students: StudentRow[]; subs: LabSubmission[]; onBack: () => void; reload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const { role, user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = LAB_CONFIG[parseLabType(a.lab_type)];
  const latest = useMemo(() => {
    const m = new Map<string, LabSubmission>();
    subs.forEach((s) => { if (!m.has(s.student_id)) m.set(s.student_id, s); });
    return m;
  }, [subs]);
  const canEdit = role === 'admin' || a.created_by === user?.id;

  const setStatus = async (status: string) => {
    const { error } = await supabase.from('lab_project_assignments').update({ status }).eq('id', a.id);
    if (error) return toast({ title: rpcError(error), variant: 'destructive' });
    await reload();
  };
  const del = async () => {
    setConfirmDelete(false);
    const { error } = await supabase.from('lab_project_assignments').delete().eq('id', a.id);
    if (error) return toast({ title: 'Could not delete', description: 'Projects with submissions can only be archived.', variant: 'destructive' });
    onBack(); await reload();
  };

  if (studentId) {
    const st = students.find((s) => s.id === studentId);
    return <SubmissionReview assignment={a} studentName={st?.full_name || 'Student'} className={className} history={subs.filter((s) => s.student_id === studentId)} onBack={() => setStudentId(null)} reload={reload} />;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> All lab projects</Button>
      <Card><CardContent className="flex flex-wrap items-start gap-3 p-4">
        <span className="text-3xl">{cfg.emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{a.title}</h3>
          <p className="text-sm text-muted-foreground">{cfg.label} · <code>{a.accepted_extension}</code> · {className} · Max {a.max_score}{a.due_date ? ` · Due ${format(new Date(a.due_date), 'PPp')}` : ''}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {a.status === 'published'
              ? <Button size="sm" variant="outline" onClick={() => setStatus('archived')}><Archive className="mr-1 h-4 w-4" /> Close</Button>
              : <Button size="sm" variant="outline" onClick={() => setStatus('published')}>Reopen</Button>}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <div className="flex items-center gap-2 border-b p-3 text-sm font-medium"><Users className="h-4 w-4" /> {students.length} students · {latest.size} submitted · {students.length - latest.size} not submitted</div>
        <div className="divide-y">
          {students.length === 0 && <p className="p-4 text-sm text-muted-foreground">No students in this class yet.</p>}
          {students.map((s) => {
            const l = latest.get(s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.full_name}</span>
                {l ? <StatusBadge status={l.status} /> : <StatusBadge status="not_started" />}
                {l?.is_late && <Badge variant="outline" className="text-[10px] text-destructive">Late</Badge>}
                {l && <span className="text-xs text-muted-foreground">Attempt {l.attempt_number}</span>}
                {l?.status === 'graded' && <span className="text-sm font-semibold">{l.score}/{l.max_score}</span>}
                {l && <Button size="sm" variant="outline" onClick={() => setStudentId(s.id)}><Eye className="mr-1 h-3.5 w-3.5" /> Review</Button>}
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this lab project?</AlertDialogTitle>
            <AlertDialogDescription>This is only possible if no student has submitted. Otherwise close it instead to keep students' work.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubmissionReview({ assignment: a, studentName, className, history, onBack, reload }: {
  assignment: Assignment; studentName: string; className: string; history: LabSubmission[]; onBack: () => void; reload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState(history[0]?.id);
  const s = history.find((h) => h.id === selectedId) || history[0];
  const rubric = parseRubric(a.rubric);
  const [files, setFiles] = useState<LabFile[]>([]);
  const [score, setScore] = useState<number>(s?.score ?? 0);
  const [feedback, setFeedback] = useState(s?.teacher_feedback || '');
  const [rubricScores, setRubricScores] = useState<number[]>(rubric.map((r, i) => (Array.isArray(s?.rubric_scores) ? Number(s.rubric_scores[i]?.score) || 0 : 0)));
  const [busy, setBusy] = useState(false);
  const isLatest = s?.id === history[0]?.id;

  useEffect(() => {
    if (!s) return;
    supabase.from('lab_project_submission_files').select('*').eq('submission_id', s.id).then(({ data }) => setFiles((data || []) as LabFile[]));
    setScore(s.score ?? 0); setFeedback(s.teacher_feedback || '');
    setRubricScores(rubric.map((r, i) => (Array.isArray(s.rubric_scores) ? Number(s.rubric_scores[i]?.score) || 0 : 0)));
    if (s.status === 'submitted' && isLatest) supabase.rpc('lab_mark_under_review', { _submission_id: s.id }).then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.id]);

  useEffect(() => { if (rubric.length) setScore(rubricScores.reduce((x, y) => x + y, 0)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rubricScores]);

  if (!s) return null;
  const main = files.find((f) => f.file_type === 'main_project');
  const supporting = files.filter((f) => f.file_type !== 'main_project');
  const canAct = isLatest && ['submitted', 'under_review', 'graded'].includes(s.status);

  const open = async (f: LabFile, download: boolean) => {
    try { await openLabFile(f.id, f.storage_path, download); } catch (e) { toast({ title: rpcError(e), variant: 'destructive' }); }
  };
  const grade = async () => {
    if (!isScoreValid(score, s.max_score)) return toast({ title: `Score must be a whole number from 0 to ${s.max_score}`, variant: 'destructive' });
    if (rubric.some((r, i) => rubricScores[i] < 0 || rubricScores[i] > r.points)) return toast({ title: 'A rubric score is above its maximum', variant: 'destructive' });
    setBusy(true);
    const { error } = await supabase.rpc('lab_grade_submission', {
      _submission_id: s.id, _score: score, _feedback: feedback,
      _rubric_scores: rubric.length ? (rubric.map((r, i) => ({ name: r.name, points: r.points, score: rubricScores[i] })) as any) : null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Could not grade', description: rpcError(error), variant: 'destructive' });
    toast({ title: 'Grade saved', description: 'The student has been notified.' });
    await reload();
  };
  const resubmit = async () => {
    if (!feedback.trim()) return toast({ title: 'Add feedback explaining what to improve', variant: 'destructive' });
    setBusy(true);
    const { error } = await supabase.rpc('lab_request_resubmission', { _submission_id: s.id, _feedback: feedback });
    setBusy(false);
    if (error) return toast({ title: rpcError(error), variant: 'destructive' });
    toast({ title: 'Resubmission requested' });
    await reload();
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Submissions</Button>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card><CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{s.project_title || 'Untitled project'}</h3>
              <StatusBadge status={s.status} />
              {s.is_late ? <Badge variant="outline" className="text-[10px] text-destructive">Late</Badge> : <Badge variant="outline" className="text-[10px]">On time</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{studentName} · {className} · {LAB_CONFIG[parseLabType(a.lab_type)].label}</p>
            <p className="text-xs text-muted-foreground">Attempt {s.attempt_number}{s.submitted_at ? ` · Submitted ${format(new Date(s.submitted_at), 'PPp')}` : ''}</p>
            {main && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{main.file_name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(main.file_size)}</span>
                <Button size="sm" onClick={() => open(main, true)}><Download className="mr-1 h-3.5 w-3.5" /> Download Project</Button>
              </div>
            )}
            {supporting.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Supporting files</p>
                <div className="flex flex-wrap gap-2">
                  {supporting.map((f) => (
                    <Button key={f.id} size="sm" variant="outline" onClick={() => open(f, f.file_type === 'documentation' && !f.file_name.toLowerCase().endsWith('.pdf'))}>
                      <Badge variant="secondary" className="mr-1 text-[9px] capitalize">{f.file_type}</Badge><span className="max-w-[160px] truncate">{f.file_name}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Images, PDFs and videos open in a new tab through a link that expires after 2 minutes.</p>
              </div>
            )}
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-4 text-sm">
            {[['Description', s.description], ['What does the project do?', s.what_it_does], ['What did they learn?', s.learning_reflection]].map(([l, v]) => v ? (
              <div key={l as string}><p className="font-medium">{l}</p><p className="whitespace-pre-wrap text-muted-foreground">{v}</p></div>
            ) : null)}
            {s.technologies_used?.length > 0 && <div className="flex flex-wrap gap-1">{s.technologies_used.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>}
          </CardContent></Card>
        </div>

        <div className="space-y-4">
          <Card><CardContent className="space-y-3 p-4">
            <p className="font-semibold">Grade</p>
            {rubric.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <Input type="number" min={0} max={r.points} className="h-8 w-20" disabled={!canAct} value={rubricScores[i] ?? 0}
                  onChange={(e) => setRubricScores((p) => p.map((x, j) => (j === i ? Math.min(r.points, Math.max(0, parseInt(e.target.value) || 0)) : x)))} />
                <span className="w-10 text-xs text-muted-foreground">/ {r.points}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={s.max_score} value={score} disabled={!canAct || rubric.length > 0}
                onChange={(e) => setScore(Math.min(s.max_score, Math.max(0, parseInt(e.target.value) || 0)))} className="text-lg font-bold" />
              <span className="text-sm text-muted-foreground">/ {s.max_score}</span>
            </div>
            <Textarea rows={6} placeholder="Feedback for the student" value={feedback} disabled={!canAct} maxLength={10000} onChange={(e) => setFeedback(e.target.value)} />
            {canAct ? (
              <div className="flex flex-col gap-2">
                <Button onClick={grade} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{s.status === 'graded' ? 'Update grade' : 'Save grade'}</Button>
                {a.allow_resubmission && <Button variant="outline" onClick={resubmit} disabled={busy}><RotateCcw className="mr-1 h-4 w-4" /> Request Resubmission</Button>}
              </div>
            ) : <p className="text-xs text-muted-foreground">{isLatest ? 'Waiting for the student.' : 'Older version — view only.'}</p>}
          </CardContent></Card>

          <Card><CardContent className="space-y-2 p-4">
            <p className="font-semibold">Submission history</p>
            {history.map((h) => (
              <button key={h.id} onClick={() => setSelectedId(h.id)} className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left text-xs ${h.id === s.id ? 'border-primary bg-primary/5' : ''}`}>
                <span className="font-medium">Version {h.attempt_number}</span>
                <StatusBadge status={h.status} />
                {h.status === 'graded' && <span className="ml-auto font-semibold">{h.score}/{h.max_score}</span>}
              </button>
            ))}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
