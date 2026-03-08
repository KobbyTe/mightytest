import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LogOut, GraduationCap, Plus, Calendar, Users, FileText, BarChart3, Building2, ClipboardList, Key, UserCheck, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Edit, Eye, FileQuestion, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SchoolManagement from '@/components/admin/SchoolManagement';
import ExamAssignment from '@/components/admin/ExamAssignment';
import StudentManagement from '@/components/admin/StudentManagement';
import RegistrationKeyManagement from '@/components/admin/RegistrationKeyManagement';
import WebsiteAnalytics from '@/components/admin/WebsiteAnalytics';
import ResitManagement from '@/components/admin/ResitManagement';
import TeacherManagement from '@/components/admin/TeacherManagement';
import { ChatBubble } from '@/components/ChatBubble';
import { NotificationBell } from '@/components/NotificationBell';
import { TeacherOnboardingTour } from '@/components/TeacherOnboardingTour';
import { useTeacherScope } from '@/hooks/useTeacherScope';

interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  exam_date: string;
  status: string;
}

interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  attempted_at: string;
  completed_at: string | null;
  status: string;
  marks_obtained: number | null;
  student: {
    full_name: string;
    email: string;
    grade: string;
  } | null;
  exam: {
    title: string;
    total_marks: number;
  } | null;
}

