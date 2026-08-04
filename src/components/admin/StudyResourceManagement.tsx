import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BookOpen, PlayCircle, FileText, Plus, Trash2, Loader2, Upload, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StudyResource } from '@/components/student/StudyResourceCard';

type ResourceType = StudyResource['resource_type'];

const TYPES: { id: ResourceType; label: string; icon: typeof BookOpen }[] = [
  { id: 'book', label: 'Book / PDF', icon: BookOpen },
  { id: 'video', label: 'Video course', icon: PlayCircle },
  { id: 'worksheet', label: 'Worksheet', icon: FileText },
];

interface ClassOption {
  id: string;
  name: string;
}

export function StudyResourceManagement() {
  const { user } = useAuth();
  const { scopedClassIds, loading: scopeLoading } = useTeacherScope();
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [type, setType] = useState<ResourceType>('book');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [videoSource, setVideoSource] = useState<'link' | 'upload'>('link');
  const [file, setFile] = useState<File | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [published, setPublished] = useState(true);

  const resetForm = () => {
    setType('book');
    setTitle('');
    setDescription('');
    setSubject('');
    setGradeLevel('');
    setExternalUrl('');
    setCoverUrl('');
    setCoverFile(null);
    setVideoSource('link');
    setFile(null);
    setSelectedClasses([]);
    setPublished(true);
  };

  const loadData = async () => {
    const [{ data: res }, { data: asg }] = await Promise.all([
      supabase.from('study_resources').select('*').order('created_at', { ascending: false }),
      supabase.from('study_resource_class_assignments').select('resource_id, class_id'),
    ]);

    setResources((res as StudyResource[]) || []);
    const map: Record<string, string[]> = {};
    (asg || []).forEach((a: any) => {
      map[a.resource_id] = [...(map[a.resource_id] || []), a.class_id];
    });
    setAssignments(map);
    setLoading(false);
  };

  useEffect(() => {
    if (scopeLoading) return;
    (async () => {
      let query = supabase.from('classes').select('id, name').order('name');
      if (scopedClassIds) query = query.in('id', scopedClassIds.length ? scopedClassIds : ['00000000-0000-0000-0000-000000000000']);
      const { data } = await query;
      setClasses((data as ClassOption[]) || []);
      await loadData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeLoading, scopedClassIds]);

  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  const toggleClass = (id: string) =>
    setSelectedClasses((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error('Give the resource a title');
    if (type === 'video' && !externalUrl.trim()) return toast.error('Add a video link');
    if (type !== 'video' && !file) return toast.error('Upload a PDF file');
    if (selectedClasses.length === 0) return toast.error('Assign the resource to at least one class');

    setSaving(true);
    try {
      let filePath: string | null = null;
      let fileSize: number | null = null;

      if (file) {
        const safeName = file.name.replace(/[^\w.\-]/g, '_');
        filePath = `${type}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('study-resources')
          .upload(filePath, file, { contentType: file.type || 'application/pdf' });
        if (uploadError) throw uploadError;
        fileSize = file.size;
      }

      const { data: inserted, error } = await supabase
        .from('study_resources')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          resource_type: type,
          subject: subject.trim() || null,
          grade_level: gradeLevel.trim() || null,
          file_path: filePath,
          external_url: externalUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          file_size: fileSize,
          is_published: published,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: asgError } = await supabase.from('study_resource_class_assignments').insert(
        selectedClasses.map((class_id) => ({
          resource_id: inserted!.id,
          class_id,
          assigned_by: user?.id ?? null,
        }))
      );
      if (asgError) throw asgError;

      toast.success('Resource published to the library');
      setOpen(false);
      resetForm();
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Could not save the resource');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (r: StudyResource) => {
    const { error } = await supabase
      .from('study_resources')
      .update({ is_published: !r.is_published })
      .eq('id', r.id);
    if (error) return toast.error(error.message);
    setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_published: !x.is_published } : x)));
  };

  const handleDelete = async (r: StudyResource) => {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    if (r.file_path) await supabase.storage.from('study-resources').remove([r.file_path]);
    const { error } = await supabase.from('study_resources').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    setResources((prev) => prev.filter((x) => x.id !== r.id));
    toast.success('Resource deleted');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Library className="h-5 w-5 text-primary" /> Study Library
          </h3>
          <p className="text-sm text-muted-foreground">
            Share books, video courses and worksheets with your classes.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add resource</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add study resource</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all',
                        type === t.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sr-title">Title</Label>
                <Input id="sr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algebra Fundamentals" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sr-desc">Description</Label>
                <Textarea id="sr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What will students learn?" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sr-subject">Subject</Label>
                  <Input id="sr-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sr-grade">Grade level</Label>
                  <Input id="sr-grade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="JHS 2" />
                </div>
              </div>

              {type === 'video' ? (
                <div className="space-y-2">
                  <Label htmlFor="sr-url">Video link (YouTube, Vimeo, ...)</Label>
                  <Input id="sr-url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="sr-file">PDF file</Label>
                  <Input id="sr-file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sr-cover">Cover image URL (optional)</Label>
                <Input id="sr-cover" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div className="space-y-2">
                <Label>Assign to classes</Label>
                <div className="flex flex-wrap gap-2">
                  {classes.length === 0 && <p className="text-xs text-muted-foreground">No classes available.</p>}
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        selectedClasses.includes(c.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Publish immediately</p>
                  <p className="text-xs text-muted-foreground">Students see it in their library right away.</p>
                </div>
                <Switch checked={published} onCheckedChange={setPublished} />
              </div>

              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : 'Save resource'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Library className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm text-muted-foreground">No study resources yet. Add your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((r, i) => {
            const meta = TYPES.find((t) => t.id === r.resource_type)!;
            const Icon = meta.icon;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="line-clamp-2">{r.title}</span>
                      </CardTitle>
                      <Badge variant={r.is_published ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                        {r.is_published ? 'Live' : 'Draft'}
                      </Badge>
                    </div>
                    {r.description && <CardDescription className="line-clamp-2">{r.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.subject && <Badge variant="outline" className="text-[10px]">{r.subject}</Badge>}
                      {r.grade_level && <Badge variant="outline" className="text-[10px]">{r.grade_level}</Badge>}
                      {(assignments[r.id] || []).map((cid) => (
                        <Badge key={cid} variant="secondary" className="text-[10px]">
                          {classNameById.get(cid) || 'Class'}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleTogglePublish(r)}>
                        {r.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
