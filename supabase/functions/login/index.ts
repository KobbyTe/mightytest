import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, userType } = await req.json();

    if (!email || !password || !userType) {
      return new Response(
        JSON.stringify({ error: 'Email, password, and user type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Attempt login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.session) {
      console.error('Login error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user role matches requested type
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .eq('role', userType)
      .single();

    if (!roleData) {
      await supabase.auth.signOut();
      return new Response(
        JSON.stringify({ error: `This account is not registered as a ${userType}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile based on type
    let profile = null;
    if (userType === 'student') {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();
      profile = data;
    } else if (userType === 'parent') {
      const { data } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();
      profile = data;
    }

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    console.log(`Successful login for ${userType}: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        session: authData.session,
        user: authData.user,
        role: userType,
        profile,
        preferences
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});