

# Fix Build Error: Install Missing CodeMirror Dependencies

## Problem
The build fails because `@uiw/react-codemirror`, `@codemirror/lang-javascript`, and `@codemirror/lang-cpp` are imported in `CodeEditor.tsx` but not listed in `package.json`.

Only `@codemirror/lang-python` and `@uiw/codemirror-theme-vscode` are currently installed.

## Fix
Install the three missing npm packages:

| Package | Why it's needed |
|---------|----------------|
| `@uiw/react-codemirror` | Main CodeMirror React wrapper (`import CodeMirror from '@uiw/react-codemirror'`) |
| `@codemirror/lang-javascript` | JavaScript/HTML syntax highlighting |
| `@codemirror/lang-cpp` | C++ syntax highlighting |

No code changes are needed -- only these three package installations will resolve the build error.
