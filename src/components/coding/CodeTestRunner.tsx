import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Send, CheckCircle, XCircle, Loader2, Terminal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CodeEditor from './CodeEditor';
import HtmlPreview from './HtmlPreview';

interface TestCase {
  input: string;
  expected_output: string;
  label: string;
}

interface TestResult {
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
}

interface CodingOptions {
  language: string;
  starter_code: string;
  test_cases: TestCase[];
  time_limit_seconds: number;
}

interface CodeTestRunnerProps {
  questionId: string;
  attemptId: string;
  questionText: string;
  options: CodingOptions;
  marks: number;
  existingCode?: string;
  submitted?: boolean;
  onSubmit: (code: string, passed: boolean, marksAwarded: number) => void;
}

export default function CodeTestRunner({
  questionId,
  attemptId,
  questionText,
  options,
  marks,
  existingCode,
  submitted = false,
  onSubmit,
}: CodeTestRunnerProps) {
  const [code, setCode] = useState(existingCode || options.starter_code || '');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const executeCode = async (isSubmission: boolean) => {
    if (isSubmission) setSubmitting(true);
    else setRunning(true);

    try {
      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: {
          code,
          language: options.language,
          test_cases: options.language !== 'html' ? options.test_cases : [],
          time_limit_seconds: options.time_limit_seconds || 10,
        },
      });

      if (error) throw error;

      setStdout(data.stdout || '');
      setStderr(data.stderr || '');
      setTestResults(data.test_results || []);
      setHasRun(true);

      if (isSubmission) {
        const allPassed = data.all_passed ?? false;
        const passedCount = (data.test_results || []).filter((r: TestResult) => r.passed).length;
        const totalTests = (data.test_results || []).length;
        const marksAwarded = totalTests > 0 ? Math.round((passedCount / totalTests) * marks) : (allPassed ? marks : 0);

        // Save code submission
        await supabase.from('code_submissions').insert({
          attempt_id: attemptId,
          question_id: questionId,
          language: options.language,
          code,
          stdout: data.stdout || '',
          stderr: data.stderr || '',
          execution_time_ms: data.execution_time_ms || 0,
          test_results: data.test_results || [],
          passed: allPassed,
        });

        onSubmit(code, allPassed, marksAwarded);
        toast.success(allPassed ? '✅ All test cases passed!' : `Submitted: ${passedCount}/${totalTests} tests passed`);
      }
    } catch (err) {
      console.error('Code execution error:', err);
      toast.error('Failed to execute code. Please try again.');
    } finally {
      setRunning(false);
      setSubmitting(false);
    }
  };

  const allPassed = testResults.length > 0 && testResults.every((r) => r.passed);

  return (
    <div className="space-y-4">
      {/* Task Description */}
      <div className="bg-muted/50 rounded-xl p-4 border">
        <p className="text-sm font-medium text-muted-foreground mb-1">Task</p>
        <p className="text-base">{questionText}</p>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">{options.language}</Badge>
          <Badge variant="secondary">{marks} marks</Badge>
        </div>
      </div>

      {/* Code Editor */}
      <CodeEditor
        value={code}
        onChange={submitted ? undefined : setCode}
        language={options.language}
        readOnly={submitted}
        height="350px"
      />

      {/* HTML Preview */}
      {options.language === 'html' && <HtmlPreview code={code} />}

      {/* Action Buttons */}
      {!submitted && (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => executeCode(false)}
            disabled={running || submitting}
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run Code
          </Button>
          <Button
            type="button"
            onClick={() => executeCode(true)}
            disabled={running || submitting}
            className="bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--fun-teal))]"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Code
          </Button>
        </div>
      )}

      {/* Output Panel */}
      {hasRun && (
        <Card className="border-border">
          <CardContent className="pt-4 space-y-3">
            {/* stdout */}
            {stdout && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Output</span>
                </div>
                <pre className="bg-background rounded-lg p-3 text-sm font-mono overflow-x-auto border max-h-40 overflow-y-auto">
                  {stdout}
                </pre>
              </div>
            )}

            {/* stderr */}
            {stderr && (
              <div>
                <span className="text-sm font-medium text-destructive">Errors</span>
                <pre className="bg-destructive/10 rounded-lg p-3 text-sm font-mono text-destructive overflow-x-auto border border-destructive/20 max-h-40 overflow-y-auto">
                  {stderr}
                </pre>
              </div>
            )}

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Test Results</span>
                  <Badge variant={allPassed ? 'default' : 'destructive'}>
                    {testResults.filter((r) => r.passed).length}/{testResults.length} passed
                  </Badge>
                </div>
                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                      result.passed ? 'bg-[hsl(var(--success))]/10' : 'bg-destructive/10'
                    }`}
                  >
                    {result.passed ? (
                      <CheckCircle className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="font-medium">{result.label}</span>
                    {!result.passed && (
                      <span className="text-muted-foreground ml-auto text-xs">
                        Expected: "{result.expected}" Got: "{result.actual}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
