import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, CheckCircle2, Clock, Download, FileUp, FlaskConical, Loader2, Paperclip, Send, Trash2, X, XCircle, History } from 'lucide-react';
import {
  LAB_CONFIG, STATUS_META, parseLabType, validateMainProject, validateSupporting, classifySupporting,
  formatBytes, safeFileName, storagePrefix, MAX_SUPPORTING_FILES, type SubmissionStatus,
} from '@/lib/labProjects';
import { uploadWithProgress, openLabFile, rpcError, LAB_BUCKET } from '@/lib/labUpload';

export interface LabAssignment {
  id: string; school_id: string; class_id: string; title: string; description: string | null; instructions: string | null;
  lab_type: string; accepted_extension: string; max_score: number; due_date: string | null; allow_late_submission: boolean;
  allow_resubmission: boolean; allow_supporting_files: boolean; require_description: boolean; max_file_size: number; subject: string | null;
}
export interface LabSubmission {
  id: string; assignment_id: string; student_id: string; attempt_number: number; project_title: string; description: string | null;
  what_it_does: string | null; technologies_used: string[]; learning_reflection: string | null; main_file_name: string | null;
  main_file_size: number | null; status: string; is_late: boolean; score: number | null; max_score: number; teacher_feedback: string | null;
  submitted_at: string | null; graded_at: string | null; rubric_scores: any; created_at: string;
}
export interface LabFile { id: string; submission_id: string; file_type: string; file_name: string; storage_path: string; file_size: number; mime_type: string | null }

const FILTERS = [
  { id: 'all', label: 'Assigned' },
  { id: 'not_started', label: 'To do' },
  { id: 'draft', label: 'Drafts' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'graded', label: 'Graded' },
  { id: 'resubmission_required', label: 'Returned' },
] as const;

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[(status as SubmissionStatus) in STATUS_META ? (status as SubmissionStatus) : 'not_started'];
  return <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>;
}

export function useStudentLabProjects() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<LabAssignment[]>([]);
  const [submissions, setSubmissions] = useState<LabSubmission[]>([]);
  const [files, setFiles] = useState<LabFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [a, s] = await Promise.all([
      supabase.from('lab_project_assignments').select('*').eq('status', 'published').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('lab_project_submissions').select('*').eq('student_id', profile.id).order('attempt_number', { ascending: false }),
    ]);
    const subs = (s.data || []) as LabSubmission[];
    setAssignments((a.data || []) as LabAssignment[]);
    setSubmissions(subs);
    if (subs.length) {
      const { data: f } = await supabase.from('lab_project_submission_files').select('*').in('submission_id', subs.map((x) => x.id));
      setFiles((f || []) as LabFile[]);
    } else setFiles([]);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);
  const latestFor = useCallback((id: string) => submissions.find((s) => s.assignment_id === id) || null, [submissions]);
  return { assignments, submissions, files, loading, reload: load, latestFor };
}

