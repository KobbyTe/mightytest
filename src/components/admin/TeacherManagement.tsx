import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Teacher {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  subject_specialty: string | null;
  status: string;
  created_at: string;
  approved_at: string | null;
  school: { name: string } | null;
}

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, user_id, full_name, email, phone_number, subject_specialty, status, created_at, approved_at, school:schools(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeachers((data as any) || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (teacherId: string, action: 'approved' | 'rejected') => {
    setActionLoading(teacherId);
    try {
      const { data, error } = await supabase.functions.invoke('approve-teacher', {
        body: { teacherId, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Teacher ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
      loadTeachers();
    } catch (error: any) {
      console.error('Action error:', error);
      toast.error(error.message || `Failed to ${action} teacher`);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = teachers.filter(t => t.status === 'pending');
  const approved = teachers.filter(t => t.status === 'approved');
  const rejected = teachers.filter(t => t.status === 'rejected');

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const TeacherTable = ({ items, showActions }: { items: Teacher[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>School</TableHead>
          <TableHead>Applied</TableHead>
          {showActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-8">
              No teachers found
            </TableCell>
          </TableRow>
        ) : (
          items.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.full_name}</TableCell>
              <TableCell>{teacher.email}</TableCell>
              <TableCell>{teacher.subject_specialty || 'N/A'}</TableCell>
              <TableCell>{teacher.school?.name || 'N/A'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(teacher.created_at).toLocaleDateString()}
              </TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAction(teacher.id, 'approved')}
                      disabled={actionLoading === teacher.id}
                    >
                      {actionLoading === teacher.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(teacher.id, 'rejected')}
                      disabled={actionLoading === teacher.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Teacher Management
        </CardTitle>
        <CardDescription>Review and manage teacher/educator accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1">
              <Clock className="h-4 w-4" />
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1">
              <CheckCircle className="h-4 w-4" />
              Approved ({approved.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1">
              <XCircle className="h-4 w-4" />
              Rejected ({rejected.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <TeacherTable items={pending} showActions />
          </TabsContent>
          <TabsContent value="approved">
            <TeacherTable items={approved} />
          </TabsContent>
          <TabsContent value="rejected">
            <TeacherTable items={rejected} showActions />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
