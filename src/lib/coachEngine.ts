import { normalizeTurkish } from './omrEngine';
import { evaluateStudentKazanimReport } from './kazanimParser';

export interface LessonStat {
  name: string;
  canonKey?: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  accuracy: number;
  maxQuestions?: number;
  schoolAvgNet?: number;
  classAvgNet?: number;
  periodAvgNet?: number;
  diffFromSchoolAvg?: number;
  missedOutcomeCount?: number;
  masteryRate?: number;
}

export interface CoachingInsight {
  title: string;
  desc: string;
  icon: string;
  badge?: string;
  tag?: string;
}

export interface CoachingTactic {
  step: number;
  title: string;
  action: string;
  icon: string;
  targetLesson?: string;
}

export interface MissingOutcomeQuestionRef {
  examName: string;
  examDate?: string;
  questionNumber: number;
  status: 'wrong' | 'empty';
  studentAnswer: string;
  correctAnswer: string;
  schoolSuccessRate?: number;
}

export interface MissingOutcomeAnalysisItem {
  code: string;
  title: string;
  subject: string;
  unit?: string;
  examNames: string[];
  questionRefs: MissingOutcomeQuestionRef[];
  wrongCount: number;
  emptyCount: number;
  totalMissedCount: number;
  avgSchoolSuccessRate?: number;
  priority: 'critical' | 'high' | 'medium';
  diagnosisType: 'tekrarlayan_eksik' | 'konu_eksigi' | 'dikkat_veya_kavram' | 'secici_soru';
  diagnosisLabel: string;
  diagnosisNote: string;
}

export interface SubjectOutcomeSummary {
  subject: string;
  totalQuestions: number;
  masteredCount: number;
  wrongCount: number;
  emptyCount: number;
  masteryPercentage: number;
  missingOutcomes: MissingOutcomeAnalysisItem[];
}

export interface ExamComparisonSummary {
  periodLabel: string;
  periodExamCount: number;
  totalExamCount: number;
  schoolAvgScore: number;
  schoolAvgNet: number;
  classAvgScore: number;
  classAvgNet: number;
  studentPeriodAvgScore: number;
  studentPeriodAvgNet: number;
  studentAllTimeAvgScore: number;
  studentAllTimeAvgNet: number;
  scoreDiffFromSchool: number;
  netDiffFromSchool: number;
  scoreDiffFromClass: number;
  netDiffFromClass: number;
  scoreDiffFromOwnAvg: number;
  examRank?: number;
  examParticipantCount?: number;
  examPercentile?: number;
  classRank?: number;
  classParticipantCount?: number;
}

export interface GuidancePrescriptionItem {
  category: string;
  title: string;
  icon: string;
  summary: string;
  bullets: string[];
}

export interface CoachingReport {
  studentName: string;
  studentNo?: number | string;
  className?: string;
  team: string;
  rank: number;
  totalStudents: number;
  leaguePoints: number;
  examName: string;
  examDate?: string;
  hasExamData: boolean;
  score: number;
  totalNet: number;
  totalCorrect: number;
  totalWrong: number;
  totalEmpty: number;
  trend: 'up' | 'down' | 'steady' | 'first';
  trendDifference: number;
  lessons: LessonStat[];
  recentBadges: string[];
  totalBadgeCount: number;
  strengths: CoachingInsight[];
  risks: CoachingInsight[];
  tactics: CoachingTactic[];
  coachSummary: string;
  topWeakOutcomes?: Array<{ code: string; desc: string; subject: string }>;
  // Yeni Gelişmiş Kazanım & Ortalamalar Entegrasyonu Alanları
  periodLabel?: string;
  examComparison?: ExamComparisonSummary;
  hasKazanimData?: boolean;
  totalMeasuredQuestions?: number;
  totalMasteredQuestions?: number;
  overallMasteryPercentage?: number;
  monthlyMissingOutcomes?: MissingOutcomeAnalysisItem[];
  subjectOutcomeSummaries?: SubjectOutcomeSummary[];
  guidancePrescription?: GuidancePrescriptionItem[];
}

export interface CoachingReportOptions {
  selectedMonth?: string;
  selectedMonthLabel?: string;
  allExams?: any[];
  allResults?: any[];
}

// Ders isim ve takma adlarını MEB LGS standart derslerine eşleştir
export function resolveSubjectCanonical(
  rawKey: string,
  valName?: string
): { canonKey: string; displayName: string; order: number; maxQuestions: number; weight: number } | null {
  const targetStr = (valName && valName.trim() ? valName : rawKey || '').trim();
  const clean = normalizeTurkish(targetStr).toLowerCase().replace(/[\s\.\-_/]+/g, '');
  if (!clean) return null;

  if (
    clean === 'toplam' || clean === 'genel' || clean === 'toplamnet' ||
    clean === 'net' || clean === 'puan' || clean === 'lgs' || clean === 'tyt' || clean === 'ayt' ||
    clean === 'score' || clean === 'average' || clean === 'total' || clean === 'id' || clean === 'date' ||
    clean === 'examid' || clean === 'sinav'
  ) {
    return null;
  }

  if (clean.includes('turk')) {
    return { canonKey: 'turkce', displayName: 'Türkçe', order: 1, maxQuestions: 20, weight: 4 };
  }
  if (clean.includes('ink') || clean.includes('tarih') || clean.includes('sosyal') || clean === 'tar' || clean === 'sb') {
    return { canonKey: 'inkilap', displayName: 'T.C. İnkılap Tarihi ve Atatürkçülük', order: 2, maxQuestions: 10, weight: 1 };
  }
  if (clean.includes('din') || clean.includes('dkab')) {
    return { canonKey: 'din', displayName: 'Din Kültürü ve Ahlak Bilgisi', order: 3, maxQuestions: 10, weight: 1 };
  }
  if (clean.includes('ing') || clean.includes('yabanci') || clean.includes('dil') || clean.includes('english')) {
    return { canonKey: 'ingilizce', displayName: 'İngilizce', order: 4, maxQuestions: 10, weight: 1 };
  }
  if (clean.includes('mat')) {
    return { canonKey: 'matematik', displayName: 'Matematik', order: 5, maxQuestions: 20, weight: 4 };
  }
  if (clean.includes('fen')) {
    return { canonKey: 'fen', displayName: 'Fen Bilimleri', order: 6, maxQuestions: 20, weight: 4 };
  }

  if (/^[1-6]$/.test(clean)) {
    const num = parseInt(clean, 10);
    switch (num) {
      case 1: return { canonKey: 'turkce', displayName: 'Türkçe', order: 1, maxQuestions: 20, weight: 4 };
      case 2: return { canonKey: 'inkilap', displayName: 'T.C. İnkılap Tarihi ve Atatürkçülük', order: 2, maxQuestions: 10, weight: 1 };
      case 3: return { canonKey: 'din', displayName: 'Din Kültürü ve Ahlak Bilgisi', order: 3, maxQuestions: 10, weight: 1 };
      case 4: return { canonKey: 'ingilizce', displayName: 'İngilizce', order: 4, maxQuestions: 10, weight: 1 };
      case 5: return { canonKey: 'matematik', displayName: 'Matematik', order: 5, maxQuestions: 20, weight: 4 };
      case 6: return { canonKey: 'fen', displayName: 'Fen Bilimleri', order: 6, maxQuestions: 20, weight: 4 };
    }
  }

  return { canonKey: clean, displayName: targetStr, order: 99, maxQuestions: 20, weight: 2 };
}

function extractSubjectLessonsFromRecord(rawDetailsSource: any): Map<string, LessonStat & { order: number; weight: number }> {
  const canonicalMap = new Map<string, LessonStat & { order: number; weight: number }>();
  if (!rawDetailsSource || typeof rawDetailsSource !== 'object') return canonicalMap;

  Object.entries(rawDetailsSource).forEach(([key, val]: [string, any]) => {
    if (val === undefined || val === null) return;
    const valName = typeof val === 'object' ? (val.name || val.lessonName) : undefined;
    const meta = resolveSubjectCanonical(key, valName);
    if (!meta) return;

    let d = 0;
    let y = 0;
    let b = 0;
    let n = 0;

    if (typeof val === 'object') {
      d = Number(val.D ?? val.correct ?? 0) || 0;
      y = Number(val.Y ?? val.wrong ?? 0) || 0;
      b = Number(val.B ?? val.empty ?? 0) || 0;
      n = typeof val.N === 'number'
        ? val.N
        : (typeof val.net === 'number'
            ? val.net
            : (typeof val.n === 'number' ? val.n : (d - y / 3)));
    } else if (typeof val === 'number') {
      n = val;
      d = Math.round(val);
    } else if (typeof val === 'string' && !isNaN(parseFloat(val.replace(',', '.')))) {
      n = parseFloat(val.replace(',', '.'));
      d = Math.round(n);
    } else {
      return;
    }

    const cleanNet = Math.round(n * 100) / 100;
    const answered = d + y;
    const accuracy = answered > 0 ? Math.round((d / answered) * 100) : (cleanNet > 0 ? 100 : 0);
    const maxQ = (d + y + b) > 0 ? (d + y + b) : meta.maxQuestions;

    const existing = canonicalMap.get(meta.canonKey);
    if (!existing) {
      canonicalMap.set(meta.canonKey, {
        name: meta.displayName,
        canonKey: meta.canonKey,
        correct: d,
        wrong: y,
        empty: b,
        net: cleanNet,
        accuracy,
        maxQuestions: maxQ,
        order: meta.order,
        weight: meta.weight
      });
    } else {
      const currentHasDetails = (existing.correct + existing.wrong + existing.empty) > 0;
      const newHasDetails = (d + y + b) > 0;
      if (!currentHasDetails && newHasDetails) {
        canonicalMap.set(meta.canonKey, {
          name: existing.name || meta.displayName,
          canonKey: meta.canonKey,
          correct: d,
          wrong: y,
          empty: b,
          net: cleanNet,
          accuracy,
          maxQuestions: maxQ,
          order: existing.order,
          weight: meta.weight
        });
      }
    }
  });

  return canonicalMap;
}

