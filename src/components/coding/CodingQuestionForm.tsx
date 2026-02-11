import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import CodeEditor from './CodeEditor';

interface TestCase {
  input: string;
  expected_output: string;
  label: string;
}

interface CodingMetadata {
  language: string;
  starter_code: string;
  test_cases: TestCase[];
  time_limit_seconds: number;
}

interface CodingQuestionFormProps {
  value: CodingMetadata;
  onChange: (value: CodingMetadata) => void;
}

const STARTER_TEMPLATES: Record<string, string> = {
  python: '# Write your solution here\n\ndef solve():\n    pass\n',
  javascript: '// Write your solution here\n\nfunction solve() {\n  \n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n',
  html: '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    /* Your CSS here */\n  </style>\n</head>\n<body>\n  <!-- Your HTML here -->\n  <script>\n    // Your JS here\n  </script>\n</body>\n</html>\n',
};

export default function CodingQuestionForm({ value, onChange }: CodingQuestionFormProps) {
  const updateField = <K extends keyof CodingMetadata>(field: K, val: CodingMetadata[K]) => {
    onChange({ ...value, [field]: val });
  };

  const handleLanguageChange = (lang: string) => {
    onChange({
      ...value,
      language: lang,
      starter_code: STARTER_TEMPLATES[lang] || '',
    });
  };

  const addTestCase = () => {
    updateField('test_cases', [...value.test_cases, { input: '', expected_output: '', label: `Test Case ${value.test_cases.length + 1}` }]);
  };

  const updateTestCase = (index: number, field: keyof TestCase, val: string) => {
    const updated = [...value.test_cases];
    updated[index] = { ...updated[index], [field]: val };
    updateField('test_cases', updated);
  };

  const removeTestCase = (index: number) => {
    updateField('test_cases', value.test_cases.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Programming Language</Label>
          <Select value={value.language} onValueChange={handleLanguageChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="cpp">C++</SelectItem>
              <SelectItem value="html">HTML/CSS/JS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Time Limit (seconds)</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={value.time_limit_seconds}
            onChange={(e) => updateField('time_limit_seconds', parseInt(e.target.value) || 10)}
          />
        </div>
      </div>

      <div>
        <Label>Starter Code</Label>
        <CodeEditor
          value={value.starter_code}
          onChange={(code) => updateField('starter_code', code)}
          language={value.language}
          height="200px"
        />
      </div>

      {value.language !== 'html' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Test Cases</Label>
            <Button type="button" variant="outline" size="sm" onClick={addTestCase}>
              <Plus className="mr-1 h-3 w-3" /> Add Test Case
            </Button>
          </div>
          {value.test_cases.map((tc, idx) => (
            <div key={idx} className="border rounded-xl p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Input
                  value={tc.label}
                  onChange={(e) => updateTestCase(idx, 'label', e.target.value)}
                  placeholder="Test case label"
                  className="max-w-xs text-sm"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTestCase(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Input (stdin)</Label>
                  <Input
                    value={tc.input}
                    onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Expected Output</Label>
                  <Input
                    value={tc.expected_output}
                    onChange={(e) => updateTestCase(idx, 'expected_output', e.target.value)}
                    placeholder="e.g. 120"
                  />
                </div>
              </div>
            </div>
          ))}
          {value.test_cases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add test cases to automatically validate student submissions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
