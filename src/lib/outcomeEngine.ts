import { QuestionOutcomeItem, ExamResult } from '../types';

export interface StudentOutcomeStat {
  code: string;
  desc: string;
  subject: string;
  totalQuestions: number;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  accuracy: number; // 0 - 100
  status: 'mastered' | 'developing' | 'critical'; // %80+ = mastered, %50-79 = developing, <50 = critical
}

export interface StudentCurriculumAnalysis {
  studentId?: string;
  studentNo?: number | string;
  studentName?: string;
  totalQuestions: number;
  totalCorrect: number;
  totalWrong: number;
  totalEmpty: number;
  outcomes: StudentOutcomeStat[];
  strengths: StudentOutcomeStat[];  // Başarılı / Tam Edinilen Kazanımlar (%80+)
  developing: StudentOutcomeStat[]; // Gelişime Açık Kazanımlar (%50-%79)
  criticalRisks: StudentOutcomeStat[]; // Acil Alarm Veren / Eksik Kazanımlar (<%50)
  subjectBreakdown: Record<string, {
    total: number;
    correct: number;
    wrong: number;
    empty: number;
    accuracy: number;
    topRiskOutcome?: StudentOutcomeStat;
  }>;
}

export interface ClassCriticalOutcomeSummary {
  code: string;
  desc: string;
  subject: string;
  totalAttempts: number;
  totalWrongOrEmpty: number;
  failRate: number; // % (Yanlış + Boş / Toplam Soru Cevaplama Denemesi)
  affectedStudentsCount: number;
}

/**
 * Tek bir öğrencinin sınav cevaplarını soru-kazanım haritasıyla eşleştirip detaylı analiz üretir.
 */
export function analyzeStudentOutcomes(
  result: ExamResult,
  outcomes: QuestionOutcomeItem[],
  keys: { [booklet: string]: string[] } | undefined
): StudentCurriculumAnalysis {
  const studentAnswers = result.answers || [];
  const booklet = (result.booklet || 'A').toUpperCase().trim();
  const correctKeys = (keys && keys[booklet]) ? keys[booklet] : (keys && keys['A']) ? keys['A'] : [];

  const outcomeMap = new Map<string, StudentOutcomeStat>();

  outcomes.forEach((outcome) => {
    // Öğrencinin kitapçığına göre soru indeksi (A kitapçığı = qIndex, B kitapçığı = altQIndex || qIndex)
    const effectiveQIndex = (booklet === 'B' && outcome.altQIndex) ? outcome.altQIndex : outcome.qIndex;
    const answerIdx = effectiveQIndex - 1; // 0-based array index

    const studentAns = (studentAnswers[answerIdx] || '').toUpperCase().trim();
    const correctAns = outcome.correctAnswer || (correctKeys[answerIdx] || '').toUpperCase().trim();

    const isAnswered = Boolean(studentAns && studentAns !== '-' && studentAns !== ' ');
    const isCorrect = isAnswered && studentAns === correctAns;
    const isWrong = isAnswered && !isCorrect;
    const isEmpty = !isAnswered;

    const existing = outcomeMap.get(outcome.outcomeCode);
    if (!existing) {
      outcomeMap.set(outcome.outcomeCode, {
        code: outcome.outcomeCode,
        desc: outcome.outcomeDesc,
        subject: outcome.subject,
        totalQuestions: 1,
        correct: isCorrect ? 1 : 0,
        wrong: isWrong ? 1 : 0,
        empty: isEmpty ? 1 : 0,
        net: isCorrect ? 1 : (isWrong ? -0.33 : 0),
        accuracy: isCorrect ? 100 : 0,
        status: isCorrect ? 'mastered' : 'critical'
      });
    } else {
      existing.totalQuestions += 1;
      if (isCorrect) existing.correct += 1;
      if (isWrong) existing.wrong += 1;
      if (isEmpty) existing.empty += 1;
      existing.net = Math.round((existing.correct - (existing.wrong / 3)) * 100) / 100;
      existing.accuracy = existing.totalQuestions > 0 ? Math.round((existing.correct / existing.totalQuestions) * 100) : 0;
      existing.status = existing.accuracy >= 80 ? 'mastered' : (existing.accuracy >= 50 ? 'developing' : 'critical');
    }
  });

  const allOutcomes = Array.from(outcomeMap.values());
  const strengths = allOutcomes.filter(o => o.status === 'mastered');
  const developing = allOutcomes.filter(o => o.status === 'developing');
  const criticalRisks = allOutcomes.filter(o => o.status === 'critical').sort((a, b) => a.accuracy - b.accuracy);

  // Branş kırılımı
  const subjectBreakdown: Record<string, any> = {};
  allOutcomes.forEach(o => {
    if (!subjectBreakdown[o.subject]) {
      subjectBreakdown[o.subject] = { total: 0, correct: 0, wrong: 0, empty: 0, accuracy: 0 };
    }
    const sb = subjectBreakdown[o.subject];
    sb.total += o.totalQuestions;
    sb.correct += o.correct;
    sb.wrong += o.wrong;
    sb.empty += o.empty;
    sb.accuracy = sb.total > 0 ? Math.round((sb.correct / sb.total) * 100) : 0;
  });

  // Her dersin en kritik kazanımını bağla
  Object.keys(subjectBreakdown).forEach(sub => {
    const subRisks = criticalRisks.filter(r => r.subject === sub);
    if (subRisks.length > 0) {
      subjectBreakdown[sub].topRiskOutcome = subRisks[0];
    }
  });

  const totalQuestions = allOutcomes.reduce((sum, o) => sum + o.totalQuestions, 0);
  const totalCorrect = allOutcomes.reduce((sum, o) => sum + o.correct, 0);
  const totalWrong = allOutcomes.reduce((sum, o) => sum + o.wrong, 0);
  const totalEmpty = allOutcomes.reduce((sum, o) => sum + o.empty, 0);

  return {
    studentId: result.studentId || String(result.studentNo || result.no || ''),
    studentNo: result.studentNo || result.no,
    studentName: result.studentName || result.name || 'Öğrenci',
    totalQuestions,
    totalCorrect,
    totalWrong,
    totalEmpty,
    outcomes: allOutcomes,
    strengths,
    developing,
    criticalRisks,
    subjectBreakdown
  };
}

