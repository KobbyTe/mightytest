import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Target, BookOpen, Loader2 } from 'lucide-react';
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
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (attemptId && user) loadReviewData();
  }, [attemptId, user]);

  const loadReviewData = async () => {
    try {
      // Fetch attempt
      const { data: attemptData, error: attemptErr } = await supabase
        .from('exam_attempts')
        .select('id, marks_obtained, status, feedback, completed_at, graded_at, exam_id')
        .eq('id', attemptId!)
        .single();

      if (attemptErr) throw attemptErr;
      setAttempt(attemptData);

      // Fetch exam and questions and answers in parallel
      const [examRes, questionsRes, answersRes] = await Promise.all([
        supabase.from('exams').select('id, title, subject, total_marks, passing_marks').eq('id', attemptData.exam_id).single(),
        supabase.from('exam_questions').select('id, question_text, question_type, options, correct_answer, marks, order_number').eq('exam_id', attemptData.exam_id).order('order_number'),
        supabase.from('exam_answers').select('id, question_id, answer_text, is_correct, marks_awarded').eq('attempt_id', attemptId!),
      ]);

      if (examRes.error) throw examRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (answersRes.error) throw answersRes.error;

      setExam(examRes.data);
      setQuestions(questionsRes.data || []);
      setAnswers(answersRes.data || []);
    } catch (error: any) {
      console.error('Error loading review:', error);
      toast.error('Failed to load exam review');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{exam.title}</h1>
              <p className="text-sm text-muted-foreground">{exam.subject} • Exam Review</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Summary Card */}
        <Card className="overflow-hidden">
          <div className={`h-2 ${isPassed ? 'bg-[hsl(var(--success))]' : 'bg-destructive'}`} />
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isPassed ? 'bg-[hsl(var(--success))]/20' : 'bg-destructive/20'}`}>
                  {isPassed ? <Trophy className="h-8 w-8 text-[hsl(var(--success))]" /> : <Target className="h-8 w-8 text-destructive" />}
                </div>
                <div>
                  <p className="text-3xl font-bold">{attempt.marks_obtained ?? 0}/{exam.total_marks}</p>
                  <Badge variant={isPassed ? 'default' : 'destructive'} className={isPassed ? 'bg-[hsl(var(--success))]' : ''}>
                    {isPassed ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-medium">{scorePercent.toFixed(1)}%</span>
                </div>
                <Progress value={scorePercent} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{correctCount} of {questions.length} correct</span>
                  <span>Pass mark: {exam.passing_marks}</span>
                </div>
              </div>
            </div>
            {attempt.feedback && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-1">Instructor Feedback</p>
                <p className="text-sm text-muted-foreground">{attempt.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Question-by-Question Review
          </h2>

          {questions.map((question, idx) => {
            const answer = getAnswerForQuestion(question.id);
            const isCorrect = answer?.is_correct === true;
            const studentAnswer = answer?.answer_text || '';
            const correctAnswer = question.correct_answer || '';
            const options = parseOptions(question.options);
            const isObjective = question.question_type === 'multiple_choice' || question.question_type === 'true_false';

            return (
              <Card key={question.id} className={`overflow-hidden border-l-4 ${isCorrect ? 'border-l-[hsl(var(--success))]' : answer ? 'border-l-destructive' : 'border-l-muted'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-muted-foreground font-normal">Q{idx + 1}.</span>
                      {question.question_text}
                    </CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                      ) : answer ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : null}
                      <Badge variant="outline" className="text-xs">
                        {answer?.marks_awarded ?? 0}/{question.marks}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isObjective && options.length > 0 ? (
                    <div className="space-y-2">
                      {options.map((option, i) => {
                        const optionLabel = String(option);
                        const isStudentChoice = optionLabel === studentAnswer;
                        const isCorrectOption = optionLabel === correctAnswer;

                        let optionClass = 'p-3 rounded-lg border text-sm flex items-center gap-2 ';
                        if (isCorrectOption) {
                          optionClass += 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30 text-foreground';
                        } else if (isStudentChoice && !isCorrect) {
                          optionClass += 'bg-destructive/10 border-destructive/30 text-foreground';
                        } else {
                          optionClass += 'bg-muted/30 border-border text-muted-foreground';
                        }

                        return (
                          <div key={i} className={optionClass}>
                            {isCorrectOption && <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />}
                            {isStudentChoice && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                            {!isCorrectOption && !isStudentChoice && <div className="w-4 h-4 rounded-full border border-muted-foreground/30 shrink-0" />}
                            <span>{optionLabel}</span>
                            {isStudentChoice && <Badge variant="outline" className="ml-auto text-xs">Your answer</Badge>}
                            {isCorrectOption && <Badge variant="outline" className="ml-auto text-xs border-[hsl(var(--success))]/50 text-[hsl(var(--success))]">Correct</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-muted/30 border">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Your Answer</p>
                        <p className="text-sm">{studentAnswer || <em className="text-muted-foreground">No answer provided</em>}</p>
                      </div>
                      {correctAnswer && (
                        <div className="p-3 rounded-lg bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/30">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">Expected Answer</p>
                          <p className="text-sm">{correctAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review explanation for all answered questions */}
                  {answer && (
                    <div className={`p-3 rounded-lg border ${isCorrect ? 'bg-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20' : 'bg-primary/5 border-primary/20'}`}>
                      <p className={`text-xs font-semibold mb-1 ${isCorrect ? 'text-[hsl(var(--success))]' : 'text-primary'}`}>
                        {isCorrect ? '✅ Review' : '📝 Review'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isCorrect
                          ? (correctAnswer
                              ? `Correct! "${correctAnswer}" is the right answer. Well done — you've demonstrated a solid understanding of this concept.`
                              : 'Correct! Great job on this question.')
                          : (correctAnswer
                              ? `The correct answer is "${correctAnswer}". Review this topic to strengthen your understanding.`
                              : 'Review the material related to this question to improve your understanding.')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Back button */}
        <div className="flex justify-center pt-4 pb-8">
          <Button onClick={() => navigate('/dashboard')} size="lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}
