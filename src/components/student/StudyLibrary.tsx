import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Library, Sparkles, BookOpen, PlayCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { StudyResourceCard, type StudyResource } from './StudyResourceCard';
import { ResourceViewerDialog } from './ResourceViewerDialog';

const FILTERS = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'book', label: 'Books', icon: BookOpen },
  { id: 'video', label: 'Video courses', icon: PlayCircle },
  { id: 'worksheet', label: 'Worksheets', icon: FileText },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export function StudyLibrary() {
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterId>('all');
  const [subject, setSubject] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<StudyResource | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('study_resources')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        if (error) console.error('Error loading study resources:', error);
        setResources((data as StudyResource[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subjects = useMemo(
    () => [...new Set(resources.map((r) => r.subject).filter(Boolean))] as string[],
    [resources]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (filter !== 'all' && r.resource_type !== filter) return false;
      if (subject !== 'all' && r.subject !== subject) return false;
      if (q && !`${r.title} ${r.description ?? ''} ${r.subject ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [resources, filter, subject, query]);

  const counts = useMemo(
    () => ({
      book: resources.filter((r) => r.resource_type === 'book').length,
      video: resources.filter((r) => r.resource_type === 'video').length,
      worksheet: resources.filter((r) => r.resource_type === 'worksheet').length,
    }),
    [resources]
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl glass-strong p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-purple/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              <Library className="h-3.5 w-3.5" /> Study Library
            </span>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Everything you need, in one place</h2>
            <p className="text-sm text-muted-foreground">
              Books, video courses and practice worksheets picked by your teachers for your class.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['book', 'video', 'worksheet'] as const).map((t, i) => {
              const Icon = FILTERS.find((f) => f.id === t)!.icon;
              return (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-2xl glass px-4 py-3 text-center"
                >
                  <Icon className="mx-auto h-5 w-5 text-brand" />
                  <p className="mt-1 text-lg font-bold text-foreground">{counts[t]}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">{t}s</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300',
                  isActive
                    ? 'bg-brand text-primary-foreground shadow-primary'
                    : 'glass text-muted-foreground hover:text-brand'
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {subjects.length > 0 && (
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 rounded-full border border-border/60 bg-background/70 px-4 text-xs font-medium text-foreground backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources..."
              className="h-10 w-full rounded-full pl-9 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : visible.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl glass p-12 text-center"
        >
          <Library className="mx-auto h-12 w-12 animate-float-slow text-brand/60" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {resources.length === 0 ? 'No resources yet' : 'Nothing matches that search'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {resources.length === 0
              ? 'Your teachers haven’t shared any study material for your class yet. Check back soon.'
              : 'Try a different filter or search term.'}
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((r, i) => (
              <StudyResourceCard key={r.id} resource={r} index={i} onOpen={setActive} />
            ))}
          </div>
        </AnimatePresence>
      )}

      <ResourceViewerDialog resource={active} onClose={() => setActive(null)} />
    </div>
  );
}
