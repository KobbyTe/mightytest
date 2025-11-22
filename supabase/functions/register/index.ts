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
    const {
      fullName,
      dateOfBirth,
      gender,
      email,
      phoneNumber,
      addressCity,
      addressCountry,
      grade,
      schoolName,
      studentSchoolId,
      stemInterests,
      programmingExperience,
      programmingLanguages,
      parentFullName,
      parentEmail,
      parentPhone,
      parentRelationship,
      password
    } = await req.json();

    // Validate required fields
    if (!fullName || !dateOfBirth || !email || !password || !parentFullName || !parentEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if email already exists
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('email')
      .eq('email', email)
      .single();

    if (existingStudent) {
      return new Response(
        JSON.stringify({ error: 'Email already registered' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create student auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'student'
      }
    });

    if (authError || !authData.user) {
      console.error('Student auth creation error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Failed to create student account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate parent access code (8 characters)
    const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Generate parent password
    const parentPassword = Math.random().toString(36).substring(2, 14) + 'A1!';

    // Create parent auth user
    const { data: parentAuthData, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parentFullName,
        role: 'parent',
        access_code: accessCode
      }
    });

    if (parentAuthError || !parentAuthData.user) {
      console.error('Parent auth creation error:', parentAuthError);
      // Clean up student user if parent creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create parent account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create parent profile
    const { data: parentProfile, error: parentProfileError } = await supabaseAdmin
      .from('parents')
      .insert({
        user_id: parentAuthData.user.id,
        full_name: parentFullName,
        email: parentEmail,
        phone_number: parentPhone,
        relationship_to_student: parentRelationship || 'guardian',
        access_code: accessCode
      })
      .select()
      .single();

    if (parentProfileError) {
      console.error('Parent profile creation error:', parentProfileError);
      // Clean up both users
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(parentAuthData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create parent profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create student profile
    const { error: studentProfileError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        date_of_birth: dateOfBirth,
        gender: gender || 'prefer_not_to_say',
        email,
        phone_number: phoneNumber,
        address_city: addressCity,
        address_country: addressCountry,
        grade,
        school_name: schoolName,
        student_school_id: studentSchoolId,
        parent_id: parentProfile.id,
        stem_interests: stemInterests || [],
        programming_experience: programmingExperience || 'beginner',
        programming_languages: programmingLanguages || []
      });

    if (studentProfileError) {
      console.error('Student profile creation error:', studentProfileError);
      // Clean up all created data
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(parentAuthData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create student profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign student role
    await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'student' });

    // Assign parent role
    await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: parentAuthData.user.id, role: 'parent' });

    console.log('Successfully created student and parent accounts');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Registration successful',
        studentId: authData.user.id,
        parentAccessCode: accessCode,
        parentPassword: parentPassword,
        parentEmail: parentEmail
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});