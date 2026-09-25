import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, BarChart2, DollarSign, LayoutTemplate, Save, 
  DownloadCloud, UploadCloud, Trophy, Sun, Moon, X, Settings, 
  LogOut, Shield, Download, Globe, HardDriveDownload, Cloud, 
  Bell, Camera, Printer, TrendingUp, HelpCircle, ChevronRight, 
  Sparkles, Zap, CheckCircle2, User as UserIcon, RefreshCw,
  Sliders, AlertCircle, AlertTriangle, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';
import { SettingsModal } from './SettingsModal';
import { FirebaseStatusModal } from './FirebaseStatusModal';
import { CloudBackupModal } from './CloudBackupModal';
import { AppHubModal } from './AppHubModal';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { NotificationModal } from './NotificationModal';
import { InstructionModal } from './InstructionModal';
import { auth, onAuthStateChanged, User, FIRESTORE_UPGRADE_URL } from '../lib/firebase';
import { FullBackupData } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  currentUser?: User | null;
}

const navItems = [
  { 
    id: 'exams', 
    label: 'Sınav Takvimi', 
    shortLabel: 'Sınavlar', 
    subtitle: 'Deneme Planı & Takvim',
    icon: Calendar, 
    iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30 group-hover:bg-rose-500 group-hover:text-white',
    activeIconBg: 'bg-rose-500 text-white shadow-md shadow-rose-500/30',
    colorClass: 'text-rose-400', 
    hoverBorder: 'hover:border-rose-500/40',
    activeClass: 'bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent border-rose-500/50 text-white shadow-xs' 
  },
  { 
    id: 'students', 
    label: 'Öğrenciler & Kayıt', 
    shortLabel: 'Öğrenci', 
    subtitle: 'e-Okul & Sınıf Kütüğü',
    icon: Users, 
    iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-white',
    activeIconBg: 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30',
    colorClass: 'text-indigo-400', 
    hoverBorder: 'hover:border-indigo-500/40',
    activeClass: 'bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent border-indigo-500/50 text-white shadow-xs' 
  },
  { 
    id: 'halls', 
    label: 'Salonlar & Yerleşim', 
    shortLabel: 'Salonlar', 
    subtitle: 'Kelebek Dağıtım & Etiket',
    icon: LayoutTemplate, 
    iconBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30 group-hover:bg-sky-500 group-hover:text-white',
    activeIconBg: 'bg-sky-500 text-white shadow-md shadow-sky-500/30',
    colorClass: 'text-sky-400', 
    hoverBorder: 'hover:border-sky-500/40',
    activeClass: 'bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-transparent border-sky-500/50 text-white shadow-xs' 
  },
  { 
    id: 'keys_print', 
    label: 'Cevap & Form Baskı', 
    shortLabel: 'Baskı', 
    subtitle: 'A4 QR Optik & A-B-C-D',
    icon: Printer, 
    iconBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white',
    activeIconBg: 'bg-purple-600 text-white shadow-md shadow-purple-500/30',
    colorClass: 'text-purple-400', 
    hoverBorder: 'hover:border-purple-500/40',
    activeClass: 'bg-gradient-to-r from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/50 text-white shadow-xs' 
  },
  { 
    id: 'scan', 
    label: 'Canlı Optik Tarama', 
    shortLabel: 'Tarama', 
    subtitle: '0.1sn Kamera & PDF Okuma',
    icon: Camera, 
    iconBg: 'bg-teal-500/20 text-teal-300 border-teal-500/30 group-hover:bg-teal-500 group-hover:text-white',
    activeIconBg: 'bg-teal-600 text-white shadow-md shadow-teal-500/30',
    colorClass: 'text-teal-400', 
    hoverBorder: 'hover:border-teal-500/40',
    activeClass: 'bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-transparent border-teal-500/50 text-white shadow-xs' 
  },
  { 
    id: 'results', 
    label: 'Sınav Sonuçları', 
    shortLabel: 'Sonuçlar', 
    subtitle: 'Karneler & Madde Analizi',
    icon: BarChart2, 
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white',
    activeIconBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30',
    colorClass: 'text-emerald-400', 
    hoverBorder: 'hover:border-emerald-500/40',
    activeClass: 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/50 text-white shadow-xs' 
  },
  { 
    id: 'league', 
    label: 'Akademi Arena', 
    shortLabel: 'Arena', 
    subtitle: 'Lig Puanı & Takım Ligi',
    icon: Trophy, 
    iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30 group-hover:bg-amber-500 group-hover:text-slate-950',
    activeIconBg: 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 font-bold',
    colorClass: 'text-amber-400', 
    hoverBorder: 'hover:border-amber-500/40',
    activeClass: 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/50 text-white shadow-xs' 
  },
  { 
    id: 'budget', 
    label: 'Bütçe & Finans', 
    shortLabel: 'Bütçe', 
    subtitle: 'Sınav Gelir-Gider Takibi',
    icon: DollarSign, 
    iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 group-hover:bg-cyan-500 group-hover:text-white',
    activeIconBg: 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30',
    colorClass: 'text-cyan-400', 
    hoverBorder: 'hover:border-cyan-500/40',
    activeClass: 'bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/50 text-white shadow-xs' 
  },
];

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, currentUser: propUser }) => {
  const { 
    userRole, 
    state, 
    restoreBackup, 
    syncStatus, 
    syncErrorMessage, 
    pendingSyncCount,
    lastSyncedAt,
    saveNow, 
    retrySync,
    cloudBackups,
    notifications,
    unreadNotificationsCount,
    isNotificationModalOpen,
    setIsNotificationModalOpen,
    openNotificationModal
  } = useAppContext();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFirebaseStatusOpen, setIsFirebaseStatusOpen] = useState(false);
  const [isCloudBackupOpen, setIsCloudBackupOpen] = useState(false);
  const [isAppHubOpen, setIsAppHubOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(propUser || auth.currentUser);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isQuotaBannerDismissed, setIsQuotaBannerDismissed] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).__navigateToTab = (tab: string) => setActiveTab(tab);
  }, [setActiveTab]);

  useEffect(() => {
    if (mobileNavRef.current) {
      const activeEl = mobileNavRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
    }
  }, [propUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else if (!propUser) {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, [propUser]);
  
  const getRoleLabel = () => {
    if (currentUser?.email === 'kirklareliataturkortaokulu@gmail.com' || currentUser?.email === 'bahadirkumcu@gmail.com') return 'Süper Yönetici';
    if (userRole === 'admin') return 'Yönetici';
    return 'Öğretmen';
  };
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('akademiDarkMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('akademiDarkMode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleBackup = () => {
    if (userRole !== 'admin') return;
    const backupData: FullBackupData = {
      appName: "AkademiPanel",
      version: "2.0",
      backupDate: new Date().toISOString(),
      school: "Kırklareli Atatürk Ortaokulu",
      modules: [
        "Öğrenci Kayıtları",
        "Deneme Sınavları",
        "Sınav Sonuçları",
        "Akademi Arena",
        "Sınav Salonları",
        "Bütçe Takibi"
      ],
      summary: {
        studentCount: state.students?.length || 0,
        examCount: state.exams?.length || 0,
        resultCount: state.results?.length || 0,
        hallCount: state.examHalls?.length || 0,
        budgetIncomesCount: state.budget?.incomes?.length || 0,
        budgetExpensesCount: state.budget?.expenses?.length || 0,
        budgetDebtsCount: state.budget?.debts?.length || 0,
        arenaMentorsCount: Object.keys(state.leagueMentors || {}).length,
        arenaBonusCount: Object.keys(state.leagueTeamPoints || {}).length,
        approvedTransferCount: state.approvedTransfers?.length || 0
      },
      students: state.students || [],
      exams: state.exams || [],
      results: state.results || [],
      examHalls: state.examHalls || [],
      budget: {
        incomes: state.budget?.incomes || [],
        expenses: state.budget?.expenses || [],
        debts: state.budget?.debts || []
      },
      leagueMentors: state.leagueMentors || {},
      leagueTeamPoints: state.leagueTeamPoints || {},
      approvedTransfers: state.approvedTransfers || [],
      admins: state.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
      teachers: state.teachers || [],
      examCalendarPrintSettings: (() => {
        try {
          const cfg = localStorage.getItem('akademi_exam_calendar_print_config');
          return cfg ? JSON.parse(cfg) : undefined;
        } catch {
          return undefined;
        }
      })()
    };

    const stateStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([stateStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `AkademiPanel_Tam_Yedek_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveFeedback("Tüm sistem yedeği indirildi (JSON)");
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (userRole !== 'admin') return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          const res = await restoreBackup(parsed);
          if (res.success && res.summary) {
            setSaveFeedback(
              `Tüm içerikler başarıyla yüklendi! (${res.summary.studentCount} Öğrenci, ${res.summary.examCount} Sınav, ${res.summary.resultCount} Sonuç, ${res.summary.hallCount} Salon)`
            );
            setTimeout(() => setSaveFeedback(null), 5000);
          } else {
            alert(res.message || "Yedek dosyası içeriği doğrulanamadı.");
          }
        } catch (error) {
          alert("Geçersiz veya bozuk JSON yedek dosyası!");
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleManualSave = async () => {
    if (userRole !== 'admin') return;
    try {
      await saveNow();
      setSaveFeedback("✓ Veriler buluta kaydedildi");
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('permission-denied') || msg.includes('Güvenlik')) {
        setSaveFeedback("⚠️ Bulut kural engeli!");
      } else {
        setSaveFeedback("✓ Yerel hafızaya kaydedildi");
      }
      setTimeout(() => setSaveFeedback(null), 4000);
    }
  };

  const isNavItemVisible = (itemId: string) => {
    // Admin & Süper Admin tüm menülerde tam yetkili ve kısıtlamasızdır
    if (userRole === 'admin') return true;
    
    // Öğretmen yetkisindeki kullanıcılara sadece Sonuçlar ve Akademi Arena gösterilir
    if (userRole === 'teacher') {
      return ['results', 'league'].includes(itemId);
    }
    
    return ['results', 'league'].includes(itemId);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen w-full bg-brand-bg text-brand-ink overflow-hidden font-sans relative">
      
      {/* 📱 Mobile Settings & Profile Action Sheet / Bottom Sheet */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md md:hidden transition-all animate-fade-in" onClick={closeMobileMenu}>
          <div 
            className="w-full bg-[#131418] border-t border-white/15 rounded-t-[32px] p-5 sm:p-6 pb-safe flex flex-col gap-3.5 animate-slide-up shadow-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-1 shrink-0" />

            {/* Header: User Profile & Close */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-base shadow-md shrink-0">
                  {currentUser?.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'Profil'} 
                      className="w-full h-full object-cover rounded-2xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
                      {currentUser?.displayName || 'Kullanıcı Hesabı'}
                    </h3>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-xs text-white/50 truncate max-w-[220px]">
                    {currentUser?.email || 'kirklareliataturkortaokulu@gmail.com'}
                  </p>
                </div>
              </div>

              <button 
                onClick={closeMobileMenu} 
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 rounded-full transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Role & School Badge Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs text-white/80 font-medium truncate">
                  Kırklareli Atatürk O.O.
                </span>
              </div>
              <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                {getRoleLabel()}
              </span>
            </div>
            
            {/* Cloud Sync Status & Backup Area */}
            {userRole === 'admin' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2.5">
                <input type="file" accept=".json" className="hidden" id="restore-input-mobile" onChange={handleRestore} />
                
                {/* Sync Status Row */}
                <div 
                  onClick={() => setIsFirebaseStatusOpen(true)}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {pendingSyncCount > 0 && `Tamponda: ${pendingSyncCount} İşlem`}
                        {pendingSyncCount === 0 && syncStatus === 'synced' && "Bulut Senkronize"}
                        {pendingSyncCount === 0 && syncStatus === 'saving' && "Kaydediliyor..."}
                        {syncStatus === 'quota_exceeded' && "⚡ Yerel Koruma Aktif"}
                        {(syncStatus === 'offline' || syncStatus === 'error') && "Yerel Koruma"}
                      </p>
                      <p className="text-[10px] text-white/50 truncate">
                        {pendingSyncCount > 0 ? "Akıllı tamponda bekliyor..." : (saveFeedback || (lastSyncedAt ? `Son eşitlenme: ${lastSyncedAt}` : "Veriler yerel hafızada %100 güvende"))}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleManualSave();
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold shrink-0 transition-colors"
                  >
                    {pendingSyncCount > 0 ? "Şimdi Gönder" : "Şimdi Kaydet"}
                  </button>
                </div>

                {/* Bulut & JSON Butonları */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setIsCloudBackupOpen(true);
                      closeMobileMenu();
                    }}
                    className="flex items-center justify-center gap-1.5 p-2 bg-gradient-to-r from-amber-500/20 to-amber-500/10 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">Bulut Yedekleri</span>
                  </button>

                  <button 
                    onClick={handleBackup} 
                    className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold p-2 rounded-xl border border-white/10 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">JSON İndir</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 gap-2">
              
              {/* Nasıl Çalışır? Banner */}
              <button 
                onClick={() => { setIsGuideOpen(true); closeMobileMenu(); }} 
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white transition-all active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-white leading-tight">Nasıl Çalışır?</p>
                    <p className="text-[10px] text-white/50 truncate">Sınav, Kelebek & Optik Rehberi</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
              </button>

              {/* 2-Column Grid for Secondary Tools */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setIsAppHubOpen(true); closeMobileMenu(); }} 
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white transition-all text-left cursor-pointer"
                >
                  <HardDriveDownload className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">Uygulamayı Kur</p>
                    <p className="text-[9px] text-white/50 truncate">PWA / Vercel Link</p>
                  </div>
                </button>

                <button 
                  onClick={() => { openNotificationModal(); closeMobileMenu(); }} 
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white transition-all text-left cursor-pointer relative"
                >
                  <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">Bildirimler</p>
                    <p className="text-[9px] text-white/50 truncate">{unreadNotificationsCount} yeni duyuru</p>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 animate-pulse" />
                  )}
                </button>

                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white transition-all text-left cursor-pointer"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-indigo-300 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{isDarkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</p>
                    <p className="text-[9px] text-white/50 truncate">Tema Görünümü</p>
                  </div>
                </button>

                <button 
                  onClick={() => { setIsProfileSettingsOpen(true); closeMobileMenu(); }} 
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 text-white transition-all text-left cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">Tüm Ayarlar</p>
                    <p className="text-[9px] text-white/50 truncate">Profil & Sistem</p>
                  </div>
                </button>
              </div>

              {/* Admin Yetki Butonu */}
              {userRole === 'admin' && (
                <button 
                  onClick={() => { setIsSettingsOpen(true); closeMobileMenu(); }} 
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Kullanıcı ve Rol Yönetimi</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              )}
            </div>

            {/* Çıkış Butonu */}
            {onLogout && (
              <button 
                onClick={onLogout} 
                className="flex items-center justify-center w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold py-2.5 px-4 rounded-xl border border-rose-500/25 transition-all gap-2 mt-1 active:scale-[0.99] cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> 
                <span>Güvenli Çıkış Yap</span>
              </button>
            )}
            
            <div className="text-center pt-1">
              <span className="text-[10px] text-white/30 tracking-wider">
                AkademiPanel • Sınav & Ölçme Değerlendirme
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden md:flex fixed inset-y-0 left-0 z-50 w-[280px] bg-brand-sidebar-bg text-white flex-col p-6 justify-between border-r border-white/5 overflow-y-auto relative translate-x-0 shrink-0"
      )}>
        <div className="flex flex-col flex-grow">
          <div className="brand mb-5 flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/[0.03] transition-all">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative shrink-0">
                <img 
                  src="/apple-touch-icon.png" 
                  alt="AkademiPanel" 
                  className="w-9 h-9 rounded-xl shadow-md border border-white/20 shrink-0 object-cover" 
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1a1b23]" title="Sistem Çevrimiçi" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-serif text-[1.2rem] italic font-bold tracking-tight text-white leading-tight">
                  AkademiPanel
                </h1>
                <p className="text-[7.5px] uppercase tracking-tight text-amber-300/95 font-black whitespace-nowrap block">
                  ÖLÇME & DEĞERLENDİRME
                </p>
              </div>
            </div>
            <button
              onClick={() => openNotificationModal()}
              aria-label="Bildirimler"
              title="Anlık Bildirim & Duyuru Merkezi"
              className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 group shrink-0 ml-0.5"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400 transition-transform group-hover:scale-110" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-rose-500 text-[8.5px] font-black text-white flex items-center justify-center shadow-md animate-pulse">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-grow space-y-1.5 mt-2">
            {/* Quick Guide & How It Works Banner */}
            <button
              onClick={() => setIsGuideOpen(true)}
              className="w-full mb-3 flex items-center justify-between p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-amber-400/40 text-white transition-all cursor-pointer shadow-xs active:scale-[0.98] group"
              title="AkademiPanel Kullanım ve İş Akışı Rehberini Aç"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-amber-400 group-hover:text-slate-950 transition-all font-bold">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-white leading-tight">Nasıl Çalışır?</p>
                  <p className="text-[10px] text-white/50 font-medium truncate">Sınav, Kelebek & Optik Rehberi</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
            </button>

            {navItems.filter(item => isNavItemVisible(item.id)).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    closeMobileMenu();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer group select-none border",
                    isActive 
                      ? item.activeClass
                      : cn("bg-white/[0.03] hover:bg-white/[0.08] text-white/75 hover:text-white border-white/5", item.hoverBorder)
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-all duration-200",
                      isActive ? item.activeIconBg : item.iconBg
                    )}>
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs font-bold leading-tight truncate transition-colors",
                        isActive ? "text-white" : "text-white/85 group-hover:text-white"
                      )}>
                        {item.label}
                      </p>
                      <p className={cn(
                        "text-[9.5px] truncate transition-colors font-medium",
                        isActive ? "text-white/80" : "text-white/40 group-hover:text-white/60"
                      )}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-all duration-200 ml-1",
                    isActive 
                      ? cn("translate-x-0.5", item.colorClass) 
                      : "text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5"
                  )} />
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Sidebar Footer */}
        <div className="sidebar-footer mt-auto flex flex-col gap-2.5 w-full pt-4 border-t border-white/10">
          {userRole === 'admin' && (
            <input type="file" accept=".json" className="hidden" id="restore-input" onChange={handleRestore} />
          )}

          {/* Compact Live Cloud Sync Indicator */}
          {userRole === 'admin' && (
            <div 
              onClick={() => setIsProfileSettingsOpen(true)}
              className={cn(
                "flex items-center justify-between px-3 py-2 border rounded-xl text-[0.72rem] font-semibold transition-all cursor-pointer hover:opacity-90 active:scale-[0.99]",
                syncStatus === 'synced' && "bg-emerald-950/40 border-emerald-500/30 text-emerald-300",
                syncStatus === 'saving' && "bg-sky-950/40 border-sky-500/30 text-sky-300",
                syncStatus === 'quota_exceeded' && "bg-amber-950/40 border-amber-500/30 text-amber-300",
                (syncStatus === 'offline' || syncStatus === 'error') && "bg-rose-950/40 border-rose-500/30 text-rose-300"
              )}
              title="Bulut Senkronizasyon Durumu & Ayarları (Tıklayarak Yönet)"
            >
              <span className="flex items-center gap-2 truncate mr-1">
                {pendingSyncCount > 0 ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                ) : syncStatus === 'synced' ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : syncStatus === 'saving' ? (
                  <span className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-sky-400 border-t-transparent shrink-0"></span>
                ) : syncStatus === 'quota_exceeded' ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shrink-0"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shrink-0"></span>
                )}
                <span className="truncate">
                  {pendingSyncCount > 0 ? `Tamponda: ${pendingSyncCount}` : (
                    syncStatus === 'synced' ? (lastSyncedAt ? `Eşitlendi (${lastSyncedAt})` : "Bulut Senkronize") :
                    syncStatus === 'saving' ? "Kaydediliyor..." :
                    syncStatus === 'quota_exceeded' ? "⚡ Yerel Koruma" :
                    syncStatus === 'offline' ? "Çevrimdışı Mod" : "Yerel Koruma"
                  )}
                </span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualSave();
                }}
                className="text-[0.65rem] text-white/80 hover:text-white hover:underline cursor-pointer font-bold shrink-0 ml-1"
                title={pendingSyncCount > 0 ? "Tampondaki verileri hemen buluta aktar" : "Manuel Kaydet"}
              >
                {pendingSyncCount > 0 ? "Şimdi Gönder" : "Kaydet"}
              </button>
            </div>
          )}

          {/* Master "Profil & Ayarlar" Card Button */}
          <button
            onClick={() => setIsProfileSettingsOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/10 hover:border-brand-accent/40 text-left transition-all cursor-pointer shadow-sm group"
            title="Profil, Cihaz & Bulut Yedekleme, Uygulama Kurulumu ve Sistem Ayarları"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-accent to-[#8d6f3e] flex items-center justify-center text-white shadow-sm font-bold text-sm shrink-0 group-hover:shadow-md transition-shadow">
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'Profil'} 
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span>{currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors truncate">
                    Profil & Ayarlar
                  </span>
                  <span className="text-[9px] font-bold text-brand-accent bg-brand-accent/20 px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                    {getRoleLabel()}
                  </span>
                </div>
                <span className="text-[11px] text-white/50 truncate" title={currentUser?.email || ''}>
                  {currentUser?.email || 'Google Girişi'}
                </span>
              </div>
            </div>

            <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-brand-accent/20 text-white/60 group-hover:text-brand-accent flex items-center justify-center shrink-0 transition-colors ml-1">
              <Settings className="w-4 h-4 transition-transform group-hover:rotate-45" />
            </div>
          </button>

          <div className="pt-1 text-center">
            <p className="text-[9px] text-white/30 tracking-wider">
              Powered by Kumcu
            </p>
          </div>
        </div>
      </aside>

      {/* Modals */}
      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
        currentUser={currentUser}
        userRole={userRole}
        getRoleLabel={getRoleLabel}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLogout={onLogout}
        onOpenAppHub={() => setIsAppHubOpen(true)}
        onOpenFirebaseStatus={() => setIsFirebaseStatusOpen(true)}
        onOpenUserManagement={() => setIsSettingsOpen(true)}
        onOpenNotifications={() => openNotificationModal()}
        onOpenCloudBackup={() => setIsCloudBackupOpen(true)}
        handleBackup={handleBackup}
        handleRestore={handleRestore}
        handleManualSave={handleManualSave}
        saveFeedback={saveFeedback}
        syncStatus={syncStatus}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <FirebaseStatusModal isOpen={isFirebaseStatusOpen} onClose={() => setIsFirebaseStatusOpen(false)} />
      <CloudBackupModal isOpen={isCloudBackupOpen} onClose={() => setIsCloudBackupOpen(false)} />
      <AppHubModal isOpen={isAppHubOpen} onClose={() => setIsAppHubOpen(false)} />
      <NotificationModal 
        isOpen={isNotificationModalOpen} 
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={notifications}
        onNavigateTab={(tab) => setActiveTab(tab)}
        currentUserEmail={currentUser?.email || undefined}
      />
      <InstructionModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-auto bg-brand-bg text-brand-ink transition-colors duration-200 w-full pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
        
        {/* 📱 Mobile Header - Modern Elevated Glassmorphism */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-[#131418]/95 backdrop-blur-xl text-white border-b border-white/10 shrink-0 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <img 
              src="/apple-touch-icon.png" 
              alt="AkademiPanel" 
              className="w-8 h-8 rounded-xl shadow-xs border border-white/15 shrink-0 object-cover" 
            />
            <div>
              <h1 className="font-serif text-sm italic font-bold tracking-tight text-white leading-none">AkademiPanel</h1>
              {(() => {
                const current = navItems.find(i => i.id === activeTab);
                return current ? (
                  <span className={cn("text-[9.5px] font-bold tracking-wide flex items-center gap-1 mt-0.5", current.colorClass)}>
                    {current.label}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Quick Guide Pill */}
            <button
              onClick={() => setIsGuideOpen(true)}
              aria-label="Nasıl Çalışır?"
              title="Kurum İçi Optik Deneme İş Akışı Rehberi"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 active:scale-95 text-purple-300 border border-purple-500/30 transition-all cursor-pointer font-bold text-[11px]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span>Rehber</span>
            </button>

            {/* Notification Bell */}
            <button 
              onClick={() => openNotificationModal()} 
              aria-label="Bildirimler"
              title="Anlık Bildirimler & Duyurular"
              className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 border border-white/10 transition-all cursor-pointer"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center shadow-xs animate-pulse">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              aria-label="Temayı Değiştir"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 border border-white/10 transition-all cursor-pointer"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
            </button>

            {/* Profile / Menu Bottom Sheet Trigger */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              aria-label="Hesap ve Menü"
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white border border-white/15 transition-all cursor-pointer"
            >
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-brand-accent to-[#8d6f3e] text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <Sliders className="w-3.5 h-3.5 text-white/70" />
            </button>
          </div>
        </header>

        <div 
          className="flex-1 flex flex-col p-2 sm:p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto h-full font-sans antialiased overflow-x-hidden"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {/* Quota Exceeded Notification Banner */}
          {syncStatus === 'quota_exceeded' && !isQuotaBannerDismissed && (
            <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5 min-w-0">
                  <p className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>Firestore Günlük Yazma Kotası Doldu (Spark Plan)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Yerel Koruma %100 Aktif
                    </span>
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/80 leading-relaxed text-[11px]">
                    Tüm sınav okumalarınız, öğrenci ve kütük verileriniz bu cihazda kesintisiz olarak saklanmaktadır; optik tarama ve diğer tüm özellikleri güvenle kullanmaya devam edebilirsiniz.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                <button
                  onClick={handleBackup}
                  className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-amber-900 dark:text-amber-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-500/30 cursor-pointer"
                  title="Tüm kütüğü ve sınavları JSON olarak hemen indir"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Yedek İndir (JSON)</span>
                </button>
                <button
                  onClick={async () => {
                    await retrySync();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-500/40 cursor-pointer"
                  title="Firebase kotasının sıfırlanıp sıfırlanmadığını kontrol et"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Yeniden Sına</span>
                </button>
                <a
                  href={FIRESTORE_UPGRADE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>Kotayı İncele</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setIsQuotaBannerDismissed(true)}
                  className="p-1.5 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 rounded-lg hover:bg-amber-500/10 cursor-pointer transition-colors"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {children}
        </div>
      </main>

      {/* 📱 Mobile Bottom Navigation - Modern Touch-Optimized Scrollable Glass Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d0e12]/95 backdrop-blur-2xl border-t border-white/[0.1] z-40 px-2 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgba(0,0,0,0.65)] select-none">
        {(() => {
          const visibleItems = navItems.filter(item => isNavItemVisible(item.id));
          const isFewItems = visibleItems.length <= 4;

          return (
            <div 
              ref={mobileNavRef}
              className={cn(
                "mx-auto flex items-center transition-all",
                isFewItems 
                  ? "max-w-md w-full justify-around gap-2 px-1" 
                  : "max-w-xl w-full gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1 snap-x snap-mandatory"
              )}
            >
              {visibleItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    data-active={isActive ? "true" : "false"}
                    aria-label={item.label}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer active:scale-90 snap-center shrink-0 group focus:outline-none",
                      isFewItems 
                        ? "flex-1 py-1.5 px-2 min-w-[76px]" 
                        : "min-w-[68px] flex-1 py-1.5 px-1.5",
                      isActive 
                        ? "text-white bg-white/[0.09] border border-white/12 shadow-sm" 
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent"
                    )}
                  >
                    {/* Top Glow Accent Line */}
                    {isActive && (
                      <span className="absolute -top-1.5 w-6 h-0.5 rounded-full bg-gradient-to-r from-amber-400 via-[#B08D57] to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-fade-in" />
                    )}

                    {/* Icon Container */}
                    <div className={cn(
                      "relative flex items-center justify-center w-8 h-6.5 rounded-xl transition-transform duration-200",
                      isActive ? "scale-105" : "group-hover:scale-105"
                    )}>
                      <item.icon className={cn(
                        "w-4.5 h-4.5 transition-all duration-200",
                        isActive 
                          ? cn(item.colorClass, "scale-105 drop-shadow-[0_0_10px_currentColor]") 
                          : "text-white/45 group-hover:text-white/75"
                      )} />
                    </div>

                    {/* Label */}
                    <span className={cn(
                      "text-[10px] tracking-tight transition-colors duration-200 mt-0.5 whitespace-nowrap",
                      isActive 
                        ? "text-white font-bold drop-shadow-xs" 
                        : "text-white/45 font-medium group-hover:text-white/70"
                    )}>
                      {item.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </nav>
    </div>
  );
};
