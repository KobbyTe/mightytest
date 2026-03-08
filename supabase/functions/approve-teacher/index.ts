import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the caller is an admin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Only administrators can approve teachers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { teacherId, action } = await req.json();

    if (!teacherId || !action || !['approved', 'rejected'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Teacher ID and valid action (approved/rejected) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update teacher status
    const { data: teacher, error: updateError } = await supabaseAdmin
      .from('teachers')
      .update({
        status: action,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', teacherId)
      .select('user_id, full_name, email')
      .single();

    if (updateError || !teacher) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Teacher not found or update failed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notification for the teacher
    await supabaseAdmin.from('notifications').insert({
      user_id: teacher.user_id,
      title: action === 'approved' ? 'Account Approved! 🎉' : 'Account Not Approved',
      message: action === 'approved'
        ? 'Your teacher account has been approved. You can now log in and access the dashboard.'
        : 'Your teacher account registration was not approved. Please contact the administrator for more information.',
      type: action === 'approved' ? 'success' : 'warning',
      link: action === 'approved' ? '/auth' : null,
    });

    console.log(`Teacher ${teacher.email} ${action} by admin ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, action, teacher: { id: teacherId, name: teacher.full_name, email: teacher.email } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Approve teacher error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
