import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { examId, pdfContent } = await req.json();
    if (!examId || !pdfContent) throw new Error('Missing examId or pdfContent');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    console.log('Processing exam:', examId, '| PDF base64 length:', pdfContent.length);

    // Call Lovable AI with the PDF content for extraction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        max_tokens: 65536,
        messages: [
          {
            role: 'system',
            content: `You are an exam question extractor. You will receive a PDF document containing exam questions with their correct answers. You MUST extract EVERY SINGLE question from the ENTIRE document — do NOT stop early or summarize.

CRITICAL RULES:
- Extract ALL questions from ALL pages of the document. Documents may contain 50, 60, 100+ questions.
- Do NOT stop after a few questions. Continue until you have processed every page and every question.
- If the document has 60 questions, you must return exactly 60 questions. Missing even one is unacceptable.
- Go through the document page by page, section by section, and extract every question you find.

For each question, determine:
- question_text: The full question text
- question_type: One of "multiple_choice", "true_false", or "essay"
- options: For multiple_choice, an array of option strings (e.g. ["Option A text", "Option B text", "Option C text", "Option D text"]). For true_false, use ["True", "False"]. For essay, use an empty array [].
- correct_answer: The correct answer text. For multiple_choice, use the full text of the correct option. For true_false, use "True" or "False". For essay, use an empty string "".
- marks: The marks/points for the question if specified, otherwise default to 1.

Extract questions regardless of formatting style (numbered, lettered, bulleted, etc).`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract ALL exam questions from this PDF document. The document may contain many questions (50+). Make sure you go through EVERY page and extract EVERY question. Do NOT stop early. Return all of them using the extract_questions tool.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfContent}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_questions',
              description: 'Extract structured exam questions from a document',
              parameters: {
                type: 'object',
                properties: {
                  questions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        question_text: { type: 'string', description: 'The full question text' },
                        question_type: { type: 'string', enum: ['multiple_choice', 'true_false', 'essay'], description: 'Type of question' },
                        options: { type: 'array', items: { type: 'string' }, description: 'Answer options (empty array for essay)' },
                        correct_answer: { type: 'string', description: 'The correct answer text' },
                        marks: { type: 'number', description: 'Points for this question' }
                      },
                      required: ['question_text', 'question_type', 'options', 'correct_answer', 'marks'],
                      additionalProperties: false
                    }
                  }
                },
                required: ['questions'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_questions' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({
          success: false, questionsCreated: 0,
          error: 'AI service is temporarily busy. Please try again in a few moments.'
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({
          success: false, questionsCreated: 0,
          error: 'AI usage limit reached. Please add credits to your workspace.'
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI processing failed (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received, finish_reason:', aiData.choices?.[0]?.finish_reason);

    // Extract questions from tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_questions') {
      console.error('Unexpected AI response structure:', JSON.stringify(aiData).substring(0, 500));
      throw new Error('AI did not return structured question data');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error('Failed to parse AI tool call arguments (likely truncated):', (parseErr as Error).message);
      throw new Error('AI response was truncated. The PDF may be too large — try splitting it into smaller files.');
    }

    const extractedQuestions = parsed.questions;

    if (!Array.isArray(extractedQuestions) || extractedQuestions.length === 0) {
      return new Response(JSON.stringify({
        success: false, questionsCreated: 0,
        error: 'No questions could be found in the PDF. Please ensure the document contains clearly formatted exam questions with answers.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if AI response was truncated (finish_reason = "length")
    const finishReason = aiData.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
      console.warn('AI response was truncated (finish_reason=length). Extracted', extractedQuestions.length, 'questions but there may be more.');
    }

    console.log('Raw extracted count:', extractedQuestions.length);

    // --- DEDUPLICATION: remove repeated questions ---
    const seen = new Set<string>();
    const uniqueQuestions = extractedQuestions.filter((q: any) => {
      // Normalize question text: trim, lowercase, collapse whitespace
      const key = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const duplicatesRemoved = extractedQuestions.length - uniqueQuestions.length;
    if (duplicatesRemoved > 0) {
      console.warn(`Removed ${duplicatesRemoved} duplicate questions from AI output`);
    }

    console.log('Unique questions to insert:', uniqueQuestions.length);

    // Build database rows
    const dbQuestions = uniqueQuestions.map((q: any, i: number) => ({
      exam_id: examId,
      question_text: q.question_text,
      question_type: q.question_type || 'essay',
      options: Array.isArray(q.options) && q.options.length > 0 ? q.options : null,
      correct_answer: q.correct_answer || null,
      marks: q.marks || 1,
      order_number: i + 1,
    }));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- CLEANUP: delete any existing questions for this exam before inserting ---
    const { error: deleteError } = await supabase
      .from('exam_questions')
      .delete()
      .eq('exam_id', examId);
    if (deleteError) {
      console.error('Failed to clean up old questions:', deleteError.message);
      // Non-fatal — continue with insert
    }

    const { error } = await supabase.from('exam_questions').insert(dbQuestions);
    if (error) throw new Error('Database error: ' + error.message);

    console.log('Created', dbQuestions.length, 'questions in database');
    return new Response(JSON.stringify({
      success: true,
      questionsCreated: dbQuestions.length,
      message: `Successfully created ${dbQuestions.length} questions from PDF`
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false, questionsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
