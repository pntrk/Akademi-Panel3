import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Trophy, TrendingUp, Shield, Crown, ArrowUpRight, ArrowDownRight, 
  Info, X, BookOpen, ChevronDown, Search, Filter, Sparkles, Flame,
  Award, Medal, Users, Calendar, CheckCircle2, ChevronRight, UserCheck,
  ChevronLeft, Printer, RefreshCw, Star, Layers, ArrowRight
} from 'lucide-react';
import { determineLeagueTeam, calculateAtaLigPoints, parseDate } from '../lib/utils';
import RulesView from './RulesView';

export const LeagueView = () => {
  const { state, updateLeagueSettings, approveTransfer, userRole } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'rules'>('dashboard');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  
  // Filtering states
  const [selectedGrade, setSelectedGrade] = useState<string>('8');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Dropdown states
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  
  // Tactics modal active month
  const [activeTacticsMonth, setActiveTacticsMonth] = useState<number>(0);

  // Set default to latest month available if not manually changed
  useEffect(() => {
    if (selectedMonth === 'all' && state.exams.length > 0) {
      const months = new Set<string>();
      state.exams.forEach(e => {
        if (e.date) {
          const dateObj = parseDate(e.date);
          months.add(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`);
        }
      });
      const sorted = Array.from(months).sort((a, b) => b.localeCompare(a));
      if (sorted.length > 0) {
        setSelectedMonth(sorted[0]);
      }
    }
  }, [state.exams]);

  const mentors = state.leagueMentors || {};
  const bonusPoints = state.leagueTeamPoints || {};

  const getGradeLevel = (cls: string) => {
    const match = cls?.trim().match(/^(\d+)/);
    return match ? match[1] : null;
  };

  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    state.results.forEach(r => {
      const matchedStudent = state.students.find(s => s.no === r.studentNo);
      const displayClass = matchedStudent ? matchedStudent.className : r.studentClass;
      if (displayClass) classes.add(displayClass.trim());
    });
    return Array.from(classes).sort();
  }, [state.results, state.students]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    state.exams.forEach(e => {
      if (e.date) {
        const dateObj = parseDate(e.date);
        months.add(`${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [state.exams]);

  const availableGradeLevels = useMemo(() => {
    const levels = new Set<string>(['5', '6', '7', '8']);
    uniqueClasses.forEach(cls => {
      const lvl = getGradeLevel(cls);
      if (lvl) {
        levels.add(lvl);
      } else if (cls) {
        levels.add('Diğer');
      }
    });
    return Array.from(levels).sort((a, b) => {
      if (a === 'Diğer') return 1;
      if (b === 'Diğer') return -1;
      return parseInt(a) - parseInt(b);
    });
  }, [uniqueClasses]);

  // Base list of students filtered by grade and monthly calculation
  const baseStudents = useMemo(() => {
    return state.students.filter(s => {
      const hasExams = state.results.some(
        r => r.studentNo === s.no && s.no !== 0 && Object.keys(r.scores || {}).length > 0 && Object.values(r.scores || {}).some(score => (score as number) > 0)
      );
      let matchesGrade = true;
      if (selectedGrade !== 'all') {
        const lvl = getGradeLevel(s.className);
        if (selectedGrade === 'Diğer') {
          matchesGrade = !lvl;
        } else {
          matchesGrade = lvl === selectedGrade;
        }
      }
      return matchesGrade && hasExams;
    }).map(s => {
      let displayPoints = s.leaguePoints || 0;
      let displayBadges = s.badges || {};
      if (selectedMonth !== 'all') {
        const monthlyData = (s as any).monthlyLeagueData;
        if (monthlyData && monthlyData[selectedMonth]) {
          displayPoints = monthlyData[selectedMonth].points || 0;
          displayBadges = monthlyData[selectedMonth].badges || {};
        } else {
          displayPoints = 0;
          displayBadges = {};
        }
      }
      return { ...s, displayPoints, displayBadges };
    }).sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));
  }, [state.students, state.results, selectedGrade, selectedMonth]);

  // Filtered by search and team tab
  const filteredStudents = useMemo(() => {
    return baseStudents.filter(s => {
      const matchesTeam = selectedTeamFilter === 'all' || s.leagueTeam === selectedTeamFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        s.name.toLowerCase().includes(q) || 
        (s.className && s.className.toLowerCase().includes(q)) ||
        (s.no && String(s.no).includes(q));
      return matchesTeam && matchesSearch;
    });
  }, [baseStudents, selectedTeamFilter, searchQuery]);

  // Team arrays for stats
  const kutup = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Kutup Yıldızları'), [baseStudents]);
  const sicrama = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Sıçrama Ustaları'), [baseStudents]);
  const taktik = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Taktik Avcıları'), [baseStudents]);

  const calcAvg = (teamName: string, team: any[]) => {
    const activeMembers = team.filter(s => {
      const p = (s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0;
      return p !== 0;
    });
    if (activeMembers.length === 0) return (selectedMonth === 'all' ? (bonusPoints[teamName] || 0) : 0);
    const total = activeMembers.reduce((acc, s) => acc + ((s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0), 0);
    return Math.round(total / activeMembers.length) + (selectedMonth === 'all' ? (bonusPoints[teamName] || 0) : 0);
  };

  const kutupAvg = calcAvg('Kutup Yıldızları', kutup);
  const sicramaAvg = calcAvg('Sıçrama Ustaları', sicrama);
  const taktikAvg = calcAvg('Taktik Avcıları', taktik);

  const championTeam = useMemo(() => {
    const avgs = [
      { name: 'Kutup Yıldızları', avg: kutupAvg },
      { name: 'Sıçrama Ustaları', avg: sicramaAvg },
      { name: 'Taktik Avcıları', avg: taktikAvg }
    ];
    let max = -1;
    let champ = '';
    avgs.forEach(t => {
      if (t.avg > max && t.avg > 0) {
        max = t.avg;
        champ = t.name;
      }
    });
    return champ;
  }, [kutupAvg, sicramaAvg, taktikAvg]);

  const pendingTransfers = useMemo(() => {
    return baseStudents.filter(s => {
      const pt = (s as any).pendingTransfer;
      if (!pt) return false;
      if (selectedMonth === 'all') return true;
      if (pt.date) {
        const dateObj = parseDate(pt.date);
        const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        return mKey === selectedMonth;
      }
      return false;
    });
  }, [baseStudents, selectedMonth]);

  const isUpwardTransfer = (transferStr: string) => {
    if (transferStr.includes('Taktik') && transferStr.includes('Sıçrama')) return transferStr.indexOf('Sıçrama') > transferStr.indexOf('Taktik');
    if (transferStr.includes('Taktik') && transferStr.includes('Kutup')) return transferStr.indexOf('Kutup') > transferStr.indexOf('Taktik');
    if (transferStr.includes('Sıçrama') && transferStr.includes('Kutup')) return transferStr.indexOf('Kutup') > transferStr.indexOf('Sıçrama');
    if (transferStr.includes('Atanmadı')) return true;
    return true;
  };

  const getTeamStar = (team: any[]) => {
    if (team.length === 0) return null;
    const sorted = [...team].sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));
    return sorted[0] && (sorted[0].displayPoints || 0) > 0 ? sorted[0].name : null;
  };

  // Render Badge Pills Component
  const renderBadges = (badges?: any, team?: string, compact = false) => {
    if (!badges) return <span className="text-brand-ink/30 text-xs italic">-</span>;
    const list: { key: string; label: string; icon: string; count: number; bg: string; text: string; border: string }[] = [];

    // Efsanevi
    if (badges.lgsFatihi > 0) list.push({ key: 'lf', label: 'LGS Fatihi', icon: '🏆', count: badges.lgsFatihi, bg: 'bg-amber-500', text: 'text-white font-extrabold', border: 'border-amber-400' });
    if (badges.ankaKusu > 0) list.push({ key: 'ak', label: 'Anka Kuşu', icon: '🔥', count: badges.ankaKusu, bg: 'bg-gradient-to-r from-orange-500 to-amber-500', text: 'text-white font-extrabold', border: 'border-orange-400' });

    // Uzmanlık
    if (badges.zirveBekcisi > 0) list.push({ key: 'zb', label: 'Zirve Bekçisi', icon: '🏰', count: badges.zirveBekcisi, bg: 'bg-fuchsia-100', text: 'text-fuchsia-900 font-bold', border: 'border-fuchsia-200' });
    if (badges.ivmeSampiyonu > 0) list.push({ key: 'is', label: 'İvme Şampiyonu', icon: '⚡', count: badges.ivmeSampiyonu, bg: 'bg-cyan-100', text: 'text-cyan-900 font-bold', border: 'border-cyan-200' });
    if (badges.barajYikici > 0) list.push({ key: 'by', label: 'Baraj Yıkıcı', icon: '🔨', count: badges.barajYikici, bg: 'bg-orange-100', text: 'text-orange-900 font-bold', border: 'border-orange-200' });
    if (badges.stratejiMuhendisi > 0) list.push({ key: 'sm', label: 'Strateji Mh.', icon: '🧠', count: badges.stratejiMuhendisi, bg: 'bg-indigo-100', text: 'text-indigo-900 font-bold', border: 'border-indigo-200' });
    if (badges.istikrarElcisi > 0) list.push({ key: 'ie', label: 'İstikrar Elçisi', icon: '🕊️', count: badges.istikrarElcisi, bg: 'bg-teal-100', text: 'text-teal-900 font-bold', border: 'border-teal-200' });

    // Takım
    if (badges.sozelSovalyesi > 0) list.push({ key: 'ss', label: 'Sözel Şövalyesi', icon: '📜', count: badges.sozelSovalyesi, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (badges.sayisalKalesi > 0) list.push({ key: 'sk', label: 'Sayısal Kalesi', icon: '🏰', count: badges.sayisalKalesi, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (badges.matematikUyanisi > 0) list.push({ key: 'mu', label: 'Mat. Uyanışı', icon: '💡', count: badges.matematikUyanisi, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (badges.dengeCambazi > 0) list.push({ key: 'dc', label: 'Denge Cambazı', icon: '⚖️', count: badges.dengeCambazi, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (badges.keskinNisanci > 0) list.push({ key: 'kn', label: 'Keskin Nişancı', icon: '🎯', count: badges.keskinNisanci, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });
    if (badges.temelAtici > 0) list.push({ key: 'ta', label: 'Temel Atıcı', icon: '🧱', count: badges.temelAtici, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });

    // Branş Efsaneleri
    if (badges.filozof > 0) list.push({ key: 'filozof', label: 'Filozof', icon: '📚', count: badges.filozof, bg: 'bg-rose-100', text: 'text-rose-900 font-bold', border: 'border-rose-200' });
    if (badges.newton > 0) list.push({ key: 'newton', label: 'Newton', icon: '🔭', count: badges.newton, bg: 'bg-sky-100', text: 'text-sky-900 font-bold', border: 'border-sky-200' });
    if (badges.pisagor > 0) list.push({ key: 'pisagor', label: 'Pisagor', icon: '📐', count: badges.pisagor, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });

    // Temel
    if (badges.kalkan > 0) list.push({ key: 'kalkan', label: 'Kalkan', icon: '🛡️', count: badges.kalkan, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (badges.zirve > 0) list.push({ key: 'zirve', label: 'Zirve', icon: '👑', count: badges.zirve, bg: 'bg-purple-100', text: 'text-purple-900 font-bold', border: 'border-purple-200' });
    if (badges.ivme > 0) list.push({ key: 'ivme', label: 'İvme', icon: '🚀', count: badges.ivme, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (badges.tamIsabet > 0) list.push({ key: 'tamIsabet', label: 'Tam İsabet', icon: '🎯', count: badges.tamIsabet, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });
    if (badges.kirmiziKart > 0) list.push({ key: 'kirmiziKart', label: 'Kırmızı Kart', icon: '🟥', count: badges.kirmiziKart, bg: 'bg-rose-100', text: 'text-rose-900 font-bold', border: 'border-rose-200' });

    if (list.length === 0) return <span className="text-brand-ink/30 text-xs italic">-</span>;

    if (compact) {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {list.slice(0, 4).map(b => (
            <span 
              key={b.key} 
              title={`${b.label} (${b.count})`}
              className={`${b.bg} ${b.text} border ${b.border} text-[10px] px-1.5 py-0.5 rounded-md shadow-2xs inline-flex items-center gap-0.5 shrink-0`}
            >
              <span>{b.icon}</span>
              {b.count > 1 && <span className="text-[9px] opacity-80">x{b.count}</span>}
            </span>
          ))}
          {list.length > 4 && (
            <span className="text-[10px] font-bold text-brand-ink/50 bg-[#F2EFE9] px-1.5 py-0.5 rounded-md">
              +{list.length - 4}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {list.map(b => (
          <span 
            key={b.key} 
            title={`${b.label} x${b.count}`}
            className={`${b.bg} ${b.text} border ${b.border} text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md shadow-2xs inline-flex items-center gap-1 shrink-0 transition-transform hover:scale-105`}
          >
            <span>{b.icon}</span>
            <span>{b.label}</span>
            {b.count > 1 && <span className="opacity-90 font-extrabold text-[9px]">x{b.count}</span>}
          </span>
        ))}
      </div>
    );
  };

  // Top 3 Podium Students
  const top3Students = useMemo(() => {
    return baseStudents.slice(0, 3);
  }, [baseStudents]);

  const tacticsMonths = [
    { name: 'EYLÜL (D 1-4)', kutup: 'Sözel Kusursuzluk: İnkılap, Din ve İngilizce branşlarında takımca hiç fire (yanlış) vermemek.', sicrama: 'Matematik Uyanışı: Matematik net ortalamasını takımca eksi ve sıfırlardan kurtarıp kalıcı hale getirmek.', taktik: 'Cesur Boşluklar: Hiçbir derste eksi nete düşmemek. Sadece emin olunanı işaretlemek.', ortak: 'Tüm takımların DYK\'ya minimum %90 devamlılık sağlaması.' },
    { name: 'EKİM (D 5-8)', kutup: 'Kronometre Avcısı: Türkçe\'de 18+ net ve "sıfır dikkat hatası" ile denemeleri bitirmek.', sicrama: 'Baraj Yıkıcı: Sayısal bölümde zorlanılan Matematikte takım ortalamasını 8+ nete sabitlemek.', taktik: 'Kalkanları Açın: Ay boyunca takımın %80\'inin "Kalkan Puanı"nı (Boş > Yanlış) her denemede alması.', ortak: '"Hata Avcısı" defterine her öğrencinin en az 15 öğretmen imzası toplatması.' },
    { name: 'KASIM (D 9-12)', kutup: 'Sayısal Simetri: Matematik ve Fen Bilimlerinde takımca 15\'er netin altına asla düşmemek.', sicrama: 'Fen Kalesi: Sınavın kurtarıcısı Fen Bilimleri net ortalamasını 14+ nete demirlemek.', taktik: 'Optik Disiplin: 4 deneme boyunca hiçbir kaydırma veya yanlış işaretleme hatası yapmamak.', ortak: 'Soru bankalarından hocaların verdiği DYK ek ödevlerinin %100 teslimi.' },
    { name: 'ARALIK (D 13-15)', kutup: 'Sıfır Dikkatsizlik: "Soru kökünü olumsuz okuma" veya "basit işlem hatası" kaynaklı fireleri sıfırlamak.', sicrama: 'Süre Kurtarıcısı: Türkçeyi hızlı bitirip, sayısal oturumda Matematiğe ekstra süre yaratmak.', taktik: 'Temel Sıçrama: İlk denemeye (Eylül) göre takımca toplam neti en az +10 net yukarı taşımak.', ortak: 'Yapılamayan/Biriken tüm deneme sorularının DYK\'larda tamamen eritilmesi.' },
    { name: 'OCAK (Ara Transfer)', kutup: 'Mentörlük Dayanışması: B veya C takımından bir arkadaşına DYK\'da konu anlatıp akran koçluğu yapmak.', sicrama: '1. Dönem Onarımı: İlk 15 denemede tespit edilen zayıf konulardan artık fire vermemek.', taktik: 'Üst Lige Göz Kırp: Toplam neti 45+ üzerine taşıyarak yarıyıl transfer sezonunda 2. Lige çıkmak.', ortak: 'DYK "Sömestir 1. Dönem Tekrar Kampı" simülasyonlarına %100 katılım.' },
    { name: 'ŞUBAT (D 16-19)', kutup: 'Yeni Nesil Ustası: Sınavın en seçici (mantık/muhakeme) sorularını kayıpsız geçmek.', sicrama: 'Matematik Eşiği 2: Matematik ortalamasını 12+ bandına çekerek nitelikli lise potasına girmek.', taktik: 'Sözel Savunması: Sözel bölüm (Türkçe, Din, İnk, İng) netlerini en üst seviyeye çıkarıp garantiye almak.', ortak: 'DYK branş denemelerinde takım bazlı mini kapışmalar yapılması.' },
    { name: 'MART (D 20-23)', kutup: 'Turlama Taktisyeni: Sınavı erken bitirip en az 10 dakika "şüpheli soruları kontrol" süresi ayırmak.', sicrama: 'Zarar Kes (Stop-Loss): Sayısalda zor soruda inatlaşmayıp anında boş bırakıp 2. tura geçebilmek.', taktik: 'Erken Çıkma Yasağı: Sınav bitene kadar optik başında kalıp son saniyeye kadar odaklanmak.', ortak: 'Gerçek LGS kurallarıyla (kalem, optik, süre) birebir DYK sınav simülasyonları.' },
    { name: 'NİSAN (D 24-27)', kutup: 'Sarsılmaz İstikrar: Peş peşe 4 denemede puan dalgalanmasını bitirip 470+ barajında kalmak.', sicrama: 'Nitelikli Lise Güvencesi: Matematikte 13+, Türkçe\'de 16+ barajını takım ortalaması yapmak.', taktik: 'Defansif Çözüm: Bildiklerini koruyup sadece emin olunan soruları işaretleyerek okulu korumak.', ortak: 'Haftalık 2 denemenin yapıldığı yoğun Nisan temposuna mental dayanıklılık.' },
    { name: 'MAYIS (D 28-30)', kutup: 'Buz Adam / Kadın: En zor piyasa denemesinde bile panik yapmadan kriz yönetmek.', sicrama: 'Psikolojik Finiş: "Matematik yapamıyorum" stresini aşıp özgüvenle 15. deneme zirvesini geçmek.', taktik: 'Zirve Özgüveni: Atmasyonun tamamen bittiği, 30. denemede kişisel net rekorunu kırmak.', ortak: 'LGS öncesi son taktiklerin verilip, stres atıcı DYK veda etkinliklerinin yapılması.' }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full font-sans text-brand-ink animate-fade-in">
      
      {/* 1. Header & Quick Actions */}
      <header className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-brand-border/80 shadow-2xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shrink-0 font-bold shadow-sm">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-brand-ink font-bold tracking-tight">
                    Akademi Arena
                  </h1>
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Lig & Rozetler
                  </span>
                </div>
                <p className="text-brand-ink/60 text-xs sm:text-sm mt-0.5">
                  Öğrenci ligleri, haftalık dinamik takımlar, lig puanları (LP) ve rozet sistemi.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowTactics(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/90 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Aylık Taktikler</span>
            </button>

            <button
              onClick={() => setActiveView(activeView === 'dashboard' ? 'rules' : 'dashboard')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-2xs text-xs font-bold active:scale-95 cursor-pointer shrink-0 ${
                activeView === 'dashboard'
                  ? 'bg-[#151618] hover:bg-black text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {activeView === 'dashboard' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rozet Rehberi & Kurallar</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Arena Tablosuna Dön</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {activeView === 'rules' ? (
        <RulesView />
      ) : (
        <>
          {/* 2. Filtreleme & Arama Çubuğu */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-2xs border border-brand-border/80 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Sol: Zaman Aralığı ve Sınıf Dropdownları */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                
                {/* Zaman Aralığı */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsMonthDropdownOpen(!isMonthDropdownOpen);
                      setIsGradeDropdownOpen(false);
                    }}
                    className="w-full sm:w-56 flex items-center justify-between px-3.5 py-2.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-[#F2EFE9] rounded-xl text-xs font-bold text-brand-ink transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Calendar className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                      <span className="truncate">
                        {selectedMonth === 'all' ? '🏆 Tüm Zamanlar (Toplam LP)' : (() => {
                          const [year, month] = selectedMonth.split('-');
                          const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                          return `${monthNames[parseInt(month) - 1]} ${year}`;
                        })()}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-brand-ink/50 transition-transform duration-200 shrink-0 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isMonthDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setIsMonthDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 sm:w-64 mt-1.5 bg-white border border-brand-border/80 rounded-2xl shadow-xl z-30 py-1.5 overflow-y-auto max-h-60 animate-fade-in">
                        <button
                          onClick={() => {
                            setSelectedMonth('all');
                            setIsMonthDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center gap-2 ${
                            selectedMonth === 'all' ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                          }`}
                        >
                          <span>🏆</span>
                          <span>Tüm Zamanlar (Toplam LP)</span>
                        </button>
                        {availableMonths.map(m => {
                          const [year, month] = m.split('-');
                          const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                          const monthName = monthNames[parseInt(month) - 1];
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                setSelectedMonth(m);
                                setIsMonthDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center gap-2 ${
                                selectedMonth === m ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                              }`}
                            >
                              <span>📅</span>
                              <span>{monthName} {year}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Sınıf Seviyesi */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsGradeDropdownOpen(!isGradeDropdownOpen);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="w-full sm:w-48 flex items-center justify-between px-3.5 py-2.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-[#F2EFE9] rounded-xl text-xs font-bold text-brand-ink transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                      <span>
                        {selectedGrade === 'all' ? '📚 Tüm Sınıflar' : selectedGrade === 'Diğer' ? '🎒 Diğer Sınıflar' : `🎓 ${selectedGrade}. Sınıflar`}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-brand-ink/50 transition-transform duration-200 shrink-0 ${isGradeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isGradeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setIsGradeDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 sm:w-52 mt-1.5 bg-white border border-brand-border/80 rounded-2xl shadow-xl z-30 py-1.5 overflow-y-auto max-h-60 animate-fade-in">
                        <button
                          onClick={() => {
                            setSelectedGrade('all');
                            setIsGradeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-amber-50/60 transition-colors ${
                            selectedGrade === 'all' ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                          }`}
                        >
                          📚 Tüm Sınıflar
                        </button>
                        {availableGradeLevels.map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => {
                              setSelectedGrade(lvl);
                              setIsGradeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-amber-50/60 transition-colors ${
                              selectedGrade === lvl ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                            }`}
                          >
                            {lvl === 'Diğer' ? '🎒 Diğer Sınıflar' : `🎓 ${lvl}. Sınıflar`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* Sağ: Arama Kutusu */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-brand-ink/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Öğrenci veya şube ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-[#FAF9F6] border border-brand-border/80 rounded-xl text-xs font-medium text-brand-ink placeholder:text-brand-ink/40 focus:outline-none focus:border-brand-accent shadow-2xs transition-all"
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

            {/* Takım Filtre Sekmeleri (Chips) */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-brand-border/40">
              <span className="text-[11px] font-bold text-brand-ink/50 uppercase tracking-wider mr-1 shrink-0 hidden sm:inline">
                Takım:
              </span>
              <button
                onClick={() => setSelectedTeamFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs ${
                  selectedTeamFilter === 'all'
                    ? 'bg-[#151618] text-white'
                    : 'bg-[#FAF9F6] hover:bg-[#F2EFE9] text-brand-ink/70 border border-brand-border/60'
                }`}
              >
                Tüm Takımlar ({baseStudents.length})
              </button>
              <button
                onClick={() => setSelectedTeamFilter('Kutup Yıldızları')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  selectedTeamFilter === 'Kutup Yıldızları'
                    ? 'bg-amber-500 text-white font-extrabold'
                    : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border border-amber-200/80'
                }`}
              >
                <span>⭐</span>
                <span>Kutup Yıldızları ({kutup.length})</span>
              </button>
              <button
                onClick={() => setSelectedTeamFilter('Sıçrama Ustaları')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  selectedTeamFilter === 'Sıçrama Ustaları'
                    ? 'bg-blue-600 text-white font-extrabold'
                    : 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-950 border border-blue-200/80'
                }`}
              >
                <span>🚀</span>
                <span>Sıçrama Ustaları ({sicrama.length})</span>
              </button>
              <button
                onClick={() => setSelectedTeamFilter('Taktik Avcıları')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  selectedTeamFilter === 'Taktik Avcıları'
                    ? 'bg-emerald-600 text-white font-extrabold'
                    : 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border border-emerald-200/80'
                }`}
              >
                <span>🛡️</span>
                <span>Taktik Avcıları ({taktik.length})</span>
              </button>
            </div>
          </div>

          {/* 3. Takım Kartları (Responsive Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-5">
            
            {/* Kutup Yıldızları */}
            <div 
              onClick={() => setSelectedTeam('Kutup Yıldızları')}
              className={`cursor-pointer transition-all hover:shadow-md bg-gradient-to-br from-amber-50/95 via-amber-50/40 to-amber-100/60 border ${
                championTeam === 'Kutup Yıldızları' 
                  ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-sm' 
                  : 'border-amber-200/80 hover:border-amber-300 shadow-2xs'
              } rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col relative active:scale-[0.99] group`}
            >
              {championTeam === 'Kutup Yıldızları' && (
                <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                  <Crown className="w-3 h-3 text-white" />
                  <span>Şampiyon Takım</span>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                    <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-amber-950 group-hover:text-amber-800 transition-colors">
                      Kutup Yıldızları
                    </h3>
                    <p className="text-[11px] font-semibold text-amber-800/70">400+ Puan Ligi</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600/40 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Takım Yıldızı */}
              <div className="mb-3 bg-white/80 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-amber-200/60 shadow-2xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] text-amber-800/60 uppercase tracking-wider font-extrabold flex items-center gap-1">
                    <span>⭐</span>
                    <span>Takım Yıldızı</span>
                  </p>
                  <p className="text-xs font-bold text-amber-950 truncate mt-0.5">
                    {getTeamStar(kutup) || 'Henüz Yok'}
                  </p>
                </div>
                {mentors['Kutup Yıldızları'] && (
                  <span className="text-[10px] font-medium text-amber-800/80 bg-amber-100/60 px-2 py-0.5 rounded-md truncate max-w-[110px]">
                    Koç: {mentors['Kutup Yıldızları']}
                  </span>
                )}
              </div>

              {/* İstatistikler */}
              <div className="flex justify-between items-end mt-auto pt-2 border-t border-amber-200/50">
                <div>
                  <p className="text-[10px] font-bold text-amber-800/70 uppercase tracking-wider">Ortalama LP</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 tabular-nums">{kutupAvg}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-amber-800/70 uppercase tracking-wider">Kadro</p>
                  <p className="text-sm sm:text-base font-bold text-amber-900">{kutup.length} Öğrenci</p>
                  <span className="text-[10px] font-bold text-amber-700/90 group-hover:underline inline-flex items-center gap-0.5 mt-0.5">
                    <span>Üyeleri Gör</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Sıçrama Ustaları */}
            <div 
              onClick={() => setSelectedTeam('Sıçrama Ustaları')}
              className={`cursor-pointer transition-all hover:shadow-md bg-gradient-to-br from-blue-50/95 via-blue-50/40 to-blue-100/60 border ${
                championTeam === 'Sıçrama Ustaları' 
                  ? 'border-blue-400 ring-2 ring-blue-400/40 shadow-sm' 
                  : 'border-blue-200/80 hover:border-blue-300 shadow-2xs'
              } rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col relative active:scale-[0.99] group`}
            >
              {championTeam === 'Sıçrama Ustaları' && (
                <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                  <Crown className="w-3 h-3 text-white" />
                  <span>Şampiyon Takım</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-blue-950 group-hover:text-blue-800 transition-colors">
                      Sıçrama Ustaları
                    </h3>
                    <p className="text-[11px] font-semibold text-blue-800/70">300 – 399 Puan Ligi</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-600/40 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Takım Yıldızı */}
              <div className="mb-3 bg-white/80 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-blue-200/60 shadow-2xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] text-blue-800/60 uppercase tracking-wider font-extrabold flex items-center gap-1">
                    <span>⭐</span>
                    <span>Takım Yıldızı</span>
                  </p>
                  <p className="text-xs font-bold text-blue-950 truncate mt-0.5">
                    {getTeamStar(sicrama) || 'Henüz Yok'}
                  </p>
                </div>
                {mentors['Sıçrama Ustaları'] && (
                  <span className="text-[10px] font-medium text-blue-800/80 bg-blue-100/60 px-2 py-0.5 rounded-md truncate max-w-[110px]">
                    Koç: {mentors['Sıçrama Ustaları']}
                  </span>
                )}
              </div>

              {/* İstatistikler */}
              <div className="flex justify-between items-end mt-auto pt-2 border-t border-blue-200/50">
                <div>
                  <p className="text-[10px] font-bold text-blue-800/70 uppercase tracking-wider">Ortalama LP</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-blue-700 tabular-nums">{sicramaAvg}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-blue-800/70 uppercase tracking-wider">Kadro</p>
                  <p className="text-sm sm:text-base font-bold text-blue-900">{sicrama.length} Öğrenci</p>
                  <span className="text-[10px] font-bold text-blue-700/90 group-hover:underline inline-flex items-center gap-0.5 mt-0.5">
                    <span>Üyeleri Gör</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Taktik Avcıları */}
            <div 
              onClick={() => setSelectedTeam('Taktik Avcıları')}
              className={`cursor-pointer transition-all hover:shadow-md bg-gradient-to-br from-emerald-50/95 via-emerald-50/40 to-emerald-100/60 border ${
                championTeam === 'Taktik Avcıları' 
                  ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-sm' 
                  : 'border-emerald-200/80 hover:border-emerald-300 shadow-2xs'
              } rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col relative active:scale-[0.99] group`}
            >
              {championTeam === 'Taktik Avcıları' && (
                <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
                  <Crown className="w-3 h-3 text-white" />
                  <span>Şampiyon Takım</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-emerald-950 group-hover:text-emerald-800 transition-colors">
                      Taktik Avcıları
                    </h3>
                    <p className="text-[11px] font-semibold text-emerald-800/70">0 – 299 Puan Ligi</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600/40 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Takım Yıldızı */}
              <div className="mb-3 bg-white/80 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-emerald-200/60 shadow-2xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] text-emerald-800/60 uppercase tracking-wider font-extrabold flex items-center gap-1">
                    <span>⭐</span>
                    <span>Takım Yıldızı</span>
                  </p>
                  <p className="text-xs font-bold text-emerald-950 truncate mt-0.5">
                    {getTeamStar(taktik) || 'Henüz Yok'}
                  </p>
                </div>
                {mentors['Taktik Avcıları'] && (
                  <span className="text-[10px] font-medium text-emerald-800/80 bg-emerald-100/60 px-2 py-0.5 rounded-md truncate max-w-[110px]">
                    Koç: {mentors['Taktik Avcıları']}
                  </span>
                )}
              </div>

              {/* İstatistikler */}
              <div className="flex justify-between items-end mt-auto pt-2 border-t border-emerald-200/50">
                <div>
                  <p className="text-[10px] font-bold text-emerald-800/70 uppercase tracking-wider">Ortalama LP</p>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tabular-nums">{taktikAvg}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-emerald-800/70 uppercase tracking-wider">Kadro</p>
                  <p className="text-sm sm:text-base font-bold text-emerald-900">{taktik.length} Öğrenci</p>
                  <span className="text-[10px] font-bold text-emerald-700/90 group-hover:underline inline-flex items-center gap-0.5 mt-0.5">
                    <span>Üyeleri Gör</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* 4. Onay Bekleyen Transferler (Varsa) */}
          {pendingTransfers.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/90 to-amber-50/90 border border-orange-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                    ⏳
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-orange-950">
                    Onay Bekleyen Lig Transferleri ({pendingTransfers.length})
                  </h3>
                </div>
                <span className="text-[11px] text-orange-800/70 font-medium">
                  Sınav puanı gelişimine göre lig geçişleri
                </span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
                {pendingTransfers.map((s, idx) => {
                  const pt = (s as any).pendingTransfer;
                  const isUp = pt && isUpwardTransfer(`${pt.from} ➔ ${pt.to}`);
                  return (
                    <div 
                      key={s.id ? `transfer-${s.id}` : `transfer-${s.no || (s as any).name}-${idx}`} 
                      onClick={() => setSelectedStudent(s)} 
                      className="cursor-pointer bg-white border border-orange-200/80 rounded-xl px-3.5 py-2.5 flex-shrink-0 flex items-center space-x-3 min-w-[270px] sm:min-w-[300px] hover:bg-orange-50/50 shadow-2xs transition-all active:scale-[0.99]"
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-brand-ink truncate">{s.name}</p>
                        <p className="text-[10px] text-brand-ink/60 font-medium truncate">{pt.from} ➔ {pt.to}</p>
                      </div>
                      {userRole === 'admin' && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            approveTransfer(s.no, pt.examName, pt.to); 
                          }}
                          className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-[11px] font-bold rounded-lg shadow-2xs cursor-pointer shrink-0"
                        >
                          Onayla
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Top 3 Podium (Görsel Podyum) - Mobilde ve Masaüstünde Şık Görünüm */}
          {top3Students.length >= 3 && !searchQuery && selectedTeamFilter === 'all' && (
            <div className="bg-gradient-to-b from-[#1c1d22] to-[#121316] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400">
                    Arena Zirvesi (Podyum)
                  </h3>
                </div>
                <span className="text-[10px] sm:text-xs text-white/50 font-medium">
                  {selectedGrade === 'all' ? 'Tüm Sınıflar' : `${selectedGrade}. Sınıflar`} • En Yüksek LP
                </span>
              </div>

              {/* 3'lü Podyum Grid: Sırasıyla 2. (Gümüş), 1. (Altın), 3. (Bronz) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-2 pb-1 relative z-10">
                
                {/* 2. Sıra (Gümüş) */}
                <div 
                  onClick={() => setSelectedStudent(top3Students[1])}
                  className="cursor-pointer flex flex-col items-center text-center p-2.5 sm:p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-slate-300/30 transition-all active:scale-95 group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-300 text-slate-900 font-extrabold flex items-center justify-center text-sm shadow-md mb-2 group-hover:scale-110 transition-transform">
                    🥈
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                    {top3Students[1].name}
                  </p>
                  <p className="text-[10px] text-white/60 font-medium truncate max-w-full">
                    {top3Students[1].className || 'Öğrenci'}
                  </p>
                  <div className="mt-2 font-serif font-extrabold text-sm sm:text-base text-amber-300 tabular-nums">
                    {(top3Students[1].displayPoints !== undefined ? top3Students[1].displayPoints : top3Students[1].leaguePoints) || 0} LP
                  </div>
                </div>

                {/* 1. Sıra (Altın / Şampiyon) */}
                <div 
                  onClick={() => setSelectedStudent(top3Students[0])}
                  className="cursor-pointer flex flex-col items-center text-center p-3.5 sm:p-5 bg-gradient-to-b from-amber-500/20 to-amber-500/5 hover:from-amber-500/30 rounded-2xl sm:rounded-3xl border-2 border-amber-400 shadow-lg transition-all active:scale-95 group -translate-y-2 sm:-translate-y-3"
                >
                  <div className="relative mb-2">
                    <Crown className="w-5 h-5 text-amber-400 absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce" />
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-base sm:text-lg shadow-lg group-hover:scale-110 transition-transform">
                      🥇
                    </div>
                  </div>
                  <span className="bg-amber-400/20 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider mb-1">
                    Arena Lideri
                  </span>
                  <p className="text-xs sm:text-base font-extrabold text-white truncate max-w-full">
                    {top3Students[0].name}
                  </p>
                  <p className="text-[11px] text-amber-200/70 font-medium truncate max-w-full">
                    {top3Students[0].className || 'Öğrenci'}
                  </p>
                  <div className="mt-2 font-serif font-black text-base sm:text-xl text-amber-300 tabular-nums">
                    {(top3Students[0].displayPoints !== undefined ? top3Students[0].displayPoints : top3Students[0].leaguePoints) || 0} LP
                  </div>
                </div>

                {/* 3. Sıra (Bronz) */}
                <div 
                  onClick={() => setSelectedStudent(top3Students[2])}
                  className="cursor-pointer flex flex-col items-center text-center p-2.5 sm:p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-amber-700/40 transition-all active:scale-95 group"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-800 text-amber-100 font-extrabold flex items-center justify-center text-sm shadow-md mb-2 group-hover:scale-110 transition-transform">
                    🥉
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white truncate max-w-full">
                    {top3Students[2].name}
                  </p>
                  <p className="text-[10px] text-white/60 font-medium truncate max-w-full">
                    {top3Students[2].className || 'Öğrenci'}
                  </p>
                  <div className="mt-2 font-serif font-extrabold text-sm sm:text-base text-amber-300 tabular-nums">
                    {(top3Students[2].displayPoints !== undefined ? top3Students[2].displayPoints : top3Students[2].leaguePoints) || 0} LP
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 6. Akademi Arena Liderlik Sıralaması */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xs border border-brand-border/80 flex-1 flex flex-col">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-brand-border/60">
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-brand-ink">
                  Arena Liderlik Sıralaması
                </h3>
                <p className="text-xs text-brand-ink/50 mt-0.5">
                  {selectedMonth === 'all' ? "Tüm zamanların toplam LP sıralaması" : "Aylık performans LP sıralaması"} • Toplam {filteredStudents.length} öğrenci listeleniyor
                </p>
              </div>

              <div className="text-xs font-semibold text-brand-ink/60 bg-[#FAF9F6] px-3 py-1.5 rounded-xl border border-brand-border/60 self-stretch sm:self-auto text-center">
                Detaylar için öğrenciye tıklayın 👆
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left min-w-[640px] border-collapse">
                <thead>
                  <tr className="text-[11px] text-brand-ink/50 uppercase tracking-wider border-b border-brand-border/70 font-bold bg-[#FAF9F6]/60">
                    <th className="py-3 px-3 w-16 text-center">Sıra</th>
                    <th className="py-3 px-3 min-w-[200px]">Öğrenci Adı & Sınıf</th>
                    <th className="py-3 px-3 w-44">Takımı</th>
                    <th className="py-3 px-3 text-center w-32">
                      {selectedMonth === 'all' ? 'Toplam LP' : 'Aylık LP'}
                    </th>
                    <th className="py-3 px-3 min-w-[220px]">Kazanılan Rozetler</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-brand-border/40">
                  {filteredStudents.map((s, idx) => (
                    <tr 
                      key={s.id ? `table-${s.id}` : `table-${s.no || (s as any).name}-${idx}`} 
                      className="hover:bg-[#FAF9F6] cursor-pointer transition-colors group"
                      onClick={() => setSelectedStudent(s)}
                    >
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold font-mono ${
                          idx === 0 ? 'bg-amber-400 text-black shadow-2xs font-black ring-1 ring-amber-300' : 
                          idx === 1 ? 'bg-slate-300 text-black shadow-2xs font-black ring-1 ring-slate-200' : 
                          idx === 2 ? 'bg-amber-800 text-white shadow-2xs font-black ring-1 ring-amber-700' : 
                          idx < 10 ? 'bg-[#FAF9F6] border border-brand-border font-bold text-brand-ink' :
                          'bg-[#F2EFE9]/60 text-brand-ink/60'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand-ink group-hover:text-amber-900 transition-colors">
                            {s.name}
                          </span>
                          {s.className && (
                            <span className="bg-[#FAF9F6] text-brand-ink/60 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-brand-border/60">
                              {s.className}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border shadow-2xs ${
                          s.leagueTeam === 'Kutup Yıldızları' ? 'bg-amber-50 text-amber-950 border-amber-200/80' : 
                          s.leagueTeam === 'Sıçrama Ustaları' ? 'bg-blue-50 text-blue-950 border-blue-200/80' :
                          s.leagueTeam === 'Taktik Avcıları' ? 'bg-emerald-50 text-emerald-950 border-emerald-200/80' : 
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          <span>
                            {s.leagueTeam === 'Kutup Yıldızları' ? '⭐' :
                             s.leagueTeam === 'Sıçrama Ustaları' ? '🚀' :
                             s.leagueTeam === 'Taktik Avcıları' ? '🛡️' : '⚪'}
                          </span>
                          <span>{s.leagueTeam || 'Atanmadı'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-serif font-bold text-emerald-800 text-base tabular-nums">
                        {(s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0} LP
                      </td>
                      <td className="py-3 px-3">
                        {renderBadges((s.displayBadges || s.badges), s.leagueTeam)}
                      </td>
                    </tr>
                  ))}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-brand-ink/50 italic bg-[#FAF9F6]/40 rounded-xl">
                        Arama kriterlerine uygun öğrenci bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Modern Cards View */}
            <div className="md:hidden flex flex-col gap-2.5">
              {filteredStudents.map((s, idx) => {
                const lpPoints = (s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0;
                return (
                  <div 
                    key={s.id ? `card-${s.id}` : `card-${s.no || (s as any).name}-${idx}`}
                    onClick={() => setSelectedStudent(s)}
                    className="bg-[#FAF9F6] rounded-2xl p-3.5 border border-brand-border/80 shadow-2xs flex flex-col gap-2 active:scale-98 transition-all cursor-pointer hover:border-brand-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-7 h-7 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-black shadow-2xs font-black' : 
                          idx === 1 ? 'bg-slate-300 text-black shadow-2xs font-black' : 
                          idx === 2 ? 'bg-amber-800 text-white shadow-2xs font-black' : 
                          'bg-white border border-brand-border/80 text-brand-ink/70'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-brand-ink truncate">{s.name}</p>
                          {s.className && (
                            <p className="text-[10px] text-brand-ink/50 font-semibold">{s.className}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border inline-block ${
                          s.leagueTeam === 'Kutup Yıldızları' ? 'bg-amber-50 text-amber-900 border-amber-200/80' : 
                          s.leagueTeam === 'Sıçrama Ustaları' ? 'bg-blue-50 text-blue-900 border-blue-200/80' :
                          s.leagueTeam === 'Taktik Avcıları' ? 'bg-emerald-50 text-emerald-900 border-emerald-200/80' : 
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {s.leagueTeam || 'Atanmadı'}
                        </span>
                        <div className="font-serif font-bold text-sm text-emerald-800 tabular-nums mt-0.5">
                          {lpPoints} LP
                        </div>
                      </div>
                    </div>

                    {/* Rozetler Alanı */}
                    <div className="border-t border-brand-border/50 pt-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                      <div className="flex-1">
                        {renderBadges((s.displayBadges || s.badges), s.leagueTeam, true)}
                      </div>
                      <ChevronRight className="w-4 h-4 text-brand-ink/30 shrink-0" />
                    </div>
                  </div>
                );
              })}

              {filteredStudents.length === 0 && (
                <div className="text-center py-10 text-brand-ink/50 italic bg-[#FAF9F6] rounded-2xl border border-brand-border/60 p-4">
                  Arama kriterlerine uygun öğrenci bulunamadı.
                </div>
              )}
            </div>
          </div>

          {/* 7. Takım Detay Modalı */}
          {selectedTeam && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-all" onClick={() => setSelectedTeam(null)}>
              <div 
                className="bg-white w-full max-w-2xl rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0 border border-brand-border/60"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-brand-border/60 bg-[#FAF9F6] rounded-t-[28px] sm:rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shadow-2xs ${
                      selectedTeam === 'Kutup Yıldızları' ? 'bg-amber-500' :
                      selectedTeam === 'Sıçrama Ustaları' ? 'bg-blue-500' : 'bg-emerald-600'
                    }`}>
                      {selectedTeam === 'Kutup Yıldızları' ? <Trophy className="w-6 h-6" /> :
                       selectedTeam === 'Sıçrama Ustaları' ? <TrendingUp className="w-6 h-6" /> :
                       <Shield className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-ink">{selectedTeam}</h3>
                      <p className="text-xs text-brand-ink/50">
                        {selectedTeam === 'Kutup Yıldızları' ? '400+ Puan Ligi' :
                         selectedTeam === 'Sıçrama Ustaları' ? '300 – 399 Puan Ligi' : '0 – 299 Puan Ligi'} • Kadro Listesi
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTeam(null)}
                    className="p-2 text-brand-ink/40 hover:text-brand-ink hover:bg-gray-100 rounded-full transition-colors active:scale-95 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Roster List */}
                <div className="p-4 sm:p-6 overflow-y-auto">
                  <table className="w-full text-left min-w-full">
                    <thead>
                      <tr className="text-[11px] text-brand-ink/50 uppercase tracking-wider border-b border-brand-border/60 font-bold">
                        <th className="pb-3">Öğrenci Adı</th>
                        <th className="pb-3 text-center">LP Skoru</th>
                        <th className="pb-3">Kazanılan Rozetler</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-brand-border/40">
                      {baseStudents
                        .filter(s => s.leagueTeam === selectedTeam)
                        .sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0))
                        .map((s, idx) => (
                          <tr 
                            key={s.id ? `modal-${s.id}` : `modal-${s.no || (s as any).name}-${idx}`} 
                            className="hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedTeam(null);
                              setSelectedStudent(s);
                            }}
                          >
                            <td className="py-3 font-bold text-brand-ink">
                              <div>
                                <p>{s.name}</p>
                                {s.className && <span className="text-[10px] text-brand-ink/50 font-normal">{s.className}</span>}
                              </div>
                            </td>
                            <td className="py-3 text-center font-serif font-bold text-emerald-800 tabular-nums">
                              {(s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0} LP
                            </td>
                            <td className="py-3">
                              {renderBadges((s.displayBadges || s.badges), s.leagueTeam, true)}
                            </td>
                          </tr>
                        ))}
                      {baseStudents.filter(s => s.leagueTeam === selectedTeam).length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-brand-ink/50 italic bg-[#FAF9F6]/40 rounded-xl">
                            Bu takımda henüz kayıtlı öğrenci bulunmuyor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 8. Aylık Takım Taktikleri Modalı (Mobil & Masaüstü Optimize) */}
          {showTactics && (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-all" onClick={() => setShowTactics(false)}>
              <div 
                className="bg-white w-full max-w-5xl rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0 border border-brand-border/60"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-brand-border/60 bg-[#FAF9F6] rounded-t-[28px] sm:rounded-t-3xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-2xs">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-xl font-bold font-serif text-brand-ink">
                        Aylık Takım Görevleri & Taktikler
                      </h3>
                      <p className="text-xs text-brand-ink/50">
                        Her ay için takımlara özel stratejik gelişim hedefleri
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Yazdır</span>
                    </button>
                    <button
                      onClick={() => setShowTactics(false)}
                      className="p-2 text-brand-ink/40 hover:text-brand-ink hover:bg-gray-100 rounded-full transition-colors active:scale-95 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto">
                  
                  {/* Mobile View: Month Tabs & Clean Cards */}
                  <div className="sm:hidden space-y-4">
                    {/* Month selector chips */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {tacticsMonths.map((m, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveTacticsMonth(i)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                            activeTacticsMonth === i
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-[#FAF9F6] border border-brand-border/70 text-brand-ink/70'
                          }`}
                        >
                          {m.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>

                    {/* Active Month Missions Card */}
                    {(() => {
                      const item = tacticsMonths[activeTacticsMonth];
                      return (
                        <div className="space-y-3">
                          <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-200">
                            <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider mb-1">
                              📅 {item.name}
                            </h4>
                            <p className="text-xs text-purple-900 font-medium">
                              🏆 <strong>Ortak DYK & Takım Görevi:</strong> {item.ortak}
                            </p>
                          </div>

                          <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 space-y-1">
                            <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <span>⭐</span>
                              <span>Kutup Yıldızları (A Takımı)</span>
                            </p>
                            <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                              {item.kutup}
                            </p>
                          </div>

                          <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80 space-y-1">
                            <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                              <span>🚀</span>
                              <span>Sıçrama Ustaları (B Takımı)</span>
                            </p>
                            <p className="text-xs text-blue-900/90 leading-relaxed font-medium">
                              {item.sicrama}
                            </p>
                          </div>

                          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 space-y-1">
                            <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                              <span>🛡️</span>
                              <span>Taktik Avcıları (C Takımı)</span>
                            </p>
                            <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                              {item.taktik}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Desktop View: Full Responsive Matrix Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-brand-border/80">
                      <thead>
                        <tr className="bg-[#FAF9F6] text-xs text-brand-ink font-bold">
                          <th className="p-3 border border-brand-border/80 w-32">Aylar</th>
                          <th className="p-3 border border-brand-border/80 text-amber-900 bg-amber-50/50">⭐ Kutup Yıldızları</th>
                          <th className="p-3 border border-brand-border/80 text-blue-900 bg-blue-50/50">🚀 Sıçrama Ustaları</th>
                          <th className="p-3 border border-brand-border/80 text-emerald-900 bg-emerald-50/50">🛡️ Taktik Avcıları</th>
                          <th className="p-3 border border-brand-border/80 bg-purple-50/50 text-purple-950">🏆 Ortak DYK Görevi</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-brand-border/40">
                        {tacticsMonths.map((m, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/60">
                            <td className="p-3 font-bold border border-brand-border/80 bg-[#FAF9F6] text-brand-ink">{m.name}</td>
                            <td className="p-3 border border-brand-border/80 text-brand-ink/90 leading-relaxed">{m.kutup}</td>
                            <td className="p-3 border border-brand-border/80 text-brand-ink/90 leading-relaxed">{m.sicrama}</td>
                            <td className="p-3 border border-brand-border/80 text-brand-ink/90 leading-relaxed">{m.taktik}</td>
                            <td className="p-3 border border-brand-border/80 bg-purple-50/20 text-purple-950 font-medium leading-relaxed">{m.ortak}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* 9. Öğrenci Detay Modalı (Bottom sheet on Mobile, Modal on Desktop) */}
          {selectedStudent && (() => {
            const studentResult = state.results.find(r => r.studentNo === selectedStudent.no && selectedStudent.no !== 0);
            
            const allHistory = state.exams
              .filter(e => studentResult?.scores?.[e.name])
              .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
              .map(e => ({
                score: studentResult!.scores[e.name],
                details: studentResult!.details?.[e.name]?.lessons,
                name: e.name,
                date: e.date
              }));
              
            const rawHistory = allHistory.map((h, i) => {
              const pastExams = allHistory.slice(0, i);
              const prevAverage = pastExams.length > 0 ? (pastExams.reduce((sum, p) => sum + p.score, 0) / pastExams.length) : 0;
              let pastTeam = pastExams.length > 0 ? determineLeagueTeam(prevAverage) : 'Taktik Avcıları';
              if (pastTeam === 'Atanmadı') pastTeam = 'Taktik Avcıları';
              const { earnedLP, badgeCounts } = calculateAtaLigPoints(h.score, prevAverage, h.details, pastExams, pastTeam);
              
              let finalEarnedLP = earnedLP;
              
              // Re-calculate Anka Kusu for this specific exam
              const transfer = selectedStudent.transferHistory?.find((th: any) => th.examName === h.name);
              if (transfer && transfer.from === 'Taktik Avcıları' && (transfer.to === 'Sıçrama Ustaları' || transfer.to === 'Kutup Yıldızları')) {
                finalEarnedLP += 100;
                badgeCounts.ankaKusu = 1;
              }
              
              return {
                examName: h.name,
                date: h.date,
                score: h.score,
                earnedLP: finalEarnedLP,
                badgeCounts
              };
            }).reverse(); // newest first

            const history = rawHistory.filter(h => {
              if (selectedMonth === 'all') return true;
              if (h.date) {
                const dateObj = parseDate(h.date);
                const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                return mKey === selectedMonth;
              }
              return false;
            });

            const studentRank = baseStudents.findIndex(s => s.no === selectedStudent.no) + 1;

            return (
              <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-all" onClick={() => setSelectedStudent(null)}>
                <div 
                  className="bg-white w-full max-w-2xl rounded-t-[28px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0 border border-brand-border/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 sm:p-6 border-b border-brand-border/60 bg-[#FAF9F6] rounded-t-[28px] sm:rounded-t-3xl">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-900 border border-amber-300 font-bold flex items-center justify-center text-base shrink-0 shadow-2xs">
                        {selectedStudent.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-xl font-bold font-serif text-brand-ink">{selectedStudent.name}</h3>
                          {selectedStudent.className && (
                            <span className="text-xs font-semibold bg-white border border-brand-border/80 px-2 py-0.5 rounded-md">
                              {selectedStudent.className}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-ink/60 mt-0.5">
                          {selectedStudent.leagueTeam || 'Takım Atanmadı'} • Arena Sırası: <strong>#{studentRank}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="p-2 text-brand-ink/40 hover:text-brand-ink hover:bg-gray-100 rounded-full transition-colors active:scale-95 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Modal Content */}
                  <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                    
                    {/* Key Stats Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-brand-border/70 text-center">
                        <p className="text-[10px] uppercase font-bold text-brand-ink/50 tracking-wider">
                          {selectedMonth === 'all' ? 'Toplam LP' : 'Aylık LP'}
                        </p>
                        <p className="text-xl sm:text-2xl font-serif font-black text-emerald-800 tabular-nums mt-0.5">
                          {(selectedStudent.displayPoints !== undefined ? selectedStudent.displayPoints : selectedStudent.leaguePoints) || 0} LP
                        </p>
                      </div>

                      <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-brand-border/70 text-center">
                        <p className="text-[10px] uppercase font-bold text-brand-ink/50 tracking-wider">Lig Sıralaması</p>
                        <p className="text-xl sm:text-2xl font-serif font-black text-amber-700 tabular-nums mt-0.5">
                          #{studentRank}
                        </p>
                      </div>

                      <div className="bg-[#FAF9F6] p-3 rounded-2xl border border-brand-border/70 text-center col-span-2 sm:col-span-1">
                        <p className="text-[10px] uppercase font-bold text-brand-ink/50 tracking-wider">Girdiği Sınavlar</p>
                        <p className="text-xl sm:text-2xl font-serif font-black text-blue-700 tabular-nums mt-0.5">
                          {history.length} Deneme
                        </p>
                      </div>
                    </div>

                    {/* Transfer History */}
                    {selectedStudent.transferHistory && selectedStudent.transferHistory.length > 0 && (() => {
                      const filteredTransfers = selectedStudent.transferHistory.filter((th: any) => {
                        if (selectedMonth === 'all') return true;
                        if (th.date) {
                          const dateObj = parseDate(th.date);
                          const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                          return mKey === selectedMonth;
                        }
                        return false;
                      });
                      if (filteredTransfers.length === 0) return null;
                      return (
                        <div>
                          <h4 className="font-bold text-xs uppercase tracking-wider text-brand-ink/70 mb-2.5 flex items-center gap-1.5">
                            <span>🔄</span>
                            <span>Lig Transfer Geçmişi</span>
                          </h4>
                          <div className="space-y-2">
                            {filteredTransfers.map((th: any, idx: number) => (
                              <div key={idx} className="bg-[#FAF9F6] border border-brand-border/70 rounded-xl p-3 flex justify-between items-center shadow-2xs">
                                <div>
                                  <p className="text-xs font-bold text-brand-ink">{th.from} ➔ {th.to}</p>
                                  <p className="text-[11px] text-brand-ink/60 font-medium">{th.examName}</p>
                                </div>
                                <div className="text-[10px] font-semibold text-brand-ink/60 bg-white px-2 py-1 rounded-md border border-brand-border/60">
                                  {parseDate(th.date).toLocaleDateString('tr-TR')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Exam History Timeline */}
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-brand-ink/70 mb-2.5 flex items-center gap-1.5">
                        <span>📋</span>
                        <span>Sınav Bazlı LP ve Rozet Kazanımları</span>
                      </h4>

                      {history.length > 0 ? (
                        <div className="space-y-3">
                          {history.map((h, i) => (
                            <div key={i} className="bg-white border border-brand-border/70 rounded-2xl p-3.5 shadow-2xs space-y-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h5 className="font-bold text-xs sm:text-sm text-brand-ink">{h.examName}</h5>
                                  <p className="text-[11px] font-medium text-brand-ink/60">
                                    {parseDate(h.date).toLocaleDateString('tr-TR')} • Puan: <span className="font-bold text-blue-700">{h.score.toFixed(2)}</span>
                                  </p>
                                </div>
                                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono shadow-2xs ${
                                  h.earnedLP > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80' : 
                                  h.earnedLP < 0 ? 'bg-rose-100 text-rose-800 border border-rose-200/80' : 
                                  'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}>
                                  {h.earnedLP > 0 ? '+' : ''}{h.earnedLP} LP
                                </div>
                              </div>

                              {/* Rozetler */}
                              <div className="bg-[#FAF9F6] p-2.5 rounded-xl border border-brand-border/60 flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-bold text-brand-ink/50 uppercase tracking-wider shrink-0 mr-1">
                                  Rozetler:
                                </span>
                                {renderBadges(h.badgeCounts, selectedStudent.leagueTeam)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-ink/50 italic text-center py-8 bg-[#FAF9F6] rounded-xl border border-brand-border/60">
                          Seçilen dönemde sınav kaydı bulunmuyor.
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

    </div>
  );
};

export default LeagueView;