export function LabProjects() {
  const { assignments, submissions, files, loading, reload, latestFor } = useStudentLabProjects();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<string>('all');
  const openId = params.get('a');
  const open = assignments.find((a) => a.id === openId) || null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assignments.length };
    assignments.forEach((a) => { const st = latestFor(a.id)?.status || 'not_started'; c[st] = (c[st] || 0) + 1; });
    return c;
  }, [assignments, latestFor]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (open) {
    return (
      <AssignmentDetail
        assignment={open}
        history={submissions.filter((s) => s.assignment_id === open.id)}
        files={files}
        onBack={() => setParams({})}
        reload={reload}
      />
    );
  }

  const visible = assignments.filter((a) => filter === 'all' || (latestFor(a.id)?.status || 'not_started') === filter);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${filter === f.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/60 text-muted-foreground hover:text-foreground'}`}
          >
            {f.label} <span className="ml-1 opacity-70">{counts[f.id] || 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <FlaskConical className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <p className="font-semibold">{assignments.length === 0 ? 'No lab projects yet' : 'Nothing here'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {assignments.length === 0 ? 'When your teacher assigns a lab project it will appear here.' : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((a) => {
            const cfg = LAB_CONFIG[parseLabType(a.lab_type)];
            const latest = latestFor(a.id);
            const overdue = a.due_date && isPast(new Date(a.due_date)) && (!latest || latest.status === 'draft');
            return (
              <button key={a.id} onClick={() => setParams({ a: a.id })} className="glass-card group p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">{cfg.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label} · <code>{a.accepted_extension}</code></p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {latest?.status === 'graded'
                        ? <Badge variant="outline" className={STATUS_META.graded.className + ' text-[10px]'}>Graded — {latest.score}/{latest.max_score}</Badge>
                        : <StatusBadge status={latest?.status || 'not_started'} />}
                      {a.due_date && (
                        <span className={`flex items-center gap-1 text-[11px] ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Clock className="h-3 w-3" /> Due {format(new Date(a.due_date), 'MMM d')}
                        </span>
                      )}
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

function AssignmentDetail({ assignment: a, history, files, onBack, reload }: {
  assignment: LabAssignment; history: LabSubmission[]; files: LabFile[]; onBack: () => void; reload: () => Promise<void>;
}) {
  const { toast } = useToast();
  const cfg = LAB_CONFIG[parseLabType(a.lab_type)];
  const latest = history[0] || null;
  const [starting, setStarting] = useState(false);
  const deadlinePassed = !!a.due_date && isPast(new Date(a.due_date));
  const canStart = (!latest || ['resubmission_required', 'returned'].includes(latest.status)) && (!latest || a.allow_resubmission) && (!deadlinePassed || a.allow_late_submission);

  const start = async () => {
    setStarting(true);
    const { error } = await supabase.rpc('lab_start_submission', { _assignment_id: a.id });
    setStarting(false);
    if (error) return toast({ title: 'Could not start', description: rpcError(error), variant: 'destructive' });
    await reload();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> All projects</Button>

      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl">{cfg.emoji}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold sm:text-xl">{a.title}</h2>
            <p className="text-sm text-muted-foreground">{cfg.label}{a.subject ? ` · ${a.subject}` : ''}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Accepted file: <code className="ml-1">{a.accepted_extension}</code></Badge>
              <Badge variant="outline">Max score {a.max_score}</Badge>
              {a.due_date && <Badge variant="outline" className={deadlinePassed ? 'text-destructive' : ''}>Due {format(new Date(a.due_date), 'PPp')}</Badge>}
              {a.allow_late_submission && <Badge variant="outline">Late allowed</Badge>}
            </div>
          </div>
        </div>
        {a.description && <p className="mt-4 whitespace-pre-wrap text-sm">{a.description}</p>}
        {a.instructions && (
          <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-1 font-medium">Instructions</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{a.instructions}</p>
          </div>
        )}
      </div>

      {latest?.status === 'resubmission_required' && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive">Your teacher has requested a resubmission.</p>
          {latest.teacher_feedback && <p className="mt-1 whitespace-pre-wrap text-sm">{latest.teacher_feedback}</p>}
        </div>
      )}

      {latest?.status === 'draft' ? (
        <SubmissionForm assignment={a} submission={latest} files={files.filter((f) => f.submission_id === latest.id)} reload={reload} />
      ) : canStart ? (
        <Card><CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <FileUp className="h-8 w-8 text-primary" />
          <p className="font-medium">{latest ? 'Ready to submit an improved version?' : 'Ready to submit your project?'}</p>
          <Button onClick={start} disabled={starting}>
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{latest ? 'Start new submission' : 'Start submission'}
          </Button>
        </CardContent></Card>
      ) : !latest && deadlinePassed ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">The deadline for this project has passed.</CardContent></Card>
      ) : null}

      {history.filter((h) => h.status !== 'draft').length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" /> Submission history</h3>
          {history.filter((h) => h.status !== 'draft').map((h) => (
            <SubmissionSummary key={h.id} submission={h} files={files.filter((f) => f.submission_id === h.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SubmissionSummary({ submission: s, files }: { submission: LabSubmission; files: LabFile[] }) {
  const { toast } = useToast();
  const open = async (f: LabFile, download = true) => {
    try { await openLabFile(f.id, f.storage_path, download); } catch (e) { toast({ title: rpcError(e), variant: 'destructive' }); }
  };
  return (
    <Card className="border-border/60 bg-background/60 backdrop-blur-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Attempt {s.attempt_number}</span>
          <StatusBadge status={s.status} />
          {s.is_late && <Badge variant="outline" className="text-[10px] text-destructive">Late</Badge>}
          {s.submitted_at && <span className="text-xs text-muted-foreground">{format(new Date(s.submitted_at), 'PPp')}</span>}
          {s.status === 'graded' && <span className="ml-auto text-lg font-bold text-[hsl(var(--success))]">{s.score}/{s.max_score}</span>}
        </div>
        <p className="font-medium">{s.project_title}</p>
        {s.teacher_feedback && (
          <div className="rounded-xl bg-primary/5 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-primary">Teacher feedback</p>
            <p className="whitespace-pre-wrap">{s.teacher_feedback}</p>
          </div>
        )}
        {Array.isArray(s.rubric_scores) && s.rubric_scores.length > 0 && (
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            {s.rubric_scores.map((r: any, i: number) => (
              <div key={i} className="flex justify-between rounded-lg bg-muted/50 px-2 py-1"><span>{r.name}</span><span className="font-medium">{r.score}/{r.points}</span></div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <Button key={f.id} size="sm" variant={f.file_type === 'main_project' ? 'default' : 'outline'} onClick={() => open(f)} className="max-w-full">
              <Download className="mr-1 h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.file_name}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type UploadState = { name: string; size: number; progress: number; state: 'checking' | 'uploading' | 'done' | 'error'; message: string };

function SubmissionForm({ assignment: a, submission: s, files, reload }: { assignment: LabAssignment; submission: LabSubmission; files: LabFile[]; reload: () => Promise<void> }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const labType = parseLabType(a.lab_type);
  const [title, setTitle] = useState(s.project_title || '');
  const [description, setDescription] = useState(s.description || '');
  const [what, setWhat] = useState(s.what_it_does || '');
  const [tech, setTech] = useState((s.technologies_used || []).join(', '));
  const [reflection, setReflection] = useState(s.learning_reflection || '');
  const [mainUpload, setMainUpload] = useState<UploadState | null>(null);
  const [supUploads, setSupUploads] = useState<UploadState[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'delete' | null>(null);
  const [dragging, setDragging] = useState(false);
  const mainRef = useRef<HTMLInputElement>(null);
  const supRef = useRef<HTMLInputElement>(null);

  const main = files.find((f) => f.file_type === 'main_project');
  const supporting = files.filter((f) => f.file_type !== 'main_project');
  const prefix = storagePrefix({ school_id: a.school_id, class_id: a.class_id, student_id: s.student_id, assignment_id: a.id, submission_id: s.id });

  const save = async (quiet = false) => {
    setSaving(true);
    const { error } = await supabase.rpc('lab_save_draft', {
      _submission_id: s.id, _title: title.slice(0, 200), _description: description.slice(0, 5000), _what_it_does: what.slice(0, 3000),
      _technologies: tech.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20), _reflection: reflection.slice(0, 3000),
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not save', description: rpcError(error), variant: 'destructive' }); return false; }
    if (!quiet) toast({ title: 'Draft saved' });
    return true;
  };

  const handleMain = async (file: File) => {
    setMainUpload({ name: file.name, size: file.size, progress: 0, state: 'checking', message: 'Checking file…' });
    const content = LAB_CONFIG[labType].isJson && file.size <= a.max_file_size ? await file.text() : null;
    const v = validateMainProject(file.name, file.size, content, labType, a.max_file_size);
    if (!v.ok) return setMainUpload((u) => u && { ...u, state: 'error', message: v.message });
    const path = `${prefix}main/${Date.now()}-${safeFileName(file.name)}`;
    try {
      setMainUpload((u) => u && { ...u, state: 'uploading', message: v.message });
      await uploadWithProgress(path, file, (p) => setMainUpload((u) => u && { ...u, progress: p }));
      const { error } = await supabase.rpc('lab_attach_file', { _submission_id: s.id, _file_type: 'main_project', _file_name: file.name, _storage_path: path, _mime: file.type || 'application/octet-stream', _size: file.size });
      if (error) { await supabase.storage.from(LAB_BUCKET).remove([path]); throw error; }
      if (main) await supabase.storage.from(LAB_BUCKET).remove([main.storage_path]);
      setMainUpload((u) => u && { ...u, state: 'done', progress: 100, message: `${v.message} · Upload complete` });
      await reload();
    } catch (e) {
      setMainUpload((u) => u && { ...u, state: 'error', message: rpcError(e) });
    }
  };

  const handleSupporting = async (list: FileList) => {
    const room = MAX_SUPPORTING_FILES - supporting.length;
    for (const file of Array.from(list).slice(0, Math.max(0, room))) {
      const idx = Date.now() + Math.random();
      const entry: UploadState = { name: file.name, size: file.size, progress: 0, state: 'uploading', message: 'Uploading…' };
      const v = validateSupporting(file.name, file.size, a.max_file_size);
      if (!v.ok) { setSupUploads((p) => [...p, { ...entry, state: 'error', message: v.message }]); continue; }
      setSupUploads((p) => [...p, entry]);
      const update = (patch: Partial<UploadState>) => setSupUploads((p) => p.map((x) => (x === entry || (x.name === entry.name && x.size === entry.size) ? Object.assign(x, patch) && { ...x } : x)));
      const path = `${prefix}supporting/${Math.round(idx)}-${safeFileName(file.name)}`;
      try {
        await uploadWithProgress(path, file, (pct) => update({ progress: pct }));
        const { error } = await supabase.rpc('lab_attach_file', { _submission_id: s.id, _file_type: classifySupporting(file.name)!, _file_name: file.name, _storage_path: path, _mime: file.type || 'application/octet-stream', _size: file.size });
        if (error) { await supabase.storage.from(LAB_BUCKET).remove([path]); throw error; }
        update({ state: 'done', progress: 100, message: 'Uploaded' });
      } catch (e) { update({ state: 'error', message: rpcError(e) }); }
    }
    if (list.length > room) toast({ title: `Maximum ${MAX_SUPPORTING_FILES} supporting files`, variant: 'destructive' });
    await reload();
    setSupUploads((p) => p.filter((x) => x.state === 'error'));
  };

  const removeFile = async (f: LabFile) => {
    const { data, error } = await supabase.rpc('lab_remove_file', { _file_id: f.id });
    if (error) return toast({ title: rpcError(error), variant: 'destructive' });
    if (data) await supabase.storage.from(LAB_BUCKET).remove([data as string]);
    await reload();
  };

  const submit = async () => {
    setConfirm(null);
    if (!(await save(true))) return;
    const { error } = await supabase.rpc('lab_submit', { _submission_id: s.id });
    if (error) return toast({ title: 'Could not submit', description: rpcError(error), variant: 'destructive' });
    toast({ title: 'Project submitted 🎉', description: 'Your teacher has been notified.' });
    await reload();
  };

  const deleteDraft = async () => {
    setConfirm(null);
    const { data, error } = await supabase.rpc('lab_delete_draft', { _submission_id: s.id });
    if (error) return toast({ title: rpcError(error), variant: 'destructive' });
    if (Array.isArray(data) && data.length) await supabase.storage.from(LAB_BUCKET).remove(data as string[]);
    await reload();
    navigate('/dashboard/projects');
  };

  const canSubmit = !!main && title.trim().length > 0 && (!a.require_description || description.trim().length > 0);

  return (
    <div className="glass-card space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Attempt {s.attempt_number} · Draft</h3>
        <StatusBadge status="draft" />
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lab-title">Project title *</Label>
          <Input id="lab-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Autonomous Rescue Robot" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lab-desc">Project description {a.require_description ? '*' : '(optional)'}</Label>
          <Textarea id="lab-desc" value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lab-what">What does your project do?</Label>
          <Textarea id="lab-what" value={what} maxLength={3000} onChange={(e) => setWhat(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lab-tech">Technologies / components used</Label>
          <Input id="lab-tech" value={tech} onChange={(e) => setTech(e.target.value)} placeholder="KodeVR, Sensors, Motors, Python" />
          <p className="text-[11px] text-muted-foreground">Separate with commas.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lab-learn">What did you learn?</Label>
          <Textarea id="lab-learn" value={reflection} maxLength={3000} onChange={(e) => setReflection(e.target.value)} rows={2} />
        </div>
      </div>

      {/* Main file */}
      <div className="space-y-2">
        <Label>Main project file *</Label>
        <p className="text-xs text-muted-foreground">Accepted file: <code className="rounded bg-muted px-1">{a.accepted_extension}</code> · up to {formatBytes(a.max_file_size)}</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleMain(f); }}
          onClick={() => mainRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && mainRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        >
          <FileUp className="mx-auto mb-2 h-7 w-7 text-primary" />
          <p className="text-sm font-medium">{main ? 'Replace project file' : 'Drag your project here or tap to choose'}</p>
          <input ref={mainRef} type="file" accept={a.accepted_extension === '.kodevr.json' ? '.json' : a.accepted_extension} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMain(f); e.target.value = ''; }} />
        </div>
        {mainUpload && <UploadRow u={mainUpload} onDismiss={() => setMainUpload(null)} />}
        {main && (!mainUpload || mainUpload.state === 'done') && (
          <div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--success))]/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
            <span className="min-w-0 flex-1 truncate font-medium">{main.file_name}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(main.file_size)}</span>
          </div>
        )}
      </div>

      {/* Supporting */}
      {a.allow_supporting_files && (
        <div className="space-y-2">
          <Label>Supporting files (optional)</Label>
          <p className="text-xs text-muted-foreground">Screenshots, PDF documentation or a demo video · max {MAX_SUPPORTING_FILES}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => supRef.current?.click()} disabled={supporting.length >= MAX_SUPPORTING_FILES}>
            <Paperclip className="mr-1 h-4 w-4" /> Add files
          </Button>
          <input ref={supRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.mp4,.webm,.mov" className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleSupporting(e.target.files); e.target.value = ''; }} />
          {supUploads.map((u, i) => <UploadRow key={i} u={u} onDismiss={() => setSupUploads((p) => p.filter((x) => x !== u))} />)}
          {supporting.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border p-2.5 text-sm">
              <Badge variant="outline" className="text-[10px] capitalize">{f.file_type.replace('_', ' ')}</Badge>
              <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFile(f)} aria-label={`Remove ${f.file_name}`}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm('delete')}><Trash2 className="mr-1 h-4 w-4" /> Discard draft</Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => save()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft</Button>
          <Button onClick={() => setConfirm('submit')} disabled={!canSubmit}><Send className="mr-1 h-4 w-4" /> Submit project</Button>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'submit' ? 'Submit your project?' : 'Discard this draft?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'submit' ? 'After submitting you cannot change it unless your teacher asks for a resubmission.' : 'Your uploaded files and answers for this draft will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm === 'submit' ? submit : deleteDraft}>{confirm === 'submit' ? 'Submit' : 'Discard'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadRow({ u, onDismiss }: { u: UploadState; onDismiss: () => void }) {
  const err = u.state === 'error';
  return (
    <div className={`space-y-1.5 rounded-xl border p-3 text-sm ${err ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        {err ? <XCircle className="h-4 w-4 shrink-0 text-destructive" /> : u.state === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
        <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(u.size)}</span>
        {(err || u.state === 'done') && <button onClick={onDismiss} aria-label="Dismiss"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>
      {u.state === 'uploading' && <Progress value={u.progress} className="h-1.5" />}
      <p className={`text-xs ${err ? 'text-destructive' : 'text-muted-foreground'}`}>{err ? `✕ ${u.message}` : u.state === 'uploading' ? `${u.progress}% · ${u.message}` : u.message}</p>
    </div>
  );
}

export function LabProjectsSummaryCard() {
  const { assignments, loading, latestFor } = useStudentLabProjects();
  const navigate = useNavigate();
  if (loading || assignments.length === 0) return null;
  const active = assignments.filter((a) => latestFor(a.id)?.status !== 'graded').length;
  return (
    <div className="glass-card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold">My Lab Projects</h3>
          <p className="text-xs text-muted-foreground">{active} active project{active === 1 ? '' : 's'}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/projects')}>View all</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {assignments.slice(0, 3).map((a) => {
          const cfg = LAB_CONFIG[parseLabType(a.lab_type)];
          const l = latestFor(a.id);
          return (
            <button key={a.id} onClick={() => navigate(`/dashboard/projects?a=${a.id}`)} className="rounded-2xl border border-border/60 bg-background/50 p-3 text-left transition hover:shadow-md">
              <p className="truncate text-sm font-semibold">{cfg.emoji} {a.title}</p>
              <p className="text-[11px] text-muted-foreground">{cfg.label}{a.due_date ? ` · Due ${format(new Date(a.due_date), 'MMM d')}` : ''}</p>
              <div className="mt-1.5">
                {l?.status === 'graded' ? <span className="text-xs font-semibold text-[hsl(var(--success))]">Graded — {l.score}/{l.max_score}</span> : <StatusBadge status={l?.status || 'not_started'} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
