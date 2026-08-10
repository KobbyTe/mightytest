import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Code2, Clock, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface AssignmentWithSubmission {
  id: string;
  title: string;
  description: string | null;
  language: 'html_css_js' | 'python';
  max_score: number;
  due_date: string | null;
  submission: {
    status: 'draft' | 'submitted' | 'graded';
    score: number | null;
  } | null;
}

export function CodingAssignmentsList() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !profile?.id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: assignmentData, error } = await supabase
        .from('coding_assignments')
        .select('id, title, description, language, max_score, due_date')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const { data: submissions } = await supabase
        .from('coding_submissions')
        .select('assignment_id, status, score')
        .eq('student_id', profile.id);

      const submissionMap = new Map((submissions || []).map((s) => [s.assignment_id, s]));

      setAssignments(
        (assignmentData || []).map((a) => ({
          ...a,
          submission: submissionMap.get(a.id)
            ? { status: submissionMap.get(a.id)!.status as 'draft' | 'submitted' | 'graded', score: submissionMap.get(a.id)!.score }
            : null,
        }))
      );
    } catch (e) {
      console.error('Failed to load coding assignments:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Code2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No coding assignments yet. Check back soon!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((a) => {
        const overdue = a.due_date && isPast(new Date(a.due_date)) && !a.submission;
        return (
          <Card
            key={a.id}
            className="border-border/50 bg-background/60 backdrop-blur-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate(`/coding/${a.id}`)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0">
                <Code2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {a.language === 'python' ? 'Python' : 'HTML/CSS/JS'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {a.due_date && (
                    <span className={`text-[11px] flex items-center gap-1 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" /> Due {format(new Date(a.due_date), 'MMM d, h:mm a')}
                    </span>
                  )}
                  {a.submission?.status === 'graded' ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                      Scored {a.submission.score}/{a.max_score}
                    </Badge>
                  ) : a.submission?.status === 'submitted' ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Submitted
                    </Badge>
                  ) : a.submission?.status === 'draft' ? (
                    <Badge variant="outline" className="text-[10px]">In progress</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Not started</Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
