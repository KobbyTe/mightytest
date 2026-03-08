
-- Add DELETE policy for messages: senders can delete their own messages, admins can delete any
CREATE POLICY "Senders can delete own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
