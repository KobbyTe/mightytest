import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are MightyTest Study Buddy — a friendly, encouraging AI tutor for students on the MightyTest STEM exam platform.

Your role:
- Help students understand concepts they got wrong on exams
- Explain answers in simple, age-appropriate language
- Generate practice questions when asked
- Be encouraging and supportive — celebrate effort, not just scores
- Reference the student's actual exam data when provided in context
- Use emojis sparingly to keep things fun 🎯
- Format responses with markdown for readability (bold, lists, code blocks for math/science)
- Keep explanations concise but thorough
- If the student asks about a topic you have context for (their wrong answers), reference specific questions they missed

When generating practice questions:
- Match the difficulty level of their actual exams
- Provide the answer after the student attempts, or if they ask
- Vary question types (MCQ, short answer, true/false)

You do NOT:
- Help with cheating or provide exam answers before they take a test
- Discuss topics outside of education/studying
- Make the student feel bad about wrong answers — frame mistakes as learning opportunities`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studentContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system messages with student context
    const systemMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (studentContext) {
      const contextParts: string[] = [];

      if (studentContext.recentScores?.length) {
        contextParts.push(
          "## Student's Recent Exam Scores\n" +
            studentContext.recentScores
              .map(
                (s: any) =>
                  `- ${s.examTitle} (${s.subject || "General"}): ${s.score}/${s.totalMarks} (${s.percentage}%) — ${s.passed ? "✅ Passed" : "❌ Failed"}`
              )
              .join("\n")
        );
      }

      if (studentContext.wrongAnswers?.length) {
        contextParts.push(
          "## Questions the Student Got Wrong\n" +
            studentContext.wrongAnswers
              .map(
                (w: any) =>
                  `- Q: "${w.questionText}"\n  Student answered: "${w.studentAnswer || "No answer"}"\n  Correct answer: "${w.correctAnswer || "N/A"}"\n  Subject: ${w.subject || "General"}`
              )
              .join("\n\n")
        );
      }

      if (studentContext.weakSubjects?.length) {
        contextParts.push(
          "## Weak Subject Areas\n" +
            studentContext.weakSubjects.map((s: string) => `- ${s}`).join("\n")
        );
      }

      if (contextParts.length > 0) {
        systemMessages.push({
          role: "system",
          content:
            "Here is context about this student's performance. Use it to personalize your tutoring:\n\n" +
            contextParts.join("\n\n"),
        });
      }
    }

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
          messages: [...systemMessages, ...messages],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "I'm getting too many requests right now. Please try again in a moment! 😊",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "The AI study assistant is temporarily unavailable. Please try again later.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to connect to the AI tutor." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("study-assistant error:", e);
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
