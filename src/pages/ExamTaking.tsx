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
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
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
      // Get attempt details
      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .select('*, exams(*)')
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;

      // Check if already completed
      if (attemptData.status === 'completed') {
        toast.error('This exam has already been completed');
        navigate('/dashboard');
        return;
      }

      setExam(attemptData.exams);
      setTimeRemaining((attemptData.exams.duration_minutes || 60) * 60);

      // Get questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', attemptData.exam_id)
        .order('order_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Load existing answers if any
      const { data: existingAnswers } = await supabase
        .from('exam_answers')
        .select('*')
        .eq('attempt_id', attemptId);

      if (existingAnswers) {
        const answersMap: Record<string, string> = {};
        existingAnswers.forEach(ans => {
          answersMap[ans.question_id] = ans.answer_text;
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
      // Save all answers
      const answersToSave = Object.entries(answers).map(([question_id, answer_text]) => ({
        attempt_id: attemptId,
        question_id,
        answer_text
      }));

      // Delete existing answers first
      await supabase.from('exam_answers').delete().eq('attempt_id', attemptId);

      // Insert new answers
      if (answersToSave.length > 0) {
        const { error: answersError } = await supabase
          .from('exam_answers')
          .insert(answersToSave);

        if (answersError) throw answersError;
      }

      // Update attempt status
      const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

      toast.success('Exam submitted successfully!');
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

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading exam...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">{exam?.title}</h1>
              <p className="text-sm text-muted-foreground">
                {answeredCount} of {totalQuestions} answered
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeRemaining < 300 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10'}`}>
                <Clock className="h-5 w-5" />
                <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
              </div>
              <Button 
                onClick={handleSubmitExam} 
                disabled={submitting}
                size="lg"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-3" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      Question {index + 1}
                      {answers[question.id] && (
                        <CheckCircle className="inline-block ml-2 h-5 w-5 text-green-500" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2 text-base">
                      {question.question_text}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{question.marks} marks</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {question.question_type === 'multiple_choice' && question.options && (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent">
                        <RadioGroupItem value={option} id={`${question.id}-${optIndex}`} />
                        <Label htmlFor={`${question.id}-${optIndex}`} className="flex-1 cursor-pointer">
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
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent">
                      <RadioGroupItem value="True" id={`${question.id}-true`} />
                      <Label htmlFor={`${question.id}-true`} className="flex-1 cursor-pointer">
                        True
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent">
                      <RadioGroupItem value="False" id={`${question.id}-false`} />
                      <Label htmlFor={`${question.id}-false`} className="flex-1 cursor-pointer">
                        False
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {question.question_type === 'essay' && (
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Type your answer here..."
                    rows={6}
                    className="mt-2"
                  />
                )}
              </CardContent>
            </Card>
          ))}

          {questions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No questions available for this exam.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}