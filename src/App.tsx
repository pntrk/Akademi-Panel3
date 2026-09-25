/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { auth, loginWithGoogle, logout, firebaseConfig, onAuthStateChanged, User, createSyntheticUser, db, doc, setDoc } from './lib/firebase';
import { LogIn, Lock, Copy, Check, ExternalLink, ShieldCheck, Sparkles, ChevronDown, ChevronUp, AlertTriangle, UserCheck } from 'lucide-react';
import { useAppContext, checkIsQuotaExceededToday, markQuotaExceededToday } from './context/AppContext';

// Record user login into access_requests collection so administrators see all registered users (throttled to once/day)
const syncUserRegistration = async (targetUser: User) => {
  const cleanEmail = (targetUser.email || '').trim().toLowerCase();
  if (!cleanEmail || !firebaseConfig.projectId) return;
  if (checkIsQuotaExceededToday()) return;

  const todayKey = `app_user_synced_${cleanEmail}_${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(todayKey)) return;

  try {
    const docRef = doc(db, 'access_requests', cleanEmail);
    await setDoc(docRef, {
      email: cleanEmail,
      name: targetUser.displayName || cleanEmail.split('@')[0],
      photoURL: targetUser.photoURL || null,
      lastLoginAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    }, { merge: true });
    localStorage.setItem(todayKey, '1');
  } catch (err: any) {
    const errStr = String(err?.message || err || '');
    if (errStr.includes('Quota exceeded') || errStr.includes('resource-exhausted') || err?.code === 'resource-exhausted' || errStr.includes('Free daily write units') || errStr.includes('Quota limit exceeded')) {
      markQuotaExceededToday();
    } else {
      console.warn('User registration sync notice:', err);
    }
  }
};

function AppContent({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { userRole, checkAndRefreshRole } = useAppContext();
  const [activeTab, setActiveTab] = useState<'students' | 'halls' | 'results' | 'scan' | 'keys_print' | 'omr-setup' | 'analysis' | 'exams' | 'league' | 'budget'>(
    'results'
  );
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Auto-refresh role if in guest mode, unless quota is exceeded
  useEffect(() => {
    if (userRole === 'guest') {
      if (checkIsQuotaExceededToday()) return;
      const interval = setInterval(() => {
        checkAndRefreshRole().catch(() => {});
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [userRole, checkAndRefreshRole]);

  // Enforce role restrictions
  useEffect(() => {
    // Öğretmen yetkisindeki kullanıcılara sadece Sonuçlar, Analiz ve Arena açılır
    if (userRole === 'teacher') {
      const allowedTeacherTabs = ['results', 'analysis', 'league'];
      if (!allowedTeacherTabs.includes(activeTab)) {
        setActiveTab('results');
      }
      return;
    }

    if (userRole === 'guest') {
      return;
    }
  }, [userRole, activeTab]);

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
            E-posta adresiniz sisteme başarıyla kaydedildi. Okul yöneticiniz <strong className="text-[#5a5a40]">Kullanıcı Yetki Yönetimi</strong> panelinden hesabınıza <strong className="text-blue-700">Öğretmen</strong> veya <strong className="text-emerald-700">İdareci</strong> yetkisi tanımladığında, bu sayfa otomatik olarak açılacaktır.
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
      {activeTab === 'halls' && userRole === 'admin' && <HallsView />}
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

          {/* Primary Action: Real Google Sign-in */}
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
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

            {/* Error & Unauthorized Domain Helper */}
            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-left text-xs text-rose-800 animate-fade-in">
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
