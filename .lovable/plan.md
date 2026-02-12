

# Fix Student Registration and Build Issues

## Two Issues Found

### Issue 1: Build Failure (Blocking Everything)
The production build still fails because three CodeMirror packages are missing from `package.json`. Previous installation attempts did not persist. This must be fixed by directly editing `package.json`.

**Missing packages:**
- `@uiw/react-codemirror` (version ^4.25.4)
- `@codemirror/lang-javascript` (version ^6.2.0)
- `@codemirror/lang-cpp` (version ^6.0.0)

**Fix:** Manually add these three entries into the `dependencies` section of `package.json` at the correct alphabetical positions.

### Issue 2: Invalid Resend API Key (Email Only)
The `RESEND_API_KEY` secret is configured but contains an invalid key. This causes a 401 error when trying to send parent credential emails after student registration.

**Important:** The registration itself still works -- students and parents are created successfully. Only the email delivery fails. The system already handles this gracefully and shows credentials on the dashboard instead.

**Fix:** You need to update the `RESEND_API_KEY` with a valid API key from your Resend account (https://resend.com/api-keys). I will prompt you to enter the correct key.

## Steps

1. Add the three missing CodeMirror dependencies to `package.json`
2. Prompt you to update the `RESEND_API_KEY` secret with a valid key
3. Verify the build succeeds and registration works end-to-end

## Technical Details

**package.json edits (lines 14-15 and after line 45):**
- Insert `"@codemirror/lang-cpp": "^6.0.0"` and `"@codemirror/lang-javascript": "^6.2.0"` after `@codemirror/lang-python`
- Insert `"@uiw/react-codemirror": "^4.25.4"` after `@uiw/codemirror-theme-vscode`

No changes needed to the register edge function code -- it already handles email failures gracefully.

