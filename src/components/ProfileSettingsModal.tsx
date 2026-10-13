import React, { useState, useEffect } from 'react';
import { 
  X, User, Shield, Moon, Sun, 
  DownloadCloud, UploadCloud, LogOut, Check, 
  Database, Activity, ChevronRight, AlertCircle,
  Bell, BellRing, Sparkles, ShieldCheck, Users, Smartphone, HardDriveDownload, Cloud
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';
import { User as FirebaseUser, db, collection, query, onSnapshot } from '../lib/firebase';
import { getPushPermissionState, requestPushPermission, displayBrowserNotification } from '../lib/notifications';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  userRole: 'admin' | 'teacher' | 'guest';
  getRoleLabel: () => string;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  onLogout?: () => void;
  onOpenAppHub?: () => void;
  onOpenFirebaseStatus?: () => void;
  onOpenUserManagement?: () => void;
  onOpenNotifications?: () => void;
  onOpenCloudBackup?: () => void;
  handleBackup?: () => void;
  handleRestore?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleManualSave?: () => Promise<void>;
  saveFeedback?: string | null;
  syncStatus?: 'synced' | 'saving' | 'quota_exceeded' | 'offline' | 'error';
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userRole,
  getRoleLabel,
  isDarkMode,
  setIsDarkMode,
  onLogout,
  onOpenAppHub,
  onOpenFirebaseStatus,
  onOpenUserManagement,
  onOpenNotifications,
  onOpenCloudBackup,
  handleBackup,
  handleRestore,
  handleManualSave: _handleManualSave,
  saveFeedback,
  syncStatus: _syncStatus = 'synced'
}) => {
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<'profile' | 'backup'>('profile');
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setPermissionState(getPushPermissionState());
    }
  }, [isOpen]);

  const admins = (state.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map(a => (a || '').trim().toLowerCase());
  const teachers = (state.teachers || []).map(t => (t || '').trim().toLowerCase());

  useEffect(() => {
    if (isOpen && userRole === 'admin') {
      const q = query(collection(db, 'access_requests'));
      const unsub = onSnapshot(q, (snapshot) => {
        let count = 0;
        const total = snapshot.size;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const email = (data.email || docSnap.id || '').trim().toLowerCase();
          // If already in admins or teachers, or superadmin, they are NOT pending!
          if (
            admins.includes(email) || 
            teachers.includes(email) || 
            email === 'kirklareliataturkortaokulu@gmail.com' || 
            email === 'bahadirkumcu@gmail.com'
          ) {
            return;
          }
          const role = data.role;
          const status = data.status;
          if (status === 'pending' || role === 'guest' || !role) {
            count++;
          }
        });
        setPendingCount(count);
        setTotalUsersCount(total);
      }, () => {});
      return () => unsub();
    }
  }, [isOpen, userRole, state.admins, state.teachers]);

  const handleTogglePermission = async () => {
    setIsRequestingPermission(true);
    try {
      const res = await requestPushPermission();
      setPermissionState(res);
      if (res === 'granted') {
        displayBrowserNotification('🔔 Bildirimler Aktif!', 'AkademiPanel anlık bildirimleri başarıyla açıldı.');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  if (!isOpen) return null;



  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-[#0D1526] border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input for JSON Restore */}
        {handleRestore && (
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            id="modal-restore-input" 
            onChange={handleRestore} 
          />
        )}

        {/* Modal Header */}
        <div className="p-3 sm:p-4 border-b border-slate-800/90 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 via-slate-900/40 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#B08D57] to-[#8d6f3e] flex items-center justify-center text-white shadow-sm font-bold text-sm border border-amber-400/30 shrink-0">
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
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-white font-bold text-sm sm:text-base leading-tight">Profil & Ayarlar</h2>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  {getRoleLabel()}
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate max-w-[200px] sm:max-w-xs font-mono">
                {currentUser?.email || 'Google Girişi Yapılmadı'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Toast */}
        {saveFeedback && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-3 py-1.5 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-white/[0.02] px-2 sm:px-4 gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
              activeTab === 'profile' 
                ? "border-amber-400 text-amber-300 bg-amber-400/5" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>Hesap & Görünüm</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={cn(
              "px-3.5 py-2 sm:py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
              activeTab === 'backup' 
                ? "border-amber-400 text-amber-300 bg-amber-400/5" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Yedekleme & Bulut Senkron</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-3 sm:p-4.5 overflow-y-auto space-y-2.5 sm:space-y-3 flex-1">
          
          {/* TAB 1: PROFILE & APPEARANCE */}
          {activeTab === 'profile' && (
            <div className="space-y-2 sm:space-y-2.5">
              {/* 1. Google Profile Card - Compact Strip */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs shrink-0 border border-amber-300/40">
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Kullanıcı')}
                      </p>
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.2 rounded-full border border-emerald-500/25 shrink-0">
                        Aktif
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 font-mono truncate">{currentUser?.email || 'Giriş yapılmadı'}</p>
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    title="Oturumu Kapat"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span className="hidden xs:inline">Çıkış</span>
                  </button>
                )}
              </div>

              {/* 2. Theme Selection - Compact 2-Button Row */}
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer active:scale-98",
                      !isDarkMode 
                        ? "bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-xs" 
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    )}
                  >
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Aydınlık Tema</span>
                    {!isDarkMode && <Check className="w-3.5 h-3.5 text-amber-300 ml-1 shrink-0" />}
                  </button>

                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer active:scale-98",
                      isDarkMode 
                        ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-200 shadow-xs" 
                        : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                    )}
                  >
                    <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                    <span>Karanlık Tema</span>
                    {isDarkMode && <Check className="w-3.5 h-3.5 text-indigo-300 ml-1 shrink-0" />}
                  </button>
                </div>
              </div>

              {/* 3. Push Notifications - Compact Action Card */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 space-y-2 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
                      <BellRing className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">Anlık Bildirimler</h4>
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 rounded-full border leading-none",
                          permissionState === 'granted' 
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        )}>
                          {permissionState === 'granted' ? '✓ Aktif' : 'Kapalı'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {onOpenNotifications && (
                    <button
                      onClick={() => {
                        onOpenNotifications();
                        onClose();
                      }}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-[11px] border border-white/10 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>Merkez</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {permissionState !== 'granted' ? (
                    <button
                      onClick={handleTogglePermission}
                      disabled={isRequestingPermission}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#B08D57] hover:bg-[#9a7b4a] text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{isRequestingPermission ? 'İzin İsteniyor...' : 'Bildirimleri Aç'}</span>
                    </button>
                  ) : userRole === 'admin' ? (
                    <button
                      onClick={() => {
                        displayBrowserNotification('🔔 Test Bildirimi', 'AkademiPanel bildirim sistemi aktif ve çalışıyor!');
                      }}
                      className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 border border-amber-500/40"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test Bildirimi Gönder</span>
                    </button>
                  ) : (
                    <div className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center font-bold text-[11px]">
                      ✓ Anlık Bildirimler Etkin
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Install PWA App Card */}
              {onOpenAppHub && (
                <button
                  onClick={() => {
                    onOpenAppHub();
                    onClose();
                  }}
                  className="w-full p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-sky-500/15 to-indigo-500/10 hover:from-sky-500/25 hover:to-indigo-500/20 text-sky-200 font-semibold text-xs border border-sky-500/30 transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/30">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white text-xs">Cihaza Uygulama Olarak Yükle (PWA)</div>
                      <div className="text-[10px] text-sky-300/80">Tam ekran mobil uygulama kurulum rehberi</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-300" />
                </button>
              )}

              {/* 5. User Permissions Management (Admin Only) */}
              {userRole === 'admin' && onOpenUserManagement && (
                <button
                  onClick={() => {
                    onOpenUserManagement();
                    onClose();
                  }}
                  className="w-full p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/10 hover:from-emerald-500/25 hover:to-teal-500/20 text-emerald-200 font-semibold text-xs border border-emerald-500/30 transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-400/30">
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">Kullanıcı & Yetki Yönetimi</span>
                        {pendingCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-400/25 text-amber-300 border border-amber-400/40 animate-pulse">
                            {pendingCount} Bekliyor
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-300/80 font-medium">{admins.length + teachers.length + pendingCount} Toplam Kayıtlı Güncel Kullanıcı</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-300" />
                </button>
              )}
            </div>
          )}

          {/* TAB 2: UNIFIED BACKUP & CLOUD SYNC */}
          {activeTab === 'backup' && (
            <div className="space-y-3 sm:space-y-3.5">
              {/* 1. Yedekleme & Senkronizasyon Merkezi Ana Girişi */}
              {onOpenCloudBackup && (
                <button
                  onClick={() => {
                    onOpenCloudBackup();
                    onClose();
                  }}
                  className="w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/5 hover:from-amber-500/25 hover:via-emerald-500/20 hover:to-amber-500/15 text-white font-semibold text-xs border border-amber-500/30 hover:border-amber-400/50 transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/25 via-sky-400/20 to-emerald-400/25 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/35 group-hover:scale-105 transition-transform shadow-xs">
                      <Cloud className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs sm:text-sm group-hover:text-amber-200 transition-colors">
                          Yedekleme & Senkronizasyon Merkezi
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                          Tümleşik
                        </span>
                      </div>
                      <div className="text-[11px] text-white/60 mt-0.5 line-clamp-1">
                        Google Drive canlı kütüğü, anlık bulut eşitleme ve kütük yayın kontrolü
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}

              {/* 2. Çevrim Dışı JSON Dosyası (Yerel Yedekleme & Aktarım) */}
              {userRole === 'admin' ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white">Çevrim Dışı JSON Dosyası</h4>
                      <p className="text-[11px] text-white/50">Cihazınıza güvenli yedek indirin veya mevcut yedeği aktarın</p>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                      Yerel Dosya
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    {handleBackup && (
                      <button
                        onClick={handleBackup}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 transition-all cursor-pointer text-xs font-bold active:scale-98 shadow-xs"
                      >
                        <DownloadCloud className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Yedeği İndir</span>
                      </button>
                    )}

                    {handleRestore && (
                      <button
                        onClick={() => document.getElementById('modal-restore-input')?.click()}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 transition-all cursor-pointer text-xs font-bold active:scale-98 shadow-xs"
                      >
                        <UploadCloud className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Dosya Yükle</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-sky-200 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Öğretmen yetkisi: Salt okunur kütük erişimi. Güncel veriler otomatik senkronize edilir.</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/40">
          <span>AkademiPanel3 • Kırklareli Atatürk Ortaokulu</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
