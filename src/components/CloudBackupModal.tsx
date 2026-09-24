import React, { useState } from 'react';
import { 
  Cloud, 
  CloudDownload, 
  CloudUpload, 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  User as UserIcon, 
  X, 
  Plus, 
  Database,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { auth, firebaseConfig } from '../lib/firebase';
import { CloudBackupRecord } from '../types';

interface CloudBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    state,
    userRole, 
    syncStatus, 
    syncErrorMessage, 
    cloudBackups, 
    isLoadingBackups, 
    createCloudBackup, 
    restoreCloudBackup, 
    deleteCloudBackup, 
    saveLocalBackupToCloud,
    saveNow,
    retrySync
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'backups' | 'sync'>('backups');
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [customBackupName, setCustomBackupName] = useState('');
  const [backupNote, setBackupNote] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmRestoreBackup, setConfirmRestoreBackup] = useState<CloudBackupRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen || userRole !== 'admin') return null;

  const currentUser = auth.currentUser;
  const currentEmail = (currentUser?.email || 'bahadirkumcu@gmail.com').toLowerCase();
  const displayName = currentUser?.displayName || currentEmail.split('@')[0];

  const handleTakeBackup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsCreating(true);
    setFeedback(null);
    try {
      const res = await createCloudBackup(customBackupName, backupNote);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setCustomBackupName('');
        setBackupNote('');
        setShowCreateForm(false);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Bulut yedeği oluşturulamadı.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncingNow(true);
    setFeedback(null);
    try {
      await saveNow();
      setFeedback({ 
        type: 'success', 
        message: 'Tüm sistem verileri başarıyla bulut veritabanına eşitlendi!' 
      });
    } catch (err: any) {
      try {
        await retrySync();
        setFeedback({ 
          type: 'success', 
          message: 'Bulut bağlantısı yeniden kuruldu ve veriler başarıyla eşitlendi!' 
        });
      } catch (retryErr: any) {
        setFeedback({ 
          type: 'error', 
          message: retryErr?.message || 'Bulut ile senkronizasyon sağlanamadı. Lütfen internet bağlantınızı kontrol edin.' 
        });
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreBackup) return;
    const backupId = confirmRestoreBackup.id;
    setActionLoadingId(backupId);
    setFeedback(null);
    try {
      const res = await restoreCloudBackup(backupId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setConfirmRestoreBackup(null);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Yedek geri yüklenirken hata oluştu.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async (backupId: string) => {
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

  const handleDownloadBackupJson = (record: CloudBackupRecord) => {
    const jsonString = JSON.stringify(record.data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `BulutYedek_${safeName}_${record.createdAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      type: 'success',
      message: `"${record.name}" bulut yedeği JSON dosyası olarak cihazınıza indirildi.`
    });
  };

  const handleUploadLocalJsonToCloud = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        
        const res = await saveLocalBackupToCloud(parsed, `Yüklenen Dosya: ${fileNameWithoutExt}`);
        if (res.success) {
          setFeedback({ type: 'success', message: res.message });
        } else {
          setFeedback({ type: 'error', message: res.message });
        }
      } catch (err) {
        setFeedback({ type: 'error', message: 'Geçersiz JSON yedek dosyası seçildi.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  const isHealthy = syncStatus === 'synced';

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-[#e6e2d3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e6e2d3] bg-[#fcfbf7] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-[#B08D57] text-white flex items-center justify-center shadow-md shrink-0">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-serif font-bold text-[#343a28]">
                  Firebase Bulut Senkronizasyonu & Yedekleme
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Google Admin Yetkili
                </span>
              </div>
              <p className="text-xs text-[#8e8d82] truncate">
                Tüm verileriniz Firebase bulutunda anlık senkronize edilir ve geçmiş yedekler güvenle saklanır
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#8e8d82] hover:bg-[#e6e2d3] hover:text-[#5a5a40] rounded-full transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User & Cloud Status Strip */}
        <div className="bg-[#FAF9F5] border-b border-[#e6e2d3] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[#5a5a40]">
              <UserIcon className="w-3.5 h-3.5 text-[#B08D57]" />
              <span className="font-semibold text-xs">{displayName}</span>
              <span className="text-[#8e8d82]">({currentEmail})</span>
            </div>
            <span className="text-[#dcd8c9]">|</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-medium text-[#5a5a40]">
                {isHealthy ? 'Bulut Senkronize' : 'Yerel Hafıza Modu'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncingNow}
              className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
              {isSyncingNow ? 'Eşitleniyor...' : 'Tüm Verileri Bulutla Eşitle'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e6e2d3] bg-white px-5 shrink-0">
          <button
            onClick={() => setActiveTab('backups')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'backups' 
                ? 'border-[#B08D57] text-[#B08D57]' 
                : 'border-transparent text-[#8e8d82] hover:text-[#5a5a40]'
            }`}
          >
            <CloudDownload className="w-4 h-4" />
            <span>Bulut Yedekleri ({cloudBackups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sync' 
                ? 'border-[#B08D57] text-[#B08D57]' 
                : 'border-transparent text-[#8e8d82] hover:text-[#5a5a40]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Canlı Senkronizasyon & Tanı</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Feedback Message */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-fade-in ${
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

          {activeTab === 'backups' && (
            <div className="space-y-4">
              {/* Action Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Instant Cloud Backup Trigger */}
                <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-xs">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-[#343a28]">Firebase'e Bulut Yedeği Al</h3>
                    <p className="text-[11px] text-[#6e705b] mt-1">
                      Öğrenciler, sınavlar, sonuçlar, salonlar ve bütçeyi Firebase bulutuna anında bir yedek noktası olarak kaydeder.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(prev => !prev)}
                    className="mt-3 w-full py-2 px-3 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showCreateForm ? 'İptal Et' : 'Yeni Bulut Yedeği Al'}
                  </button>
                </div>

                {/* Upload JSON to Cloud */}
                <div className="bg-gradient-to-br from-sky-50 to-white p-4 rounded-2xl border border-sky-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center mb-2 shadow-xs">
                      <Download className="w-4 h-4 rotate-180" />
                    </div>
                    <h3 className="font-bold text-sm text-[#343a28]">Cihazdaki Yedeği Buluta Yükle</h3>
                    <p className="text-[11px] text-[#6e705b] mt-1">
                      Bilgisayarınızda veya telefonunuzda bulunan bir `.json` yedek dosyasını doğrudan Firebase bulutuna aktarın.
                    </p>
                  </div>
                  <label 
                    htmlFor="cloud-upload-input" 
                    className="mt-3 w-full py-2 px-3 bg-white hover:bg-sky-50 active:scale-[0.98] text-sky-700 border border-sky-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>JSON Seç ve Buluta Yükle</span>
                  </label>
                  <input 
                    type="file" 
                    id="cloud-upload-input" 
                    accept=".json" 
                    className="hidden" 
                    onChange={handleUploadLocalJsonToCloud} 
                  />
                </div>

                {/* Local JSON Download */}
                <div className="bg-gradient-to-br from-emerald-50 to-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-xs">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-[#343a28]">Cihaza Yedek İndir (JSON)</h3>
                    <p className="text-[11px] text-[#6e705b] mt-1">
                      Mevcut tüm verilerinizi istediğiniz zaman bilgisayarınıza veya telefonunuza yedek dosyası olarak indirin.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const fullState = {
                        version: '2.0',
                        backupDate: new Date().toISOString(),
                        ...state
                      };
                      const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `AkademiPanel_Tam_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      setFeedback({ type: 'success', message: 'Sistem yedeği cihazınıza JSON olarak indirildi.' });
                    }}
                    className="mt-3 w-full py-2 px-3 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Cihaza İndir (.json)</span>
                  </button>
                </div>
              </div>

              {/* Custom Create Backup Drawer Form */}
              {showCreateForm && (
                <form 
                  onSubmit={handleTakeBackup} 
                  className="p-4 bg-[#fcfbf7] rounded-2xl border border-[#B08D57]/40 shadow-sm space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#5a5a40] flex items-center gap-1.5">
                      <CloudUpload className="w-4 h-4 text-[#B08D57]" />
                      Firebase Bulut Yedeği Oluştur
                    </h4>
                    <span className="text-[11px] text-[#8e8d82]">
                      ({state.students?.length || 0} Öğrenci, {state.exams?.length || 0} Sınav)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e705b] mb-1">
                        Yedek Adı (İsteğe Bağlı):
                      </label>
                      <input
                        type="text"
                        value={customBackupName}
                        onChange={(e) => setCustomBackupName(e.target.value)}
                        placeholder={`Örn: 1. Dönem Sonu Yedeği`}
                        className="w-full text-xs p-2.5 bg-white border border-[#e6e2d3] rounded-xl focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6e705b] mb-1">
                        Yedek Notu (İsteğe Bağlı):
                      </label>
                      <input
                        type="text"
                        value={backupNote}
                        onChange={(e) => setBackupNote(e.target.value)}
                        placeholder="Örn: 8. sınıf LGS deneme 5 sonrası alındı"
                        className="w-full text-xs p-2.5 bg-white border border-[#e6e2d3] rounded-xl focus:outline-none focus:border-[#B08D57]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-3 py-2 text-xs font-semibold text-[#8e8d82] hover:text-[#5a5a40] cursor-pointer"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCreating ? 'animate-spin' : ''}`} />
                      {isCreating ? 'Yedek Buluta Kaydediliyor...' : 'Yedeği Buluta Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Confirm Restore Dialog */}
              {confirmRestoreBackup && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">
                        Bulut Yedeğini Geri Yüklemek Üzeresiniz
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        <strong>"{confirmRestoreBackup.name}"</strong> ({formatDate(confirmRestoreBackup.createdAt)}) tarihli yedek sisteme geri yüklenecektir. Mevcut verileriniz bu yedekteki verilerle eşitlenecek ve Firebase'e aktarılacaktır.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
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
                      {actionLoadingId === confirmRestoreBackup.id ? 'Geri Yükleniyor...' : 'Evet, Bu Yedeği Geri Yükle'}
                    </button>
                  </div>
                </div>
              )}

              {/* Cloud Backups List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#8e8d82] flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-[#B08D57]" />
                    Firebase Firestore'da Saklanan Bulut Yedekleri ({cloudBackups.length})
                  </h3>
                  {isLoadingBackups && (
                    <span className="text-[11px] text-[#8e8d82] flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Yükleniyor...
                    </span>
                  )}
                </div>

                {cloudBackups.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF9F5] rounded-2xl border border-dashed border-[#e6e2d3] space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-[#B08D57] mx-auto flex items-center justify-center">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#5a5a40]">Henüz Bulut Yedeği Alınmamış</h4>
                      <p className="text-xs text-[#8e8d82] max-w-md mx-auto mt-1">
                        Yukarıdaki <strong>"Yeni Bulut Yedeği Al"</strong> butonuna basarak ilk tam sistem yedeğinizi Firebase bulutuna kaydedebilirsiniz.
                      </p>
                    </div>
                    <button
                      onClick={() => handleTakeBackup()}
                      disabled={isCreating}
                      className="px-4 py-2 bg-[#B08D57] hover:bg-[#9c7b48] text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      İlk Bulut Yedeğini Şimdi Al
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cloudBackups.map((record) => {
                      const isConfirmingDelete = confirmDeleteId === record.id;
                      const isActionBusy = actionLoadingId === record.id;

                      return (
                        <div 
                          key={record.id}
                          className="p-4 bg-white rounded-2xl border border-[#e6e2d3] hover:border-[#B08D57]/50 transition-all shadow-xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-[#343a28]">
                                  {record.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF9F5] text-[#5a5a40] border border-[#e6e2d3]">
                                  v{record.data?.version || '2.0'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[#8e8d82] mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-[#B08D57]" />
                                  {formatDate(record.createdAt)}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <UserIcon className="w-3 h-3 text-[#B08D57]" />
                                  {record.createdByEmail}
                                </span>
                              </div>
                              {record.note && (
                                <p className="text-[11px] text-[#6e705b] italic mt-1 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 inline-block">
                                  Not: {record.note}
                                </p>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => handleDownloadBackupJson(record)}
                                className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-[#5a5a40] font-semibold rounded-xl text-xs border border-gray-200 transition-all flex items-center gap-1 cursor-pointer"
                                title="Bu yedeği JSON dosyası olarak indir"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">İndir</span>
                              </button>

                              <button
                                onClick={() => setConfirmRestoreBackup(record)}
                                disabled={isActionBusy}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200 transition-all flex items-center gap-1 cursor-pointer"
                                title="Bu yedeği sisteme geri yükle"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isActionBusy ? 'animate-spin' : ''}`} />
                                <span>Buluttan Geri Yükle</span>
                              </button>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-200">
                                  <span className="text-[10px] text-rose-700 font-bold px-1">Silinsin mi?</span>
                                  <button
                                    onClick={() => handleConfirmDelete(record.id)}
                                    disabled={isActionBusy}
                                    className="px-2 py-0.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-rose-700"
                                  >
                                    Evet
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-0.5 bg-white text-gray-700 rounded-lg text-[10px] font-semibold border cursor-pointer"
                                  >
                                    Hayır
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(record.id)}
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Bu yedeği buluttan sil"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Data Breakdown Chips */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs">
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.studentCount ?? record.data?.students?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Öğrenci</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.examCount ?? record.data?.exams?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Deneme Sınavı</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.resultCount ?? record.data?.results?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Sınav Sonucu</span>
                            </div>
                            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#e6e2d3]/70">
                              <span className="font-bold text-[#5a5a40]">{record.summary?.hallCount ?? record.data?.examHalls?.length ?? 0}</span>
                              <span className="text-[10px] text-[#8e8d82] block">Sınav Salonu</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border ${
                isHealthy 
                  ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border-emerald-200' 
                  : 'bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                    isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    {isHealthy ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#343a28]">
                      {isHealthy ? 'Bulut Senkronizasyonu Aktif ve Sorunsuz' : 'Yerel Koruma Modu'}
                    </h3>
                    <p className="text-xs text-[#6e705b] mt-0.5">
                      {isHealthy 
                        ? 'Tüm öğrenci, sınav, sonuç ve bütçe verileriniz Firebase Firestore ile anlık senkronizedir.'
                        : 'Verileriniz tarayıcınızın yerel hafızasında korunmaktadır. Aşağıdaki butondan senkronizasyonu yeniden deneyebilirsiniz.'
                      }
                    </p>
                  </div>
                </div>

                {syncErrorMessage && !isHealthy && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    <span className="font-bold block">Tanı Mesajı:</span>
                    <span>{syncErrorMessage}</span>
                  </div>
                )}
              </div>

              {/* Connection Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3.5 rounded-2xl border border-[#e6e2d3] space-y-1">
                  <span className="text-[#8e8d82] text-[11px] font-semibold">Bulut / Depolama Durumu:</span>
                  <p className="font-mono font-bold text-[#5a5a40]">{firebaseConfig.projectId || 'Yerel Mod (LocalStorage)'}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    {firebaseConfig.projectId ? 'Firestore Database: (default)' : 'Veriler ve yedekler tarayıcıda saklanır'}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-[#e6e2d3] space-y-1">
                  <span className="text-[#8e8d82] text-[11px] font-semibold">Aktif Oturum Açan Yönetici:</span>
                  <p className="font-semibold text-[#5a5a40] truncate">{currentEmail}</p>
                  <span className="text-[10px] text-[#B08D57] font-bold block">Google Kimlik Doğrulamalı</span>
                </div>
              </div>

              <div className="p-4 bg-[#fcfbf7] rounded-2xl border border-[#e6e2d3] space-y-2 text-xs">
                <h4 className="font-bold text-xs text-[#5a5a40]">Yetkili Yöneticiler (Admins):</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(state.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map((adminEmail, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-[#e6e2d3] rounded-lg text-[11px] font-semibold text-[#5a5a40] shadow-2xs"
                    >
                      {adminEmail}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  className="px-5 py-2.5 bg-[#B08D57] hover:bg-[#9c7b48] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                  {isSyncingNow ? 'Doğrulanıyor & Eşitleniyor...' : 'Şimdi Doğrula & Yeniden Eşitle'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e6e2d3] bg-[#fcfbf7] flex items-center justify-between text-xs text-[#8e8d82] shrink-0">
          <span>Akademi Panel 2 • Bulut Yedekleme & Güvenlik</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#e6e2d3] hover:bg-gray-50 text-[#5a5a40] font-bold rounded-xl cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