export default function AdminDashboard() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    grade_level: '',
    duration_minutes: 60,
    total_marks: 100,
    passing_marks: 50,
    exam_date: '',
    status: 'active'
  });

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const dashboardTitle = isAdmin ? 'Admin Dashboard' : 'Teacher/Educator Dashboard';

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate('/auth');
    } else if (role !== 'admin' && role !== 'teacher') {
      navigate('/dashboard');
    } else {
      loadExams();
      // Check if teacher needs onboarding tour
      if (role === 'teacher') {
        checkTeacherOnboarding();
      }
    }
  }, [user, loading, role, navigate]);

  const checkTeacherOnboarding = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!data || !data.onboarding_completed) {
        // Delay slightly so the UI renders first
        setTimeout(() => setShowTour(true), 1000);
      }
    } catch (err) {
      console.error('Error checking onboarding:', err);
    }
  };

  const handleTourComplete = async () => {
    setShowTour(false);
    if (!user) return;
    try {
      await supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: 'user_id' });
    } catch (err) {
      console.error('Error saving onboarding status:', err);
    }
  };

  const loadExams = async () => {
    try {
      // Optimized parallel queries with field selection and limits
      const [examsRes, attemptsRes] = await Promise.all([
        supabase
          .from('exams')
          .select('id,title,description,subject,grade_level,duration_minutes,total_marks,passing_marks,exam_date,status')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('exam_attempts')
          .select('id,exam_id,student_id,attempted_at,completed_at,status,marks_obtained,student:students(full_name,email,grade),exam:exams(title,total_marks)')
          .order('attempted_at', { ascending: false })
          .limit(200)
      ]);

      if (examsRes.error) throw examsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;

      setExams(examsRes.data || []);
      setAttempts(attemptsRes.data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
      toast.error('Failed to load exams');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExam) {
        const { error } = await supabase
          .from('exams')
          .update(formData)
          .eq('id', editingExam.id);

        if (error) throw error;
        toast.success('Exam updated successfully!');
      } else {
        const { error } = await supabase
          .from('exams')
          .insert({
            ...formData,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success('Exam created successfully!');
      }
      
      setIsDialogOpen(false);
      setEditingExam(null);
      setFormData({
        title: '',
        description: '',
        subject: '',
        grade_level: '',
        duration_minutes: 60,
        total_marks: 100,
        passing_marks: 50,
        exam_date: '',
        status: 'active'
      });
      loadExams();
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Failed to save exam');
    }
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description || '',
      subject: exam.subject || '',
      grade_level: exam.grade_level || '',
      duration_minutes: exam.duration_minutes || 60,
      total_marks: exam.total_marks,
      passing_marks: exam.passing_marks,
      exam_date: exam.exam_date ? new Date(exam.exam_date).toISOString().slice(0, 16) : '',
      status: exam.status || 'active'
    });
    setIsDialogOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return;
    
    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (error) throw error;
      toast.success('Exam deleted successfully!');
      loadExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error('Failed to delete exam');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3" id="teacher-tour-welcome">
            <GraduationCap className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {isTeacher && (
              <Button variant="ghost" size="sm" onClick={() => setShowTour(true)} title="Take Tour">
                <HelpCircle className="h-4 w-4" />
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate('/admin/analytics')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </Button>
            )}
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exams" className="w-full">
          {/* Bug #12 fix: Scrollable tabs on small screens */}
           <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="exams" id="teacher-tour-exams">Exams</TabsTrigger>
              <TabsTrigger value="schools" id="teacher-tour-schools">Schools</TabsTrigger>
              <TabsTrigger value="assignments" id="teacher-tour-assignments">Assignments</TabsTrigger>
              <TabsTrigger value="attempts" id="teacher-tour-attempts">Attempts</TabsTrigger>
              <TabsTrigger value="students" id="teacher-tour-students">Students</TabsTrigger>
              <TabsTrigger value="keys" id="teacher-tour-keys">Keys</TabsTrigger>
              <TabsTrigger value="resits">Resits</TabsTrigger>
            </TabsList>

          <TabsContent value="exams" className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{exams.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Exams</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exams.filter(e => e.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Exams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {exams.filter(e => e.status === 'draft').length}
              </div>
            </CardContent>
          </Card>
            </div>

            {/* Exams Management */}
            <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Manage Exams</h2>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingExam(null);
                setFormData({
                  title: '',
                  description: '',
                  subject: '',
                  grade_level: '',
                  duration_minutes: 60,
                  total_marks: 100,
                  passing_marks: 50,
                  exam_date: '',
                  status: 'active'
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
                  <DialogDescription>
                    {editingExam ? 'Update the exam details below.' : 'Fill in the details to create a new exam for students.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateExam} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Exam Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Select value={formData.subject} onValueChange={(value) => setFormData({ ...formData, subject: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Engineering">Engineering</SelectItem>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="Robotics">Robotics</SelectItem>
                          <SelectItem value="AI">Artificial Intelligence</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="grade_level">Grade Level</Label>
                      <Select value={formData.grade_level} onValueChange={(value) => setFormData({ ...formData, grade_level: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Grade 1-3">Grade 1-3</SelectItem>
                          <SelectItem value="Grade 4-6">Grade 4-6</SelectItem>
                          <SelectItem value="Grade 7-9">Grade 7-9</SelectItem>
                          <SelectItem value="Grade 10-12">Grade 10-12</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="duration">Duration (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={formData.duration_minutes}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="total_marks">Total Marks</Label>
                      <Input
                        id="total_marks"
                        type="number"
                        value={formData.total_marks}
                        onChange={(e) => setFormData({ ...formData, total_marks: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="passing_marks">Passing Marks</Label>
                      <Input
                        id="passing_marks"
                        type="number"
                        value={formData.passing_marks}
                        onChange={(e) => setFormData({ ...formData, passing_marks: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="exam_date">Exam Date & Time</Label>
                    <Input
                      id="exam_date"
                      type="datetime-local"
                      value={formData.exam_date}
                      onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">{editingExam ? 'Update Exam' : 'Create Exam'}</Button>
                </form>
              </DialogContent>
            </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg flex-1">{exam.title}</CardTitle>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/admin/exam/${exam.id}/questions`)}
                        title="Manage Questions"
                      >
                        <FileQuestion className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditExam(exam)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExam(exam.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs flex-wrap">
                    <Badge variant="secondary">{exam.subject}</Badge>
                    <Badge variant="outline">{exam.grade_level}</Badge>
                    <Badge variant={exam.status === 'active' ? 'default' : 'secondary'}>
                      {exam.status}
                    </Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {exam.description}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{exam.duration_minutes} minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Marks:</span>
                      <span className="font-medium">{exam.total_marks} (Pass: {exam.passing_marks})</span>
                    </div>
                    {exam.exam_date && (
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span className="font-medium">
                          {new Date(exam.exam_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
                ))}
              </div>
            </div>
          </TabsContent>

            <TabsContent value="schools" className="space-y-6">
              <SchoolManagement />
            </TabsContent>

            <TabsContent value="assignments" className="space-y-6">
              <ExamAssignment />
            </TabsContent>

          <TabsContent value="attempts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Student Exam Attempts</CardTitle>
                <CardDescription>View and manage all student exam submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Student</TableHead>
                        <TableHead className="min-w-[200px]">Exam</TableHead>
                        <TableHead className="min-w-[100px]">Grade</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Score</TableHead>
                        <TableHead className="min-w-[150px]">Submitted</TableHead>
                        <TableHead className="min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {attempts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No exam attempts yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        attempts.map((attempt) => (
                          <TableRow key={attempt.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{attempt.student?.full_name || 'Unknown Student'}</p>
                                <p className="text-xs text-muted-foreground">{attempt.student?.email || 'No email'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{attempt.exam?.title || 'Unknown Exam'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{attempt.student?.grade || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>
                              {attempt.status === 'graded' && (
                                <Badge variant="default" className="gap-1 bg-[hsl(var(--success))]">
                                  <CheckCircle className="h-3 w-3" />
                                  Graded
                                </Badge>
                              )}
                              {attempt.status === 'completed' && (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Completed
                                </Badge>
                              )}
                              {attempt.status === 'pending' && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  In Progress
                                </Badge>
                              )}
                              {attempt.status === 'grading' && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  Awaiting Grading
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {attempt.marks_obtained !== null ? (
                                <span className="font-semibold">
                                  {attempt.marks_obtained}/{attempt.exam?.total_marks || 0}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not graded</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(attempt.attempted_at).toLocaleDateString()} {new Date(attempt.attempted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/admin/exam/grade/${attempt.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {attempt.status === 'graded' ? 'View' : 'Grade'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <StudentManagement />
          </TabsContent>

          <TabsContent value="keys">
            <RegistrationKeyManagement />
          </TabsContent>

          <TabsContent value="resits">
            <ResitManagement />
          </TabsContent>

        </Tabs>
      </main>
      <ChatBubble />
      {isTeacher && (
        <TeacherOnboardingTour isActive={showTour} onComplete={handleTourComplete} />
      )}
    </div>
  );
}
