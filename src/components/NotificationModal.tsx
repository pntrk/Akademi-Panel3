import React, { useState, useEffect } from 'react';
import { 
  Bell, BellRing, BellOff, X, Send, Sparkles, Check, Trash2, 
  ExternalLink, AlertCircle, Volume2, ShieldCheck, Clock, 
  Flame, Award, Calendar, BarChart2, Radio, Info
} from 'lucide-react';
import { AppNotification } from '../types';
import { 
  isPushNotificationSupported, 
  getPushPermissionState, 
  requestPushPermission, 
  displayBrowserNotification, 
  publishCloudNotification, 
  removeCloudNotification 
} from '../lib/notifications';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onNavigateTab: (tab: string) => void;
  currentUserEmail?: string;
  onRefresh?: () => void;
}

const TEMPLATES = [
  {
    type: 'exam_result' as const,
    label: '📊 Sınav Sonucu',
    title: 'Yeni Deneme Sınavı Sonuçları Açıklandı!',
    message: 'Son yapılan deneme sınavının netleri, puanları ve karne detayları sisteme yüklenmiştir. Sonuçlarınızı incelemek için tıklayınız.',
    linkTab: 'results' as const,
    icon: BarChart2,
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
  },
  {
    type: 'exam_created' as const,
    label: '📅 Yeni Sınav',
    title: 'Yeni Sınav Takvime Eklendi!',
    message: 'Önümüzdeki günlerde uygulanacak yeni deneme sınavı ve salon yerleşim planı güncellenmiştir.',
    linkTab: 'exams' as const,
    icon: Calendar,
    color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30'
  },
  {
    type: 'arena_update' as const,
    label: '🏆 Akademi Arena',
    title: 'Akademi Arena Lig Puanları Güncellendi!',
    message: 'Haftalık lig puan durumu, kazanılan yeni başarı rozetleri ve transferler güncellendi. Takımınızın sırasını hemen görün.',
    linkTab: 'league' as const,
    icon: Award,
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  },
  {
    type: 'announcement' as const,
    label: '📢 Genel Duyuru',
    title: 'Önemli Okul & Sınav Bilgilendirmesi',
    message: 'Öğrencilerimizin ve öğretmenlerimizin dikkatine: Lütfen duyuruyu inceleyiniz.',
    linkTab: 'results' as const,
    icon: Radio,
    color: 'text-sky-400 bg-sky-500/15 border-sky-500/30'
  }
];

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onNavigateTab,
  currentUserEmail,
  onRefresh
}) => {
  const { userRole } = useAppContext();
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox');
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  // Form State for Sending
  const [formData, setFormData] = useState({
    type: 'exam_result' as AppNotification['type'],
    title: '',
    message: '',
    targetRole: 'all' as 'all' | 'teachers' | 'students',
    targetGrade: 'Tümü',
    linkTab: 'results' as AppNotification['linkTab'],
    urgent: false
  });

  // Check current permission state on open
  useEffect(() => {
    if (isOpen) {
      setPermissionState(getPushPermissionState());
      // Mark as seen in local storage
      localStorage.setItem('last_seen_notification_ts', Date.now().toString());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const result = await requestPushPermission();
      setPermissionState(result);
      if (result === 'granted') {
        displayBrowserNotification(
          '🎉 AkademiPanel Bildirimleri Aktif!',
          'Artık yeni sınav sonuçları ve duyurular tarayıcınıza anında iletilecektir.',
          'welcome',
          'results'
        );
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestSent(true);
    await displayBrowserNotification(
      '🔔 AkademiPanel Test Bildirimi',
      'PWA anlık bildirim sistemi sorunsuz çalışıyor! Cihazınız yeni sınavlar için hazır.',
      'test-notif-' + Date.now(),
      'results'
    );
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setFormData({
      ...formData,
      type: tpl.type,
      title: tpl.title,
      message: tpl.message,
      linkTab: tpl.linkTab
    });
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      setPublishFeedback('Lütfen başlık ve mesaj giriniz.');
      return;
    }

    setIsPublishing(true);
    setPublishFeedback(null);

    try {
      const result = await publishCloudNotification({
        type: formData.type,
        title: formData.title.trim(),
        message: formData.message.trim(),
        targetRole: formData.targetRole,
        targetGrade: formData.targetGrade,
        linkTab: formData.linkTab,
        urgent: formData.urgent
      });

      if (result.success) {
        // Also trigger on current browser immediately
        displayBrowserNotification(
          formData.title.trim(),
          formData.message.trim(),
          'pub-' + Date.now(),
          formData.linkTab
        );

        setPublishFeedback(
          result.offline
            ? '✓ Bildirim kaydedildi ve push iletildi (yerel hafızada güvende, bulut ile eşitleniyor).'
            : '✓ Bildirim başarıyla yayınlandı ve tüm cihazlara push gönderildi!'
        );
        setFormData({
          type: 'exam_result',
          title: '',
          message: '',
          targetRole: 'all',
          targetGrade: 'Tümü',
          linkTab: 'results',
          urgent: false
        });

        if (onRefresh) onRefresh();
        setTimeout(() => {
          setPublishFeedback(null);
          setActiveTab('inbox');
        }, 1500);
      } else {
        setPublishFeedback('⚠️ Hata: ' + (result.error || 'Bildirim kaydedilemedi'));
      }
    } catch (err: any) {
      setPublishFeedback('⚠️ Hata: ' + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    await removeCloudNotification(id);
    if (onRefresh) onRefresh();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'exam_result':
        return <BarChart2 className="w-4 h-4 text-emerald-400" />;
      case 'exam_created':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      case 'arena_update':
        return <Award className="w-4 h-4 text-amber-400" />;
      default:
        return <Radio className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#18191c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-brand-accent/30 border border-brand-accent/40 flex items-center justify-center text-brand-accent shadow-inner">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                Anlık Bildirim & Duyuru Merkezi
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                  PWA Push
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Sınav sonuçları, arena güncellemeleri ve okul duyuruları
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Permission Status Banner */}
        <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              permissionState === 'granted' ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : 
              permissionState === 'denied' ? "bg-rose-400" : "bg-amber-400"
            )} />
            <span className="text-white/80">
              Tarayıcı İzni: {' '}
              <strong className={cn(
                permissionState === 'granted' ? "text-emerald-300" :
                permissionState === 'denied' ? "text-rose-300" : "text-amber-300"
              )}>
                {permissionState === 'granted' ? 'Açık (Bildirimler Alınıyor)' :
                 permissionState === 'denied' ? 'Engellendi (Tarayıcı Ayarlarından İzin Verin)' :
                 'Henüz İzin Verilmedi'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {permissionState !== 'granted' ? (
              <button
                onClick={handleRequestPermission}
                disabled={isRequestingPermission}
                className="px-3 py-1.5 rounded-xl bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Bell className="w-3.5 h-3.5" />
                {isRequestingPermission ? 'İzin İsteniyor...' : 'Bildirimleri Aç'}
              </button>
            ) : (
              <button
                onClick={handleSendTestNotification}
                disabled={testSent}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-brand-accent" />
                {testSent ? '✓ Gönderildi!' : 'Test Bildirimi Gönder'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-4 sm:px-5 pt-3 border-b border-white/10 bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('inbox')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer -mb-px",
              activeTab === 'inbox' 
                ? "border-brand-accent text-brand-accent" 
                : "border-transparent text-white/50 hover:text-white/80"
            )}
          >
            <Bell className="w-3.5 h-3.5" />
            Bildirim Akışı ({notifications.length})
          </button>
          
          {userRole === 'admin' && (
            <button
              onClick={() => setActiveTab('compose')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer -mb-px",
                activeTab === 'compose' 
                  ? "border-brand-accent text-brand-accent" 
                  : "border-transparent text-white/50 hover:text-white/80"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Yeni Bildirim Gönder
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'inbox' ? (
            <div>
              {notifications.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-14 h-14 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/30">
                    <Bell className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">Henüz Bildirim Yok</h3>
                  <p className="text-xs text-white/50 max-w-sm mx-auto mb-4">
                    Yeni bir sınav sonucu yüklendiğinde veya duyuru yapıldığında burada listelenecek ve cihazınıza anlık bildirim gelecektir.
                  </p>
                  {permissionState === 'granted' && (
                    <button
                      onClick={handleSendTestNotification}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white active:scale-95 transition-all cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-brand-accent" />
                      Test Bildirimi Gönder
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all relative group",
                        item.urgent 
                          ? "bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50" 
                          : "bg-white/[0.03] border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                            {getNotificationIcon(item.type)}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                            {item.title}
                          </h4>
                          {item.urgent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Acil
                            </span>
                          )}
                          {item.targetGrade && item.targetGrade !== 'Tümü' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/60 border border-white/10">
                              {item.targetGrade}. Sınıf
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-white/40 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteNotification(item.id)}
                              className="p-1 text-white/30 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer rounded-lg hover:bg-rose-500/10 ml-1"
                              title="Bildirimi Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-white/70 leading-relaxed mb-3">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                        <span className="text-white/40">
                          {item.createdByName ? `Gönderen: ${item.createdByName}` : 'Sistem Mesajı'}
                        </span>

                        {item.linkTab && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateTab(item.linkTab!);
                            }}
                            className="inline-flex items-center gap-1 text-brand-accent hover:underline font-semibold cursor-pointer"
                          >
                            İlgili Sayfaya Git
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handlePublish} className="space-y-4">
              {/* Ready Templates */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Hızlı Şablon Seçimi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-95",
                        tpl.color
                      )}
                    >
                      <tpl.icon className="w-4 h-4" />
                      <span className="text-xs font-bold leading-tight truncate">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Bildirim Başlığı *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Örn: 15. LGS Deneme Sınavı Sonuçları Açıklandı"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Mesaj Metni *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Bildirim içeriğinde kullanıcılara gösterilecek açıklama..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1">
                      Kategori
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full bg-[#202124] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-accent cursor-pointer"
                    >
                      <option value="exam_result">Sınav Sonucu</option>
                      <option value="exam_created">Yeni Sınav</option>
                      <option value="arena_update">Akademi Arena</option>
                      <option value="announcement">Duyuru</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1">
                      Hedef Sayfa
                    </label>
                    <select
                      value={formData.linkTab}
                      onChange={(e) => setFormData({ ...formData, linkTab: e.target.value as any })}
                      className="w-full bg-[#202124] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-accent cursor-pointer"
                    >
                      <option value="results">Sonuçlar & Karneler</option>
                      <option value="exams">Deneme Sınavları</option>
                      <option value="league">Akademi Arena</option>
                      <option value="students">Öğrenci Kayıtları</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1">
                      Sınıf Seviyesi
                    </label>
                    <select
                      value={formData.targetGrade}
                      onChange={(e) => setFormData({ ...formData, targetGrade: e.target.value })}
                      className="w-full bg-[#202124] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-accent cursor-pointer"
                    >
                      <option value="Tümü">Tüm Sınıflar</option>
                      <option value="8">Yalnızca 8. Sınıflar</option>
                      <option value="7">Yalnızca 7. Sınıflar</option>
                      <option value="6">Yalnızca 6. Sınıflar</option>
                      <option value="5">Yalnızca 5. Sınıflar</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="urgent-checkbox"
                    checked={formData.urgent}
                    onChange={(e) => setFormData({ ...formData, urgent: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-rose-500 focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="urgent-checkbox" className="text-xs text-white/80 cursor-pointer select-none">
                    Acil / Önemli Bildirim olarak işaretle
                  </label>
                </div>
              </div>

              {publishFeedback && (
                <div className={cn(
                  "p-3 rounded-xl text-xs font-medium animate-fade-in",
                  publishFeedback.startsWith('✓') ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-300" : "bg-rose-950/50 border border-rose-500/30 text-rose-300"
                )}>
                  {publishFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={isPublishing}
                className="w-full py-3 px-4 rounded-xl bg-brand-accent hover:bg-brand-accent/90 active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Yayınlanıyor ve Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Bildirimi Yayınla & Tüm Cihazlara Push Gönder
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
