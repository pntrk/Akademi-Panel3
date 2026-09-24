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
import { auth, loginWithGoogle, logout, firebaseConfig, onAuthStateChanged, User, createSyntheticUser } from './lib/firebase';
import { LogIn, Lock, Copy, Check, ExternalLink, ShieldCheck, Sparkles, ChevronDown, ChevronUp, AlertTriangle, UserCheck } from 'lucide-react';
import { useAppContext } from './context/AppContext';

function AppContent({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { userRole, checkAndRefreshRole } = useAppContext();
  const [activeTab, setActiveTab] = useState<'students' | 'halls' | 'results' | 'scan' | 'keys_print' | 'omr-setup' | 'analysis' | 'exams' | 'league' | 'budget'>(
    'results'
  );
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Auto-refresh role every 4 seconds if in guest mode
  useEffect(() => {
    if (userRole === 'guest') {
      const interval = setInterval(() => {
        checkAndRefreshRole().catch(() => {});
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [userRole, checkAndRefreshRole]);

  // Enforce role restrictions
  useEffect(() => {
    // Only admin and teacher can access 'scan'
    if (activeTab === 'scan' && userRole !== 'admin' && userRole !== 'teacher') {
      setActiveTab('results');
      return;
    }

    if (userRole === 'teacher' && !['students', 'halls', 'results', 'omr-setup', 'keys_print', 'analysis', 'league', 'scan', 'exams'].includes(activeTab)) {
      setActiveTab('results');
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
      {activeTab === 'students' && <StudentsView />}
      {activeTab === 'halls' && <HallsView />}
      {activeTab === 'results' && <ResultsView />}
      {activeTab === 'scan' && (userRole === 'admin' || userRole === 'teacher') && (
        <ScanView onNavigate={setActiveTab as (tab: string) => void} />
      )}
      {(activeTab === 'omr-setup' || (activeTab as string) === 'keys_print') && <KeysAndPrintView />}
      {activeTab === 'analysis' && <AnalysisView />}
      {activeTab === 'exams' && <ExamsView />}
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
      const saved = sessionStorage.getItem('akademi_preview_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email) {
          setUser(createSyntheticUser(parsed.email, parsed.displayName));
          setLoading(false);
          return;
        }
      }
    } catch (e) {}

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
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
      await loginWithGoogle();
    } catch (err: any) {
      console.warn("Login attempt result:", err);
      if (err?.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        setUnauthorizedDomain(hostname);
        setLoginError(`Bu alan adı (${hostname}) Firebase projesinin yetkilendirilmiş alan adları listesinde bulunamadı.`);
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
    try {
      sessionStorage.setItem('akademi_preview_user', JSON.stringify({ email, displayName }));
    } catch (e) {}
    setUser(syntheticUser);
  };

  const handleLogout = async () => {
    try {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] p-4 font-sans">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border border-[#e6e2d3] relative overflow-hidden">
          {/* Top Decorative Amber Bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-[#B08D57] to-amber-500"></div>

          <div className="mb-6">
            <h1 className="text-3xl font-serif font-bold text-[#5a5a40] tracking-tight italic">AkademiPanel</h1>
            <p className="text-[#8e8d82] text-xs font-semibold mt-1">Ölçme ve Değerlendirme Yönetim Sistemi</p>
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Yerel Çalışma Modu (Çevrim Dışı / LocalStorage)
            </div>
          </div>

          {/* Quick Access Roles */}
          <div className="space-y-3 mb-5">
            <button
              onClick={() => handlePreviewLogin('kirklareliataturkortaokulu@gmail.com', 'Kırklareli Atatürk Ortaokulu (Yönetici)')}
              className="w-full flex items-center justify-center gap-2.5 bg-[#B08D57] hover:bg-[#9a7b4a] active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-md cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5 text-amber-200" />
              Yönetici Olarak Başla (Tüm Modüller Açık)
            </button>

            <button
              onClick={() => handlePreviewLogin('ogretmen@ataturkortaokulu.meb.k12.tr', 'Öğretmen Hesabı')}
              className="w-full flex items-center justify-center gap-2.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-sm cursor-pointer"
            >
              <UserCheck className="w-5 h-5 text-blue-300" />
              Öğretmen Olarak Başla (Sonuçlar, Optik & Arena)
            </button>
          </div>

          <p className="text-[11px] text-[#8e8d82] leading-relaxed">
            Firebase bağımlılıkları kaldırılmıştır. Uygulama tüm özellikleri ile yerel depolama üzerinde kesintisiz çalışmaktadır. İleride yeni bir Firebase projesi açıldığında kolayca bağlanabilir.
          </p>
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
