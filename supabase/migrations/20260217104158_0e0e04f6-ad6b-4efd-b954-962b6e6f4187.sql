
-- Create page_views table for custom event tracking
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT DEFAULT 'desktop',
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  event_type TEXT NOT NULL DEFAULT 'page_view',
  event_data JSONB DEFAULT '{}'::jsonb,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (tracking works for anonymous + authenticated users)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Only admins can read analytics data
CREATE POLICY "Admins can view all page views"
ON public.page_views
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete (cleanup)
CREATE POLICY "Admins can delete page views"
ON public.page_views
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for efficient analytics queries
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_page_path ON public.page_views (page_path);
CREATE INDEX idx_page_views_session_id ON public.page_views (session_id);
CREATE INDEX idx_page_views_event_type ON public.page_views (event_type);
CREATE INDEX idx_page_views_device_type ON public.page_views (device_type);
