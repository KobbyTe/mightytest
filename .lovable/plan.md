

# AI Study Assistant for Students

## What We're Building
A conversational AI tutor embedded in the student dashboard as a floating panel. Students can ask questions about their exam results, get concept explanations for questions they got wrong, and generate practice problems — all powered by Lovable AI (Gemini Flash) via a new edge function.

## Architecture

### 1. Edge Function: `study-assistant`
A new edge function that:
- Accepts conversation messages + student context (exam history, wrong answers)
- Calls Lovable AI Gateway with a system prompt tuned for tutoring
- Streams responses back via SSE for real-time feel
- Automatically loads the student's recent exam data (wrong answers, subjects) to ground responses

The system prompt will instruct the AI to:
- Explain concepts behind incorrect answers
- Generate practice questions on weak topics
- Use encouraging, age-appropriate language
- Reference the student's actual exam data when relevant

### 2. New Component: `AIStudyAssistant.tsx`
A floating panel (similar to ChatBubble but for AI) with:
- **Brain icon trigger button** in bottom-left area of dashboard
- **Expandable chat panel** with message history
- **Quick action chips**: "Explain my wrong answers", "Practice questions on [subject]", "Help me study for [exam]"
- **Streaming message display** with markdown rendering
- Messages stored in component state (session-only, no persistence needed)

### 3. Context Injection
Before the first message, the component fetches the student's:
- Recent graded exam attempts with scores
- Wrong answers with question text and correct answers
- Subject areas where they scored lowest

This context is sent as a hidden system message so the AI knows the student's weak areas without the student having to explain.

## Files to Create/Modify

1. **Create `supabase/functions/study-assistant/index.ts`** — Edge function calling Lovable AI Gateway with streaming, includes CORS, handles 429/402 errors
2. **Create `src/components/AIStudyAssistant.tsx`** — Floating AI chat panel with quick actions, streaming display, markdown rendering
3. **Modify `src/pages/Dashboard.tsx`** — Add the `<AIStudyAssistant>` component to the dashboard layout
4. **Modify `supabase/config.toml`** — Add `[functions.study-assistant]` with `verify_jwt = false`

## Technical Details
- Uses `LOVABLE_API_KEY` (already configured) with `google/gemini-3-flash-preview`
- SSE streaming for token-by-token rendering
- Student context fetched client-side from `exam_attempts`, `exam_answers`, `exam_questions` (RLS already allows students to read their own data)
- No database changes needed — purely client-side state for chat history
- Quick action chips pre-populate prompts like "Explain why I got question X wrong on my [Subject] exam"

