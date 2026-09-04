import { parseCodingLanguage, assertCodingLanguage, toEditorLanguage, codingLanguageLabel, DEFAULT_CODING_LANGUAGE, type CodingLanguage } from '@/lib/codingLanguage';
import { parseTestCases, newTestCase, type CodingTestCase } from '@/lib/codingTests';
import { buildGradeUpdate, isValidScore, parseSubmissionStatus, type CodingSubmissionStatus } from '@/lib/codingGrading';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CodeEditor } from '@/components/coding/CodeEditor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus, Code2, Loader2, Sparkles, Users, Trash2, Edit, FlaskConical } from 'lucide-react';

interface ClassOption { id: string; name: string; }

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  language: CodingLanguage;
  starter_code: string;
  rubric: string | null;
  max_score: number;
  due_date: string | null;
  is_published: boolean;
  test_cases: CodingTestCase[];
  created_by: string | null;
  classAssignments: string[];
}

interface Submission {
  id: string;
  student_id: string;
  code: string;
  status: CodingSubmissionStatus;
  last_run_output: string | null;
  ai_suggested_score: number | null;
  ai_feedback: string | null;
  score: number | null;
  auto_score: number | null;
  teacher_feedback: string | null;
  submitted_at: string | null;
  student: { full_name: string } | null;
}

const STARTER_TEMPLATES: Record<CodingLanguage, string> = {
  html_css_js: '<!DOCTYPE html>\n<html>\n  <head>\n    <style>\n      /* your CSS here */\n    </style>\n  </head>\n  <body>\n    <h1>Hello!</h1>\n    <script>\n      // your JavaScript here\n    </script>\n  </body>\n</html>\n',
  python: '# Write your Python code here\nprint("Hello, world!")\n',
};

