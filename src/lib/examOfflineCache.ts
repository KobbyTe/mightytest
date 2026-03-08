/**
 * Offline exam cache — stores questions, answers, and progress in localStorage
 * so students don't lose work on network drops or page refreshes.
 */

const CACHE_PREFIX = 'exam_cache_';
const ANSWERS_PREFIX = 'exam_answers_';
const PENDING_SYNC_KEY = 'exam_pending_sync';

interface CachedExamData {
  attemptId: string;
  examId: string;
  exam: any;
  questions: any[];
  startedAt: string;
  cachedAt: number;
}

interface CachedAnswers {
  attemptId: string;
  answers: Record<string, string>;
  currentQuestionIndex: number;
  savedAt: number;
}

interface PendingSync {
  attemptId: string;
  answers: Record<string, string>;
  currentQuestionIndex: number;
  timestamp: number;
}

// --- Exam Data Cache (questions, exam info) ---

export function cacheExamData(attemptId: string, exam: any, questions: any[]): void {
  try {
    const data: CachedExamData = {
      attemptId,
      examId: exam.id,
      exam,
      questions,
      startedAt: new Date().toISOString(),
      cachedAt: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${attemptId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache exam data:', e);
  }
}

export function getCachedExamData(attemptId: string): CachedExamData | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${attemptId}`);
    if (!raw) return null;
    const data: CachedExamData = JSON.parse(raw);
    // Expire after 24 hours
    if (Date.now() - data.cachedAt > 24 * 60 * 60 * 1000) {
      clearExamCache(attemptId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// --- Answers Cache ---

export function cacheAnswers(attemptId: string, answers: Record<string, string>, currentQuestionIndex: number): void {
  try {
    const data: CachedAnswers = {
      attemptId,
      answers,
      currentQuestionIndex,
      savedAt: Date.now(),
    };
    localStorage.setItem(`${ANSWERS_PREFIX}${attemptId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache answers:', e);
  }
}

export function getCachedAnswers(attemptId: string): CachedAnswers | null {
  try {
    const raw = localStorage.getItem(`${ANSWERS_PREFIX}${attemptId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- Pending Sync Queue (for offline answer saves) ---

export function queuePendingSync(attemptId: string, answers: Record<string, string>, currentQuestionIndex: number): void {
  try {
    const pending: PendingSync = {
      attemptId,
      answers,
      currentQuestionIndex,
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));
  } catch (e) {
    console.warn('Failed to queue pending sync:', e);
  }
}

export function getPendingSync(): PendingSync | null {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingSync(): void {
  try {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {}
}

// --- Cleanup ---

export function clearExamCache(attemptId: string): void {
  try {
    localStorage.removeItem(`${CACHE_PREFIX}${attemptId}`);
    localStorage.removeItem(`${ANSWERS_PREFIX}${attemptId}`);
  } catch {}
}

// --- Network status helpers ---

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onNetworkRestore(callback: () => void): () => void {
  const handler = () => {
    if (navigator.onLine) callback();
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
