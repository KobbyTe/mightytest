import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pako from "https://esm.sh/pako@2.1.0";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

interface ParsedQuestion { exam_id: string; question_text: string; question_type: string; options: string[]; correct_answer: string; marks: number; order_number: number; }

function decompress(data: Uint8Array): Uint8Array | null {
  try { return pako.inflate(data); } catch { try { return pako.inflateRaw(data); } catch { return null; } }
}

function decode(str: string): string {
  return str.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\').replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

function extractText(pdfBytes: Uint8Array): string {
  const pdf = new TextDecoder('latin1').decode(pdfBytes);
  const texts: string[] = [];
  const re = /<<([^>]*)>>\s*stream\s*([\s\S]*?)\s*endstream/gi;
  let m;
  while ((m = re.exec(pdf)) !== null) {
    const isFlate = /\/Filter\s*\/FlateDecode/i.test(m[1]);
    let content = m[2];
    if (isFlate) {
      const bytes = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i) & 0xFF;
      const d = decompress(bytes);
      if (d) content = new TextDecoder('latin1').decode(d);
    }
    const tj = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let t;
    while ((t = tj.exec(content)) !== null) { const x = decode(t[1]); if (x.trim() && /[a-zA-Z]{2,}/.test(x)) texts.push(x); }
    const tja = /\[((?:\([^)]*\)|[^\]])*)\]\s*TJ/gi;
    while ((t = tja.exec(content)) !== null) {
      const sp = /\(((?:[^()\\]|\\.)*)\)/g;
      let s;
      while ((s = sp.exec(t[1])) !== null) { const x = decode(s[1]); if (x.trim() && /[a-zA-Z]{2,}/.test(x)) texts.push(x); }
    }
  }
  if (texts.length === 0) {
    const fp = /\(((?:[^()\\]|\\.){3,})\)/g;
    let f;
    while ((f = fp.exec(pdf)) !== null) { const x = decode(f[1]); if (/[a-zA-Z]{2,}/.test(x) && x.length > 2) texts.push(x); }
  }
  const result = [...new Set(texts)].join(' ').replace(/\s+/g, ' ').trim();
  console.log('Extracted:', result.length, 'chars. Sample:', result.substring(0, 300));
  return result;
}

function detectType(q: string, a: string): string {
  const lq = q.toLowerCase(), la = a.toLowerCase();
  if (lq.includes('true or false') || la === 'true' || la === 'false') return 'true_false';
  if (/[A-D]\)/.test(q) || lq.includes('choose')) return 'multiple_choice';
  return 'essay';
}

function parseQuestions(text: string, examId: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const clean = text.replace(/\s+/g, ' ').trim();
  console.log('Parsing text length:', clean.length);
  
  // Pattern 1: Question: ... Answer: ...
  const p1 = /Question\s*:?\s*(.+?)\s*Answer\s*:?\s*(.+?)(?=Question\s*:?|$)/gis;
  const m1 = Array.from(clean.matchAll(p1));
  if (m1.length > 0) {
    console.log('Pattern 1 found:', m1.length);
    m1.forEach((x, i) => questions.push({ exam_id: examId, question_text: x[1].trim(), question_type: detectType(x[1], x[2]), options: [], correct_answer: x[2].trim(), marks: 1, order_number: i + 1 }));
    return questions;
  }
  
  // Pattern 2: Q1. ... A1. ...
  const p2 = /(?:Q|Question)?\s*(\d+)[\.\)]\s*(.+?)\s*(?:A|Answer)\s*\1?[\.\)]\s*(.+?)(?=(?:Q|Question)?\s*\d+[\.\)]|$)/gis;
  const m2 = Array.from(clean.matchAll(p2));
  if (m2.length > 0) {
    console.log('Pattern 2 found:', m2.length);
    m2.forEach((x, i) => questions.push({ exam_id: examId, question_text: x[2].trim(), question_type: detectType(x[2], x[3]), options: [], correct_answer: x[3].trim(), marks: 1, order_number: i + 1 }));
    return questions;
  }
  
  console.log('No patterns matched');
  return questions;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { examId, pdfContent } = await req.json();
    if (!examId || !pdfContent) throw new Error('Missing examId or pdfContent');
    console.log('Processing exam:', examId);
    
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const pdfBytes = Uint8Array.from(atob(pdfContent), c => c.charCodeAt(0));
    const text = extractText(pdfBytes);
    
    if (!text || text.length < 20) {
      return new Response(JSON.stringify({ success: false, questionsCreated: 0, error: 'Failed to extract text from PDF. The PDF may be scanned/image-based or password protected.', suggestions: ['Use a text-based PDF', 'Try OCR software first'] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    
    const questions = parseQuestions(text, examId);
    if (questions.length === 0) {
      return new Response(JSON.stringify({ success: false, questionsCreated: 0, error: 'No questions found in PDF', suggestions: ['Use format: Question: ... Answer: ...', 'Or: Q1. ... A1. ...'], debug: { textLength: text.length, sample: text.substring(0, 500) } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    
    const { error } = await supabase.from('exam_questions').insert(questions);
    if (error) throw new Error('Database error: ' + error.message);
    
    console.log('Created', questions.length, 'questions');
    return new Response(JSON.stringify({ success: true, questionsCreated: questions.length, message: 'Successfully created ' + questions.length + ' questions' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, questionsCreated: 0, error: error instanceof Error ? error.message : 'Unknown error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
