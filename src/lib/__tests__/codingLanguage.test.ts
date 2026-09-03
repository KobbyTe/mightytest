import { describe, it, expect } from 'vitest';
import {
  CODING_LANGUAGES,
  assertCodingLanguage,
  codingLanguageLabel,
  isCodingLanguage,
  parseCodingLanguage,
  toEditorLanguage,
} from '../codingLanguage';

describe('coding language validation', () => {
  it('only accepts the two supported languages', () => {
    expect(CODING_LANGUAGES).toEqual(['html_css_js', 'python']);
    expect(isCodingLanguage('html_css_js')).toBe(true);
    expect(isCodingLanguage('python')).toBe(true);
    for (const bad of ['java', 'c++', '', null, undefined, 42, {}]) {
      expect(isCodingLanguage(bad)).toBe(false);
    }
  });

  it('maps aliases and messy casing onto supported values', () => {
    expect(parseCodingLanguage('Python3')).toBe('python');
    expect(parseCodingLanguage(' PY ')).toBe('python');
    expect(parseCodingLanguage('HTML/CSS/JS')).toBe('html_css_js');
    expect(parseCodingLanguage('html')).toBe('html_css_js');
    expect(parseCodingLanguage('java script')).toBe('html_css_js');
  });

  it('falls back instead of throwing on unknown/garbage values', () => {
    expect(parseCodingLanguage('rust')).toBe('html_css_js');
    expect(parseCodingLanguage(null)).toBe('html_css_js');
    expect(parseCodingLanguage(undefined, 'python')).toBe('python');
    expect(parseCodingLanguage({ language: 'python' })).toBe('html_css_js');
  });

  it('throws on writes with an unsupported language', () => {
    expect(() => assertCodingLanguage('python')).not.toThrow();
    expect(() => assertCodingLanguage('html_css_js')).not.toThrow();
    expect(() => assertCodingLanguage('ruby')).toThrow();
    expect(() => assertCodingLanguage(undefined)).toThrow();
  });

  it('maps to editor ids and labels', () => {
    expect(toEditorLanguage('python')).toBe('python');
    expect(toEditorLanguage('html_css_js')).toBe('html');
    expect(toEditorLanguage('nonsense')).toBe('html');
    expect(codingLanguageLabel('python')).toBe('Python');
    expect(codingLanguageLabel('html_css_js')).toBe('HTML/CSS/JS');
  });
});
