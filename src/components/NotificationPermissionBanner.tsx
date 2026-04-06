import { useState, useEffect } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationPermissionBanner() {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('notification-banner-dismissed');
    if (wasDismissed) setDismissed(true);
  }, []);

  if (!isSupported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleRequest = async () => {
    setRequesting(true);
    await requestPermission();
    setRequesting(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notification-banner-dismissed', 'true');
  };

  return (
    <div className="mx-2 sm:mx-0 mb-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 p-3 sm:p-4 animate-in slide-in-from-top-2 duration-500">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-primary/10 p-2">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">Enable Notifications</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Get instant alerts for new exams, grades, messages, and important updates right on your phone.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleRequest}
              disabled={requesting}
              className="h-8 text-xs px-3 gap-1.5"
            >
              <Bell className="h-3.5 w-3.5" />
              {requesting ? 'Requesting...' : 'Allow Notifications'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 text-xs px-2 text-muted-foreground"
            >
              Not now
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
