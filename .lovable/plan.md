

## Plan: Scrollable Student Profile + Exam Reading Assistant

### 1. Make Student Profile Dialog Scrollable

**File: `src/components/admin/StudentManagement.tsx`**

- Add `max-h-[85vh] overflow-y-auto` to the inner `motion.div` container (line 572) so the profile content scrolls when it exceeds viewport height
- The hero banner stays part of the scroll flow (natural scroll behavior)

### 2. Add Reading Assistant to Exam Taking Page

**File: `src/pages/ExamTaking.tsx`**

Add an optional "Reading Assistant" feature that uses the Web Speech API (`speechSynthesis`) to read questions and options aloud for students who have difficulty reading.

**UI**:
- Add a toggle button (e.g., `Volume2` icon from lucide) in the exam header area, labeled "Reading Assistant"
- When enabled, show a floating mini toolbar near each question with a "Read Aloud" button
- Clicking "Read Aloud" uses `window.speechSynthesis.speak()` to read: the question text, then each option (for MCQ/True-False), or "This is an essay question" for essays
- Add a "Stop" button to cancel speech mid-read
- The toggle persists for the session via local state (`readingAssistantEnabled`)

**Implementation**:
- Create a small inline component/helper `useReadingAssistant` hook that wraps `speechSynthesis` with `speak(text)`, `stop()`, and `isSpeaking` state
- No backend needed — Web Speech API is browser-native and free
- Add the toggle in the header next to the timer controls
- Add a "Read Question" button inside the question card (between the question header and the answer options)
- Style it with a subtle accent color so it's noticeable but not distracting

**No edge function or AI model needed** — this uses the browser's built-in text-to-speech, which is instant and works offline.

### Files Changed
1. `src/components/admin/StudentManagement.tsx` — Add scroll overflow to profile dialog
2. `src/pages/ExamTaking.tsx` — Add reading assistant toggle + read-aloud button using Web Speech API

