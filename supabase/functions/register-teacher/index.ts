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
    const { fullName, email, password, phoneNumber, schoolId, subjectSpecialty } = await req.json();

    if (!fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Full name, email, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if email already exists in teachers table
    const { data: existingTeacher } = await supabaseAdmin
      .from('teachers')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingTeacher) {
      const statusMsg = existingTeacher.status === 'pending'
        ? 'A registration with this email is already pending approval.'
        : existingTeacher.status === 'rejected'
        ? 'A previous registration with this email was rejected. Please contact the administrator.'
        : 'An account with this email already exists.';
      return new Response(
        JSON.stringify({ error: statusMsg }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create auth user (auto-confirm so they can log in once approved)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      if (authError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists. Please use a different email or log in.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw authError;
    }

    const userId = authData.user.id;

    // Assign teacher role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'teacher' });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Cleanup: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to assign teacher role');
    }

    // Create teacher profile with pending status
    const { error: profileError } = await supabaseAdmin
      .from('teachers')
      .insert({
        user_id: userId,
        full_name: fullName,
        email,
        phone_number: phoneNumber || null,
        school_id: schoolId || null,
        subject_specialty: subjectSpecialty || null,
        status: 'pending',
      });

    if (profileError) {
      console.error('Teacher profile creation error:', profileError);
      // Cleanup
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to create teacher profile');
    }

    // Create user preferences
    await supabaseAdmin.from('user_preferences').insert({ user_id: userId });

    console.log(`Teacher registration pending: ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your account has been created and is pending admin approval. You will be notified once approved.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Register teacher error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
