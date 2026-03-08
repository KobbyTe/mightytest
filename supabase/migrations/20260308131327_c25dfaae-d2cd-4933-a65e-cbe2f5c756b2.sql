
-- Messages table for student/parent <-> admin communication
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  recipient_role text NOT NULL DEFAULT 'admin',
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast conversation lookups
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Students can insert messages they send
CREATE POLICY "Students can insert own messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND
  sender_role IN ('student', 'parent')
);

-- Students can view messages in their conversations
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT TO authenticated
USING (
  sender_id = auth.uid() OR
  conversation_id IN (
    SELECT DISTINCT m.conversation_id FROM public.messages m WHERE m.sender_id = auth.uid()
  )
);

-- Users can update read status on messages sent to them
CREATE POLICY "Users can mark messages as read"
ON public.messages FOR UPDATE TO authenticated
USING (
  conversation_id IN (
    SELECT DISTINCT m.conversation_id FROM public.messages m WHERE m.sender_id = auth.uid()
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage all messages"
ON public.messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
