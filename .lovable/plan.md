

## Plan: Add Voice Selection for Reading Assistant (Pre-Exam Setup)

### What We're Building

A voice selection and preview panel that appears **before the student starts an exam**. When a student clicks "Start Exam" on the Dashboard, instead of immediately navigating to the exam, they'll see a dialog/modal where they can:

1. **Browse available voices** from the browser's `speechSynthesis.getVoices()` API
2. **Select a preferred voice** from a dropdown/list
3. **Test the voice** with a "Play Sample" button that reads a sample sentence aloud
4. **Adjust speed** (slow/normal/fast) — reusing existing speed controls
5. **Proceed to the exam** or skip the voice setup entirely

### Implementation Details

**1. Update `useReadingAssistant` hook** (`src/hooks/useReadingAssistant.ts`)
- Add `selectedVoice` state and `setSelectedVoice` setter
- Add `availableVoices` state populated from `speechSynthesis.getVoices()` (with `onvoiceschanged` listener since voices load async)
- Apply `selectedVoice` to the `SpeechSynthesisUtterance.voice` property in the `speak` function
- Add a `previewVoice(voice, speed)` method for testing

**2. Create `VoiceSelectionDialog` component** (new file: `src/components/VoiceSelectionDialog.tsx`)
- Modal dialog that shows before exam navigation
- Lists available voices grouped by language (prioritize English)
- Each voice shows name + language tag
- "Play Sample" button next to selected voice reads: "Welcome to your exam. Good luck!"
- Speed selector (reuse slow/normal/fast toggle)
- "Continue to Exam" and "Skip" buttons
- Remembers voice choice in localStorage for future exams

**3. Update Dashboard** (`src/pages/Dashboard.tsx`)
- When student clicks "Start Exam", show the `VoiceSelectionDialog` instead of immediately navigating
- On "Continue" or "Skip", navigate to `/exam/take?attempt=...`
- Pass selected voice preference via URL param or localStorage

**4. Update ExamTaking page** (`src/pages/ExamTaking.tsx`)
- On mount, read saved voice preference from localStorage
- Apply it to the `readingAssistant` hook's selected voice

### Files to Create/Modify
- `src/hooks/useReadingAssistant.ts` — add voice selection state + available voices
- `src/components/VoiceSelectionDialog.tsx` — new component
- `src/pages/Dashboard.tsx` — intercept "Start Exam" to show dialog
- `src/pages/ExamTaking.tsx` — load saved voice preference on mount

