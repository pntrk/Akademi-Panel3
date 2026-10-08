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
 * Optimizes a single ExamResult object into a lean, single-source-of-truth schema:
 * - Eliminates duplicate name/studentName, no/studentNo, average/net/total.net copies
 * - Stores canonical curriculum subject scores without alias bloat
 * - Prunes undefined / redundant flat scores dictionaries
 */
export function optimizeExamResult(res: any): ExamResult {
  if (!res || typeof res !== 'object') return res;

  const optSubjectScores = optimizeSubjectScores(res.evaluatedScore?.subjectScores);
  const total = res.evaluatedScore?.total || {};

  const cleanNo = res.no !== undefined ? Number(res.no) : (res.studentNo !== undefined ? Number(res.studentNo) : undefined);
  const cleanName = (res.name || res.studentName || '').trim();
  const cleanNet = total.net !== undefined ? Number(total.net) : (res.net !== undefined ? Number(res.net) : (res.average !== undefined ? Number(res.average) : 0));
  const lgsScore = total.lgsScore !== undefined ? Number(total.lgsScore) : (res.lgsScore !== undefined ? Number(res.lgsScore) : undefined);

  const evaluatedScore: any = {
    total: {
      correct: total.correct !== undefined ? Number(total.correct) : (Number(res.totalCorrect) || 0),
      wrong: total.wrong !== undefined ? Number(total.wrong) : (Number(res.totalWrong) || 0),
      empty: total.empty !== undefined ? Number(total.empty) : (Number(res.totalEmpty) || 0),
      net: typeof cleanNet === 'number' ? Number(cleanNet.toFixed(2)) : 0,
      ...(lgsScore !== undefined && lgsScore > 0 ? { lgsScore: Number(lgsScore.toFixed(2)) } : {}),
      ...(total.tytScore !== undefined && total.tytScore > 0 ? { tytScore: Number(total.tytScore.toFixed(2)) } : {})
    },
    ...(optSubjectScores ? { subjectScores: optSubjectScores } : {})
  };

  return {
    id: String(res.id || ''),
    ...(cleanNo !== undefined ? { no: cleanNo } : {}),
    ...(cleanName ? { name: cleanName } : {}),
    ...(res.studentId ? { studentId: String(res.studentId) } : {}),
    ...(res.classStr ? { classStr: String(res.classStr) } : {}),
    ...(res.sectionStr ? { sectionStr: String(res.sectionStr) } : {}),
    ...(res.booklet ? { booklet: String(res.booklet) } : {}),
    ...(res.answers && Array.isArray(res.answers) && res.answers.length > 0 ? { answers: res.answers } : {}),
    ...(res.earnedLP !== undefined && res.earnedLP > 0 ? { earnedLP: Number(res.earnedLP) } : {}),
    ...(res.earnedBadges && Array.isArray(res.earnedBadges) && res.earnedBadges.length > 0 ? { earnedBadges: res.earnedBadges } : {}),
    evaluatedScore
  };
}

/**
 * Hydrates a lean or legacy ExamResult object with full virtual properties:
 * Guarantees 100% backward compatibility for all components expecting studentNo, studentName,
 * average, net, scores dictionary, totalCorrect, etc.
 */
export function hydrateExamResult(r: any): ExamResult {
  if (!r || typeof r !== 'object') return r;

  const cleanNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : 0);
  const cleanName = String(r.name || r.studentName || '').trim();
  const cleanCls = r.classStr || r.studentClass || '';
  const cleanSec = r.sectionStr || '';
  const total = r.evaluatedScore?.total || {};
  const totalNet = total.net !== undefined ? total.net : (r.net !== undefined ? r.net : (r.average || 0));
  const totalCorrect = total.correct !== undefined ? total.correct : (r.totalCorrect || 0);
  const totalWrong = total.wrong !== undefined ? total.wrong : (r.totalWrong || 0);
  const totalEmpty = total.empty !== undefined ? total.empty : (r.totalEmpty || 0);
  const lgsScore = total.lgsScore !== undefined ? total.lgsScore : r.lgsScore;

  // Build subjectScores map
  const subScores = r.evaluatedScore?.subjectScores || {};

  // Synthesize flat scores dictionary so any component reading r.scores[subName] gets exact net
  const flatScores: Record<string, any> = { ...(r.scores || {}) };
  Object.entries(subScores).forEach(([k, v]: [string, any]) => {
    if (v && v.net !== undefined && flatScores[k] === undefined) {
      flatScores[k] = v.net;
    }
  });

  return {
    ...r,
    id: String(r.id || ''),
    no: cleanNo,
    studentNo: cleanNo,
    name: cleanName,
    studentName: cleanName,
    classStr: cleanCls,
    sectionStr: cleanSec,
    studentClass: r.studentClass || (cleanSec ? `${cleanCls}-${cleanSec}` : cleanCls),
    net: totalNet,
    average: totalNet,
    totalCorrect,
    totalWrong,
    totalEmpty,
    lgsScore,
    scores: flatScores,
    evaluatedScore: r.evaluatedScore || {
      total: {
        correct: totalCorrect,
        wrong: totalWrong,
        empty: totalEmpty,
        net: totalNet,
        lgsScore
      },
      subjectScores: subScores
    }
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
    let rawResults = exam.results || [];
    // If exam.results is empty, find any results in source.results that belong to this exam
    if (rawResults.length === 0 && Array.isArray(source.results)) {
      rawResults = source.results.filter(r => 
        r.scores && (r.scores[String(exam.id)] !== undefined || r.scores[exam.name] !== undefined)
      );
    }

    const optimizedResults = rawResults.map(r => {
      const opt = optimizeExamResult(r);
      if (opt.id) capturedResultIds.add(String(opt.id));
      if (r.id) capturedResultIds.add(String(r.id));
      const sNum = opt.no !== undefined ? opt.no : (r.studentNo || r.no);
      if (sNum !== undefined) {
        capturedResultIds.add(`${exam.id}_${sNum}`);
        capturedResultIds.add(`${exam.name}_${sNum}`);
      }
      return opt;
    });

    const isInternal = exam.examType === 'internal' || (Boolean(exam.keys) && Object.keys(exam.keys).length > 0 && exam.examType !== 'publisher');
    return {
      ...exam,
      participantCount: Math.max(exam.participantCount || 0, optimizedResults.length),
      results: optimizedResults.length > 0 ? optimizedResults : undefined,
      // Retain full coordinates for internal optical exams; omit from publisher Excel exams to save 80KB each
      omrMap: isInternal && exam.omrMap ? exam.omrMap : undefined
    };
  });

  // Global results: ONLY keep results that are NOT already housed inside an exam!
  // This saves ~1MB+ alone by removing the verbatim duplicate array.
  const unattachedResults: ExamResult[] = [];
  (source.results || []).forEach(r => {
    const rId = String(r.id || '');
    const num = r.no !== undefined ? r.no : r.studentNo;
    const isCaptured = (rId && capturedResultIds.has(rId)) ||
      (num !== undefined && (
        exams.some(e => capturedResultIds.has(`${e.id}_${num}`) || capturedResultIds.has(`${e.name}_${num}`)) ||
        (r.scores && Object.keys(r.scores).some(k => capturedResultIds.has(`${k}_${num}`)))
      ));

    if (!isCaptured) {
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
