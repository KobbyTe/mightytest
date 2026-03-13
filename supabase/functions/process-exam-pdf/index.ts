import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are an exam question extractor. You will receive a PDF document containing exam questions with their correct answers.

CRITICAL RULES:
- You MUST extract EVERY SINGLE question from the ENTIRE document — do NOT stop early or summarize.
- Go through the document page by page, section by section.
- If the document has 30 questions, return 30. If 60, return 60. Missing even one is unacceptable.
- Count the questions as you go and verify your count matches the document.

For each question, determine:
- question_text: The full question text
- question_type: One of "multiple_choice", "true_false", or "essay"
- options: For multiple_choice, an array of option strings. For true_false, use ["True", "False"]. For essay, use [].
- correct_answer: The correct answer text. For multiple_choice, use the full text of the correct option. For true_false, use "True" or "False". For essay, use "".
- marks: The marks/points for the question if specified, otherwise default to 1.

You MUST respond with ONLY a valid JSON object in this exact format:
{"questions": [...]}

Do NOT include any text before or after the JSON. Do NOT use markdown code blocks.`;

async function callAI(apiKey: string, messages: any[], useJson: boolean = true): Promise<any> {
  const body: any = {
    model: 'google/gemini-2.5-pro',
    max_tokens: 131072,
    messages,
  };

  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI gateway error:', response.status, errorText);
    return { error: true, status: response.status, errorText };
  }

  return await response.json();
}

function parseJsonQuestions(aiData: any): { questions: any[], finishReason: string } {
  const finishReason = aiData.choices?.[0]?.finish_reason || 'unknown';
  const content = aiData.choices?.[0]?.message?.content || '';

  if (!content) {
    // Fallback: check for tool_calls
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        return { questions: Array.isArray(parsed.questions) ? parsed.questions : [], finishReason };
      } catch { /* fall through */ }
    }
    console.error('No content in AI response');
    return { questions: [], finishReason };
  }

  try {
    // Clean up content - remove markdown code blocks if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleaned);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : 
                      Array.isArray(parsed) ? parsed : [];
    return { questions, finishReason };
  } catch (parseErr) {
    console.error('Failed to parse JSON response:', (parseErr as Error).message, 'Content preview:', content.substring(0, 300));
    return { questions: [], finishReason };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { examId, pdfContent } = await req.json();
    if (!examId || !pdfContent) throw new Error('Missing examId or pdfContent');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const buildQuestionKey = (q: any) => {
      const text = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
      const type = q.question_type || '';
      return `${text}::${type}`;
    };

    const dedupeQuestions = (items: any[]) => {
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const q of items) {
        const text = (q.question_text || '').trim();
        if (!text) continue;
        const key = buildQuestionKey(q);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(q);
      }
      return deduped;
    };

    console.log('Processing exam:', examId, '| PDF base64 length:', pdfContent.length);

    // ---- Single-pass extraction with JSON response format ----
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract ALL exam questions from this PDF document. The document may contain 30, 50, or even 100+ questions. Go through EVERY page and extract EVERY question. Count them as you go and make sure your total matches the document. Return the complete JSON with all questions.`
          },
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${pdfContent}` }
          }
        ]
      }
    ];

    const aiData = await callAI(LOVABLE_API_KEY, messages);

    if (aiData.error) {
      if (aiData.status === 429) {
        return new Response(JSON.stringify({
          success: false, questionsCreated: 0,
          error: 'AI service is temporarily busy. Please try again in a few moments.'
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiData.status === 402) {
        return new Response(JSON.stringify({
          success: false, questionsCreated: 0,
          error: 'AI usage limit reached. Please add credits to your workspace.'
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI processing failed (${aiData.status})`);
    }

    let { questions: allQuestions, finishReason } = parseJsonQuestions(aiData);
    console.log(`Initial extraction: ${allQuestions.length} questions, finish_reason=${finishReason}`);

    // If we got very few questions and finish_reason is 'length' (truncated), do a continuation pass
    if (finishReason === 'length' && allQuestions.length > 0) {
      console.log('Response was truncated, attempting continuation...');
      
      const knownPreview = allQuestions
        .map((q: any, i: number) => `${i + 1}. ${String(q.question_text || '').slice(0, 100)}`)
        .join('\n');

      const contMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You already extracted these ${allQuestions.length} questions:\n${knownPreview}\n\nNow extract ONLY the REMAINING questions from this PDF that are NOT in the list above. Return them as JSON: {"questions": [...]}`
            },
            {
              type: 'image_url',
              image_url: { url: `data:application/pdf;base64,${pdfContent}` }
            }
          ]
        }
      ];

      const contData = await callAI(LOVABLE_API_KEY, contMessages);
      if (!contData.error) {
        const { questions: moreQuestions } = parseJsonQuestions(contData);
        console.log(`Continuation: found ${moreQuestions.length} additional questions`);
        allQuestions = [...allQuestions, ...moreQuestions];
      }
    }

    allQuestions = dedupeQuestions(allQuestions);
    console.log('Total unique questions after dedup:', allQuestions.length);

    if (allQuestions.length === 0) {
      return new Response(JSON.stringify({
        success: false, questionsCreated: 0,
        error: 'No questions could be found in the PDF. Please ensure the document contains clearly formatted exam questions with answers.'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build database rows
    const dbQuestions = allQuestions.map((q: any, i: number) => ({
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

    // Cleanup existing questions for this exam
    const { error: deleteError } = await supabase
      .from('exam_questions')
      .delete()
      .eq('exam_id', examId);
    if (deleteError) {
      console.error('Failed to clean up old questions:', deleteError.message);
    }

    const { error } = await supabase.from('exam_questions').insert(dbQuestions);
    if (error) throw new Error('Database error: ' + error.message);

    console.log('Created', dbQuestions.length, 'questions in database');

    const truncationWarning = finishReason === 'length';
    let message = `Successfully created ${dbQuestions.length} questions from PDF`;
    if (truncationWarning) {
      message += `. Warning: The PDF may contain more questions than could be extracted.`;
    }

    return new Response(JSON.stringify({
      success: true,
      questionsCreated: dbQuestions.length,
      message,
      warning: truncationWarning ? 'Some questions may not have been extracted due to document size.' : undefined
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false, questionsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
