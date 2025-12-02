import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedQuestion {
  exam_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  marks: number;
  order_number: number;
}

// Extract text content from PDF using stream extraction
function extractTextFromPDF(pdfBytes: Uint8Array): string {
  const pdfString = new TextDecoder('latin1').decode(pdfBytes);
  
  console.log('=== PDF EXTRACTION DEBUG ===');
  console.log('PDF size:', pdfBytes.length);
  
  // Extract text content from PDF streams
  const textContents: string[] = [];
  
  // Pattern to find text streams in PDF
  const streamPattern = /stream\s*([\s\S]*?)\s*endstream/gi;
  let match;
  
  while ((match = streamPattern.exec(pdfString)) !== null) {
    const streamData = match[1];
    
    // Try to extract readable text from stream
    // Look for text between parentheses or brackets
    const textPattern = /\(((?:[^()\\]|\\.)*)\)|<([\da-fA-F]+)>/g;
    let textMatch;
    
    while ((textMatch = textPattern.exec(streamData)) !== null) {
      if (textMatch[1]) {
        // Text in parentheses
        let text = textMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\(.)/g, '$1');
        textContents.push(text);
      } else if (textMatch[2]) {
        // Hex encoded text
        try {
          const hexText = textMatch[2];
          let decoded = '';
          for (let i = 0; i < hexText.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hexText.substr(i, 2), 16));
          }
          textContents.push(decoded);
        } catch (e) {
          // Skip invalid hex
        }
      }
    }
  }
  
  const extractedText = textContents.join(' ');
  console.log('Extracted text length:', extractedText.length);
  console.log('First 1000 chars:', extractedText.substring(0, 1000));
  console.log('===========================');
  
  return extractedText;
}

