import React, { useState, useEffect } from 'react';
import { 
  X, User, Shield, Moon, Sun, 
  DownloadCloud, UploadCloud, LogOut, Check, 
  RefreshCw, Database, Activity, ChevronRight, AlertCircle,
  Bell, BellRing, Sparkles, ShieldCheck, Users, Smartphone, HardDriveDownload
} from 'lucide-react';
import { cn } from '../lib/utils';
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
  handleManualSave,
  saveFeedback,
  syncStatus = 'synced'
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'backup' | 'cloud'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setPermissionState(getPushPermissionState());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && userRole === 'admin') {
      const q = query(collection(db, 'access_requests'));
      const unsub = onSnapshot(q, (snapshot) => {
        let count = 0;
        const total = snapshot.size;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
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
  }, [isOpen, userRole]);

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
    if (!handleManualSave) return;
    setIsSaving(true);
    await handleManualSave();
    setIsSaving(false);
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          label: 'Bulut Senkronize',
          desc: 'Tüm verileriniz Firebase bulut ortamı ile anlık olarak senkronize ediliyor.',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/25',
          dot: 'bg-emerald-400'
        };
      case 'saving':
        return {
          label: 'Kaydediliyor...',
          desc: 'Değişiklikler bulut veritabanına aktarılıyor.',
          color: 'text-sky-400',
          bg: 'bg-sky-500/10 border-sky-500/25',
          dot: 'bg-sky-400 animate-spin'
        };
      case 'quota_exceeded':
        return {
          label: 'Yerel Koruma Modu (Kota)',
          desc: 'Günlük bulut senkronizasyon limitine ulaşıldı. Verileriniz cihazınızda kesintisiz saklanmaktadır.',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/25',
          dot: 'bg-amber-400'
        };
      case 'offline':
      case 'error':
      default:
        return {
          label: 'Yerel Hafıza Koruması',
          desc: 'Ağ bağlantısı beklemede. Değişiklikleriniz yerel hafızada güvenle saklanmaktadır.',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/25',
          dot: 'bg-rose-400'
        };
    }
  };

  const syncInfo = getSyncStatusBadge();

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-[#141518] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-500/5 via-white/[0.02] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#B08D57] to-[#8d6f3e] flex items-center justify-center text-white shadow-lg font-bold text-base border border-amber-400/30 shrink-0">
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
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base sm:text-lg leading-tight">Profil & Sistem Ayarları</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300">
                  {getRoleLabel()}
                </span>
              </div>
              <p className="text-xs text-white/50 truncate max-w-[240px] sm:max-w-xs mt-0.5 font-mono">
                {currentUser?.email || 'Google Girişi Yapılmadı'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Toast */}
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
              "px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'profile' 
                ? "border-amber-400 text-amber-300 bg-amber-400/5" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <User className="w-4 h-4" />
            <span>Hesap & Görünüm</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={cn(
              "px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'backup' 
                ? "border-amber-400 text-amber-300 bg-amber-400/5" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <Database className="w-4 h-4" />
            <span>Yedekleme & Aktarım</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={cn(
              "px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeTab === 'cloud' 
                ? "border-amber-400 text-amber-300 bg-amber-400/5" 
                : "border-transparent text-white/60 hover:text-white hover:border-white/20"
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Bulut Senkronizasyonu</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          
          {/* TAB 1: PROFILE & APPEARANCE */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              {/* Google Profile Card */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Google Hesabı Kimlik Bilgileri</span>
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Aktif Oturum
                  </span>
                </div>
                
                <div className="flex items-center justify-between flex-wrap gap-3 pt-0.5">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Kullanıcı')}
                    </p>
                    <p className="text-xs text-white/60 font-mono mt-0.5">{currentUser?.email || 'Giriş yapılmadı'}</p>
                    <p className="text-[11px] text-amber-300/70 font-medium mt-1">Kırklareli Atatürk Ortaokulu • AkademiPanel</p>
                  </div>

                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Oturumu Kapat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Theme Selection */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Görünüm Teması</h4>
                  <p className="text-xs text-white/50">Sistem arayüzünü aydınlık veya karanlık moda geçirin</p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <button
                    onClick={() => setIsDarkMode(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                      !isDarkMode 
                        ? "bg-amber-500/20 border-amber-400/60 text-amber-200 shadow-md" 
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
                        ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-200 shadow-md" 
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Moon className="w-4 h-4 text-indigo-300" />
                    <span>Karanlık Tema</span>
                    {isDarkMode && <Check className="w-3.5 h-3.5 ml-1 text-indigo-300" />}
                  </button>
                </div>
              </div>

              {/* Push Notifications */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
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
                          {permissionState === 'granted' ? 'Aktif' : 'İzin Bekleniyor'}
                        </span>
                      </div>
                      <p className="text-xs text-white/50">Sınav duyuruları ve sonuç bildirimlerini cihazınızdan alın</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  {permissionState !== 'granted' ? (
                    <button
                      onClick={handleTogglePermission}
                      disabled={isRequestingPermission}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#B08D57] hover:bg-[#9a7b4a] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {isRequestingPermission ? 'İzin İsteniyor...' : 'Bildirimleri Aç & İzin Ver'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        displayBrowserNotification('🔔 Test Bildirimi', 'AkademiPanel anlık bildirim sistemi aktif ve çalışıyor!');
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-white/10"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      Test Bildirimi Gönder
                    </button>
                  )}

                  {onOpenNotifications && (
                    <button
                      onClick={() => {
                        onOpenNotifications();
                        onClose();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold text-xs border border-white/10 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <span>Bildirim Merkezi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Install PWA App Card (iOS / iPhone / Android / Desktop) */}
              {onOpenAppHub && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">iPhone & Cihaza Uygulama Olarak Yükle</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            PWA Desteği
                          </span>
                        </div>
                        <p className="text-xs text-white/50">Safari adres çubuğu olmadan bağımsız tam ekran mobil uygulama yapın</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenAppHub();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs border border-sky-500/30 transition-all cursor-pointer group shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2">
                      <HardDriveDownload className="w-4 h-4 text-sky-400" />
                      <span>Ana Ekrana Ekleme & Kurulum Rehberini Aç</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}

              {/* User Permissions Management (Admin Only) */}
              {userRole === 'admin' && onOpenUserManagement && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">Kullanıcı & Yetki Yönetimi</h4>
                          {pendingCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/25 text-amber-300 border border-amber-400/40 animate-pulse">
                              {pendingCount} Onay Bekleyen
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {totalUsersCount > 0 ? `${totalUsersCount} Kayıtlı Üye` : 'Aktif'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50">Giriş yapmış kayıtlı üyelere Öğretmen veya İdareci yetkisi verin</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenUserManagement();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold text-xs border border-emerald-500/30 transition-all cursor-pointer group shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Kayıtlı Kullanıcıları Yönet & Yetki Tanımla</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pendingCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-400/30 text-amber-200 text-[10px] font-bold">
                          {pendingCount} Bekliyor
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-3.5">
              {/* Bulut Yedekleme Merkezi Butonu */}
              {onOpenCloudBackup && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">Firebase Bulut Yedekleme Merkezi</h4>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            userRole === 'admin' 
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                          )}>
                            {userRole === 'admin' ? 'Tam Yetkili' : 'Salt Okunur Görünüm'}
                          </span>
                        </div>
                        <p className="text-xs text-white/50">
                          {userRole === 'admin' 
                            ? 'Bulut yedeklerini görüntüleyin, yeni sistem yedeği alın veya geri yükleyin' 
                            : 'Bulut üzerindeki sistem yedeklerini ve istatistiklerini görüntüleyin'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenCloudBackup();
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#B08D57]/20 hover:bg-[#B08D57]/30 text-amber-200 font-semibold text-xs border border-amber-500/30 transition-all cursor-pointer group shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2">
                      <DownloadCloud className="w-4 h-4 text-amber-400" />
                      <span>{userRole === 'admin' ? 'Bulut Yedekleme Merkezini Aç' : 'Bulut Yedeklerini Görüntüle'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-300 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}

              {userRole === 'admin' ? (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Çevrim Dışı JSON Yedeği Al & Aktar</h4>
                    <p className="text-xs text-white/50">
                      Tüm okul verilerinizi (öğrenciler, sınavlar, sonuçlar, bütçe) dosya halinde saklayabilir veya sisteme yükleyebilirsiniz.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {handleBackup && (
                      <button
                        onClick={handleBackup}
                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-white transition-all cursor-pointer text-center group"
                      >
                        <DownloadCloud className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-emerald-200">Cihaza JSON Yedeği İndir</span>
                        <span className="text-[10px] text-white/50 mt-1">Tam okul veri snapshot çıktısı</span>
                      </button>
                    )}

                    {handleRestore && (
                      <button
                        onClick={() => document.getElementById('modal-restore-input')?.click()}
                        className="flex flex-col items-center justify-center p-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-white transition-all cursor-pointer text-center group"
                      >
                        <UploadCloud className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-indigo-200">Cihazdan JSON Dosyası Yükle</span>
                        <span className="text-[10px] text-white/50 mt-1">Cihazınızdaki yedek dosyasını aktar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs text-sky-200">
                    <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sky-100">Salt Okunur Yedekleme Erişimi</p>
                      <p className="text-white/60 text-[11px] mt-0.5 leading-relaxed">
                        Öğretmen yetkisiyle sistem yedeklerini ve istatistiklerini sadece görüntüleyebilirsiniz. Firebase üzerine yeni yedek yazma, cihaza JSON yedek indirme ve geri yükleme işlemleri veri güvenliği politikası gereğince yalnızca İdarecilere aittir.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD SYNC */}
          {activeTab === 'cloud' && (
            <div className="space-y-3.5">
              <div className={cn("p-4 rounded-2xl border space-y-3", syncInfo.bg)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", syncInfo.dot)}></span>
                    <h4 className={cn("text-sm font-bold", syncInfo.color)}>{syncInfo.label}</h4>
                  </div>
                  
                  {userRole === 'admin' && handleManualSave && (
                    <button
                      onClick={triggerSave}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer disabled:opacity-50"
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
