import React, { useState, useEffect } from 'react';
import { 
  Download, ExternalLink, Copy, Check, Globe, Smartphone, 
  Monitor, ShieldCheck, Zap, Share, PlusSquare, X, 
  HardDriveDownload, Sparkles, QrCode, CheckCircle2,
  ArrowRight, Phone, Laptop
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AppHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppHubModal: React.FC<AppHubModalProps> = ({ isOpen, onClose }) => {
  const { isInstalled, isIOS, isAndroid, canPromptDirectly, installPWA } = usePWAInstall();
  
  const DEFAULT_VERCEL_URL = 'https://akademipanel3.vercel.app/';
  const [vercelUrl, setVercelUrl] = useState<string>(() => {
    const saved = localStorage.getItem('akademiVercelUrl');
    if (!saved || saved.includes('akademi-panel2-nop7') || saved === 'https://akademipanel.vercel.app') {
      return DEFAULT_VERCEL_URL;
    }
    return saved;
  });
  const [copied, setCopied] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [inputUrl, setInputUrl] = useState(vercelUrl);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [isSharingIOS, setIsSharingIOS] = useState(false);

  // Otomatik tespit edilen cihaza göre varsayılan sekme
  const [deviceTab, setDeviceTab] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) return 'ios';
      if (/android/.test(ua)) return 'android';
    }
    return 'android';
  });

  useEffect(() => {
    setInputUrl(vercelUrl);
  }, [vercelUrl]);

  useEffect(() => {
    if (isIOS) setDeviceTab('ios');
    else if (isAndroid) setDeviceTab('android');
  }, [isIOS, isAndroid]);

  if (!isOpen) return null;

  // 1. Android / Chrome Tek Tıkla Kurulum İşleyicisi
  const handleAndroidInstall = async () => {
    try {
      const installed = await installPWA();
      if (installed) {
        setInstallFeedback('✓ Uygulama başarıyla cihazınıza yüklendi!');
        setTimeout(() => setInstallFeedback(null), 4000);
      } else {
        // Eğer tarayıcı yerel prompt'u hazır değilse kullanıcıyı yönlendir
        setInstallFeedback('Bilgi: Chrome menüsünden (⋮) "Uygulamayı Yükle" veya "Ana Ekrana Ekle"ye dokunun.');
        setTimeout(() => setInstallFeedback(null), 6000);
      }
    } catch {
      setInstallFeedback('Kurulum başlatılamadı. Lütfen Chrome menüsünden ekleyin.');
      setTimeout(() => setInstallFeedback(null), 4000);
    }
  };

  // 2. iOS iPhone Paylaş Menüsünü Tetikleme (Web Share API ile https://akademipanel3.vercel.app/ paylaşımı)
  const handleIOSShareTrigger = async () => {
    setIsSharingIOS(true);
    const targetShareUrl = vercelUrl || DEFAULT_VERCEL_URL;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'AkademiPanel',
          text: 'AkademiPanel • Sınav & Ölçme Değerlendirme Sistemi',
          url: targetShareUrl
        });
        setInstallFeedback('Paylaşım menüsü açıldı. Lütfen "Ana Ekrana Ekle"yi seçin.');
      } else {
        await navigator.clipboard.writeText(targetShareUrl);
        setInstallFeedback('Canlı Vercel linki kopyalandı! Safari altındaki Paylaş butonuna dokunup "Ana Ekrana Ekle"yi seçin.');
      }
    } catch {
      // Kullanıcı iptal ettiğinde sessizce geç
    } finally {
      setIsSharingIOS(false);
      setTimeout(() => setInstallFeedback(null), 5000);
    }
  };

  const handleCopyLink = () => {
    const targetUrl = vercelUrl || DEFAULT_VERCEL_URL;
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUrl = () => {
    let formatted = inputUrl.trim();
    if (formatted && !formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    if (formatted) {
      setVercelUrl(formatted);
      localStorage.setItem('akademiVercelUrl', formatted);
      setIsEditingUrl(false);
    }
  };

  const openVercelLink = () => {
    window.open(vercelUrl || DEFAULT_VERCEL_URL, '_blank', 'noopener,noreferrer');
  };

  // QR Kod URL'si (Masaüstünden telefona aktarma için doğrudan Vercel Canlı linkini kullanır)
  const targetAppUrl = vercelUrl || DEFAULT_VERCEL_URL;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(targetAppUrl)}&bgcolor=0f172a&color=ffffff&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <header className="p-3.5 sm:p-5 pb-3 sm:pb-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 via-sky-600 to-amber-500 p-0.5 shadow-lg shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] sm:rounded-[14px] flex items-center justify-center overflow-hidden">
                <img src="/apple-touch-icon.png" alt="AkademiPanel" className="w-8 h-8 sm:w-9 sm:h-9 object-cover rounded-lg" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Cihaza Yükle
                </h3>
                <span className="text-[9.5px] sm:text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  PWA Mobil
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                iPhone, Android ve Masaüstü için tek tıkla kurulum
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* MODAL BODY (MOBİL OPTİMİZE EDİLMİŞ BÖLÜM - CSS SELEKTÖR HEDEFİ) */}
        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto overscroll-contain flex-1">
          
          {/* Durum Bildirimi / Toast */}
          {installFeedback && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{installFeedback}</span>
            </div>
          )}

          {/* Cihaz Durumu: Halihazırda Yüklü İse Tebrik Rozeti */}
          {isInstalled && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>Uygulama Modu Aktif</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-mono">✓ Yüklü</span>
                </div>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  AkademiPanel şu an cihazınızda tam ekran native mobil uygulama modunda çalışıyor.
                </p>
              </div>
            </div>
          )}

          {/* CİHAZ SEÇİM SEKMELERİ (Dokunmatik segmented kontrol) */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setDeviceTab('android')}
              className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                deviceTab === 'android'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
              <span>Android</span>
            </button>

            <button
              type="button"
              onClick={() => setDeviceTab('ios')}
              className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                deviceTab === 'ios'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span>iPhone (iOS)</span>
            </button>

            <button
              type="button"
              onClick={() => setDeviceTab('desktop')}
              className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                deviceTab === 'desktop'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-indigo-300" />
              <span>PC & Masaüstü</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* SEKME 1: ANDROID KURULUM PANELİ (TEK TIKLA YÜKLE)          */}
          {/* ======================================================== */}
          {deviceTab === 'android' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-slate-950 border border-emerald-500/25 rounded-2xl space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Android / Google Chrome
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        APK indirmeden, Play Store beklemeden doğrudan yükleyin
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Tek Tıkla
                  </span>
                </div>

                {/* Ana Aksiyon Butonu */}
                <button
                  type="button"
                  onClick={handleAndroidInstall}
                  className="w-full min-h-[48px] py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation"
                >
                  <Download className="w-4 h-4" />
                  <span>Android Cihaza Tek Tıkla Yükle</span>
                </button>

                {/* Android Hızlı Alternatif Kılavuzu */}
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-300">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Buton yanıt vermezse:</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed pl-3">
                    Chrome sağ üstündeki <strong>(⋮) menüye</strong> dokunun ve <strong>"Uygulamayı Yükle"</strong> ya da <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin.
                  </p>
                </div>
              </div>

              {/* Avantajlar Şeridi */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-emerald-400 font-bold">⚡ Tam Ekran</div>
                  <div className="text-slate-400 text-[9px] mt-0.5">Adres çubuğu yok</div>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-sky-400 font-bold">🔔 Bildirimler</div>
                  <div className="text-slate-400 text-[9px] mt-0.5">Kilit ekranında</div>
                </div>
                <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-amber-400 font-bold">📶 Çevrimdışı</div>
                  <div className="text-slate-400 text-[9px] mt-0.5">Kesintisiz erişim</div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEKME 2: IPHONE & IPAD (iOS SAFARI) KURULUM REHBERİ      */}
          {/* ======================================================== */}
          {deviceTab === 'ios' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/25 rounded-2xl space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        iPhone & iPad (Safari)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        App Store'a gerek kalmadan ana ekranınıza ekleyin
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                    10 Saniye
                  </span>
                </div>

                {/* iPhone Tek Dokunuş Paylaşım Tetikleyicisi */}
                <button
                  type="button"
                  onClick={handleIOSShareTrigger}
                  disabled={isSharingIOS}
                  className="w-full min-h-[48px] py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-[0.99] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer touch-manipulation disabled:opacity-50"
                >
                  <Share className="w-4 h-4" />
                  <span>iPhone Paylaşım Menüsünü Aç</span>
                </button>

                {/* Adım Adım Görsel İpuçları */}
                <div className="space-y-2 bg-slate-950/90 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                    <div>
                      Safari'nin alt araç çubuğundaki <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 inline-flex items-center gap-1"><Share className="w-3 h-3 text-sky-400 inline" /> Paylaş</span> butonuna dokunun.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                    <div>
                      Açılan menüyü hafifçe kaydırıp <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 inline-flex items-center gap-1"><PlusSquare className="w-3 h-3 text-emerald-400 inline" /> Ana Ekrana Ekle</span> seçeneğine dokunun.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                    <div>
                      Sağ üst köşedeki <strong>"Ekle"</strong> butonuna basın.
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10.5px] text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    İşlem tamamlandığında AkademiPanel ikonu iPhone ana ekranınıza gelir ve tam ekran uygulama modunda açılır.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEKME 3: MASAÜSTÜ & QR KOD İLE TELEFONA YÜKLEME           */}
          {/* ======================================================== */}
          {deviceTab === 'desktop' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <Monitor className="w-4 h-4 text-indigo-400" />
                    <span>Masaüstü & Telefon QR Kodu</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Chrome / Edge</span>
                </div>

                {canPromptDirectly && (
                  <button
                    type="button"
                    onClick={handleAndroidInstall}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Bu Bilgisayara Uygulama Olarak Yükle</span>
                  </button>
                )}

                {/* QR Kod ile Telefon Kamerasından Yükleme */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3.5">
                  <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center justify-center shrink-0">
                    <img 
                      src={qrCodeUrl} 
                      alt="Mobil Yükleme QR Kodu" 
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                      <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Kamera ile Doğrudan Yükle</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      iPhone veya Android telefonunuzun kamerasını bu koda doğrultun; uygulama hemen açılır ve tek tıkla yükleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VERCEL CANLI YAYIN BAĞLANTISI (KOPYALAMA & AÇMA) */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                Vercel Canlı Yayın Linki
              </span>
              <button 
                type="button"
                onClick={() => setIsEditingUrl(!isEditingUrl)}
                className="text-[10px] text-sky-400 hover:underline font-semibold cursor-pointer"
              >
                {isEditingUrl ? 'Vazgeç' : 'Düzenle'}
              </button>
            </div>

            {isEditingUrl ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://akademipanel3.vercel.app/"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                />
                <button 
                  type="button"
                  onClick={handleSaveUrl}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 border border-slate-800/80 rounded-xl min-w-0">
                <span className="text-[11px] font-mono text-sky-300 truncate font-semibold select-all">
                  {vercelUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all cursor-pointer shrink-0"
                  title="Bağlantıyı Kopyala"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={openVercelLink}
              className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>Vercel Canlı Arayüzünü Aç</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            </button>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <footer className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 text-slate-400 truncate">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">AkademiPanel • PWA Mobil Kurulum</span>
          </span>
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition-colors shrink-0"
          >
            Kapat
          </button>
        </footer>

      </div>
    </div>
  );
};
