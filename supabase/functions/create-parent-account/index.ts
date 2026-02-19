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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { studentId, parentName, parentEmail, parentPhone, parentRelationship } = await req.json();

    if (!studentId || !parentName || !parentEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: studentId, parentName, parentEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify student exists and has no parent
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, full_name, parent_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (student.parent_id) {
      return new Response(
        JSON.stringify({ error: 'Student already has a linked parent account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parentPassword = generatePassword(10);
    const accessCode = generateAccessCode();
    let parentId: string | null = null;
    let parentUserId: string | null = null;
    let isExistingParent = false;

    // Try to create parent auth user
    const { data: parentAuthData, error: parentAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      user_metadata: { full_name: parentName, role: 'parent' },
    });

    if (parentAuthError) {
      if (parentAuthError.message?.includes('already been registered') || (parentAuthError as any).code === 'email_exists') {
        // Parent email already exists — check for existing parent profile
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = usersData?.users?.find((u: any) => u.email === parentEmail);
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: 'Parent email exists in auth but user not found' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        parentUserId = existingUser.id;

        const { data: existingParent } = await supabaseAdmin
          .from('parents')
          .select('id, access_code')
          .eq('user_id', existingUser.id)
          .maybeSingle();

        if (existingParent) {
          parentId = existingParent.id;
          isExistingParent = true;
        } else {
          // Auth user exists but no parent profile — create profile + role
          const { data: existingRole } = await supabaseAdmin.from('user_roles').select('id').eq('user_id', existingUser.id).eq('role', 'parent').maybeSingle();
          if (!existingRole) {
            await supabaseAdmin.from('user_roles').insert({ user_id: existingUser.id, role: 'parent' });
          }

          const { data: newParent, error: newParentErr } = await supabaseAdmin
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

          if (newParentErr || !newParent) {
            return new Response(
              JSON.stringify({ error: 'Failed to create parent profile for existing auth user' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          parentId = newParent.id;
        }
      } else {
        return new Response(
          JSON.stringify({ error: parentAuthError.message || 'Failed to create parent auth account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (parentAuthData?.user) {
      parentUserId = parentAuthData.user.id;

      // Assign parent role
      await supabaseAdmin.from('user_roles').insert({ user_id: parentAuthData.user.id, role: 'parent' });

      // Create parent profile
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

      if (parentProfileError || !parentProfile) {
        // Clean up auth user
        await supabaseAdmin.auth.admin.deleteUser(parentAuthData.user.id);
        return new Response(
          JSON.stringify({ error: 'Failed to create parent profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      parentId = parentProfile.id;
    }

    if (!parentId) {
      return new Response(
        JSON.stringify({ error: 'Failed to resolve parent account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link parent to student
    const { error: linkError } = await supabaseAdmin
      .from('students')
      .update({ parent_id: parentId })
      .eq('id', studentId);

    if (linkError) {
      return new Response(
        JSON.stringify({ error: 'Failed to link parent to student' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send credentials email (only for new accounts)
    if (!isExistingParent) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Mighty Test <onboarding@resend.dev>',
              to: [parentEmail],
              subject: `Your Parent Dashboard Login Credentials - ${student.full_name}'s Account`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #6366f1;">Welcome to Mighty Test! 🎓</h2>
                  <p>Dear ${parentName},</p>
                  <p>Your child <strong>${student.full_name}</strong> is registered on the Mighty Test platform. Here are your login credentials to access the Parent Dashboard:</p>
                  <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>Email:</strong> ${parentEmail}</p>
                    <p style="margin: 4px 0;"><strong>Password:</strong> ${parentPassword}</p>
                    <p style="margin: 4px 0;"><strong>Access Code:</strong> ${accessCode}</p>
                  </div>
                  <p>Please change your password after your first login for security purposes.</p>
                  <p>Best regards,<br/>The Mighty Test Team</p>
                </div>
              `,
            }),
          });
          console.log('Parent credential email sent to:', parentEmail);
        } catch (emailErr) {
          console.error('Failed to send parent email (non-fatal):', emailErr);
        }
      }
    }

    console.log(`Successfully created/linked parent account for student ${student.full_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        parentId,
        isExistingParent,
        credentials: isExistingParent ? null : {
          email: parentEmail,
          password: parentPassword,
          accessCode,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create parent account error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
