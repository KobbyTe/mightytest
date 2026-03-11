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
import { ArrowLeft, Plus, Trash2, Edit, Upload, Sparkles, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answer: string | null;
  marks: number;
  order_number: number;
}

export default function ExamQuestions() {
  const { examId } = useParams();
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1,
    order_number: 1
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'admin') {
      navigate('/admin');
      return;
    }
    loadData();
  }, [user, role, authLoading, examId, navigate]);

  const loadData = async () => {
    try {
      // Load exam details
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (examError) throw examError;
      setExam(examData);

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load exam questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const questionData = {
        exam_id: examId,
        question_text: formData.question_text,
        question_type: formData.question_type,
        options: formData.question_type === 'multiple_choice' ? formData.options : null,
        correct_answer: formData.question_type !== 'essay' ? formData.correct_answer : null,
        marks: formData.marks,
        order_number: editingQuestion ? editingQuestion.order_number : questions.length + 1
      };

      if (editingQuestion) {
        const { error } = await supabase
          .from('exam_questions')
          .update(questionData)
          .eq('id', editingQuestion.id);

        if (error) throw error;
        toast.success('Question updated successfully!');
      } else {
        const { error } = await supabase
          .from('exam_questions')
          .insert(questionData);

        if (error) throw error;
        toast.success('Question created successfully!');
      }

      setIsDialogOpen(false);
      setEditingQuestion(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options || ['', '', '', ''],
      correct_answer: question.correct_answer || '',
      marks: question.marks,
      order_number: question.order_number
    });
    setIsDialogOpen(true);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase
        .from('exam_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      toast.success('Question deleted successfully!');
      loadData();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const resetForm = () => {
    setFormData({
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      marks: 1,
      order_number: 1
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-file') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploadingPdf(true);
    
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Content = event.target?.result as string;
          
          console.log('Uploading PDF...');
          
          // Call edge function to process PDF
          const { data, error } = await supabase.functions.invoke('process-exam-pdf', {
            body: { 
              examId,
              pdfContent: base64Content.split(',')[1] // Remove data:application/pdf;base64, prefix
            }
          });

          if (error) {
            console.error('Edge function error:', error);
            throw error;
          }

          console.log('PDF processing result:', data);

          if (!data.success) {
            // Show detailed error with suggestions
            const errorMsg = data.error || 'Failed to process PDF';
            const suggestions = data.suggestions || [];
            
            toast.error(
              <div className="space-y-2">
                <div className="font-semibold">{errorMsg}</div>
                {suggestions.length > 0 && (
                  <div className="text-sm space-y-1">
                    <div className="font-medium">Suggestions:</div>
                    <ul className="list-disc list-inside">
                      {suggestions.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>,
              { duration: 8000 }
            );
            return;
          }

          // Success!
          if (data.questionsCreated > 0) {
            toast.success(
              <div className="space-y-1">
                <div className="font-semibold">✅ Success!</div>
                <div>Created {data.questionsCreated} questions from PDF</div>
              </div>,
              { duration: 5000 }
            );
            
            setIsPdfDialogOpen(false);
            await loadData();
          } else {
            toast.error('No questions were created. Please check the PDF format.');
          }
          
        } catch (innerError) {
          console.error('Error in PDF processing:', innerError);
          toast.error(
            <div className="space-y-2">
              <div className="font-semibold">Failed to process PDF</div>
              <div className="text-sm">
                {innerError instanceof Error ? innerError.message : 'Unknown error occurred'}
              </div>
              <div className="text-xs">Check console for details</div>
            </div>,
            { duration: 6000 }
          );
        } finally {
          setUploadingPdf(false);
        }
      };
      
      reader.onerror = () => {
        toast.error('Failed to read PDF file');
        setUploadingPdf(false);
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast.error('Failed to upload PDF file');
      setUploadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{exam?.title}</h1>
              <p className="text-sm text-muted-foreground">Manage exam questions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold">Questions ({questions.length})</h2>
            <p className="text-sm text-muted-foreground">
              Total Marks: {questions.reduce((sum, q) => sum + q.marks, 0)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Exam PDF</DialogTitle>
                  <DialogDescription>
                    Upload any PDF containing exam questions and answers. Our AI will analyze the document and automatically extract all questions, options, and correct answers — regardless of formatting.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePdfUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="pdf-file">PDF File</Label>
                    <Input
                      id="pdf-file"
                      type="file"
                      accept="application/pdf"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports any PDF format — text-based, scanned, or image-based. AI will detect and extract questions automatically.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={uploadingPdf}>
                    {uploadingPdf ? '🤖 Analyzing PDF with AI...' : 'Upload and Process'}
                  </Button>
                  {uploadingPdf && (
                    <p className="text-xs text-muted-foreground text-center">
                      This may take 15-30 seconds depending on document size.
                    </p>
                  )}
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingQuestion(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                <DialogDescription>
                  Create a question for this exam
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveQuestion} className="space-y-4">
                <div>
                  <Label htmlFor="question_text">Question Text</Label>
                  <Textarea
                    id="question_text"
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    required
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="question_type">Question Type</Label>
                    <Select 
                      value={formData.question_type} 
                      onValueChange={(value) => setFormData({ ...formData, question_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="essay">Essay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="marks">Marks</Label>
                    <Input
                      id="marks"
                      type="number"
                      value={formData.marks}
                      onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                      min={1}
                      required
                    />
                  </div>
                </div>

                {formData.question_type === 'multiple_choice' && (
                  <>
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {formData.options.map((option, index) => (
                        <Input
                          key={index}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          required
                        />
                      ))}
                    </div>
                    <div>
                      <Label htmlFor="correct_answer">Correct Answer</Label>
                      <Select 
                        value={formData.correct_answer} 
                        onValueChange={(value) => setFormData({ ...formData, correct_answer: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select correct answer" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.options.filter(opt => opt).map((option, index) => (
                            <SelectItem key={index} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {formData.question_type === 'true_false' && (
                  <div>
                    <Label htmlFor="correct_answer">Correct Answer</Label>
                    <Select 
                      value={formData.correct_answer} 
                      onValueChange={(value) => setFormData({ ...formData, correct_answer: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="True">True</SelectItem>
                        <SelectItem value="False">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  {editingQuestion ? 'Update Question' : 'Add Question'}
                </Button>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      Q{index + 1}. {question.question_text}
                    </CardTitle>
                    <CardDescription className="flex gap-2 mt-2">
                      <Badge variant="secondary">{question.question_type.replace('_', ' ')}</Badge>
                      <Badge>{question.marks} marks</Badge>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(question)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(question.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {question.question_type === 'multiple_choice' && question.options && (
                <CardContent>
                  <div className="space-y-1">
                    {question.options.map((option, idx) => (
                      <div key={idx} className={`p-2 rounded ${option === question.correct_answer ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'}`}>
                        {String.fromCharCode(65 + idx)}. {option}
                        {option === question.correct_answer && (
                          <Badge variant="default" className="ml-2">Correct</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
              {question.question_type === 'true_false' && (
                <CardContent>
                  <p className="text-sm">
                    Correct Answer: <Badge variant="default">{question.correct_answer}</Badge>
                  </p>
                </CardContent>
              )}
            </Card>
          ))}

          {questions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No questions added yet. Click "Add Question" to get started.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}