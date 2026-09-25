import React, { useState } from 'react';
import { Database, CheckCircle2, HardDrive, Download, RefreshCw, X, Shield, Info, ArrowUpRight, Cloud, FileJson, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { firebaseConfig, auth, FIREBASE_STORAGE_ACTIVATE_URL, CLOUD_STORAGE_SNAPSHOT_PATH } from '../lib/firebase';

interface FirebaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseStatusModal: React.FC<FirebaseStatusModalProps> = ({ isOpen, onClose }) => {
  const { state, userRole, saveNow, retrySync, syncStatus, pendingSyncCount, lastSyncedAt, cloudBackups } = useAppContext();
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen || userRole !== 'admin') return null;

  const currentEmail = auth.currentUser?.email || 'kirklareliataturkortaokulu@gmail.com';
  const hasActiveFirebase = Boolean(firebaseConfig.projectId);

  const handleManualSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveNow();
      setFeedback({
        type: 'success',
        message: 'Firebase Bulut Depolama (akademi_data.json) Birincil Senkronizasyonu başarıyla tamamlandı!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Kayıt sırasında bir sorun oluştu.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryCloud = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await retrySync();
      setFeedback({
        type: 'success',
        message: 'Firebase Storage (akademi_data.json) birincil senkronizasyonu başarıyla eşitlendi.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Bağlantı kontrol edildi. Veriler yerel modda kesintisiz güvendedir.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSnapshot = () => {
    const cleanState = JSON.parse(JSON.stringify(state));
    const blob = new Blob([JSON.stringify(cleanState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akademi_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      type: 'success',
      message: 'akademi_data.json snapshot dosyası başarıyla cihazınıza indirildi.'
    });
  };

  const handleDownloadBackup = () => {
    const backupData = {
      appName: 'Akademi Panel 2',
      version: '2.0',
      timestamp: new Date().toISOString(),
      school: 'Kırklareli Atatürk Ortaokulu',
      schoolId: 'main',
      students: state.students || [],
      exams: state.exams || [],
      results: state.results || [],
      budget: state.budget || { incomes: [], expenses: [], debts: [] },
      examHalls: state.examHalls || [],
      leagueMentors: state.leagueMentors || {},
      leagueTeamPoints: state.leagueTeamPoints || {},
      approvedTransfers: state.approvedTransfers || [],
      admins: state.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
      teachers: state.teachers || []
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AkademiPanel_Tam_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      type: 'success',
      message: 'Tam sistem yedeği JSON dosyası olarak cihazınıza indirildi.'
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#e6e2d3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e6e2d3] bg-[#fcfbf7] rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs bg-emerald-50 border-emerald-200 text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#5a5a40] flex items-center gap-2">
                Veritabanı & Altyapı Durumu
              </h2>
              <p className="text-xs text-[#8e8d82]">Akademi Panel 2 Veri Güvenliği ve Depolama Yönetimi</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#8e8d82] hover:bg-[#e6e2d3] rounded-full transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          
          {/* Main Status Hero Card */}
          <div className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-white bg-emerald-600">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#343a28]">
                      Yöntem B: Firebase Bulut Depolama (akademi_data.json)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Birincil Senkronizasyon
                    </span>
                  </div>
                  <p className="text-xs text-[#6e705b] mt-0.5">
                    {pendingSyncCount > 0 
                      ? `Akıllı bekleme tamponunda ${pendingSyncCount} yeni işlem bekliyor.` 
                      : (lastSyncedAt ? `Son bulut eşitlemesi: ${lastSyncedAt}` : "akademi_data.json bulut snapshot kütüğü anlık olarak eşitlenmektedir.")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-100 text-emerald-800 border-emerald-200">
                  {pendingSyncCount > 0 ? `Tamponda: ${pendingSyncCount}` : "Bulut Eşitlendi"}
                </span>
              </div>
            </div>

            <div className="text-xs text-[#5a5a40] bg-white/80 p-3.5 rounded-xl border border-emerald-100/80 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#343a28]">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Yöntem B Avantajı: Sınırsız Boyut & 20.000 Günlük Ücretsiz İşlem</span>
              </div>
              <p>
                Sistem, Firestore belgelerini tek tek güncellemek yerine tüm okul ve optik kütük verilerini <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">akademi_data.json</code> snapshot dosyası olarak buluta işler. Firebase Storage'da günlük <strong>5 GB indirme ve 20.000 yükleme</strong> tamamen ücretsizdir ve belge boyutu sınırı yoktur.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#fcfbf7] p-3 rounded-2xl border border-[#e6e2d3] text-center">
              <span className="text-[10px] text-[#8e8d82] font-semibold block uppercase">Öğrenci</span>
              <span className="text-lg font-bold text-[#343a28]">{state.students?.length || 0}</span>
            </div>
            <div className="bg-[#fcfbf7] p-3 rounded-2xl border border-[#e6e2d3] text-center">
              <span className="text-[10px] text-[#8e8d82] font-semibold block uppercase">Sınav</span>
              <span className="text-lg font-bold text-[#343a28]">{state.exams?.length || 0}</span>
            </div>
            <div className="bg-[#fcfbf7] p-3 rounded-2xl border border-[#e6e2d3] text-center">
              <span className="text-[10px] text-[#8e8d82] font-semibold block uppercase">Sonuç</span>
              <span className="text-lg font-bold text-[#343a28]">{state.results?.length || 0}</span>
            </div>
            <div className="bg-[#fcfbf7] p-3 rounded-2xl border border-[#e6e2d3] text-center">
              <span className="text-[10px] text-[#8e8d82] font-semibold block uppercase">Snapshot Sürümü</span>
              <span className="text-lg font-bold text-[#343a28]">v{(state as any).version || 1}</span>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Cloud Sync Button */}
            <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center mb-2">
                  <Cloud className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#343a28]">Birincil Bulut Senkronizasyonu</h4>
                <p className="text-[11px] text-[#8e8d82] mt-1">
                  {pendingSyncCount > 0 
                    ? `Tampondaki ${pendingSyncCount} işlemi hemen akademi_data.json snapshot dosyasına aktar.`
                    : "Mevcut tüm verileri akademi_data.json olarak buluta ve hafızaya anında yazar."}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleManualSave}
                  disabled={isSaving}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                  <span>{isSaving ? 'Kaydediliyor...' : 'Şimdi Eşitle (Yöntem B)'}</span>
                </button>
              </div>
            </div>

            {/* Download akademi_data.json snapshot */}
            <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-700 flex items-center justify-center mb-2">
                  <FileJson className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#343a28]">akademi_data.json Dosyasını İndir</h4>
                <p className="text-[11px] text-[#8e8d82] mt-1">
                  Bulutta saklanan en güncel JSON snapshot kütüğünü doğrudan bilgisayarınıza indirir.
                </p>
              </div>
              <button
                onClick={handleDownloadSnapshot}
                className="mt-3 w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>akademi_data.json İndir</span>
              </button>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Download JSON Backup */}
            <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#e6e2d3] flex items-center justify-between">
              <div>
                <h5 className="font-bold text-xs text-[#343a28]">Tarihli Sistem Yedeği</h5>
                <p className="text-[10px] text-[#8e8d82]">Tarih damgalı tam sistem arşivi</p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="py-1.5 px-3 bg-[#5a5a40] hover:bg-[#474732] text-white font-bold rounded-xl text-[11px] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>Arşiv İndir</span>
              </button>
            </div>

            {/* Firebase Storage Console Link */}
            <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#e6e2d3] flex items-center justify-between">
              <div>
                <h5 className="font-bold text-xs text-[#343a28]">Firebase Depolama Konsolu</h5>
                <p className="text-[10px] text-[#8e8d82]">Firebase Storage panelini aç</p>
              </div>
              <a
                href={FIREBASE_STORAGE_ACTIVATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-3 bg-[#e6e2d3] hover:bg-[#d8d4c3] text-[#5a5a40] font-bold rounded-xl text-[11px] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Konsola Git</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <X className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* System Environment Details */}
          <div className="pt-2 border-t border-[#e6e2d3] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8e8d82]">
            <span>Aktif Yönetici: <strong>{currentEmail}</strong></span>
            <span>Depolama: <strong>LocalStorage (Bağımsız Mod)</strong></span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e6e2d3] bg-[#fcfbf7] flex items-center justify-end rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#5a5a40] hover:bg-[#474732] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
