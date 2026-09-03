import { z } from 'zod';

/** The only languages the coding workspace can execute. */
export const CODING_LANGUAGES = ['html_css_js', 'python'] as const;

export type CodingLanguage = (typeof CODING_LANGUAGES)[number];

/** Editor language ids understood by Monaco. */
export type EditorLanguage = 'html' | 'python';

export const codingLanguageSchema = z.enum(CODING_LANGUAGES);

export const DEFAULT_CODING_LANGUAGE: CodingLanguage = 'html_css_js';

/** Aliases tolerated from legacy rows / free-text input. */
const ALIASES: Record<string, CodingLanguage> = {
  html: 'html_css_js',
  html_css_js: 'html_css_js',
  'html/css/js': 'html_css_js',
  htmlcssjs: 'html_css_js',
  web: 'html_css_js',
  javascript: 'html_css_js',
  js: 'html_css_js',
  python: 'python',
  python3: 'python',
  py: 'python',
};

/** True when the value is one of the two supported languages. */
export function isCodingLanguage(value: unknown): value is CodingLanguage {
  return codingLanguageSchema.safeParse(value).success;
}

/**
 * Map an untrusted value (e.g. a `string` column from the database) onto a
 * supported language. Unknown values fall back instead of crashing the UI.
 */
export function parseCodingLanguage(
  value: unknown,
  fallback: CodingLanguage = DEFAULT_CODING_LANGUAGE,
): CodingLanguage {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ALIASES[normalized] ?? ALIASES[normalized.replace(/_/g, '')] ?? fallback;
}

/** Throws on anything that is not a supported language. Use before writes. */
export function assertCodingLanguage(value: unknown): CodingLanguage {
  return codingLanguageSchema.parse(value);
}

/** Monaco editor language id for a coding language. */
export function toEditorLanguage(language: unknown): EditorLanguage {
  return parseCodingLanguage(language) === 'python' ? 'python' : 'html';
}

/** Human-readable label. */
export function codingLanguageLabel(language: unknown): string {
  return parseCodingLanguage(language) === 'python' ? 'Python' : 'HTML/CSS/JS';
}
