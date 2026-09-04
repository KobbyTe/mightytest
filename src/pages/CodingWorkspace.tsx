import { parseCodingLanguage, toEditorLanguage, type CodingLanguage } from '@/lib/codingLanguage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeEditor } from '@/components/coding/CodeEditor';
import { HtmlPreview } from '@/components/coding/HtmlPreview';
import { runPython, type RunResult } from '@/lib/pyodideRunner';
import { parseTestCases, type CodingTestCase, type TestRunSummary } from '@/lib/codingTests';
import { runPythonTestCases } from '@/lib/codingTestRunner';
import { toast } from 'sonner';
import { ArrowLeft, Play, Send, Loader2, RotateCcw, CheckCircle2, FlaskConical, XCircle, Lock } from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  language: CodingLanguage;
  starter_code: string;
  max_score: number;
  due_date: string | null;
  test_cases: CodingTestCase[];
}

interface Submission {
  id: string;
  code: string;
  status: 'draft' | 'submitted' | 'graded';
  score: number | null;
  teacher_feedback: string | null;
  submitted_at: string | null;
}

const AUTOSAVE_DELAY_MS = 1500;

export default function CodingWorkspace() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [runToken, setRunToken] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testProgress, setTestProgress] = useState<{ done: number; total: number } | null>(null);
  const [testSummary, setTestSummary] = useState<TestRunSummary | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const isReadOnly = submission?.status === 'submitted' || submission?.status === 'graded';
  const hasTests = assignment?.language === 'python' && (assignment?.test_cases.length ?? 0) > 0;

  useEffect(() => {
    if (authLoading || !profile?.id || !assignmentId) return;
    loadAssignment();
  }, [authLoading, profile?.id, assignmentId]);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const { data: assignmentData, error: aErr } = await supabase
        .from('coding_assignments')
        .select('id, title, description, instructions, language, starter_code, max_score, due_date, test_cases')
        .eq('id', assignmentId)
        .single();

      if (aErr || !assignmentData) {
        toast.error('Assignment not found or not available.');
        navigate('/dashboard/coding');
        return;
      }
      setAssignment({
        ...(assignmentData as unknown as Assignment),
        language: parseCodingLanguage(assignmentData.language),
        test_cases: parseTestCases((assignmentData as { test_cases?: unknown }).test_cases),
      });

      const { data: existing } = await supabase
        .from('coding_submissions')
        .select('id, code, status, score, teacher_feedback, submitted_at')
        .eq('assignment_id', assignmentId)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (existing) {
        setSubmission(existing as Submission);
        setCode(existing.code || assignmentData.starter_code || '');
      } else {
        setCode(assignmentData.starter_code || '');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load assignment.');
    } finally {
      setLoading(false);
    }
  };

  const persistDraft = useCallback(async (nextCode: string) => {
    if (!assignmentId || !profile?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('coding_submissions')
        .upsert(
          {
            assignment_id: assignmentId,
            student_id: profile.id,
            code: nextCode,
            last_run_output: runResult?.output || runResult?.error || null,
            last_run_at: runResult ? new Date().toISOString() : undefined,
          },
          { onConflict: 'assignment_id,student_id' }
        )
        .select('id, code, status, score, teacher_feedback, submitted_at')
        .single();

      if (error) throw error;
      setSubmission(data as Submission);
    } catch (e) {
      console.error('Autosave failed:', e);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, profile?.id, runResult]);

  const handleCodeChange = (value: string) => {
    if (isReadOnly) return;
    setCode(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persistDraft(value), AUTOSAVE_DELAY_MS);
  };

  const handleRun = async () => {
    if (!assignment) return;
    setRunning(true);
    setConsoleLines([]);
    setRunResult(null);
    try {
      if (assignment.language === 'python') {
        const result = await runPython(code);
        setRunResult(result);
      } else {
        // HTML/CSS/JS: the iframe executes on srcdoc reload; console output
        // streams in asynchronously via postMessage, captured separately.
        setRunToken((t) => t + 1);
        setRunResult({ output: '', error: null, timedOut: false });
      }
    } catch (e) {
      setRunResult({ output: '', error: e instanceof Error ? e.message : String(e), timedOut: false });
    } finally {
      setRunning(false);
    }
  };

  const handleRunTests = async () => {
    if (!assignment || assignment.test_cases.length === 0) return;
    setTesting(true);
    setTestSummary(null);
    setTestProgress({ done: 0, total: assignment.test_cases.length });
    try {
      const summary = await runPythonTestCases(
        code,
        assignment.test_cases,
        assignment.max_score,
        (done, total) => setTestProgress({ done, total }),
      );
      setTestSummary(summary);
      toast.success(`${summary.passedCount}/${summary.totalCount} tests passed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not run the tests.');
    } finally {
      setTesting(false);
      setTestProgress(null);
    }
  };

  const handleSubmit = async () => {
    if (!assignmentId || !profile?.id) return;
    if (!code.trim()) {
      toast.error('Write some code before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Always grade against the tests at submit time so the stored score
      // reflects the exact code being submitted.
      let finalSummary = testSummary;
      if (hasTests) {
        finalSummary = await runPythonTestCases(code, assignment!.test_cases, assignment!.max_score);
        setTestSummary(finalSummary);
      }
      const { data, error } = await supabase
        .from('coding_submissions')
        .upsert(
          {
            assignment_id: assignmentId,
            student_id: profile.id,
            code,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            last_run_output: runResult?.output || runResult?.error || null,
            test_results: finalSummary ? JSON.parse(JSON.stringify(finalSummary.results)) : null,
            auto_score: finalSummary ? finalSummary.autoScore : null,
          },
          { onConflict: 'assignment_id,student_id' }
        )
        .select('id, code, status, score, teacher_feedback, submitted_at')
        .single();

      if (error) throw error;
      setSubmission(data as Submission);
      toast.success('Submitted! Your teacher will grade it soon.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (isReadOnly || !assignment) return;
    if (!confirm('Reset your code back to the starter code? This will discard your changes.')) return;
    handleCodeChange(assignment.starter_code || '');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignment) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/dashboard/coding')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{assignment.title}</h1>
              <p className="text-[11px] text-muted-foreground">
                {assignment.language === 'python' ? 'Python' : 'HTML / CSS / JavaScript'} · {assignment.max_score} pts
                {saving && ' · Saving…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {submission?.status === 'graded' && (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                Scored {submission.score}/{assignment.max_score}
              </Badge>
            )}
            {submission?.status === 'submitted' && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Submitted
              </Badge>
            )}
            {!isReadOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset} className="hidden sm:inline-flex">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                </Button>
                <Button size="sm" variant="outline" onClick={handleRun} disabled={running || testing}>
                  {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                  Run
                </Button>
                {hasTests && (
                  <Button size="sm" variant="secondary" onClick={handleRunTests} disabled={testing || running}>
                    {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 mr-1.5" />}
                    {testing && testProgress ? `Testing ${testProgress.done}/${testProgress.total}` : 'Run tests'}
                  </Button>
                )}

                <Button size="sm" onClick={handleSubmit} disabled={submitting} className="bg-primary">
                  {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Submit
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {isReadOnly && submission?.status === 'graded' && (
        <div className="container mx-auto px-4 pt-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-1">Teacher feedback</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {submission.teacher_feedback || 'No written feedback was left.'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col min-h-[400px] lg:min-h-0">
          {assignment.instructions && (
            <Card className="mb-3 border-border/50 bg-muted/30">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{assignment.instructions}</p>
              </CardContent>
            </Card>
          )}
          <div className="flex-1 rounded-lg overflow-hidden border border-border/50 min-h-[300px]">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              language={toEditorLanguage(assignment.language)}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        <div className="flex flex-col min-h-[400px] lg:min-h-0">
          <Tabs defaultValue={hasTests ? 'tests' : 'output'} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-fit mb-3">
              {assignment.language === 'html_css_js' && <TabsTrigger value="preview">Preview</TabsTrigger>}
              <TabsTrigger value="output">Output</TabsTrigger>
              {hasTests && (
                <TabsTrigger value="tests" className="gap-1.5">
                  Tests
                  {testSummary && (
                    <span className={testSummary.passedCount === testSummary.totalCount ? 'text-emerald-600' : 'text-amber-600'}>
                      {testSummary.passedCount}/{testSummary.totalCount}
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {hasTests && (
              <TabsContent value="tests" className="flex-1 min-h-[250px]">
                <Card className="h-full border-border/50">
                  <CardContent className="p-3 h-full overflow-auto space-y-2">
                    {testSummary && (
                      <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                        <p className="text-sm font-medium">
                          {testSummary.passedCount}/{testSummary.totalCount} tests passed
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Auto score {testSummary.autoScore}/{assignment.max_score} — your teacher can still adjust it.
                        </p>
                      </div>
                    )}
                    {!testSummary && (
                      <p className="text-xs text-muted-foreground">
                        This problem is graded against {assignment.test_cases.length} automated test
                        {assignment.test_cases.length === 1 ? '' : 's'}. Click “Run tests” to check your solution.
                      </p>
                    )}
                    {(testSummary?.results ?? assignment.test_cases.map((c) => ({
                      id: c.id, name: c.name, hidden: c.hidden, points: c.points,
                      passed: false, actual_output: '', error: null,
                    }))).map((r) => {
                      const spec = assignment.test_cases.find((c) => c.id === r.id);
                      return (
                        <div key={r.id} className="rounded-lg border border-border/50 p-3">
                          <div className="flex items-center gap-2">
                            {testSummary ? (
                              r.passed
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            ) : (
                              <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            {r.hidden && <Lock className="h-3 w-3 text-muted-foreground" />}
                            <span className="ml-auto text-[11px] text-muted-foreground">{r.points} pt{r.points === 1 ? '' : 's'}</span>
                          </div>
                          {!r.hidden && spec && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[11px] font-mono">
                              <div>
                                <p className="text-muted-foreground font-sans mb-0.5">Input</p>
                                <pre className="bg-muted/50 rounded p-2 whitespace-pre-wrap break-words">{spec.stdin || '(none)'}</pre>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-sans mb-0.5">Expected</p>
                                <pre className="bg-muted/50 rounded p-2 whitespace-pre-wrap break-words">{spec.expected_output || '(empty)'}</pre>
                              </div>
                            </div>
                          )}
                          {testSummary && !r.passed && (
                            <div className="mt-2 text-[11px] font-mono">
                              <p className="text-muted-foreground font-sans mb-0.5">Your output</p>
                              <pre className="bg-destructive/10 rounded p-2 whitespace-pre-wrap break-words">
                                {r.error ? r.error : r.actual_output || '(no output)'}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            )}


            {assignment.language === 'html_css_js' && (
              <TabsContent value="preview" className="flex-1 min-h-[250px]">
                <HtmlPreview
                  code={code}
                  runToken={runToken}
                  onConsoleOutput={(lines) => setConsoleLines((prev) => [...prev, ...lines])}
                />
              </TabsContent>
            )}

            <TabsContent value="output" className="flex-1 min-h-[250px]">
              <Card className="h-full border-border/50">
                <CardContent className="p-3 h-full overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {assignment.language === 'python'
                      ? runResult
                        ? (runResult.error ? `${runResult.output}\n\n${runResult.error}` : runResult.output) || '(no output)'
                        : 'Click "Run" to execute your code.'
                      : consoleLines.length > 0
                        ? consoleLines.join('\n')
                        : 'console.log output will appear here after you Run.'}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
