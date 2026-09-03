import { describe, it, expect } from 'vitest';
import {
  buildGradeUpdate,
  clampScore,
  isValidScore,
  parseSubmissionStatus,
} from '../codingGrading';

describe('clampScore', () => {
  it('clamps into [0, maxScore] and rounds', () => {
    expect(clampScore(150, 100)).toBe(100);
    expect(clampScore(-5, 100)).toBe(0);
    expect(clampScore('39.6', 40)).toBe(40);
    expect(clampScore('abc', 40)).toBe(0);
    expect(clampScore(48, 40)).toBe(40);
  });
});

describe('isValidScore', () => {
  it('rejects empty and out-of-range input', () => {
    expect(isValidScore('', 40)).toBe(false);
    expect(isValidScore('41', 40)).toBe(false);
    expect(isValidScore('-1', 40)).toBe(false);
    expect(isValidScore('abc', 40)).toBe(false);
    expect(isValidScore('40', 40)).toBe(true);
    expect(isValidScore(0, 40)).toBe(true);
  });
});

describe('buildGradeUpdate', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('always sets status graded so the notification trigger fires', () => {
    const payload = buildGradeUpdate({
      score: '35',
      maxScore: 40,
      feedback: '  Nice work  ',
      gradedBy: 'teacher-1',
      now,
    });
    expect(payload).toEqual({
      score: 35,
      teacher_feedback: 'Nice work',
      status: 'graded',
      graded_by: 'teacher-1',
      graded_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('never writes a score above max_score', () => {
    expect(buildGradeUpdate({ score: 999, maxScore: 40, feedback: '', gradedBy: null, now }).score).toBe(40);
  });

  it('nulls blank feedback', () => {
    expect(
      buildGradeUpdate({ score: 1, maxScore: 40, feedback: '   ', gradedBy: null, now }).teacher_feedback,
    ).toBeNull();
  });
});

describe('parseSubmissionStatus', () => {
  it('defaults unknown statuses to draft', () => {
    expect(parseSubmissionStatus('graded')).toBe('graded');
    expect(parseSubmissionStatus('submitted')).toBe('submitted');
    expect(parseSubmissionStatus('weird')).toBe('draft');
    expect(parseSubmissionStatus(null)).toBe('draft');
  });
});
