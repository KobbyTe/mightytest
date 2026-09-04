import { runPython } from '@/lib/pyodideRunner';
import {
  outputMatches,
  summarizeResults,
  type CodingTestCase,
  type CodingTestResult,
  type TestRunSummary,
} from '@/lib/codingTests';

/**
 * Runs every test case against the student's Python code, one at a time,
 * in the Pyodide worker. Each case gets its own stdin and its stdout is
 * compared with the expected output.
 */
export async function runPythonTestCases(
  code: string,
  cases: CodingTestCase[],
  maxScore: number,
  onProgress?: (done: number, total: number) => void,
): Promise<TestRunSummary> {
  const results: CodingTestResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const run = await runPython(code, c.stdin);
    results.push({
      id: c.id,
      name: c.name,
      hidden: c.hidden,
      points: c.points,
      passed: !run.error && outputMatches(run.output, c.expected_output),
      actual_output: run.output,
      error: run.error,
    });
    onProgress?.(i + 1, cases.length);
  }

  return summarizeResults(results, maxScore);
}
