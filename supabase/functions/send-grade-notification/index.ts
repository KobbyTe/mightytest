import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attemptId } = await req.json();

    if (!attemptId) {
      throw new Error('Missing attemptId');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch attempt details with student, exam, and answers
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('exam_attempts')
      .select(`
        *,
        student:students(full_name, email),
        exam:exams(title, total_marks, passing_marks)
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError) throw attemptError;

    // Fetch answers with questions
    const { data: answers, error: answersError } = await supabaseClient
      .from('exam_answers')
      .select(`
        *,
        question:exam_questions(question_text, marks)
      `)
      .eq('attempt_id', attemptId);

    if (answersError) throw answersError;

    const correctCount = answers?.filter(a => a.is_correct).length || 0;
    const totalQuestions = answers?.length || 0;
    const passed = (attempt.marks_obtained || 0) >= attempt.exam.passing_marks;

    // Build summary of correct/incorrect answers
    const answersSummary = answers?.map((a, idx) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: center;">${idx + 1}</td>
        <td style="padding: 12px;">${a.question.question_text.substring(0, 60)}...</td>
        <td style="padding: 12px; text-align: center;">
          ${a.is_correct ? 
            '<span style="color: #22c55e;">✓ Correct</span>' : 
            '<span style="color: #ef4444;">✗ Incorrect</span>'}
        </td>
        <td style="padding: 12px; text-align: center;">${a.marks_awarded || 0}/${a.question.marks}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .score-box { background: ${passed ? '#dcfce7' : '#fee2e2'}; border: 2px solid ${passed ? '#22c55e' : '#ef4444'}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
            .score { font-size: 32px; font-weight: bold; color: ${passed ? '#15803d' : '#dc2626'}; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; border-radius: 0 0 8px 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Your Exam Has Been Graded!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${attempt.student.full_name}</strong>,</p>
              <p>Great news! Your exam <strong>"${attempt.exam.title}"</strong> has been graded by your instructor.</p>
              
              <div class="score-box">
                <div style="font-size: 18px; margin-bottom: 10px;">${passed ? '🎉 Congratulations! You Passed!' : '📚 Keep Learning!'}</div>
                <div class="score">${attempt.marks_obtained} / ${attempt.exam.total_marks}</div>
                <div style="margin-top: 10px;">
                  ${correctCount} correct out of ${totalQuestions} questions
                </div>
              </div>

              ${attempt.feedback ? `
                <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
                  <strong>📝 Instructor Feedback:</strong>
                  <p style="margin: 10px 0 0 0;">${attempt.feedback}</p>
                </div>
              ` : ''}

              <h3>Answer Summary:</h3>
              <table>
                <thead>
                  <tr>
                    <th style="text-align: center;">Q#</th>
                    <th>Question</th>
                    <th style="text-align: center;">Result</th>
                    <th style="text-align: center;">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  ${answersSummary}
                </tbody>
              </table>

              <p style="margin-top: 30px;">
                ${passed ? 
                  'You can download your completion certificate from your dashboard!' : 
                  'Don\'t worry! Review the material and try again when you\'re ready.'}
              </p>
            </div>
            <div class="footer">
              <p>STEM Academy | Excellence in Education</p>
              <p style="font-size: 12px; margin-top: 10px;">This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'STEM Academy <onboarding@resend.dev>',
      to: [attempt.student.email],
      subject: `${passed ? '🎉' : '📋'} Your ${attempt.exam.title} Results Are Ready!`,
      html,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw emailError;
    }

    console.log('Grade notification email sent to:', attempt.student.email);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-grade-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
