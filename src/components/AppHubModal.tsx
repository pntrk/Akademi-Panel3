import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, Copy, Check, Globe, Smartphone, Monitor, ShieldCheck, Zap, Share, PlusSquare, X, HardDriveDownload, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AppHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppHubModal: React.FC<AppHubModalProps> = ({ isOpen, onClose }) => {
  const { isInstalled, isIOS, canPromptDirectly, installPWA } = usePWAInstall();
  
  const DEFAULT_VERCEL_URL = 'https://akademi-panel2-nop7.vercel.app/';
  const [vercelUrl, setVercelUrl] = useState<string>(() => {
    return localStorage.getItem('akademiVercelUrl') || DEFAULT_VERCEL_URL;
  });
  const [copied, setCopied] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [inputUrl, setInputUrl] = useState(vercelUrl);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  useEffect(() => {
    setInputUrl(vercelUrl);
  }, [vercelUrl]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const installed = await installPWA();
    if (installed) {
      setInstallFeedback('Uygulama başarıyla cihazınıza yüklendi!');
      setTimeout(() => setInstallFeedback(null), 4000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(vercelUrl);
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
    window.open(vercelUrl, '_blank', 'noopener,noreferrer');
  };

  // Device type helper
  const getDeviceLabel = () => {
    if (isInstalled) return { text: 'Uygulama Modu (Cihaza Yüklü)', icon: ShieldCheck, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (isIOS) return { text: 'iOS (iPhone / iPad)', icon: Smartphone, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
    if (canPromptDirectly) return { text: 'Android / Masaüstü (PWA Hazır)', icon: Zap, color: 'text-sky-300 bg-sky-500/10 border-sky-500/20' };
    return { text: 'Masaüstü Web Tarayıcısı', icon: Monitor, color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' };
  };

  const device = getDeviceLabel();
  const DeviceIcon = device.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-5 pb-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-sky-600 to-amber-500 p-0.5 shadow-xl shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                <img src="/icon.svg" alt="AkademiPanel" className="w-8 h-8 object-contain" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Uygulama & Vercel
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-semibold">
                  v2.0 Canlı
                </span>
              </h3>
              <p className="text-xs text-slate-400">Cihaza yükleme ve Vercel canlı bulut erişimi</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Automatic Device Detection Badge */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl border ${device.color} shrink-0`}>
                <DeviceIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Algılanan Cihaz</span>
                <span className="text-xs font-bold text-white truncate block">{device.text}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
              Otomatik Uyumlu
            </span>
          </div>

          {installFeedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{installFeedback}</span>
            </div>
          )}

          {/* Dynamic Direct Install Section */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <HardDriveDownload className="w-4 h-4 text-emerald-400" />
                Cihaza Yükleme (PWA)
              </h4>
              <span className="text-[10px] text-slate-400">Çevrimdışı & Tam Ekran</span>
            </div>

            {/* App Icon Info Card */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-slate-950 border border-slate-700/70 p-1 shadow-sm shrink-0 flex items-center justify-center">
                <img src="/pwa-192x192.png" alt="AkademiPanel Logosu" className="w-full h-full object-contain rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">AkademiPanel Simgesi</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold">Özel İkon</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Uygulama telefon veya bilgisayarınıza bu resmi simge görseli ile kurulur.
                </p>
              </div>
            </div>

            {isInstalled ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Uygulama cihazınızda zaten yüklü ve aktif!</span>
              </div>
            ) : canPromptDirectly ? (
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.99] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Cihazıma Hemen Yükle</span>
              </button>
            ) : isIOS ? (
              <div className="space-y-2 text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <p className="font-semibold text-amber-300 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> iOS Kurulum Rehberi:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                  <li>Safari menüsündeki <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded"><Share className="w-3 h-3 inline text-sky-400" /> Paylaş</span> ikonuna dokunun.</li>
                  <li>Açılan listeden <span className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded"><PlusSquare className="w-3 h-3 inline text-emerald-400" /> Ana Ekrana Ekle</span> seçeneğini tıklayın.</li>
                </ol>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
              >
                <Monitor className="w-4 h-4 text-sky-400" />
                <span>Masaüstüne Yükle (Tarayıcı İslemi)</span>
              </button>
            )}
          </div>

          {/* Vercel Live Link Section */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                Vercel Canlı Yayın Linki
              </span>
              <button 
                onClick={() => setIsEditingUrl(!isEditingUrl)}
                className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer"
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
                  placeholder="https://akademi-panel2-nop7.vercel.app/"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <button 
                  onClick={handleSaveUrl}
                  className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl min-w-0">
                <span className="text-xs font-mono text-sky-300 truncate font-semibold">{vercelUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all cursor-pointer shrink-0"
                  title="Bağlantıyı Kopyala"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <button
              onClick={openVercelLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>Vercel Canlı Arayüzünü Aç</span>
              <ExternalLink className="w-4 h-4 text-white" />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AkademiPanel • PWA & Vercel
          </span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer transition-colors"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
