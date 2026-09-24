import React, { useState, useEffect } from 'react';
import { 
  X, User, Shield, Moon, Sun, HardDriveDownload, 
  DownloadCloud, UploadCloud, Cloud, LogOut, Check, 
  RefreshCw, Database, Activity, ChevronRight, AlertCircle,
  Laptop, Smartphone, Bell, BellRing
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User as FirebaseUser } from '../lib/firebase';
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
  onOpenAppHub: () => void;
  onOpenFirebaseStatus: () => void;
  onOpenUserManagement: () => void;
  onOpenNotifications?: () => void;
  handleBackup: () => void;
  handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleManualSave: () => Promise<void>;
  saveFeedback: string | null;
  syncStatus: 'synced' | 'saving' | 'quota_exceeded' | 'offline' | 'error';
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
  handleBackup,
  handleRestore,
  handleManualSave,
  saveFeedback,
  syncStatus
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'backup' | 'cloud' | 'appearance'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermissionState(getPushPermissionState());
    }
  }, [isOpen]);

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

  const triggerSave = async () => {
    setIsSaving(true);
    await handleManualSave();
    setIsSaving(false);
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          label: 'Bulut Senkronize',
          desc: 'Tüm verileriniz bulut ortamı ile anlık olarak senkronize.',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/25',
          dot: 'bg-emerald-400'
        };
      case 'saving':
        return {
          label: 'Kaydediliyor...',
          desc: 'Değişiklikler bulut ortamına aktarılıyor.',
          color: 'text-sky-400',
          bg: 'bg-sky-500/10 border-sky-500/25',
          dot: 'bg-sky-400 animate-spin'
        };
      case 'quota_exceeded':
        return {
          label: 'Yerel Koruma Modu (Kota)',
          desc: 'Günlük bulut senkronizasyon limitine ulaşıldı, verileriniz bu cihazda kesintisiz güvende tutuluyor.',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/25',
          dot: 'bg-amber-400'
        };
      case 'offline':
      case 'error':
      default:
        return {
          label: 'Yerel Hafıza Koruması',
          desc: 'Ağ veya bulut beklemede. Verileriniz bu cihazda güvenle saklanmaktadır.',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/25',
          dot: 'bg-rose-400'
        };
    }
  };

  const syncInfo = getSyncStatusBadge();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#18191c] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input for JSON Restore */}
        <input 
          type="file" 
          accept=".json" 
          className="hidden" 
          id="modal-restore-input" 
          onChange={(e) => {
            handleRestore(e);
          }} 
        />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-white/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-accent to-[#8d6f3e] flex items-center justify-center text-white shadow-md font-bold text-base">
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
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Profil & Sistem Ayarları</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent">
                  {getRoleLabel()}
                </span>
              </div>
              <p className="text-xs text-white/50 truncate max-w-[280px] sm:max-w-md">
                {currentUser?.email || 'Google ile giriş yapılmadı'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Toast (if any) */}
        {saveFeedback && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-white/[0.02] px-3 sm:px-5 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'profile' 
                ? "border-brand-accent text-brand-accent" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <User className="w-4 h-4" />
            <span>Hesap & Görünüm</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={cn(
              "px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'backup' 
                ? "border-brand-accent text-brand-accent" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <Database className="w-4 h-4" />
            <span>Yedekleme & İçe/Dışa Aktar</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={cn(
              "px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'cloud' 
                ? "border-brand-accent text-brand-accent" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Bulut Senkronizasyon</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: PROFILE & APPEARANCE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Google Profile Card */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Google Kimlik Doğrulaması</span>
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Aktif Oturum
                  </span>
                </div>
                
                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Kullanıcı')}
                    </p>
                    <p className="text-xs text-white/60">{currentUser?.email}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Kırklareli Atatürk Ortaokulu • Akademi Panel</p>
                  </div>

                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Güvenli Çıkış Yap</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Theme & Display Options */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Görünüm Teması</h4>
                    <p className="text-xs text-white/50">Göz konforunuza göre açık veya koyu tema seçin</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      !isDarkMode 
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-sm" 
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Aydınlık Tema</span>
                    {!isDarkMode && <Check className="w-3.5 h-3.5 ml-1 text-amber-300" />}
                  </button>

                  <button
                    onClick={() => setIsDarkMode(true)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      isDarkMode 
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 shadow-sm" 
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Moon className="w-4 h-4 text-indigo-300" />
                    <span>Karanlık Tema</span>
                    {isDarkMode && <Check className="w-3.5 h-3.5 ml-1 text-indigo-300" />}
                  </button>
                </div>
              </div>

              {/* App Installation Hub & Vercel Live */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-transparent border border-sky-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <HardDriveDownload className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Cihaza Kur & Vercel Canlı Link</h4>
                      <p className="text-xs text-white/50">Akıllı cihaz algılama, ana ekrana ekleme ve Vercel linki</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    onOpenAppHub();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-white font-semibold text-xs border border-sky-500/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sky-300 font-bold">
                      <Laptop className="w-3.5 h-3.5" /> / <Smartphone className="w-3.5 h-3.5" />
                    </span>
                    <span>Cihaza Yükleme ve Canlı Yayın Merkezini Aç</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* PWA Push Notification System */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-brand-accent/10 to-transparent border border-amber-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">Anlık Push Bildirimleri</h4>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          permissionState === 'granted' 
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" 
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        )}>
                          {permissionState === 'granted' ? 'Aktif (Açık)' : 'İzin Bekleniyor'}
                        </span>
                      </div>
                      <p className="text-xs text-white/50">Yeni sınav sonuçları ve duyuruları tarayıcınızdan anında alın</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {permissionState !== 'granted' ? (
                    <button
                      onClick={handleTogglePermission}
                      disabled={isRequestingPermission}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {isRequestingPermission ? 'İzin İsteniyor...' : 'Bildirimleri Aç & İzin Ver'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        displayBrowserNotification('🔔 Test Bildirimi', 'AkademiPanel anlık bildirim sistemi aktif ve çalışıyor!');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <Bell className="w-3.5 h-3.5 text-brand-accent" />
                      Test Bildirimi Gönder
                    </button>
                  )}

                  {onOpenNotifications && (
                    <button
                      onClick={() => {
                        onOpenNotifications();
                        onClose();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Merkezi Aç</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* User Permissions Management (Admin Only) */}
              {userRole === 'admin' && (
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Kullanıcı & Yetki Yönetimi</h4>
                        <p className="text-xs text-white/50">Yönetici ve öğretmen e-posta izinlerini yönetin</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenUserManagement();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold text-xs border border-emerald-500/25 transition-all cursor-pointer group"
                  >
                    <span>Yetkili Listesini ve Erişim Taleplerini Düzenle</span>
                    <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              {/* Local Offline JSON Backup & Restore */}
              {userRole === 'admin' && (
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Cihaza İndir & Cihazdan Yükle (JSON)</h4>
                    <p className="text-xs text-white/50">
                      İnternet olmasa dahi bilgisayarınızda veya telefonunuzda saklayabileceğiniz tam sistem yedeği
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={handleBackup}
                      className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-white transition-all cursor-pointer text-center group"
                    >
                      <DownloadCloud className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-emerald-200">Cihaza JSON Yedeği İndir</span>
                      <span className="text-[10px] text-white/50 mt-1">Öğrenci, sınav, sonuç, arena, salon ve bütçe</span>
                    </button>

                    <button
                      onClick={() => document.getElementById('modal-restore-input')?.click()}
                      className="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-white transition-all cursor-pointer text-center group"
                    >
                      <UploadCloud className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-indigo-200">Cihazdan JSON Yedeği Yükle</span>
                      <span className="text-[10px] text-white/50 mt-1">Bilgisayardan dosya seçip sisteme aktar</span>
                    </button>
                  </div>
                </div>
              )}

              {userRole !== 'admin' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-amber-200 text-xs">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Sistem yedeği indirme ve geri yükleme yetkisi yalnızca okul yöneticilerine tanımlıdır.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD SYNC */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              {/* Sync Status Box */}
              <div className={cn("p-4 rounded-2xl border space-y-3", syncInfo.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", syncInfo.dot)}></span>
                    <h4 className={cn("text-sm font-bold", syncInfo.color)}>{syncInfo.label}</h4>
                  </div>
                  
                  {userRole === 'admin' && (
                    <button
                      onClick={triggerSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isSaving && "animate-spin")} />
                      <span>{isSaving ? 'Kaydediliyor...' : 'Şimdi Senkronize Et'}</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-white/70 leading-relaxed">
                  {syncInfo.desc}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/40">
          <span>Akademi Panel 2.0 • Kırklareli Atatürk Ortaokulu</span>
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
