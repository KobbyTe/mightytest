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
    const { class_id } = await req.json();
    if (!class_id) {
      return new Response(JSON.stringify({ error: "class_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch class info
    const { data: classData, error: classErr } = await supabase
      .from("classes")
      .select("id, name, grade_level, school_id, schools(name)")
      .eq("id", class_id)
      .single();

    if (classErr) throw classErr;

    // Fetch students in class
    const { data: students, error: studErr } = await supabase
      .from("students")
      .select("id, full_name, email, grade, student_id_code")
      .eq("class_id", class_id)
      .order("full_name");

    if (studErr) throw studErr;
    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ error: "No students in class" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all attempts for these students
    const studentIds = students.map((s) => s.id);
    const { data: attempts, error: attErr } = await supabase
      .from("exam_attempts")
      .select("student_id, exam_id, marks_obtained, status, exams(title, total_marks, passing_marks, subject)")
      .in("student_id", studentIds)
      .in("status", ["graded", "completed"]);

    if (attErr) throw attErr;

    // Build student performance data
    const studentPerformance = students.map((student) => {
      const studentAttempts = (attempts || []).filter((a) => a.student_id === student.id);
      const graded = studentAttempts.filter((a) => a.status === "graded" && a.marks_obtained !== null);
      const passed = graded.filter((a) => a.marks_obtained! >= (a.exams as any)?.passing_marks);
      const totalMarks = graded.reduce((s, a) => s + ((a.exams as any)?.total_marks || 0), 0);
      const marksObtained = graded.reduce((s, a) => s + (a.marks_obtained || 0), 0);
      const avgPct = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;

      return {
        name: student.full_name,
        studentId: student.student_id_code || "N/A",
        email: student.email || "N/A",
        grade: student.grade || "N/A",
        examsTaken: graded.length,
        totalMarks,
        marksObtained,
        averagePercentage: avgPct.toFixed(1),
        passRate: graded.length > 0 ? ((passed.length / graded.length) * 100).toFixed(1) : "0.0",
        status: avgPct >= 90 ? "Excellent" : avgPct >= 75 ? "Good" : avgPct >= 60 ? "Satisfactory" : "Needs Improvement",
        exams: graded.map((a) => ({
          title: (a.exams as any)?.title || "Unknown",
          subject: (a.exams as any)?.subject || "General",
          score: `${a.marks_obtained}/${(a.exams as any)?.total_marks}`,
          passed: a.marks_obtained! >= ((a.exams as any)?.passing_marks || 0),
        })),
      };
    });

    // Use AI to generate summary remarks
    const classAvg = studentPerformance.length > 0
      ? (studentPerformance.reduce((s, sp) => s + parseFloat(sp.averagePercentage), 0) / studentPerformance.length).toFixed(1)
      : "0.0";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an educational report writer. Generate a brief, professional 2-3 sentence summary of a class performance report.",
          },
          {
            role: "user",
            content: `Class: ${classData.name}, Grade Level: ${classData.grade_level || "N/A"}, School: ${(classData.schools as any)?.name || "Unknown"}.
Students: ${students.length}, Class Average: ${classAvg}%.
Top performer: ${studentPerformance.sort((a, b) => parseFloat(b.averagePercentage) - parseFloat(a.averagePercentage))[0]?.name || "N/A"}.
Generate a brief professional summary for this class performance report.`,
          },
        ],
      }),
    });

    let aiSummary = "";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      aiSummary = aiData.choices?.[0]?.message?.content || "";
    }

    return new Response(
      JSON.stringify({
        success: true,
        report: {
          className: classData.name,
          gradeLevel: classData.grade_level,
          schoolName: (classData.schools as any)?.name || "Unknown",
          generatedAt: new Date().toISOString(),
          classAverage: classAvg,
          totalStudents: students.length,
          aiSummary,
          students: studentPerformance,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-pdf-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
