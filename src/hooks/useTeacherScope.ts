import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TeacherAssignment {
  class_id: string;
  subject: string;
}

/**
 * Hook that returns the teacher's assigned class IDs (for scoping).
 * Returns null for admins (meaning "no restriction").
 * Returns an empty array if teacher has no assignments yet.
 */
export function useTeacherScope() {
  const { user, role } = useAuth();
  const [scopedClassIds, setScopedClassIds] = useState<string[] | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (role === 'admin') {
      // Admins see everything
      setScopedClassIds(null);
      setLoading(false);
      return;
    }

    if (role === 'teacher') {
      loadTeacherScope();
    } else {
      setLoading(false);
    }
  }, [user, role]);

  const loadTeacherScope = async () => {
    try {
      // First get teacher record
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!teacher) {
        setScopedClassIds([]);
        setAssignments([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('teacher_class_assignments')
        .select('class_id, subject')
        .eq('teacher_id', teacher.id);

      if (error) throw error;

      const classIds = [...new Set((data || []).map(a => a.class_id))];
      setScopedClassIds(classIds);
      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading teacher scope:', error);
      setScopedClassIds([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    /** null = no restriction (admin), string[] = restricted to these class IDs */
    scopedClassIds,
    assignments,
    loading,
    isScoped: scopedClassIds !== null,
  };
}
