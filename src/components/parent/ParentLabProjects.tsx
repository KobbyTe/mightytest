import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { FlaskConical } from 'lucide-react';
import { LAB_CONFIG, parseLabType } from '@/lib/labProjects';
import { StatusBadge } from '@/components/student/LabProjects';

interface Row { id: string; project_title: string; status: string; score: number | null; max_score: number; submitted_at: string | null; teacher_feedback: string | null; attempt_number: number;
  student: { full_name: string } | null; assignment: { title: string; lab_type: string } | null }

/** Read-only list of the parent's children's lab project submissions (RLS limits rows to linked children). */
export function ParentLabProjects() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from('lab_project_submissions')
      .select('id, project_title, status, score, max_score, submitted_at, teacher_feedback, attempt_number, student:students(full_name), assignment:lab_project_assignments(title, lab_type)')
      .neq('status', 'draft').order('submitted_at', { ascending: false }).limit(50)
      .then(({ data }) => setRows((data || []) as any));
  }, []);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><FlaskConical className="h-5 w-5 text-primary" /> Lab Projects</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.id}><CardContent className="space-y-1.5 p-4">
            <div className="flex items-center gap-2">
              <span>{LAB_CONFIG[parseLabType(r.assignment?.lab_type)].emoji}</span>
              <p className="min-w-0 flex-1 truncate font-semibold">{r.assignment?.title}</p>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-xs text-muted-foreground">{r.student?.full_name} · {r.project_title} · Attempt {r.attempt_number}{r.submitted_at ? ` · ${format(new Date(r.submitted_at), 'MMM d')}` : ''}</p>
            {r.status === 'graded' && <p className="text-sm font-bold text-[hsl(var(--success))]">{r.score}/{r.max_score}</p>}
            {r.teacher_feedback && <p className="line-clamp-3 text-xs">{r.teacher_feedback}</p>}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
