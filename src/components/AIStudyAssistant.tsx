import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Send, X, Sparkles, RotateCcw, Loader2, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';

type Msg = { role: 'user' | 'assistant'; content: string };

interface StudentContext {
  recentScores: Array<{
    examTitle: string;
    subject: string;
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
  }>;
  wrongAnswers: Array<{
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    subject: string;
  }>;
  weakSubjects: string[];
}

const QUICK_ACTIONS = [
  { label: '🔍 Explain my wrong answers', prompt: 'Can you explain the questions I got wrong on my recent exams and help me understand the correct answers?' },
  { label: '📝 Practice quiz', prompt: 'Generate a practice quiz with 10 questions based on my weak areas. Format each question with a number, the question text, multiple choice options labeled A-D, and put the correct answer at the end of each question. Include a mix of question types covering my weakest subjects.', isQuiz: true },
  { label: '📊 Study plan', prompt: 'Based on my exam results, can you create a quick study plan for the areas I need to improve?' },
  { label: '💡 Tips to improve', prompt: 'What are the best study tips and strategies for improving my scores based on my performance?' },
];

function generateQuizPDF(content: string, weakSubjects: string[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  // Header
  doc.setFillColor(124, 58, 237); // violet-600
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MightyTest Practice Quiz', margin, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()} | Focus: ${weakSubjects.length ? weakSubjects.join(', ') : 'General'}`, margin, 30);

  y = 45;
  doc.setTextColor(40, 40, 40);

  // Parse content into lines and render
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 4;
      continue;
    }

    // Check for new page
    if (y > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }

    // Detect question numbers (e.g., "1.", "**1.", "Q1", "Question 1")
    const isQuestion = /^(\*{0,2})(\d+[\.\):]|\*{0,2}Q(uestion)?\s*\d+)/i.test(trimmed);
    // Detect answer options
    const isOption = /^[A-D][\.\):\s]/i.test(trimmed);
    // Detect correct answer lines
    const isAnswer = /^(\*{0,2})(correct\s*answer|answer)[:\s]/i.test(trimmed);

    // Strip markdown bold markers for PDF
    const cleanText = trimmed.replace(/\*{1,2}/g, '');

    if (isQuestion) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const splitLines = doc.splitTextToSize(cleanText, maxWidth);
      doc.text(splitLines, margin, y);
      y += splitLines.length * 6;
    } else if (isOption) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitLines = doc.splitTextToSize(cleanText, maxWidth - 8);
      doc.text(splitLines, margin + 8, y);
      y += splitLines.length * 5.5;
    } else if (isAnswer) {
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.setTextColor(34, 139, 34);
      const splitLines = doc.splitTextToSize(cleanText, maxWidth);
      doc.text(splitLines, margin, y);
      y += splitLines.length * 5;
      doc.setTextColor(40, 40, 40);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitLines = doc.splitTextToSize(cleanText, maxWidth);
      doc.text(splitLines, margin, y);
      y += splitLines.length * 5.5;
    }
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount} — MightyTest Study Buddy`, margin, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save('MightyTest-Practice-Quiz.pdf');
}

export function AIStudyAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Fetch student context on first open
  useEffect(() => {
    if (!isOpen || contextLoaded || !user) return;

    const fetchContext = async () => {
      try {
        // Get student record
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!student) return;

        // Get graded attempts with exam info
        const { data: attempts } = await supabase
          .from('exam_attempts')
          .select('id, marks_obtained, status, exam_id, attempted_at, exams(title, subject, total_marks, passing_marks)')
          .eq('student_id', student.id)
          .eq('status', 'graded')
          .order('attempted_at', { ascending: false })
          .limit(10);

        if (!attempts?.length) {
          setContextLoaded(true);
          return;
        }

        const recentScores = attempts.map((a: any) => ({
          examTitle: a.exams?.title || 'Unknown',
          subject: a.exams?.subject || 'General',
          score: a.marks_obtained || 0,
          totalMarks: a.exams?.total_marks || 100,
          percentage: Math.round(((a.marks_obtained || 0) / (a.exams?.total_marks || 100)) * 100),
          passed: (a.marks_obtained || 0) >= (a.exams?.passing_marks || 50),
        }));

        // Get wrong answers from recent attempts
        const attemptIds = attempts.map((a: any) => a.id);
        const { data: answers } = await supabase
          .from('exam_answers')
          .select('answer_text, is_correct, question_id, exam_questions(question_text, correct_answer, exam_id, exams(subject))')
          .in('attempt_id', attemptIds)
          .eq('is_correct', false)
          .limit(20);

        const wrongAnswers = (answers || []).map((a: any) => ({
          questionText: a.exam_questions?.question_text || '',
          studentAnswer: a.answer_text || '',
          correctAnswer: a.exam_questions?.correct_answer || '',
          subject: a.exam_questions?.exams?.subject || 'General',
        }));

        // Determine weak subjects
        const subjectScores: Record<string, number[]> = {};
        recentScores.forEach((s) => {
          if (!subjectScores[s.subject]) subjectScores[s.subject] = [];
          subjectScores[s.subject].push(s.percentage);
        });
        const weakSubjects = Object.entries(subjectScores)
          .map(([subject, scores]) => ({
            subject,
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
          }))
          .filter((s) => s.avg < 70)
          .sort((a, b) => a.avg - b.avg)
          .map((s) => `${s.subject} (avg: ${Math.round(s.avg)}%)`);

        setStudentContext({ recentScores, wrongAnswers, weakSubjects });
      } catch (err) {
        console.error('Failed to fetch student context:', err);
      } finally {
        setContextLoaded(true);
      }
    };

    fetchContext();
  }, [isOpen, contextLoaded, user]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMsg: Msg = { role: 'user', content: messageText.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const allMessages = [...messages, userMsg];
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-assistant`;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          studentContext,
        }),
      });

      if (resp.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI assistant is temporarily unavailable.');
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        throw new Error('Failed to start stream');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Study assistant error:', err);
      toast.error('Failed to get a response. Please try again.');
      setMessages((prev) => prev.filter((m) => m !== userMsg));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, studentContext]);

  const handleReset = () => {
    setMessages([]);
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        aria-label="Open AI Study Assistant"
      >
        <Brain className="h-5 w-5" />
        <span className="text-sm font-semibold hidden sm:inline">Study Buddy</span>
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col w-[min(400px,calc(100vw-3rem))] h-[min(560px,calc(100vh-6rem))] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <span className="font-bold text-sm">AI Study Buddy</span>
          <Sparkles className="h-3 w-3 animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleReset} className="p-1.5 rounded-full hover:bg-white/20 transition-colors" title="Reset chat">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full hover:bg-white/20 transition-colors" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-2">
                <Brain className="h-6 w-6 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-foreground">Hi! I'm your Study Buddy 🎓</p>
              <p className="text-xs text-muted-foreground mt-1">
                I know your exam results and can help you improve. Try one of these:
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors text-left disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions after conversation started */}
      {messages.length > 0 && !isLoading && (
        <div className="px-3 pb-1 flex gap-1 overflow-x-auto shrink-0">
          {QUICK_ACTIONS.slice(0, 2).map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              className="text-[10px] px-2 py-1 rounded-full border border-border bg-muted/50 hover:bg-accent whitespace-nowrap transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2 px-3 py-2 border-t border-border shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your exams..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="h-8 w-8 rounded-full bg-violet-600 hover:bg-violet-700 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
