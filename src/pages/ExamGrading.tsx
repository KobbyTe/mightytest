import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, CheckCircle, XCircle, Code } from 'lucide-react';
import { toast } from 'sonner';
import CodeEditor from '@/components/coding/CodeEditor';

interface Answer {
  id: string;
  question_id: string;
  answer_text: string;
  marks_awarded: number | null;
  is_correct: boolean | null;
  question: {
    question_text: string;
    question_type: string;
    correct_answer: string | null;
    marks: number;
  };
}

interface Attempt {
  id: string;
  student_id: string;
  exam_id: string;
  attempted_at: string;
  status: string;
  marks_obtained: number | null;
  feedback: string | null;
  student: {
    full_name: string;
    email: string;
    grade: string;
  };
  exam: {
    title: string;
    total_marks: number;
  };
}

export default function ExamGrading() {
  const { attemptId } = useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [codeSubmissions, setCodeSubmissions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [answerGrades, setAnswerGrades] = useState<Record<string, { marks: number; feedback: string }>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'admin') {
      navigate('/admin');
      return;
    }
    loadAttemptData();
  }, [user, role, authLoading, attemptId, navigate]);

  const loadAttemptData = async () => {
    try {
      // Load attempt details with student and exam info
      const { data: attemptData, error: attemptError } = await supabase
        .from('exam_attempts')
        .select(`
          *,
          student:students(full_name, email, grade),
          exam:exams(title, total_marks)
        `)
        .eq('id', attemptId)
        .single();

      if (attemptError) throw attemptError;
      setAttempt(attemptData);
      setGeneralFeedback(attemptData.feedback || '');

      // Load answers with question details
      const { data: answersData, error: answersError } = await supabase
        .from('exam_answers')
        .select(`
          *,
          question:exam_questions(question_text, question_type, correct_answer, marks)
        `)
        .eq('attempt_id', attemptId);

      if (answersError) throw answersError;
      
      setAnswers(answersData || []);

      // Load code submissions for this attempt
      const { data: codeSubs } = await supabase
        .from('code_submissions')
        .select('*')
        .eq('attempt_id', attemptId);
      
      const codeMap: Record<string, any> = {};
      (codeSubs || []).forEach((sub: any) => {
        codeMap[sub.question_id] = sub;
      });
      setCodeSubmissions(codeMap);

      // Initialize answer grades
      const initialGrades: Record<string, { marks: number; feedback: string }> = {};
      (answersData || []).forEach((answer) => {
        initialGrades[answer.id] = {
          marks: answer.marks_awarded || 0,
          feedback: ''
        };
      });
      setAnswerGrades(initialGrades);
    } catch (error) {
      console.error('Error loading attempt data:', error);
      toast.error('Failed to load grading data');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (answerId: string, marks: number) => {
    setAnswerGrades(prev => ({
      ...prev,
      [answerId]: { ...prev[answerId], marks }
    }));
  };

  const handleSaveGrading = async () => {
    try {
      // Update each answer with marks
      for (const [answerId, grade] of Object.entries(answerGrades)) {
        const { error } = await supabase
          .from('exam_answers')
          .update({ 
            marks_awarded: grade.marks,
            is_correct: grade.marks > 0 
          })
          .eq('id', answerId);

        if (error) throw error;
      }

      // Calculate total marks
      const totalMarks = Object.values(answerGrades).reduce((sum, grade) => sum + grade.marks, 0);

      // Update attempt with total marks and feedback
      const { error: attemptError } = await supabase
        .from('exam_attempts')
        .update({ 
          marks_obtained: totalMarks,
          status: 'graded',
          feedback: generalFeedback,
          graded_by: user?.id,
          graded_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      if (attemptError) throw attemptError;

      // Send email notification to student
      try {
        await supabase.functions.invoke('send-grade-notification', {
          body: { attemptId }
        });
        console.log('Grade notification email sent');
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the grading if email fails
      }

      toast.success('Grading saved successfully and student notified!');
      navigate('/admin');
    } catch (error) {
      console.error('Error saving grading:', error);
      toast.error('Failed to save grading');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <p className="text-lg mb-4">Attempt not found</p>
          <Button onClick={() => navigate('/admin')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const totalAwarded = Object.values(answerGrades).reduce((sum, grade) => sum + grade.marks, 0);
  const totalPossible = answers.reduce((sum, answer) => sum + answer.question.marks, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Grade Exam Attempt</h1>
              <p className="text-sm text-muted-foreground">
                {attempt.student.full_name} - {attempt.exam.title}
              </p>
            </div>
            <Badge variant={totalAwarded >= (attempt.exam.total_marks * 0.5) ? "default" : "destructive"}>
              {totalAwarded} / {totalPossible} marks
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Student Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{attempt.student.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{attempt.student.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Grade</p>
              <p className="font-medium">{attempt.student.grade}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="font-medium">{new Date(attempt.attempted_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Answers */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Answers to Grade</h2>
          {answers.map((answer, index) => (
            <Card key={answer.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-start justify-between">
                  <span className="flex-1">
                    Q{index + 1}. {answer.question.question_text}
                  </span>
                  <Badge variant="secondary">{answer.question.marks} marks</Badge>
                </CardTitle>
                <CardDescription>
                  {answer.question.question_type === 'essay' ? 'Essay Question' : 
                   answer.question.question_type === 'coding' ? '💻 Coding Question' : 'Multiple Choice / True-False'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {answer.question.correct_answer && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Correct Answer: {answer.question.correct_answer}
                    </p>
                  </div>
                )}
                <div className="bg-muted/50 rounded p-3">
                  <p className="text-sm font-medium mb-1">Student's Answer:</p>
                  <p className="text-sm">{answer.answer_text || 'No answer provided'}</p>
                </div>
                {answer.is_correct !== null && (
                  <div className="flex items-center gap-2">
                    {answer.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {answer.is_correct ? 'Correct' : 'Incorrect'} (Auto-graded)
                    </span>
                  </div>
                )}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`marks-${answer.id}`}>Marks Awarded</Label>
                    <Input
                      id={`marks-${answer.id}`}
                      type="number"
                      min={0}
                      max={answer.question.marks}
                      value={answerGrades[answer.id]?.marks || 0}
                      onChange={(e) => handleGradeChange(answer.id, parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground pb-2">
                    out of {answer.question.marks}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* General Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Feedback</CardTitle>
            <CardDescription>
              Provide general comments and suggestions for the student
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={generalFeedback}
              onChange={(e) => setGeneralFeedback(e.target.value)}
              rows={5}
              placeholder="Write your feedback here..."
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/admin')}>
            Cancel
          </Button>
          <Button onClick={handleSaveGrading}>
            <Save className="mr-2 h-4 w-4" />
            Save Grading
          </Button>
        </div>
      </main>
    </div>
  );
}
