import React, { useState, useMemo } from 'react';
import { 
  Crown, TrendingUp, Shield, Sparkles, BookOpen, Award, Target, 
  Flame, Compass, Search, X, CheckCircle2, Zap, Star
} from 'lucide-react';

export default function RulesView() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = [
    { id: 'all', label: 'Tüm Kurallar & Rozetler' },
    { id: 'teams', label: 'Takım Barajları' },
    { id: 'basic', label: 'Temel Rozetler' },
    { id: 'team_specific', label: 'Takıma Özel Rozetler' },
    { id: 'mastery', label: 'Uzmanlık Rozetleri' },
    { id: 'legendary', label: 'Efsanevi Rozetler' },
    { id: 'branch', label: 'Branş Efsaneleri' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in font-sans">
      <div className="bg-white border border-brand-border/80 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xs space-y-6">
        
        {/* Header Summary */}
        <div className="border-b border-brand-border/60 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 font-bold shadow-2xs">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-brand-ink">
                  Akademi Arena Kılavuzu & Rozet Rehberi
                </h2>
                <p className="text-xs sm:text-sm text-brand-ink/60 mt-0.5">
                  Öğrenci puanlama barajları, lig puanı (LP) dinamikleri ve kazanılabilir rozet kriterleri.
                </p>
              </div>
            </div>

            {/* Arama */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-brand-ink/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rozet veya kural ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#FAF9F6] border border-brand-border/80 rounded-xl text-xs font-medium text-brand-ink placeholder:text-brand-ink/40 focus:outline-none focus:border-brand-accent shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-brand-ink/40 hover:text-brand-ink"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Kategori Filtreleri */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar mt-4 pt-3 border-t border-brand-border/40">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-[#151618] text-white shadow-2xs'
                    : 'bg-[#FAF9F6] text-brand-ink/70 hover:bg-[#F2EFE9] border border-brand-border/60'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Takım Kriterleri */}
        {(activeCategory === 'all' || activeCategory === 'teams') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Takım Kriterleri (Ortalama Puan Barajları)
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-950">Kutup Yıldızları</p>
                  <p className="text-xs font-semibold text-amber-700 mt-0.5">400+ Puan Barajı</p>
                  <p className="text-[11px] text-amber-900/60 mt-0.5">Zirve Ligi • Yüksek hedefler</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-blue-950">Sıçrama Ustaları</p>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">300 – 399 Puan Barajı</p>
                  <p className="text-[11px] text-blue-900/60 mt-0.5">Gelişim Ligi • Hızlı ivme</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-950">Taktik Avcıları</p>
                  <p className="text-xs font-semibold text-emerald-700 mt-0.5">0 – 299 Puan Barajı</p>
                  <p className="text-[11px] text-emerald-900/60 mt-0.5">Temel Ligi • Stratejik yükseliş</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Temel Rozetler */}
        {(activeCategory === 'all' || activeCategory === 'basic') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Temel Rozetler (Her Sınavda Kazanılabilir)
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-1 rounded-lg">🛡️ Kalkan</span>
                    <span className="text-amber-700 font-extrabold text-xs sm:text-sm">+20 LP</span>
                  </div>
                  <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                    Sınavda toplam boş sayısı, yanlış sayısından fazla ise.
                  </p>
                </div>
                <p className="text-[10px] text-amber-800/60 mt-2">Bilinçli boş bırakma ödülü</p>
              </div>

              <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-purple-100 text-purple-900 text-xs font-bold px-2 py-1 rounded-lg">👑 Zirve</span>
                    <span className="text-purple-700 font-extrabold text-xs sm:text-sm">+15 LP</span>
                  </div>
                  <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                    Sınav sonucu 400 puan ve üzerinde ise.
                  </p>
                </div>
                <p className="text-[10px] text-purple-700/80 italic mt-2 bg-white/80 p-1.5 rounded-lg border border-purple-100">
                  Kutup Yıldızları hariçtir.
                </p>
              </div>

              <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-1 rounded-lg">🚀 İvme</span>
                    <span className="text-blue-700 font-extrabold text-xs sm:text-sm">+15 LP</span>
                  </div>
                  <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                    Sınav sonucu bir önceki ortalamasından yüksek ise.
                  </p>
                </div>
                <p className="text-[10px] text-blue-800/60 mt-2">Sürekli gelişim ödülü</p>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2 py-1 rounded-lg">🎯 Tam İsabet</span>
                    <span className="text-emerald-700 font-extrabold text-xs sm:text-sm">+10 LP</span>
                  </div>
                  <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                    Herhangi bir derste sıfır yanlış ve tam doğru yapıldığında.
                  </p>
                </div>
                <p className="text-[10px] text-emerald-800/60 mt-2">Ders bazlı kusursuzluk</p>
              </div>

              <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="bg-rose-100 text-rose-900 text-xs font-bold px-2 py-1 rounded-lg">🟥 Kırmızı Kart</span>
                    <span className="text-rose-700 font-extrabold text-xs sm:text-sm">-15 LP</span>
                  </div>
                  <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                    Toplamda 15 ve üzeri yanlış yapanlar.
                  </p>
                </div>
                <p className="text-[10px] text-rose-700/80 italic mt-2 bg-white/80 p-1.5 rounded-lg border border-rose-100">
                  Sadece Kutup Yıldızları için geçerlidir.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* 3. Takıma Özel Hedef Rozetleri */}
        {(activeCategory === 'all' || activeCategory === 'team_specific') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Takıma Özel Hedef Rozetleri
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              
              {/* Kutup Yıldızları */}
              <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-amber-950 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span>Kutup Yıldızları Hedefleri</span>
                </h4>
                <div className="space-y-2.5">
                  <div className="bg-white border border-amber-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-lg">📜 Sözel Şövalyesi</span>
                      <span className="text-amber-700 font-bold text-xs">+15 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">İnkılap, Din ve İngilizce'de sıfır yanlış.</p>
                  </div>
                  <div className="bg-white border border-amber-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-lg">🏰 Sayısal Kalesi</span>
                      <span className="text-amber-700 font-bold text-xs">+20 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">Matematik ve Fen'de toplam en fazla 2 yanlış.</p>
                  </div>
                </div>
              </div>

              {/* Sıçrama Ustaları */}
              <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-blue-950 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Sıçrama Ustaları Hedefleri</span>
                </h4>
                <div className="space-y-2.5">
                  <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-lg">💡 Matematik Uyanışı</span>
                      <span className="text-blue-700 font-bold text-xs">+20 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">Matematik netinin 10 ve üzeri olması.</p>
                  </div>
                  <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2 py-0.5 rounded-lg">⚖️ Denge Cambazı</span>
                      <span className="text-blue-700 font-bold text-xs">+15 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">Türkçe ve Fen netlerinin 15+ olması.</p>
                  </div>
                </div>
              </div>

              {/* Taktik Avcıları */}
              <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-emerald-950 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Taktik Avcıları Hedefleri</span>
                </h4>
                <div className="space-y-2.5">
                  <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2 py-0.5 rounded-lg">🎯 Keskin Nişancı</span>
                      <span className="text-emerald-700 font-bold text-xs">+20 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">Doğru oranının %70 veya üzeri olması.</p>
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-2xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2 py-0.5 rounded-lg">🧱 Temel Atıcı</span>
                      <span className="text-emerald-700 font-bold text-xs">+15 LP</span>
                    </div>
                    <p className="text-xs text-brand-ink/70 font-medium">Hiç eksi net olmaması, İnkılap/Din 8+ olması.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 4. Uzmanlık Rozetleri */}
        {(activeCategory === 'all' || activeCategory === 'mastery') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Uzmanlık Rozetleri (Seri İstikrar Başarıları)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              
              <div className="bg-fuchsia-50/50 border border-fuchsia-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-fuchsia-100 text-fuchsia-900 text-xs font-bold px-2 py-1 rounded-lg">🏰 Zirve Bekçisi</span>
                  <span className="text-fuchsia-700 font-bold text-xs">+30 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                  3 sınavda aralıksız 400+ puan elde etme.
                </p>
              </div>

              <div className="bg-cyan-50/50 border border-cyan-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-cyan-100 text-cyan-900 text-xs font-bold px-2 py-1 rounded-lg">⚡ İvme Şampiyonu</span>
                  <span className="text-cyan-700 font-bold text-xs">+30 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                  3 sınav art arda en az +5 puan artış.
                </p>
              </div>

              <div className="bg-orange-50/50 border border-orange-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-orange-100 text-orange-900 text-xs font-bold px-2 py-1 rounded-lg">🔨 Baraj Yıkıcı</span>
                  <span className="text-orange-700 font-bold text-xs">+30 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                  Matematikte 3 sınav boyunca 10+ net.
                </p>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-indigo-100 text-indigo-900 text-xs font-bold px-2 py-1 rounded-lg">🧠 Strateji Mh.</span>
                  <span className="text-indigo-700 font-bold text-xs">+40 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                  4 sınavda sürekli Boş &gt; Yanlış kontrolü.
                </p>
              </div>

              <div className="bg-teal-50/50 border border-teal-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-teal-100 text-teal-900 text-xs font-bold px-2 py-1 rounded-lg">🕊️ İstikrar Elçisi</span>
                  <span className="text-teal-700 font-bold text-xs">+50 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                  5 sınav boyunca 0 Kırmızı Kart disiplini.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* 5. Efsanevi Rozetler */}
        {(activeCategory === 'all' || activeCategory === 'legendary') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Efsanevi Rozetler (Nadir Başarılar)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-amber-100/70 border border-amber-300 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-amber-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-2xs">
                    🏆 LGS Fatihi
                  </span>
                  <span className="text-amber-800 font-extrabold text-sm">+200 LP</span>
                </div>
                <p className="text-xs text-amber-950 font-medium leading-relaxed">
                  Bir denemede tüm derslerde sıfır boş ve sıfır yanlışla tam net çıkarma.
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-amber-100/70 border border-amber-300 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-amber-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-2xs">
                    🤝 Takım Ruhu
                  </span>
                  <span className="text-amber-800 font-extrabold text-sm">+50 LP</span>
                </div>
                <p className="text-xs text-amber-950 font-medium leading-relaxed">
                  Takımın haftalık deneme sınavına %100 tam kadro katılım göstermesi.
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-amber-100/70 border border-amber-300 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-2xs">
                    🔥 Anka Kuşu
                  </span>
                  <span className="text-amber-800 font-extrabold text-sm">+300 LP</span>
                </div>
                <p className="text-xs text-amber-950 font-medium leading-relaxed">
                  Taktik Avcıları'ndan Sıçrama Ustaları veya Kutup Yıldızları'na lig atlama.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* 6. Branş Efsaneleri */}
        {(activeCategory === 'all' || activeCategory === 'branch') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Branş Efsaneleri (Tam Net Başarıları)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              <div className="bg-rose-50/50 border border-rose-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-rose-100 text-rose-900 text-xs font-bold px-2 py-1 rounded-lg">📚 Filozof</span>
                  <span className="text-rose-700 font-extrabold text-sm">+30 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 font-medium leading-relaxed">
                  Türkçe dersinde 20 doğru, 0 yanlış yapmak.
                </p>
              </div>

              <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-sky-100 text-sky-900 text-xs font-bold px-2 py-1 rounded-lg">🔭 Newton</span>
                  <span className="text-sky-700 font-extrabold text-sm">+30 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 font-medium leading-relaxed">
                  Fen dersinde 20 doğru, 0 yanlış yapmak.
                </p>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2 py-1 rounded-lg">📐 Pisagor</span>
                  <span className="text-emerald-700 font-extrabold text-sm">+50 LP</span>
                </div>
                <p className="text-xs text-brand-ink/80 font-medium leading-relaxed">
                  Matematik dersinde 20 doğru, 0 yanlış yapmak.
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
