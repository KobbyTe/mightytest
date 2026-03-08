import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, ChevronLeft, User, Search, Bell, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MESSAGES_PER_PAGE = 30;

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  recipient_role: string;
  recipient_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_role: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface RecipientOption {
  user_id: string;
  full_name: string;
  identifier: string | null;
  type: 'student' | 'parent';
}

const playNotificationSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* silent fallback */ }
};

const showBrowserNotification = (content: string) => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('New Message', { body: content.slice(0, 100), icon: '/favicon.png' });
  }
};

export function ChatBubble() {
  const { user, role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showConversations, setShowConversations] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAdmin = role === 'admin';

  // Admin recipient picker state
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Track the recipient user_id and role for the active conversation
  const [activeRecipientUserId, setActiveRecipientUserId] = useState<string | null>(null);
  const [activeRecipientRole, setActiveRecipientRole] = useState<string>('admin');

  // Notification permission prompt
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Typing indicator state
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Chat history / pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Check notification prompt on open
  useEffect(() => {
    if (!isOpen) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    const prompted = localStorage.getItem('chat_notification_prompted');
    if (!prompted) {
      setShowNotifPrompt(true);
    }
  }, [isOpen]);

  const handleEnableNotifications = () => {
    Notification.requestPermission().then(() => {
      setShowNotifPrompt(false);
      localStorage.setItem('chat_notification_prompted', 'true');
    });
  };

  const handleDismissNotifPrompt = () => {
    setShowNotifPrompt(false);
    localStorage.setItem('chat_notification_prompted', 'true');
  };

  // Load conversations/messages
  useEffect(() => {
    if (!user || !isOpen) return;
    loadConversations();
  }, [user, isOpen]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id !== user.id) {
          playNotificationSound();
          showBrowserNotification(msg.content);
        }
        if (msg.conversation_id === activeConversationId) {
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id !== user.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
          }
        }
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeConversationId]);

  // Typing indicator broadcast channel
  useEffect(() => {
    if (!user || !activeConversationId) {
      if (broadcastChannelRef.current) {
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
      setOtherTyping(false);
      return;
    }

    const channel = supabase.channel(`typing:${activeConversationId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.user_id !== user.id) {
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 2500);
        }
      })
      .subscribe();

    broadcastChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setOtherTyping(false);
    };
  }, [user, activeConversationId]);

  const emitTyping = useCallback(() => {
    if (!broadcastChannelRef.current || !user) return;
    broadcastChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: user.id },
    });
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Count unread on load
  useEffect(() => {
    if (!user) return;
    countUnread();
  }, [user]);

  const countUnread = async () => {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender_id', user!.id)
      .eq('is_read', false);
    setUnreadTotal(count || 0);
  };

  const loadConversations = async () => {
    if (!user) return;

    const { data: allMessages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (!allMessages || allMessages.length === 0) {
      setConversations([]);
      countUnread();
      return;
    }

    const convMap = new Map<string, Message[]>();
    for (const msg of allMessages) {
      const existing = convMap.get(msg.conversation_id) || [];
      existing.push(msg);
      convMap.set(msg.conversation_id, existing);
    }

    const convPromises = Array.from(convMap.entries()).map(async ([convId, msgs]) => {
      const sorted = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastMsg = sorted[0];
      
      // Determine the "other" user: check sender_id and recipient_id
      let otherUserId: string | null = null;
      let otherRole = 'admin';
      for (const m of msgs) {
        if (m.sender_id !== user!.id) {
          otherUserId = m.sender_id;
          otherRole = m.sender_role;
          break;
        }
        if (m.recipient_id && m.recipient_id !== user!.id) {
          otherUserId = m.recipient_id;
          otherRole = m.recipient_role;
          break;
        }
      }
      if (!otherUserId) {
        otherUserId = user!.id;
      }

      const unread = msgs.filter((m) => m.sender_id !== user!.id && !m.is_read).length;

      let otherName = otherRole === 'admin' ? 'Admin' : 'User';
      if (otherUserId !== user!.id) {
        if (otherRole === 'student' || otherRole === 'user') {
          const { data } = await supabase.from('students').select('full_name').eq('user_id', otherUserId).maybeSingle();
          if (data) otherName = data.full_name;
        } else if (otherRole === 'parent') {
          const { data } = await supabase.from('parents').select('full_name').eq('user_id', otherUserId).maybeSingle();
          if (data) otherName = data.full_name;
        } else if (otherRole === 'admin') {
          otherName = 'Admin';
        }
      }

      return {
        conversation_id: convId,
        other_user_id: otherUserId,
        other_name: otherName,
        other_role: otherRole,
        last_message: lastMsg.content,
        last_message_at: lastMsg.created_at,
        unread_count: unread,
      } as Conversation;
    });

    const convs = await Promise.all(convPromises);
    convs.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    setConversations(convs);
    countUnread();
  };

  const openConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setShowConversations(false);
    setShowRecipientPicker(false);

    // Set recipient from conversation list
    const conv = conversations.find(c => c.conversation_id === convId);
    if (conv) {
      setActiveRecipientUserId(conv.other_user_id);
      setActiveRecipientRole(conv.other_role);
    }

    const { data, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    const sorted = (data || []).reverse();
    setMessages(sorted);
    setHasMoreMessages((count || 0) > MESSAGES_PER_PAGE);

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', convId)
      .neq('sender_id', user!.id);

    countUnread();
  };

  const loadOlderMessages = async () => {
    if (!activeConversationId || loadingMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestMsg = messages[0];
    const { data, count } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', activeConversationId)
      .lt('created_at', oldestMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (data && data.length > 0) {
      const older = data.reverse();
      // Preserve scroll position
      const scrollEl = scrollRef.current;
      const prevScrollHeight = scrollEl?.scrollHeight || 0;
      setMessages((prev) => [...older, ...prev]);
      // After render, adjust scroll to keep position
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight;
        }
      });
    }

    setHasMoreMessages((data?.length || 0) === MESSAGES_PER_PAGE);
    setLoadingMore(false);
  };

  const startNewConversation = () => {
    if (isAdmin) {
      setShowRecipientPicker(true);
      setRecipientSearch('');
      loadRecipients('');
    } else {
      const newConvId = crypto.randomUUID();
      setActiveConversationId(newConvId);
      setActiveRecipientUserId(null);
      setActiveRecipientRole('admin');
      setMessages([]);
      setShowConversations(false);
      setHasMoreMessages(false);
    }
  };

  const loadRecipients = async (search: string) => {
    setLoadingRecipients(true);
    const results: RecipientOption[] = [];

    // Load students
    let studentQuery = supabase.from('students').select('user_id, full_name, student_id_code').eq('account_status', 'active').order('full_name').limit(30);
    if (search.trim()) {
      studentQuery = studentQuery.or(`full_name.ilike.%${search.trim()}%,student_id_code.ilike.%${search.trim()}%`);
    }
    const { data: students } = await studentQuery;
    if (students) {
      for (const s of students) {
        results.push({ user_id: s.user_id, full_name: s.full_name, identifier: s.student_id_code, type: 'student' });
      }
    }

    // Load parents
    let parentQuery = supabase.from('parents').select('user_id, full_name, email').order('full_name').limit(30);
    if (search.trim()) {
      parentQuery = parentQuery.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
    }
    const { data: parents } = await parentQuery;
    if (parents) {
      for (const p of parents) {
        results.push({ user_id: p.user_id, full_name: p.full_name, identifier: p.email, type: 'parent' });
      }
    }

    setRecipientOptions(results);
    setLoadingRecipients(false);
  };

  const selectRecipient = (recipient: RecipientOption) => {
    const existing = conversations.find((c) => c.other_user_id === recipient.user_id);
    if (existing) {
      setActiveRecipientUserId(recipient.user_id);
      setActiveRecipientRole(recipient.type);
      openConversation(existing.conversation_id);
      return;
    }
    const newConvId = crypto.randomUUID();
    setActiveConversationId(newConvId);
    setActiveRecipientUserId(recipient.user_id);
    setActiveRecipientRole(recipient.type);
    setMessages([]);
    setShowConversations(false);
    setShowRecipientPicker(false);
    setHasMoreMessages(false);
  };

  // Debounced recipient search
  useEffect(() => {
    if (!showRecipientPicker) return;
    const t = setTimeout(() => loadRecipients(recipientSearch), 300);
    return () => clearTimeout(t);
  }, [recipientSearch, showRecipientPicker]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !activeConversationId) return;
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        sender_id: user.id,
        sender_role: role || 'student',
        recipient_role: isAdmin ? activeRecipientRole : 'admin',
        recipient_id: activeRecipientUserId || null,
        content: newMessage.trim(),
        is_read: false,
      } as any);

      if (error) throw error;
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    emitTyping();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const getDateKey = (dateStr: string) => new Date(dateStr).toDateString();

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110',
          'bg-gradient-to-br from-primary to-secondary text-primary-foreground',
          isOpen && 'rotate-90'
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-bold">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[500px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-secondary/10 flex items-center gap-2">
            {!showConversations && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowConversations(true); setActiveConversationId(null); setShowRecipientPicker(false); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <MessageCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm flex-1">
              {showRecipientPicker ? 'New Message' : showConversations ? (isAdmin ? 'Messages' : 'Chat with Admin') : 'Conversation'}
            </h3>
            {showConversations && !showRecipientPicker && (
              <Button size="sm" variant="ghost" onClick={startNewConversation} className="text-xs h-7 gap-1">
                <Plus className="h-3 w-3" /> New
              </Button>
            )}
          </div>

          {/* Notification Permission Prompt */}
          {showNotifPrompt && (
            <div className="px-4 py-3 border-b bg-accent/10 flex items-start gap-3">
              <Bell className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-foreground font-medium">Enable notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get alerted when new messages arrive.</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="default" className="h-6 text-xs px-3" onClick={handleEnableNotifications}>
                    Enable
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-3" onClick={handleDismissNotifPrompt}>
                    Not now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Recipient Picker */}
          {showRecipientPicker ? (
            <div className="flex flex-col flex-1 max-h-[400px]">
              <div className="px-3 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Search students & parents..."
                    className="text-sm h-8 pl-8"
                    autoFocus
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loadingRecipients ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Loading...</p>
                ) : recipientOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No recipients found</p>
                ) : (
                  <div className="divide-y">
                    {recipientOptions.map((r) => (
                      <button
                        key={r.user_id}
                        onClick={() => selectRecipient(r)}
                        className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          r.type === 'parent'
                            ? 'bg-gradient-to-br from-accent/20 to-secondary/20'
                            : 'bg-gradient-to-br from-primary/20 to-secondary/20'
                        )}>
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.full_name}</p>
                          {r.identifier && (
                            <p className="text-xs text-muted-foreground truncate">{r.identifier}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                          {r.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="px-3 py-2 border-t">
                <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setShowRecipientPicker(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : showConversations ? (
            /* Conversation List */
            <ScrollArea className="flex-1 max-h-[400px]">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                  <Button size="sm" variant="outline" onClick={startNewConversation} className="mt-3">
                    Start a conversation
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => openConversation(conv.conversation_id)}
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{conv.other_name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                          {conv.unread_count > 0 && (
                            <Badge className="ml-2 h-5 min-w-[20px] flex items-center justify-center text-[10px] shrink-0">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            /* Message Thread */
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-[350px] p-3 space-y-2">
                {/* Load older messages button */}
                {hasMoreMessages && (
                  <div className="text-center pb-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 gap-1.5 text-muted-foreground"
                      onClick={loadOlderMessages}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Loading...</>
                      ) : (
                        'Load older messages'
                      )}
                    </Button>
                  </div>
                )}

                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-8">Send a message to start the conversation</p>
                )}

                {messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user.id;
                  // Date separator
                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const showDateSep = !prevMsg || getDateKey(msg.created_at) !== getDateKey(prevMsg.created_at);

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-2 py-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted-foreground font-medium px-2">{formatDateSeparator(msg.created_at)}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn('text-[10px] mt-1', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {otherTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t flex gap-2">
                <Input
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="text-sm h-9"
                  disabled={sending}
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
