

# Fix Build Error: Add Missing CodeMirror Dependencies

## Problem
The build fails because `CodeEditor.tsx` imports three packages that are **not listed** in `package.json`:
- `@uiw/react-codemirror`
- `@codemirror/lang-javascript`
- `@codemirror/lang-cpp`

Previous attempts to install these via tooling did not persist in the file.

## Fix
Directly edit `package.json` to add the three missing packages in their correct alphabetical positions within the `dependencies` section:

1. After `"@codemirror/lang-python"` (line 14), add:
   - `"@codemirror/lang-cpp": "^6.0.0"`
   - `"@codemirror/lang-javascript": "^6.2.0"`

2. After `"@uiw/codemirror-theme-vscode"` (line 45), add:
   - `"@uiw/react-codemirror": "^4.25.4"`

## Result
The Rollup/Vite build will resolve all imports from `CodeEditor.tsx` and both preview and production deployments will succeed.

## Technical Detail
The `dependencies` block (lines 13-69) will be edited with a line-replace to insert the three entries. No other files need changes.
