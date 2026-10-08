import { supabase } from '@/integrations/supabase/client';

export const LAB_BUCKET = 'project-submissions';

/** Upload to private storage with progress. Storage RLS decides whether the path is allowed. */
export async function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${LAB_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(uploadError(xhr.responseText))));
    xhr.onerror = () => reject(new Error('Network error during upload. Please try again.'));
    xhr.send(file);
  });
}

function uploadError(body: string) {
  try {
    const j = JSON.parse(body);
    if (/row-level|unauthorized|policy/i.test(j.message || j.error || '')) return 'You are not allowed to upload to this submission.';
    return j.message || j.error || 'Upload failed';
  } catch {
    return 'Upload failed';
  }
}

/** Short-lived signed URL (2 minutes) and an audit entry. */
export async function openLabFile(fileId: string, path: string, download = true) {
  await supabase.rpc('lab_log_download', { _file_id: fileId });
  const { data, error } = await supabase.storage.from(LAB_BUCKET).createSignedUrl(path, 120, download ? { download: true } : undefined);
  if (error || !data) throw new Error('Could not open this file.');
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function rpcError(e: unknown): string {
  const m = (e as any)?.message || String(e);
  return m.replace(/^.*?ERROR:\s*/, '');
}
