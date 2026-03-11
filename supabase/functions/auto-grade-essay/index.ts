import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRADING_SYSTEM_PROMPT = `You are an expert exam grader for a STEM education platform. Your job is to grade essay and short-answer questions fairly and consistently.

For each answer you must evaluate:
1. Correctness — does the answer address the question accurately?
2. Completeness — does it cover the key points expected?
3. Clarity — is the answer well-structured and clearly communicated?

You MUST use the "grade_answer" tool to return your assessment. Be fair but rigorous.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { answers } = await req.json();
    // answers: Array<{ answerId, questionText, studentAnswer, correctAnswer, maxMarks }>

    if (!answers || !Array.length) {
      return new Response(
        JSON.stringify({ error: "No answers provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const results: Array<{
      answerId: string;
      suggestedMarks: number;
      reasoning: string;
      confidence: string;
    }> = [];

    // Grade each answer individually for accuracy
    for (const answer of answers) {
      const prompt = `Grade this student's answer.

**Question (${answer.maxMarks} marks):** ${answer.questionText}

${answer.correctAnswer ? `**Model/Expected Answer:** ${answer.correctAnswer}` : "**No model answer provided.** Grade based on accuracy, completeness, and relevance to the question."}

**Student's Answer:** ${answer.studentAnswer || "(No answer provided)"}

Award marks out of ${answer.maxMarks}. If no answer was provided, award 0 marks.`;

      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: GRADING_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "grade_answer",
                  description: "Submit the grade for a student's answer",
                  parameters: {
                    type: "object",
                    properties: {
                      marks: {
                        type: "number",
                        description: `Marks to award (0 to ${answer.maxMarks})`,
                      },
                      reasoning: {
                        type: "string",
                        description:
                          "Brief explanation of why this grade was given, noting strengths and weaknesses",
                      },
                      confidence: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                        description:
                          "How confident the AI is in this grade. Low if the question is ambiguous or the answer is borderline.",
                      },
                    },
                    required: ["marks", "reasoning", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "grade_answer" },
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI grading credits exhausted. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (toolCall?.function?.arguments) {
        const gradeResult = JSON.parse(toolCall.function.arguments);
        // Clamp marks to valid range
        const clampedMarks = Math.max(0, Math.min(answer.maxMarks, Math.round(gradeResult.marks)));
        results.push({
          answerId: answer.answerId,
          suggestedMarks: clampedMarks,
          reasoning: gradeResult.reasoning,
          confidence: gradeResult.confidence,
        });
      } else {
        // Fallback if tool call failed
        results.push({
          answerId: answer.answerId,
          suggestedMarks: 0,
          reasoning: "AI grading failed for this question. Please grade manually.",
          confidence: "low",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-grade-essay error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
