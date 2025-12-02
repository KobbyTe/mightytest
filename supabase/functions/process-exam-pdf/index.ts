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
    
    // Convert PDF to text with multiple encoding attempts
    let pdfText = '';
    try {
      pdfText = new TextDecoder('utf-8', { fatal: false }).decode(pdfBytes);
    } catch {
      try {
        pdfText = new TextDecoder('iso-8859-1').decode(pdfBytes);
      } catch {
        pdfText = new TextDecoder('windows-1252').decode(pdfBytes);
      }
    }

    console.log('Processing PDF for exam:', examId);
    console.log('PDF text length:', pdfText.length);
    console.log('First 500 chars:', pdfText.substring(0, 500));

    // Extract readable text from PDF (filter out binary data)
    const cleanText = pdfText.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    const lines = cleanText.split(/[\r\n]+/).map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('Total lines:', lines.length);
    console.log('First 10 lines:', lines.slice(0, 10));

    const questions = [];
    let orderNumber = 1;
    let currentQuestion: any = null;
    let currentOptions: string[] = [];
    let correctAnswer = '';
    let collectingOptions = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // More flexible question pattern - matches Q1, 1., 1), Question 1, etc.
      const questionMatch = line.match(/^(?:Q(?:uestion)?\s*)?(\d+)[.:\s)]+(.+)/i);
      
      if (questionMatch) {
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
        currentQuestion = questionMatch[2].trim();
        currentOptions = [];
        correctAnswer = '';
        collectingOptions = true;
        console.log(`Found question ${orderNumber}: ${currentQuestion.substring(0, 50)}...`);
        continue;
      }
      
      // More flexible option pattern - matches A), A., (A), a), etc.
      const optionMatch = line.match(/^(?:\()?([A-Da-d])[).:\s]+(.+)/);
      
      if (optionMatch && collectingOptions) {
        const optionLetter = optionMatch[1].toUpperCase();
        const optionText = optionMatch[2].trim();
        currentOptions.push(optionText);
        console.log(`Found option ${optionLetter}: ${optionText.substring(0, 40)}...`);
        continue;
      }
      
      // More flexible answer pattern - matches "Answer: A", "Ans: A", "Correct: A", etc.
      const answerMatch = line.match(/^(?:Answer|Ans|Correct(?:\s+Answer)?)[:\s]+([A-Da-d])/i);
      
      if (answerMatch && currentOptions.length > 0) {
        const answerLetter = answerMatch[1].toUpperCase();
        const answerIndex = answerLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        if (answerIndex >= 0 && answerIndex < currentOptions.length) {
          correctAnswer = currentOptions[answerIndex];
          collectingOptions = false;
          console.log(`Found answer: ${answerLetter} = ${correctAnswer.substring(0, 40)}...`);
        }
        continue;
      }
      
      // If we're collecting a question and hit a non-option line, append to question text
      if (currentQuestion && collectingOptions && !optionMatch && !answerMatch && line.length > 0) {
        // Don't append if it looks like the start of a new question
        if (!line.match(/^(?:Q(?:uestion)?\s*)?\d+[.:\s)]/i)) {
          currentQuestion += ' ' + line;
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