// Parse questions from extracted text with multiple format support
function parseQuestions(text: string, examId: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  
  console.log('=== QUESTION PARSING DEBUG ===');
  console.log('Input text length:', text.length);
  
  // Normalize text
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\u00A0/g, ' ');
  
  // Split into lines for easier processing
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log('Total lines:', lines.length);
  console.log('Sample lines:', lines.slice(0, 20));
  
  // Strategy 1: Find answer key section first
  const answerMap = new Map<number, string>();
  const answerKeyPattern = /(?:Answer\s*Key|Answers)[:\s]*([\s\S]*?)(?=\n\n|$)/i;
  const answerKeyMatch = text.match(answerKeyPattern);
  
  if (answerKeyMatch) {
    console.log('Found answer key section');
    const answerSection = answerKeyMatch[1];
    const answerPattern = /(\d+)[.\s)]+([A-Da-d]|True|False)/gi;
    let aMatch;
    while ((aMatch = answerPattern.exec(answerSection)) !== null) {
      const qNum = parseInt(aMatch[1]);
      const answer = aMatch[2].toUpperCase();
      answerMap.set(qNum, answer);
      console.log(`Answer ${qNum}: ${answer}`);
    }
  }
  
  // Strategy 2: Parse questions with various formats
  let questionNumber = 1;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line starts a question
    const questionPattern = /^(?:Q(?:uestion)?[\s.]?)?(\d+)[.\s:)]+(.+)/i;
    const qMatch = line.match(questionPattern);
    
    if (qMatch) {
      const qNum = parseInt(qMatch[1]);
      let questionText = qMatch[2].trim();
      const options: string[] = [];
      let correctAnswer = '';
      
      console.log(`\nProcessing Q${qNum}: ${questionText.substring(0, 60)}...`);
      
      // Collect continuation of question text and options
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        
        // Check for option (A), B), C), D), etc.
        const optionPattern = /^([A-Da-d])[.\s:)]+(.+)/;
        const oMatch = nextLine.match(optionPattern);
        
        if (oMatch) {
          const optionLetter = oMatch[1].toUpperCase();
          let optionText = oMatch[2].trim();
          
          // Check for inline [CORRECT] marker
          if (optionText.includes('[CORRECT]') || optionText.includes('(CORRECT)')) {
            correctAnswer = optionText.replace(/\[CORRECT\]|\(CORRECT\)/gi, '').trim();
            optionText = correctAnswer;
          } else {
            // Check if answer is from answer key
            if (answerMap.has(qNum)) {
              const answerLetter = answerMap.get(qNum)!;
              if (optionLetter === answerLetter) {
                correctAnswer = optionText;
              }
            }
          }
          
          options.push(optionText);
          console.log(`  Option ${optionLetter}: ${optionText.substring(0, 50)}...`);
          i++;
        }
        // Check for True/False format
        else if (nextLine.match(/^\(?(True|False)\)?$/i)) {
          const tfMatch = nextLine.match(/\(?(True|False)\)?/i);
          if (tfMatch) {
            options.push('True', 'False');
            correctAnswer = tfMatch[1];
            i++;
          }
          break;
        }
        // Check if next question starts
        else if (nextLine.match(/^(?:Q(?:uestion)?[\s.]?)?\d+[.\s:)]/i)) {
          break;
        }
        // Check for answer line
        else if (nextLine.match(/^(?:Answer|Ans|Correct)[:\s]+([A-Da-d]|True|False)/i)) {
          const ansMatch = nextLine.match(/^(?:Answer|Ans|Correct)[:\s]+([A-Da-d]|True|False)/i);
          if (ansMatch && !correctAnswer) {
            const answerLetter = ansMatch[1].toUpperCase();
            const answerIndex = answerLetter.charCodeAt(0) - 65;
            if (answerIndex >= 0 && answerIndex < options.length) {
              correctAnswer = options[answerIndex];
            }
          }
          i++;
          break;
        }
        // Continuation of question text
        else if (options.length === 0 && !nextLine.match(/^(?:Q|Answer)/i)) {
          questionText += ' ' + nextLine;
          i++;
        }
        else {
          i++;
        }
      }
      
      // Validate and add question
      if (options.length >= 2) {
        // If no correct answer found yet, try answer key
        if (!correctAnswer && answerMap.has(qNum)) {
          const answerLetter = answerMap.get(qNum)!;
          const answerIndex = answerLetter.charCodeAt(0) - 65;
          if (answerIndex >= 0 && answerIndex < options.length) {
            correctAnswer = options[answerIndex];
          } else if (answerLetter === 'TRUE' || answerLetter === 'FALSE') {
            correctAnswer = answerLetter.charAt(0) + answerLetter.slice(1).toLowerCase();
          }
        }
        
        console.log(`  ✓ Valid question with ${options.length} options, answer: ${correctAnswer || 'NONE'}`);
        
        questions.push({
          exam_id: examId,
          question_text: questionText,
          question_type: options.length === 2 && options.includes('True') ? 'true_false' : 'multiple_choice',
          options,
          correct_answer: correctAnswer || options[0], // Default to first option if no answer found
          marks: 1,
          order_number: questionNumber++
        });
      } else {
        console.log(`  ✗ Skipped (insufficient options: ${options.length})`);
      }
    } else {
      i++;
    }
  }
  
  console.log(`\nTotal questions parsed: ${questions.length}`);
  console.log('==============================');
  
  return questions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { examId, pdfContent } = await req.json();

    if (!examId || !pdfContent) {
      throw new Error('Missing required fields: examId and pdfContent');
    }

    console.log('Processing PDF for exam:', examId);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Decode base64 PDF content
    const pdfBytes = Uint8Array.from(atob(pdfContent), c => c.charCodeAt(0));
    
    // Extract text from PDF
    const extractedText = extractTextFromPDF(pdfBytes);
    
    if (!extractedText || extractedText.length < 20) {
      return new Response(
        JSON.stringify({ 
          success: false,
          questionsCreated: 0,
          error: 'Failed to extract text from PDF',
          suggestions: [
            'Ensure the PDF contains readable text (not scanned images)',
            'Try converting the PDF to a text-based format',
            'Check if the PDF is password protected'
          ]
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Parse questions from extracted text
    const questions = parseQuestions(extractedText, examId);
    
    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          questionsCreated: 0,
          error: 'No valid questions found in PDF',
          suggestions: [
            'Ensure questions are numbered (1., 2., Q1, Q2, etc.)',
            'Use standard format: A) B) C) D) for options',
            'Include an answer key section or mark correct answers with [CORRECT]',
            'Make sure each question has at least 2 options'
          ],
          debug: {
            textLength: extractedText.length,
            sampleText: extractedText.substring(0, 500)
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Insert questions into database
    const { error } = await supabaseClient
      .from('exam_questions')
      .insert(questions);

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to save questions: ${error.message}`);
    }

    console.log(`✓ Successfully created ${questions.length} questions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        questionsCreated: questions.length,
        questions: questions.map(q => ({
          questionNumber: q.order_number,
          questionText: q.question_text.substring(0, 100) + '...',
          optionCount: q.options.length,
          hasAnswer: !!q.correct_answer
        })),
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
      JSON.stringify({ 
        success: false,
        questionsCreated: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});