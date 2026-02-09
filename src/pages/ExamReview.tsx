import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Target, BookOpen, Loader2, Lightbulb, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answer: string | null;
  marks: number;
  order_number: number;
}

interface Answer {
  id: string;
  question_id: string;
  answer_text: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  review_text: string | null;
}

interface AttemptData {
  id: string;
  marks_obtained: number | null;
  status: string | null;
  feedback: string | null;
  completed_at: string | null;
  graded_at: string | null;
  exam_id: string;
}

interface ExamData {
  id: string;
  title: string;
  subject: string | null;
  total_marks: number;
  passing_marks: number;
}

export default function ExamReview() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generatingReviews, setGeneratingReviews] = useState(false);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const loadReviewData = useCallback(async () => {
    try {
      const { data: attemptData, error: attemptErr } = await supabase
        .from('exam_attempts')
        .select('id, marks_obtained, status, feedback, completed_at, graded_at, exam_id')
        .eq('id', attemptId!)
        .single();

      if (attemptErr) throw attemptErr;
      setAttempt(attemptData);

      const [examRes, questionsRes, answersRes] = await Promise.all([
        supabase.from('exams').select('id, title, subject, total_marks, passing_marks').eq('id', attemptData.exam_id).single(),
        supabase.from('exam_questions').select('id, question_text, question_type, options, correct_answer, marks, order_number').eq('exam_id', attemptData.exam_id).order('order_number'),
        supabase.from('exam_answers').select('id, question_id, answer_text, is_correct, marks_awarded, review_text').eq('attempt_id', attemptId!),
      ]);

      if (examRes.error) throw examRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (answersRes.error) throw answersRes.error;

      setExam(examRes.data);
      setQuestions(questionsRes.data || []);
      setAnswers(answersRes.data || []);

      return answersRes.data || [];
    } catch (error: any) {
      console.error('Error loading review:', error);
      toast.error('Failed to load exam review');
      return [];
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  const generateReviews = useCallback(async () => {
    setGeneratingReviews(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam-reviews', {
        body: { attempt_id: attemptId },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Re-fetch answers with generated review_text
      const { data: updatedAnswers, error: refetchErr } = await supabase
        .from('exam_answers')
        .select('id, question_id, answer_text, is_correct, marks_awarded, review_text')
        .eq('attempt_id', attemptId!);

      if (!refetchErr && updatedAnswers) {
        setAnswers(updatedAnswers);
      }
      toast.success('Review explanations generated!');
    } catch (err: any) {
      console.error('Error generating reviews:', err);
      toast.error('Failed to generate review explanations');
    } finally {
      setGeneratingReviews(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (attemptId && user) {
      loadReviewData().then((loadedAnswers) => {
        const needsGeneration = loadedAnswers.some((a: Answer) => !a.review_text);
        if (needsGeneration && loadedAnswers.length > 0) {
          generateReviews();
        }
      });
    }
  }, [attemptId, user, loadReviewData, generateReviews]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Exam review not found.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isPassed = (attempt.marks_obtained ?? 0) >= exam.passing_marks;
  const scorePercent = attempt.marks_obtained !== null ? (attempt.marks_obtained / exam.total_marks) * 100 : 0;
  const correctCount = answers.filter(a => a.is_correct).length;

  const getAnswerForQuestion = (questionId: string) => answers.find(a => a.question_id === questionId);

  const parseOptions = (options: any): string[] => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    if (typeof options === 'object') return Object.values(options);
    return [];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">{exam.subject} • Exam Review</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* Summary Card */}
        <Card className="border-0 shadow-lg bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isPassed ? 'bg-emerald-500/15' : 'bg-destructive/15'}`}>
                  {isPassed
                    ? <Trophy className="h-7 w-7 text-emerald-500" />
                    : <Target className="h-7 w-7 text-destructive" />}
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{attempt.marks_obtained ?? 0}<span className="text-lg text-muted-foreground font-normal">/{exam.total_marks}</span></p>
                  <Badge className={`mt-1 ${isPassed ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30' : 'bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30'}`} variant="outline">
                    {isPassed ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-semibold">{scorePercent.toFixed(0)}%</span>
                </div>
                <Progress value={scorePercent} className="h-2.5" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{correctCount}/{questions.length} correct</span>
                  <span>Pass: {exam.passing_marks} marks</span>
                </div>
              </div>
            </div>
            {attempt.feedback && (
              <div className="mt-5 p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Instructor Feedback</p>
                <p className="text-sm leading-relaxed">{attempt.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generating indicator */}
        {generatingReviews && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <p className="text-sm text-primary font-medium">Generating AI explanations for your review…</p>
          </div>
        )}

        {/* Questions Section */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4" />
            Question Review
          </h2>

          <div className="space-y-3">
            {questions.map((question, idx) => {
              const answer = getAnswerForQuestion(question.id);
              const isCorrect = answer?.is_correct === true;
              const studentAnswer = answer?.answer_text || '';
              const correctAnswer = question.correct_answer || '';
              const options = parseOptions(question.options);
              const isObjective = question.question_type === 'multiple_choice' || question.question_type === 'true_false';
              const reviewText = answer?.review_text;

              return (
                <Card key={question.id} className="border shadow-sm overflow-hidden">
                  {/* Question Header */}
                  <CardHeader className="p-4 pb-3 bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0 mt-0.5 ${isCorrect ? 'bg-emerald-500/15 text-emerald-600' : answer ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                          {idx + 1}
                        </span>
                        <CardTitle className="text-sm font-medium leading-relaxed">{question.question_text}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCorrect
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          : answer ? <XCircle className="h-5 w-5 text-destructive" /> : null}
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">{answer?.marks_awarded ?? 0}/{question.marks}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-3">
                    {/* Options for objective questions */}
                    {isObjective && options.length > 0 ? (
                      <div className="space-y-1.5">
                        {options.map((option, i) => {
                          const optionLabel = String(option);
                          const isStudentChoice = optionLabel === studentAnswer;
                          const isCorrectOption = optionLabel === correctAnswer;

                          return (
                            <div
                              key={i}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                isCorrectOption
                                  ? 'bg-emerald-500/10 border border-emerald-500/25'
                                  : isStudentChoice && !isCorrect
                                    ? 'bg-destructive/8 border border-destructive/20'
                                    : 'bg-transparent border border-transparent'
                              }`}
                            >
                              {isCorrectOption
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                : isStudentChoice && !isCorrect
                                  ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                                  : <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />}
                              <span className={`flex-1 ${isCorrectOption ? 'font-medium' : isStudentChoice && !isCorrect ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                                {optionLabel}
                              </span>
                              {isStudentChoice && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">You</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Subjective answers */
                      <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Your Answer</p>
                          <p className="text-sm leading-relaxed">{studentAnswer || <em className="text-muted-foreground">No answer provided</em>}</p>
                        </div>
                        {correctAnswer && (
                          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 mb-1">Expected Answer</p>
                            <p className="text-sm leading-relaxed">{correctAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Review Explanation */}
                    {answer && (
                      <div className="mt-1 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600">Explanation</span>
                        </div>
                        {reviewText ? (
                          <p className="text-sm leading-relaxed text-foreground/80">{reviewText}</p>
                        ) : generatingReviews ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                            <p className="text-sm text-muted-foreground italic">Generating explanation…</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            {isCorrect
                              ? (correctAnswer ? `Correct! The answer is "${correctAnswer}".` : 'Correct!')
                              : (correctAnswer ? `The correct answer is "${correctAnswer}".` : 'Review the material for this topic.')}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center pt-2 pb-8">
          <Button variant="outline" onClick={() => navigate('/dashboard')} size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}
