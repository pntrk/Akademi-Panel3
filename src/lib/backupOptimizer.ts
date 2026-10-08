import { AppState, Student, Exam, ExamResult } from '../types';

/**
 * Standard curriculum canonical subject names.
 */
export const CANONICAL_SUBJECT_KEYS = [
  'Türkçe',
  'Matematik',
  'Fen Bilimleri',
  'T.C. İnkılap Tarihi ve Atatürkçülük',
  'Tarih / Sosyal Bilgiler',
  'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce'
];

/**
 * Prunes redundant subject aliases (e.g. duplicating history across 4 keys, english across 3 keys)
 * while keeping canonical curriculum names and exam-subject ID keys intact.
 */
export function optimizeSubjectScores(
  rawSubjectScores: Record<string, any> | undefined
): Record<string, any> | undefined {
  if (!rawSubjectScores || typeof rawSubjectScores !== 'object') return undefined;

  const optimized: Record<string, any> = {};
  const redundantAliases = new Set([
    'inkılap tarihi', 'inkilap tarihi', 'sosyal bilgiler', 'tarih', 'sb',
    'ing', 'ingilizce', 'english'
  ]);

  // First pass: identify primary standard keys present
  let hasStandardHistory = false;
  let hasStandardEnglish = false;

  for (const key of Object.keys(rawSubjectScores)) {
    const kLower = key.trim().toLowerCase();
    if (kLower === 'tarih / sosyal bilgiler' || kLower === 't.c. inkılap tarihi ve atatürkçülük' || kLower === 'inkılap tarihi ve atatürkçülük') {
      hasStandardHistory = true;
    }
    if (key === 'İngilizce' || kLower === 'yabancı dil') {
      hasStandardEnglish = true;
    }
  }

  for (const [key, val] of Object.entries(rawSubjectScores)) {
    if (!val || typeof val !== 'object') continue;
    const kLower = key.trim().toLowerCase();

    // If we have standard history, skip redundant alias copies
    if (hasStandardHistory && redundantAliases.has(kLower) && key !== 'Tarih / Sosyal Bilgiler' && key !== 'T.C. İnkılap Tarihi ve Atatürkçülük') {
      continue;
    }

    // If we have standard english, skip redundant alias copies
    if (hasStandardEnglish && (kLower === 'ing' || (kLower === 'ingilizce' && key !== 'İngilizce'))) {
      continue;
    }

    optimized[key] = {
      correct: Number(val.correct) || 0,
      wrong: Number(val.wrong) || 0,
      empty: Number(val.empty) || 0,
      net: typeof val.net === 'number' ? Number(val.net.toFixed(2)) : (parseFloat(String(val.net || 0)) || 0)
    };
  }

  return Object.keys(optimized).length > 0 ? optimized : undefined;
}

/**
 * Optimizes a single ExamResult object:
 * - Cleans subject aliases
 * - Prunes undefined / empty fields
 */
