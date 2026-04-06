import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission as PermissionState);
    } else {
      setPermission('unsupported');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'unsupported';

    try {
      // Register service worker first
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration.scope);

      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result === 'granted') {
        // Show a test notification to confirm it works
        registration.showNotification('Mighty Test 🎉', {
          body: 'Notifications enabled! You\'ll receive alerts for exams, grades, and messages.',
          icon: '/favicon.png',
          badge: '/favicon.png',
          vibrate: [100, 50, 100],
          tag: 'welcome',
        });
      }

      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [isSupported]);

  const sendLocalNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        ...options,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    sendLocalNotification,
  };
}
