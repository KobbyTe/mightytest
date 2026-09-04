/**
 * Test-case model for coding assignments.
 *
 * A "real problem" is a spec plus a set of input/expected-output cases the
 * student's program must satisfy. Cases run in-browser (Pyodide) against
 * stdin/stdout, and produce a deterministic auto-score.
 */

export interface CodingTestCase {
  id: string;
  name: string;
  /** Text piped to the program's stdin. */
  stdin: string;
  /** Exact expected stdout (compared after trimming trailing whitespace per line). */
  expected_output: string;
  /** Hidden cases run but never reveal their input/expected output to students. */
  hidden: boolean;
  /** Relative weight of this case. */
  points: number;
}

export interface CodingTestResult {
  id: string;
  name: string;
  hidden: boolean;
  points: number;
  passed: boolean;
  actual_output: string;
  error: string | null;
}

export interface TestRunSummary {
  results: CodingTestResult[];
  passedCount: number;
  totalCount: number;
  earnedPoints: number;
  totalPoints: number;
  /** Score scaled onto the assignment's max_score, rounded to the nearest point. */
  autoScore: number;
}

export function newTestCase(): CodingTestCase {
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? `tc-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    name: 'New case',
    stdin: '',
    expected_output: '',
    hidden: false,
    points: 1,
  };
}

/** Normalizes output so trailing spaces / CRLF / a trailing newline never fail a correct answer. */
export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function outputMatches(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

/** Parses an untrusted jsonb value from the database into test cases. */
export function parseTestCases(value: unknown): CodingTestCase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    const points = Number(r.points);
    return [{
      id: typeof r.id === 'string' && r.id ? r.id : `tc-${index}`,
      name: typeof r.name === 'string' && r.name.trim() ? r.name : `Case ${index + 1}`,
      stdin: typeof r.stdin === 'string' ? r.stdin : '',
      expected_output: typeof r.expected_output === 'string' ? r.expected_output : '',
      hidden: r.hidden === true,
      points: Number.isFinite(points) && points > 0 ? points : 1,
    }];
  });
}

/** Aggregates individual case results into a summary + auto score. */
export function summarizeResults(results: CodingTestResult[], maxScore: number): TestRunSummary {
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const earnedPoints = results.reduce((sum, r) => sum + (r.passed ? r.points : 0), 0);
  const autoScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * maxScore) : 0;
  return {
    results,
    passedCount: results.filter((r) => r.passed).length,
    totalCount: results.length,
    earnedPoints,
    totalPoints,
    autoScore: Math.max(0, Math.min(maxScore, autoScore)),
  };
}
