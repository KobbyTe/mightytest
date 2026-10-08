// Lab project types, file rules and status helpers.
// The database re-checks every rule; these exist for instant feedback in the browser.

export const LAB_TYPES = ['virtual_robotics', 'ai_lab', '3d_lab'] as const;
export type LabType = (typeof LAB_TYPES)[number];

export const LAB_CONFIG: Record<LabType, { label: string; extension: string; emoji: string; description: string; isJson: boolean }> = {
  virtual_robotics: { label: 'Virtual Robotics Lab', extension: '.kodevr.json', emoji: '🤖', description: 'Projects created in the KodeVR Virtual Robotics Lab.', isJson: true },
  ai_lab: { label: 'AI Lab', extension: '.json', emoji: '🧠', description: 'Projects created in the Mighty Test AI Lab.', isJson: true },
  '3d_lab': { label: '3D Lab', extension: '.kvr', emoji: '🧊', description: 'Projects created in the Mighty Test 3D Lab.', isJson: false },
};

export function parseLabType(v: unknown): LabType {
  return (LAB_TYPES as readonly string[]).includes(v as string) ? (v as LabType) : 'virtual_robotics';
}

export const SUBMISSION_STATUSES = ['draft', 'submitted', 'under_review', 'graded', 'returned', 'resubmission_required'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_META: Record<SubmissionStatus | 'not_started', { label: string; className: string }> = {
  not_started: { label: 'Not Submitted', className: 'bg-muted text-muted-foreground border-border' },
  draft: { label: 'Draft', className: 'bg-secondary text-secondary-foreground border-border' },
  submitted: { label: 'Submitted', className: 'bg-primary/10 text-primary border-primary/30' },
  under_review: { label: 'Under Review', className: 'bg-accent/15 text-accent-foreground border-accent/30' },
  graded: { label: 'Graded', className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' },
  returned: { label: 'Returned', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  resubmission_required: { label: 'Resubmission Required', className: 'bg-destructive/10 text-destructive border-destructive/30' },
};

export const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'sh', 'js', 'mjs', 'html', 'htm', 'php', 'py', 'msi', 'dll', 'jar', 'vbs', 'ps1', 'scr', 'com', 'apk', 'svg'];

export const SUPPORTING_RULES = {
  screenshot: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  video: ['mp4', 'webm', 'mov'],
  documentation: ['pdf', 'txt', 'md'],
} as const;
export type SupportingType = 'screenshot' | 'video' | 'documentation';
export const MAX_SUPPORTING_FILES = 10;

export function fileExtension(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function hasRequiredExtension(name: string, required: string): boolean {
  return name.toLowerCase().endsWith(required.toLowerCase()) && name.length > required.length;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(-120) || 'file';
}

export type ValidationResult = { ok: true; message: string } | { ok: false; message: string };

export const INVALID_JSON_MESSAGE =
  'This project file appears to be invalid or corrupted. Please export your project again and upload the new file.';

/** Validate name/size and (for JSON labs) that the content parses as a JSON object. Never executes content. */
export function validateMainProject(name: string, size: number, content: string | null, labType: LabType, maxSize: number): ValidationResult {
  const cfg = LAB_CONFIG[labType];
  if (BLOCKED_EXTENSIONS.includes(fileExtension(name))) return { ok: false, message: 'Executable or web files are not allowed.' };
  if (!hasRequiredExtension(name, cfg.extension)) return { ok: false, message: `Invalid file type. This assignment requires a ${cfg.extension} project.` };
  if (size <= 0) return { ok: false, message: 'This file is empty.' };
  if (size > maxSize) return { ok: false, message: `File is too large. Maximum size is ${formatBytes(maxSize)}.` };
  if (cfg.isJson) {
    try {
      const parsed = JSON.parse(content ?? '');
      if (parsed === null || typeof parsed !== 'object') return { ok: false, message: INVALID_JSON_MESSAGE };
    } catch {
      return { ok: false, message: INVALID_JSON_MESSAGE };
    }
  }
  const label = labType === 'virtual_robotics' ? 'KodeVR' : cfg.label;
  return { ok: true, message: `Valid ${label} project` };
}

export function classifySupporting(name: string): SupportingType | null {
  const ext = fileExtension(name);
  for (const [type, exts] of Object.entries(SUPPORTING_RULES)) {
    if ((exts as readonly string[]).includes(ext)) return type as SupportingType;
  }
  return null;
}

export function validateSupporting(name: string, size: number, maxSize: number): ValidationResult {
  if (BLOCKED_EXTENSIONS.includes(fileExtension(name))) return { ok: false, message: 'Executable or web files are not allowed.' };
  if (!classifySupporting(name)) return { ok: false, message: 'Only images, PDFs, text notes and videos are allowed.' };
  if (size <= 0 || size > maxSize) return { ok: false, message: `File must be under ${formatBytes(maxSize)}.` };
  return { ok: true, message: 'Ready' };
}

export interface RubricItem { name: string; points: number }
export function parseRubric(v: unknown): RubricItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r) => r && typeof r === 'object' && typeof (r as any).name === 'string')
    .map((r: any) => ({ name: String(r.name).slice(0, 80), points: Math.max(0, Math.round(Number(r.points) || 0)) }));
}
export const rubricTotal = (r: RubricItem[]) => r.reduce((s, i) => s + i.points, 0);

export function isScoreValid(score: number, max: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= max;
}

export function storagePrefix(p: { school_id: string; class_id: string; student_id: string; assignment_id: string; submission_id: string }) {
  return `${p.school_id}/${p.class_id}/${p.student_id}/${p.assignment_id}/${p.submission_id}/`;
}
