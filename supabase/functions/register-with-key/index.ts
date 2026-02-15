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
    const { keyCode, firstName, lastName, password } = await req.json();

    if (!keyCode || !firstName || !lastName || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate key
    const { data: key, error: keyError } = await supabaseAdmin
      .from('registration_keys')
      .select('id, key_code, school_id, class_id, status')
      .eq('key_code', keyCode.toUpperCase())
      .maybeSingle();

    if (keyError || !key) {
      return new Response(
        JSON.stringify({ error: 'Invalid or already-claimed ID. Please contact your teacher.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (key.status !== 'available') {
      return new Response(
        JSON.stringify({ error: 'Invalid or already-claimed ID. Please contact your teacher.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get school and class info
    const [schoolRes, classRes] = await Promise.all([
      supabaseAdmin.from('schools').select('name, code').eq('id', key.school_id).single(),
      supabaseAdmin.from('classes').select('name, grade_level').eq('id', key.class_id).single(),
    ]);

    if (schoolRes.error || classRes.error) {
      return new Response(
        JSON.stringify({ error: 'Failed to look up school/class information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create synthetic email from key code
    const syntheticEmail = `${keyCode.toLowerCase()}@studentid.internal`;
    const fullName = `${firstName} ${lastName}`;

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'student',
      },
    });

    if (authError || !authData.user) {
      console.error('Auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create student profile with retry for FK race condition
    const studentInsertData = {
      user_id: authData.user.id,
      full_name: fullName,
      date_of_birth: '2000-01-01', // Default; can be updated later
      email: syntheticEmail,
      student_id_code: keyCode.toUpperCase(),
      school_id: key.school_id,
      class_id: key.class_id,
      school_name: schoolRes.data.name,
      grade: classRes.data.grade_level || null,
    };

    let studentProfileError: any = null;
    let studentData: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabaseAdmin.from('students').insert(studentInsertData).select('id').single();
      if (!error) {
        studentData = data;
        studentProfileError = null;
        break;
      }
      if (error.code === '23503' && error.message?.includes('students_user_id_fkey')) {
        console.log(`Student insert FK race, retry ${attempt + 1}/3...`);
        await new Promise(r => setTimeout(r, 500));
        studentProfileError = error;
      } else {
        studentProfileError = error;
        break;
      }
    }

    if (studentProfileError || !studentData) {
      console.error('Student profile error:', studentProfileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create student profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign student role
    await supabaseAdmin.from('user_roles').insert({ user_id: authData.user.id, role: 'student' });

    // Mark key as claimed
    await supabaseAdmin.from('registration_keys').update({
      status: 'claimed',
      claimed_by: studentData.id,
      claimed_at: new Date().toISOString(),
    }).eq('id', key.id);

    // Auto-enroll in class exams
    if (key.class_id) {
      const { data: classExams } = await supabaseAdmin
        .from('exam_class_assignments')
        .select('exam_id')
        .eq('class_id', key.class_id)
        .eq('is_active', true);

      if (classExams && classExams.length > 0) {
        const examAttempts = classExams.map(ea => ({
          student_id: studentData.id,
          exam_id: ea.exam_id,
          status: 'pending',
        }));
        await supabaseAdmin.from('exam_attempts').insert(examAttempts);
        console.log(`Auto-enrolled student in ${classExams.length} exam(s)`);
      }
    }

    // Sign in to get session for auto-login
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    console.log('Successfully registered student via key:', keyCode);

    return new Response(
      JSON.stringify({
        success: true,
        session: signInData?.session || null,
        user: authData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
