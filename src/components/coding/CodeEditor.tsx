import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  height?: string;
}

const getLanguageExtension = (language: string) => {
  switch (language) {
    case 'javascript':
      return [javascript()];
    case 'html':
      return [javascript({ jsx: false })]; // HTML mode via JS
    case 'python':
      return [python()];
    case 'cpp':
      return [cpp()];
    default:
      return [javascript()];
  }
};

export default function CodeEditor({ value, onChange, language, readOnly = false, height = '400px' }: CodeEditorProps) {
  const handleChange = useCallback((val: string) => {
    onChange?.(val);
  }, [onChange]);

  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={getLanguageExtension(language)}
        onChange={handleChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          indentOnInput: true,
          bracketMatching: true,
          autocompletion: true,
          foldGutter: true,
        }}
      />
    </div>
  );
}
