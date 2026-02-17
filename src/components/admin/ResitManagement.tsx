import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RefreshCw, Plus, CheckCircle, XCircle, Clock, RotateCcw, Trash2 } from 'lucide-react';

interface School { id: string; name: string; }
interface Class { id: string; name: string; school_id: string; grade_level: string | null; }
interface Exam { id: string; title: string; subject: string | null; total_marks: number; passing_marks: number; }

interface ResitOpening {
  id: string;
  exam_id: string;
  class_id: string;
  is_open: boolean;
  deadline: string | null;
  created_at: string;
}

interface ResitRequest {
  id: string;
  exam_id: string;
  class_id: string;
  student_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
}

export default function ResitManagement() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [openings, setOpenings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for opening a resit portal
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Review state
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schoolsRes, classesRes, examsRes, openingsRes, requestsRes] = await Promise.all([
        supabase.from('schools').select('id,name').eq('status', 'active'),
        supabase.from('classes').select('id,name,school_id,grade_level').eq('status', 'active'),
        supabase.from('exams').select('id,title,subject,total_marks,passing_marks').eq('status', 'active'),
        supabase.from('resit_openings').select('*').order('created_at', { ascending: false }),
        supabase.from('resit_requests').select('*').order('requested_at', { ascending: false }),
      ]);

      setSchools(schoolsRes.data || []);
      setClasses(classesRes.data || []);
      setExams(examsRes.data || []);
      setOpenings(openingsRes.data || []);
      setRequests(requestsRes.data || []);
    } catch (error) {
      console.error('Error loading resit data:', error);
      toast.error('Failed to load resit data');
    } finally {
      setLoading(false);
    }
  };

  // Load student and exam names for requests display
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [studentScores, setStudentScores] = useState<Record<string, { marks: number | null; total: number }>>({});

  useEffect(() => {
    if (requests.length === 0) return;
    const studentIds = [...new Set(requests.map((r: any) => r.student_id))];
    const examIds = [...new Set(requests.map((r: any) => r.exam_id))];

    // Load student names
    supabase.from('students').select('id,full_name').in('id', studentIds).then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(s => { map[s.id] = s.full_name; });
        setStudentNames(map);
      }
    });

    // Load original scores
    if (studentIds.length > 0 && examIds.length > 0) {
      supabase.from('exam_attempts')
        .select('student_id,exam_id,marks_obtained,exams(total_marks)')
        .in('student_id', studentIds)
        .in('exam_id', examIds)
        .in('status', ['graded', 'completed'])
        .then(({ data }) => {
          if (data) {
            const map: Record<string, { marks: number | null; total: number }> = {};
            data.forEach((a: any) => {
              const key = `${a.student_id}_${a.exam_id}`;
              map[key] = { marks: a.marks_obtained, total: a.exams?.total_marks || 0 };
            });
            setStudentScores(map);
          }
        });
    }
  }, [requests]);

  const filteredClasses = selectedSchool
    ? classes.filter(c => c.school_id === selectedSchool)
    : classes;

  const handleOpenResit = async () => {
    if (!selectedClass || !selectedExam) {
      toast.error('Please select a class and exam');
      return;
    }

    try {
      const { error } = await supabase.from('resit_openings').insert({
        exam_id: selectedExam,
        class_id: selectedClass,
        opened_by: (await supabase.auth.getUser()).data.user?.id,
        is_open: true,
        deadline: deadline || null,
      });

      if (error) {
        if (error.code === '23505') {
          toast.error('A resit portal already exists for this exam and class');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Resit portal opened successfully!');
      setIsDialogOpen(false);
      setSelectedSchool('');
      setSelectedClass('');
      setSelectedExam('');
      setDeadline('');
      loadData();
    } catch (error) {
      console.error('Error opening resit:', error);
      toast.error('Failed to open resit portal');
    }
  };

  const handleToggleOpening = async (id: string, currentlyOpen: boolean) => {
    try {
      const { error } = await supabase.from('resit_openings')
        .update({ is_open: !currentlyOpen })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentlyOpen ? 'Resit portal closed' : 'Resit portal reopened');
      loadData();
    } catch (error) {
      toast.error('Failed to update resit portal');
    }
  };

  const handleDeleteOpening = async (id: string) => {
    if (!confirm('Delete this resit portal? Related pending requests will remain.')) return;
    try {
      const { error } = await supabase.from('resit_openings').delete().eq('id', id);
      if (error) throw error;
      toast.success('Resit portal deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete resit portal');
    }
  };

  const handleReviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('resit_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          admin_note: reviewNote || null,
        })
        .eq('id', requestId);

      if (error) throw error;
      toast.success(`Request ${status}!`);
      setReviewNote('');
      loadData();
    } catch (error) {
      toast.error('Failed to update request');
    }
  };

  const getExamTitle = (examId: string) => exams.find(e => e.id === examId)?.title || 'Unknown Exam';
  const getClassName = (classId: string) => classes.find(c => c.id === classId)?.name || 'Unknown Class';

  const pendingRequests = requests.filter((r: any) => r.status === 'pending');
  const reviewedRequests = requests.filter((r: any) => r.status !== 'pending');

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading resit data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Open Resit Portal Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Resit Portals
              </CardTitle>
              <CardDescription>Open or close resit exam portals for specific classes</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Open Resit Portal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Open Resit Portal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>School (optional filter)</Label>
                      <Select value={selectedSchool} onValueChange={(v) => { setSelectedSchool(v); setSelectedClass(''); }}>
                        <SelectTrigger><SelectValue placeholder="All schools" /></SelectTrigger>
                        <SelectContent>
                          {schools.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Class *</Label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          {filteredClasses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} {c.grade_level ? `(${c.grade_level})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Exam *</Label>
                      <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                        <SelectContent>
                          {exams.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.title} ({e.subject})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Application Deadline (optional)</Label>
                      <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
                    </div>
                    <Button onClick={handleOpenResit} className="w-full">Open Resit Portal</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {openings.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No resit portals opened yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openings.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{getExamTitle(o.exam_id)}</TableCell>
                    <TableCell>{getClassName(o.class_id)}</TableCell>
                    <TableCell>
                      <Badge variant={o.is_open ? 'default' : 'secondary'}>
                        {o.is_open ? 'Open' : 'Closed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.deadline ? new Date(o.deadline).toLocaleString() : 'No deadline'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleToggleOpening(o.id, o.is_open)}>
                          {o.is_open ? 'Close' : 'Reopen'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteOpening(o.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Resit Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Resit Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve or reject student resit applications</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No pending requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Original Score</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((r: any) => {
                  const scoreKey = `${r.student_id}_${r.exam_id}`;
                  const score = studentScores[scoreKey];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{studentNames[r.student_id] || 'Loading...'}</TableCell>
                      <TableCell>{getExamTitle(r.exam_id)}</TableCell>
                      <TableCell>{getClassName(r.class_id)}</TableCell>
                      <TableCell>
                        {score ? (
                          <span className="font-semibold">{score.marks ?? 'N/A'}/{score.total}</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.requested_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          <Input
                            placeholder="Note (optional)"
                            className="h-8 w-32 text-xs"
                            value={reviewNote}
                            onChange={e => setReviewNote(e.target.value)}
                          />
                          <Button size="sm" variant="default" onClick={() => handleReviewRequest(r.id, 'approved')}
                            className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90">
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReviewRequest(r.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Requests History */}
      {reviewedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewedRequests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{studentNames[r.student_id] || 'Loading...'}</TableCell>
                    <TableCell>{getExamTitle(r.exam_id)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'approved' ? 'default' : 'destructive'}
                        className={r.status === 'approved' ? 'bg-[hsl(var(--success))]' : ''}>
                        {r.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.admin_note || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
