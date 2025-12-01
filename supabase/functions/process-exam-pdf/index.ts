import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { examId, pdfContent } = await req.json();

    if (!examId || !pdfContent) {
      throw new Error('Missing required fields');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Decode base64 PDF content
    const pdfBytes = Uint8Array.from(atob(pdfContent), c => c.charCodeAt(0));
    
    // Convert PDF to text - note this is simplified
    // For production, use proper PDF parsing library
    let pdfText = '';
    try {
      pdfText = new TextDecoder('utf-8', { fatal: false }).decode(pdfBytes);
    } catch {
      // Fallback to latin1 if UTF-8 fails
      pdfText = new TextDecoder('iso-8859-1').decode(pdfBytes);
    }

    console.log('Processing PDF for exam:', examId);
    console.log('PDF text length:', pdfText.length);

    // Simple pattern matching for questions and answers
    // Format expected: Q1. question text\nA) option1\nB) option2\nC) option3\nD) option4\nAnswer: A
    const questionPattern = /Q(\d+)[.:\s]+(.*?)(?=Q\d+|Answer:|$)/gs;
    const optionsPattern = /([A-D])[).\s]+(.*?)(?=[A-D][).\s]|Answer:|Q\d+|$)/g;
    const answerPattern = /Answer:\s*([A-D])/gi;

    const questions = [];
    let match;
    let orderNumber = 1;

    // Extract text content (simplified - in production, use a PDF parsing library)
    const lines = pdfText.split('\n').filter(line => line.trim());
    let currentQuestion: any = null;
    let currentOptions: string[] = [];
    let correctAnswer = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if it's a question
      if (/^Q?\d+[.:\s]/.test(trimmedLine)) {
        // Save previous question if exists
        if (currentQuestion && currentOptions.length > 0) {
          questions.push({
            exam_id: examId,
            question_text: currentQuestion,
            question_type: 'multiple_choice',
            options: currentOptions,
            correct_answer: correctAnswer,
            marks: 1,
            order_number: orderNumber++
          });
        }
        
        // Start new question
        currentQuestion = trimmedLine.replace(/^Q?\d+[.:\s]+/, '');
        currentOptions = [];
        correctAnswer = '';
      }
      // Check if it's an option
      else if (/^[A-D][).\s]/.test(trimmedLine)) {
        const option = trimmedLine.replace(/^[A-D][).\s]+/, '');
        currentOptions.push(option);
      }
      // Check if it's an answer
      else if (/^Answer:/i.test(trimmedLine)) {
        const answerMatch = trimmedLine.match(/Answer:\s*([A-D])/i);
        if (answerMatch && currentOptions.length > 0) {
          const answerIndex = answerMatch[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
          if (answerIndex >= 0 && answerIndex < currentOptions.length) {
            correctAnswer = currentOptions[answerIndex];
          }
        }
      }
    }

    // Save last question
    if (currentQuestion && currentOptions.length > 0) {
      questions.push({
        exam_id: examId,
        question_text: currentQuestion,
        question_type: 'multiple_choice',
        options: currentOptions,
        correct_answer: correctAnswer,
        marks: 1,
        order_number: orderNumber
      });
    }

    console.log(`Extracted ${questions.length} questions from PDF`);

    // Insert questions into database
    if (questions.length > 0) {
      const { error } = await supabaseClient
        .from('exam_questions')
        .insert(questions);

      if (error) {
        console.error('Error inserting questions:', error);
        throw error;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        questionsCreated: questions.length,
        message: `Successfully created ${questions.length} questions from PDF`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});