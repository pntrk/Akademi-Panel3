import React, { useState, useEffect } from 'react';
import { 
  Cloud, CheckCircle2, AlertTriangle, RefreshCw, X, Eye, 
  UploadCloud, FolderCheck, Download, Trash2, Plus, 
  Calendar, User as UserIcon, ShieldCheck, Database, FileText
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { 
  auth, 
  connectGoogleDrive, 
  getCachedAccessToken
} from '../lib/firebase';
import { 
  DriveBackupItem,
  listBackupsFromGoogleDrive, 
  downloadBackupFromGoogleDrive, 
  deleteBackupFromGoogleDrive,
  LIVE_MASTER_FILE_NAME
} from '../lib/googleDrive';
import { CloudBackupRecord } from '../types';

interface CloudBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    state,
    userRole, 
    pendingSyncCount,
    hasPendingChanges,
    lastSyncedAt,
    lastDriveSyncedAt,
    isDriveAutoSyncing,
    syncToDriveNow,
    cloudBackups, 
    isLoadingBackups, 
    createCloudBackup, 
    restoreCloudBackup, 
    deleteCloudBackup, 
    syncFromCloudStorage,
    saveNow,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'sync' | 'archive'>('sync');
  const [isPublishingToTeachers, setIsPublishingToTeachers] = useState(false);
  const [isPullingData, setIsPullingData] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState<CloudBackupRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Google Drive Connection State
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(() => !!getCachedAccessToken());
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);

  const isAdmin = userRole === 'admin';
  const currentUser = auth.currentUser;
  const currentEmail = (currentUser?.email || 'admin@okul.gov.tr').toLowerCase();

  useEffect(() => {
    if (isOpen) {
      setIsDriveConnected(!!getCachedAccessToken());
      setFeedback(null);
    }
  }, [isOpen]);

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    setFeedback(null);
    try {
      const token = await connectGoogleDrive();
      if (token) {
        setIsDriveConnected(true);
        setFeedback({ 
          type: 'success', 
          message: 'Google Drive bağlantısı kuruldu! Adminler arası 30 saniyelik canlı kütük senkronizasyonu aktif.' 
        });
        await syncToDriveNow().catch(() => {});
      } else {
        setFeedback({ type: 'error', message: 'Google Drive oturumu açılamadı.' });
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setFeedback({ type: 'error', message: 'Giriş penceresi kapatıldı.' });
      } else {
        setFeedback({ type: 'error', message: err?.message || 'Google Drive bağlantı hatası oluştu.' });
      }
    } finally {
      setIsConnectingDrive(false);
    }
  };

  // 1. ADMIN ACTION: Manual Drive Sync
  const handleManualDriveSync = async () => {
    setFeedback(null);
    try {
      if (!isDriveConnected) {
        await handleConnectDrive();
        return;
      }
      const res = await syncToDriveNow();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Google Drive canlı master kütüğü ("${LIVE_MASTER_FILE_NAME}") başarıyla eşitlendi!`
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Google Drive senkronizasyon hatası.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Drive senkronizasyon hatası' });
    }
  };

  // 2. ADMIN ACTION: Publish to Teachers (Firebase)
  const handlePublishToTeachers = async () => {
    if (!isAdmin) return;
    setIsPublishingToTeachers(true);
    setFeedback(null);
    try {
      await saveNow();
      setFeedback({
        type: 'success',
        message: 'Tüm güncellemeler Firebase üzerine başarıyla aktarıldı. Öğretmenlerin panellerine anında yansıtıldı!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Firebase yayını yapılırken bir hata oluştu.'
      });
    } finally {
      setIsPublishingToTeachers(false);
    }
  };

  // 3. TEACHER / ADMIN ACTION: Pull Latest Published Data from Firebase
  const handlePullFromFirebase = async () => {
    setIsPullingData(true);
    setFeedback(null);
    try {
      const ok = await syncFromCloudStorage(true);
      if (ok) {
        setFeedback({
          type: 'success',
          message: 'Firebase üzerinden yönetim tarafından yayınlanmış en güncel kütük başarıyla çekildi!'
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Buluttan yeni kütük çekilemedi veya veriler zaten güncel.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Bulut verisi çekilirken hata oluştu.'
      });
    } finally {
      setIsPullingData(false);
    }
  };

  // 4. ADMIN ACTION: Create named snapshot
  const handleCreateSnapshot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    setIsCreatingSnapshot(true);
    setFeedback(null);
    try {
      const res = await createCloudBackup(snapshotName, snapshotNote);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setSnapshotName('');
        setSnapshotNote('');
        setShowCreateForm(false);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Yedek noktası kaydedilemedi.' });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // 5. ADMIN ACTION: Restore snapshot
  const handleConfirmRestore = async () => {
    if (!confirmRestoreBackup || !isAdmin) return;
    setActionLoadingId(confirmRestoreBackup.id);
    setFeedback(null);
    try {
      const res = await restoreCloudBackup(confirmRestoreBackup.id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `"${confirmRestoreBackup.name}" yedeği başarıyla sisteme geri yüklendi!`
        });
        setConfirmRestoreBackup(null);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Geri yükleme sırasında hata oluştu.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 6. ADMIN ACTION: Delete snapshot
  const handleDeleteSnapshot = async (backupId: string) => {
    if (!isAdmin) return;
    setActionLoadingId(backupId);
    setFeedback(null);
    try {
      const res = await deleteCloudBackup(backupId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setConfirmDeleteId(null);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Yedek silinemedi.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 7. DOWNLOAD JSON
  const handleDownloadBackupJson = (record: CloudBackupRecord) => {
    try {
      const payload = record.data || record;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${record.createdAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Yedek dosyası indirilemedi.' });
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen || (userRole !== 'admin' && userRole !== 'teacher')) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-[#e6e2d3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e6e2d3] bg-[#FAF9F5] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#B08D57] to-[#8d6f3e] text-white flex items-center justify-center shadow-xs shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-serif font-bold text-[#2d2c25]">
                  {isAdmin ? 'Bulut Senkronizasyon & Yayın Merkezi' : 'Yönetim Kütük & Yayın Durumu'}
                </h2>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Yönetici (Tam Yetkili)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-sky-600" />
                    Öğretmen (Salt Okunur)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#737265] truncate mt-0.5">
                {isAdmin 
                  ? 'Adminler arası canlı eşitleme Google Drive ile yürütülür; Yayınla butonu verileri öğretmenlere aktarır.' 
                  : 'Yönetim tarafından onaylanıp Firebase üzerinden yayınlanan güncel okul kütüğü.'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-xl hover:bg-gray-200/70 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Navigation Tabs */}
        {isAdmin && (
          <div className="flex border-b border-[#e6e2d3] bg-[#FAF9F5]/50 px-5 shrink-0">
            <button
              onClick={() => setActiveTab('sync')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'sync' 
                  ? 'border-[#B08D57] text-[#B08D57]' 
                  : 'border-transparent text-[#737265] hover:text-[#2d2c25]'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Senkronizasyon & Yayın</span>
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'archive' 
                  ? 'border-[#B08D57] text-[#B08D57]' 
                  : 'border-transparent text-[#737265] hover:text-[#2d2c25]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Sistem Yedekleri & Arşiv ({cloudBackups.length})</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Feedback Toast */}
          {feedback && (
            <div className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 animate-fade-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button 
                onClick={() => setFeedback(null)} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* 1. ADMIN VIEW - TAB 1: SENKRONİZASYON & YAYIN (SADE & NET)   */}
          {/* ============================================================ */}
          {isAdmin && activeTab === 'sync' && (
            <div className="space-y-4">
              {/* PILLAR 1: GOOGLE DRIVE (ADMINLER ARASI CANLI KÜTÜK) */}
              <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <FolderCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-emerald-950 font-serif">
                          1. Google Drive — Adminler Arası Canlı Eşitleme
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDriveConnected 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {isDriveConnected ? '✓ Drive Bağlı' : 'Bağlantı Bekleniyor'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                        Tüm idarecilerin ekranı bu ortak canlı kütük (<code className="font-mono font-bold bg-emerald-100/80 text-emerald-900 px-1 py-0.5 rounded">{LIVE_MASTER_FILE_NAME}</code>) üzerinden 30 saniyede bir otomatik eşitlenir. <strong>Firebase kotası tüketmez.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {!isDriveConnected ? (
                      <button
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FolderCheck className="w-3.5 h-3.5" />
                        <span>{isConnectingDrive ? 'Bağlanıyor...' : 'Drive\'a Bağlan'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleManualDriveSync}
                        disabled={isDriveAutoSyncing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isDriveAutoSyncing ? 'animate-spin' : ''}`} />
                        <span>{isDriveAutoSyncing ? 'Drive Eşitleniyor...' : 'Şimdi Drive\'a Eşitle'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/50">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Eşitleme Sıklığı</span>
                    <span className="font-bold text-emerald-950">30 Saniyede Bir Otomatik</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/50">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Son Drive Eşitleme</span>
                    <span className="font-bold text-emerald-950">{lastDriveSyncedAt || 'Beklemede (İlk işlemle başlar)'}</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-emerald-700 font-semibold block">Hedef Kitle</span>
                    <span className="font-bold text-emerald-950">Sadece İdareciler (Adminler)</span>
                  </div>
                </div>
              </div>

              {/* PILLAR 2: FIREBASE (ÖĞRETMENLERE YAYINLAMA) */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/30 rounded-2xl p-4 sm:p-5 border border-amber-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-amber-950 font-serif">
                          2. Firebase — Öğretmen Kullanıcılara Yayınlama
                        </h3>
                        {hasPendingChanges ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                            {pendingSyncCount} Değişiklik Yayına Hazır
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Öğretmenler Güncel
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                        İdarecilerin girdiği öğrenci kütüğü, deneme sınavları ve optik sonuçlar bu butona basıldığında Firebase'e yüklenir ve <strong>öğretmenlerin ekranına anında yansır.</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePublishToTeachers}
                    disabled={isPublishingToTeachers}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 self-end sm:self-center"
                  >
                    <UploadCloud className={`w-4 h-4 ${isPublishingToTeachers ? 'animate-bounce' : ''}`} />
                    <span>{isPublishingToTeachers ? 'Yayınlanıyor...' : 'Öğretmenlere Yayınla & Güncelle'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-xs">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/50">
                    <span className="text-[10px] text-amber-700 font-semibold block">Yayın Tetikleme</span>
                    <span className="font-bold text-amber-950">Yalnızca Manuel Buton</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/50">
                    <span className="text-[10px] text-amber-700 font-semibold block">Son Yayın Zamanı</span>
                    <span className="font-bold text-amber-950">{lastSyncedAt || 'Henüz yayınlanmadı'}</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-amber-700 font-semibold block">Öğretmen Yetkisi</span>
                    <span className="font-bold text-amber-950">Otomatik Salt-Okunur İndirme</span>
                  </div>
                </div>
              </div>

              {/* CURRENT LOCAL STATE SUMMARY CHIPS */}
              <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#e6e2d3] flex items-center justify-between gap-3 flex-wrap text-xs">
                <span className="font-semibold text-[#5a5a40] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#B08D57]" />
                  Mevcut Okul Kütüğü:
                </span>
                <div className="flex items-center gap-3 font-bold text-[#2d2c25]">
                  <span>{state.students?.length || 0} Öğrenci</span>
                  <span>•</span>
                  <span>{state.exams?.length || 0} Sınav</span>
                  <span>•</span>
                  <span>{state.results?.length || 0} Sonuç</span>
                  <span>•</span>
                  <span>{state.examHalls?.length || 0} Salon</span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 1. ADMIN VIEW - TAB 2: GEÇMİŞ YAYINLAR & SİSTEM YEDEKLERİ    */}
          {/* ============================================================ */}
          {isAdmin && activeTab === 'archive' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#737265]">
                    Geçmiş Yayın Noktaları & Yedekler ({cloudBackups.length})
                  </h3>
                  <p className="text-[11px] text-[#737265]">
                    İstediğiniz zaman arşivdeki bir yayın noktasına geri dönebilir veya JSON olarak indirebilirsiniz.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateForm(prev => !prev)}
                  className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#8d6f3e] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showCreateForm ? 'İptal' : 'Yeni Yedek Noktası Al'}</span>
                </button>
              </div>

              {/* Create Snapshot Form */}
              {showCreateForm && (
                <form 
                  onSubmit={handleCreateSnapshot}
                  className="p-4 bg-[#FAF9F5] rounded-2xl border border-[#B08D57]/40 space-y-3 animate-fade-in"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5a5a40] mb-1">
                        Yedek Adı (İsteğe Bağlı):
                      </label>
                      <input 
                        type="text" 
                        value={snapshotName}
                        onChange={(e) => setSnapshotName(e.target.value)}
                        placeholder="Örn: 1. Dönem Deneme 3 Öncesi Kütük"
                        className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs text-[#2d2c25] focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5a5a40] mb-1">
                        Açıklama / Not:
                      </label>
                      <input 
                        type="text" 
                        value={snapshotNote}
                        onChange={(e) => setSnapshotNote(e.target.value)}
                        placeholder="Örn: 8. sınıf LGS optik okuma sonrası arşiv"
                        className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs text-[#2d2c25] focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingSnapshot}
                      className="px-4 py-1.5 bg-[#B08D57] hover:bg-[#8d6f3e] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} />
                      <span>{isCreatingSnapshot ? 'Kaydediliyor...' : 'Yedek Noktasını Kaydet'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Restore Confirmation Dialog */}
              {confirmRestoreBackup && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">
                        Bu Yedeği Sisteme Geri Yüklemek İstiyor Musunuz?
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                        <strong>"{confirmRestoreBackup.name}"</strong> ({formatDate(confirmRestoreBackup.createdAt)}) tarihli kütük sisteme geri yüklenecektir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setConfirmRestoreBackup(null)}
                      className="px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 rounded-xl cursor-pointer"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleConfirmRestore}
                      disabled={actionLoadingId === confirmRestoreBackup.id}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingId === confirmRestoreBackup.id ? 'animate-spin' : ''}`} />
                      <span>{actionLoadingId === confirmRestoreBackup.id ? 'Geri Yükleniyor...' : 'Evet, Geri Yükle'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Backup List */}
              {cloudBackups.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF9F5] rounded-2xl border border-dashed border-[#e6e2d3] space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-[#B08D57] mx-auto flex items-center justify-center">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-[#5a5a40]">Henüz Arşivlenmiş Yedek Noktası Yok</h4>
                  <p className="text-[11px] text-[#737265] max-w-sm mx-auto">
                    Öğretmenlere yayınlanan kütükler veya yukarıdaki butonla oluşturacağınız yedek noktaları burada arşivlenir.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cloudBackups.map((record) => {
                    const isBusy = actionLoadingId === record.id;
                    const isConfirmDelete = confirmDeleteId === record.id;

                    return (
                      <div 
                        key={record.id}
                        className="p-3.5 bg-white rounded-2xl border border-[#e6e2d3] hover:border-[#B08D57]/40 transition-all shadow-2xs space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-xs text-[#2d2c25]">{record.name}</h4>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF9F5] text-[#5a5a40] border border-[#e6e2d3]">
                                {formatDate(record.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#737265] mt-0.5">
                              Yayınlayan: <span className="font-medium text-[#2d2c25]">{record.createdByEmail}</span>
                              {record.note && <span className="italic text-[#B08D57]"> • {record.note}</span>}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            <button
                              onClick={() => handleDownloadBackupJson(record)}
                              className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-[#5a5a40] font-semibold rounded-xl text-xs border border-gray-200 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="JSON olarak indir"
                            >
                              <Download className="w-3.5 h-3.5 text-sky-600" />
                              <span className="hidden sm:inline">JSON</span>
                            </button>

                            <button
                              onClick={() => setConfirmRestoreBackup(record)}
                              disabled={isBusy}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                              title="Sisteme geri yükle"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                              <span>Geri Yükle</span>
                            </button>

                            {isConfirmDelete ? (
                              <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                                <span className="text-[10px] text-rose-700 font-bold px-1">Silinsin mi?</span>
                                <button
                                  onClick={() => handleDeleteSnapshot(record.id)}
                                  className="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                                >
                                  Evet
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 bg-white text-gray-700 rounded-lg text-[10px]"
                                >
                                  Hayır
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(record.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                          <div className="bg-[#FAF9F5] p-1.5 rounded-xl border border-[#e6e2d3]/60">
                            <span className="font-bold text-[#2d2c25]">{record.summary?.studentCount ?? record.data?.students?.length ?? 0}</span>
                            <span className="text-[10px] text-[#737265] block">Öğrenci</span>
                          </div>
                          <div className="bg-[#FAF9F5] p-1.5 rounded-xl border border-[#e6e2d3]/60">
                            <span className="font-bold text-[#2d2c25]">{record.summary?.examCount ?? record.data?.exams?.length ?? 0}</span>
                            <span className="text-[10px] text-[#737265] block">Sınav</span>
                          </div>
                          <div className="bg-[#FAF9F5] p-1.5 rounded-xl border border-[#e6e2d3]/60">
                            <span className="font-bold text-[#2d2c25]">{record.summary?.resultCount ?? record.data?.results?.length ?? 0}</span>
                            <span className="text-[10px] text-[#737265] block">Sonuç</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. TEACHER VIEW - TEK, NET, SADE PANEL (SIFIR KARMAŞA)       */}
          {/* ============================================================ */}
          {!isAdmin && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-sky-50 via-white to-indigo-50/30 rounded-2xl p-5 border border-sky-200 shadow-2xs space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif font-bold text-base text-[#2d2c25]">
                        Yönetim Tarafından Yayınlanan En Son Kütük
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-sky-600" />
                        Salt Okunur Mod
                      </span>
                    </div>
                    <p className="text-xs text-[#737265] mt-1 leading-relaxed">
                      Okul idaresi tarafından sisteme yeni öğrenci kütüğü, deneme sınavı veya optik sonuç eklendiğinde ve <strong>"Öğretmenlere Yayınla"</strong> butonuna basıldığında paneliniz Firebase üzerinden otomatik olarak güncellenir.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-sky-100 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-sky-200/60 shadow-2xs">
                    <span className="text-[10px] text-sky-700 font-semibold block">Eşitleme Durumu</span>
                    <span className="font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Tam Senkronize
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-sky-200/60 shadow-2xs">
                    <span className="text-[10px] text-sky-700 font-semibold block">Son Yayın Zamanı</span>
                    <span className="font-bold text-[#2d2c25] mt-0.5 block">{lastSyncedAt || 'Güncel'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-sky-200/60 shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-sky-700 font-semibold block">Erişim Türü</span>
                    <span className="font-bold text-sky-950 mt-0.5 block">Otomatik Dağıtım (Korumalı)</span>
                  </div>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-sky-200/40 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <span className="font-semibold text-[#5a5a40]">Mevcut Yayınlanan Kütük Verisi:</span>
                  <div className="flex items-center gap-3 font-bold text-[#2d2c25]">
                    <span>{state.students?.length || 0} Öğrenci</span>
                    <span>•</span>
                    <span>{state.exams?.length || 0} Sınav</span>
                    <span>•</span>
                    <span>{state.results?.length || 0} Sonuç</span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={handlePullFromFirebase}
                    disabled={isPullingData}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPullingData ? 'animate-spin' : ''}`} />
                    <span>{isPullingData ? 'Buluttan İndiriliyor...' : 'Buluttan Verileri Yeniden Eşitle'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#e6e2d3] bg-[#FAF9F5] flex items-center justify-between text-xs text-[#737265] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Kırklareli Atatürk Ortaokulu • AkademiPanel Bulut Mimarisi</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 text-[#2d2c25] font-bold rounded-xl border border-[#e6e2d3] cursor-pointer shadow-2xs transition-colors"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
