import { useState, useEffect, useCallback, useRef } from 'react';

interface UseQuestionTimerOptions {
  totalDurationMinutes: number;
  totalQuestions: number;
  currentQuestionIndex: number;
  onQuestionTimeExpired: () => void;
  onExamTimeExpired: () => void;
  enabled: boolean;
}

export function useQuestionTimer({
  totalDurationMinutes,
  totalQuestions,
  currentQuestionIndex,
  onQuestionTimeExpired,
  onExamTimeExpired,
  enabled
}: UseQuestionTimerOptions) {
  const timePerQuestion = Math.floor((totalDurationMinutes * 60) / Math.max(totalQuestions, 1));
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState(timePerQuestion);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(totalDurationMinutes * 60);
  const questionStartRef = useRef(Date.now());

  // Reset question timer when question changes
  useEffect(() => {
    setQuestionTimeRemaining(timePerQuestion);
    questionStartRef.current = Date.now();
  }, [currentQuestionIndex, timePerQuestion]);

  // Question timer
  useEffect(() => {
    if (!enabled || totalQuestions === 0) return;

    const timer = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          // Time expired for this question
          if (currentQuestionIndex < totalQuestions - 1) {
            onQuestionTimeExpired();
          } else {
            // Last question, submit exam
            onExamTimeExpired();
          }
          return timePerQuestion; // Reset for next question
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, currentQuestionIndex, totalQuestions, timePerQuestion, onQuestionTimeExpired, onExamTimeExpired]);

  // Total exam timer
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setTotalTimeRemaining(prev => {
        if (prev <= 1) {
          onExamTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, onExamTimeExpired]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatTotalTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    questionTimeRemaining,
    totalTimeRemaining,
    timePerQuestion,
    formatQuestionTime: formatTime,
    formatTotalTime
  };
}
