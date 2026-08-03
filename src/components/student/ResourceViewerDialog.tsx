import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RESOURCE_META, type StudyResource } from './StudyResourceCard';

interface Props {
  resource: StudyResource | null;
  onClose: () => void;
}

/** Convert common video URLs to an embeddable form. */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith('/embed/')) return url;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* fall through */
  }
  return url;
}

export function ResourceViewerDialog({ resource, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);

    if (!resource || resource.resource_type === 'video' || !resource.file_path) return;

    setLoading(true);
    supabase.storage
      .from('study-resources')
      .createSignedUrl(resource.file_path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) {
          setSignedUrl(data?.signedUrl ?? null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resource]);

  const isVideo = resource?.resource_type === 'video';
  const meta = resource ? RESOURCE_META[resource.resource_type] : null;
  const Icon = meta?.icon;

  return (
    <Dialog open={!!resource} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden border-white/40 bg-background/90 p-0 backdrop-blur-2xl">
        {resource && (
          <>
            <DialogHeader className="border-b border-border/50 px-6 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                {Icon && <Icon className="h-5 w-5 text-brand" />}
                {resource.title}
              </DialogTitle>
              {resource.description && (
                <DialogDescription className="line-clamp-2">{resource.description}</DialogDescription>
              )}
            </DialogHeader>

            <div className="h-[65vh] w-full bg-muted/40">
              {isVideo ? (
                resource.external_url ? (
                  <iframe
                    src={toEmbedUrl(resource.external_url)}
                    title={resource.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No video link provided.
                  </div>
                )
              ) : loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              ) : signedUrl ? (
                <iframe src={signedUrl} title={resource.title} className="h-full w-full border-0" />
              ) : resource.external_url ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  This resource is hosted externally.
                  <Button asChild>
                    <a href={resource.external_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Open resource
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  This resource is unavailable right now.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-6 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {resource.subject && (
                  <span className="rounded-full bg-brand/10 px-2.5 py-1 font-medium text-brand">{resource.subject}</span>
                )}
                {resource.grade_level && (
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{resource.grade_level}</span>
                )}
              </div>
              {!isVideo && signedUrl && (
                <Button asChild size="sm">
                  <a href={signedUrl} download target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" /> Download
                  </a>
                </Button>
              )}
              {isVideo && resource.external_url && (
                <Button asChild size="sm" variant="outline">
                  <a href={resource.external_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Watch on source
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
