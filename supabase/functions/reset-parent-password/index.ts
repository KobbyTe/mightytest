import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify parent exists
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("id, user_id, full_name, email")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (parentError || !parent) {
      // Don't reveal whether email exists for security
      return new Response(
        JSON.stringify({ success: true, message: "If a parent account exists with this email, new credentials will be sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get linked student name
    const { data: student } = await supabase
      .from("students")
      .select("full_name")
      .eq("parent_id", parent.id)
      .limit(1)
      .single();

    // Generate new password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

    // Update auth user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      parent.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reset credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendApiKey) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0;">🎓 STEM Olympiad Platform</h1>
            </div>
            <h2 style="color: #333;">Hello ${parent.full_name}! 👋</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You requested new login credentials for the STEM Olympiad Parent Portal.
              Use these to monitor <strong>${student?.full_name || "your child"}</strong>'s progress.
            </p>
            <div style="background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #333;">Your New Login Details:</h3>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${parent.email}</p>
              <p style="margin: 10px 0;"><strong>New Password:</strong> <code style="background: #e9ecef; padding: 5px 10px; border-radius: 4px; font-size: 18px;">${newPassword}</code></p>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you did not request this, please contact support. This is an automated message.
            </p>
          </div>
        `;

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "STEM Olympiad <noreply@resend.dev>",
            to: [parent.email],
            subject: "Your Parent Portal Credentials Have Been Reset",
            html: emailHtml,
          }),
        });

        const result = await response.json();
        emailSent = !!result.id;
      } catch (err) {
        console.error("Email send error:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "If a parent account exists with this email, new credentials will be sent.",
        emailSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in reset-parent-password:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
