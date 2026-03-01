import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Bug #8 fix: Use raw fetch instead of Resend SDK
async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'STEM Academy <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Resend error:', data);
    return { error: data };
  }
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attemptId, notifyParent = true } = await req.json();

    if (!attemptId) {
      throw new Error('Missing attemptId');
    }

    console.log('Processing grade notification for attempt:', attemptId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch attempt details with student, exam, and parent info
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('exam_attempts')
      .select(`
        *,
        student:students(id, full_name, email, parent_id),
        exam:exams(title, total_marks, passing_marks)
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError) {
      console.error('Error fetching attempt:', attemptError);
      throw attemptError;
    }

    console.log('Attempt data:', JSON.stringify(attempt));

    // Fetch parent info if student has a parent linked
    let parentData = null;
    if (attempt.student.parent_id && notifyParent) {
      const { data: parent, error: parentError } = await supabaseClient
        .from('parents')
        .select('full_name, email')
        .eq('id', attempt.student.parent_id)
        .single();

      if (!parentError && parent) {
        parentData = parent;
        console.log('Parent data:', JSON.stringify(parentData));
      }
    }

    // Fetch answers with questions
    const { data: answers, error: answersError } = await supabaseClient
      .from('exam_answers')
      .select(`
        *,
        question:exam_questions(question_text, marks)
      `)
      .eq('attempt_id', attemptId);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
      throw answersError;
    }

    const correctCount = answers?.filter(a => a.is_correct).length || 0;
    const totalQuestions = answers?.length || 0;
    const passed = (attempt.marks_obtained || 0) >= attempt.exam.passing_marks;
    const scorePercentage = attempt.exam.total_marks > 0 
      ? Math.round((attempt.marks_obtained || 0) / attempt.exam.total_marks * 100)
      : 0;

    // Build summary of correct/incorrect answers
    const answersSummary = answers?.map((a, idx) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: center;">${idx + 1}</td>
        <td style="padding: 12px;">${a.question?.question_text?.substring(0, 60) || 'Question'}...</td>
        <td style="padding: 12px; text-align: center;">
          ${a.is_correct ? 
            '<span style="color: #22c55e;">✓ Correct</span>' : 
            '<span style="color: #ef4444;">✗ Incorrect</span>'}
        </td>
        <td style="padding: 12px; text-align: center;">${a.marks_awarded || 0}/${a.question?.marks || 0}</td>
      </tr>
    `).join('');

    // Send email to student
    const studentHtml = `
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
              <h1>🎓 Your Exam Results Are Ready!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${attempt.student.full_name}</strong>,</p>
              <p>Your exam <strong>"${attempt.exam.title}"</strong> has been graded.</p>
              
              <div class="score-box">
                <div style="font-size: 18px; margin-bottom: 10px;">${passed ? '🎉 Congratulations! You Passed!' : '📚 Keep Learning!'}</div>
                <div class="score">${attempt.marks_obtained || 0} / ${attempt.exam.total_marks}</div>
                <div style="margin-top: 10px;">
                  ${correctCount} correct out of ${totalQuestions} questions (${scorePercentage}%)
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
                  'Great job! Keep up the excellent work! 🌟' : 
                  'Don\'t worry! Review the material and you\'ll do better next time! 💪'}
              </p>
            </div>
            <div class="footer">
              <p>STEM Academy | Excellence in Education</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailPromises = [];

    // Send to student
    emailPromises.push(
      sendEmail(
        attempt.student.email,
        `${passed ? '🎉' : '📋'} Your ${attempt.exam.title} Results - ${attempt.marks_obtained || 0}/${attempt.exam.total_marks}`,
        studentHtml
      )
    );

    // Send to parent if available
    if (parentData) {
      const parentHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .score-box { background: ${passed ? '#dcfce7' : '#fee2e2'}; border: 2px solid ${passed ? '#22c55e' : '#ef4444'}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
              .score { font-size: 32px; font-weight: bold; color: ${passed ? '#15803d' : '#dc2626'}; }
              .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; border-radius: 0 0 8px 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>👨‍👩‍👧 Your Child's Exam Results</h1>
              </div>
              <div class="content">
                <p>Dear <strong>${parentData.full_name}</strong>,</p>
                <p>Your child <strong>${attempt.student.full_name}</strong> has completed the exam <strong>"${attempt.exam.title}"</strong>.</p>
                
                <div class="score-box">
                  <div style="font-size: 18px; margin-bottom: 10px;">${passed ? '🎉 Your child passed!' : '📚 More practice needed'}</div>
                  <div class="score">${attempt.marks_obtained || 0} / ${attempt.exam.total_marks}</div>
                  <div style="margin-top: 10px;">
                    Score: ${scorePercentage}% | ${correctCount} of ${totalQuestions} questions correct
                  </div>
                  <div style="margin-top: 5px; font-size: 14px; color: #666;">
                    Passing score: ${attempt.exam.passing_marks} marks
                  </div>
                </div>

                <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #166534;">📊 Performance Summary</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Exam:</strong> ${attempt.exam.title}</li>
                    <li><strong>Score:</strong> ${attempt.marks_obtained || 0} out of ${attempt.exam.total_marks} (${scorePercentage}%)</li>
                    <li><strong>Questions Correct:</strong> ${correctCount} of ${totalQuestions}</li>
                    <li><strong>Status:</strong> ${passed ? 'Passed ✓' : 'Needs Improvement'}</li>
                  </ul>
                </div>

                <p style="margin-top: 20px;">
                  ${passed ? 
                    'Congratulations! Your child is doing great. Encourage them to keep up the excellent work!' : 
                    'Your child can benefit from additional practice in this subject. Consider reviewing the material together.'}
                </p>

                <p style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                  <strong>💡 Tip:</strong> Log in to your parent dashboard to see detailed analytics, track progress over time, and view all exam results.
                </p>
              </div>
              <div class="footer">
                <p>STEM Academy | Partnering with Parents for Student Success</p>
              </div>
            </div>
          </body>
        </html>
      `;

      emailPromises.push(
        sendEmail(
          parentData.email,
          `📊 ${attempt.student.full_name}'s Exam Results: ${attempt.marks_obtained || 0}/${attempt.exam.total_marks} on ${attempt.exam.title}`,
          parentHtml
        )
      );
    }

    const emailResults = await Promise.all(emailPromises);
    console.log('Email results:', JSON.stringify(emailResults));

    const studentEmailSent = !emailResults[0]?.error;
    const parentEmailSent = parentData ? !emailResults[1]?.error : false;

    console.log('Student email sent:', studentEmailSent);
    console.log('Parent email sent:', parentEmailSent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications sent',
        studentEmailSent,
        parentEmailSent,
        parentNotified: !!parentData
      }),
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
