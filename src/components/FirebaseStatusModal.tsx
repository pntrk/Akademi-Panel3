import React, { useState } from 'react';
import { Database, CheckCircle2, HardDrive, Download, RefreshCw, X, Shield, Info, ArrowUpRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { firebaseConfig, auth } from '../lib/firebase';

interface FirebaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseStatusModal: React.FC<FirebaseStatusModalProps> = ({ isOpen, onClose }) => {
  const { state, userRole, saveNow, cloudBackups } = useAppContext();
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
        message: 'Tüm okul verileri cihazın güvenli yerel hafızasına (LocalStorage) başarıyla kaydedildi.'
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
          <div className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 border-emerald-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#343a28]">
                    {hasActiveFirebase ? "Bulut Senkronizasyonu Aktif" : "Bağımsız Yerel Çalışma Modu (Güvenli)"}
                  </h3>
                  <p className="text-xs text-[#6e705b]">
                    {hasActiveFirebase 
                      ? "Verileriniz bağlı Firebase projesiyle anlık eşitlenmektedir." 
                      : "Eski Firebase bağlantısı tamamen kaldırıldı; veriler bu cihazda güvenle saklanmaktadır."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {hasActiveFirebase ? "Firebase Bağlı" : "Yerel Mod Aktif"}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5a5a40] bg-white/80 p-3 rounded-xl border border-emerald-100 leading-relaxed">
              Önceki Firebase projesiyle olan tüm bağımlılıklar, güvenlik kuralları ve yetkilendirme kodları çakışmaları önlemek için sıfırlandı. Yeni bir Firebase projesi oluşturduğunuzda hiçbir çakışma olmadan sıfırdan ve temiz bir şekilde bağlanacaktır.
            </p>
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
              <span className="text-[10px] text-[#8e8d82] font-semibold block uppercase">Kayıtlı Yedek</span>
              <span className="text-lg font-bold text-[#343a28]">{cloudBackups?.length || 0}</span>
            </div>
          </div>

          {/* New Firebase Integration Notice */}
          <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#e6e2d3] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#343a28]">
              <Info className="w-4 h-4 text-brand-accent shrink-0" />
              <span>Yeni Firebase Projesi Bağlantısı Hakkında</span>
            </div>
            <p className="text-xs text-[#6e705b] leading-relaxed">
              Yeni bir Firebase projesi kurmak istediğinizde, sohbet ekranından <strong>"Yeni Firebase projemi bağla"</strong> demeniz yeterlidir. Sistem yeni projenin kimlik ve veritabanı ayarlarını sıfırdan kuracaktır. Şu an hiçbir eski projeye ağ çağrısı veya veri gönderimi yapılmamaktadır.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Download JSON Backup */}
            <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
                  <Download className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#343a28]">Cihaza Tam Yedek İndir (JSON)</h4>
                <p className="text-[11px] text-[#8e8d82] mt-1">
                  Tüm öğrenci, sınav, sonuç ve salon verilerini içeren bağımsız yedek dosyası oluşturur.
                </p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="mt-3 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON Yedeği İndir</span>
              </button>
            </div>

            {/* Force Save Local */}
            <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-2">
                  <HardDrive className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#343a28]">Yerel Hafızayı Eşitle</h4>
                <p className="text-[11px] text-[#8e8d82] mt-1">
                  Mevcut tüm değişiklikleri tarayıcının yerel hafızasına zorla yazarak günceller.
                </p>
              </div>
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="mt-3 w-full py-2 px-3 bg-[#5a5a40] hover:bg-[#474732] text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Kaydediliyor...' : 'Şimdi Kaydet'}</span>
              </button>
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
