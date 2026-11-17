export interface AppNotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = 'cmn_lifras_notifications_v1';

export function getStoredNotifications(): AppNotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppNotificationItem[];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(items: AppNotificationItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 25)));
  } catch {
    // Ignorer si quota plein
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return Notification.requestPermission();
}

export function pushAppNotification(title: string, body: string): AppNotificationItem {
  const newItem: AppNotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };

  const current = getStoredNotifications();
  saveStoredNotifications([newItem, ...current]);

  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, {
        body,
        icon: '/logo-lifras.jpg',
        badge: '/logo-lifras.jpg',
      });
    } catch {
      // Sur certains navigateurs mobiles, Notification requiert le ServiceWorkerRegistration
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready.then((reg) =>
          reg.showNotification(title, {
            body,
            icon: '/logo-lifras.jpg',
          })
        );
      }
    }
  }

  window.dispatchEvent(new CustomEvent('cmn-notification-added'));
  return newItem;
}

export function markAllNotificationsRead(): AppNotificationItem[] {
  const updated = getStoredNotifications().map((n) => ({ ...n, read: true }));
  saveStoredNotifications(updated);
  window.dispatchEvent(new CustomEvent('cmn-notification-added'));
  return updated;
}
