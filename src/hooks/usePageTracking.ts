import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function generateSessionId(): string {
  const stored = sessionStorage.getItem('analytics_session_id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  sessionStorage.setItem('analytics_session_id', id);
  return id;
}

function detectDevice(): { device_type: string; browser: string; os: string } {
  const ua = navigator.userAgent;
  
  let device_type = 'desktop';
  if (/Mobi|Android/i.test(ua)) device_type = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) device_type = 'tablet';

  let browser = 'Other';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';

  let os = 'Other';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

  return { device_type, browser, os };
}

export function usePageTracking() {
  const location = useLocation();
  const startTimeRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Don't double-track same path
    if (currentPath === lastPathRef.current) return;

    // Log duration for previous page
    if (lastPathRef.current) {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (duration > 1) {
        supabase.from('page_views').update({ duration_seconds: duration })
          .eq('session_id', generateSessionId())
          .eq('page_path', lastPathRef.current)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(() => {}); // fire-and-forget
      }
    }

    lastPathRef.current = currentPath;
    startTimeRef.current = Date.now();

    const { device_type, browser, os } = detectDevice();

    supabase.from('page_views').insert({
      session_id: generateSessionId(),
      page_path: currentPath,
      page_title: document.title,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      device_type,
      browser,
      os,
      event_type: 'page_view',
    }).then(() => {}); // fire-and-forget

  }, [location.pathname]);
}