function normalizeClassStr(cls?: string): string {
  if (!cls) return '';
  return normalizeTurkish(String(cls)).toUpperCase().replace(/[\s\-_\/\.]/g, '').trim();
}

export function generateCoachingReport(
  student: any,
  allHistory: any[] = [],
  studentRank: number = 1,
  totalStudentsCount: number = 1,
  options?: CoachingReportOptions
): CoachingReport {
  const studentName = student?.name || 'Öğrenci';
  const studentNo = student?.no;
  const className = student?.className || student?.studentClass || '';
  const normStudentClass = normalizeClassStr(className);
  const team = student?.leagueTeam || 'Taktik Avcıları';
  const leaguePoints = (student?.displayPoints !== undefined ? student.displayPoints : student?.leaguePoints) || 0;

  let totalBadgeCount = 0;
  const rawBadgeObj = student?.displayBadges || student?.badges;
  if (Array.isArray(rawBadgeObj)) {
    totalBadgeCount = rawBadgeObj.length;
  } else if (rawBadgeObj && typeof rawBadgeObj === 'object') {
    totalBadgeCount = (Object.values(rawBadgeObj) as any[]).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
  }

  // Öğrencinin geçerli sınav geçmişi
  const validHistory = Array.isArray(allHistory)
    ? allHistory.filter(h => h && (h.score > 0 || (h.details && Object.keys(h.details).length > 0) || (h.answers && h.answers.length > 0)))
    : [];

  // Seçili ay / dönem sınavlarını filtrele
  const selectedMonth = options?.selectedMonth || 'all';
  const selectedMonthLabel = options?.selectedMonthLabel || 'Tüm Dönem';

  const monthFilteredHistory = selectedMonth !== 'all'
    ? validHistory.filter(h => h.monthKey === selectedMonth)
    : validHistory;

  const periodExams = monthFilteredHistory.length > 0 ? monthFilteredHistory : validHistory;
  const isUsingPeriodFilter = selectedMonth !== 'all' && monthFilteredHistory.length > 0;
  const periodLabel = isUsingPeriodFilter
    ? `${selectedMonthLabel} (${periodExams.length} Deneme)`
    : (validHistory.length > 0 ? `Genel Dönem (${validHistory.length} Deneme)` : 'Henüz Sınav Yok');

  // Hedef (son) sınav: seçili dönemdeki en güncel sınav
  const lastExam = periodExams.length > 0 ? periodExams[periodExams.length - 1] : (validHistory.length > 0 ? validHistory[validHistory.length - 1] : null);
  const lastExamIdxInAll = lastExam ? validHistory.findIndex(h => h === lastExam || (h.examId && h.examId === lastExam.examId && h.date === lastExam.date)) : -1;
  const prevExam = lastExamIdxInAll > 0 ? validHistory[lastExamIdxInAll - 1] : (periodExams.length > 1 ? periodExams[periodExams.length - 2] : null);

  const hasExamData = Boolean(lastExam);
  const examName = lastExam?.name || 'Henüz Sınav Kaydı Yok';
  const examDate = lastExam?.date || '';
  const score = Number(lastExam?.score || 0);

  // Son sınavın ders kırılımlarını çıkar
  const rawDetailsSource = lastExam?.details?.lessons
    || lastExam?.details
    || lastExam?.examRes?.evaluatedScore?.subjectScores
    || lastExam?.examRes?.details?.lessons
    || lastExam?.examRes?.scores;

  const canonicalMap = extractSubjectLessonsFromRecord(rawDetailsSource);

  // Dönem içi ders net ortalamalarını hesapla
  const periodSubjectTotals = new Map<string, { sumNet: number; count: number }>();
  periodExams.forEach(pExam => {
    const pDetails = pExam?.details?.lessons
      || pExam?.details
      || pExam?.examRes?.evaluatedScore?.subjectScores
      || pExam?.examRes?.details?.lessons
      || pExam?.examRes?.scores;
    const pMap = extractSubjectLessonsFromRecord(pDetails);
    pMap.forEach((stat, cKey) => {
      const cur = periodSubjectTotals.get(cKey) || { sumNet: 0, count: 0 };
      cur.sumNet += stat.net;
      cur.count += 1;
      periodSubjectTotals.set(cKey, cur);
    });
  });

  // ============================================================================
  // OKUL VE SINIF DETAYLI ORTALAMALARINI HESAPLA (Son Sınav ve Dönem Bazlı)
  // ============================================================================
  const matchedExamDef = lastExam?.examDef || (options?.allExams || []).find((ex: any) =>
    (lastExam?.examId && String(ex.id) === String(lastExam.examId)) ||
    (lastExam?.name && ex.name === lastExam.name)
  );

  let schoolAvgScore = 0;
  let schoolAvgNet = 0;
  let classAvgScore = 0;
  let classAvgNet = 0;
  let examRank: number | undefined = undefined;
  let examParticipantCount: number | undefined = undefined;
  let examPercentile: number | undefined = undefined;
  let classRank: number | undefined = undefined;
  let classParticipantCount: number | undefined = undefined;

  const schoolSubjectNets = new Map<string, { sum: number; count: number }>();
  const classSubjectNets = new Map<string, { sum: number; count: number }>();

  if (matchedExamDef && Array.isArray(matchedExamDef.results) && matchedExamDef.results.length > 0) {
    const validParticipants: Array<{
      no: number;
      nameNorm: string;
      clsNorm: string;
      score: number;
      net: number;
      subjMap: Map<string, LessonStat & { order: number; weight: number }>;
    }> = [];

    matchedExamDef.results.forEach((r: any) => {
      const rScore = Number(
        r.evaluatedScore?.total?.lgsScore ??
        r.lgsScore ??
        r.details?.puan ??
        r.average ??
        0
      );
      const rSubjSource = r.evaluatedScore?.subjectScores || r.details?.lessons || r.scores;
      const rSubjMap = extractSubjectLessonsFromRecord(rSubjSource);
      let rNet = Number(r.evaluatedScore?.total?.net ?? r.net ?? 0);
      if (rNet === 0 && rSubjMap.size > 0) {
        rNet = Array.from(rSubjMap.values()).reduce((s, l) => s + l.net, 0);
      }

      if (rScore > 0 || rNet > 0) {
        const rawCls = r.studentClass || (r.classStr ? `${r.classStr}${r.sectionStr || ''}` : '');
        validParticipants.push({
          no: Number(r.no ?? r.studentNo ?? 0),
          nameNorm: normalizeTurkish(r.name || r.studentName || '').toLowerCase().trim(),
          clsNorm: normalizeClassStr(rawCls),
          score: rScore,
          net: rNet,
          subjMap: rSubjMap
        });
      }
    });

    if (validParticipants.length > 0) {
      examParticipantCount = validParticipants.length;
      schoolAvgScore = Math.round((validParticipants.reduce((s, p) => s + p.score, 0) / validParticipants.length) * 100) / 100;
      schoolAvgNet = Math.round((validParticipants.reduce((s, p) => s + p.net, 0) / validParticipants.length) * 100) / 100;

      // Sınav içi sıralama
      const sortedByScore = [...validParticipants].sort((a, b) => (b.score - a.score) || (b.net - a.net));
      const sNoNum = Number(studentNo || 0);
      const sNameNorm = normalizeTurkish(studentName).toLowerCase().trim();
      const foundIdx = sortedByScore.findIndex(p => (sNoNum > 0 && p.no === sNoNum) || (sNameNorm && p.nameNorm === sNameNorm));
      if (foundIdx >= 0) {
        examRank = foundIdx + 1;
        examPercentile = Math.round(((examRank / validParticipants.length) * 100) * 100) / 100;
      }

      // Sınıf içi ortalamalar ve sıralama
      const classParticipants = normStudentClass
        ? validParticipants.filter(p => p.clsNorm === normStudentClass)
        : [];

      if (classParticipants.length > 0) {
        classParticipantCount = classParticipants.length;
        classAvgScore = Math.round((classParticipants.reduce((s, p) => s + p.score, 0) / classParticipants.length) * 100) / 100;
        classAvgNet = Math.round((classParticipants.reduce((s, p) => s + p.net, 0) / classParticipants.length) * 100) / 100;

        const sortedClass = [...classParticipants].sort((a, b) => (b.score - a.score) || (b.net - a.net));
        const cIdx = sortedClass.findIndex(p => (sNoNum > 0 && p.no === sNoNum) || (sNameNorm && p.nameNorm === sNameNorm));
        if (cIdx >= 0) {
          classRank = cIdx + 1;
        }
      }

      // Ders bazlı okul ve sınıf ortalamaları
      validParticipants.forEach(p => {
        p.subjMap.forEach((st, cKey) => {
          const curS = schoolSubjectNets.get(cKey) || { sum: 0, count: 0 };
          curS.sum += st.net;
          curS.count += 1;
          schoolSubjectNets.set(cKey, curS);

          if (normStudentClass && p.clsNorm === normStudentClass) {
            const curC = classSubjectNets.get(cKey) || { sum: 0, count: 0 };
            curC.sum += st.net;
            curC.count += 1;
            classSubjectNets.set(cKey, curC);
          }
        });
      });
    }
  }

  // ============================================================================
  // AYLIK / DÖNEMLİK EKSİK KAZANIM ANALİZİ (Öğrencinin O Ay Girdiği Sınavlar)
  // ============================================================================
  // Seçili aydaki sınavlarda kazanım verisi varsa onları, yoksa tüm geçmişteki kazanımlı sınavları tara
  let examsForKazanim = periodExams.filter(ex => {
    const items = ex?.learningOutcomes?.items || ex?.outcomes || ex?.examDef?.learningOutcomes?.items;
    return Array.isArray(items) && items.length > 0;
  });
  if (examsForKazanim.length === 0) {
    examsForKazanim = validHistory.filter(ex => {
      const items = ex?.learningOutcomes?.items || ex?.outcomes || ex?.examDef?.learningOutcomes?.items;
      return Array.isArray(items) && items.length > 0;
    });
  }

  let totalMeasuredQuestions = 0;
  let totalMasteredQuestions = 0;
  const missingOutcomeMap = new Map<string, MissingOutcomeAnalysisItem>();
  const subjectOutcomeStatsMap = new Map<string, {
    subject: string;
    order: number;
    totalQuestions: number;
    masteredCount: number;
    wrongCount: number;
    emptyCount: number;
  }>();

  examsForKazanim.forEach(exItem => {
    const outcomes = exItem?.learningOutcomes?.items
      || exItem?.outcomes
      || exItem?.examDef?.learningOutcomes?.items
      || [];
    if (!Array.isArray(outcomes) || outcomes.length === 0) return;

    const exDef = exItem?.examDef || (options?.allExams || []).find((e: any) =>
      (exItem?.examId && String(e.id) === String(exItem.examId)) || (exItem?.name && e.name === exItem.name)
    ) || {
      id: String(exItem.examId || 'exam'),
      name: exItem.name || 'Deneme Sınavı',
      date: exItem.date || '',
      keys: exItem.keys || {}
    };

    // Öğrencinin bu sınavdaki ham cevaplarını ve kitapçığını bul
    let studentAns: string[] = [];
    if (Array.isArray(exItem.answers) && exItem.answers.length > 0) {
      studentAns = exItem.answers.map((a: any) => String(a || '').trim().toUpperCase());
    } else if (typeof exItem.answers === 'string' && (exItem.answers as string).trim().length > 0) {
      const trimmed = (exItem.answers as string).trim().toUpperCase();
      studentAns = trimmed.includes(' ') ? trimmed.split(/\s+/) : (trimmed.includes(',') ? trimmed.split(',') : trimmed.split(''));
    } else if (Array.isArray(exItem.examRes?.answers) && exItem.examRes.answers.length > 0) {
      studentAns = exItem.examRes.answers.map((a: any) => String(a || '').trim().toUpperCase());
    } else if (typeof exItem.examRes?.answers === 'string' && (exItem.examRes.answers as string).trim().length > 0) {
      const trimmed = (exItem.examRes.answers as string).trim().toUpperCase();
      studentAns = trimmed.includes(' ') ? trimmed.split(/\s+/) : (trimmed.includes(',') ? trimmed.split(',') : trimmed.split(''));
    }
    let studentBooklet: string = exItem.booklet || exItem.examRes?.booklet || 'A';

    // Eğer exItem üzerinde answers yoksa doğrudan exDef.results içinden öğrenciyi bul
    if (studentAns.length === 0 && Array.isArray(exDef.results)) {
      const sNoNum = Number(studentNo || 0);
      const sNameNorm = normalizeTurkish(studentName).toLowerCase().trim();
      const matchedRes = exDef.results.find((r: any) => {
        const rNo = Number(r.no ?? r.studentNo ?? 0);
        if (sNoNum > 0 && rNo === sNoNum) return true;
        const rName = normalizeTurkish(r.name || r.studentName || '').toLowerCase().trim();
        return Boolean(sNameNorm && rName === sNameNorm);
      });
      if (matchedRes) {
        studentBooklet = matchedRes.booklet || studentBooklet;
        if (Array.isArray(matchedRes.answers) && matchedRes.answers.length > 0) {
          studentAns = matchedRes.answers.map((a: any) => String(a || '').trim().toUpperCase());
        } else if (typeof matchedRes.answers === 'string' && matchedRes.answers.trim().length > 0) {
          const trimmed = matchedRes.answers.trim().toUpperCase();
          studentAns = trimmed.includes(' ') ? trimmed.split(/\s+/) : (trimmed.includes(',') ? trimmed.split(',') : trimmed.split(''));
        }
      }
    }

    if (studentAns.length === 0) return;

    // Bu sınavdaki her soru için okul genel başarı oranını hesapla (nokta atışı teşhis için)
    const questionSchoolAccuracy = new Map<number, number>();
    if (Array.isArray(exDef.results) && exDef.results.length > 0) {
      const participantsWithAns = exDef.results.filter((r: any) => Array.isArray(r.answers) && r.answers.length > 0);
      if (participantsWithAns.length > 0) {
        outcomes.forEach((out: any, idx: number) => {
          const qIdx = out.questionNumber ? out.questionNumber - 1 : idx;
          let correctStudents = 0;
          participantsWithAns.forEach((p: any) => {
            const pBooklet = (p.booklet || 'A').toUpperCase().trim();
            const pKey = exDef.keys?.[pBooklet] || exDef.keys?.['A'] || [];
            const pAnsIdx = (pBooklet === 'B' && out.altQIndex) ? (out.altQIndex - 1) : qIdx;
            const pTrueAns = (pBooklet === 'B' && pKey[pAnsIdx])
              ? pKey[pAnsIdx].toUpperCase().trim()
              : (out.correctAnswer || pKey[qIdx] || '').toUpperCase().trim();
            const pAns = (p.answers?.[pAnsIdx] || '').toUpperCase().trim();
            if (pAns && pAns !== '-' && pTrueAns && pAns === pTrueAns) {
              correctStudents++;
            }
          });
          questionSchoolAccuracy.set(qIdx, Math.round((correctStudents / participantsWithAns.length) * 100));
        });
      }
    }

    const studentExamResultObj: any = {
      id: String(student?.id || studentNo || '1'),
      no: studentNo,
      name: studentName,
      studentClass: className,
      booklet: studentBooklet,
      answers: studentAns
    };

    const kazanimReport = evaluateStudentKazanimReport(studentExamResultObj, outcomes, exDef);
    totalMeasuredQuestions += kazanimReport.totalOutcomes;
    totalMasteredQuestions += kazanimReport.masteredCount;

    kazanimReport.items.forEach((evalItem, idx) => {
      const rawOut = outcomes[idx] || evalItem.outcome;
      const qIdx = rawOut.questionNumber ? rawOut.questionNumber - 1 : idx;
      const meta = resolveSubjectCanonical(evalItem.outcome.subjectName || rawOut.subjectName || 'Genel');
      const subjDisplay = meta ? meta.displayName : (evalItem.outcome.subjectName || 'Genel');
      const subjOrder = meta ? meta.order : 99;
      const subjKey = meta ? meta.canonKey : subjDisplay;

      const sStat = subjectOutcomeStatsMap.get(subjKey) || {
        subject: subjDisplay,
        order: subjOrder,
        totalQuestions: 0,
        masteredCount: 0,
        wrongCount: 0,
        emptyCount: 0
      };
      sStat.totalQuestions += 1;
      if (evalItem.isCorrect) sStat.masteredCount += 1;
      else if (evalItem.isWrong) sStat.wrongCount += 1;
      else sStat.emptyCount += 1;
      subjectOutcomeStatsMap.set(subjKey, sStat);

      if (evalItem.isWrong || evalItem.isEmpty) {
        const codeStr = (evalItem.outcome.code || evalItem.outcome.outcomeCode || '').trim();
        const titleStr = (evalItem.outcome.title || evalItem.outcome.outcomeDesc || `Soru ${evalItem.outcome.questionNumber} Kazanımı`).trim();
        const groupKey = `${subjKey}_${codeStr || normalizeTurkish(titleStr).toLowerCase()}`;
        const qSchoolRate = questionSchoolAccuracy.get(qIdx);

        const existing = missingOutcomeMap.get(groupKey);
        const qRef: MissingOutcomeQuestionRef = {
          examName: exItem.name || exDef.name || 'Deneme',
          examDate: exItem.date || exDef.date,
          questionNumber: evalItem.outcome.questionNumber,
          status: evalItem.isWrong ? 'wrong' : 'empty',
          studentAnswer: evalItem.studentAnswer || '-',
          correctAnswer: evalItem.correctAnswer || '-',
          schoolSuccessRate: qSchoolRate
        };

        if (existing) {
          existing.questionRefs.push(qRef);
          if (!existing.examNames.includes(qRef.examName)) {
            existing.examNames.push(qRef.examName);
          }
          if (evalItem.isWrong) existing.wrongCount += 1;
          else existing.emptyCount += 1;
          existing.totalMissedCount += 1;
        } else {
          missingOutcomeMap.set(groupKey, {
            code: codeStr || `S.${evalItem.outcome.questionNumber}`,
            title: titleStr,
            subject: subjDisplay,
            unit: evalItem.outcome.unit || evalItem.outcome.topic,
            examNames: [qRef.examName],
            questionRefs: [qRef],
            wrongCount: evalItem.isWrong ? 1 : 0,
            emptyCount: evalItem.isEmpty ? 1 : 0,
            totalMissedCount: 1,
            priority: 'medium',
            diagnosisType: 'secici_soru',
            diagnosisLabel: 'Pekiştirilmesi Gereken Kazanım',
            diagnosisNote: ''
          });
        }
      }
    });
  });

  // Eksik kazanımları teşhis et ve öncelik sırasına diz
  const monthlyMissingOutcomes: MissingOutcomeAnalysisItem[] = Array.from(missingOutcomeMap.values()).map(item => {
    const rates = item.questionRefs.map(r => r.schoolSuccessRate).filter((r): r is number => typeof r === 'number');
    const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : undefined;
    item.avgSchoolSuccessRate = avgRate;

    if (item.totalMissedCount >= 2) {
      item.priority = 'critical';
      item.diagnosisType = 'tekrarlayan_eksik';
      item.diagnosisLabel = `Tekrarlayan Eksik (${item.totalMissedCount} Soru)`;
      item.diagnosisNote = `Bu kazanımdan toplam ${item.totalMissedCount} soru (${item.wrongCount} yanlış, ${item.emptyCount} boş) kaçırıldı. Kalıcı konu eksiği bulunuyor; konu anlatımı ve kavrama testi ile acil kapatılmalı.`;
    } else if (item.emptyCount > 0 && item.wrongCount === 0) {
      item.priority = 'high';
      item.diagnosisType = 'konu_eksigi';
      item.diagnosisLabel = 'Boş Bırakılan Kazanım (Konu/Yöntem Eksiği)';
      item.diagnosisNote = `Öğrencimiz bu kazanım sorusunu boş bıraktı. Çözüm yöntemini hatırlayamama veya süre/konu eksiği nedeniyle örnek soru çözümü yapılmalı.`;
    } else if (avgRate !== undefined && avgRate >= 60) {
      item.priority = 'high';
      item.diagnosisType = 'dikkat_veya_kavram';
      item.diagnosisLabel = `Dikkat / Çeldirici Hatası (Okul Başarısı %${avgRate})`;
      item.diagnosisNote = `Okul genelinin %${avgRate} oranında doğru yanıtladığı bu soruda yanlış şık (${item.questionRefs[0]?.studentAnswer} yerine ${item.questionRefs[0]?.correctAnswer}) işaretlendi. Soru kökü dikkatsizliği veya kavram yanılgısı kontrol edilmeli.`;
    } else {
      item.priority = 'medium';
      item.diagnosisType = 'secici_soru';
      item.diagnosisLabel = avgRate !== undefined ? `Seçici / Zorlayıcı Kazanım (Okul %${avgRate})` : 'Kavram & Muhakeme Eksiği';
      item.diagnosisNote = `Üst düzey beceri ve yorum gerektiren bu kazanımda yanlış cevap verildi. Yeni nesil soru çözüm taktiği üzerinde durulmalı.`;
    }

    return item;
  }).sort((a, b) => {
    const prioOrder = { critical: 0, high: 1, medium: 2 };
    if (prioOrder[a.priority] !== prioOrder[b.priority]) {
      return prioOrder[a.priority] - prioOrder[b.priority];
    }
    return b.totalMissedCount - a.totalMissedCount;
  });

  const subjectOutcomeSummaries: SubjectOutcomeSummary[] = Array.from(subjectOutcomeStatsMap.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([, st]) => {
      const mPct = st.totalQuestions > 0 ? Math.round((st.masteredCount / st.totalQuestions) * 100) : 0;
      const subMissing = monthlyMissingOutcomes.filter(m => m.subject === st.subject);
      return {
        subject: st.subject,
        totalQuestions: st.totalQuestions,
        masteredCount: st.masteredCount,
        wrongCount: st.wrongCount,
        emptyCount: st.emptyCount,
        masteryPercentage: mPct,
        missingOutcomes: subMissing
      };
    });

  const hasKazanimData = totalMeasuredQuestions > 0;
  const overallMasteryPercentage = totalMeasuredQuestions > 0
    ? Math.round((totalMasteredQuestions / totalMeasuredQuestions) * 100)
    : undefined;

  // Ders tablosuna okul ortalaması, sınıf ortalaması, dönem ortalaması ve eksik kazanım sayılarını entegre et
  const lessons: LessonStat[] = Array.from(canonicalMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order, weight, ...rest }) => {
      const cKey = rest.canonKey || '';
      const sAvgObj = schoolSubjectNets.get(cKey);
      const cAvgObj = classSubjectNets.get(cKey);
      const pAvgObj = periodSubjectTotals.get(cKey);
      const sOutObj = subjectOutcomeStatsMap.get(cKey);

      const sAvgNet = sAvgObj && sAvgObj.count > 0 ? Math.round((sAvgObj.sum / sAvgObj.count) * 100) / 100 : undefined;
      const cAvgNet = cAvgObj && cAvgObj.count > 0 ? Math.round((cAvgObj.sum / cAvgObj.count) * 100) / 100 : undefined;
      const pAvgNet = pAvgObj && pAvgObj.count > 0 ? Math.round((pAvgObj.sumNet / pAvgObj.count) * 100) / 100 : undefined;
      const diffFromSchool = sAvgNet !== undefined ? Math.round((rest.net - sAvgNet) * 100) / 100 : undefined;
      const missedCount = sOutObj ? (sOutObj.wrongCount + sOutObj.emptyCount) : (rest.wrong + rest.empty);
      const masteryRate = sOutObj && sOutObj.totalQuestions > 0
        ? Math.round((sOutObj.masteredCount / sOutObj.totalQuestions) * 100)
        : undefined;

      return {
        ...rest,
        schoolAvgNet: sAvgNet,
        classAvgNet: cAvgNet,
        periodAvgNet: pAvgNet,
        diffFromSchoolAvg: diffFromSchool,
        missedOutcomeCount: missedCount,
        masteryRate
      };
    });

  let totalCorrect = lessons.reduce((sum, l) => sum + l.correct, 0);
  let totalWrong = lessons.reduce((sum, l) => sum + l.wrong, 0);
  let totalEmpty = lessons.reduce((sum, l) => sum + l.empty, 0);
  let totalNet = Math.round(lessons.reduce((sum, l) => sum + l.net, 0) * 100) / 100;

  if (totalNet === 0 && (lastExam?.net || lastExam?.examRes?.net || lastExam?.examRes?.evaluatedScore?.total?.net)) {
    totalNet = Math.round(Number(lastExam?.net ?? lastExam?.examRes?.evaluatedScore?.total?.net ?? lastExam?.examRes?.net ?? 0) * 100) / 100;
  }
  if (totalCorrect === 0 && (lastExam?.totalCorrect || lastExam?.examRes?.totalCorrect || lastExam?.examRes?.evaluatedScore?.total?.correct)) {
    totalCorrect = Number(lastExam?.totalCorrect ?? lastExam?.examRes?.evaluatedScore?.total?.correct ?? lastExam?.examRes?.totalCorrect ?? 0);
  }
  if (totalWrong === 0 && (lastExam?.totalWrong || lastExam?.examRes?.totalWrong || lastExam?.examRes?.evaluatedScore?.total?.wrong)) {
    totalWrong = Number(lastExam?.totalWrong ?? lastExam?.examRes?.evaluatedScore?.total?.wrong ?? lastExam?.examRes?.totalWrong ?? 0);
  }
  if (totalEmpty === 0 && (lastExam?.totalEmpty || lastExam?.examRes?.totalEmpty || lastExam?.examRes?.evaluatedScore?.total?.empty)) {
    totalEmpty = Number(lastExam?.totalEmpty ?? lastExam?.examRes?.evaluatedScore?.total?.empty ?? lastExam?.examRes?.totalEmpty ?? 0);
  }

  // Dönem ve tüm zamanlar öğrenci ortalamaları
  const getExamNet = (ex: any): number => {
    const direct = Number(ex?.net ?? ex?.examRes?.evaluatedScore?.total?.net ?? ex?.examRes?.net ?? 0);
    if (direct > 0) return direct;
    const subMap = extractSubjectLessonsFromRecord(ex?.details?.lessons || ex?.details || ex?.examRes?.evaluatedScore?.subjectScores || ex?.examRes?.scores);
    return Array.from(subMap.values()).reduce((s, l) => s + l.net, 0);
  };

  const studentPeriodAvgScore = periodExams.length > 0
    ? Math.round((periodExams.reduce((s, e) => s + Number(e.score || 0), 0) / periodExams.length) * 100) / 100
    : score;
  const studentPeriodAvgNet = periodExams.length > 0
    ? Math.round((periodExams.reduce((s, e) => s + getExamNet(e), 0) / periodExams.length) * 100) / 100
    : totalNet;

  const studentAllTimeAvgScore = validHistory.length > 0
    ? Math.round((validHistory.reduce((s, e) => s + Number(e.score || 0), 0) / validHistory.length) * 100) / 100
    : score;
  const studentAllTimeAvgNet = validHistory.length > 0
    ? Math.round((validHistory.reduce((s, e) => s + getExamNet(e), 0) / validHistory.length) * 100) / 100
    : totalNet;

  const examComparison: ExamComparisonSummary = {
    periodLabel,
    periodExamCount: periodExams.length,
    totalExamCount: validHistory.length,
    schoolAvgScore,
    schoolAvgNet,
    classAvgScore,
    classAvgNet,
    studentPeriodAvgScore,
    studentPeriodAvgNet,
    studentAllTimeAvgScore,
    studentAllTimeAvgNet,
    scoreDiffFromSchool: schoolAvgScore > 0 ? Math.round((score - schoolAvgScore) * 100) / 100 : 0,
    netDiffFromSchool: schoolAvgNet > 0 ? Math.round((totalNet - schoolAvgNet) * 100) / 100 : 0,
    scoreDiffFromClass: classAvgScore > 0 ? Math.round((score - classAvgScore) * 100) / 100 : 0,
    netDiffFromClass: classAvgNet > 0 ? Math.round((totalNet - classAvgNet) * 100) / 100 : 0,
    scoreDiffFromOwnAvg: studentAllTimeAvgScore > 0 ? Math.round((score - studentAllTimeAvgScore) * 100) / 100 : 0,
    examRank,
    examParticipantCount,
    examPercentile,
    classRank,
    classParticipantCount
  };

  const findLesson = (cKey: string) => lessons.find(l => l.canonKey === cKey) || null;
  const turkStat = findLesson('turkce');
  const matStat = findLesson('matematik');
  const fenStat = findLesson('fen');
  const inkStat = findLesson('inkilap');
  const dinStat = findLesson('din');
  const ingStat = findLesson('ingilizce');

  // Trend hesabı
  let trend: 'up' | 'down' | 'steady' | 'first' = 'first';
  let trendDifference = 0;
  if (prevExam) {
    const diff = score - Number(prevExam.score || 0);
    trendDifference = Math.round(Math.abs(diff) * 100) / 100;
    if (diff > 1.5) trend = 'up';
    else if (diff < -1.5) trend = 'down';
    else trend = 'steady';
  }

  const recentBadges: string[] = [];
  if (lastExam?.badgeCounts && typeof lastExam.badgeCounts === 'object') {
    Object.entries(lastExam.badgeCounts).forEach(([bKey, count]) => {
      if (Number(count) > 0) recentBadges.push(bKey);
    });
  }
  if (recentBadges.length === 0 && Array.isArray(student?.badges)) {
    recentBadges.push(...student.badges.slice(-3));
  }

  // ============================================================================
  // PEDAGOJİK ANALİZ MOTORU 1: NOKTA ATIŞI GÜÇLÜ YÖNLER (Ortalamalar & Kazanım)
  // ============================================================================
  const strengths: CoachingInsight[] = [];

  // 1. Okul Ortalaması ve Genel Sıralama Başarısı
  if (schoolAvgScore > 0 && score > schoolAvgScore + 10) {
    const rankStr = examRank && examParticipantCount ? `Okul genelinde ${examParticipantCount} öğrenci arasında #${examRank}. sırada` : 'Okul ortalamasının belirgin şekilde üzerinde';
    strengths.push({
      title: `Okul Ortalamasının +${examComparison.scoreDiffFromSchool.toFixed(1)} Puan Üzerinde`,
      desc: `${rankStr} yer alarak ${totalNet.toFixed(2)} net ile okul net ortalamasını (${schoolAvgNet.toFixed(2)} net) +${examComparison.netDiffFromSchool.toFixed(2)} net geride bıraktı.`,
      icon: '🏆',
      tag: examPercentile ? `İlk %${Math.ceil(examPercentile)} Dilim` : 'Üstün Performans'
    });
  } else if (classAvgScore > 0 && score > classAvgScore + 5) {
    strengths.push({
      title: `${className || 'Sınıf'} Ortalamasının Üzerinde Başarı`,
      desc: `Sınıf puan ortalaması ${classAvgScore.toFixed(1)} iken ${score.toFixed(2)} puan ve ${totalNet.toFixed(2)} net ile sınıfında öncü grupta yer aldı.`,
      icon: '🌟',
      tag: classRank && classParticipantCount ? `Sınıfta #${classRank}/${classParticipantCount}` : 'Sınıf Liderliği'
    });
  }

  // 2. Okul Ortalamasına Göre En Güçlü Fark Yaratılan Branşlar
  const outperformingLessons = [...lessons]
    .filter(l => typeof l.diffFromSchoolAvg === 'number' && l.diffFromSchoolAvg >= 1.5)
    .sort((a, b) => (b.diffFromSchoolAvg || 0) - (a.diffFromSchoolAvg || 0));

  if (outperformingLessons.length > 0) {
    const bestL = outperformingLessons[0];
    strengths.push({
      title: `${bestL.name} Branşında Lokomotif Güç (+${bestL.diffFromSchoolAvg?.toFixed(2)} Net Fark)`,
      desc: `Okulun ${bestL.schoolAvgNet?.toFixed(2)} net ortalamasına karşılık ${bestL.net.toFixed(2)} net (${bestL.correct}D / ${bestL.wrong}Y) üreterek rakiplerine en büyük puan farkını bu derste attı.`,
      icon: bestL.canonKey === 'matematik' ? '📐' : bestL.canonKey === 'fen' ? '🔬' : bestL.canonKey === 'turkce' ? '📖' : '⚔️',
      tag: `${bestL.name} Lideri`
    });
  }

  // 3. Kazanım Hakimiyeti Yüksek Branş Tespiti
  if (hasKazanimData && subjectOutcomeSummaries.length > 0) {
    const masteredSubjs = subjectOutcomeSummaries.filter(s => s.masteryPercentage >= 85 && s.totalQuestions >= 10);
    if (masteredSubjs.length > 0) {
      const names = masteredSubjs.map(s => `${s.subject} (%${s.masteryPercentage})`).join(', ');
      strengths.push({
        title: `Yüksek Kazanım Kavrama Oranı (%${overallMasteryPercentage} Genel Hakimiyet)`,
        desc: `Ölçülen ${totalMeasuredQuestions} soruda ${totalMasteredQuestions} kazanım doğru kavrandı. Özellikle ${names} testlerinde konu bütünlüğü çok güçlü.`,
        icon: '🎓',
        tag: 'Kazanım Tam İsabet'
      });
    }
  }

  // 4. Sözel / Sayısal Özel Performans & Kalkan Disiplini
  const sozelWrong = (inkStat?.wrong || 0) + (dinStat?.wrong || 0) + (ingStat?.wrong || 0);
  const sozelCorrect = (inkStat?.correct || 0) + (dinStat?.correct || 0) + (ingStat?.correct || 0);
  if (sozelCorrect >= 24 && sozelWrong <= 2) {
    strengths.push({
      title: 'Ara Branşlarda (İnkılap / Din / İngilizce) Yüksek İstikrar',
      desc: `30 soruluk sözel yan branşlarda ${sozelCorrect} doğru ve sadece ${sozelWrong} yanlış ile taban puanını güvenceye aldı.`,
      icon: '⚔️',
      tag: 'Sözel Güvencesi'
    });
  }

  if (totalEmpty > totalWrong && totalEmpty > 0) {
    strengths.push({
      title: 'Bilinçli Boş Bırakma (Kalkan) Disiplini',
      desc: `Emin olunmayan ${totalEmpty} soruda rastgele işaretleme yapmayarak yanlışların doğruları götürmesini engelledi.`,
      icon: '🛡️',
      tag: 'Stratejik Savunma'
    });
  }

  if (trend === 'up') {
    strengths.push({
      title: `Yükselen Deneme İvmesi (+${trendDifference.toFixed(2)} Puan)`,
      desc: `Önceki deneme sınavına kıyasla puanını ${trendDifference.toFixed(2)} puan artırarak çalışma temposunun karşılığını almaya başladı.`,
      icon: '🚀',
      tag: 'Pozitif İvme'
    });
  }

  if (strengths.length === 0) {
    strengths.push({
      title: 'Deneme Katılımı ve Gelişim Potansiyeli',
      desc: `${periodLabel} kapsamında sınav pratiğini sürdürerek eksik kazanımlarını tespit etme ve telafi etme fırsatı yakaladı.`,
      icon: '⭐',
      tag: 'Mücadele Ruhu'
    });
  }

  // ============================================================================
  // PEDAGOJİK ANALİZ MOTORU 2: NOKTA ATIŞI RİSKLİ ALANLAR & EKSİK KAZANIMLAR
  // ============================================================================
  const risks: CoachingInsight[] = [];

  // 1. Tekrarlayan (Kronik) Eksik Kazanımlar
  const criticalMissing = monthlyMissingOutcomes.filter(m => m.priority === 'critical');
  if (criticalMissing.length > 0) {
    const topCrit = criticalMissing.slice(0, 2);
    const critDesc = topCrit
      .map(c => `${c.subject} [${c.code}] "${c.title}" (${c.totalMissedCount} soru)`)
      .join(' ve ');
    risks.push({
      title: `Tekrarlayan (Kronik) Kazanım Eksikleri (${criticalMissing.length} Konu)`,
      desc: `Bu dönem aynı kazanımdan birden fazla soru kaçırıldı: ${critDesc}. Bu konular rastlantısal hata değil, doğrudan konu eksiğine işaret ediyor.`,
      icon: '🚨',
      tag: 'Acil Konu Tekrarı'
    });
  }

  // 2. Okul / Sınıf Ortalamasının Gerisinde Kalan veya En Çok Puan Kaybettiren Branş
  const lessonsWithLoss = [...lessons].map(l => {
    const maxQ = l.maxQuestions || 20;
    const lostNet = Math.max(0, maxQ - l.net);
    const isHighCoeff = l.canonKey === 'matematik' || l.canonKey === 'turkce' || l.canonKey === 'fen';
    const weightedLoss = lostNet * (isHighCoeff ? 4 : 1);
    return { ...l, lostNet, weightedLoss, isHighCoeff };
  }).sort((a, b) => b.weightedLoss - a.weightedLoss);

  const behindSchoolLessons = lessonsWithLoss.filter(l => typeof l.diffFromSchoolAvg === 'number' && l.diffFromSchoolAvg < -0.5);
  if (behindSchoolLessons.length > 0) {
    const worstVsSchool = behindSchoolLessons[0];
    const subjMissing = monthlyMissingOutcomes.filter(m => m.subject === worstVsSchool.name).slice(0, 2);
    const outcomeHint = subjMissing.length > 0
      ? ` Kaçırılan temel kazanım: [${subjMissing[0].code}] "${subjMissing[0].title}".`
      : '';
    risks.push({
      title: `${worstVsSchool.name} Neti Okul Ortalamasının Gerisinde (${worstVsSchool.diffFromSchoolAvg?.toFixed(2)} Net)`,
      desc: `Okul ortalaması ${worstVsSchool.schoolAvgNet?.toFixed(2)} net iken öğrencimiz ${worstVsSchool.net.toFixed(2)} nette (${worstVsSchool.correct}D / ${worstVsSchool.wrong}Y / ${worstVsSchool.empty}B) kaldı.${outcomeHint}`,
      icon: '📉',
      tag: 'Ortalama Altı Branş'
    });
  } else if (lessonsWithLoss.length > 0 && lessonsWithLoss[0].lostNet >= 3) {
    const biggestLossL = lessonsWithLoss[0];
    const subjMissing = monthlyMissingOutcomes.filter(m => m.subject === biggestLossL.name).slice(0, 2);
    const outcomeHint = subjMissing.length > 0
      ? ` Odaklanılması gereken ilk kazanım: [${subjMissing[0].code}] "${subjMissing[0].title}".`
      : '';
    risks.push({
      title: `En Yüksek Katsayılı Puan Kaybı: ${biggestLossL.name} (-${biggestLossL.lostNet.toFixed(2)} Net Kayıp)`,
      desc: `${biggestLossL.name} testinde ${biggestLossL.wrong} yanlış ve ${biggestLossL.empty} boş nedeniyle ${biggestLossL.lostNet.toFixed(2)} net potansiyeli kaybedildi (Okul Ort: ${biggestLossL.schoolAvgNet !== undefined ? biggestLossL.schoolAvgNet.toFixed(2) : '-'} net).${outcomeHint}`,
      icon: '🎯',
      tag: 'Katsayı Kaybı'
    });
  }

  // 3. Kolay/Orta Sorularda Dikkat & Çeldirici Hataları (Okul Başarısı >= %60 Olan Yanlışlar)
  const attentionErrors = monthlyMissingOutcomes.filter(m => m.diagnosisType === 'dikkat_veya_kavram');
  if (attentionErrors.length > 0) {
    const exErr = attentionErrors[0];
    risks.push({
      title: `Dikkat & Çeldirici Kayıpları (${attentionErrors.length} Soru)`,
      desc: `Okul genelinin %${exErr.avgSchoolSuccessRate} oranında doğru yaptığı ${exErr.subject} [${exErr.code}] "${exErr.title}" gibi kazanımlarda yanlış şık işaretlendi. Soru köklerini hızlı geçme ve çeldirici tuzağına düşme riski var.`,
      icon: '⚠️',
      tag: 'Dikkat Analizi'
    });
  }

  // 4. Yanlış Sayısı Aşınması (3 Yanlış = 1 Doğru)
  if (totalWrong >= 9) {
    const penaltyNet = (totalWrong / 3).toFixed(2);
    risks.push({
      title: `Yanlış Cevap Kaynaklı Net Erimesi (-${penaltyNet} Net Ceza)`,
      desc: `Toplam ${totalWrong} yanlış cevap, kazanılmış doğruların ${penaltyNet} netini sildi. Özellikle iki şık arasında kalınan sorularda boş bırakma disiplini uygulanmalı.`,
      icon: '🛑',
      tag: 'Net Aşınması'
    });
  }

  // 5. Öğrencinin Kendi Ortalamasına Göre Düşüş Kontrolü
  if (examComparison.scoreDiffFromOwnAvg < -5 && validHistory.length >= 2) {
    risks.push({
      title: `Kendi Genel Ortalamasının Altında Seyir (${examComparison.scoreDiffFromOwnAvg.toFixed(2)} Puan)`,
      desc: `Öğrencimizin genel deneme ortalaması ${studentAllTimeAvgScore.toFixed(2)} puan (${studentAllTimeAvgNet.toFixed(2)} net) iken son sınavda ${score.toFixed(2)} puanda kaldı.`,
      icon: '📊',
      tag: 'Dalgalanma Uyarısı'
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: 'Üst Dilim Koruma ve Seçici Soru Odaklılık',
      desc: 'Genel net dengesi oldukça sağlıklı; yüzdelik dilimi %1 bandına çekmek için sadece seçici yeni nesil sorulardaki işlem hızı artırılmalı.',
      icon: '💡',
      tag: 'Zirve Kontrolü'
    });
  }

  // Geriye dönük uyumluluk için topWeakOutcomes dizisini doldur
  const topWeakOutcomes: Array<{ code: string; desc: string; subject: string }> = monthlyMissingOutcomes
    .slice(0, 8)
    .map(m => ({
      code: m.code,
      desc: m.title,
      subject: m.subject
    }));

  // ============================================================================
  // PEDAGOJİK ANALİZ MOTORU 3: 3 MADDELİK NOKTA ATIŞI EYLEM PLANI
  // ============================================================================
  const tactics: CoachingTactic[] = [];

  // ADIM 1: Eksik Kazanım Odaklı Nokta Atışı Telafi Reçetesi
  if (monthlyMissingOutcomes.length > 0) {
    const primary = monthlyMissingOutcomes[0];
    const secondary = monthlyMissingOutcomes[1];
    const qNumsStr = primary.questionRefs.map(r => `Soru ${r.questionNumber}`).join(', ');
    const secondText = secondary
      ? ` Ardından ${secondary.subject} [${secondary.code}] "${secondary.title}" kazanımından 2 tarama testi çöz.`
      : '';
    tactics.push({
      step: 1,
      title: `Öncelikli Kazanım Telafisi: ${primary.subject} (${primary.code})`,
      action: `"${primary.title}" (${qNumsStr}) kazanımında yaşanan puan kaybını kapatmak için önce 15 dakikalık konu özeti tekrarı yap, ardından bu kazanımdan 30 soruluk beceri temelli test çöz.${secondText}`,
      icon: '🎯',
      targetLesson: primary.subject
    });
  } else if (lessonsWithLoss.length > 0) {
    const topLoss = lessonsWithLoss[0];
    tactics.push({
      step: 1,
      title: `${topLoss.name} Branşında Hata Analizi ve Konu Tarama`,
      action: `Son denemede ${topLoss.name} testindeki ${topLoss.wrong} yanlış ve ${topLoss.empty} boş sorunun tamamını kitapçık üzerinde yeniden çöz. Yapılamayan soru tiplerinden deneme öncesi 2'şer test çöz.`,
      icon: '🎯',
      targetLesson: topLoss.name
    });
  } else {
    tactics.push({
      step: 1,
      title: 'Seçici Sorular İçin Zamanlı Branş Denemesi',
      action: 'Haftada 3 adet süre tutarak Matematik ve Fen Bilimleri branş denemesi çöz; son 5 dakikada turlama kontrolü yap.',
      icon: '🎯'
    });
  }

  // ADIM 2: Okul/Sınıf Ortalamalarıyla Kıyaslamalı Branş Net Hedefi
  if (lessonsWithLoss.length > 0) {
    const targetL = behindSchoolLessons.length > 0 ? behindSchoolLessons[0] : lessonsWithLoss[0];
    const maxQ = targetL.maxQuestions || 20;
    const targetNet = Math.min(maxQ, Math.ceil(targetL.net + Math.min(4, Math.max(2, targetL.lostNet * 0.5))));
    const schoolCompText = targetL.schoolAvgNet !== undefined
      ? ` (Okul Ortalaması: ${targetL.schoolAvgNet.toFixed(2)} net)`
      : '';
    tactics.push({
      step: 2,
      title: `${targetL.name} Hedefi: ${targetL.net.toFixed(2)} Net ➔ ${targetNet}.00 Net`,
      action: `Mevcut ${targetL.net.toFixed(2)} netini${schoolCompText} bir sonraki sınavda ${targetNet} nete taşımak için; ${targetL.wrong} yanlış yapılan soru tiplerinde şık eleme tekniğini kullan ve işlem adımlarını mutlaka kağıda yaz.`,
      icon: targetL.canonKey === 'matematik' ? '📐' : targetL.canonKey === 'fen' ? '🔬' : '📈',
      targetLesson: targetL.name
    });
  } else {
    tactics.push({
      step: 2,
      title: 'Katsayısı Yüksek Branşlarda Tam İsabet',
      action: 'Türkçe, Matematik ve Fen Bilimlerinde soru köklerindeki altı çizili olumsuz ifadelere dikkat ederek dikkat hatalarını sıfıra indir.',
      icon: '📈'
    });
  }

  // ADIM 3: Sınav İçi Strateji, Yanlış/Boş Dengesi ve Lig Rozet Hedefi
  if (totalWrong >= 8 && totalWrong > totalEmpty) {
    const savedNet = ((totalWrong * 0.4) / 3).toFixed(2);
    tactics.push({
      step: 3,
      title: 'Kalkan Stratejisi ile Net Koruma (+20 LP Rozet Hedefi)',
      action: `Son sınavdaki ${totalWrong} yanlışın en az %40'ını iki şık arasında kaldığında boş bırakarak doğrudan +${savedNet} net kurtarabilir ve Akademi Arena'da "Kalkan" rozetini kazanabilirsin.`,
      icon: '🛡️'
    });
  } else if (totalEmpty >= 6) {
    tactics.push({
      step: 3,
      title: 'Turlama Tekniği ile Boş Soruları Eritme',
      action: `Sınavda boş kalan ${totalEmpty} soruya ikinci turda vakit ayırabilmek için ilk turda 60 saniyeyi aşan sorulara işaret koyup geç; kalan sürede bu sorulartan en az 3 tanesini nete dönüştür.`,
      icon: '⏱️'
    });
  } else {
    tactics.push({
      step: 3,
      title: 'Sıfır Dikkat Hatası & Optik Kontrol Disiplini',
      action: 'Her testin bitiminde 1 dakikalık mini mola vererek işaretlediğin şıklarla optik formdaki kodlamaları birebir kontrol et; "Tam İsabet" ve "Zirve" rozetlerini hedefle.',
      icon: '🏆'
    });
  }

  // ============================================================================
  // PEDAGOJİK ANALİZ MOTORU 4: REHBERLİK SERVİSİ DETAYLI YÖNLENDİRME REÇETESİ
  // ============================================================================
  const guidancePrescription: GuidancePrescriptionItem[] = [];

  // 1. Genel Deneme Sonucu & Ortalamalar Kıyaslaması
  const avgBullets: string[] = [];
  if (schoolAvgScore > 0) {
    const diffSign = examComparison.scoreDiffFromSchool >= 0 ? '+' : '';
    const netSign = examComparison.netDiffFromSchool >= 0 ? '+' : '';
    avgBullets.push(
      `Son denemede ${score.toFixed(2)} puan (${totalNet.toFixed(2)} net) elde edilerek okul ortalamasına (${schoolAvgScore.toFixed(2)} puan / ${schoolAvgNet.toFixed(2)} net) göre ${diffSign}${examComparison.scoreDiffFromSchool.toFixed(2)} puan (${netSign}${examComparison.netDiffFromSchool.toFixed(2)} net) fark oluştu.`
    );
  }
  if (classAvgScore > 0) {
    const cSign = examComparison.scoreDiffFromClass >= 0 ? '+' : '';
    avgBullets.push(
      `${className || 'Sınıf'} ortalaması ${classAvgScore.toFixed(2)} puan (${classAvgNet.toFixed(2)} net) olup öğrencimiz sınıf ortalamasına göre ${cSign}${examComparison.scoreDiffFromClass.toFixed(2)} puan konumundadır${classRank ? ` (Sınıf sırası: #${classRank}/${classParticipantCount})` : ''}.`
    );
  }
  if (periodExams.length > 1) {
    avgBullets.push(
      `${periodLabel} içerisindeki ${periodExams.length} denemenin ortalaması ${studentPeriodAvgScore.toFixed(2)} puan ve ${studentPeriodAvgNet.toFixed(2)} nettir.`
    );
  } else {
    avgBullets.push(
      `Öğrencimizin genel sınav ortalaması ${studentAllTimeAvgScore.toFixed(2)} puan (${studentAllTimeAvgNet.toFixed(2)} net) seviyesindedir.`
    );
  }

  guidancePrescription.push({
    category: 'AKADEMİK KONUM & ORTALAMALAR ANALİZİ',
    title: 'Genel Deneme Sonucu ve Okul/Sınıf Ortalamalarıyla Kıyaslama',
    icon: '📊',
    summary: examRank && examParticipantCount
      ? `Öğrencimiz son sınavda ${examParticipantCount} katılımcı arasında #${examRank}. sırada (%${examPercentile} dilim) yer almıştır.`
      : `Öğrencimizin son sınav performansı (${score.toFixed(2)} puan / ${totalNet.toFixed(2)} net) dönem ortalamalarıyla karşılaştırılmıştır.`,
    bullets: avgBullets
  });

  // 2. Eksik Kazanım & Hata Karakteristiği Teşhisi
  const kazanimBullets: string[] = [];
  if (hasKazanimData && monthlyMissingOutcomes.length > 0) {
    const repeatedList = monthlyMissingOutcomes.filter(m => m.totalMissedCount >= 2);
    const attentionList = monthlyMissingOutcomes.filter(m => m.diagnosisType === 'dikkat_veya_kavram');
    const emptyList = monthlyMissingOutcomes.filter(m => m.emptyCount > 0);

    if (repeatedList.length > 0) {
      kazanimBullets.push(
        `Birden fazla soruda kaçırılan öncelikli kazanımlar: ${repeatedList.slice(0, 3).map(r => `${r.subject} [${r.code}] "${r.title}" (${r.totalMissedCount} soru)`).join('; ')}.`
      );
    }
    if (attentionList.length > 0) {
      kazanimBullets.push(
        `Okul genelinin yüksek oranda (%60+) doğru yaptığı ancak öğrencimizin yanlış işaretlediği dikkat/çeldirici soruları: ${attentionList.slice(0, 3).map(a => `${a.subject} Soru ${a.questionRefs[0]?.questionNumber} (${a.code})`).join(', ')}.`
      );
    }
    if (emptyList.length > 0) {
      kazanimBullets.push(
        `Boş bırakılan ve konu/çözüm yöntemi tekrarı gerektiren kazanımlar: ${emptyList.slice(0, 3).map(e => `${e.subject} [${e.code}] "${e.title}"`).join('; ')}.`
      );
    }
    if (kazanimBullets.length === 0) {
      kazanimBullets.push(
        `Eksik tespit edilen ${monthlyMissingOutcomes.length} kazanım ağırlıklı olarak seçici muhakeme sorularından oluşmaktadır: ${monthlyMissingOutcomes.slice(0, 3).map(m => `${m.subject} [${m.code}]`).join(', ')}.`
      );
    }
  } else {
    kazanimBullets.push(
      `Toplam ${totalCorrect} doğru, ${totalWrong} yanlış ve ${totalEmpty} boş dağılımına göre en çok net kaybı ${lessonsWithLoss.slice(0, 2).map(l => `${l.name} (${l.wrong}Y/${l.empty}B)`).join(' ve ')} branşlarında gerçekleşmiştir.`
    );
  }

  guidancePrescription.push({
    category: 'NOKTA ATIŞI KAZANIM TEŞHİSİ',
    title: hasKazanimData
      ? `Kavranmamış Kazanım Analizi (${monthlyMissingOutcomes.length} Eksik Kazanım / %${overallMasteryPercentage} Kavrama)`
      : 'Branş Bazlı Yanlış ve Boş Soru Karakteristiği',
    icon: '🎯',
    summary: hasKazanimData
      ? `Ölçülen ${totalMeasuredQuestions} soruda ${totalMasteredQuestions} doğru kavrama sağlanmış; ${totalWrong} yanlış ve ${totalEmpty} boş sorunun ait olduğu ${monthlyMissingOutcomes.length} tekil kazanım raporlanmıştır.`
      : `Sınavdaki doğru, yanlış ve boş dağılımları ders katsayılarına göre incelenmiştir.`,
    bullets: kazanimBullets
  });

  // 3. Somut Rehberlik ve Çalışma Yönlendirmesi
  const actionBullets: string[] = [];
  if (monthlyMissingOutcomes.length > 0) {
    const top3Outcomes = monthlyMissingOutcomes.slice(0, 3);
    actionBullets.push(
      `DYK ve bireysel etütlerde bu hafta sırasıyla şu kazanımlar çalışılmalıdır: ${top3Outcomes.map((o, idx) => `(${idx + 1}) ${o.subject} - ${o.code}: ${o.title}`).join(' | ')}.`
    );
  }
  if (lessonsWithLoss.length > 0) {
    const mainTarget = lessonsWithLoss[0];
    actionBullets.push(
      `${mainTarget.name} dersinde ${mainTarget.net.toFixed(2)} olan neti okul üst grubuna taşımak için günlük 25 soruluk süreli soru çözümü ve "Hata Defteri" takibi yapılmalıdır.`
    );
  }
  actionBullets.push(
    totalWrong > totalEmpty * 1.5
      ? `Yanlış sayısı (${totalWrong}Y) boş sayısından (${totalEmpty}B) yüksek olduğu için denemelerde iki şık arasında kalınan sorularda "Kalkan (Boş Bırakma)" kuralı sıkı şekilde uygulanmalıdır.`
      : `Boş bırakılan (${totalEmpty}B) ve yanlış yapılan (${totalWrong}Y) soruların tamamı bir sonraki deneme sınavından önce branş öğretmenlerine sorularak kapatılmalıdır.`
  );

  guidancePrescription.push({
    category: 'REHBERLİK & ETÜT YÖNLENDİRMESİ',
    title: 'Haftalık Somut Çalışma ve Takip Reçetesi',
    icon: '🧭',
    summary: 'Öğrencimizin bir sonraki deneme sınavında doğrudan net ve yüzdelik dilim sıçraması yapması için uygulanacak rehberlik planı:',
    bullets: actionBullets
  });

  // ============================================================================
  // KOÇUN KAPANIŞ VE REHBERLİK ÖZET METNİ (coachSummary)
  // ============================================================================
  const schoolCompSummary = schoolAvgScore > 0
    ? `Son sınavda ${score.toFixed(2)} puan (${totalNet.toFixed(2)} net) alarak okul ortalamasının (${schoolAvgScore.toFixed(2)} puan / ${schoolAvgNet.toFixed(2)} net) ${examComparison.scoreDiffFromSchool >= 0 ? `+${examComparison.scoreDiffFromSchool.toFixed(2)} puan üzerinde` : `${Math.abs(examComparison.scoreDiffFromSchool).toFixed(2)} puan gerisinde`} yer aldı.`
    : `Son sınavda ${score.toFixed(2)} puan ve ${totalNet.toFixed(2)} net (${totalCorrect}D / ${totalWrong}Y / ${totalEmpty}B) üretti.`;

  const kazanimSummarySentence = hasKazanimData && monthlyMissingOutcomes.length > 0
    ? ` ${periodLabel} analizinde ölçülen ${totalMeasuredQuestions} sorunun %${overallMasteryPercentage}'i kavranmış olup, eksik kalan ${monthlyMissingOutcomes.length} kazanım içerisinde özellikle ${monthlyMissingOutcomes.slice(0, 2).map(m => `${m.subject} [${m.code}] "${m.title}"`).join(' ve ')} konularına öncelik verilmelidir.`
    : (lessonsWithLoss.length > 0
        ? ` En yüksek puan potansiyeli barındıran ${lessonsWithLoss[0].name} (${lessonsWithLoss[0].net.toFixed(2)} net) branşındaki yanlış ve boşların telafisi bir sonraki sınavda doğrudan sıçrama sağlayacaktır.`
        : '');

  let guidanceClosing = '';
  if (score >= 440) {
    guidanceClosing = ' Üst düzey nitelikli okul potansiyelini korumak için seçici sorularda dikkat yönetimi ve okul genelinin doğru yaptığı sorularda sıfır hata disiplini hedeflenmelidir.';
  } else if (score >= 370) {
    guidanceClosing = ' Nitelikli okul barajını kalıcı olarak aşmak için tespit edilen eksik kazanımların etütlerle kapatılması ve sayısal branşlarda turlama tekniğinin uygulanması kritik önem taşıyor.';
  } else if (score >= 300) {
    guidanceClosing = ' Sözel branşlardaki net kayıplarını sıfırlayıp Matematik ve Fen Bilimlerinde temel-orta düzey kazanım sorularına odaklanıldığında hızla 380+ puan bandına çıkacaktır.';
  } else {
    guidanceClosing = ' Öncelikle boş ve yanlış bırakılan temel kazanımların konu tekrarıyla pekiştirilmesi ve emin olunmayan sorularda boş bırakma (Kalkan) stratejisinin uygulanması netlerini hızla yukarı taşıyacaktır.';
  }

  const coachSummary = `${studentName} (${className || team}), ${schoolCompSummary}${kazanimSummarySentence}${guidanceClosing}`;

  return {
    studentName,
    studentNo,
    className,
    team,
    rank: studentRank,
    totalStudents: totalStudentsCount,
    leaguePoints,
    examName,
    examDate,
    hasExamData,
    score: Math.round(score * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    totalCorrect,
    totalWrong,
    totalEmpty,
    trend,
    trendDifference,
    lessons,
    recentBadges,
    totalBadgeCount,
    strengths,
    risks,
    tactics,
    coachSummary,
    topWeakOutcomes,
    periodLabel,
    examComparison,
    hasKazanimData,
    totalMeasuredQuestions,
    totalMasteredQuestions,
    overallMasteryPercentage,
    monthlyMissingOutcomes,
    subjectOutcomeSummaries,
    guidancePrescription
  };
}
