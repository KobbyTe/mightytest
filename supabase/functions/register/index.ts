import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

type ResendSendResult = { id?: string };

async function sendParentCredentialsEmail(params: {
  apiKey: string;
  to: string;
  parentFullName: string;
  studentFullName: string;
  parentPassword: string;
  accessCode: string;
}): Promise<ResendSendResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb; margin-bottom: 20px;">Welcome to STEM Learning Platform!</h1>
      <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${params.parentFullName},</p>
      <p style="font-size: 16px; line-height: 1.5; color: #333;">
        Your child <strong>${params.studentFullName}</strong> has successfully registered on our STEM Learning Platform.
        We've created a parent account for you to monitor their progress and achievements.
      </p>
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <h2 style="color: #1f2937; margin-top: 0; font-size: 18px;">Your Parent Login Credentials:</h2>
        <p style="margin: 10px 0;"><strong>Email:</strong> ${params.to}</p>
        <p style="margin: 10px 0;"><strong>Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${params.parentPassword}</code></p>
        <p style="margin: 10px 0;"><strong>Access Code:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${params.accessCode}</code></p>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #6b7280; margin-top: 30px;">
        <strong>Important:</strong> Please keep these credentials safe. We recommend changing your password after your first login.
      </p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'STEM Learning Platform <onboarding@resend.dev>',
      to: [params.to],
      subject: "Your Child's STEM Learning Account - Parent Access",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Email API failed (${res.status}): ${text}`);
  }

  return await res.json();
}

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
      schoolId,
      classId,
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

    // Create (or reuse) parent auth user + profile.
    // IMPORTANT: Parent email can be reused across siblings; if it already exists,
    // we reset the password and reuse the existing parent profile.
    let parentUserId: string | null = null;
    let parentProfile: any = null;
    let finalAccessCode = accessCode;

    const { data: parentAuthData, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parentFullName,
        role: 'parent',
        access_code: accessCode,
      },
    });

    if (parentAuthError?.code === 'email_exists') {
      // Parent already exists: fetch their profile and reset their password.
      const { data: existingParent, error: existingParentError } = await supabaseAdmin
        .from('parents')
        .select('id,user_id,access_code,full_name,email')
        .eq('email', parentEmail)
        .maybeSingle();

      if (existingParentError || !existingParent) {
        console.error('Parent exists in auth but no parent profile found:', existingParentError);
        // Clean up student user since we cannot safely link the student to a parent
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'Parent email already exists. Please use a different parent email or contact support.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      parentUserId = existingParent.user_id;
      parentProfile = existingParent;
      finalAccessCode = existingParent.access_code || accessCode;

      const existingParentUserId = existingParent.user_id;
      const { error: resetParentError } = await supabaseAdmin.auth.admin.updateUserById(existingParentUserId, {
        password: parentPassword,
        email_confirm: true,
        user_metadata: {
          full_name: parentFullName,
          role: 'parent',
          access_code: finalAccessCode,
        },
      });

      if (resetParentError) {
        console.error('Parent password reset error:', resetParentError);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'Failed to update existing parent account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Keep parent profile updated with latest details
      await supabaseAdmin
        .from('parents')
        .update({
          full_name: parentFullName,
          phone_number: parentPhone,
          relationship_to_student: parentRelationship || 'guardian',
          access_code: finalAccessCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parentProfile.id);
    } else if (parentAuthError || !parentAuthData.user) {
      console.error('Parent auth creation error:', parentAuthError);
      // Clean up student user if parent creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: parentAuthError?.message || 'Failed to create parent account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      parentUserId = parentAuthData.user.id;

      // Create parent profile
      const { data: createdParentProfile, error: parentProfileError } = await supabaseAdmin
        .from('parents')
        .insert({
          user_id: parentUserId,
          full_name: parentFullName,
          email: parentEmail,
          phone_number: parentPhone,
          relationship_to_student: parentRelationship || 'guardian',
          access_code: accessCode,
        })
        .select()
        .single();

      if (parentProfileError) {
        console.error('Parent profile creation error:', parentProfileError);
        // Clean up both users
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(parentUserId);
        return new Response(
          JSON.stringify({ error: 'Failed to create parent profile' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      parentProfile = createdParentProfile;
    }

    // Create student profile with school_id and class_id
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
        school_id: schoolId || null,
        class_id: classId || null,
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
      if (parentUserId) {
        await supabaseAdmin.auth.admin.deleteUser(parentUserId);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create student profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign roles (idempotent)
    await supabaseAdmin.from('user_roles').insert({ user_id: authData.user.id, role: 'student' });
    if (parentUserId) {
      await supabaseAdmin.from('user_roles').insert({ user_id: parentUserId, role: 'parent' });
    }

    // Auto-enroll student in exams assigned to their class
    if (classId) {
      const { data: classExams } = await supabaseAdmin
        .from('exam_class_assignments')
        .select('exam_id')
        .eq('class_id', classId)
        .eq('is_active', true);

      if (classExams && classExams.length > 0) {
        // Get student ID
        const { data: studentData } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('user_id', authData.user.id)
          .single();

        if (studentData) {
          const examAttempts = classExams.map(ea => ({
            student_id: studentData.id,
            exam_id: ea.exam_id,
            status: 'pending'
          }));

          await supabaseAdmin
            .from('exam_attempts')
            .insert(examAttempts);
          
          console.log(`Auto-enrolled student in ${classExams.length} exam(s)`);
        }
      }
    }

    console.log('Successfully created student and parent accounts');

    // Send email to parent with login credentials
    let emailSent = false;
    let emailError = null;
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      console.log('Resend API Key configured:', !!resendApiKey);
      
      if (resendApiKey) {
        const emailResult = await sendParentCredentialsEmail({
          apiKey: resendApiKey,
          to: parentEmail,
          parentFullName,
          studentFullName: fullName,
        parentPassword,
        accessCode: finalAccessCode,
        });

        console.log('Email API result:', JSON.stringify(emailResult));
        emailSent = true;
      }
    } catch (err) {
      console.error('Failed to send parent email:', err);
      emailError = err instanceof Error ? err.message : 'Unknown email error';
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? 'Registration successful. Parent login details sent to email.'
          : 'Registration successful. Email could not be sent - please share credentials manually.',
        studentId: authData.user.id,
         parentAccessCode: finalAccessCode,
        parentEmail: parentEmail,
        parentPassword: parentPassword, // Include password so it can be displayed on dashboard
        emailSent: emailSent,
        emailError: emailError
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
