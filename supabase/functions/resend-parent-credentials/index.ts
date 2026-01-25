import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendCredentialsEmail(params: {
  apiKey: string;
  to: string;
  parentName: string;
  studentName: string;
  newPassword: string;
}): Promise<{ id?: string }> {
  const { apiKey, to, parentName, studentName, newPassword } = params;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0;">🎓 STEM Olympiad Platform</h1>
      </div>
      
      <h2 style="color: #333;">Hello ${parentName}! 👋</h2>
      
      <p style="color: #666; font-size: 16px; line-height: 1.6;">
        Your login credentials for the STEM Olympiad Parent Portal have been reset. 
        Use these new credentials to monitor <strong>${studentName}</strong>'s progress.
      </p>
      
      <div style="background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 25px 0; border-left: 4px solid #667eea;">
        <h3 style="margin-top: 0; color: #333;">Your New Login Details:</h3>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 10px 0;"><strong>New Password:</strong> <code style="background: #e9ecef; padding: 5px 10px; border-radius: 4px; font-size: 18px;">${newPassword}</code></p>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        Please change your password after logging in for security purposes.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${Deno.env.get('SITE_URL') || 'https://stemolympiad.com'}/auth" 
           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Login to Parent Portal
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        This is an automated message from STEM Olympiad Platform. Please do not reply to this email.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "STEM Olympiad <noreply@resend.dev>",
      to: [to],
      subject: "Your Parent Portal Credentials Have Been Reset",
      html: emailHtml,
    }),
  });

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parentEmail, studentId } = await req.json();

    if (!parentEmail || !studentId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get parent info
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("id, user_id, full_name, email")
      .eq("email", parentEmail)
      .single();

    if (parentError || !parent) {
      return new Response(
        JSON.stringify({ success: false, error: "Parent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get student name
    const { data: student } = await supabase
      .from("students")
      .select("full_name")
      .eq("id", studentId)
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
        JSON.stringify({ success: false, error: "Failed to reset password" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email with new credentials
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;
    let emailError = null;

    if (resendApiKey) {
      try {
        const emailResult = await sendCredentialsEmail({
          apiKey: resendApiKey,
          to: parent.email,
          parentName: parent.full_name,
          studentName: student?.full_name || "your child",
          newPassword,
        });
        emailSent = !!emailResult.id;
      } catch (err: unknown) {
        emailError = err instanceof Error ? err.message : String(err);
        console.error("Email error:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        newPassword, // Return to show on dashboard temporarily
        emailSent,
        emailError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in resend-parent-credentials:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
