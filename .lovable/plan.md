

# Coding Assessment System

## Overview

Add a full coding assessment feature to the platform. Admins create coding tasks with test cases, students write code in a browser-based editor, and the system automatically executes and grades submissions using a free code execution API (no additional API keys needed).

## Architecture

The system extends the existing exam infrastructure by adding a new `coding` question type. Code is executed server-side through a backend function that proxies to the Piston code execution engine (free, open-source, supports Python, C++, JavaScript, and more).

For HTML/CSS, a sandboxed iframe preview is rendered directly in the browser.

## Database Changes

### New table: `code_submissions`

Tracks each code submission with execution results.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| attempt_id | uuid | FK to exam_attempts |
| question_id | uuid | FK to exam_questions |
| language | text | Programming language used |
| code | text | Submitted source code |
| stdout | text | Execution output |
| stderr | text | Error output |
| execution_time_ms | integer | How long code ran |
| test_results | jsonb | Per-test-case pass/fail results |
| passed | boolean | Overall pass/fail |
| submitted_at | timestamptz | When submitted |

RLS policies: Students can insert/view own submissions (via attempt_id chain), admins can view all.

### Extend `exam_questions`

No schema change needed. The existing `question_type` text field will accept `'coding'` as a new value. The existing `options` jsonb field will store coding metadata:

```json
{
  "language": "python",
  "starter_code": "def solve(n):\n    # your code here\n    pass",
  "test_cases": [
    { "input": "5", "expected_output": "120", "label": "Factorial of 5" },
    { "input": "0", "expected_output": "1", "label": "Factorial of 0" }
  ],
  "time_limit_seconds": 10
}
```

## New Dependencies

- `@uiw/react-codemirror` -- React wrapper for CodeMirror 6 (code editor)
- `@codemirror/lang-javascript` -- JS/HTML/CSS syntax
- `@codemirror/lang-python` -- Python syntax
- `@codemirror/lang-cpp` -- C++ syntax
- `@uiw/codemirror-theme-vscode` -- VS Code dark theme

## Files to Create

### 1. `src/components/coding/CodeEditor.tsx`
Reusable code editor component wrapping CodeMirror. Features:
- Language selector (Python, JavaScript, C++, HTML/CSS)
- Syntax highlighting, line numbers, auto-indent, bracket matching
- Resizable panel
- Read-only mode (for viewing submissions after grading)

### 2. `src/components/coding/CodeTestRunner.tsx`
Student-facing component that shows:
- Task description
- Code editor
- "Run Code" button (test run without submitting)
- "Submit" button (final submission)
- Output panel showing stdout/stderr
- Test case results (pass/fail per case)
- HTML/CSS preview iframe (when language is HTML)

### 3. `src/components/coding/CodingQuestionForm.tsx`
Admin form for creating coding questions:
- Language selector
- Task description (uses existing question_text field)
- Starter code editor
- Test cases builder (input/expected output pairs with labels)
- Time limit setting
- Marks allocation

### 4. `src/components/coding/HtmlPreview.tsx`
Sandboxed iframe component for rendering HTML/CSS/JS submissions in-browser.

### 5. `supabase/functions/execute-code/index.ts`
Backend function that:
- Receives code + language + test cases
- Validates the caller is authenticated
- Calls Piston API (`POST https://emkc.org/api/v2/piston/execute`) for Python/JS/C++
- Runs each test case, captures stdout, compares with expected output
- Returns per-test-case results
- Enforces time limits (max 10 seconds per run)
- For HTML/CSS: returns the code as-is (rendering happens client-side)

## Files to Modify

### 6. `src/pages/ExamQuestions.tsx`
- Add `coding` to the question type dropdown
- When `coding` is selected, show the `CodingQuestionForm` component instead of the standard options/answer fields
- Save coding metadata (language, test cases, starter code) into the `options` jsonb field

### 7. `src/pages/ExamTaking.tsx`
- When rendering a question with `question_type === 'coding'`, show the `CodeTestRunner` component instead of textarea/radio buttons
- On submission, save code to `code_submissions` table and the pass/fail result to `exam_answers`
- Auto-grade coding questions: if all test cases pass, award full marks; otherwise 0 (or partial credit based on percentage of passing tests)

### 8. `src/pages/ExamGrading.tsx`
- Show submitted code with syntax highlighting (read-only CodeMirror)
- Show test case results (which passed, which failed)
- Allow admin to override auto-grade if needed

### 9. `src/pages/AdminDashboard.tsx`
- Attempts tab: show submission type indicator (coding vs standard)
- No major changes needed since coding exams flow through the same exam system

### 10. `supabase/config.toml`
- Add `[functions.execute-code]` with `verify_jwt = false` (auth validated in code)

## Student Workflow

1. Student opens an assigned exam containing coding questions
2. For each coding question, the code editor loads with starter code and task description
3. Student writes code, can click "Run" to test against sample cases (dry run)
4. On "Submit" or auto-submit, code is sent to the backend for execution against all test cases
5. Results are saved; student sees Passed/Failed status
6. Exam locks after submission (existing behavior)

## Admin Workflow

1. Admin creates an exam as usual
2. On the "Manage Questions" page, selects question type "Coding"
3. Chooses language, writes task description, adds starter code
4. Defines test cases with input/expected output pairs
5. Assigns exam to classes (existing flow)
6. Views results in Attempts tab and Grading page with full code + test results

## Code Execution Security

- All code runs on the Piston API's sandboxed infrastructure (isolated containers)
- The backend function enforces a 10-second timeout per execution
- No code runs on the platform's own servers
- The Piston public API handles sandboxing, memory limits, and process isolation
- Rate limit: 5 requests/second (sufficient for classroom use)

## Technical Summary

| File | Action |
|------|--------|
| `src/components/coding/CodeEditor.tsx` | Create -- reusable CodeMirror editor |
| `src/components/coding/CodeTestRunner.tsx` | Create -- student code submission UI |
| `src/components/coding/CodingQuestionForm.tsx` | Create -- admin coding question builder |
| `src/components/coding/HtmlPreview.tsx` | Create -- sandboxed HTML preview |
| `supabase/functions/execute-code/index.ts` | Create -- Piston API proxy for code execution |
| Database migration | Create -- `code_submissions` table with RLS |
| `src/pages/ExamQuestions.tsx` | Modify -- add coding question type support |
| `src/pages/ExamTaking.tsx` | Modify -- render code editor for coding questions |
| `src/pages/ExamGrading.tsx` | Modify -- show code submissions in grading view |
| `supabase/config.toml` | Modify -- register execute-code function |

