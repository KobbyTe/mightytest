import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sendArkeselSMS(apiKey: string, to: string, message: string, sender: string = 'MightyTest') {
  try {
    const params = new URLSearchParams({
      action: 'send-sms',
      api_key: apiKey,
      to: to,
      from: sender,
      sms: message,
    });

    const res = await fetch(`https://sms.arkesel.com/sms/api?${params.toString()}`);
    const result = await res.text();
    console.log(`SMS to ${to}: ${result}`);
    return res.ok;
  } catch (err) {
    console.error(`SMS error to ${to}:`, err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { exam_id, class_id, due_date } = await req.json();

    if (!exam_id || !class_id) {
      throw new Error('Missing exam_id or class_id');
    }

    console.log('Notifying students for exam assignment:', { exam_id, class_id });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch exam details
    const { data: exam, error: examError } = await supabaseClient
      .from('exams')
      .select('title, subject, duration_minutes, total_marks, exam_date, description')
      .eq('id', exam_id)
      .single();

    if (examError || !exam) {
      throw new Error('Exam not found');
    }

    // Fetch class + school details
    const { data: classData, error: classError } = await supabaseClient
      .from('classes')
      .select('name, grade_level, school:schools(name)')
      .eq('id', class_id)
      .single();

    if (classError || !classData) {
      throw new Error('Class not found');
    }

    // Fetch all students in this class (include parent_id and phone_number)
    const { data: students, error: studentsError } = await supabaseClient
      .from('students')
      .select('full_name, email, phone_number, parent_id')
      .eq('class_id', class_id)
      .eq('account_status', 'active');

    if (studentsError) {
      throw studentsError;
    }

    if (!students || students.length === 0) {
      console.log('No students found in class', class_id);
      return new Response(
        JSON.stringify({ success: true, message: 'No students in class', emailsSent: 0, smsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${students.length} students to notify`);

    // Fetch parent details for students that have parents
    const parentIds = [...new Set(students.filter(s => s.parent_id).map(s => s.parent_id))];
    let parentsMap: Record<string, { full_name: string; phone_number: string | null }> = {};

    if (parentIds.length > 0) {
      const { data: parents } = await supabaseClient
        .from('parents')
        .select('id, full_name, phone_number')
        .in('id', parentIds);

      if (parents) {
        for (const p of parents) {
          parentsMap[p.id] = { full_name: p.full_name, phone_number: p.phone_number };
        }
      }
    }

    const schoolName = (classData.school as any)?.name || 'Your School';
    const dueDateFormatted = due_date
      ? new Date(due_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;
    const examDateFormatted = exam.exam_date
      ? new Date(exam.exam_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const ARKESEL_API_KEY = Deno.env.get('ARKESEL_API_KEY');

    let emailSuccessCount = 0;
    let emailFailCount = 0;
    let smsStudentCount = 0;
    let smsParentCount = 0;

    for (const student of students) {
      // --- Email notification (existing) ---
      if (RESEND_API_KEY && student.email) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0;">📝 New Exam Assigned!</h1>
                </div>
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                  <p>Hi <strong>${student.full_name}</strong>,</p>
                  <p>A new exam has been assigned to your class <strong>${classData.name}</strong> at <strong>${schoolName}</strong>.</p>
                  
                  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h2 style="margin-top: 0; color: #0369a1;">${exam.title}</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${exam.subject ? `<tr><td style="padding: 6px 0; font-weight: 600;">Subject:</td><td style="padding: 6px 0;">${exam.subject}</td></tr>` : ''}
                      <tr><td style="padding: 6px 0; font-weight: 600;">Total Marks:</td><td style="padding: 6px 0;">${exam.total_marks}</td></tr>
                      ${exam.duration_minutes ? `<tr><td style="padding: 6px 0; font-weight: 600;">Duration:</td><td style="padding: 6px 0;">${exam.duration_minutes} minutes</td></tr>` : ''}
                      ${examDateFormatted ? `<tr><td style="padding: 6px 0; font-weight: 600;">Exam Date:</td><td style="padding: 6px 0;">${examDateFormatted}</td></tr>` : ''}
                      ${dueDateFormatted ? `<tr><td style="padding: 6px 0; font-weight: 600;">Due Date:</td><td style="padding: 6px 0;">${dueDateFormatted}</td></tr>` : ''}
                    </table>
                    ${exam.description ? `<p style="margin-bottom: 0; color: #555;">${exam.description}</p>` : ''}
                  </div>

                  <p>Log in to your dashboard to start the exam when you're ready. Good luck! 🍀</p>
                </div>
                <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; border-radius: 0 0 8px 8px; font-size: 14px;">
                  <p style="margin: 0;">STEM Academy | Excellence in Education</p>
                </div>
              </div>
            </body>
          </html>
        `;

        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'STEM Academy <onboarding@resend.dev>',
              to: [student.email],
              subject: `📝 New Exam Assigned: ${exam.title}`,
              html,
            }),
          });

          const result = await res.text();
          if (res.ok) {
            emailSuccessCount++;
          } else {
            emailFailCount++;
            console.error(`Failed to email ${student.email}:`, result);
          }
        } catch (emailErr) {
          emailFailCount++;
          console.error(`Error emailing ${student.email}:`, emailErr);
        }
      }

      // --- SMS notifications via Arkesel ---
      if (ARKESEL_API_KEY) {
        const duePart = dueDateFormatted ? ` Due: ${dueDateFormatted}.` : '';
        
        // SMS to student
        if (student.phone_number) {
          const studentMsg = `Hi ${student.full_name}, a new exam "${exam.title}" (${exam.subject || 'General'}) has been assigned to your class ${classData.name}.${duePart} Log in to your dashboard to take it. Good luck!`;
          const sent = await sendArkeselSMS(ARKESEL_API_KEY, student.phone_number, studentMsg);
          if (sent) smsStudentCount++;
        }

        // SMS to parent
        if (student.parent_id && parentsMap[student.parent_id]) {
          const parent = parentsMap[student.parent_id];
          if (parent.phone_number) {
            const parentMsg = `Dear ${parent.full_name}, a new exam "${exam.title}" (${exam.subject || 'General'}) has been assigned to your child ${student.full_name} in class ${classData.name} at ${schoolName}.${duePart} Please ensure they are prepared.`;
            const sent = await sendArkeselSMS(ARKESEL_API_KEY, parent.phone_number, parentMsg);
            if (sent) smsParentCount++;
          }
        }
      }
    }

    console.log(`Notifications complete: emails=${emailSuccessCount} sent/${emailFailCount} failed, SMS students=${smsStudentCount}, SMS parents=${smsParentCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailSuccessCount,
        emailsFailed: emailFailCount,
        smsStudentsSent: smsStudentCount,
        smsParentsSent: smsParentCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-exam-assigned:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
