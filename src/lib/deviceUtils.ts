/**
 * Device & Browser Detection Utilities
 * Detects Android, iOS, In-App WebViews (WhatsApp, Telegram, etc.)
 * and provides helper utilities for mobile login resilience.
 */

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua);
};

export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isInAppBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  // Check for common in-app browser signatures
  return /FBAN|FBAV|Instagram|WhatsApp|Telegram|Line|Twitter|Snapchat|wv|WebView|Version\/[0-9.]+\s+Chrome\/[0-9.]+\s+Mobile/i.test(ua) ||
    // Android specific WebView detection
    (/Android/i.test(ua) && /Version\/[0-9.]+/i.test(ua));
};

export interface TeacherProfile {
  email: string;
  name: string;
  branch?: string;
  avatarBg?: string;
}

export const KNOWN_TEACHERS: TeacherProfile[] = [
  { email: 'celiksadik0@gmail.com', name: 'Sadık ÇELİK', branch: 'Öğretmen', avatarBg: 'bg-blue-600' },
  { email: 'nagihanyavas471@gmail.com', name: 'Nagihan YAVAŞ', branch: 'Öğretmen', avatarBg: 'bg-emerald-600' },
  { email: 'deryaertugrul35@gmail.com', name: 'Derya ERTUĞRUL', branch: 'Öğretmen', avatarBg: 'bg-purple-600' },
  { email: 'sebnemcivas@gmail.com', name: 'Şebnem CİVAŞ', branch: 'Öğretmen', avatarBg: 'bg-pink-600' },
  { email: 'sibelpur39@gmail.com', name: 'Sibel PÜR', branch: 'Öğretmen', avatarBg: 'bg-amber-600' },
  { email: 'selcenserdaroglu@gmail.com', name: 'Selcen SERDAROĞLU', branch: 'Öğretmen', avatarBg: 'bg-indigo-600' },
  { email: 'yeliztunc79@gmail.com', name: 'Yeliz TUNÇ', branch: 'Öğretmen', avatarBg: 'bg-teal-600' },
  { email: 'melekkaydogduu@gmail.com', name: 'Melek AYDOĞDU', branch: 'Öğretmen', avatarBg: 'bg-rose-600' },
  { email: 'oznurknl@gmail.com', name: 'Öznur KINALI', branch: 'Öğretmen', avatarBg: 'bg-cyan-600' },
  { email: 'emela544@gmail.com', name: 'Emel A.', branch: 'Öğretmen', avatarBg: 'bg-violet-600' },
  { email: 'abdullaherbileses@gmail.com', name: 'Abdullah ERBİLESES', branch: 'Öğretmen', avatarBg: 'bg-orange-600' },
  { email: 'gkumcu2@gmail.com', name: 'Gülay KUMCU', branch: 'Öğretmen', avatarBg: 'bg-sky-600' },
  { email: 'kumcu3989@gmail.com', name: 'B. KUMCU', branch: 'Öğretmen', avatarBg: 'bg-slate-700' },
];

export const getTeacherDisplayName = (email: string): string => {
  const clean = (email || '').trim().toLowerCase();
  const found = KNOWN_TEACHERS.find(t => t.email.toLowerCase() === clean);
  if (found) return found.name;
  if (clean.includes('@')) {
    const prefix = clean.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return email || 'Öğretmen';
};
