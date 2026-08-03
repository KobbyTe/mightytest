import { motion } from 'framer-motion';
import { BookOpen, PlayCircle, FileText, Download, ArrowUpRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StudyResource {
  id: string;
  title: string;
  description: string | null;
  resource_type: 'book' | 'video' | 'worksheet';
  subject: string | null;
  grade_level: string | null;
  file_path: string | null;
  external_url: string | null;
  cover_url: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  is_published: boolean;
  created_at: string;
}

export const RESOURCE_META: Record<
  StudyResource['resource_type'],
  { label: string; icon: typeof BookOpen; gradient: string; tint: string }
> = {
  book: {
    label: 'Book',
    icon: BookOpen,
    gradient: 'from-[hsl(var(--brand-primary))] to-[hsl(var(--brand-muted))]',
    tint: 'bg-brand/10 text-brand',
  },
  video: {
    label: 'Video',
    icon: PlayCircle,
    gradient: 'from-[hsl(var(--purple))] to-[hsl(var(--brand-soft))]',
    tint: 'bg-purple/10 text-purple',
  },
  worksheet: {
    label: 'Worksheet',
    icon: FileText,
    gradient: 'from-[hsl(var(--success))] to-[hsl(var(--brand-soft))]',
    tint: 'bg-success/10 text-success',
  },
};

export function formatBytes(bytes?: number | null) {
  if (!bytes) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  resource: StudyResource;
  index?: number;
  onOpen: (resource: StudyResource) => void;
}

export function StudyResourceCard({ resource, index = 0, onOpen }: Props) {
  const meta = RESOURCE_META[resource.resource_type];
  const Icon = meta.icon;
  const meta2 =
    resource.resource_type === 'video'
      ? formatDuration(resource.duration_seconds)
      : formatBytes(resource.file_size);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(resource)}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index * 0.05, 0.5), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex w-full flex-col overflow-hidden rounded-3xl glass p-0 text-left transition-shadow duration-300 hover:shadow-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="relative h-36 w-full overflow-hidden">
        {resource.cover_url ? (
          <img
            src={resource.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br', meta.gradient)}>
            <Icon className="h-12 w-12 text-primary-foreground/90 transition-transform duration-500 group-hover:scale-110" />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-md">
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </span>
        {meta2 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-md">
            {resource.resource_type === 'video' ? <Clock className="h-3 w-3" /> : <Download className="h-3 w-3" />}
            {meta2}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{resource.title}</h3>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
        </div>
        {resource.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{resource.description}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {resource.subject && (
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', meta.tint)}>{resource.subject}</span>
          )}
          {resource.grade_level && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {resource.grade_level}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
