import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle, Send, Sparkles, Trophy, Brain, ChevronLeft, ChevronRight, Timer, AlertTriangle, Star, ArrowRight, Award, WifiOff, Wifi, Volume2, VolumeX, Square } from 'lucide-react';
import { useReadingAssistant, type SpeechSpeed } from '@/hooks/useReadingAssistant';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  cacheExamData,
  getCachedExamData,
  cacheAnswers,
  getCachedAnswers,
  queuePendingSync,
  getPendingSync,
  clearPendingSync,
  clearExamCache,
  isOnline,
  onNetworkRestore,
} from '@/lib/examOfflineCache';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answer: string | null;
  marks: number;
  order_number: number;
}

export default function ExamTaking() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attempt');
  
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState<number>(0);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
  const readingAssistant = useReadingAssistant();

  // Load saved voice preference on mount (voice is auto-restored by the hook via localStorage)
  const [resultData, setResultData] = useState<{
    marks: number;
    totalMarks: number;
    passingMarks: number;
    passed: boolean;
    hasEssay: boolean;
    examTitle: string;
  } | null>(null);
  
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);

  // Keep refs updated for async operations
  useEffect(() => {
    answersRef.current = answers;
    // Also cache answers locally on every change
    if (attemptId && examStarted) {
      cacheAnswers(attemptId, answers, currentQuestionIndex);
    }
  }, [answers, attemptId, examStarted, currentQuestionIndex]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setNetworkOnline(true);
      toast.success('Connection restored — syncing your answers…', { icon: <Wifi className="h-4 w-4" /> });
      syncPendingAnswers();
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      toast.warning('You\'re offline — answers are saved locally', { icon: <WifiOff className="h-4 w-4" />, duration: 5000 });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending answers when back online
  const syncPendingAnswers = useCallback(async () => {
    const pending = getPendingSync();
    if (!pending) return;
    try {
      const answersToSave = Object.entries(pending.answers).map(([question_id, answer_text]) => ({
        attempt_id: pending.attemptId,
        question_id,
        answer_text,
      }));
      if (answersToSave.length > 0) {
        await supabase.from('exam_answers').upsert(answersToSave, { onConflict: 'attempt_id,question_id' });
      }
      await supabase
        .from('exam_attempts')
        .update({ last_activity_at: new Date().toISOString(), current_question_index: pending.currentQuestionIndex })
        .eq('id', pending.attemptId);
      clearPendingSync();
    } catch (e) {
      console.error('Failed to sync pending answers:', e);
    }
  }, []);

  // Calculate time per question
  const timePerQuestion = exam?.duration_minutes && questions.length > 0 
    ? Math.floor((exam.duration_minutes * 60) / questions.length)
    : 60;

  // Shared grading and submission helper
  const gradeAndSubmitExam = useCallback(async (
    submissionType: string,
    currentAnswers: Record<string, string>,
    currentQuestions: Question[]
  ) => {
    const answersToSave = Object.entries(currentAnswers).map(([question_id, answer_text]) => ({
      attempt_id: attemptId!,
      question_id,
      answer_text
    }));

    let rawSum = 0;
    let hasEssay = false;
    const gradedAnswers = answersToSave.map(answer => {
      const question = currentQuestions.find(q => q.id === answer.question_id);
      if (!question) return answer;

      if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        const isCorrect = answer.answer_text?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
        const marks = isCorrect ? question.marks : 0;
        rawSum += marks;
        return { ...answer, is_correct: isCorrect, marks_awarded: marks };
      } else if (question.question_type === 'essay') {
        hasEssay = true;
        return { ...answer, is_correct: null, marks_awarded: null };
      }
      return answer;
    });

    if (gradedAnswers.length > 0) {
      await supabase.from('exam_answers').upsert(gradedAnswers, { onConflict: 'attempt_id,question_id' });
    }

    // Normalize to the exam's declared total_marks so score never exceeds the announced max.
    const examTotal = exam?.total_marks ?? 0;
    const questionTotal = currentQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const normalized = (questionTotal > 0 && examTotal > 0)
      ? Math.round((rawSum / questionTotal) * examTotal)
      : rawSum;
    const totalMarks = Math.min(examTotal || normalized, Math.max(0, normalized));

    const updateData: any = {
      status: hasEssay ? 'completed' : 'graded',
      completed_at: new Date().toISOString(),
      submission_type: submissionType,
      marks_obtained: hasEssay ? null : totalMarks,
      graded_at: hasEssay ? null : new Date().toISOString(),
      current_question_index: currentQuestionIndex
    };

    await supabase
      .from('exam_attempts')
      .update(updateData)
      .eq('id', attemptId);

    try {
      await supabase.functions.invoke('send-grade-notification', {
        body: { attemptId, notifyParent: true }
      });
    } catch (e) {
      console.error('Notification failed:', e);
    }

    return { totalMarks, hasEssay };
  }, [attemptId, currentQuestionIndex, exam]);

  // Auto-submit function
  const autoSubmitExam = useCallback(async (reason: 'tab_switch' | 'page_exit' | 'route_change' | 'time_expired') => {
    if (!attemptId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const submissionType = reason === 'time_expired' ? 'time_expired' : 'auto_submitted';
      await gradeAndSubmitExam(submissionType, answersRef.current, questionsRef.current);

      const reasonMessages: Record<string, string> = {
        tab_switch: 'You switched tabs or windows',
        page_exit: 'You attempted to leave the page',
        route_change: 'You tried to navigate away',
        time_expired: 'Time ran out'
      };

      toast.warning(`Exam Auto-Submitted: ${reasonMessages[reason]}`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Auto-submit error:', error);
      isSubmittingRef.current = false;
    }
  }, [attemptId, gradeAndSubmitExam, navigate]);

  // NOTE: `useBlocker` requires a Data Router (createBrowserRouter).
  // This app uses <BrowserRouter>, so attempting to call `useBlocker` throws at runtime.
  // We keep the existing tab-switch + beforeunload protections which are router-agnostic.

  // Tab visibility detection — 3-strike system with grace period to avoid
  // false positives from notification shade pulls, screen lock, etc.
  const tabSwitchStrikesRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!examStarted) return;

    const MAX_STRIKES = 3;
    const GRACE_MS = 1500;

    const handleVisibilityChange = () => {
      if (isSubmittingRef.current) return;
      if (document.hidden) {
        // Only count as a strike if the tab stays hidden past the grace period.
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          tabSwitchStrikesRef.current += 1;
          const strikes = tabSwitchStrikesRef.current;
          if (strikes >= MAX_STRIKES) {
            toast.error('Exam auto-submitted: too many tab switches.');
            autoSubmitExam('tab_switch');
          } else {
            toast.warning(
              `Don't leave the exam tab. Strike ${strikes} of ${MAX_STRIKES}.`
            );
          }
        }, GRACE_MS);
      } else if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [examStarted, autoSubmitExam]);

  // Beforeunload — only show the native confirmation prompt; do NOT submit here.
  // Answers are already cached locally + persisted via the debounced saver,
  // so the student can safely refresh or accidentally hit back.
  useEffect(() => {
    if (!examStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmittingRef.current) return;
      e.preventDefault();
      e.returnValue = 'Your exam progress is saved. Leave anyway?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examStarted]);

  // Load exam data
  useEffect(() => {
    if (authLoading) return;
    if (!user || !attemptId) {
      navigate('/dashboard');
      return;
    }
    loadExamData();
  }, [user, authLoading, attemptId, navigate]);

  // Total exam timer
  useEffect(() => {
    if (!examStarted || totalTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTotalTimeRemaining(prev => {
        if (prev <= 1) {
          autoSubmitExam('time_expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, totalTimeRemaining, autoSubmitExam]);

  // Per-question timer — only advances; the global timer enforces the deadline.
  useEffect(() => {
    if (!examStarted || questions.length === 0) return;

    const timer = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(curr => curr + 1);
            return timePerQuestion;
          }
          // Last question: stop ticking, let global timer / manual submit handle it.
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, currentQuestionIndex, questions.length, timePerQuestion]);

  // Reset question timer when question changes
  useEffect(() => {
    if (examStarted) {
      setQuestionTimeRemaining(timePerQuestion);
    }
  }, [currentQuestionIndex, timePerQuestion, examStarted]);

  // Real-time answer saving (with offline fallback)
  useEffect(() => {
    if (!attemptId || !examStarted || Object.keys(answers).length === 0) return;

    const saveDebounced = setTimeout(async () => {
      // Always cache locally first
      cacheAnswers(attemptId, answers, currentQuestionIndex);

      if (!isOnline()) {
        // Queue for sync when back online
        queuePendingSync(attemptId, answers, currentQuestionIndex);
        return;
      }

      try {
        const answersToSave = Object.entries(answers).map(([question_id, answer_text]) => ({
          attempt_id: attemptId,
          question_id,
          answer_text
        }));

        if (answersToSave.length > 0) {
          await supabase.from('exam_answers').upsert(answersToSave, { onConflict: 'attempt_id,question_id' });
        }

        await supabase
          .from('exam_attempts')
          .update({ 
            last_activity_at: new Date().toISOString(),
            current_question_index: currentQuestionIndex
          })
          .eq('id', attemptId);
        
        // Clear pending sync since we just saved successfully
        clearPendingSync();
      } catch (e) {
        console.error('Failed to save answers to server, queuing for later:', e);
        queuePendingSync(attemptId, answers, currentQuestionIndex);
      }
    }, 1500);

    return () => clearTimeout(saveDebounced);
  }, [answers, attemptId, examStarted, currentQuestionIndex]);

  const loadExamData = async () => {
    try {
      let attemptData = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!attemptData && retryCount < maxRetries) {
        const { data, error: attemptError } = await supabase
          .from('exam_attempts')
          .select('*, exams(*)')
          .eq('id', attemptId)
          .single();

        if (attemptError) {
          retryCount++;
          console.error(`Attempt load error (retry ${retryCount}/${maxRetries}):`, attemptError);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          // Fall back to cached data if offline
          const cached = getCachedExamData(attemptId!);
          if (cached) {
            toast.info('Loaded exam from offline cache', { icon: <WifiOff className="h-4 w-4" /> });
            setExam(cached.exam);
            setQuestions(cached.questions);
            const cachedAns = getCachedAnswers(attemptId!);
            if (cachedAns) {
              setAnswers(cachedAns.answers);
              setCurrentQuestionIndex(cachedAns.currentQuestionIndex);
            }
            const durationSeconds = (cached.exam.duration_minutes || 60) * 60;
            setTotalTimeRemaining(durationSeconds);
            const tpq = Math.floor(durationSeconds / cached.questions.length);
            setQuestionTimeRemaining(tpq);
            setExamStarted(true);
            setLoading(false);
            return;
          }
          throw new Error('Unable to load exam. Please try again.');
        }

        attemptData = data;
      }

      if (!attemptData) {
        throw new Error('Exam attempt not found');
      }

      if (attemptData.status === 'completed' || attemptData.status === 'graded') {
        clearExamCache(attemptId!);
        toast.error('This exam has already been completed');
        navigate('/dashboard');
        return;
      }

      setExam(attemptData.exams);
      
      // Calculate remaining time based on started_at
      const durationSeconds = (attemptData.exams.duration_minutes || 60) * 60;
      if (attemptData.started_at) {
        const elapsed = Math.floor((Date.now() - new Date(attemptData.started_at).getTime()) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsed);
        if (remaining <= 0) {
          clearExamCache(attemptId!);
          toast.warning('Time has expired for this exam');
          setTotalTimeRemaining(0);
          setExamStarted(true);
          setLoading(false);
          autoSubmitExam('time_expired');
          return;
        }
        setTotalTimeRemaining(remaining);
      } else {
        setTotalTimeRemaining(durationSeconds);
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', attemptData.exam_id)
        .order('order_number');

      if (questionsError) throw questionsError;
      
      if (!questionsData || questionsData.length === 0) {
        toast.error('This exam has no questions yet. Please contact your teacher.');
        navigate('/dashboard');
        return;
      }
      
      setQuestions(questionsData);

      // Cache exam data for offline use
      cacheExamData(attemptId!, attemptData.exams, questionsData);

      // Initialize question timer
      const tpq = Math.floor(((attemptData.exams.duration_minutes || 60) * 60) / questionsData.length);
      setQuestionTimeRemaining(tpq);

      // Restore answers: prefer server data, fall back to local cache
      const { data: existingAnswers } = await supabase
        .from('exam_answers')
        .select('*')
        .eq('attempt_id', attemptId);

      if (existingAnswers && existingAnswers.length > 0) {
        const answersMap: Record<string, string> = {};
        existingAnswers.forEach(ans => {
          answersMap[ans.question_id] = ans.answer_text || '';
        });
        setAnswers(answersMap);
      } else {
        // Check localStorage for cached answers
        const cachedAns = getCachedAnswers(attemptId!);
        if (cachedAns && Object.keys(cachedAns.answers).length > 0) {
          setAnswers(cachedAns.answers);
          toast.info('Restored answers from local cache');
        }
      }

      // Restore current question index
      if (attemptData.current_question_index) {
        setCurrentQuestionIndex(attemptData.current_question_index);
      }

      // Only set started_at if not already set
      if (!attemptData.started_at) {
        await supabase
          .from('exam_attempts')
          .update({ started_at: new Date().toISOString() })
          .eq('id', attemptId);
      }

      // Sync any pending offline answers
      syncPendingAnswers();

      setExamStarted(true);
    } catch (error: any) {
      console.error('Error loading exam:', error);
      toast.error(error.message || 'Failed to load exam');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleManualSubmit = async () => {
    if (submitting) return;
    
    if (!exam) {
      toast.error('Exam data not available. Please try again.');
      return;
    }
    
    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const { totalMarks, hasEssay } = await gradeAndSubmitExam('manual', answers, questions);

      setResultData({
        marks: totalMarks,
        totalMarks: exam.total_marks || 0,
        passingMarks: exam.passing_marks || 0,
        passed: !hasEssay && totalMarks >= (exam.passing_marks || 0),
        hasEssay,
        examTitle: exam.title || 'Exam',
      });
      setShowResults(true);
      // Clear offline cache on successful submission
      clearExamCache(attemptId!);
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Failed to submit exam');
      isSubmittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatQuestionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length;
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  if (showResults && resultData) {
    const percentage = resultData.totalMarks > 0 ? Math.round((resultData.marks / resultData.totalMarks) * 100) : 0;
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center space-y-8">
          {/* Celebration Icon */}
          <div className="relative inline-block">
            <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center ${
              resultData.hasEssay
                ? 'bg-secondary/20 border-4 border-secondary/40'
                : resultData.passed
                ? 'bg-[hsl(var(--success))]/20 border-4 border-[hsl(var(--success))]/40'
                : 'bg-secondary/20 border-4 border-secondary/40'
            }`}>
              {resultData.hasEssay ? (
                <Clock className="h-16 w-16 text-secondary" />
              ) : resultData.passed ? (
                <Trophy className="h-16 w-16 text-[hsl(var(--success))]" />
              ) : (
                <Star className="h-16 w-16 text-secondary" />
              )}
            </div>
            {resultData.passed && !resultData.hasEssay && (
              <>
                <Sparkles className="absolute -top-2 -left-2 h-8 w-8 text-secondary animate-pulse" />
                <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-primary animate-pulse delay-150" />
                <Award className="absolute -bottom-2 -right-4 h-8 w-8 text-[hsl(var(--success))] animate-bounce" />
              </>
            )}
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {resultData.hasEssay
                ? 'Exam Submitted! 📝'
                : resultData.passed
                ? 'Amazing Work! 🎉'
                : 'Keep Going! 💪'}
            </h1>
            <p className="text-muted-foreground text-lg">{resultData.examTitle}</p>
          </div>

          {/* Score Display */}
          {resultData.hasEssay ? (
            <Card className="border-secondary/30">
              <CardContent className="py-8">
                <p className="text-lg text-muted-foreground">
                  Your exam contains essay questions that require manual grading.
                </p>
                <p className="text-muted-foreground mt-2">
                  Your score will be available once your instructor reviews your answers.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className={`border-2 ${resultData.passed ? 'border-[hsl(var(--success))]/30' : 'border-secondary/30'}`}>
              <CardContent className="py-8 space-y-4">
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {resultData.marks}/{resultData.totalMarks}
                </div>
                <div className="text-2xl font-semibold text-muted-foreground">
                  {percentage}%
                </div>
                <Badge 
                  variant={resultData.passed ? 'default' : 'secondary'}
                  className={`text-sm px-4 py-1 ${resultData.passed ? 'bg-[hsl(var(--success))] text-white' : ''}`}
                >
                  {resultData.passed ? '✓ PASSED' : 'NOT YET PASSED'}
                </Badge>
                <p className="text-muted-foreground mt-4">
                  {resultData.passed
                    ? 'Fantastic job! You crushed it! Keep up the great work! 🌟'
                    : `You need ${resultData.passingMarks} marks to pass. Don't give up — practice makes perfect! 🚀`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Return Button */}
          <Button
            size="lg"
            onClick={() => navigate('/dashboard')}
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg px-8 py-6"
          >
            Return to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/30 rounded-full animate-spin border-t-primary" />
            <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-lg font-medium text-muted-foreground animate-pulse">Loading your exam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Warning Banner */}
      <div className="bg-destructive/10 border-b border-destructive/30 py-2 px-4">
        <div className="container mx-auto flex items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Warning: Switching tabs, refreshing, or leaving this page will auto-submit your exam!</span>
        </div>
      </div>

      {/* Fixed Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{exam?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Question <span className="text-primary font-medium">{currentQuestionIndex + 1}</span> of {questions.length} 
                  • <span className="text-primary font-medium">{answeredCount}</span> answered
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Reading Assistant Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={readingAssistant.toggle}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    readingAssistant.enabled
                      ? 'bg-accent/20 text-accent border-accent/50'
                      : 'bg-muted text-muted-foreground border-muted hover:bg-muted/80'
                  }`}
                  title={readingAssistant.enabled ? 'Disable Reading Assistant' : 'Enable Reading Assistant'}
                >
                  {readingAssistant.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  <span className="hidden sm:inline">Reading Assistant</span>
                </button>
                {readingAssistant.enabled && (
                  <div className="flex items-center bg-muted/60 rounded-lg border border-border/50 overflow-hidden">
                    {(['slow', 'normal', 'fast'] as SpeechSpeed[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => readingAssistant.setSpeed(s)}
                        className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                          readingAssistant.speed === s
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={`${s} speed`}
                      >
                        {s === 'slow' ? '0.5×' : s === 'normal' ? '1×' : '1.5×'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Network Status */}
              {!networkOnline && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary/20 text-secondary border border-secondary/50 animate-pulse">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs font-semibold">Offline</span>
                </div>
              )}
              {/* Question Timer */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl font-mono ${
                questionTimeRemaining < 10 
                  ? 'bg-destructive/20 text-destructive border border-destructive/50 animate-pulse' 
                  : questionTimeRemaining < 30
                  ? 'bg-secondary/20 text-secondary border border-secondary/50'
                  : 'bg-muted text-muted-foreground border border-muted'
              }`}>
                <Timer className="h-4 w-4" />
                <span className="font-semibold">{formatQuestionTime(questionTimeRemaining)}</span>
                <span className="text-xs opacity-70">/ question</span>
              </div>

              {/* Total Timer */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono ${
                totalTimeRemaining < 300 
                  ? 'bg-destructive/10 text-destructive border border-destructive/30 animate-pulse' 
                  : totalTimeRemaining < 600
                  ? 'bg-secondary/10 text-secondary border border-secondary/30'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                <Clock className="h-5 w-5" />
                <span className="font-bold text-lg">{formatTotalTime(totalTimeRemaining)}</span>
              </div>

              <Button 
                onClick={handleManualSubmit} 
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--fun-teal))] hover:opacity-90 shadow-success"
              >
                {submitting ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Exam
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Question Progress</span>
              <span className="font-medium">{currentQuestionIndex + 1} / {questions.length}</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Question Navigation Dots */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id]?.trim();
              const isCurrent = idx === currentQuestionIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : isAnswered
                      ? 'bg-[hsl(var(--success))] text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {currentQuestion && (
            <Card className="hover-lift overflow-hidden">
              <div className={`h-2 ${answers[currentQuestion.id]?.trim() ? 'bg-[hsl(var(--success))]' : 'bg-primary'}`} />
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                      answers[currentQuestion.id]?.trim() 
                        ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      {answers[currentQuestion.id]?.trim() ? <CheckCircle className="h-6 w-6" /> : currentQuestionIndex + 1}
                    </div>
                    <div>
                      <CardTitle className="text-xl leading-relaxed">
                        {currentQuestion.question_text}
                      </CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {currentQuestion.question_type === 'multiple_choice' ? 'Multiple Choice' : 
                           currentQuestion.question_type === 'true_false' ? 'True/False' : 
                           'Essay'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    <Trophy className="h-3 w-3 mr-1" />
                    {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Reading Assistant - Read Aloud Button */}
                {readingAssistant.enabled && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-accent/40 text-accent hover:bg-accent/10"
                      onClick={() => {
                        if (readingAssistant.isSpeaking) {
                          readingAssistant.stop();
                        } else {
                          let text = `Question ${currentQuestionIndex + 1}. ${currentQuestion.question_text}`;
                          if (currentQuestion.question_type === 'multiple_choice' && Array.isArray(currentQuestion.options)) {
                            text += '. Options: ' + currentQuestion.options.map((opt: string, i: number) => `Option ${i + 1}: ${opt}`).join('. ');
                          } else if (currentQuestion.question_type === 'true_false') {
                            text += '. Choose True or False.';
                          } else if (currentQuestion.question_type === 'essay') {
                            text += '. This is an essay question. Write your answer in the text box.';
                          }
                          readingAssistant.speak(text);
                        }
                      }}
                    >
                      {readingAssistant.isSpeaking ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-current" />
                          Stop Reading
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3.5 w-3.5" />
                          Read Question Aloud
                        </>
                      )}
                    </Button>
                    {readingAssistant.isSpeaking && (
                      <span className="text-xs text-accent animate-pulse">🔊 Reading...</span>
                    )}
                  </div>
                )}
                {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    className="space-y-3"
                  >
                    {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option: string, optIndex: number) => (
                      <div 
                        key={optIndex} 
                        className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          answers[currentQuestion.id] === option 
                            ? 'border-primary bg-primary/10' 
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <RadioGroupItem value={option} id={`${currentQuestion.id}-${optIndex}`} />
                        <Label htmlFor={`${currentQuestion.id}-${optIndex}`} className="flex-1 cursor-pointer text-base">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.question_type === 'true_false' && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div 
                      className={`flex items-center justify-center space-x-3 p-6 rounded-xl border-2 transition-all cursor-pointer ${
                        answers[currentQuestion.id] === 'True' 
                          ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10' 
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <RadioGroupItem value="True" id={`${currentQuestion.id}-true`} />
                      <Label htmlFor={`${currentQuestion.id}-true`} className="cursor-pointer text-lg font-medium">
                        ✓ True
                      </Label>
                    </div>
                    <div 
                      className={`flex items-center justify-center space-x-3 p-6 rounded-xl border-2 transition-all cursor-pointer ${
                        answers[currentQuestion.id] === 'False' 
                          ? 'border-destructive bg-destructive/10' 
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <RadioGroupItem value="False" id={`${currentQuestion.id}-false`} />
                      <Label htmlFor={`${currentQuestion.id}-false`} className="cursor-pointer text-lg font-medium">
                        ✗ False
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {currentQuestion.question_type === 'essay' && (
                  <div className="space-y-2">
                    <Textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Write your detailed answer here..."
                      rows={10}
                      className="text-base resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Essay questions will be manually graded by your instructor
                    </p>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(curr => Math.max(0, curr - 1))}
                    disabled={currentQuestionIndex === 0}
                    size="lg"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {currentQuestionIndex < questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestionIndex(curr => curr + 1)}
                      size="lg"
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleManualSubmit}
                      disabled={submitting}
                      size="lg"
                      className="bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--fun-teal))]"
                    >
                      {submitting ? (
                        <>
                          <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Submit Exam
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {questions.length === 0 && (
            <Card className="hover-lift">
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Questions Available</h3>
                <p className="text-muted-foreground">
                  This exam doesn't have any questions yet. Please contact your instructor.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
