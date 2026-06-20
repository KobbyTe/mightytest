import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert exam question creator for a STEM education platform. Generate high-quality exam questions based on the teacher's description.

Rules:
- Questions must be clear, unambiguous, and grade-appropriate
- MCQ options should include plausible distractors
- Essay questions should require critical thinking
- Short answer questions should have concise expected answers
- Vary difficulty within the requested level
- Always use the generate_questions tool to return structured output`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, subject, gradeLevel, questionTypes, numQuestions, difficulty, pdfContent } = await req.json();

    if (!topic && !pdfContent) {
      return new Response(
        JSON.stringify({ error: "Topic description or reference PDF is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const typesStr = (questionTypes || ["multiple_choice", "short_answer", "essay"]).join(", ");
    const count = numQuestions || 10;

    const prompt = `Generate exactly ${count} exam questions about the following topic:

**Topic:** ${topic}
**Subject:** ${subject || "General STEM"}
**Grade Level:** ${gradeLevel || "General"}
**Difficulty:** ${difficulty || "Medium"}
**Question Types to include:** ${typesStr}

Distribute question types roughly evenly across the requested types. For MCQs, provide exactly 4 options. For short answer, provide a concise expected answer. For essays, provide a model answer outline. Assign appropriate marks (MCQ: 1-2, short answer: 2-5, essay: 5-15).`;

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_questions",
                description: "Return the generated exam questions",
                parameters: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          question_text: { type: "string", description: "The question text" },
                          question_type: {
                            type: "string",
                            enum: ["multiple_choice", "true_false", "short_answer", "essay"],
                          },
                          options: {
                            type: "array",
                            items: { type: "string" },
                            description: "4 options for MCQ, null for others",
                          },
                          correct_answer: {
                            type: "string",
                            description: "Correct answer for MCQ/TF/short answer, model answer outline for essay",
                          },
                          marks: { type: "number", description: "Marks for this question" },
                        },
                        required: ["question_text", "question_type", "marks"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["questions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "generate_questions" },
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
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
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
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "AI failed to generate questions. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-questions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
