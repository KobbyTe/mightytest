/** Pure helpers for coding-submission grading, shared by UI and tests. */

export type CodingSubmissionStatus = 'draft' | 'submitted' | 'graded';

export interface GradeUpdatePayload {
  score: number;
  teacher_feedback: string | null;
  status: 'graded';
  graded_by: string | null;
  graded_at: string;
}

export function clampScore(raw: unknown, maxScore: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(maxScore, Math.round(n)));
}

export function isValidScore(raw: unknown, maxScore: number): boolean {
  const n = Number(raw);
  return raw !== '' && raw !== null && Number.isFinite(n) && n >= 0 && n <= maxScore;
}

/**
 * Build the update that finalizes a grade. Setting `status: 'graded'` is what
 * fires the `notify_on_coding_graded` trigger, so it must always be present.
 */
export function buildGradeUpdate(params: {
  score: unknown;
  maxScore: number;
  feedback: string;
  gradedBy: string | null;
  now?: Date;
}): GradeUpdatePayload {
  return {
    score: clampScore(params.score, params.maxScore),
    teacher_feedback: params.feedback.trim() || null,
    status: 'graded',
    graded_by: params.gradedBy,
    graded_at: (params.now ?? new Date()).toISOString(),
  };
}

export function parseSubmissionStatus(value: unknown): CodingSubmissionStatus {
  return value === 'submitted' || value === 'graded' ? value : 'draft';
}
