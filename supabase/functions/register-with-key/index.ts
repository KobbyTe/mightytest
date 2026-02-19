import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

function generateStudentId(schoolCode: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  for (let i = 0; i < 4; i++) {
    suffix += chars[array[i] % chars.length];
  }
  return `STU-${schoolCode.toUpperCase()}-${suffix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      keyCode, firstName, lastName, password,
      dateOfBirth, gender, phoneNumber, city, country,
      parentName, parentGender, parentEmail, parentPhone, parentRelationship,
    } = await req.json();

    if (!keyCode || !firstName || !lastName || !password || !dateOfBirth || !gender) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parentName || !parentEmail) {
      return new Response(
        JSON.stringify({ error: 'Parent name and email are required' }),
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

    // Generate official Student ID (distinct from temporary key)
    const officialStudentId = generateStudentId(schoolRes.data.code);
    const syntheticEmail = `${officialStudentId.toLowerCase()}@studentid.internal`;
    const fullName = `${firstName} ${lastName}`;

    // Create auth user for student
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

    // --- Create Parent Account ---
    const parentPassword = generatePassword(10);
    const accessCode = generateAccessCode();

    let parentId: string | null = null;
    let parentCredentials: { email: string; password: string; accessCode: string } | null = null;
    let parentAuthUserId: string | null = null;

    const { data: parentAuthData, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parentName,
        role: 'parent',
      },
    });

    if (parentAuthError) {
      // If parent email already exists, look up existing parent
      if (parentAuthError.message?.includes('already been registered') || (parentAuthError as any).code === 'email_exists') {
        console.log('Parent email already exists, looking up existing user...');
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = usersData?.users?.find((u: any) => u.email === parentEmail);
        if (existingUser) {
          parentAuthUserId = existingUser.id;
          // Check if parent profile already exists
          const { data: existingParent } = await supabaseAdmin
            .from('parents')
            .select('id, access_code')
            .eq('user_id', existingUser.id)
            .maybeSingle();
          if (existingParent) {
            parentId = existingParent.id;
            parentCredentials = { email: parentEmail, password: '(use your existing password)', accessCode: existingParent.access_code };
          } else {
            // User exists but no parent profile - create one
            // Check if role already assigned
            const { data: existingRole } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', existingUser.id).eq('role', 'parent').maybeSingle();
            if (!existingRole) {
              await supabaseAdmin.from('user_roles').insert({ user_id: existingUser.id, role: 'parent' });
            }
            const { data: newParent } = await supabaseAdmin
              .from('parents')
              .insert({
                user_id: existingUser.id,
                full_name: parentName,
                email: parentEmail,
                phone_number: parentPhone || null,
                relationship_to_student: parentRelationship || null,
                access_code: accessCode,
              })
              .select('id')
              .single();
            if (newParent) {
              parentId = newParent.id;
              parentCredentials = { email: parentEmail, password: '(use your existing password)', accessCode };
            }
          }
        } else {
          console.error('Parent email exists but user not found in listing');
        }
      } else {
      console.error('Parent auth creation error (fatal):', parentAuthError);
      // Clean up student auth user since parent creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: parentAuthError?.message || 'Failed to create parent account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } else if (parentAuthData?.user) {
    parentAuthUserId = parentAuthData.user.id;
    // New parent account created successfully — assign role
    await supabaseAdmin.from('user_roles').insert({ user_id: parentAuthData.user.id, role: 'parent' });

    const { data: parentProfile, error: parentProfileError } = await supabaseAdmin
      .from('parents')
      .insert({
        user_id: parentAuthData.user.id,
        full_name: parentName,
        email: parentEmail,
        phone_number: parentPhone || null,
        relationship_to_student: parentRelationship || null,
        access_code: accessCode,
      })
      .select('id')
      .single();

    if (!parentProfileError && parentProfile) {
      parentId = parentProfile.id;
      parentCredentials = { email: parentEmail, password: parentPassword, accessCode };
    } else {
      console.error('Parent profile creation error (fatal):', parentProfileError);
      // Clean up both auth users
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(parentAuthData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create parent profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // FATAL CHECK: if parentId is still null after all attempts, abort
  if (!parentId) {
    console.error('Parent ID is still null after parent creation block — aborting');
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    if (parentAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(parentAuthUserId);
    }
    return new Response(
      JSON.stringify({ error: 'Failed to create or link parent account. Please try again.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create student profile with retry for FK race condition
    const studentInsertData = {
      user_id: authData.user.id,
      full_name: fullName,
      date_of_birth: dateOfBirth,
      gender: gender,
      phone_number: phoneNumber || null,
      address_city: city || null,
      address_country: country || null,
      email: syntheticEmail,
      student_id_code: officialStudentId,
      school_id: key.school_id,
      class_id: key.class_id,
      school_name: schoolRes.data.name,
      grade: classRes.data.grade_level || null,
      parent_id: parentId,
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
      // Only delete parent if we just created them (not pre-existing)
      if (parentAuthUserId && parentAuthData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(parentAuthUserId);
      }
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

    // Send parent credentials email
    if (parentCredentials) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Mighty Test <onboarding@resend.dev>',
              to: [parentCredentials.email],
              subject: `Your Parent Dashboard Login Credentials - ${fullName}'s Account`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #6366f1;">Welcome to Mighty Test! 🎓</h2>
                  <p>Dear ${parentName},</p>
                  <p>Your child <strong>${fullName}</strong> has been registered on the Mighty Test platform. Here are your login credentials to access the Parent Dashboard:</p>
                  <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>Email:</strong> ${parentCredentials.email}</p>
                    <p style="margin: 4px 0;"><strong>Password:</strong> ${parentCredentials.password}</p>
                    <p style="margin: 4px 0;"><strong>Access Code:</strong> ${parentCredentials.accessCode}</p>
                  </div>
                  <p>Please change your password after your first login for security purposes.</p>
                  <p>Best regards,<br/>The Mighty Test Team</p>
                </div>
              `,
            }),
          });
          const emailResult = await emailRes.json();
          console.log('Parent credential email sent:', emailResult);
        } catch (emailErr) {
          console.error('Failed to send parent email (non-fatal):', emailErr);
        }
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
        officialStudentId,
        parentCredentials: parentCredentials ? {
          email: parentCredentials.email,
          password: parentCredentials.password,
          accessCode: parentCredentials.accessCode,
        } : null,
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