export function optimizeExamResult(res: any): ExamResult {
  if (!res || typeof res !== 'object') return res;

  const optSubjectScores = optimizeSubjectScores(res.evaluatedScore?.subjectScores);

  let evaluatedScore: any = undefined;
  if (res.evaluatedScore && typeof res.evaluatedScore === 'object') {
    const total = res.evaluatedScore.total || {};
    evaluatedScore = {
      total: {
        correct: Number(total.correct) || 0,
        wrong: Number(total.wrong) || 0,
        empty: Number(total.empty) || 0,
        net: typeof total.net === 'number' ? Number(total.net.toFixed(2)) : (parseFloat(String(total.net || 0)) || 0),
        ...(total.lgsScore !== undefined ? { lgsScore: Number(total.lgsScore) } : {}),
        ...(total.tytScore !== undefined ? { tytScore: Number(total.tytScore) } : {})
      },
      ...(optSubjectScores ? { subjectScores: optSubjectScores } : {})
    };
  }

  // Prune redundant alias entries from scores dictionary
  let compactScores: Record<string, any> | undefined = undefined;
  if (res.scores && typeof res.scores === 'object') {
    compactScores = {};
    for (const [k, v] of Object.entries(res.scores)) {
      const kLower = k.trim().toLowerCase();
      // Skip redundant duplicate alias keys in scores
      if (kLower === 'ing' || kLower === 'sb' || kLower === 'inkılap tarihi' || kLower === 'sosyal bilgiler' || kLower === 'tarih') {
        continue;
      }
      compactScores[k] = v;
    }
  }

  const cleanNo = res.studentNo !== undefined ? Number(res.studentNo) : (res.no !== undefined ? Number(res.no) : undefined);
  const cleanName = (res.studentName || res.name || '').trim();

  return {
    id: String(res.id || ''),
    ...(cleanNo !== undefined ? { studentNo: cleanNo, no: cleanNo } : {}),
    ...(cleanName ? { studentName: cleanName, name: cleanName } : {}),
    ...(res.studentId ? { studentId: String(res.studentId) } : {}),
    ...(res.studentClass || res.classStr ? { studentClass: res.studentClass || res.classStr } : {}),
    ...(res.classStr ? { classStr: String(res.classStr) } : {}),
    ...(res.sectionStr ? { sectionStr: String(res.sectionStr) } : {}),
    ...(res.booklet ? { booklet: String(res.booklet) } : {}),
    ...(res.answers && Array.isArray(res.answers) && res.answers.length > 0 ? { answers: res.answers } : {}),
    ...(compactScores ? { scores: compactScores } : {}),
    ...(res.average !== undefined ? { average: Number(res.average) } : {}),
    ...(res.net !== undefined ? { net: Number(res.net) } : {}),
    ...(res.totalCorrect !== undefined ? { totalCorrect: Number(res.totalCorrect) } : {}),
    ...(res.totalWrong !== undefined ? { totalWrong: Number(res.totalWrong) } : {}),
    ...(res.totalEmpty !== undefined ? { totalEmpty: Number(res.totalEmpty) } : {}),
    ...(res.lgsScore !== undefined ? { lgsScore: Number(res.lgsScore) } : {}),
    ...(res.earnedLP !== undefined && res.earnedLP > 0 ? { earnedLP: Number(res.earnedLP) } : {}),
    ...(res.earnedBadges && Array.isArray(res.earnedBadges) && res.earnedBadges.length > 0 ? { earnedBadges: res.earnedBadges } : {}),
    ...(evaluatedScore ? { evaluatedScore } : {})
  };
}

/**
 * Optimizes student object: strips 0-badge maps and empty monthly stats.
 */
export function optimizeStudent(student: any): Student {
  if (!student || typeof student !== 'object') return student;

  const activeBadges: Record<string, number> = {};
  if (student.badges && typeof student.badges === 'object') {
    for (const [k, v] of Object.entries(student.badges)) {
      if (typeof v === 'number' && v > 0) {
        activeBadges[k] = v;
      }
    }
  }

  let activeMonthlyData: Record<string, any> | undefined = undefined;
  if (student.monthlyLeagueData && typeof student.monthlyLeagueData === 'object') {
    const months: Record<string, any> = {};
    for (const [mKey, mVal] of Object.entries(student.monthlyLeagueData as Record<string, any>)) {
      if (mVal && (mVal.points > 0 || (mVal.badges && Object.values(mVal.badges).some((b: any) => Number(b) > 0)))) {
        const mBadges: Record<string, number> = {};
        if (mVal.badges && typeof mVal.badges === 'object') {
          for (const [bk, bv] of Object.entries(mVal.badges)) {
            if (typeof bv === 'number' && bv > 0) mBadges[bk] = bv;
          }
        }
        months[mKey] = {
          points: Number(mVal.points) || 0,
          ...(Object.keys(mBadges).length > 0 ? { badges: mBadges } : {})
        };
      }
    }
    if (Object.keys(months).length > 0) {
      activeMonthlyData = months;
    }
  }

  return {
    id: String(student.id || ''),
    no: Number(student.no) || 0,
    name: String(student.name || '').trim(),
    className: String(student.className || '').trim(),
    ...(student.classStr ? { classStr: String(student.classStr) } : {}),
    ...(student.sectionStr ? { sectionStr: String(student.sectionStr) } : {}),
    ...(student.booklet ? { booklet: String(student.booklet) } : {}),
    ...(student.phone ? { phone: String(student.phone) } : {}),
    ...(student.isRegistered !== undefined ? { isRegistered: Boolean(student.isRegistered) } : {}),
    ...(student.isPaid !== undefined ? { isPaid: Boolean(student.isPaid) } : {}),
    ...(student.examRegistrations && Array.isArray(student.examRegistrations) && student.examRegistrations.length > 0
      ? { examRegistrations: student.examRegistrations }
      : {}),
    ...(student.leagueTeam && student.leagueTeam !== 'Atanmadı' ? { leagueTeam: student.leagueTeam } : {}),
    ...(student.leaguePoints !== undefined && student.leaguePoints > 0 ? { leaguePoints: student.leaguePoints } : {}),
    ...(Object.keys(activeBadges).length > 0 ? { badges: activeBadges as any } : {}),
    ...(activeMonthlyData ? { monthlyLeagueData: activeMonthlyData } as any : {}),
    ...(student.lastTransfer ? { lastTransfer: student.lastTransfer } : {}),
    ...(student.transferHistory && Array.isArray(student.transferHistory) && student.transferHistory.length > 0
      ? { transferHistory: student.transferHistory }
      : {}),
    ...(student.pendingTransfer ? { pendingTransfer: student.pendingTransfer } : {})
  };
}

