-- Fix search_path for trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Add RLS policy for password_reset_tokens (only admins can manage)
CREATE POLICY "Only system can manage password reset tokens"
  ON public.password_reset_tokens FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));