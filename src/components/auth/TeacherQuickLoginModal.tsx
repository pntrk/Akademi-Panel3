import React, { useState, useMemo } from 'react';
import { KNOWN_TEACHERS, TeacherProfile } from '../../lib/deviceUtils';
import { Search, UserCheck, Sparkles, X, Shield, ArrowRight, Smartphone, Info } from 'lucide-react';

interface TeacherQuickLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTeacher: (email: string, displayName: string) => void;
  customTeachers?: string[];
}

export const TeacherQuickLoginModal: React.FC<TeacherQuickLoginModalProps> = ({
  isOpen,
  onClose,
  onSelectTeacher,
  customTeachers = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Combine default known teachers with any school-specific teachers
  const allTeachers = useMemo(() => {
    const list: TeacherProfile[] = [...KNOWN_TEACHERS];
    
    // Add custom teachers not in KNOWN_TEACHERS
    customTeachers.forEach(email => {
      const clean = email.trim().toLowerCase();
      if (clean && !list.some(t => t.email.toLowerCase() === clean)) {
        const prefix = clean.split('@')[0];
        const formattedName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        list.push({
          email: clean,
          name: formattedName,
          branch: 'Öğretmen',
          avatarBg: 'bg-emerald-600'
        });
      }
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [searchQuery, customTeachers]);

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customEmail.trim().toLowerCase();
    if (clean && clean.includes('@')) {
      const prefix = clean.split('@')[0];
      const name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      onSelectTeacher(clean, name);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div 
        className="bg-white dark:bg-[#1A1D24] rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-[#e6e2d3] dark:border-slate-800 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-[#B08D57] to-amber-500"></div>

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-3 flex items-start justify-between border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-serif text-[#5a5a40] dark:text-white flex items-center gap-1.5">
                <span>Öğretmen Hızlı Giriş</span>
                <span className="text-[10px] uppercase tracking-wider font-sans font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  Mobil Uyumlu
                </span>
              </h2>
              <p className="text-xs text-[#8e8d82] dark:text-slate-400 mt-0.5">
                Şifre veya Google pop-up onayına gerek olmadan adınızı seçip anında giriş yapın.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 sm:p-6 pb-2 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğretmen adı veya e-posta ile ara..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#B08D57] transition-all"
            />
          </div>
        </div>

        {/* Teacher List */}
        <div className="p-4 sm:p-6 pt-1 flex-1 overflow-y-auto space-y-2 max-h-[380px] custom-scrollbar">
          {allTeachers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-xs">
              Aramanıza uygun öğretmen bulunamadı.
            </div>
          ) : (
            allTeachers.map((teacher) => {
              const initials = teacher.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={teacher.email}
                  type="button"
                  onClick={() => {
                    onSelectTeacher(teacher.email, teacher.name);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800/60 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-700/60 hover:border-[#B08D57]/60 transition-all text-left group cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${teacher.avatarBg || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate group-hover:text-[#B08D57] transition-colors">
                        {teacher.name}
                      </p>
                      <p className="text-[11px] text-[#8e8d82] dark:text-slate-400 font-mono truncate">
                        {teacher.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="hidden sm:inline-block text-[11px] font-bold text-[#B08D57] group-hover:translate-x-0.5 transition-transform">
                      Giriş Yap
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-700 group-hover:bg-[#B08D57] group-hover:text-white text-gray-500 dark:text-slate-300 flex items-center justify-center transition-all">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer / Custom Email Fallback */}
        <div className="p-4 sm:p-6 pt-3 bg-gray-50 dark:bg-slate-900/60 border-t border-gray-100 dark:border-slate-800">
          <form onSubmit={handleCustomSubmit} className="space-y-2">
            <label className="block text-[11px] font-bold text-[#5a5a40] dark:text-slate-300">
              Listede adınız yok mu? Kendi e-postanızla doğrudan giriş yapın:
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="ornek@gmail.com"
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#B08D57]"
              />
              <button
                type="submit"
                disabled={!customEmail.includes('@')}
                className="px-4 py-2 bg-[#B08D57] hover:bg-[#967746] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
              >
                Giriş
              </button>
            </div>
          </form>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#8e8d82] dark:text-slate-400">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Android ve iPhone tüm mobil tarayıcılarda %100 kesintisiz çalışır.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
