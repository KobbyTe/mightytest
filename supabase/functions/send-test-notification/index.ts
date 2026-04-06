import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin or teacher
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.user.id;

    // Check admin or teacher role
    const { data: roleCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'teacher']);

    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin or teacher role required' }), { status: 403, headers: corsHeaders });
    }

    const { target_roles, title, message } = await req.json();
    const roles = target_roles || ['student', 'teacher'];
    const notifTitle = title || '🔔 Test Notification';
    const notifMessage = message || 'This is a test notification from the admin. If you see this, push notifications are working!';

    // Get user_ids for the target roles
    const { data: targetUsers, error: targetError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .in('role', roles);

    if (targetError) throw targetError;

    if (!targetUsers || targetUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No users found with the specified roles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate user_ids
    const uniqueUserIds = [...new Set(targetUsers.map(u => u.user_id))];

    // Batch insert notifications
    const notifications = uniqueUserIds.map(uid => ({
      user_id: uid,
      title: notifTitle,
      message: notifMessage,
      type: 'info',
      is_read: false,
      link: null,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    console.log(`Test notifications sent to ${uniqueUserIds.length} users (roles: ${roles.join(', ')})`);

    return new Response(
      JSON.stringify({ success: true, sent: uniqueUserIds.length, roles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-test-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
