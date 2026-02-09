import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attempt_id } = await req.json();
    if (!attempt_id) {
      return new Response(JSON.stringify({ error: "attempt_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch answers with their questions
    const { data: answersData, error: answersErr } = await supabase
      .from("exam_answers")
      .select("id, question_id, answer_text, is_correct, marks_awarded, review_text")
      .eq("attempt_id", attempt_id);

    if (answersErr) throw answersErr;
    if (!answersData || answersData.length === 0) {
      return new Response(JSON.stringify({ error: "No answers found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if all reviews already exist
    const needsReview = answersData.filter((a) => !a.review_text);
    if (needsReview.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Reviews already cached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the questions for answers that need reviews
    const questionIds = needsReview.map((a) => a.question_id);
    const { data: questions, error: qErr } = await supabase
      .from("exam_questions")
      .select("id, question_text, correct_answer, question_type, options")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const questionMap = new Map(questions!.map((q) => [q.id, q]));

    // Build batch prompt
    const questionsForAI = needsReview.map((answer, idx) => {
      const q = questionMap.get(answer.question_id);
      if (!q) return null;
      return {
        index: idx,
        answer_id: answer.id,
        question: q.question_text,
        correct_answer: q.correct_answer || "N/A",
        student_answer: answer.answer_text || "No answer",
        is_correct: answer.is_correct,
        question_type: q.question_type,
      };
    }).filter(Boolean);

    const prompt = `You are an expert educational tutor helping students learn from their exam results. For each question below, write a 2-3 sentence educational explanation.

RULES:
- Explain the underlying concept, principle, or reasoning that makes the correct answer right.
- Do NOT simply say "The correct answer is X" or just restate the answer. Instead, TEACH the student the concept.
- For example, if the question is about Newton's Third Law, explain what the law states and how it applies to the scenario.
- If the student answered incorrectly, briefly explain why their chosen answer is a common misconception.
- If the student did not answer (answer is "No answer"), explain the concept as if teaching the student for the first time.
- Be encouraging, specific, and educational.

Return a JSON array with objects containing "index" (matching the input) and "explanation" (your review text).

Questions:
${JSON.stringify(questionsForAI, null, 2)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an educational assistant. Always respond with valid JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_reviews",
              description: "Return review explanations for exam questions",
              parameters: {
                type: "object",
                properties: {
                  reviews: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        explanation: { type: "string" },
                      },
                      required: ["index", "explanation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["reviews"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_reviews" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    
    // Extract from tool call response
    let reviews: { index: number; explanation: string }[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      reviews = parsed.reviews || [];
    }

    // Update each answer with its review text
    for (const review of reviews) {
      const answerEntry = questionsForAI[review.index] as any;
      if (!answerEntry) continue;

      await supabase
        .from("exam_answers")
        .update({ review_text: review.explanation })
        .eq("id", answerEntry.answer_id);
    }

    return new Response(JSON.stringify({ success: true, reviewed: reviews.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exam-reviews error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
