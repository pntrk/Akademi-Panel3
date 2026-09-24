import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, BarChart2, DollarSign, LayoutTemplate, Save, 
  DownloadCloud, UploadCloud, Trophy, Sun, Moon, X, Settings, 
  LogOut, Shield, Download, Globe, HardDriveDownload, Cloud, 
  Bell, Camera, Printer, TrendingUp, HelpCircle, ChevronRight, 
  Sparkles, Zap, CheckCircle2, User as UserIcon, RefreshCw,
  Sliders, AlertCircle
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
import { auth, onAuthStateChanged, User } from '../lib/firebase';
import { FullBackupData } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
  currentUser?: User | null;
}

const navItems = [
  { id: 'exams', label: 'Sınav Takvimi', shortLabel: 'Sınavlar', icon: Calendar, colorClass: 'text-rose-400', hoverColorClass: 'group-hover:text-rose-400', activeClass: 'bg-rose-500/15 border-rose-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'students', label: 'Öğrenciler & Kayıt', shortLabel: 'Öğrenci', icon: Users, colorClass: 'text-indigo-400', hoverColorClass: 'group-hover:text-indigo-400', activeClass: 'bg-indigo-500/15 border-indigo-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'halls', label: 'Salonlar & Yerleşim', shortLabel: 'Salonlar', icon: LayoutTemplate, colorClass: 'text-sky-400', hoverColorClass: 'group-hover:text-sky-400', activeClass: 'bg-sky-500/15 border-sky-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'keys_print', label: 'Cevap & Form Baskı', shortLabel: 'Baskı', icon: Printer, colorClass: 'text-purple-400', hoverColorClass: 'group-hover:text-purple-400', activeClass: 'bg-purple-500/15 border-purple-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'scan', label: 'Canlı Optik Tarama', shortLabel: 'Tarama', icon: Camera, colorClass: 'text-teal-400', hoverColorClass: 'group-hover:text-teal-400', activeClass: 'bg-teal-500/15 border-teal-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'results', label: 'Sonuçlar & Analiz', shortLabel: 'Sonuçlar', icon: BarChart2, colorClass: 'text-emerald-400', hoverColorClass: 'group-hover:text-emerald-400', activeClass: 'bg-emerald-500/15 border-emerald-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'league', label: 'Akademi Arena', shortLabel: 'Arena', icon: Trophy, colorClass: 'text-yellow-400', hoverColorClass: 'group-hover:text-yellow-400', activeClass: 'bg-yellow-500/15 border-yellow-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
  { id: 'budget', label: 'Bütçe & Finans', shortLabel: 'Bütçe', icon: DollarSign, colorClass: 'text-cyan-400', hoverColorClass: 'group-hover:text-cyan-400', activeClass: 'bg-cyan-500/15 border-cyan-400 border-l-2 pl-3.5 text-white font-semibold shadow-sm' },
];

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, onLogout, currentUser: propUser }) => {
  const { 
    userRole, 
    state, 
    restoreBackup, 
    syncStatus, 
    syncErrorMessage, 
    saveNow, 
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

  useEffect(() => {
    (window as any).__navigateToTab = (tab: string) => setActiveTab(tab);
  }, [setActiveTab]);

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
    if (itemId === 'budget') {
      return userRole === 'admin';
    }
    if (itemId === 'scan') {
      return userRole === 'admin' || userRole === 'teacher';
    }
    if (userRole === 'admin') return true;
    if (userRole === 'teacher') {
      return ['students', 'halls', 'results', 'scan', 'omr-setup', 'keys_print', 'exams', 'league'].includes(itemId);
    }
    return ['students', 'results', 'league'].includes(itemId);
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
                        {syncStatus === 'synced' && "Bulut Senkronize"}
                        {syncStatus === 'saving' && "Kaydediliyor..."}
                        {syncStatus === 'quota_exceeded' && "Yerel Koruma Aktif"}
                        {(syncStatus === 'offline' || syncStatus === 'error') && "Çevrimdışı Koruma"}
                      </p>
                      <p className="text-[10px] text-white/50 truncate">
                        {saveFeedback || "Veriler Google Firebase'de korunuyor"}
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
                    Şimdi Kaydet
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
                className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-amber-500/20 hover:from-purple-600/40 border border-purple-500/40 text-white transition-all active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-black text-white leading-tight">Nasıl Çalışır? (9 Adım Rehberi)</p>
                    <p className="text-[10px] text-white/60 truncate">Sınav, Kelebek, Optik & Lig Kullanımı</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
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
          <div className="brand mb-6 flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h1 className="font-serif text-[1.75rem] italic font-semibold tracking-tight text-white mb-0.5">AkademiPanel</h1>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-medium">Ölçme ve Değerlendirme</p>
            </div>
            <button
              onClick={() => openNotificationModal()}
              aria-label="Bildirimler"
              title="Anlık Bildirim & Duyuru Merkezi"
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95 group"
            >
              <Bell className="w-4 h-4 text-amber-400 transition-transform group-hover:scale-110" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
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
              className="w-full mb-3 flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-indigo-500/20 hover:from-amber-500/25 hover:via-purple-500/25 hover:to-indigo-500/30 border border-amber-500/30 hover:border-amber-400/50 text-white transition-all cursor-pointer shadow-sm active:scale-[0.98] group relative overflow-hidden"
              title="AkademiPanel 9 Adımlı Kullanım & İş Akışı Rehberini Aç"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs font-bold">
                  <Zap className="w-4 h-4 text-slate-950 fill-current" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-black text-white flex items-center gap-1.5 leading-tight">
                    <span>Nasıl Çalışır?</span>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 shadow-xs uppercase tracking-wider">9 Adım</span>
                  </div>
                  <p className="text-[10px] text-white/70 font-medium truncate">Sınav, Kelebek, Optik & Lig Rehberi</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-1 relative z-10" />
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
                    "flex items-center w-full gap-3 px-3.5 py-2.5 rounded-xl text-left text-[0.875rem] font-medium transition-all cursor-pointer group",
                    isActive 
                      ? item.activeClass 
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon className={cn(
                    "w-[19px] h-[19px] transition-transform duration-200 group-hover:scale-110", 
                    isActive ? item.colorClass : cn("text-white/60", item.hoverColorClass)
                  )} />
                  <span className={cn("transition-colors", isActive ? "text-white font-semibold" : "group-hover:text-white")}>{item.label}</span>
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
                {syncStatus === 'synced' && (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                {syncStatus === 'saving' && (
                  <span className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-sky-400 border-t-transparent shrink-0"></span>
                )}
                {syncStatus === 'quota_exceeded' && (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shrink-0"></span>
                )}
                {(syncStatus === 'offline' || syncStatus === 'error') && (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shrink-0"></span>
                )}
                <span className="truncate">
                  {syncStatus === 'synced' && "Bulut Senkronize"}
                  {syncStatus === 'saving' && "Kaydediliyor..."}
                  {syncStatus === 'quota_exceeded' && "Yerel Koruma"}
                  {syncStatus === 'offline' && "Çevrimdışı Mod"}
                  {syncStatus === 'error' && "Yerel Koruma"}
                </span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleManualSave();
                }}
                className="text-[0.65rem] text-white/80 hover:text-white hover:underline cursor-pointer font-bold shrink-0 ml-1"
                title="Manuel Kaydet"
              >
                Kaydet
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-accent to-[#e2c18d] flex items-center justify-center shadow-xs">
              <span className="font-serif italic font-black text-white text-base">A</span>
            </div>
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
          className="flex-1 flex flex-col p-2.5 sm:p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto h-full font-sans antialiased"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {children}
        </div>
      </main>

      {/* 📱 Mobile Bottom Navigation - Modern Touch-Optimized Scrollable Glass Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#121316]/95 backdrop-blur-2xl border-t border-white/10 z-40 px-1 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-none snap-x snap-mandatory px-1 max-w-xl mx-auto">
          {navItems.filter(item => isNavItemVisible(item.id)).map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center min-w-[62px] flex-1 py-1 px-1.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 snap-center shrink-0 group",
                  isActive ? "text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                {/* Active Glow Pill */}
                <div className={cn(
                  "relative flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200",
                  isActive ? "bg-white/15 shadow-inner" : "bg-transparent"
                )}>
                  <item.icon className={cn(
                    "w-4.5 h-4.5 transition-transform duration-200",
                    isActive ? cn(item.colorClass, "scale-110 drop-shadow-[0_0_8px_currentColor]") : "text-white/45 group-hover:text-white/75"
                  )} />
                  {isActive && (
                    <span className="absolute -top-1 w-2 h-0.5 rounded-full bg-brand-accent shadow-[0_0_8px_#B08D57]" />
                  )}
                </div>
                <span className={cn(
                  "text-[9.5px] font-semibold tracking-tight transition-colors duration-200 mt-0.5 whitespace-nowrap",
                  isActive ? "text-white font-bold" : "text-white/40"
                )}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
