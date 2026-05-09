import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Try to create admin auth user
    let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });

    let userId: string | null = authData?.user?.id ?? null;

    // If user already exists, look them up and reset their password
    if (authError && /already/i.test(authError.message)) {
      console.log('User already exists, looking up and resetting password');
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const existing = list.users.find((u: any) => u.email?.toLowerCase() === String(email).toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: 'User exists but could not be located' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = existing.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), role: 'admin' }
      });
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (authError || !userId) {
      console.error('Admin auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create admin account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove any non-admin roles, then assign admin role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' });

    if (roleError) {
      console.error('Admin role assignment error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to assign admin role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully created admin account');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin account ready',
        adminId: userId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Admin creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
