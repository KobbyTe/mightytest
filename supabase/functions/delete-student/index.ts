import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { student_id } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: "student_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get student's user_id
    const { data: student, error: studentErr } = await adminClient
      .from("students")
      .select("user_id")
      .eq("id", student_id)
      .maybeSingle();

    if (studentErr || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete related records in correct order to avoid FK constraint errors

    // 1. Get all exam attempt IDs for this student
    const { data: attempts } = await adminClient
      .from("exam_attempts")
      .select("id")
      .eq("student_id", student_id);

    const attemptIds = (attempts || []).map(a => a.id);

    // 2. Delete exam_answers for those attempts
    if (attemptIds.length > 0) {
      await adminClient
        .from("exam_answers")
        .delete()
        .in("attempt_id", attemptIds);
    }

    // 3. Delete exam_attempts
    await adminClient
      .from("exam_attempts")
      .delete()
      .eq("student_id", student_id);

    // 4. Delete registration_keys claimed by this student
    await adminClient
      .from("registration_keys")
      .update({ claimed_by: null, claimed_at: null, status: "active" })
      .eq("claimed_by", student_id);

    // 5. Delete user_preferences
    await adminClient
      .from("user_preferences")
      .delete()
      .eq("user_id", student.user_id);

    // 6. Delete user_roles
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", student.user_id);

    // 7. Delete student record
    await adminClient
      .from("students")
      .delete()
      .eq("id", student_id);

    // 8. Delete parent if exists and no other children reference it
    // (skip for now — parent may have multiple children)

    // 9. Finally delete the auth user
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(student.user_id);
    if (deleteErr) {
      throw deleteErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
