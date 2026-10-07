/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { StudentsView } from './views/StudentsView';
import { ExamsView } from './views/ExamsView';
import { ResultsView } from './views/ResultsView';
import { BudgetView } from './views/BudgetView';
import { HallsView } from './views/HallsView';
import { LeagueView } from './views/LeagueView';
import { ScanView } from './views/ScanView';
import { KeysAndPrintView } from './views/KeysAndPrintView';
import { OmrSetupView } from './views/OmrSetupView';
import { AnalysisView } from './views/AnalysisView';
import { auth, loginWithGoogle, loginWithEmail, registerWithEmail, logout, firebaseConfig, onAuthStateChanged, User, createSyntheticUser, db, doc, getDoc, setDoc } from './lib/firebase';
import { LogIn, Lock, Copy, Check, ExternalLink, ShieldCheck, Sparkles, ChevronDown, ChevronUp, AlertTriangle, UserCheck, Database, Cloud, HardDriveDownload, Mail, KeyRound, UserPlus } from 'lucide-react';
import { useAppContext, checkIsQuotaExceededToday, markQuotaExceededToday } from './context/AppContext';

// Record user login into access_requests collection so administrators see all registered users
const syncUserRegistration = async (targetUser: User) => {
  const cleanEmail = (targetUser.email || '').trim().toLowerCase();
  if (!cleanEmail || !firebaseConfig.projectId) return;
  if (checkIsQuotaExceededToday()) return;

  try {
    const docRef = doc(db, 'access_requests', cleanEmail);
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) {
      // Document already exists: only write if at least 12 hours passed or profile info changed
      const existing = snap.data();
      const lastLoginTime = existing?.lastLoginAt ? new Date(existing.lastLoginAt).getTime() : 0;
      const hoursSinceLogin = (Date.now() - lastLoginTime) / (1000 * 60 * 60);
      const nameChanged = targetUser.displayName && existing?.name !== targetUser.displayName;
      const photoChanged = targetUser.photoURL && existing?.photoURL !== targetUser.photoURL;

      if (hoursSinceLogin > 12 || nameChanged || photoChanged) {
        await setDoc(docRef, {
          email: cleanEmail,
          name: targetUser.displayName || existing?.name || cleanEmail.split('@')[0],
          photoURL: targetUser.photoURL || existing?.photoURL || null,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      }
    } else {
      // First time login: automatically register as teacher (or admin if in admin list) with approved status
      const adminEmails = ['bahadirkumcu@gmail.com', 'kirklareliataturkortaokulu@gmail.com', 'athdsdta@gmail.com', 'haruntahtaci@gmail.com'];
      const initialRole = adminEmails.includes(cleanEmail) ? 'admin' : 'teacher';

      await setDoc(docRef, {
        email: cleanEmail,
        name: targetUser.displayName || cleanEmail.split('@')[0],
        photoURL: targetUser.photoURL || null,
        role: initialRole,
        status: 'approved',
        lastLoginAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err: any) {
    console.warn('User registration sync notice:', err);
  }
};

function AppContent({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { 
    userRole, 
    checkAndRefreshRole, 
    loading: appLoading, 
    isInitialHydrating,
    isWaitingForDriveAuth,
    isConnectingDriveStartup,
    driveStartupStatusText,
    connectDriveAndHydrateOnStartup,
    skipDriveAndUseCloudStorage,
    lastDriveSyncedAt,
    state
  } = useAppContext();
  const [activeTab, setActiveTab] = useState<'students' | 'halls' | 'results' | 'scan' | 'keys_print' | 'omr-setup' | 'analysis' | 'exams' | 'league' | 'budget'>(
    'halls'
  );
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Formatted date and time of the live Google Drive file (Guaranteed to include date: DD.MM.YYYY HH:MM)
  const driveDateText = useMemo(() => {
    let raw: string | null = lastDriveSyncedAt || null;
    if (!raw) {
      try {
        raw = localStorage.getItem('akademi_last_drive_sync_datetime') || localStorage.getItem('akademi_last_drive_sync_time');
      } catch {}
    }
    if (!raw && state?.lastPublishedAt) {
      raw = state.lastPublishedAt;
    }
    if (!raw) {
      try {
        const local = localStorage.getItem('okulYonetimState');
        if (local) {
          const parsed = JSON.parse(local);
          raw = parsed.lastPublishedAt || parsed.lastDriveSyncedAt;
        }
      } catch {}
    }

    const todayDateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const nowTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    if (!raw) {
      return `${todayDateStr} ${nowTimeStr}`;
    }

    const cleanRaw = String(raw).trim();

    // If it already has a full date formatted like "04.10.2026 12:30"
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(cleanRaw)) {
      return cleanRaw;
    }

    // If it's just a time string like "12:30"
    if (/^\d{1,2}:\d{2}/.test(cleanRaw)) {
      return `${todayDateStr} ${cleanRaw}`;
    }

    // Try parsing as ISO date or timestamp
    try {
      const d = new Date(cleanRaw);
      if (!isNaN(d.getTime())) {
        const formattedDate = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedTime = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return `${formattedDate} ${formattedTime}`;
      }
    } catch {}

    return `${todayDateStr} ${cleanRaw}`;
  }, [lastDriveSyncedAt, state?.lastPublishedAt]);

  // Auto-refresh role if in guest mode (gentle 30-second fallback; instant update is already handled by onSnapshot)
  useEffect(() => {
    if (userRole === 'guest') {
      if (checkIsQuotaExceededToday()) return;
      const interval = setInterval(() => {
        checkAndRefreshRole().catch(() => {});
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole, checkAndRefreshRole]);

  // Enforce role restrictions
  useEffect(() => {
    // Öğretmen yetkisindeki kullanıcılara Sonuçlar, Analiz, Arena ve Salonlar & Oturma Düzeni (sadece önizleme) açılır
    if (userRole === 'teacher') {
      const allowedTeacherTabs = ['results', 'analysis', 'league', 'halls'];
      if (!allowedTeacherTabs.includes(activeTab)) {
        setActiveTab('results');
      }
      return;
    }

    if (userRole === 'guest') {
      return;
    }
  }, [userRole, activeTab]);

  // 1. ADMIN / TEACHER HYDRATION: Açılışta canlı kütük yüklenirken yükleme ekranı (Önce kütük indirilir, öğretmen listesi taranır)
  if (appLoading || isInitialHydrating) {
    if (isWaitingForDriveAuth && userRole === 'admin') {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] dark:bg-[#121316] p-4 sm:p-6 text-center font-sans">
          <div className="bg-white dark:bg-[#1A1D24] p-6 sm:p-8 rounded-3xl shadow-xl border border-[#B08D57]/40 dark:border-slate-800 max-w-md w-full flex flex-col items-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-[#B08D57] to-emerald-600"></div>

            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center mb-4 mt-2 shadow-sm">
              <HardDriveDownload className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1.5 font-serif">
              Google Drive Canlı Kütük İndirme
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
              Google Drive üzerindeki ortak canlı kütüğü (1g24DSyjP7u3OaIoUz3MGeVlS5HsqmrIg) doğrudan cihazınıza eksiksiz indirmek için yetkilendirmeyi onaylayın.
            </p>

            <div className="w-full space-y-2.5">
              <button
                onClick={() => connectDriveAndHydrateOnStartup()}
                disabled={isConnectingDriveStartup}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <HardDriveDownload className="w-4 h-4 shrink-0" />
                <span className="leading-snug">
                  {isConnectingDriveStartup 
                    ? 'Drive Bağlanıyor & İndiriliyor...' 
                    : `Google Drive'a Bağlan & Canlı Kütüğü İndir (${driveDateText})`}
                </span>
              </button>

              <button
                onClick={() => skipDriveAndUseCloudStorage()}
                disabled={isConnectingDriveStartup}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Cloud className="w-3.5 h-3.5 text-gray-500" />
                <span>Bulut (Firebase) Yedeği ile Devam Et</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 leading-normal">
              💡 Yönetici hesabınızla Google Drive üzerindeki ortak kütüğe bağlanarak en güncel öğrenci listesini ve sınav sonuçlarını alırsınız.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F5] dark:bg-[#121316] p-4 sm:p-6 text-center font-sans">
        <div className="bg-white dark:bg-[#1A1D24] p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200/90 dark:border-slate-800 max-w-md w-full flex flex-col items-center animate-fade-in relative overflow-hidden">
          {/* Top Amber Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-[#B08D57] to-amber-500"></div>

          <div className="relative mb-4 mt-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shadow-md">
              <Database className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-1.5">
            {userRole === 'admin' ? 'Canlı Okul Kütüğü Yükleniyor...' : 'Öğretmen Paneli Yükleniyor...'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            {driveStartupStatusText || (userRole === 'admin' ? 'En güncel okul kütüğü ve sınav verileri alınıyor.' : 'Sınav sonuçları ve değerlendirme verileri alınıyor.')}
          </p>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Veriler güvenle senkronize ediliyor...</span>
          </div>

          {userRole === 'admin' && (
            <button
              onClick={() => skipDriveAndUseCloudStorage()}
              className="text-[11px] text-[#8e8d82] hover:text-[#5a5a40] dark:text-slate-400 dark:hover:text-slate-200 underline transition-colors cursor-pointer pt-1"
            >
              Beklemeden yerel / bulut verileriyle devam et
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. GUEST USER: Hydration tamamlandıktan sonra öğretmen/yönetici listesinde yoksa "Yönetici Onayı Bekleniyor" gösterilir
  if (userRole === 'guest') {
    const handleCheckStatus = async () => {
      setIsCheckingRole(true);
      setStatusMessage(null);
      try {
        const newRole = await checkAndRefreshRole();
        if (newRole === 'guest') {
          setStatusMessage('Yönetici tarafından henüz yetki tanımlanmadı. Lütfen yöneticinizin onaylamasını bekleyiniz.');
        }
      } catch (e) {
        setStatusMessage('Yetki kontrolü sırasında bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
      } finally {
        setTimeout(() => setIsCheckingRole(false), 600);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl max-w-lg w-full text-center border border-[#e6e2d3] animate-fade-in relative overflow-hidden">
          {/* Top Decorative Amber Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-[#B08D57] to-amber-500"></div>

          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5 text-amber-600 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Yönetici Onayı Bekleniyor
          </span>

          <h1 className="text-2xl font-serif font-bold text-[#5a5a40] mb-2">Erişim İsteğiniz Alındı</h1>
          
          <div className="my-5 p-4 bg-[#fcfbf7] rounded-2xl border border-[#e6e2d3] text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8e8d82] mb-1">Giriş Yapılan Hesap</p>
            <p className="text-sm font-bold text-[#5a5a40] truncate">{user.displayName || 'Kullanıcı'}</p>
            <p className="text-xs font-medium text-[#8e8d82] truncate font-mono">{user.email}</p>
          </div>

          <p className="text-[#8e8d82] text-xs leading-relaxed mb-4">
            E-posta adresiniz sisteme başarıyla kaydedildi. Okul yöneticiniz <strong className="text-[#5a5a40]">Kullanıcı & Yetki Yönetimi</strong> panelinden hesabınıza <strong className="text-blue-700">Öğretmen</strong> veya <strong className="text-emerald-700">İdareci</strong> yetkisi tanımladığında, bu sayfa otomatik olarak açılacaktır.
          </p>

          {statusMessage && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium animate-fade-in">
              {statusMessage}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              onClick={handleCheckStatus}
              disabled={isCheckingRole}
              className="w-full bg-[#B08D57] hover:bg-[#c4a46e] active:scale-[0.99] text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isCheckingRole ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Yetki Durumu Kontrol Ediliyor...
                </>
              ) : (
                'Onay Durumunu Yenile'
              )}
            </button>

            <button
              onClick={onLogout}
              className="w-full bg-transparent hover:bg-gray-100 text-[#8e8d82] hover:text-[#5a5a40] py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
            >
              Farklı Bir Hesapla Giriş Yap / Çıkış
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab as (tab: string) => void} onLogout={onLogout} currentUser={user}>
      {activeTab === 'students' && userRole === 'admin' && <StudentsView />}
      {activeTab === 'halls' && (userRole === 'admin' || userRole === 'teacher') && <HallsView />}
      {activeTab === 'results' && <ResultsView />}
      {activeTab === 'scan' && userRole === 'admin' && (
        <ScanView onNavigate={setActiveTab as (tab: string) => void} />
      )}
      {(activeTab === 'omr-setup' || (activeTab as string) === 'keys_print') && userRole === 'admin' && <KeysAndPrintView />}
      {activeTab === 'analysis' && <AnalysisView />}
      {activeTab === 'exams' && userRole === 'admin' && <ExamsView />}
      {activeTab === 'league' && <LeagueView />}
      {activeTab === 'budget' && userRole === 'admin' && <BudgetView />}
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  
  // Email & Password auth states
  const [emailTab, setEmailTab] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('akademi_user_session') || sessionStorage.getItem('akademi_preview_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email) {
          const restoredUser = createSyntheticUser(parsed.email, parsed.displayName || parsed.name);
          setUser(restoredUser);
          syncUserRegistration(restoredUser).catch(() => {});
          setLoading(false);
        }
      }
    } catch (e) {}

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          localStorage.setItem('akademi_user_session', JSON.stringify({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          }));
        } catch (e) {}
        syncUserRegistration(currentUser).catch(() => {});
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCopyDomain = async (domainToCopy: string) => {
    try {
      await navigator.clipboard.writeText(domainToCopy);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    setUnauthorizedDomain(null);
    setIsLoggingIn(true);
    try {
      const res = await loginWithGoogle();
      if (res?.user) {
        try {
          localStorage.setItem('akademi_user_session', JSON.stringify({
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName,
            photoURL: res.user.photoURL
          }));
        } catch (e) {}
        syncUserRegistration(res.user).catch(() => {});
      }
    } catch (err: any) {
      console.warn("Login attempt result:", err);
      if (err?.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        setUnauthorizedDomain(hostname);
        setLoginError(`Bu alan adı (${hostname}) için yetki doğrulaması gerekiyor.`);
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setLoginError('Giriş penceresi kapatıldı. Lütfen tekrar deneyiniz.');
      } else if (err?.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setLoginError(err?.message || 'Google ile giriş yapılamadı.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setUnauthorizedDomain(null);
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLoginError('Lütfen geçerli bir e-posta adresi giriniz.');
      return;
    }
    if (cleanPass.length < 4) {
      setLoginError('Şifre en az 4 karakter olmalıdır.');
      return;
    }

    setIsEmailSubmitting(true);
    try {
      let authedUser: User | null = null;
      if (isRegisterMode) {
        try {
          authedUser = await registerWithEmail(cleanEmail, cleanPass, displayNameInput.trim() || cleanEmail.split('@')[0]);
        } catch (regErr: any) {
          if (regErr?.code === 'auth/email-already-in-use') {
            // If already in use, attempt logging in with this password
            authedUser = await loginWithEmail(cleanEmail, cleanPass);
          } else if (regErr?.code === 'auth/operation-not-allowed' || regErr?.code === 'auth/configuration-not-found') {
            // In case Email/Password provider is not toggled in Firebase Console, grant local access seamlessly!
            authedUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
          } else {
            throw regErr;
          }
        }
      } else {
        try {
          authedUser = await loginWithEmail(cleanEmail, cleanPass);
        } catch (loginErr: any) {
          if (loginErr?.code === 'auth/user-not-found' || loginErr?.code === 'auth/invalid-credential') {
            // First time this teacher is signing in with email/pass: automatically register them!
            try {
              authedUser = await registerWithEmail(cleanEmail, cleanPass, displayNameInput.trim() || cleanEmail.split('@')[0]);
            } catch (autoRegErr: any) {
              if (autoRegErr?.code === 'auth/operation-not-allowed' || autoRegErr?.code === 'auth/configuration-not-found') {
                authedUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
              } else if (autoRegErr?.code === 'auth/email-already-in-use') {
                throw loginErr;
              } else {
                authedUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
              }
            }
          } else if (loginErr?.code === 'auth/operation-not-allowed' || loginErr?.code === 'auth/configuration-not-found') {
            // Firebase Auth provider not toggled on: use fallback user so teacher is never blocked!
            authedUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
          } else if (loginErr?.code === 'auth/wrong-password') {
            setLoginError('Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyiniz.');
            return;
          } else {
            // Fallback user if network or quota issue
            authedUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
          }
        }
      }

      if (authedUser) {
        const sessionData = {
          uid: authedUser.uid,
          email: authedUser.email || cleanEmail,
          displayName: authedUser.displayName || displayNameInput.trim() || cleanEmail.split('@')[0],
          photoURL: authedUser.photoURL || null
        };
        try {
          localStorage.setItem('akademi_user_session', JSON.stringify(sessionData));
        } catch (e) {}
        setUser(authedUser);
        syncUserRegistration(authedUser).catch(() => {});
      }
    } catch (err: any) {
      console.warn('Email auth result:', err);
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setLoginError('E-posta veya şifre hatalı.');
      } else if (err?.code === 'auth/invalid-email') {
        setLoginError('Geçersiz e-posta formatı.');
      } else if (err?.code === 'auth/weak-password') {
        setLoginError('Şifre en az 6 karakter olmalıdır.');
      } else {
        // As a failsafe, never lock the user out!
        const fallbackUser = createSyntheticUser(cleanEmail, displayNameInput.trim() || cleanEmail.split('@')[0]);
        setUser(fallbackUser);
        try {
          localStorage.setItem('akademi_user_session', JSON.stringify({
            uid: fallbackUser.uid,
            email: fallbackUser.email,
            displayName: fallbackUser.displayName
          }));
        } catch (e) {}
        syncUserRegistration(fallbackUser).catch(() => {});
      }
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const handlePreviewLogin = (email: string, displayName: string) => {
    const syntheticUser = createSyntheticUser(email, displayName);
    const sessionData = { uid: syntheticUser.uid, email, displayName };
    try {
      localStorage.setItem('akademi_user_session', JSON.stringify(sessionData));
      sessionStorage.setItem('akademi_preview_user', JSON.stringify(sessionData));
    } catch (e) {}
    setUser(syntheticUser);
    syncUserRegistration(syntheticUser).catch(() => {});
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('akademi_user_session');
      sessionStorage.removeItem('akademi_preview_user');
    } catch (e) {}
    setUser(null);
    await logout().catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#B08D57] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    const currentHost = window.location.hostname;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 font-sans">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border border-[#e6e2d3] relative overflow-hidden">
          {/* Top Decorative Amber Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-[#B08D57] to-amber-500"></div>

          <div className="mb-6 flex flex-col items-center">
            <div className="relative mb-3 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-red-500/20 rounded-3xl blur-md opacity-70 group-hover:opacity-100 transition-opacity"></div>
              <img 
                src="/apple-touch-icon.png" 
                alt="AkademiPanel Logo" 
                className="relative w-20 h-20 rounded-2xl shadow-lg border border-[#e6e2d3] object-cover transition-transform group-hover:scale-105" 
              />
            </div>
            <h1 className="text-3xl font-serif font-bold text-[#5a5a40] tracking-tight italic">AkademiPanel</h1>
            <p className="text-[#8e8d82] text-xs font-semibold mt-1">Ölçme ve Değerlendirme Yönetim Sistemi</p>
          </div>

          {/* Giriş Yöntemi Seçenekleri */}
          <div className="space-y-4 text-left">
            {/* 1. Google ile Giriş Butonu */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={isLoggingIn || isEmailSubmitting}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:scale-[0.99] text-gray-800 border-2 border-gray-200 hover:border-[#B08D57] py-3.5 px-4 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoggingIn ? (
                <>
                  <span className="w-5 h-5 border-2 border-[#B08D57] border-t-transparent rounded-full animate-spin"></span>
                  <span>Google ile Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span className="text-gray-700 group-hover:text-gray-900 font-semibold">Google ile Giriş Yap</span>
                </>
              )}
            </button>

            {/* Ayırıcı */}
            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="bg-white px-3 text-[11px] font-semibold text-[#8e8d82] uppercase tracking-wider whitespace-nowrap">
                veya e-posta &amp; şifre ile
              </span>
              <div className="border-t border-gray-200 w-full"></div>
            </div>

            {/* 2. E-posta & Şifre Formu */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isRegisterMode && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Ad Soyad
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Adınız ve Soyadınız"
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#B08D57] focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  E-Posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ornek@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#B08D57] focus:bg-white transition-all font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Şifre
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Şifrenizi giriniz"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#B08D57] focus:bg-white transition-all font-medium font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isEmailSubmitting || isLoggingIn}
                className="w-full py-3 px-4 bg-[#B08D57] hover:bg-[#967746] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isEmailSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>İşlem Yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{isRegisterMode ? 'Kayıt Ol & Giriş Yap' : 'E-Posta ile Giriş Yap'}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setLoginError(null);
                  }}
                  className="text-[11px] font-semibold text-[#8e8d82] hover:text-[#5a5a40] transition-colors cursor-pointer"
                >
                  {isRegisterMode ? '← Zaten bir hesabınız var mı? Giriş Yap' : 'Hesabınız yok mu? Yeni Hesap Oluştur →'}
                </button>
              </div>
            </form>

            {/* Error & Unauthorized Domain Helper */}
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left text-xs text-rose-800 animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{loginError}</p>
                    {unauthorizedDomain && (
                      <div className="mt-2 pt-2 border-t border-rose-200/80">
                        <p className="text-[11px] text-rose-700 mb-1.5">
                          Bu alan adını Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains altına ekleyebilirsiniz:
                        </p>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-rose-200 font-mono text-[11px]">
                          <span className="flex-1 truncate select-all">{unauthorizedDomain}</span>
                          <button
                            onClick={() => handleCopyDomain(unauthorizedDomain)}
                            className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 rounded text-rose-800 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedDomain ? 'Kopyalandı' : 'Kopyala'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bilgilendirme Notu */}
            <div className="pt-2 text-center text-[11px] text-[#8e8d82] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Yönetici ve yetkili öğretmen hesapları otomatik olarak tanınır</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppProvider user={user}>
      <AppContent user={user} onLogout={handleLogout} />
    </AppProvider>
  );
}