/**
 * Creates an optimized backup object with ZERO data loss:
 * - Exams store their results as the primary single source of truth.
 * - Global results list does NOT duplicate exam results already stored in exams[].results.
 * - Students have empty 0-badges and redundant fields stripped.
 * - Subject score alias multiplication is eliminated.
 */
export function createOptimizedBackupPayload(source: AppState): any {
  const students = (source.students || []).map(optimizeStudent);

  // Set of result IDs that are captured inside exams
  const capturedResultIds = new Set<string>();

  const exams = (source.exams || []).map((exam: Exam) => {
    const rawResults = exam.results || [];
    const optimizedResults = rawResults.map(r => {
      const opt = optimizeExamResult(r);
      if (opt.id) capturedResultIds.add(String(opt.id));
      if (opt.studentNo) capturedResultIds.add(`${exam.id}_${opt.studentNo}`);
      return opt;
    });

    return {
      ...exam,
      participantCount: Math.max(exam.participantCount || 0, optimizedResults.length),
      results: optimizedResults.length > 0 ? optimizedResults : undefined
    };
  });

  // Global results: ONLY keep results that are NOT already housed inside an exam!
  // This saves ~1MB+ alone by removing the verbatim duplicate array.
  const unattachedResults: ExamResult[] = [];
  (source.results || []).forEach(r => {
    const rId = String(r.id || '');
    const rKey = r.scores ? Object.keys(r.scores)[0] + '_' + (r.studentNo || r.no) : '';
    if (!capturedResultIds.has(rId) && (!rKey || !capturedResultIds.has(rKey))) {
      unattachedResults.push(optimizeExamResult(r));
    }
  });

  const totalResultsCount = exams.reduce((acc, e) => acc + (e.results?.length || 0), 0) + unattachedResults.length;

  const summary = {
    studentCount: students.length,
    examCount: exams.length,
    resultCount: totalResultsCount,
    hallCount: source.examHalls?.length || 0,
    budgetIncomesCount: source.budget?.incomes?.length || 0,
    budgetExpensesCount: source.budget?.expenses?.length || 0,
    budgetDebtsCount: source.budget?.debts?.length || 0,
    arenaMentorsCount: Object.keys(source.leagueMentors || {}).length,
    arenaBonusCount: Object.keys(source.leagueTeamPoints || {}).length,
    approvedTransferCount: source.approvedTransfers?.length || 0
  };

  return {
    appName: "Akademi Panel 2",
    version: "2.1-optimized",
    backupDate: new Date().toISOString(),
    school: "Kırklareli Atatürk Ortaokulu",
    summary,
    students,
    exams,
    // Only unattached results needed in global array; exams house all exam-specific results
    results: unattachedResults,
    examHalls: source.examHalls || [],
    budget: source.budget || { incomes: [], expenses: [], debts: [] },
    leagueMentors: source.leagueMentors || {},
    leagueTeamPoints: source.leagueTeamPoints || {},
    approvedTransfers: source.approvedTransfers || [],
    admins: source.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
    teachers: source.teachers || [],
    canonicalDriveFileId: source.canonicalDriveFileId,
    canonicalDriveFileLink: source.canonicalDriveFileLink,
    isDriveFileLocked: source.isDriveFileLocked,
    examCalendarPrintSettings: (() => {
      try {
        const cfg = localStorage.getItem('akademi_exam_calendar_print_config');
        return cfg ? JSON.parse(cfg) : undefined;
      } catch {
        return undefined;
      }
    })()
  };
}