/**
 * Sınıf veya okul bazında en çok hata yapılan "Top 5 Kritik Kazanım" raporunu hesaplar.
 */
export function calculateClassCriticalOutcomes(
  results: ExamResult[],
  outcomes: QuestionOutcomeItem[],
  keys: { [booklet: string]: string[] } | undefined,
  filterClass?: string
): ClassCriticalOutcomeSummary[] {
  const filteredResults = filterClass && filterClass !== 'Tümü'
    ? results.filter(r => {
        const cls = String(r.studentClass || r.classStr || '').trim();
        return cls.toLowerCase().includes(filterClass.toLowerCase());
      })
    : results;

  if (filteredResults.length === 0 || outcomes.length === 0) return [];

  const statMap = new Map<string, {
    code: string;
    desc: string;
    subject: string;
    totalAttempts: number;
    wrongOrEmpty: number;
    affectedStudents: Set<string>;
  }>();

  filteredResults.forEach(studentResult => {
    const studentAnalysis = analyzeStudentOutcomes(studentResult, outcomes, keys);
    const sId = String(studentResult.studentNo || studentResult.studentId || studentResult.name);

    studentAnalysis.outcomes.forEach(outcome => {
      const existing = statMap.get(outcome.code);
      const isFailed = outcome.accuracy < 50;

      if (!existing) {
        const affected = new Set<string>();
        if (isFailed) affected.add(sId);
        statMap.set(outcome.code, {
          code: outcome.code,
          desc: outcome.desc,
          subject: outcome.subject,
          totalAttempts: outcome.totalQuestions,
          wrongOrEmpty: outcome.wrong + outcome.empty,
          affectedStudents: affected
        });
      } else {
        existing.totalAttempts += outcome.totalQuestions;
        existing.wrongOrEmpty += (outcome.wrong + outcome.empty);
        if (isFailed) existing.affectedStudents.add(sId);
      }
    });
  });

  return Array.from(statMap.values())
    .map(item => ({
      code: item.code,
      desc: item.desc,
      subject: item.subject,
      totalAttempts: item.totalAttempts,
      totalWrongOrEmpty: item.wrongOrEmpty,
      failRate: item.totalAttempts > 0 ? Math.round((item.wrongOrEmpty / item.totalAttempts) * 100) : 0,
      affectedStudentsCount: item.affectedStudents.size
    }))
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 5); // En çok hata yapılan ilk 5 kritik kazanım
}
