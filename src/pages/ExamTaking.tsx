import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle, Send, Sparkles, Trophy, Brain } from 'lucide-react';
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

interface Answer {
  question_id: string;
  answer_text: string;
}

export default function ExamTaking() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attempt');
  
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !attemptId) {
      navigate('/dashboard');
      return;
    }
    loadExamData();
  }, [user, attemptId, navigate]);

  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const loadExamData = async () => {
    try {
      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*, exams(*)')
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;

      if (attemptData.status === 'completed' || attemptData.status === 'graded') {
        toast.error('This exam has already been completed');
        navigate('/dashboard');
        return;
      }

      setExam(attemptData.exams);
      setTimeRemaining((attemptData.exams.duration_minutes || 60) * 60);

      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', attemptData.exam_id)
        .order('order_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

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
    } catch (error) {
      console.error('Error loading exam:', error);
      toast.error('Failed to load exam');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitExam = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Prepare answers to save
      const answersToSave = Object.entries(answers).map(([question_id, answer_text]) => ({
        attempt_id: attemptId,
        question_id,
        answer_text
      }));

      // Delete existing answers first (for re-attempts or partial saves)
      await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);

      // Auto-grade multiple choice and true/false questions
      let totalAutoGradedMarks = 0;
      let hasEssayQuestions = false;
      const gradedAnswers = [];
      
      for (const answer of answersToSave) {
        const question = questions.find(q => q.id === answer.question_id);
        if (!question) continue;

        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
          // Auto-grade: compare answer with correct_answer
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
          // Essay questions need manual grading - set marks to null
          gradedAnswers.push({
            ...answer,
            is_correct: null,
            marks_awarded: null
          });
        } else {
          gradedAnswers.push(answer);
        }
      }

      // Insert graded answers
      if (gradedAnswers.length > 0) {
        const { error: answersError } = await supabase
          .from('exam_answers')
          .insert(gradedAnswers);

        if (answersError) throw answersError;
      }

      // Determine final status and marks
      // If all questions are auto-gradable, mark as graded
      // If there are essay questions, mark as completed (pending manual grading)
      const finalStatus = hasEssayQuestions ? 'completed' : 'graded';
      const finalMarks = hasEssayQuestions ? null : totalAutoGradedMarks;

      // Update attempt with calculated marks
      const updateData: any = { 
        status: finalStatus,
        completed_at: new Date().toISOString(),
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

      // Send notification to student and parent
      try {
        await supabase.functions.invoke('send-grade-notification', {
          body: { attemptId, notifyParent: true }
        });
        console.log('Grade notification sent');
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
        // Don't fail the submission if notification fails
      }

      if (hasEssayQuestions) {
        toast.success('Exam submitted! Your score will be available after manual grading of essay questions.');
      } else {
        toast.success(`Exam submitted and graded! You scored ${totalAutoGradedMarks} marks.`);
      }
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting exam:', error);
      toast.error('Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length;
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

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
                  <span className="text-primary font-medium">{answeredCount}</span> of {totalQuestions} answered
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono ${
                timeRemaining < 300 
                  ? 'bg-destructive/10 text-destructive border border-destructive/30 animate-pulse' 
                  : timeRemaining < 600
                  ? 'bg-secondary/10 text-secondary border border-secondary/30'
                  : 'bg-primary/10 text-primary border border-primary/30'
              }`}>
                <Clock className="h-5 w-5" />
                <span className="font-bold text-lg">{formatTime(timeRemaining)}</span>
              </div>
              <Button 
                onClick={handleSubmitExam} 
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
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {questions.map((question, index) => {
            const isAnswered = !!answers[question.id]?.trim();
            
            return (
              <Card key={question.id} className={`hover-lift overflow-hidden transition-all ${isAnswered ? 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/5' : ''}`}>
                <div className={`h-1 ${isAnswered ? 'bg-[hsl(var(--success))]' : 'bg-muted'}`} />
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isAnswered 
                          ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isAnswered ? <CheckCircle className="h-5 w-5" /> : index + 1}
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-relaxed">
                          {question.question_text}
                        </CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {question.question_type === 'multiple_choice' ? 'Multiple Choice' : 
                             question.question_type === 'true_false' ? 'True/False' : 'Essay'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      <Trophy className="h-3 w-3 mr-1" />
                      {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {question.question_type === 'multiple_choice' && question.options && (
                    <RadioGroup
                      value={answers[question.id] || ''}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                      className="space-y-2"
                    >
                      {(Array.isArray(question.options) ? question.options : []).map((option: string, optIndex: number) => (
                        <div 
                          key={optIndex} 
                          className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            answers[question.id] === option 
                              ? 'border-primary bg-primary/10' 
                              : 'border-transparent bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                          <Label htmlFor={`${question.id}-${optIndex}`} className="flex-1 cursor-pointer text-base">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.question_type === 'true_false' && (
                    <RadioGroup
                      value={answers[question.id] || ''}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div 
                        className={`flex items-center justify-center space-x-3 p-6 rounded-xl border-2 transition-all cursor-pointer ${
                          answers[question.id] === 'True' 
                            ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/10' 
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <RadioGroupItem value="True" id={`${question.id}-true`} />
                        <Label htmlFor={`${question.id}-true`} className="cursor-pointer text-lg font-medium">
                          ✓ True
                        </Label>
                      </div>
                      <div 
                        className={`flex items-center justify-center space-x-3 p-6 rounded-xl border-2 transition-all cursor-pointer ${
                          answers[question.id] === 'False' 
                            ? 'border-destructive bg-destructive/10' 
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <RadioGroupItem value="False" id={`${question.id}-false`} />
                        <Label htmlFor={`${question.id}-false`} className="cursor-pointer text-lg font-medium">
                          ✗ False
                        </Label>
                      </div>
                    </RadioGroup>
                  )}

                  {question.question_type === 'essay' && (
                    <div className="space-y-2">
                      <Textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Write your detailed answer here..."
                        rows={8}
                        className="text-base resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        💡 Essay questions will be manually graded by your instructor
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {questions.length === 0 && (
            <Card className="hover-lift">
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Questions Available</h3>
                <p className="text-muted-foreground">
                  This exam doesn't have any questions yet. Please contact your instructor.
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="mt-4">
                  Back to Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Submit Button at Bottom */}
          {questions.length > 0 && (
            <Card className="bg-gradient-to-r from-[hsl(var(--success))]/10 to-[hsl(var(--fun-teal))]/10 border-[hsl(var(--success))]/30">
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground mb-4">
                  You've answered <span className="font-bold text-[hsl(var(--success))]">{answeredCount}</span> out of <span className="font-bold">{totalQuestions}</span> questions
                </p>
                <Button 
                  onClick={handleSubmitExam} 
                  disabled={submitting}
                  size="lg"
                  className="bg-gradient-to-r from-[hsl(var(--success))] to-[hsl(var(--fun-teal))] hover:opacity-90 shadow-success px-8"
                >
                  {submitting ? (
                    <>
                      <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Submit Exam
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
