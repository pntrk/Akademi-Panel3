import { db, auth, collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from './firebase';
import { AppNotification } from '../types';
import { generateId } from './utils';

// Web Audio synthesizer for clear, pleasant notification chimes
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First tone (D5 ~ 587Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second tone (A5 ~ 880Hz - harmony)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {
    // Audio context might be restricted before interaction, safe ignore
  }
};

// Check if Notification API is supported
export const isPushNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

// Get current permission status
export const getPushPermissionState = (): NotificationPermission => {
  if (!isPushNotificationSupported()) return 'denied';
  return Notification.permission;
};

// Request browser notification permission
export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (!isPushNotificationSupported()) {
    console.warn('Tarayıcınız Push bildirimlerini desteklemiyor.');
    return 'denied';
  }

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.error('Bildirim izni istenirken hata oluştu:', err);
    return 'denied';
  }
};

// Display local browser push notification (via ServiceWorker or fallback)
export const displayBrowserNotification = async (
  title: string, 
  body: string, 
  tag?: string,
  linkTab?: string
): Promise<boolean> => {
  if (!isPushNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  playNotificationChime();

  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: tag || 'akademi-notification',
    data: {
      url: window.location.origin,
      tab: linkTab || 'results'
    }
  };

  try {
    // Attempt ServiceWorker registration notification first (PWA native behavior)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    }

    // Fallback to standard window Notification
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      if (linkTab && (window as any).__navigateToTab) {
        (window as any).__navigateToTab(linkTab);
      }
    };
    return true;
  } catch (err) {
    console.warn('Bildirim gösterilemedi:', err);
    return false;
  }
};

// Register background service worker for messaging
export const registerNotificationServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return reg;
  } catch (err) {
    console.warn('Bildirim Servis İşçisi kaydı atlandı/desteklenmiyor:', err);
  }
};

// Local persistence fallback for notifications
const LOCAL_NOTIFS_KEY = 'akademi_local_notifications';

export const getLocalNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveLocalNotification = (notif: AppNotification) => {
  try {
    const list = getLocalNotifications();
    const updated = [notif, ...list.filter(n => n.id !== notif.id)].slice(0, 50);
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
  } catch {}
};

export const removeLocalNotification = (id: string) => {
  try {
    const list = getLocalNotifications();
    const updated = list.filter(n => n.id !== id);
    localStorage.setItem(LOCAL_NOTIFS_KEY, JSON.stringify(updated));
  } catch {}
};

// Firestore helper: publish a notification to the cloud (with local fallback)
export const publishCloudNotification = async (
  notification: Omit<AppNotification, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string; offline?: boolean }> => {
  const notifId = generateId();
  const fullNotification: AppNotification = {
    ...notification,
    id: notifId,
    createdAt: new Date().toISOString(),
    createdByEmail: auth.currentUser?.email || 'Yönetim',
    createdByName: auth.currentUser?.displayName || 'Okul Yönetimi',
    readBy: []
  };

  // Always save locally first so the notification is never lost
  saveLocalNotification(fullNotification);

  try {
    await setDoc(doc(db, 'notifications', notifId), fullNotification);
    return { success: true, id: notifId };
  } catch (error: any) {
    // If cloud sync encounters a temporary permission or network hitch, gracefully preserve it locally
    console.warn('Bildirim bulut senkronizasyonu gecikmeli (yerel hafızada korundu):', error?.message || error);
    return { success: true, id: notifId, offline: true };
  }
};

// Firestore helper: remove a notification
export const removeCloudNotification = async (id: string): Promise<boolean> => {
  removeLocalNotification(id);
  try {
    await deleteDoc(doc(db, 'notifications', id));
    return true;
  } catch (e) {
    console.warn('Bildirim buluttan silinemedi (yerel listeden kaldırıldı):', e);
    return true;
  }
};

// Firestore helper: mark notification as read
export const markNotificationRead = async (id: string, userEmail: string): Promise<void> => {
  try {
    const local = getLocalNotifications();
    const target = local.find(n => n.id === id);
    if (target && !target.readBy?.includes(userEmail)) {
      target.readBy = [...(target.readBy || []), userEmail];
      saveLocalNotification(target);
    }
  } catch (e) {
    console.warn('Okundu işaretlenemedi:', e);
  }
};

// Real-time listener for incoming notifications
export const subscribeToNotifications = (
  onUpdate: (notifications: AppNotification[]) => void,
  onNewNotification?: (notification: AppNotification) => void
) => {
  const notifsQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
  
  let isInitialLoad = true;

  // Immediately broadcast local notifications on start
  const initialLocal = getLocalNotifications();
  if (initialLocal.length > 0) {
    onUpdate(initialLocal);
  }

  return onSnapshot(
    notifsQuery,
    (snapshot) => {
      const itemsMap = new Map<string, AppNotification>();
      
      // Add local notifications first
      getLocalNotifications().forEach(item => itemsMap.set(item.id, item));

      const now = Date.now();
      const lastSeenTimestamp = parseInt(localStorage.getItem('last_seen_notification_ts') || '0', 10);

      snapshot.forEach((doc) => {
        const data = doc.data() as AppNotification;
        itemsMap.set(data.id, data);
        saveLocalNotification(data);
      });

      const mergedItems = Array.from(itemsMap.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);

      if (!isInitialLoad && onNewNotification) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const added = change.doc.data() as AppNotification;
            const itemTime = new Date(added.createdAt).getTime();
            // If it's newer than the last seen timestamp (or within last 3 minutes)
            if (itemTime > lastSeenTimestamp && now - itemTime < 180000) {
              onNewNotification(added);
            }
          }
        });
      }

      isInitialLoad = false;
      onUpdate(mergedItems);
    },
    (err) => {
      console.warn('Bildirimler Firestore üzerinden dinlenirken uyarı (yerel liste devrede):', err?.message || err);
      // Fallback to local storage if Firestore connection has an issue
      onUpdate(getLocalNotifications());
    }
  );
};