export default function CodingAssignmentManagement() {
  const { user, role } = useAuth();
  const { scopedClassIds, loading: scopeLoading } = useTeacherScope();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [language, setLanguage] = useState<CodingLanguage>(DEFAULT_CODING_LANGUAGE);
  const [starterCode, setStarterCode] = useState(STARTER_TEMPLATES.html_css_js);
  const [rubric, setRubric] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [dueDate, setDueDate] = useState('');
  const [published, setPublished] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [testCases, setTestCases] = useState<CodingTestCase[]>([]);

  const [gradingAssignment, setGradingAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [aiGrading, setAiGrading] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<string>('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (scopeLoading) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, scopedClassIds]);

  const loadData = async () => {
    setLoading(true);
    try {
      let classQuery = supabase.from('classes').select('id, name').order('name');
      if (scopedClassIds) {
        classQuery = classQuery.in('id', scopedClassIds.length ? scopedClassIds : ['00000000-0000-0000-0000-000000000000']);
      }
      const [{ data: classData }, { data: assignmentData }, { data: links }] = await Promise.all([
        classQuery,
        supabase.from('coding_assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('coding_assignment_class_assignments').select('assignment_id, class_id'),
      ]);

      setClasses(classData || []);

      const linksByAssignment = new Map<string, string[]>();
      (links || []).forEach((l) => {
        const arr = linksByAssignment.get(l.assignment_id) || [];
        arr.push(l.class_id);
        linksByAssignment.set(l.assignment_id, arr);
      });

      setAssignments(
        (assignmentData || []).map((a: any) => ({
          ...a,
          language: parseCodingLanguage(a.language),
          test_cases: parseTestCases(a.test_cases),
          classAssignments: linksByAssignment.get(a.id) || [],
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to load coding assignments');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setInstructions('');
    setLanguage('html_css_js');
    setStarterCode(STARTER_TEMPLATES.html_css_js);
    setRubric('');
    setMaxScore(100);
    setDueDate('');
    setPublished(false);
    setSelectedClasses([]);
    setTestCases([]);
  };

  const openEdit = (a: Assignment) => {
    setEditingId(a.id);
    setTitle(a.title);
    setDescription(a.description || '');
    setInstructions(a.instructions || '');
    setLanguage(a.language);
    setStarterCode(a.starter_code);
    setRubric(a.rubric || '');
    setMaxScore(a.max_score);
    setDueDate(a.due_date ? a.due_date.slice(0, 16) : '');
    setPublished(a.is_published);
    setSelectedClasses(a.classAssignments);
    setTestCases(a.test_cases);
    setDialogOpen(true);
  };

  const toggleClass = (id: string) =>
    setSelectedClasses((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Give the assignment a title');
    if (selectedClasses.length === 0) return toast.error('Assign it to at least one class');

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        language: assertCodingLanguage(language),
        starter_code: starterCode,
        rubric: rubric.trim() || null,
        max_score: maxScore,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        is_published: published,
        test_cases: JSON.parse(JSON.stringify(language === 'python' ? testCases : [])),
      };

      let assignmentId = editingId;

      if (editingId) {
        const { error } = await supabase.from('coding_assignments').update(payload).eq('id', editingId);
        if (error) throw error;
        await supabase.from('coding_assignment_class_assignments').delete().eq('assignment_id', editingId);
      } else {
        const { data: inserted, error } = await supabase
          .from('coding_assignments')
          .insert({ ...payload, created_by: user?.id ?? null })
          .select('id')
          .single();
        if (error) throw error;
        assignmentId = inserted!.id;
      }

      const { error: linkError } = await supabase.from('coding_assignment_class_assignments').insert(
        selectedClasses.map((class_id) => ({ assignment_id: assignmentId, class_id, assigned_by: user?.id ?? null }))
      );
      if (linkError) throw linkError;

      toast.success(editingId ? 'Assignment updated' : 'Assignment created');
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Could not save the assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this assignment? Student submissions will be deleted too.')) return;
    const { error } = await supabase.from('coding_assignments').delete().eq('id', id);
    if (error) return toast.error('Could not delete assignment');
    toast.success('Assignment deleted');
    loadData();
  };

  const openGrading = async (a: Assignment) => {
    setGradingAssignment(a);
    setActiveSubmission(null);
    setSubmissionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('coding_submissions')
        .select('*, student:students(full_name)')
        .eq('assignment_id', a.id)
        .order('submitted_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      setSubmissions(
        ((data as any[]) || []).map((s) => ({ ...s, status: parseSubmissionStatus(s.status) }))
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const openSubmission = (s: Submission) => {
    setActiveSubmission(s);
    setScoreDraft(s.score != null ? String(s.score) : s.ai_suggested_score != null ? String(s.ai_suggested_score) : '');
    setFeedbackDraft(s.teacher_feedback || s.ai_feedback || '');
  };

  const requestAiGrade = async () => {
    if (!activeSubmission) return;
    setAiGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grade-coding-assignment', {
        body: { submissionId: activeSubmission.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setScoreDraft(String(data.suggestedScore ?? ''));
      setFeedbackDraft(data.feedback || '');

      await supabase
        .from('coding_submissions')
        .update({
          ai_suggested_score: data.suggestedScore,
          ai_feedback: data.feedback,
          ai_graded_at: new Date().toISOString(),
        })
        .eq('id', activeSubmission.id);

      toast.success('AI suggestion ready — review before finalizing');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'AI grading failed');
    } finally {
      setAiGrading(false);
    }
  };

  const finalizeGrade = async () => {
    if (!activeSubmission) return;
    const maxScore = gradingAssignment?.max_score ?? 100;
    if (!isValidScore(scoreDraft, maxScore)) {
      return toast.error(`Score must be between 0 and ${maxScore}`);
    }
    setFinalizing(true);
    try {
      const { error } = await supabase
        .from('coding_submissions')
        .update(
          buildGradeUpdate({
            score: scoreDraft,
            maxScore,
            feedback: feedbackDraft,
            gradedBy: user?.id ?? null,
          })
        )
        .eq('id', activeSubmission.id);
      if (error) throw error;

      toast.success('Grade finalized and sent to the student');
      setActiveSubmission(null);
      if (gradingAssignment) openGrading(gradingAssignment);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Could not finalize the grade');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // ── Grading view for one assignment ──────────────────────────────────────
  if (gradingAssignment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setGradingAssignment(null)} className="mb-1 -ml-2">
              ← Back to assignments
            </Button>
            <h3 className="text-lg font-semibold">{gradingAssignment.title} — Submissions</h3>
          </div>
        </div>

        {submissionsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : submissions.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No submissions yet.</CardContent></Card>
        ) : (
          <Card className="border-border/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student?.full_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'graded' ? 'default' : s.status === 'submitted' ? 'secondary' : 'outline'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, h:mm a') : '—'}
                    </TableCell>
                    <TableCell>{s.score != null ? `${s.score}/${gradingAssignment.max_score}` : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={s.status === 'draft'} onClick={() => openSubmission(s)}>
                        {s.status === 'draft' ? 'Not submitted' : 'Review'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <Dialog open={!!activeSubmission} onOpenChange={(o) => !o && setActiveSubmission(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{activeSubmission?.student?.full_name}'s submission</DialogTitle>
              <DialogDescription>{gradingAssignment.title}</DialogDescription>
            </DialogHeader>
            {activeSubmission && (
              <div className="space-y-4">
                <div className="h-64 rounded-lg overflow-hidden border border-border/50">
                  <CodeEditor
                    value={activeSubmission.code}
                    onChange={() => {}}
                    language={toEditorLanguage(gradingAssignment.language)}
                    readOnly
                  />
                </div>

                {activeSubmission.last_run_output && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Student's last run output</Label>
                    <pre className="mt-1 text-xs bg-muted/50 rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap">
                      {activeSubmission.last_run_output}
                    </pre>
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={requestAiGrade} disabled={aiGrading} className="gap-1.5">
                  {aiGrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {aiGrading ? 'Asking AI…' : 'Get AI suggestion'}
                </Button>

                {activeSubmission.ai_feedback && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary mb-1">
                      AI suggested {activeSubmission.ai_suggested_score}/{gradingAssignment.max_score}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{activeSubmission.ai_feedback}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      This is a suggestion only — review the code yourself before finalizing.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
                  <div>
                    <Label>Score</Label>
                    <Input
                      type="number"
                      min={0}
                      max={gradingAssignment.max_score}
                      value={scoreDraft}
                      onChange={(e) => setScoreDraft(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">out of {gradingAssignment.max_score}</p>
                  </div>
                  <div>
                    <Label>Feedback to student</Label>
                    <Textarea value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} rows={4} />
                  </div>
                </div>

                <Button onClick={finalizeGrade} disabled={finalizing} className="w-full">
                  {finalizing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Finalize grade & notify student
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Assignment list / authoring view ─────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Coding Assignments</h3>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Assignment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'New'} Coding Assignment</DialogTitle>
              <DialogDescription>Students will write, run, and submit code from their dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build a simple calculator" />
              </div>
              <div>
                <Label>Description (shown in the assignment list)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Instructions (shown to the student in the workspace)</Label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Language</Label>
                  <Select
                    value={language}
                    onValueChange={(v: string) => {
                      const next = parseCodingLanguage(v);
                      setLanguage(next);
                      if (!editingId) setStarterCode(STARTER_TEMPLATES[next]);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html_css_js">HTML / CSS / JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max score</Label>
                  <Input type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <Label>Starter code</Label>
                <div className="h-48 rounded-lg overflow-hidden border border-border/50 mt-1">
                  <CodeEditor value={starterCode} onChange={setStarterCode} language={toEditorLanguage(language)} />
                </div>
              </div>
              {language === 'python' && (
                <div className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <FlaskConical className="h-4 w-4 text-primary" /> Automated test cases
                      </p>
                      <p className="text-xs text-muted-foreground">
                        The student's program runs against each case (stdin → expected stdout) and is auto-scored.
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setTestCases((p) => [...p, newTestCase()])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add case
                    </Button>
                  </div>
                  {testCases.length === 0 && (
                    <p className="text-xs text-muted-foreground">No test cases — this assignment will be graded manually / by AI only.</p>
                  )}
                  {testCases.map((tc, i) => {
                    const update = (patch: Partial<CodingTestCase>) =>
                      setTestCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
                    return (
                      <div key={tc.id} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Input
                            value={tc.name}
                            onChange={(e) => update({ name: e.target.value })}
                            placeholder="Case name"
                            className="h-8"
                          />
                          <Input
                            type="number"
                            min={1}
                            value={tc.points}
                            onChange={(e) => update({ points: Math.max(1, Number(e.target.value) || 1) })}
                            className="h-8 w-20"
                            title="Points"
                          />
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                            onClick={() => setTestCases((prev) => prev.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Input (stdin)</Label>
                            <Textarea rows={3} value={tc.stdin} onChange={(e) => update({ stdin: e.target.value })} className="font-mono text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Expected output</Label>
                            <Textarea rows={3} value={tc.expected_output} onChange={(e) => update({ expected_output: e.target.value })} className="font-mono text-xs" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Hidden (students see pass/fail only)</p>
                          <Switch checked={tc.hidden} onCheckedChange={(v) => update({ hidden: v })} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <Label>Grading rubric / expected behaviour (used by AI grading — not shown to students)</Label>
                <Textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={3} placeholder="e.g. Function must handle division by zero; UI must update without a page reload..." />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Assign to classes</Label>
                <div className="flex flex-wrap gap-2">
                  {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes available.</p>}
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        selectedClasses.includes(c.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Publish immediately</p>
                  <p className="text-xs text-muted-foreground">Students in the assigned classes can start right away</p>
                </div>
                <Switch checked={published} onCheckedChange={setPublished} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Save changes' : 'Create assignment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {assignments.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No coding assignments yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id} className="border-border/50 bg-background/60 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                  <Code2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <Badge variant="outline" className="text-[10px]">{codingLanguageLabel(a.language)}</Badge>
                    {!a.is_published && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {a.classAssignments.length} class{a.classAssignments.length !== 1 ? 'es' : ''} · {a.max_score} pts
                    {a.due_date && ` · Due ${format(new Date(a.due_date), 'MMM d, h:mm a')}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openGrading(a)} className="gap-1.5 shrink-0">
                  <Users className="h-3.5 w-3.5" /> Submissions
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEdit(a)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
