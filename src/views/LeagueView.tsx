import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Trophy, TrendingUp, Shield, Crown, ArrowUpRight, ArrowDownRight, 
  Info, X, BookOpen, ChevronDown, Search, Filter, Sparkles, Flame,
  Award, Users, Calendar, CheckCircle2, ChevronRight, UserCheck,
  ChevronLeft, Printer, RefreshCw, Star, Layers, ArrowRight
} from 'lucide-react';
import { determineLeagueTeam, calculateAtaLigPoints, parseDate, normalizeTurkish } from '../lib/utils';
import { ALL_BADGE_DEFINITIONS, getBadgeDefinition, BadgeDefinition, BADGE_POINTS, normalizeBadgeKey } from '../lib/badgeDefinitions';
import RulesView from './RulesView';

export const LeagueView = () => {
  const { state, updateLeagueSettings, approveTransfer, userRole, fetchMonthArenaPartition } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'rules'>('dashboard');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [modalShowAllExams, setModalShowAllExams] = useState(false);
  const [modalBadgeScope, setModalBadgeScope] = useState<'period' | 'all'>('period');
  
  const handleSelectStudent = (st: any) => {
    setSelectedStudent(st);
    setModalBadgeScope('period');
    setModalShowAllExams(false);
  };
  
  // Rozet Bilgilendirme ve Kılavuz Modalları
  const [selectedBadgeModal, setSelectedBadgeModal] = useState<BadgeDefinition | null>(null);
  const [showBadgesGuideModal, setShowBadgesGuideModal] = useState<boolean>(false);
  
  // Current month key (YYYY-MM format based on local calendar)
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Filtering states - defaults automatically to current month
  const [selectedGrade, setSelectedGrade] = useState<string>('8');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination / Load More state for leaderboard (starts at 30)
  const [visibleCount, setVisibleCount] = useState<number>(30);

  // Reset pagination whenever filters or search query change
  useEffect(() => {
    setVisibleCount(30);
  }, [selectedGrade, selectedMonth, selectedTeamFilter, searchQuery]);
  
  // Dropdown states
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isGradeDropdownOpen, setIsGradeDropdownOpen] = useState(false);
  
  // Tactics modal state
  const [activeTacticsMonth, setActiveTacticsMonth] = useState<number>(0);
  const [isTacticsMonthOpen, setIsTacticsMonthOpen] = useState(false);
  const [tacticsTeamFilter, setTacticsTeamFilter] = useState<'all' | 'kutup' | 'sicrama' | 'taktik' | 'ortak'>('all');

  // Auto-fetch partitioned month data when user selects a specific month
  useEffect(() => {
    if (selectedMonth && selectedMonth !== 'all') {
      fetchMonthArenaPartition(selectedMonth).catch(() => {});
    }
  }, [selectedMonth]);

  // Reset modal exam toggle when opening a student modal
  useEffect(() => {
    setModalShowAllExams(false);
  }, [selectedStudent]);

  const mentors = state.leagueMentors || {};
  const bonusPoints = state.leagueTeamPoints || {};

  const monthPartition = useMemo(() => {
    return selectedMonth !== 'all' ? (state.arenaMonthlyData?.[selectedMonth] || null) : null;
  }, [selectedMonth, state.arenaMonthlyData]);

  const getGradeLevel = (cls: string) => {
    const match = cls?.trim().match(/^(\d+)/);
    return match ? match[1] : null;
  };

  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    (state.students || []).forEach(s => {
      if (s.className) classes.add(s.className.trim());
    });
    (state.exams || []).forEach(e => {
      (e.results || []).forEach((r: any) => {
        if (r.studentClass) classes.add(r.studentClass.trim());
        if (r.classStr && r.sectionStr) classes.add(`${r.classStr}-${r.sectionStr}`.trim());
      });
    });
    (state.results || []).forEach(r => {
      const matchedStudent = state.students.find(s => s.no === r.studentNo);
      const displayClass = matchedStudent ? matchedStudent.className : r.studentClass;
      if (displayClass) classes.add(displayClass.trim());
    });
    return Array.from(classes).sort();
  }, [state.results, state.students, state.exams]);

  const allAcademicMonths = useMemo(() => {
    const monthMap = new Map<string, { key: string; label: string; shortLabel: string; hasData: boolean; examCount: number; timestamp: number }>();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    // 1. Collect only months from exams that actually have a valid date
    state.exams.forEach(e => {
      if (!e.date) return;
      const d = parseDate(e.date);
      if (isNaN(d.getTime())) return;
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const k = `${yr}-${String(mo).padStart(2, '0')}`;
      
      const existing = monthMap.get(k);
      if (existing) {
        existing.examCount += 1;
      } else {
        monthMap.set(k, {
          key: k,
          label: `${monthNames[mo - 1]} ${yr}`,
          shortLabel: monthNames[mo - 1],
          hasData: true,
          examCount: 1,
          timestamp: new Date(yr, mo - 1, 1).getTime()
        });
      }
    });

    // 2. Also check if any partitioned arena month has data
    if (state.arenaMonthlyData) {
      Object.entries(state.arenaMonthlyData).forEach(([k, data]: [string, any]) => {
        if (!k || k === 'all') return;
        const [yrStr, moStr] = k.split('-');
        const yr = parseInt(yrStr);
        const mo = parseInt(moStr);
        if (!yr || !mo || isNaN(yr) || isNaN(mo)) return;
        
        const count = data?.examCount || 0;
        const existing = monthMap.get(k);
        if (existing) {
          if (count > existing.examCount) existing.examCount = count;
        } else if (count > 0 || (data?.studentsSummary && data.studentsSummary.length > 0)) {
          monthMap.set(k, {
            key: k,
            label: `${monthNames[mo - 1]} ${yr}`,
            shortLabel: monthNames[mo - 1],
            hasData: true,
            examCount: count,
            timestamp: new Date(yr, mo - 1, 1).getTime()
          });
        }
      });
    }

    // 3. Ensure current ongoing month is always present so it automatically matches and defaults
    if (!monthMap.has(currentMonthKey)) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      monthMap.set(currentMonthKey, {
        key: currentMonthKey,
        label: `${monthNames[mo - 1]} ${yr}`,
        shortLabel: monthNames[mo - 1],
        hasData: false,
        examCount: 0,
        timestamp: new Date(yr, mo - 1, 1).getTime()
      });
    }

    // Sort chronologically (oldest to newest academic flow)
    return Array.from(monthMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [state.exams, state.arenaMonthlyData, currentMonthKey]);

  const selectedMonthLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'Tüm Zamanlar';
    const found = allAcademicMonths.find(m => m.key === selectedMonth);
    if (found) return found.label;
    const [year, month] = selectedMonth.split('-');
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${monthNames[parseInt(month) - 1] || month} ${year}`;
  }, [selectedMonth, allAcademicMonths]);

  const availableMonths = useMemo(() => {
    return allAcademicMonths.map(m => m.key);
  }, [allAcademicMonths]);

  // Safety fallback if selectedMonth has no data or is not present in available exam months
  useEffect(() => {
    if (selectedMonth !== 'all' && allAcademicMonths.length > 0) {
      const currentSelected = allAcademicMonths.find(m => m.key === selectedMonth);
      if (!currentSelected || currentSelected.examCount === 0) {
        const monthsWithExams = allAcademicMonths.filter(m => m.hasData && m.examCount > 0);
        if (monthsWithExams.length > 0) {
          // Otomatik olarak sınavı olan en güncel aya konumlan
          setSelectedMonth(monthsWithExams[monthsWithExams.length - 1].key);
        } else if (!currentSelected) {
          setSelectedMonth('all');
        }
      }
    }
  }, [allAcademicMonths, selectedMonth]);

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

  // 1. Pre-index exam participations by student in a single pass O(E * R)
  // This turns what was O(S * E * R) nested scans into instant O(1) map lookups.
  const studentExamsMap = useMemo(() => {
    const map = new Map<string, Array<{ examId: string; name: string; date: string; score: number; details: any; examRes: any }>>();

    const pushItem = (key: string, item: any) => {
      if (!key) return;
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      const existingIdx = list.findIndex(e => e.examId === item.examId || (item.name && e.name === item.name));
      if (existingIdx >= 0) {
        // Son yüklenen sınav sonucu geçerli kabul edilir (mükerrerliği önleme)
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
    };

    (state.exams || []).forEach(exam => {
      (exam.results || []).forEach((r: any) => {
        const rNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : 0);
        const rId = r.studentId || r.id;
        const rNameNorm = (r.name || r.studentName) ? normalizeTurkish(r.name || r.studentName).trim().toLowerCase() : '';

        const score = Number(
          r.evaluatedScore?.total?.lgsScore ??
          r.lgsScore ??
          r.evaluatedScore?.total?.net ??
          r.net ??
          r.average ??
          0
        );

        const details = r.evaluatedScore?.subjectScores || r.scores;

        const item = {
          examId: String(exam.id),
          name: exam.name,
          date: exam.date,
          score,
          details,
          examRes: r
        };

        if (rNo > 0) pushItem(`no_${rNo}`, item);
        if (rId) pushItem(`id_${rId}`, item);
        if (rNameNorm) pushItem(`name_${rNameNorm}`, item);
      });
    });

    const activeExamNames = new Set((state.exams || []).map(e => e.name));
    const activeExamIds = new Set((state.exams || []).map(e => String(e.id)));

    (state.results || []).forEach((r: any) => {
      const rNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : 0);
      const rId = r.studentId || r.id;
      const rNameNorm = (r.name || r.studentName) ? normalizeTurkish(r.name || r.studentName).trim().toLowerCase() : '';

      if (r.scores && typeof r.scores === 'object') {
        Object.entries(r.scores).forEach(([examKey, scoreVal]) => {
          // Sadece aktif sınavlar havuzunda yer alan sınavları dahil et (silinen sınavların skoru sızmaz)
          if (!activeExamNames.has(examKey) && !activeExamIds.has(examKey)) return;
          if (typeof scoreVal === 'number' && scoreVal > 0) {
            const matchingExam = (state.exams || []).find(e => String(e.id) === examKey || e.name === examKey);
            const canonicalId = matchingExam ? String(matchingExam.id) : examKey;
            const canonicalName = matchingExam ? matchingExam.name : examKey;
            const canonicalDate = matchingExam?.date || r.date || '';

            const item = {
              examId: canonicalId,
              name: canonicalName,
              date: canonicalDate,
              score: Number(scoreVal),
              details: r.details?.[examKey]?.lessons || r.details?.lessons || r.evaluatedScore?.subjectScores,
              examRes: r
            };
            if (rNo > 0) pushItem(`no_${rNo}`, item);
            if (rId) pushItem(`id_${rId}`, item);
            if (rNameNorm) pushItem(`name_${rNameNorm}`, item);
          }
        });
      }
    });

    return map;
  }, [state.exams, state.results]);

  // Base list of students filtered by grade and monthly calculation
  const baseStudents = useMemo(() => {
    return state.students.map(s => {
      const sNo = Number(s.no) || 0;
      const sId = s.id ? String(s.id) : '';
      const sNameNorm = s.name ? normalizeTurkish(s.name).trim().toLowerCase() : '';

      // Instant O(1) map queries
      const fromNo = sNo > 0 ? (studentExamsMap.get(`no_${sNo}`) || []) : [];
      const fromId = sId ? (studentExamsMap.get(`id_${sId}`) || []) : [];
      const fromName = sNameNorm ? (studentExamsMap.get(`name_${sNameNorm}`) || []) : [];

      const examListMap = new Map<string, any>();
      for (const e of [...fromNo, ...fromId, ...fromName]) {
        // Find canonical exam in state.exams
        const matched = (state.exams || []).find(ex => String(ex.id) === String(e.examId) || ex.name === e.name);
        const canonKey = matched ? String(matched.id) : (e.examId || e.name);
        if (!examListMap.has(canonKey)) {
          examListMap.set(canonKey, e);
        } else {
          const existing = examListMap.get(canonKey);
          if ((!existing.date && e.date) || (!existing.details && e.details)) {
            examListMap.set(canonKey, e);
          }
        }
      }
      const studentExams = Array.from(examListMap.values());
      studentExams.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

      const hasLeaguePoints = Boolean((s.leaguePoints && s.leaguePoints > 0) || (s as any).monthlyLeagueData);
      const hasExams = studentExams.length > 0 || hasLeaguePoints;

      // Grade filtering check
      let matchesGrade = true;
      if (selectedGrade !== 'all') {
        const lvl = getGradeLevel(s.className);
        if (selectedGrade === 'Diğer') {
          matchesGrade = !lvl;
        } else {
          matchesGrade = lvl === selectedGrade;
        }
      }

      if (!matchesGrade || !hasExams) return null;

      // Rozetler ve LP puanları sadece aktif sınavlardan dinamik olarak türetilir
      const allStudentBadges: Record<string, number> = {};
      let calculatedTotalLP = 0;
      const monthlyLPAccum: Record<string, number> = {};
      const monthlyBadgesAccum: Record<string, Record<string, number>> = {};

      studentExams.forEach((h, i) => {
        const pastExams = studentExams.slice(0, i);
        const prevAverage = pastExams.length > 0 ? (pastExams.reduce((sum, p) => sum + p.score, 0) / pastExams.length) : 0;
        let pastTeam = pastExams.length > 0 ? determineLeagueTeam(prevAverage) : 'Taktik Avcıları';
        if (pastTeam === 'Atanmadı') pastTeam = 'Taktik Avcıları';

        const { earnedLP: calculatedLP, badgeCounts } = calculateAtaLigPoints(h.score, prevAverage, h.details, pastExams, pastTeam);

        // Sınavda saklanmış earnedBadges varsa eksiksiz dahil et
        if (Array.isArray(h.examRes?.earnedBadges)) {
          h.examRes.earnedBadges.forEach((bName: string) => {
            const norm = normalizeBadgeKey(bName) || normalizeTurkish(bName).toLowerCase().replace(/[\s\.]+/g, '');
            if (norm in badgeCounts) {
              (badgeCounts as any)[norm] = Math.max((badgeCounts as any)[norm] || 0, 1);
            }
          });
        }

        // Transfer geçmişinden Anka Kuşu kontrolü (Bu sınava özel)
        const transfer = s.transferHistory?.find((th: any) => th.examName === h.name);
        if (transfer && transfer.from === 'Taktik Avcıları' && (transfer.to === 'Sıçrama Ustaları' || transfer.to === 'Kutup Yıldızları')) {
          badgeCounts.ankaKusu = 1;
        }

        // Bu sınavda kazanılan tüm rozetlerin standart LP puanlarını topla
        let badgeLP = 0;
        Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
          if (typeof count === 'number' && count > 0) {
            const pts = BADGE_POINTS[k] || 0;
            badgeLP += pts * count;
          }
        });

        // finalLP: Hesaplanmış LP, rozet LP toplamı ve saklanan LP'den en güvenilir olanı
        let finalLP = Math.max(calculatedLP, badgeLP);
        if (typeof h.examRes?.earnedLP === 'number' && h.examRes.earnedLP > 0) {
          finalLP = Math.max(finalLP, h.examRes.earnedLP);
        }

        calculatedTotalLP += finalLP;

        // Toplam rozet havuzuna ekle
        Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
          if (typeof count === 'number' && count > 0) {
            allStudentBadges[k] = (allStudentBadges[k] || 0) + count;
          }
        });

        // Aylık biriktir (Sınav tarihine göre)
        if (h.date) {
          const dObj = parseDate(h.date);
          if (!isNaN(dObj.getTime())) {
            const mKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
            monthlyLPAccum[mKey] = (monthlyLPAccum[mKey] || 0) + finalLP;
            if (!monthlyBadgesAccum[mKey]) monthlyBadgesAccum[mKey] = {};
            Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
              if (typeof count === 'number' && count > 0) {
                monthlyBadgesAccum[mKey][k] = (monthlyBadgesAccum[mKey][k] || 0) + count;
              }
            });
          }
        }
      });

      // Transfer geçmişinden Anka Kuşu kontrolü (Genel)
      if (s.transferHistory && Array.isArray(s.transferHistory)) {
        s.transferHistory.forEach((th: any) => {
          if (th.from === 'Taktik Avcıları' && (th.to === 'Sıçrama Ustaları' || th.to === 'Kutup Yıldızları')) {
            allStudentBadges.ankaKusu = Math.max(allStudentBadges.ankaKusu || 0, 1);
          }
        });
      }

      // Dinamik lig puanı ve rozetler: Sadece öğrencinin aktif sınavlarına duyarlı saf türetilmiş durum
      let displayPoints = 0;
      let displayBadges: Record<string, number> = {};

      if (studentExams.length > 0) {
        if (selectedMonth === 'all') {
          displayPoints = calculatedTotalLP;
          displayBadges = allStudentBadges;
        } else {
          // Seçili ay için sınavları doğrudan topla (Varsa o ayın puanı, yoksa kesinlikle 0 LP)
          if (monthlyLPAccum[selectedMonth] !== undefined) {
            displayPoints = monthlyLPAccum[selectedMonth];
            displayBadges = monthlyBadgesAccum[selectedMonth] || {};
          } else {
            displayPoints = 0;
            displayBadges = {};
          }
        }
      } else {
        displayPoints = 0;
        displayBadges = {};
      }

      return { 
        ...s, 
        badges: allStudentBadges, 
        allBadges: allStudentBadges,
        displayPoints, 
        displayBadges,
        examCount: studentExams.length 
      };
    }).filter(Boolean).sort((a: any, b: any) => (b.displayPoints || 0) - (a.displayPoints || 0)) as any[];
  }, [state.students, studentExamsMap, selectedGrade, selectedMonth, state.exams]);

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

  // Paginated students slice for ultra-fast rendering (30 initial items)
  const displayedStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleCount);
  }, [filteredStudents, visibleCount]);

  // Team arrays for stats
  const kutup = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Kutup Yıldızları'), [baseStudents]);
  const sicrama = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Sıçrama Ustaları'), [baseStudents]);
  const taktik = useMemo(() => baseStudents.filter(s => s.leagueTeam === 'Taktik Avcıları'), [baseStudents]);

  const calcAvg = (teamName: string, team: any[]) => {
    const getStudentPoints = (s: any) => selectedMonth === 'all'
      ? ((s.displayPoints !== undefined ? s.displayPoints : s.leaguePoints) || 0)
      : (s.displayPoints || 0);

    const activeMembers = team.filter(s => getStudentPoints(s) !== 0);
    if (activeMembers.length === 0) return (selectedMonth === 'all' ? (bonusPoints[teamName] || 0) : 0);
    const total = activeMembers.reduce((acc, s) => acc + getStudentPoints(s), 0);
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
  const renderBadges = (rawBadges?: any, team?: string, compact = false) => {
    if (!rawBadges) return <span className="text-brand-ink/30 text-xs italic">-</span>;

    // Normalize incoming badges to a clean dictionary
    const normCounts: Record<string, number> = {};
    const customBadges: { label: string; count: number }[] = [];

    const mapKey = (rawKey: string): string | null => {
      const k = normalizeTurkish(rawKey).toLowerCase().replace(/[\s\.\-_]+/g, '');
      if (k.includes('lgsfatih')) return 'lgsFatihi';
      if (k.includes('ankakus')) return 'ankaKusu';
      if (k.includes('zirvebekcisi')) return 'zirveBekcisi';
      if (k.includes('ivmesampiyonu')) return 'ivmeSampiyonu';
      if (k.includes('barajyikici')) return 'barajYikici';
      if (k.includes('stratejimuhendisi') || k.includes('stratejimh')) return 'stratejiMuhendisi';
      if (k.includes('istikrarelcisi')) return 'istikrarElcisi';
      if (k.includes('sozelsovalye')) return 'sozelSovalyesi';
      if (k.includes('sayisalkale')) return 'sayisalKalesi';
      if (k.includes('matematikuyanis') || k.includes('matuyanis')) return 'matematikUyanisi';
      if (k.includes('dengecambaz')) return 'dengeCambazi';
      if (k.includes('keskinnisan')) return 'keskinNisanci';
      if (k.includes('temelatici')) return 'temelAtici';
      if (k.includes('filozof')) return 'filozof';
      if (k.includes('newton')) return 'newton';
      if (k.includes('pisagor')) return 'pisagor';
      if (k.includes('uyuyandev')) return 'uyuyanDev';
      if (k.includes('sabirtasi')) return 'sabirTasi';
      if (k.includes('yinyang')) return 'yinYang';
      if (k.includes('kalkan')) return 'kalkan';
      if (k.includes('zirve')) return 'zirve';
      if (k.includes('ivme')) return 'ivme';
      if (k.includes('tamisabet')) return 'tamIsabet';
      if (k.includes('kirmizikart')) return 'kirmiziKart';
      if (k.includes('takimruhu')) return 'takimRuhu';
      return null;
    };

    if (Array.isArray(rawBadges)) {
      rawBadges.forEach(item => {
        if (!item) return;
        const name = typeof item === 'string' ? item : (item.name || item.label || '');
        const mapped = mapKey(name);
        if (mapped) {
          normCounts[mapped] = (normCounts[mapped] || 0) + (typeof item === 'object' && item.count ? item.count : 1);
        } else if (name) {
          customBadges.push({ label: name, count: 1 });
        }
      });
    } else if (typeof rawBadges === 'object') {
      Object.entries(rawBadges).forEach(([key, val]) => {
        const count = typeof val === 'number' ? val : (Number(val) || 0);
        if (count <= 0) return;
        const mapped = mapKey(key);
        if (mapped) {
          normCounts[mapped] = (normCounts[mapped] || 0) + count;
        } else {
          customBadges.push({ label: key, count });
        }
      });
    }

    const list: { key: string; label: string; icon: string; count: number; bg: string; text: string; border: string }[] = [];

    // Efsanevi
    if (normCounts.lgsFatihi > 0) list.push({ key: 'lf', label: 'LGS Fatihi', icon: '🏆', count: normCounts.lgsFatihi, bg: 'bg-amber-500', text: 'text-white font-extrabold', border: 'border-amber-400' });
    if (normCounts.ankaKusu > 0) list.push({ key: 'ak', label: 'Anka Kuşu', icon: '🔥', count: normCounts.ankaKusu, bg: 'bg-gradient-to-r from-orange-500 to-amber-500', text: 'text-white font-extrabold', border: 'border-orange-400' });

    // Uzmanlık
    if (normCounts.zirveBekcisi > 0) list.push({ key: 'zb', label: 'Zirve Bekçisi', icon: '🏰', count: normCounts.zirveBekcisi, bg: 'bg-fuchsia-100', text: 'text-fuchsia-900 font-bold', border: 'border-fuchsia-200' });
    if (normCounts.ivmeSampiyonu > 0) list.push({ key: 'is', label: 'İvme Şampiyonu', icon: '⚡', count: normCounts.ivmeSampiyonu, bg: 'bg-cyan-100', text: 'text-cyan-900 font-bold', border: 'border-cyan-200' });
    if (normCounts.barajYikici > 0) list.push({ key: 'by', label: 'Baraj Yıkıcı', icon: '🔨', count: normCounts.barajYikici, bg: 'bg-orange-100', text: 'text-orange-900 font-bold', border: 'border-orange-200' });
    if (normCounts.stratejiMuhendisi > 0) list.push({ key: 'sm', label: 'Strateji Mh.', icon: '🧠', count: normCounts.stratejiMuhendisi, bg: 'bg-indigo-100', text: 'text-indigo-900 font-bold', border: 'border-indigo-200' });
    if (normCounts.istikrarElcisi > 0) list.push({ key: 'ie', label: 'İstikrar Elçisi', icon: '🕊️', count: normCounts.istikrarElcisi, bg: 'bg-teal-100', text: 'text-teal-900 font-bold', border: 'border-teal-200' });

    // Takım
    if (normCounts.sozelSovalyesi > 0) list.push({ key: 'ss', label: 'Sözel Şövalyesi', icon: '📜', count: normCounts.sozelSovalyesi, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (normCounts.sayisalKalesi > 0) list.push({ key: 'sk', label: 'Sayısal Kalesi', icon: '🏰', count: normCounts.sayisalKalesi, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (normCounts.matematikUyanisi > 0) list.push({ key: 'mu', label: 'Mat. Uyanışı', icon: '💡', count: normCounts.matematikUyanisi, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (normCounts.dengeCambazi > 0) list.push({ key: 'dc', label: 'Denge Cambazı', icon: '⚖️', count: normCounts.dengeCambazi, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (normCounts.keskinNisanci > 0) list.push({ key: 'kn', label: 'Keskin Nişancı', icon: '🎯', count: normCounts.keskinNisanci, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });
    if (normCounts.temelAtici > 0) list.push({ key: 'ta', label: 'Temel Atıcı', icon: '🧱', count: normCounts.temelAtici, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });

    // Branş Efsaneleri
    if (normCounts.filozof > 0) list.push({ key: 'filozof', label: 'Filozof', icon: '📚', count: normCounts.filozof, bg: 'bg-rose-100', text: 'text-rose-900 font-bold', border: 'border-rose-200' });
    if (normCounts.newton > 0) list.push({ key: 'newton', label: 'Newton', icon: '🔭', count: normCounts.newton, bg: 'bg-sky-100', text: 'text-sky-900 font-bold', border: 'border-sky-200' });
    if (normCounts.pisagor > 0) list.push({ key: 'pisagor', label: 'Pisagor', icon: '📐', count: normCounts.pisagor, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });

    // Gizemli Rozetler
    if (normCounts.uyuyanDev > 0) list.push({ key: 'ud', label: 'Uyuyan Dev', icon: '🦁', count: normCounts.uyuyanDev, bg: 'bg-violet-100', text: 'text-violet-900 font-bold', border: 'border-violet-200' });
    if (normCounts.sabirTasi > 0) list.push({ key: 'st', label: 'Sabır Taşı', icon: '💎', count: normCounts.sabirTasi, bg: 'bg-stone-100', text: 'text-stone-900 font-bold', border: 'border-stone-200' });
    if (normCounts.yinYang > 0) list.push({ key: 'yy', label: 'Yin Yang', icon: '☯️', count: normCounts.yinYang, bg: 'bg-zinc-100', text: 'text-zinc-900 font-bold', border: 'border-zinc-200' });

    // Temel
    if (normCounts.kalkan > 0) list.push({ key: 'kalkan', label: 'Kalkan', icon: '🛡️', count: normCounts.kalkan, bg: 'bg-amber-100', text: 'text-amber-900 font-bold', border: 'border-amber-200' });
    if (normCounts.zirve > 0) list.push({ key: 'zirve', label: 'Zirve', icon: '👑', count: normCounts.zirve, bg: 'bg-purple-100', text: 'text-purple-900 font-bold', border: 'border-purple-200' });
    if (normCounts.ivme > 0) list.push({ key: 'ivme', label: 'İvme', icon: '🚀', count: normCounts.ivme, bg: 'bg-blue-100', text: 'text-blue-900 font-bold', border: 'border-blue-200' });
    if (normCounts.tamIsabet > 0) list.push({ key: 'tamIsabet', label: 'Tam İsabet', icon: '🎯', count: normCounts.tamIsabet, bg: 'bg-emerald-100', text: 'text-emerald-900 font-bold', border: 'border-emerald-200' });
    if (normCounts.kirmiziKart > 0) list.push({ key: 'kirmiziKart', label: 'Kırmızı Kart', icon: '🟥', count: normCounts.kirmiziKart, bg: 'bg-rose-100', text: 'text-rose-900 font-bold', border: 'border-rose-200' });
    if (normCounts.takimRuhu > 0) list.push({ key: 'takimRuhu', label: 'Takım Ruhu', icon: '🤝', count: normCounts.takimRuhu, bg: 'bg-teal-100', text: 'text-teal-900 font-bold', border: 'border-teal-200' });

    // Custom badges
    customBadges.forEach((cb, idx) => {
      list.push({ key: `custom-${idx}`, label: cb.label, icon: '🏅', count: cb.count, bg: 'bg-amber-50', text: 'text-amber-950 font-bold', border: 'border-amber-200' });
    });

    if (list.length === 0) return <span className="text-brand-ink/30 text-xs italic">-</span>;

    if (compact) {
      return (
        <div className="flex flex-wrap items-center gap-1 max-w-full">
          {list.map(b => {
            const def = getBadgeDefinition(b.label) || getBadgeDefinition(b.key);
            const tooltip = def 
              ? `${def.label} (${def.lp > 0 ? '+' : ''}${def.lp} LP)\nŞart: ${def.condition}\nKazanılan: ${b.count} adet\n(Detaylar için tıklayın)` 
              : `${b.label} (x${b.count})`;
            return (
              <span 
                key={b.key} 
                title={tooltip}
                onClick={(e) => {
                  e.stopPropagation();
                  if (def) setSelectedBadgeModal(def);
                  else setShowBadgesGuideModal(true);
                }}
                className={`${b.bg} ${b.text} border ${b.border} text-[10px] px-1.5 py-0.5 rounded-md shadow-2xs inline-flex items-center gap-1 shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer`}
              >
                <span>{b.icon}</span>
                <span className="font-bold text-[9.5px] leading-none">{b.label}</span>
                {b.count > 1 && <span className="opacity-90 font-black text-[8.5px]">x{b.count}</span>}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {list.map(b => {
          const def = getBadgeDefinition(b.label) || getBadgeDefinition(b.key);
          const tooltip = def 
            ? `${def.label} (${def.lp > 0 ? '+' : ''}${def.lp} LP)\nŞart: ${def.condition}\nKazanılan: ${b.count} adet\n(Detaylar için tıklayın)` 
            : `${b.label} x${b.count}`;
          return (
            <span 
              key={b.key} 
              title={tooltip}
              onClick={(e) => {
                e.stopPropagation();
                if (def) setSelectedBadgeModal(def);
                else setShowBadgesGuideModal(true);
              }}
              className={`${b.bg} ${b.text} border ${b.border} text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md shadow-2xs inline-flex items-center gap-1 shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer`}
            >
              <span>{b.icon}</span>
              <span>{b.label}</span>
              {b.count > 1 && <span className="opacity-90 font-extrabold text-[9px]">x{b.count}</span>}
            </span>
          );
        })}
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
      
      {/* 1. Header & Quick Actions - Compact on mobile */}
      <header className="bg-white rounded-xl sm:rounded-3xl p-2.5 sm:p-5 border border-brand-border/80 shadow-2xs">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4">
          
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shrink-0 font-bold shadow-2xs">
              <Trophy className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-2xl md:text-3xl font-serif text-brand-ink font-bold tracking-tight truncate">
                  Akademi Arena
                </h1>
                <span className="hidden xs:inline-block sm:inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[9px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  Lig & Rozetler
                </span>
              </div>
              <p className="hidden sm:block text-brand-ink/60 text-xs sm:text-sm mt-0.5 truncate">
                Öğrenci ligleri, haftalık dinamik takımlar, lig puanları (LP) ve rozet sistemi.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setShowTactics(true)}
              title="Aylık Taktikler"
              className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/90 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="sm:hidden text-xs">Taktikler</span>
              <span className="hidden sm:inline">Aylık Taktikler</span>
            </button>

            <button
              onClick={() => setActiveView(activeView === 'dashboard' ? 'rules' : 'dashboard')}
              title="Rozet Rehberi ve Kurallar"
              className={`flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all shadow-2xs text-xs font-bold active:scale-95 cursor-pointer shrink-0 ${
                activeView === 'dashboard'
                  ? 'bg-[#151618] hover:bg-black text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {activeView === 'dashboard' ? (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="sm:hidden text-xs">Kurallar</span>
                  <span className="hidden sm:inline">Rozet Rehberi & Kurallar</span>
                </>
              ) : (
                <>
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Arena Tablosu</span>
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
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
              
              {/* Sol: Zaman Aralığı ve Sınıf Dropdownları (Mobilde 2 sütunlu kompakt yan yana, masaüstünde esnek) */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                
                {/* Zaman Aralığı */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setIsMonthDropdownOpen(!isMonthDropdownOpen);
                      setIsGradeDropdownOpen(false);
                    }}
                    className="w-full sm:w-56 flex items-center justify-between px-3 sm:px-3.5 py-2.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-[#F2EFE9] rounded-xl text-xs font-bold text-brand-ink transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Calendar className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                      <span className="truncate">
                        {selectedMonth === 'all' ? '🏆 Tüm Zamanlar' : (() => {
                          const found = allAcademicMonths.find(m => m.key === selectedMonth);
                          const isCurrent = selectedMonth === currentMonthKey;
                          if (found) {
                            return `${found.label}${isCurrent ? ' (Bu Ay)' : ''}`;
                          }
                          const [year, month] = selectedMonth.split('-');
                          const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                          return `${monthNames[parseInt(month) - 1] || month} ${year}${isCurrent ? ' (Bu Ay)' : ''}`;
                        })()}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-brand-ink/50 transition-transform duration-200 shrink-0 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isMonthDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsMonthDropdownOpen(false)} />
                      <div className="absolute left-0 sm:right-auto w-72 max-w-[calc(100vw-2.5rem)] mt-1.5 bg-white border border-brand-border/80 rounded-2xl shadow-xl z-40 py-1.5 overflow-y-auto max-h-72 animate-fade-in divide-y divide-brand-border/30">
                        <button
                          onClick={() => {
                            setSelectedMonth('all');
                            setIsMonthDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            selectedMonth === 'all' ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>🏆</span>
                            <span>Tüm Zamanlar (Toplam LP)</span>
                          </div>
                          {selectedMonth === 'all' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Aktif
                            </span>
                          )}
                        </button>
                        {allAcademicMonths.length === 0 ? (
                          <div className="px-3.5 py-3 text-xs text-brand-ink/50 text-center italic">
                            Kayıtlı deneme sınavı ayı bulunmuyor
                          </div>
                        ) : (
                          allAcademicMonths.map(m => {
                            const isSelected = selectedMonth === m.key;
                            const isCurrent = m.key === currentMonthKey;
                            return (
                              <button
                                key={m.key}
                                onClick={() => {
                                  setSelectedMonth(m.key);
                                  setIsMonthDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span>📅</span>
                                  <span className="truncate">{m.label}</span>
                                  {isCurrent && (
                                    <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                                      Bu Ay
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {m.examCount && m.examCount > 0 ? (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                                      {m.examCount} Deneme
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-brand-ink/40 font-medium bg-brand-ink/5 px-2 py-0.5 rounded-full">
                                      Aktif Dönem
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Sınıf Seviyesi */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setIsGradeDropdownOpen(!isGradeDropdownOpen);
                      setIsMonthDropdownOpen(false);
                    }}
                    className="w-full sm:w-48 flex items-center justify-between px-3 sm:px-3.5 py-2.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-[#F2EFE9] rounded-xl text-xs font-bold text-brand-ink transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                      <span className="truncate">
                        {selectedGrade === 'all' ? '📚 Tüm Sınıflar' : selectedGrade === 'Diğer' ? '🎒 Diğer Sınıflar' : `🎓 ${selectedGrade}. Sınıflar`}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-brand-ink/50 transition-transform duration-200 shrink-0 ${isGradeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isGradeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setIsGradeDropdownOpen(false)} />
                      <div className="absolute right-0 sm:left-0 sm:right-auto w-56 max-w-[calc(100vw-2.5rem)] mt-1.5 bg-white border border-brand-border/80 rounded-2xl shadow-xl z-30 py-1.5 overflow-y-auto max-h-60 animate-fade-in divide-y divide-brand-border/30">
                        <button
                          onClick={() => {
                            setSelectedGrade('all');
                            setIsGradeDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center justify-between cursor-pointer ${
                            selectedGrade === 'all' ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                          }`}
                        >
                          <span>📚 Tüm Sınıflar</span>
                          {selectedGrade === 'all' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Aktif
                            </span>
                          )}
                        </button>
                        {availableGradeLevels.map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => {
                              setSelectedGrade(lvl);
                              setIsGradeDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-amber-50/60 transition-colors flex items-center justify-between cursor-pointer ${
                              selectedGrade === lvl ? 'text-amber-900 bg-amber-50 font-bold' : 'text-brand-ink'
                            }`}
                          >
                            <span>{lvl === 'Diğer' ? '🎒 Diğer Sınıflar' : `🎓 ${lvl}. Sınıflar`}</span>
                            {selectedGrade === lvl && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                Aktif
                              </span>
                            )}
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-brand-ink/40 hover:text-brand-ink cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Takım Filtreleri - Mobilde yatay kaydırılabilir butonlar, masaüstünde yatay sekmeler */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-brand-border/40">
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <Filter className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                <span className="text-[11px] font-bold text-brand-ink/50 uppercase tracking-wider">
                  Takım Filtresi:
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 w-full">
                <button
                  onClick={() => setSelectedTeamFilter('all')}
                  className={`flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    selectedTeamFilter === 'all'
                      ? 'bg-[#151618] text-white ring-1 ring-[#151618]'
                      : 'bg-[#FAF9F6] hover:bg-[#F2EFE9] text-brand-ink/70 border border-brand-border/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>🏆</span>
                    <span>Tüm Takımlar</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedTeamFilter === 'all' ? 'bg-white/20 text-white' : 'bg-brand-ink/5 text-brand-ink/60'
                  }`}>
                    {baseStudents.length}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedTeamFilter('Kutup Yıldızları')}
                  className={`flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    selectedTeamFilter === 'Kutup Yıldızları'
                      ? 'bg-amber-500 text-white font-extrabold ring-1 ring-amber-500'
                      : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border border-amber-200/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>⭐</span>
                    <span>Kutup Yıldızları</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedTeamFilter === 'Kutup Yıldızları' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
                  }`}>
                    {kutup.length}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedTeamFilter('Sıçrama Ustaları')}
                  className={`flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    selectedTeamFilter === 'Sıçrama Ustaları'
                      ? 'bg-blue-600 text-white font-extrabold ring-1 ring-blue-600'
                      : 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-950 border border-blue-200/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>🚀</span>
                    <span>Sıçrama Ustaları</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedTeamFilter === 'Sıçrama Ustaları' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-900'
                  }`}>
                    {sicrama.length}
                  </span>
                </button>

                <button
                  onClick={() => setSelectedTeamFilter('Taktik Avcıları')}
                  className={`flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    selectedTeamFilter === 'Taktik Avcıları'
                      ? 'bg-emerald-600 text-white font-extrabold ring-1 ring-emerald-600'
                      : 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Taktik Avcıları</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedTeamFilter === 'Taktik Avcıları' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    {taktik.length}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Takım Kartları */}
          {/* Mobilde: Kompakt, derli toplu 3 sütunlu mini özet paneli */}
          <div className="md:hidden">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-white border border-brand-border/80 rounded-2xl p-2 shadow-2xs">
              {/* Kutup Yıldızları Mobile Card */}
              <div 
                onClick={() => setSelectedTeam('Kutup Yıldızları')}
                className={`bg-gradient-to-b from-amber-50/90 to-amber-100/50 border ${
                  championTeam === 'Kutup Yıldızları' ? 'border-amber-400 ring-1.5 ring-amber-400/40 shadow-xs' : 'border-amber-200/80 shadow-2xs'
                } rounded-xl p-2 flex flex-col justify-between active:scale-95 transition-all cursor-pointer`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs">⭐</span>
                    <span className="text-[11px] font-bold text-amber-950 truncate">Kutup</span>
                  </div>
                  {championTeam === 'Kutup Yıldızları' && (
                    <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5 shrink-0">
                      <Crown className="w-2.5 h-2.5" /> 1.
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black text-amber-900 tabular-nums leading-tight">
                    {kutupAvg} <span className="text-[9px] font-bold text-amber-700/80">LP</span>
                  </div>
                  <div className="text-[10px] text-amber-900/60 font-semibold mt-0.5">{kutup.length} Öğr.</div>
                </div>
              </div>

              {/* Sıçrama Ustaları Mobile Card */}
              <div 
                onClick={() => setSelectedTeam('Sıçrama Ustaları')}
                className={`bg-gradient-to-b from-blue-50/90 to-blue-100/50 border ${
                  championTeam === 'Sıçrama Ustaları' ? 'border-blue-400 ring-1.5 ring-blue-400/40 shadow-xs' : 'border-blue-200/80 shadow-2xs'
                } rounded-xl p-2 flex flex-col justify-between active:scale-95 transition-all cursor-pointer`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs">🚀</span>
                    <span className="text-[11px] font-bold text-blue-950 truncate">Sıçrama</span>
                  </div>
                  {championTeam === 'Sıçrama Ustaları' && (
                    <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5 shrink-0">
                      <Crown className="w-2.5 h-2.5" /> 1.
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black text-blue-900 tabular-nums leading-tight">
                    {sicramaAvg} <span className="text-[9px] font-bold text-blue-700/80">LP</span>
                  </div>
                  <div className="text-[10px] text-blue-900/60 font-semibold mt-0.5">{sicrama.length} Öğr.</div>
                </div>
              </div>

              {/* Taktik Avcıları Mobile Card */}
              <div 
                onClick={() => setSelectedTeam('Taktik Avcıları')}
                className={`bg-gradient-to-b from-emerald-50/90 to-emerald-100/50 border ${
                  championTeam === 'Taktik Avcıları' ? 'border-emerald-400 ring-1.5 ring-emerald-400/40 shadow-xs' : 'border-emerald-200/80 shadow-2xs'
                } rounded-xl p-2 flex flex-col justify-between active:scale-95 transition-all cursor-pointer`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs">🛡️</span>
                    <span className="text-[11px] font-bold text-emerald-950 truncate">Taktik</span>
                  </div>
                  {championTeam === 'Taktik Avcıları' && (
                    <span className="bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-2xs flex items-center gap-0.5 shrink-0">
                      <Crown className="w-2.5 h-2.5" /> 1.
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black text-emerald-900 tabular-nums leading-tight">
                    {taktikAvg} <span className="text-[9px] font-bold text-emerald-700/80">LP</span>
                  </div>
                  <div className="text-[10px] text-emerald-900/60 font-semibold mt-0.5">{taktik.length} Öğr.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Masaüstünde: Detaylı 3 Sütunlu Takım Kartları */}
          <div className="hidden md:grid md:grid-cols-3 gap-3.5 sm:gap-5">
            
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

          {/* 4. Onay Bekleyen Transferler (Yalnızca Admin Yetkisiyle) */}
          {userRole === 'admin' && pendingTransfers.length > 0 && (
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
                      onClick={() => handleSelectStudent(s)} 
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
          {top3Students.length >= 3 && ((top3Students[0].displayPoints !== undefined ? top3Students[0].displayPoints : top3Students[0].leaguePoints) || 0) > 0 && !searchQuery && selectedTeamFilter === 'all' && (
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
                  onClick={() => handleSelectStudent(top3Students[1])}
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
                    {(top3Students[1].displayPoints !== undefined ? top3Students[1].displayPoints : (selectedMonth === 'all' ? top3Students[1].leaguePoints : 0)) || 0} LP
                  </div>
                </div>

                {/* 1. Sıra (Altın / Şampiyon) */}
                <div 
                  onClick={() => handleSelectStudent(top3Students[0])}
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
                    {(top3Students[0].displayPoints !== undefined ? top3Students[0].displayPoints : (selectedMonth === 'all' ? top3Students[0].leaguePoints : 0)) || 0} LP
                  </div>
                </div>

                {/* 3. Sıra (Bronz) */}
                <div 
                  onClick={() => handleSelectStudent(top3Students[2])}
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
                    {(top3Students[2].displayPoints !== undefined ? top3Students[2].displayPoints : (selectedMonth === 'all' ? top3Students[2].leaguePoints : 0)) || 0} LP
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 6. Akademi Arena Liderlik Sıralaması */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xs border border-brand-border/80 flex-1 flex flex-col">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-3 border-b border-brand-border/60">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-serif font-bold text-brand-ink">
                    Arena Liderlik Sıralaması
                  </h3>
                  <span className="bg-amber-100 text-amber-950 border border-amber-300/80 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {selectedMonthLabel}
                  </span>
                </div>
                <p className="text-xs text-brand-ink/50 mt-0.5">
                  {selectedMonth === 'all' ? "Tüm zamanların toplam LP sıralaması" : `${selectedMonthLabel} dönemi performans sıralaması`} • Toplam {filteredStudents.length} öğrenci
                  {filteredStudents.length > visibleCount && (
                    <span className="ml-1 text-amber-800 font-bold">
                      ({Math.min(visibleCount, filteredStudents.length)} gösteriliyor)
                    </span>
                  )}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-brand-ink/60 bg-[#FAF9F6] px-3 py-1.5 rounded-xl border border-brand-border/60">
                  Öğrenciye tıklayıp inceleyin 👆
                </span>
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
                  {displayedStudents.map((s, idx) => (
                    <tr 
                      key={s.id ? `table-${s.id}` : `table-${s.no || (s as any).name}-${idx}`} 
                      className="hover:bg-[#FAF9F6] cursor-pointer transition-colors group"
                      onClick={() => handleSelectStudent(s)}
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
                        {(s.displayPoints !== undefined ? s.displayPoints : (selectedMonth === 'all' ? s.leaguePoints : 0)) || 0} LP
                      </td>
                      <td className="py-3 px-3">
                        {renderBadges((s.displayBadges || s.allBadges || s.badges), s.leagueTeam)}
                      </td>
                    </tr>
                  ))}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-brand-ink/60 bg-[#FAF9F6]/40 rounded-xl">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-2xl">📅</span>
                          <p className="font-bold text-sm text-brand-ink">
                            {selectedMonth !== 'all' ? `${selectedMonthLabel} dönemi için henüz sınav kaydı bulunmuyor.` : 'Arama kriterlerine uygun öğrenci bulunamadı.'}
                          </p>
                          <p className="text-xs text-brand-ink/50 max-w-sm">
                            {selectedMonth !== 'all' ? 'Bu ay gerçekleştirilen deneme sınavları sisteme girildiğinde Arena lig sıralaması otomatik olarak oluşturulacaktır.' : 'Lütfen arama teriminizi veya sınıf/takım filtrelerinizi kontrol ediniz.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Modern Cards View - Touch-optimized & Team Color-Coded */}
            <div className="md:hidden flex flex-col gap-2">
              {displayedStudents.map((s, idx) => {
                const lpPoints = (s.displayPoints !== undefined ? s.displayPoints : (selectedMonth === 'all' ? s.leaguePoints : 0)) || 0;
                const teamBorder = s.leagueTeam === 'Kutup Yıldızları' ? 'border-l-4 border-l-amber-500' :
                  s.leagueTeam === 'Sıçrama Ustaları' ? 'border-l-4 border-l-blue-500' :
                  s.leagueTeam === 'Taktik Avcıları' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-gray-300';
                
                return (
                  <div 
                    key={s.id ? `card-${s.id}` : `card-${s.no || (s as any).name}-${idx}`}
                    onClick={() => handleSelectStudent(s)}
                    className={`bg-[#FAF9F6] rounded-2xl p-3 border border-brand-border/80 shadow-2xs flex flex-col gap-1.5 active:scale-[0.98] transition-all cursor-pointer hover:border-brand-border ${teamBorder}`}
                  >
                    {/* Üst Satır: Sıra, İsim, Sınıf ve LP Puanı */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-black shadow-2xs font-black' : 
                          idx === 1 ? 'bg-slate-300 text-black shadow-2xs font-black' : 
                          idx === 2 ? 'bg-amber-800 text-white shadow-2xs font-black' : 
                          'bg-white border border-brand-border/80 text-brand-ink/70'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-xs sm:text-sm text-brand-ink truncate">{s.name}</p>
                          {s.className && (
                            <span className="text-[10px] text-brand-ink/60 font-bold bg-white px-1.5 py-0.5 rounded border border-brand-border/60 shrink-0">
                              {s.className}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-serif font-black text-sm text-emerald-800 tabular-nums">
                          {lpPoints} <span className="text-[10px] font-bold">LP</span>
                        </span>
                      </div>
                    </div>

                    {/* Alt Satır: Takım Rozeti, Kazanılan Rozetler ve Ok İkonu */}
                    <div className="border-t border-brand-border/40 pt-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 inline-flex items-center gap-1 ${
                          s.leagueTeam === 'Kutup Yıldızları' ? 'bg-amber-50 text-amber-950 border-amber-200/80' : 
                          s.leagueTeam === 'Sıçrama Ustaları' ? 'bg-blue-50 text-blue-950 border-blue-200/80' :
                          s.leagueTeam === 'Taktik Avcıları' ? 'bg-emerald-50 text-emerald-950 border-emerald-200/80' : 
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          <span>{s.leagueTeam === 'Kutup Yıldızları' ? '⭐' : s.leagueTeam === 'Sıçrama Ustaları' ? '🚀' : s.leagueTeam === 'Taktik Avcıları' ? '🛡️' : '⚪'}</span>
                          <span>{s.leagueTeam ? s.leagueTeam.split(' ')[0] : 'Atanmadı'}</span>
                        </span>

                        <div className="min-w-0 overflow-x-auto no-scrollbar flex-1">
                          {renderBadges((s.displayBadges || s.allBadges || s.badges), s.leagueTeam, true)}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-brand-ink/40 shrink-0" />
                    </div>
                  </div>
                );
              })}

              {filteredStudents.length === 0 && (
                <div className="text-center py-10 text-brand-ink/60 bg-[#FAF9F6] rounded-2xl border border-brand-border/60 p-5 flex flex-col items-center gap-2">
                  <span className="text-2xl">📅</span>
                  <p className="font-bold text-sm text-brand-ink">
                    {selectedMonth !== 'all' ? `${selectedMonthLabel} için henüz sınav sonucu yok.` : 'Arama kriterlerine uygun öğrenci bulunamadı.'}
                  </p>
                  <p className="text-xs text-brand-ink/50 max-w-xs">
                    {selectedMonth !== 'all' ? 'Bu ay yapılan sınavların sonuçları sisteme işlendiğinde Arena sıralaması otomatik olarak listelenecektir.' : 'Lütfen arama teriminizi veya filtrelerinizi kontrol ediniz.'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination / Load More Bar */}
            {filteredStudents.length > visibleCount && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-1 border-t border-brand-border/50 mt-3">
                <p className="text-xs text-brand-ink/60 font-medium">
                  Toplam <span className="font-bold text-brand-ink">{filteredStudents.length}</span> öğrenciden <span className="font-bold text-brand-ink">{Math.min(visibleCount, filteredStudents.length)}</span> tanesi gösteriliyor.
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 30)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Daha Fazla Göster (+30 Öğrenci)</span>
                  </button>
                  <button
                    onClick={() => setVisibleCount(filteredStudents.length)}
                    className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary font-bold text-xs transition-colors cursor-pointer"
                  >
                    <span>Tümünü Göster</span>
                  </button>
                </div>
              </div>
            )}
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
                              handleSelectStudent(s);
                            }}
                          >
                            <td className="py-3 font-bold text-brand-ink">
                              <div>
                                <p>{s.name}</p>
                                {s.className && <span className="text-[10px] text-brand-ink/50 font-normal">{s.className}</span>}
                              </div>
                            </td>
                            <td className="py-3 text-center font-serif font-bold text-emerald-800 tabular-nums">
                              {(s.displayPoints !== undefined ? s.displayPoints : (selectedMonth === 'all' ? s.leaguePoints : 0)) || 0} LP
                            </td>
                            <td className="py-3">
                              {renderBadges((s.allBadges || s.badges || s.displayBadges), s.leagueTeam, true)}
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
                  
                  {/* Mobile View: Vertical Month Filter & Clean Cards */}
                  <div className="sm:hidden space-y-2">
                    
                    {/* 1. Tek Satırda Birleşik Ay Seçici & Navigasyon */}
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={activeTacticsMonth === 0}
                        onClick={() => setActiveTacticsMonth(prev => Math.max(0, prev - 1))}
                        className="p-2 rounded-xl bg-[#FAF9F6] border border-brand-border/80 text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all shrink-0 cursor-pointer shadow-2xs"
                        title="Önceki Ay"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="relative flex-1 min-w-0">
                        <button
                          onClick={() => setIsTacticsMonthOpen(!isTacticsMonthOpen)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-purple-50/90 border border-purple-200/90 rounded-xl text-xs font-bold text-purple-950 transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-xs">📅</span>
                            <span className="truncate">{tacticsMonths[activeTacticsMonth].name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            <span className="text-[10px] text-purple-700/80 font-bold bg-purple-100 px-1.5 py-0.5 rounded-full">
                              {activeTacticsMonth + 1}/{tacticsMonths.length}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-purple-700 transition-transform duration-200 ${isTacticsMonthOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {/* Dikey Açılır Ay Listesi */}
                        {isTacticsMonthOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsTacticsMonthOpen(false)} />
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-purple-200 rounded-2xl shadow-xl z-40 py-1 max-h-64 overflow-y-auto animate-fade-in divide-y divide-purple-100/60">
                              {tacticsMonths.map((m, i) => {
                                const isSelected = activeTacticsMonth === i;
                                return (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      setActiveTacticsMonth(i);
                                      setIsTacticsMonthOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-purple-50/70 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected ? 'bg-purple-100/70 text-purple-950 font-bold' : 'text-brand-ink'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="w-5 h-5 rounded-lg bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {i + 1}
                                      </span>
                                      <span className="truncate">{m.name}</span>
                                    </div>
                                    {isSelected && (
                                      <span className="text-[10px] font-bold text-purple-800 bg-purple-200/80 px-2 py-0.5 rounded-full shrink-0">
                                        Seçili
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        disabled={activeTacticsMonth === tacticsMonths.length - 1}
                        onClick={() => setActiveTacticsMonth(prev => Math.min(tacticsMonths.length - 1, prev + 1))}
                        className="p-2 rounded-xl bg-[#FAF9F6] border border-brand-border/80 text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all shrink-0 cursor-pointer shadow-2xs"
                        title="Sonraki Ay"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 2. Dikey Görev / Takım Filtresi - Kompakt & Toplu Mini Butonlar */}
                    <div className="flex flex-col gap-1 pt-0.5">
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setTacticsTeamFilter('all')}
                          className={`col-span-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs truncate ${
                            tacticsTeamFilter === 'all'
                              ? 'bg-[#151618] text-white ring-1 ring-[#151618]'
                              : 'bg-[#FAF9F6] hover:bg-[#F2EFE9] text-brand-ink/70 border border-brand-border/60'
                          }`}
                        >
                          Tümü (4)
                        </button>

                        <button
                          onClick={() => setTacticsTeamFilter('ortak')}
                          className={`col-span-2 px-2 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs truncate ${
                            tacticsTeamFilter === 'ortak'
                              ? 'bg-purple-900 text-white ring-1 ring-purple-900'
                              : 'bg-purple-50/70 hover:bg-purple-100/70 text-purple-950 border border-purple-200/80'
                          }`}
                        >
                          🏆 Ortak DYK Görevi
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setTacticsTeamFilter('kutup')}
                          className={`px-1.5 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs truncate ${
                            tacticsTeamFilter === 'kutup'
                              ? 'bg-amber-500 text-white font-extrabold ring-1 ring-amber-500'
                              : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border border-amber-200/80'
                          }`}
                        >
                          ⭐ Kutup
                        </button>

                        <button
                          onClick={() => setTacticsTeamFilter('sicrama')}
                          className={`px-1.5 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs truncate ${
                            tacticsTeamFilter === 'sicrama'
                              ? 'bg-blue-600 text-white font-extrabold ring-1 ring-blue-600'
                              : 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-950 border border-blue-200/80'
                          }`}
                        >
                          🚀 Sıçrama
                        </button>

                        <button
                          onClick={() => setTacticsTeamFilter('taktik')}
                          className={`px-1.5 py-1.5 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer shadow-2xs truncate ${
                            tacticsTeamFilter === 'taktik'
                              ? 'bg-emerald-600 text-white font-extrabold ring-1 ring-emerald-600'
                              : 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border border-emerald-200/80'
                          }`}
                        >
                          🛡️ Taktik
                        </button>
                      </div>
                    </div>

                    {/* 3. Filtrelenmiş Taktik ve Görev Kartları */}
                    {(() => {
                      const item = tacticsMonths[activeTacticsMonth];
                      return (
                        <div className="space-y-2 pt-1">
                          
                          {/* Ortak DYK */}
                          {(tacticsTeamFilter === 'all' || tacticsTeamFilter === 'ortak') && (
                            <div className="bg-purple-50/80 p-2.5 sm:p-3 rounded-xl border border-purple-200/90 shadow-2xs space-y-0.5 animate-fade-in">
                              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🏆</span>
                                <span>Ortak DYK & Takım Görevi</span>
                              </h4>
                              <p className="text-xs text-purple-900 font-medium leading-relaxed pl-5">
                                {item.ortak}
                              </p>
                            </div>
                          )}

                          {/* Kutup Yıldızları */}
                          {(tacticsTeamFilter === 'all' || tacticsTeamFilter === 'kutup') && (
                            <div className="bg-amber-50/80 p-2.5 sm:p-3 rounded-xl border border-amber-200/90 shadow-2xs space-y-0.5 animate-fade-in">
                              <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                                <span>⭐</span>
                                <span>Kutup Yıldızları (A Takımı) Taktik Hedefi</span>
                              </p>
                              <p className="text-xs text-amber-950/90 leading-relaxed font-medium pl-5">
                                {item.kutup}
                              </p>
                            </div>
                          )}

                          {/* Sıçrama Ustaları */}
                          {(tacticsTeamFilter === 'all' || tacticsTeamFilter === 'sicrama') && (
                            <div className="bg-blue-50/80 p-2.5 sm:p-3 rounded-xl border border-blue-200/90 shadow-2xs space-y-0.5 animate-fade-in">
                              <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                <span>🚀</span>
                                <span>Sıçrama Ustaları (B Takımı) Taktik Hedefi</span>
                              </p>
                              <p className="text-xs text-blue-950/90 leading-relaxed font-medium pl-5">
                                {item.sicrama}
                              </p>
                            </div>
                          )}

                          {/* Taktik Avcıları */}
                          {(tacticsTeamFilter === 'all' || tacticsTeamFilter === 'taktik') && (
                            <div className="bg-emerald-50/80 p-2.5 sm:p-3 rounded-xl border border-emerald-200/90 shadow-2xs space-y-0.5 animate-fade-in">
                              <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                <span>🛡️</span>
                                <span>Taktik Avcıları (C Takımı) Taktik Hedefi</span>
                              </p>
                              <p className="text-xs text-emerald-950/90 leading-relaxed font-medium pl-5">
                                {item.taktik}
                              </p>
                            </div>
                          )}
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
            const sNo = selectedStudent.no !== undefined ? Number(selectedStudent.no) : 0;
            const sNameNorm = selectedStudent.name ? normalizeTurkish(selectedStudent.name).trim().toLowerCase() : '';

            // 1. Öğrencinin tüm sınavlarını pre-indexed haritadan anında O(1) hızında getir
            const fromNo = sNo > 0 ? (studentExamsMap.get(`no_${sNo}`) || []) : [];
            const fromId = selectedStudent.id ? (studentExamsMap.get(`id_${selectedStudent.id}`) || []) : [];
            const fromName = sNameNorm ? (studentExamsMap.get(`name_${sNameNorm}`) || []) : [];

            const examListMap = new Map<string, any>();
            for (const e of [...fromNo, ...fromId, ...fromName]) {
              const matched = (state.exams || []).find(ex => String(ex.id) === String(e.examId) || ex.name === e.name);
              const canonKey = matched ? String(matched.id) : (e.examId || e.name);
              if (!examListMap.has(canonKey)) {
                examListMap.set(canonKey, e);
              } else {
                const existing = examListMap.get(canonKey);
                if ((!existing.date && e.date) || (!existing.details && e.details)) {
                  examListMap.set(canonKey, e);
                }
              }
            }
            const allHistory = Array.from(examListMap.values());
            allHistory.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
              
            const rawHistory = allHistory.map((h, i) => {
              const pastExams = allHistory.slice(0, i);
              const prevAverage = pastExams.length > 0 ? (pastExams.reduce((sum, p) => sum + p.score, 0) / pastExams.length) : 0;
              let pastTeam = pastExams.length > 0 ? determineLeagueTeam(prevAverage) : 'Taktik Avcıları';
              if (pastTeam === 'Atanmadı') pastTeam = 'Taktik Avcıları';
              
              const { earnedLP: calculatedLP, badgeCounts } = calculateAtaLigPoints(h.score, prevAverage, h.details, pastExams, pastTeam);

              // Sınav sonucunda saklanan rozetler varsa eksiksiz dahil et
              if (Array.isArray(h.examRes?.earnedBadges)) {
                h.examRes.earnedBadges.forEach((bName: string) => {
                  const norm = normalizeBadgeKey(bName) || normalizeTurkish(bName).toLowerCase().replace(/[\s\.]+/g, '');
                  if (norm in badgeCounts) {
                    (badgeCounts as any)[norm] = Math.max((badgeCounts as any)[norm] || 0, 1);
                  }
                });
              }

              // Transfer geçmişinden Anka Kuşu kontrolü (Bu sınava özel)
              const transfer = selectedStudent.transferHistory?.find((th: any) => th.examName === h.name);
              if (transfer && transfer.from === 'Taktik Avcıları' && (transfer.to === 'Sıçrama Ustaları' || transfer.to === 'Kutup Yıldızları')) {
                badgeCounts.ankaKusu = 1;
              }

              let badgeLP = 0;
              Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
                if (typeof count === 'number' && count > 0) {
                  const pts = BADGE_POINTS[k] || 0;
                  badgeLP += pts * count;
                }
              });

              let finalEarnedLP = Math.max(calculatedLP, badgeLP);
              if (typeof h.examRes?.earnedLP === 'number' && h.examRes.earnedLP > 0) {
                finalEarnedLP = Math.max(finalEarnedLP, h.examRes.earnedLP);
              }
              
              return {
                examName: h.name,
                date: h.date,
                score: h.score,
                earnedLP: finalEarnedLP,
                badgeCounts
              };
            }).reverse(); // newest first

            const periodHistory = rawHistory.filter(h => {
              if (selectedMonth === 'all') return true;
              if (h.date) {
                const dateObj = parseDate(h.date);
                const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                return mKey === selectedMonth;
              }
              return false;
            });

            // Seçilen dönemde sınav yoksa veya kullanıcı tümünü görmek istiyorsa rawHistory göster
            const isShowingAll = modalShowAllExams || selectedMonth === 'all' || periodHistory.length === 0;
            const history = isShowingAll ? rawHistory : periodHistory;

            // Öğrencinin aktif sınavlarından dinamik rozet türetimi (Kütük hayalet rozetleri ve mükerrer sayımlar engellenir)
            const periodBadges: Record<string, number> = {};
            periodHistory.forEach(h => {
              if (h.badgeCounts) {
                Object.entries(h.badgeCounts).forEach(([k, count]: [string, any]) => {
                  if (typeof count === 'number' && count > 0) {
                    periodBadges[k] = (periodBadges[k] || 0) + count;
                  }
                });
              }
            });

            const allTimeBadges: Record<string, number> = {};
            rawHistory.forEach(h => {
              if (h.badgeCounts) {
                Object.entries(h.badgeCounts).forEach(([k, count]: [string, any]) => {
                  if (typeof count === 'number' && count > 0) {
                    allTimeBadges[k] = (allTimeBadges[k] || 0) + count;
                  }
                });
              }
            });

            // Transfer geçmişinden Anka Kuşu kontrolü
            if (selectedStudent.transferHistory && Array.isArray(selectedStudent.transferHistory)) {
              selectedStudent.transferHistory.forEach((th: any) => {
                if (th.from === 'Taktik Avcıları' && (th.to === 'Sıçrama Ustaları' || th.to === 'Kutup Yıldızları')) {
                  allTimeBadges.ankaKusu = (allTimeBadges.ankaKusu || 0) + 1;
                  if (selectedMonth !== 'all' && th.date) {
                    const dateObj = parseDate(th.date);
                    const mKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                    if (mKey === selectedMonth) {
                      periodBadges.ankaKusu = (periodBadges.ankaKusu || 0) + 1;
                    }
                  }
                }
              });
            }

            const periodBadgesCount = Object.values(periodBadges).reduce((sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0), 0);
            const allTimeBadgesCount = Object.values(allTimeBadges).reduce((sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0), 0);

            // Seçili ay aktifken varsayılan olarak dönemsel rozetler gösterilir (kullanıcı isterse tüm zamanlara geçebilir)
            const isPeriodScope = selectedMonth !== 'all' && modalBadgeScope === 'period';
            const activeBadges = isPeriodScope ? periodBadges : allTimeBadges;
            const activeBadgesCount = isPeriodScope ? periodBadgesCount : allTimeBadgesCount;

            const studentRank = baseStudents.findIndex(s => s.no === selectedStudent.no) + 1;

            const periodLP = periodHistory.reduce((sum, h) => sum + (h.earnedLP || 0), 0);
            const allTimeLP = rawHistory.reduce((sum, h) => sum + (h.earnedLP || 0), 0);
            const displayModalLP = selectedMonth === 'all' ? allTimeLP : periodLP;

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
                          {selectedMonth === 'all' ? 'Toplam LP' : `Aylık LP (${selectedMonthLabel})`}
                        </p>
                        <p className="text-xl sm:text-2xl font-serif font-black text-emerald-800 tabular-nums mt-0.5">
                          {displayModalLP} LP
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
                          {rawHistory.length} Deneme
                        </p>
                        {selectedMonth !== 'all' && rawHistory.length > 0 && (
                          <p className="text-[10px] font-semibold text-brand-ink/50 mt-0.5">
                            {selectedMonthLabel}: {periodHistory.length} • Toplam: {rawHistory.length}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Öğrencinin Kazandığı Rozetler Vitrini */}
                    <div className="bg-[#FAF9F6] border border-brand-border/70 rounded-2xl p-4 shadow-2xs space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-brand-ink/70 flex items-center gap-1.5">
                            <span>🏅</span>
                            <span>
                              {selectedMonth !== 'all'
                                ? (isPeriodScope ? `Öğrencinin Kazandığı Rozetler (${selectedMonthLabel})` : 'Öğrencinin Kazandığı Rozetler (Tüm Zamanlar)')
                                : 'Öğrencinin Kazandığı Rozetler'}
                            </span>
                          </h4>
                          <span className="text-[11px] font-bold text-brand-ink/70 bg-white px-2.5 py-0.5 rounded-full border border-brand-border/60">
                            {activeBadgesCount > 0 ? `${activeBadgesCount} Rozet` : 'Henüz Rozet Yok'}
                          </span>
                        </div>

                        {selectedMonth !== 'all' && (
                          <div className="flex items-center bg-white p-0.5 rounded-lg border border-brand-border/70 text-[11px] self-start sm:self-auto shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setModalBadgeScope('period')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                isPeriodScope
                                  ? 'bg-[#FAF9F6] text-brand-ink font-bold shadow-2xs border border-brand-border/60'
                                  : 'text-brand-ink/60 hover:text-brand-ink'
                              }`}
                            >
                              {selectedMonthLabel} ({periodBadgesCount})
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalBadgeScope('all')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                !isPeriodScope
                                  ? 'bg-[#FAF9F6] text-brand-ink font-bold shadow-2xs border border-brand-border/60'
                                  : 'text-brand-ink/60 hover:text-brand-ink'
                              }`}
                            >
                              Tüm Zamanlar ({allTimeBadgesCount})
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {activeBadgesCount > 0 ? (
                        <div className="bg-white p-3 rounded-xl border border-brand-border/50">
                          {renderBadges(activeBadges, selectedStudent.leagueTeam)}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-ink/50 italic py-2">
                          {selectedMonth !== 'all' && isPeriodScope
                            ? `Öğrencinin ${selectedMonthLabel} dönemindeki sınavında henüz kazanılmış bir rozeti bulunmuyor.`
                            : 'Öğrencinin henüz kazanılmış bir rozeti bulunmuyor. Herhangi bir derste 0 yanlış yaparak "Tam İsabet" veya boş bırakarak "Kalkan" kazanabilirsiniz.'}
                        </p>
                      )}
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
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-brand-ink/70 flex items-center gap-1.5">
                          <span>📋</span>
                          <span>Sınav Bazlı LP ve Rozet Kazanımları</span>
                        </h4>
                        {selectedMonth !== 'all' && rawHistory.length > 0 && (
                          <div className="flex items-center bg-[#FAF9F6] p-0.5 rounded-lg border border-brand-border/70 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setModalShowAllExams(false)}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                !modalShowAllExams && periodHistory.length > 0
                                  ? 'bg-white text-brand-ink shadow-2xs'
                                  : 'text-brand-ink/60 hover:text-brand-ink'
                              }`}
                            >
                              Bu Ay ({periodHistory.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalShowAllExams(true)}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                                modalShowAllExams || periodHistory.length === 0
                                  ? 'bg-white text-brand-ink shadow-2xs'
                                  : 'text-brand-ink/60 hover:text-brand-ink'
                              }`}
                            >
                              Tüm Sınavlar ({rawHistory.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bilgilendirme Notu (Seçili ayda sınav yok ama diğer aylarda varsa) */}
                      {selectedMonth !== 'all' && periodHistory.length === 0 && rawHistory.length > 0 && (
                        <div className="bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs rounded-xl p-3 mb-3 leading-relaxed">
                          Seçili filtre döneminde ({selectedMonthLabel}) sınav bulunmuyor. Öğrencinin diğer dönemlerde katıldığı <strong>{rawHistory.length} deneme sınavı</strong> aşağıda listelenmektedir.
                        </div>
                      )}

                      {history.length > 0 ? (
                        <div className="space-y-3">
                          {history.map((h, i) => (
                            <div key={i} className="bg-white border border-brand-border/70 rounded-2xl p-3.5 shadow-2xs space-y-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h5 className="font-bold text-xs sm:text-sm text-brand-ink">{h.examName}</h5>
                                  <p className="text-[11px] font-medium text-brand-ink/60">
                                    {parseDate(h.date).toLocaleDateString('tr-TR')} • Puan / Net: <span className="font-bold text-blue-700">{h.score.toFixed(2)}</span>
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
                          Öğrenciye ait herhangi bir deneme sınavı kaydı bulunmuyor.
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

      {/* 10. Tekil Rozet Bilgilendirme Modalı (Spotlight) */}
      {selectedBadgeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-all animate-fade-in"
          onClick={() => setSelectedBadgeModal(null)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-brand-border/80 p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2.5 rounded-2xl bg-amber-50 border border-amber-200/80 shadow-2xs">
                  {selectedBadgeModal.icon}
                </span>
                <div>
                  <h3 className="text-lg font-serif font-bold text-brand-ink">
                    {selectedBadgeModal.label}
                  </h3>
                  <span className="text-xs font-semibold text-brand-ink/50">
                    {selectedBadgeModal.categoryLabel}
                  </span>
                </div>
              </div>

              <span className={`text-xs font-extrabold px-3 py-1 rounded-xl shadow-2xs ${
                selectedBadgeModal.lp > 0 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}>
                {selectedBadgeModal.lp > 0 ? `+${selectedBadgeModal.lp}` : selectedBadgeModal.lp} LP
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider block">
                Kazanma Şartı
              </span>
              <p className="text-xs font-bold text-amber-950">
                🎯 {selectedBadgeModal.condition}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-brand-ink/50 uppercase tracking-wider block">
                Açıklama & Strateji
              </span>
              <p className="text-xs text-brand-ink/80 leading-relaxed font-medium">
                {selectedBadgeModal.description}
              </p>
            </div>

            <div className="pt-2 border-t border-brand-border/40 flex items-center justify-between text-xs">
              <span className="text-brand-ink/60 font-medium">
                Takım Kısıtlaması:
              </span>
              <span className="font-bold text-brand-ink px-2 py-0.5 bg-stone-100 rounded-lg">
                {selectedBadgeModal.teamRestriction || 'Tüm Takımlar'}
              </span>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedBadgeModal(null);
                  setShowBadgesGuideModal(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-2xs cursor-pointer text-center"
              >
                Tüm Rozetleri İncele (25 Rozet)
              </button>
              <button
                onClick={() => setSelectedBadgeModal(null)}
                className="py-2.5 px-4 rounded-xl border border-brand-border/80 hover:bg-stone-50 text-brand-ink font-bold text-xs transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. 25 Güncel Rozet Kılavuzu Modalı */}
      {showBadgesGuideModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs transition-all animate-fade-in"
          onClick={() => setShowBadgesGuideModal(false)}
        >
          <div 
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-y-auto border border-brand-border/80 p-3 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <RulesView onClose={() => setShowBadgesGuideModal(false)} />
          </div>
        </div>
      )}

    </div>
  );
};

export default LeagueView;
