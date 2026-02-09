

# Reliable PDF-to-Exam Generation Using AI

## The Problem

The current PDF processing edge function uses custom regex-based text extraction (decompressing FlateDecode streams, matching patterns like `Question: ... Answer: ...`). This approach is fragile and fails on most real-world PDFs because:

- It cannot handle image-based/scanned PDFs
- Different PDF generators produce different internal stream formats
- The regex patterns only match two specific question formats
- Many PDFs use font encoding that breaks the text extraction

## The Solution

Replace the brittle custom parser with **AI-powered extraction**. The admin uploads a PDF, the system sends its content to the Lovable AI gateway (Gemini), which reliably extracts questions, options, correct answers, and question types -- regardless of PDF formatting.

## How It Will Work

1. Admin clicks "Upload PDF" on the exam questions page
2. The PDF is read as base64 on the client
3. The base64 PDF is sent to the `process-exam-pdf` edge function
4. The edge function sends the PDF content to **Lovable AI** (Gemini model with vision/multimodal support) with a structured prompt asking it to extract questions
5. The AI returns structured question data via **tool calling** (not raw JSON)
6. The edge function validates the response and inserts questions into the database
7. The admin sees a success message with the number of questions created

## Technical Details

### File: `supabase/functions/process-exam-pdf/index.ts` (Full Rewrite)

Replace the entire custom PDF parser with an AI-powered approach:

- Remove: `pako` import, `decompress()`, `decode()`, `extractText()`, `detectType()`, `parseQuestions()` functions
- Add: Call to Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `LOVABLE_API_KEY`
- Use **Gemini 2.5 Flash** (`google/gemini-2.5-flash`) which supports multimodal input (can read PDF content directly)
- Use **tool calling** to get structured output (array of questions with `question_text`, `question_type`, `options`, `correct_answer`, `marks`)
- The system prompt will instruct the AI to extract every question from the document, classify types (multiple_choice, true_false, essay), identify correct answers, and extract options for MCQs
- Handle rate limit (429) and payment (402) errors gracefully

### File: `src/pages/ExamQuestions.tsx` (Minor Updates)

- Update the PDF upload dialog description to clarify that any PDF format is now supported
- Add a progress indicator ("Analyzing PDF with AI...") during processing since AI calls take longer than regex
- Improve error messages for AI-specific failures (rate limits, etc.)

### No Database Changes Required

The `exam_questions` table schema already supports all needed fields (`question_text`, `question_type`, `options`, `correct_answer`, `marks`, `order_number`).

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Scanned/image PDF | Gemini multimodal can read images in PDFs |
| Mixed format questions | AI classifies each question individually |
| No questions found | Returns clear error message |
| AI rate limited (429) | Returns user-friendly "try again later" message |
| Very large PDF | Process first ~50 questions, warn if truncated |
| Duplicate upload | Questions append to existing ones (admin can delete duplicates) |

