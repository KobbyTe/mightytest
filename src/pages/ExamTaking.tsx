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
import { Clock, CheckCircle, AlertCircle, Send, Sparkles, Trophy, Brain, ChevronLeft, ChevronRight, Timer, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

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
  const { user } = useAuth();
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
  
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);

  // Keep refs updated for async operations
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Calculate time per question
  const timePerQuestion = exam?.duration_minutes && questions.length > 0 
    ? Math.floor((exam.duration_minutes * 60) / questions.length)
    : 60;

  // Auto-submit function
  const autoSubmitExam = useCallback(async (reason: 'tab_switch' | 'page_exit' | 'route_change' | 'time_expired') => {
    if (!attemptId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    try {
      const currentAnswers = answersRef.current;
      const currentQuestions = questionsRef.current;

      const answersToSave = Object.entries(currentAnswers).map(([question_id, answer_text]) => ({
        attempt_id: attemptId,
        question_id,
        answer_text
      }));

      await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);

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

      const submissionType = reason === 'time_expired' ? 'time_expired' : 'auto_submitted';

      await supabase
        .from('exam_attempts')
        .update({
          status: hasEssay ? 'completed' : 'graded',
          completed_at: new Date().toISOString(),
          submission_type: submissionType,
          marks_obtained: hasEssay ? null : totalMarks,
          graded_at: hasEssay ? null : new Date().toISOString(),
          current_question_index: currentQuestionIndex
        })
        .eq('id', attemptId);

      try {
        await supabase.functions.invoke('send-grade-notification', {
          body: { attemptId, notifyParent: true }
        });
      } catch (e) {
        console.error('Notification failed:', e);
      }

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
  }, [attemptId, currentQuestionIndex, navigate]);

  // NOTE: `useBlocker` requires a Data Router (createBrowserRouter).
  // This app uses <BrowserRouter>, so attempting to call `useBlocker` throws at runtime.
  // We keep the existing tab-switch + beforeunload protections which are router-agnostic.

  // Tab visibility detection
  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittingRef.current) {
        autoSubmitExam('tab_switch');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examStarted, autoSubmitExam]);

  // Beforeunload handler
  useEffect(() => {
    if (!examStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmittingRef.current) {
        autoSubmitExam('page_exit');
        e.preventDefault();
        e.returnValue = 'Your exam will be auto-submitted if you leave.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examStarted, autoSubmitExam]);

  // Load exam data
  useEffect(() => {
    if (!user || !attemptId) {
      navigate('/dashboard');
      return;
    }
    loadExamData();
  }, [user, attemptId, navigate]);

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

  // Per-question timer
  useEffect(() => {
    if (!examStarted || questions.length === 0) return;

    const timer = setInterval(() => {
      setQuestionTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-advance to next question or submit if last
          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(curr => curr + 1);
            return timePerQuestion;
          } else {
            autoSubmitExam('time_expired');
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examStarted, currentQuestionIndex, questions.length, timePerQuestion, autoSubmitExam]);

  // Reset question timer when question changes
  useEffect(() => {
    if (examStarted) {
      setQuestionTimeRemaining(timePerQuestion);
    }
  }, [currentQuestionIndex, timePerQuestion, examStarted]);

  // Real-time answer saving
  useEffect(() => {
    if (!attemptId || !examStarted || Object.keys(answers).length === 0) return;

    const saveDebounced = setTimeout(async () => {
      try {
        // Save current answers to database
        const answersToSave = Object.entries(answers).map(([question_id, answer_text]) => ({
          attempt_id: attemptId,
          question_id,
          answer_text
        }));

        await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);
        if (answersToSave.length > 0) {
          await supabase.from('exam_answers').insert(answersToSave);
        }

        await supabase
          .from('exam_attempts')
          .update({ 
            last_activity_at: new Date().toISOString(),
            current_question_index: currentQuestionIndex
          })
          .eq('id', attemptId);
      } catch (e) {
        console.error('Failed to save answers:', e);
      }
    }, 1500);

    return () => clearTimeout(saveDebounced);
  }, [answers, attemptId, examStarted, currentQuestionIndex]);

  const loadExamData = async () => {
    try {
      // Add retry logic for transient issues (especially on Vercel deployments)
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
          throw new Error('Unable to load exam. Please try again.');
        }

        attemptData = data;
      }

      if (!attemptData) {
        throw new Error('Exam attempt not found');
      }

      if (attemptData.status === 'completed' || attemptData.status === 'graded') {
        toast.error('This exam has already been completed');
        navigate('/dashboard');
        return;
      }

      setExam(attemptData.exams);
      setTotalTimeRemaining((attemptData.exams.duration_minutes || 60) * 60);

      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', attemptData.exam_id)
        .order('order_number');

      if (questionsError) throw questionsError;
      
      if (!questionsData || questionsData.length === 0) {
        toast.error('No questions found for this exam');
        navigate('/dashboard');
        return;
      }
      
      setQuestions(questionsData);

      // Initialize question timer
      const tpq = Math.floor(((attemptData.exams.duration_minutes || 60) * 60) / questionsData.length);
      setQuestionTimeRemaining(tpq);

      // Restore previous progress if any
      const { data: existingAnswers } = await supabase
        .from('exam_answers')
        .select('*')
        .eq('attempt_id', attemptId);

      if (existingAnswers) {
        const answersMap: Record<string, string> = {};
        existingAnswers.forEach(ans => {
          answersMap[ans.question_id] = ans.answer_text || '';
        });
        setAnswers(answersMap);
      }

      // Restore current question index
      if (attemptData.current_question_index) {
        setCurrentQuestionIndex(attemptData.current_question_index);
      }

      // Mark exam as started
      await supabase
        .from('exam_attempts')
        .update({ started_at: new Date().toISOString() })
        .eq('id', attemptId);

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
    setSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const answersToSave = Object.entries(answers).map(([question_id, answer_text]) => ({
        attempt_id: attemptId,
        question_id,
        answer_text
      }));

      await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);

      let totalAutoGradedMarks = 0;
      let hasEssayQuestions = false;
      const gradedAnswers = [];
      
      for (const answer of answersToSave) {
        const question = questions.find(q => q.id === answer.question_id);
        if (!question) continue;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
          const isCorrect = answer.answer_text?.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
          const marksAwarded = isCorrect ? question.marks : 0;
          totalAutoGradedMarks += marksAwarded;
          
          gradedAnswers.push({
            ...answer,
            is_correct: isCorrect,
            marks_awarded: marksAwarded
          });
        } else if (question.question_type === 'essay') {
          hasEssayQuestions = true;
          gradedAnswers.push({
            ...answer,
            is_correct: null,
            marks_awarded: null
          });
        } else {
          gradedAnswers.push(answer);
        }
      }

      if (gradedAnswers.length > 0) {
        const { error: answersError } = await supabase
          .from('exam_answers')
          .insert(gradedAnswers);
        if (answersError) throw answersError;
      }

      const finalStatus = hasEssayQuestions ? 'completed' : 'graded';
      const updateData: any = { 
        status: finalStatus,
        completed_at: new Date().toISOString(),
        submission_type: 'manual',
        current_question_index: currentQuestionIndex
      };

      if (!hasEssayQuestions) {
        updateData.marks_obtained = totalAutoGradedMarks;
        updateData.graded_at = new Date().toISOString();
      }

      const { error: submitError } = await supabase
        .from('exam_attempts')
        .update(updateData)
        .eq('id', attemptId);

      if (submitError) throw submitError;

      try {
        await supabase.functions.invoke('send-grade-notification', {
          body: { attemptId, notifyParent: true }
        });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }

      if (hasEssayQuestions) {
        toast.success('Exam submitted! Your score will be available after manual grading.');
      } else {
        toast.success(`Exam submitted! You scored ${totalAutoGradedMarks} marks.`);
      }
      
      navigate('/dashboard');
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

  if (loading) {
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
            <div className="flex items-center gap-3">
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
                           currentQuestion.question_type === 'true_false' ? 'True/False' : 'Essay'}
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
