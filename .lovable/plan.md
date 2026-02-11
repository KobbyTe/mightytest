
# Fix Build Errors: Add Missing CodeMirror Dependencies to package.json

## Problem
The `CodeEditor.tsx` component imports three npm packages that are not listed in `package.json`:
1. **@uiw/react-codemirror** - The main CodeMirror React wrapper component
2. **@codemirror/lang-javascript** - JavaScript and JSX syntax highlighting
3. **@codemirror/lang-cpp** - C++ syntax highlighting

These missing dependencies cause TypeScript build errors and prevent the app from running.

## Solution
Add these three packages to the `dependencies` section of `package.json`:

```json
"@uiw/react-codemirror": "^4.25.4",
"@codemirror/lang-javascript": "^6.2.0",
"@codemirror/lang-cpp": "^6.0.0"
```

These versions are compatible with:
- The existing `@uiw/codemirror-theme-vscode` (^4.25.4)
- The existing `@codemirror/lang-python` (^6.2.1)

## Steps
1. Add the three missing packages to `dependencies` in `package.json` (alphabetically ordered with other codemirror packages)
2. Dependencies will be automatically installed
3. Build errors will be resolved
4. App will load and TypeScript compilation will succeed

## Result
Once added, the admin dashboard will load correctly and you'll be able to navigate to the Exam Questions page to create coding questions with test cases.
