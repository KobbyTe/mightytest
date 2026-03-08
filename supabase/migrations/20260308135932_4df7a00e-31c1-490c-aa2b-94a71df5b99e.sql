
-- Add recipient_id column
ALTER TABLE public.messages ADD COLUMN recipient_id uuid;

-- Drop flawed policies
DROP POLICY IF EXISTS "Students can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;

-- New SELECT: sender or recipient can see
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid() 
    OR recipient_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- New INSERT: any authenticated user where sender_id = self
CREATE POLICY "Authenticated users can insert messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- New UPDATE: recipient can mark as read
CREATE POLICY "Recipients can mark messages as read" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    recipient_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );
