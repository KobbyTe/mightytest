import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseExamAutoSubmitOptions {
  attemptId: string | null;
  answers: Record<string, string>;
  questions: Array<{
    id: string;
    question_type: string;
    correct_answer: string | null;
    marks: number;
  }>;
  onSubmit: () => void;
  enabled: boolean;
}

export function useExamAutoSubmit({
  attemptId,
  answers,
  questions,
  onSubmit,
  enabled
}: UseExamAutoSubmitOptions) {
  const navigate = useNavigate();
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);

  // Keep refs updated
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const autoSubmitExam = useCallback(async (reason: 'tab_switch' | 'page_exit' | 'route_change' | 'refresh') => {
    if (!attemptId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const currentAnswers = answersRef.current;
      const currentQuestions = questionsRef.current;

      // Prepare answers
      const answersToSave = Object.entries(currentAnswers).map(([question_id, answer_text]) => ({
        attempt_id: attemptId,
        question_id,
        answer_text
      }));

      // Delete existing and insert new
      await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);

      // Auto-grade
      let totalMarks = 0;
      let hasEssay = false;
      const gradedAnswers = answersToSave.map(answer => {
        const question = currentQuestions.find(q => q.id === answer.question_id);
        if (!question) return answer;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
          const isCorrect = answer.answer_text?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
          const marks = isCorrect ? question.marks : 0;
          totalMarks += marks;
          return { ...answer, is_correct: isCorrect, marks_awarded: marks };
        } else if (question.question_type === 'essay') {
          hasEssay = true;
          return { ...answer, is_correct: null, marks_awarded: null };
        }
        return answer;
      });

      if (gradedAnswers.length > 0) {
        await supabase.from('exam_answers').insert(gradedAnswers);
      }

      // Update attempt
      const submissionReasons = {
        tab_switch: 'auto_submitted',
        page_exit: 'auto_submitted',
        route_change: 'auto_submitted',
        refresh: 'auto_submitted'
      };

      await supabase
        .from('exam_attempts')
        .update({
          status: hasEssay ? 'completed' : 'graded',
          completed_at: new Date().toISOString(),
          submission_type: submissionReasons[reason],
          marks_obtained: hasEssay ? null : totalMarks,
          graded_at: hasEssay ? null : new Date().toISOString()
        })
        .eq('id', attemptId);

      // Send notification
      try {
        await supabase.functions.invoke('send-grade-notification', {
          body: { attemptId, notifyParent: true }
        });
      } catch (e) {
        console.error('Notification failed:', e);
      }

      toast.warning(`Exam auto-submitted due to ${reason.replace('_', ' ')}`);
    } catch (error) {
      console.error('Auto-submit error:', error);
    }
  }, [attemptId]);

  // Real-time answer saving
  useEffect(() => {
    if (!attemptId || !enabled) return;

    const saveDebounced = setTimeout(async () => {
      try {
        await supabase
          .from('exam_attempts')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', attemptId);
      } catch (e) {
        console.error('Failed to update activity:', e);
      }
    }, 2000);

    return () => clearTimeout(saveDebounced);
  }, [answers, attemptId, enabled]);

  // Tab visibility detection
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        autoSubmitExam('tab_switch');
        navigate('/dashboard');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, autoSubmitExam, navigate]);

  // Beforeunload (page close/refresh)
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Attempt to save (sync is not reliable here, but we try)
      autoSubmitExam('page_exit');
      e.preventDefault();
      e.returnValue = 'Your exam will be auto-submitted if you leave.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, autoSubmitExam]);

  return { autoSubmitExam, isSubmitting: isSubmittingRef.current };
}
