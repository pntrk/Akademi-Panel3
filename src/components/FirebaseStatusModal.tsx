import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, RefreshCw, Copy, Check, ExternalLink, X, Database, CloudCheck, HardDrive, ArrowUpRight, ChevronDown, ChevronUp, CloudUpload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { firebaseConfig, auth } from '../lib/firebase';

interface FirebaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseStatusModal: React.FC<FirebaseStatusModalProps> = ({ isOpen, onClose }) => {
  const { state, syncStatus, syncErrorMessage, retrySync, saveNow, userRole, cloudBackups, createCloudBackup } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRulesGuide, setShowRulesGuide] = useState(syncStatus !== 'synced');

  // When modal opens, if it was in error or quota state, automatically attempt a reconnection check
  useEffect(() => {
    if (isOpen && userRole === 'admin') {
      setFeedback(null);
      if (syncStatus !== 'synced') {
        setShowRulesGuide(true);
        handleSyncCheck();
      } else {
        setShowRulesGuide(false);
      }
    }
  }, [isOpen, userRole]);

  if (!isOpen || userRole !== 'admin') return null;

  const currentEmail = auth.currentUser?.email || 'bahadirkumcu@gmail.com';

  const recommendedRules = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    // Central school database: students, exams, results, academy arena, halls, budget
    match /schools/{schoolId} {
      allow read, write: if isSignedIn();

      // Cloud backups snapshot collection
      match /backups/{backupId} {
        allow read, write, delete: if isSignedIn();
      }
    }

    // Top-level backups collection (fallback)
    match /backups/{backupId} {
      allow read, write, delete: if isSignedIn();
    }

    // Access authorization requests
    match /access_requests/{requestId} {
      allow read, write, delete: if isSignedIn();
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(recommendedRules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTakeCloudBackup = async () => {
    setIsBackingUp(true);
    setFeedback(null);
    try {
      const res = await createCloudBackup();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Bulut yedeği oluşturulamadı.'
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSyncCheck = async () => {
    setIsRetrying(true);
    setFeedback(null);
    try {
      await retrySync();
      setFeedback({
        type: 'success',
        message: 'Bulut bağlantısı başarıyla doğrulandı ve tüm veriler Firebase ile eşitlendi!'
      });
      setShowRulesGuide(false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Bulut bağlantısı kurulamadı. Verileriniz yerel hafızada güvendedir.'
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDownloadBackup = () => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
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

  const isHealthy = syncStatus === 'synced';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#e6e2d3] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e6e2d3] bg-[#fcfbf7] rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-xs ${
              isHealthy 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#5a5a40] flex items-center gap-2">
                Bulut Senkronizasyonu & Firebase Durumu
              </h2>
              <p className="text-xs text-[#8e8d82]">Akademi Panel 2 Veritabanı ve Canlı Yedekleme</p>
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
          <div className={`p-5 rounded-2xl border transition-all ${
            isHealthy 
              ? 'bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 border-emerald-200' 
              : 'bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 border-amber-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                {isHealthy ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-[#343a28]">
                    {isHealthy 
                      ? "Canlı Bulut Senkronizasyonu Aktif" 
                      : syncStatus === 'quota_exceeded' 
                        ? "Yerel Koruma Modu (Bulut Kotası)" 
                        : "Yerel Koruma Modu (Bulut Bağlantısı Bekleniyor)"
                    }
                  </h3>
                  <p className="text-xs text-[#6e705b]">
                    {isHealthy 
                      ? "Tüm verileriniz anlık olarak Firebase veritabanı ile eşitlenmektedir."
                      : "Verileriniz tarayıcınızın yerel hafızasında kesintisiz olarak korunmaktadır."
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isHealthy 
                    ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200' 
                    : 'bg-amber-100/90 text-amber-800 border-amber-200'
                }`}>
                  {isHealthy ? "● Çevrimiçi / Eşitlendi" : "● Yerel Koruma"}
                </span>
              </div>
            </div>

            {/* Connection Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
              <div className="bg-white/90 p-3 rounded-xl border border-[#e6e2d3] shadow-xs">
                <span className="text-[#8e8d82] block text-[11px] font-medium">Veritabanı Durumu:</span>
                <span className="font-mono font-bold text-[#5a5a40] text-xs">
                  {firebaseConfig.projectId ? firebaseConfig.projectId : 'Bağımsız Yerel Mod'}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                  {firebaseConfig.projectId ? '(Firebase Bağlı)' : '(Firebase bağımlılıkları kaldırıldı - LocalStorage)'}
                </span>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-[#e6e2d3] shadow-xs">
                <span className="text-[#8e8d82] block text-[11px] font-medium">Yetkili Yönetici Hesabı:</span>
                <span className="font-semibold text-[#5a5a40] truncate block text-xs">
                  {currentEmail}
                </span>
                <span className="text-[10px] text-brand-accent font-bold block mt-0.5">
                  Süper Yönetici İzni Aktif
                </span>
              </div>
            </div>

            {/* If error message exists */}
            {syncErrorMessage && !isHealthy && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Tanı Mesajı:</span>
                  <span className="leading-relaxed">{syncErrorMessage}</span>
                </div>
              </div>
            )}
          </div>

          {/* Synced Data Summary Metrics */}
          <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-[#e6e2d3] space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8e8d82]">
                Eşitlenen Sistem Verileri (6 Modül)
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" /> Tam Kapsam
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-[#e6e2d3]/80">
                <span className="text-lg font-bold text-[#5a5a40] block">{state.students?.length || 0}</span>
                <span className="text-[11px] text-[#8e8d82]">Öğrenci</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#e6e2d3]/80">
                <span className="text-lg font-bold text-[#5a5a40] block">{state.exams?.length || 0}</span>
                <span className="text-[11px] text-[#8e8d82]">Deneme Sınavı</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#e6e2d3]/80">
                <span className="text-lg font-bold text-[#5a5a40] block">{state.results?.length || 0}</span>
                <span className="text-[11px] text-[#8e8d82]">Sınav Sonucu</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-[#e6e2d3]/80">
                <span className="text-lg font-bold text-[#5a5a40] block">{state.examHalls?.length || 0}</span>
                <span className="text-[11px] text-[#8e8d82]">Sınav Salonu</span>
              </div>
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <button
              onClick={handleSyncCheck}
              disabled={isRetrying}
              className="w-full sm:flex-1 py-3 px-4 bg-[#B08D57] hover:bg-[#9c7b48] active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Bulut Senkronizasyonu Doğrulanıyor...' : 'Şimdi Senkronize Et & Doğrula'}
            </button>

            <button
              onClick={handleTakeCloudBackup}
              disabled={isBackingUp}
              className="w-full sm:w-auto py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className={`w-4 h-4 ${isBackingUp ? 'animate-spin' : ''}`} />
              {isBackingUp ? 'Yedek Alınıyor...' : `Buluta Yedek Al (${cloudBackups.length})`}
            </button>

            <button
              onClick={handleDownloadBackup}
              className="w-full sm:w-auto py-3 px-4 bg-white hover:bg-[#f5f3eb] active:scale-[0.99] text-[#5a5a40] font-bold rounded-xl text-xs border border-[#e6e2d3] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              JSON İndir
            </button>
          </div>

          {/* Collapsible Rules & Setup Section */}
          <div className="pt-2 border-t border-[#e6e2d3]">
            <button
              onClick={() => setShowRulesGuide(!showRulesGuide)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#8e8d82] hover:text-[#5a5a40] py-1 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Firebase Güvenlik Kuralları & Kurulum Detayı
              </span>
              {showRulesGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showRulesGuide && (
              <div className="mt-3 p-4 bg-gray-50 border border-[#e6e2d3] rounded-2xl space-y-3 animate-fade-in text-xs">
                <p className="text-[#6e705b] leading-relaxed">
                  Firebase Console üzerinde Firestore veritabanınızın kurallarının aşağıdaki şekilde yapılandırıldığından emin olabilirsiniz:
                </p>

                <div className="relative">
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="text-[11px] font-bold text-[#5a5a40]">firestore.rules</span>
                    <button
                      onClick={handleCopyRules}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold border border-[#e6e2d3] flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Kopyalandı!' : 'Kuralları Kopyala'}
                    </button>
                  </div>
                  <pre className="bg-[#1e1e1e] text-emerald-300 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-44 border border-black/10">
                    {recommendedRules}
                  </pre>
                </div>

                {firebaseConfig.projectId ? (
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-[#8e8d82]">Konsol üzerinden kuralları yönetmek için:</span>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                    >
                      Firebase Console'u Aç <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="pt-1 text-[11px] text-[#8e8d82]">
                    İleride yeni Firebase projesi oluşturduğunuzda Firestore Console bağlantısı burada görüntülenecektir.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
