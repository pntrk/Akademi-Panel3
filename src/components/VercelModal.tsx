import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Globe, Sparkles, X, Rocket, Terminal, Layers } from 'lucide-react';

interface VercelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VercelModal: React.FC<VercelModalProps> = ({ isOpen, onClose }) => {
  const [vercelUrl, setVercelUrl] = useState<string>(() => {
    return localStorage.getItem('akademiVercelUrl') || 'https://akademipanel.vercel.app';
  });
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState(vercelUrl);
  const [copied, setCopied] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  useEffect(() => {
    setInputUrl(vercelUrl);
  }, [vercelUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(vercelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveUrl = () => {
    let formatted = inputUrl.trim();
    if (formatted && !formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    if (formatted) {
      setVercelUrl(formatted);
      localStorage.setItem('akademiVercelUrl', formatted);
      setIsEditing(false);
      setSavedFeedback('Vercel linki başarıyla güncellendi!');
      setTimeout(() => setSavedFeedback(null), 3000);
    }
  };

  const openVercelLink = () => {
    window.open(vercelUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black border border-slate-700 flex items-center justify-center shadow-lg shrink-0">
              {/* Official Vercel Logo SVG */}
              <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Vercel Canlı Yayın Arayüzü
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-semibold">
                  Sıfır Kesinti
                </span>
              </h3>
              <p className="text-xs text-slate-400">Bulut erişimi ve tek tıkla Vercel canlı dağıtımı</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {savedFeedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{savedFeedback}</span>
            </div>
          )}

          {/* Vercel Live Link Box */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                Vercel Yayın Adresi
              </span>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer"
              >
                {isEditing ? 'Vazgeç' : 'Adresi Düzenle'}
              </button>
            </div>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://projeniz.vercel.app"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <button 
                  onClick={handleSaveUrl}
                  className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Kaydet
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl min-w-0">
                <span className="text-xs font-mono text-sky-300 truncate tracking-tight">{vercelUrl}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                    title="Bağlantıyı Kopyala"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Main Open Link Action */}
            <button
              onClick={openVercelLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>Vercel Canlı Arayüzünü Aç</span>
              <ExternalLink className="w-4 h-4 text-slate-900" />
            </button>
          </div>

          {/* Vercel Deployment Instructions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-amber-400" />
              Kendi Vercel Projenize Dağıtın
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Vercel CLI
                </span>
                <p className="text-[11px] font-mono text-slate-400">npx vercel --prod</p>
              </div>
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" /> vercel.json
                </span>
                <p className="text-[11px] text-slate-400">SPA yönlendirme kuralı hazır yerleşik.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Vercel V8 Motoru & Global CDN
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
