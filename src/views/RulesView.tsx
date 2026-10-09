import React, { useState, useMemo } from 'react';
import { 
  Crown, TrendingUp, Shield, Sparkles, BookOpen, Award, Target, 
  Flame, Compass, Search, X, CheckCircle2, Zap, Star, HelpCircle
} from 'lucide-react';
import { ALL_BADGE_DEFINITIONS, BADGE_CATEGORIES, BadgeDefinition } from '../lib/badgeDefinitions';

export default function RulesView({ onClose }: { onClose?: () => void }) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredBadges = useMemo(() => {
    return ALL_BADGE_DEFINITIONS.filter(b => {
      const matchCat = activeCategory === 'all' || b.category === activeCategory;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.label.toLowerCase().includes(q) ||
        b.condition.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.categoryLabel.toLowerCase().includes(q) ||
        (b.teamRestriction && b.teamRestriction.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, searchQuery]);

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
                  Akademi Arena Kılavuzu & Güncel Rozet Rehberi
                </h2>
                <p className="text-xs sm:text-sm text-brand-ink/60 mt-0.5">
                  Öğrenci puanlama barajları, lig puanı (LP) dinamikleri ve sistemdeki 25 rozetin kazanım şartları.
                </p>
              </div>
            </div>

            {/* Arama ve Kapat Butonu */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-brand-ink/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rozet, ders veya kural ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#FAF9F6] border border-brand-border/80 rounded-xl text-xs font-medium text-brand-ink placeholder:text-brand-ink/40 focus:outline-none focus:border-brand-accent shadow-2xs transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-brand-ink/40 hover:text-brand-ink cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl border border-brand-border/80 bg-[#FAF9F6] hover:bg-[#F2EFE9] text-brand-ink/70 hover:text-brand-ink cursor-pointer transition-all"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Kategori Filtreleri */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar mt-4 pt-3 border-t border-brand-border/40">
            {BADGE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === c.id
                    ? 'bg-[#151618] text-white shadow-2xs'
                    : 'bg-[#FAF9F6] text-brand-ink/70 hover:bg-[#F2EFE9] border border-brand-border/60'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 1. Takım Barajları Bilgilendirmesi */}
        {(activeCategory === 'all' || activeCategory === 'team') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Takım Barajları & Lig Seviyeleri
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-950">Kutup Yıldızları</p>
                  <p className="text-xs font-semibold text-amber-700 mt-0.5">400+ Puan Barajı</p>
                  <p className="text-[11px] text-amber-900/60 mt-0.5">Zirve Ligi • Yüksek hedefler</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80 shadow-2xs">
                <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-blue-950">Sıçrama Ustaları</p>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5">300 – 399 Puan Barajı</p>
                  <p className="text-[11px] text-blue-900/60 mt-0.5">Gelişim Ligi • Hızlı ivme</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 shadow-2xs">
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

        {/* 2. Güncel Rozetler Listesi (Tüm 25 Rozet) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-ink/60" />
              <h3 className="text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
                Güncel Rozetler ve Kazanım Kriterleri ({filteredBadges.length} Rozet)
              </h3>
            </div>
            <span className="text-[11px] text-brand-ink/50 font-medium">
              Sınav sonuçlarıyla anlık ve dinamik eşlenir
            </span>
          </div>

          {filteredBadges.length === 0 ? (
            <div className="py-12 text-center bg-[#FAF9F6] rounded-2xl border border-brand-border/60">
              <p className="text-sm font-medium text-brand-ink/50">Aramanıza uygun rozet bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredBadges.map((badge) => (
                <div 
                  key={badge.key}
                  className="bg-white border border-brand-border/80 hover:border-amber-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Header: Icon, Name & LP */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                          {badge.icon}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-brand-ink truncate">
                            {badge.label}
                          </h4>
                          <span className="text-[10px] text-brand-ink/50 font-semibold block truncate">
                            {badge.categoryLabel}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl shadow-2xs inline-block ${
                          badge.lp > 0 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300/80' 
                            : 'bg-rose-100 text-rose-900 border border-rose-300/80'
                        }`}>
                          {badge.lp > 0 ? `+${badge.lp}` : badge.lp} LP
                        </span>
                      </div>
                    </div>

                    {/* Condition pill */}
                    <div className="mb-2.5">
                      <span className="text-[11px] font-bold text-amber-900/90 bg-amber-50/80 border border-amber-200/70 px-2 py-0.5 rounded-lg inline-block">
                        🎯 {badge.condition}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-brand-ink/75 leading-relaxed font-medium">
                      {badge.description}
                    </p>
                  </div>

                  {/* Footer Tag */}
                  <div className="mt-3.5 pt-2.5 border-t border-brand-border/40 flex items-center justify-between text-[10.5px]">
                    <span className="text-brand-ink/50">
                      Takım Kuralı:
                    </span>
                    <span className={`font-bold px-1.5 py-0.5 rounded-md ${
                      badge.teamRestriction === 'Kutup Yıldızları'
                        ? 'bg-amber-100 text-amber-900'
                        : badge.teamRestriction === 'Sıçrama Ustaları'
                        ? 'bg-blue-100 text-blue-900'
                        : badge.teamRestriction === 'Taktik Avcıları'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-stone-100 text-stone-700'
                    }`}>
                      {badge.teamRestriction || 'Tüm Takımlar'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
