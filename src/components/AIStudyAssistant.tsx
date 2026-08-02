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

export function AIStudyAssistant({ embedded = false }: { embedded?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(embedded);
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

  if (!isOpen && !embedded) {
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


  const chatStream = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-primary to-secondary shadow-lg mb-3 animate-float-slow">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="text-base font-bold text-foreground">Hi! I'm your Study Buddy 🎓</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              I know your exam results and can help you improve. Pick a starting point:
            </p>
          </div>
          <div className={embedded ? 'grid sm:grid-cols-2 gap-2.5' : 'flex flex-wrap gap-1.5'}>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading}
                className={embedded
                  ? 'group text-left p-3.5 rounded-2xl border border-border/60 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 transition-all hover:-translate-y-0.5 disabled:opacity-50'
                  : 'text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors text-left disabled:opacity-50'}
              >
                <span className={embedded ? 'text-sm font-semibold text-foreground' : 'text-xs'}>{action.label}</span>
                {embedded && (
                  <span className="block text-[11px] text-muted-foreground mt-1 line-clamp-2">{action.prompt}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`flex items-end gap-2 max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-sm">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-br-md'
                  : 'bg-muted/70 border border-border/50 text-foreground rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
          {msg.role === 'assistant' && !isLoading && msg.content.length > 100 && (
            <button
              onClick={() => {
                generateQuizPDF(msg.content, studentContext?.weakSubjects || []);
                toast.success('Practice quiz PDF downloaded!');
              }}
              className="flex items-center gap-1 mt-1.5 ml-10 text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3 w-3" />
              Download as PDF
            </button>
          )}
        </div>
      ))}

      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className="flex justify-start items-end gap-2">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="bg-muted/70 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const followUps = messages.length > 0 && !isLoading && (
    <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto shrink-0">
      {QUICK_ACTIONS.slice(0, 3).map((action) => (
        <button
          key={action.label}
          onClick={() => sendMessage(action.prompt)}
          className="text-[11px] px-3 py-1.5 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 whitespace-nowrap transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );

  const composer = (
    <form
      onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
      className="flex items-center gap-2 px-3 py-3 border-t border-border/60 shrink-0 bg-background/60"
    >
      <div className="flex-1 flex items-center gap-2 rounded-full bg-muted/50 border border-transparent focus-within:border-primary/40 focus-within:bg-background px-4 h-11 transition-colors">
        <Sparkles className="h-4 w-4 text-primary/70 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your exams..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || isLoading}
        className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-secondary shrink-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );

  if (embedded) {
    const scores = studentContext?.recentScores || [];
    const avg = scores.length
      ? Math.round(scores.reduce((s, r) => s + r.percentage, 0) / scores.length)
      : null;

    return (
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 animate-fade-in">
        {/* Chat surface */}
        <div className="glass-card !rounded-3xl overflow-hidden border border-border/60 shadow-xl flex flex-col h-[72vh] min-h-[520px]">
          <div className="relative px-5 py-4 border-b border-border/60 bg-gradient-to-r from-primary/15 via-secondary/10 to-transparent flex items-center gap-3 overflow-hidden">
            <div className="absolute -top-10 -right-6 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="relative flex-1 min-w-0">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                AI Study Buddy <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isLoading ? 'Thinking…' : 'Personalised to your exam performance'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleReset} className="relative h-9 w-9 rounded-full hover:bg-primary/10" title="Reset chat">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {chatStream}
          {followUps}
          {composer}
        </div>

        {/* Insight rail */}
        <aside className="hidden lg:flex flex-col gap-4">
          <div className="glass-card !rounded-3xl p-5 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your average</p>
            <p className="text-4xl font-black mt-1 bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
              {avg !== null ? `${avg}%` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Across {scores.length} recent exam{scores.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="glass-card !rounded-3xl p-5 border border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Focus areas</p>
            {studentContext?.weakSubjects?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {studentContext.weakSubjects.map((s) => (
                  <span key={s} className="text-[11px] px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No weak subjects detected — keep it up! 🎉</p>
            )}
          </div>

          <div className="glass-card !rounded-3xl p-5 border border-border/60 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent results</p>
            {scores.length ? (
              <div className="space-y-2.5">
                {scores.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{r.examTitle}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.subject}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${r.passed ? 'text-emerald-500' : 'text-destructive'}`}>
                      {Math.round(r.percentage)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> No exam results yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col w-[min(400px,calc(100vw-3rem))] h-[min(560px,calc(100vh-6rem))] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-secondary text-primary-foreground shrink-0">
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

      {chatStream}
      {followUps}
      {composer}
    </div>
  );
}
