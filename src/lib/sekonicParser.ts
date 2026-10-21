import { Exam, Student, ExamResult } from '../types';
import { normalizeTurkish, formatClassSec, calculateScore, calculateAtaLigPoints, determineLeagueTeam } from './omrEngine';
import { generateId } from './utils';

export interface ParsedSekonicBranch {
  raw: string; // 20 chars
  answers: string[]; // up to 20 answers
}

export interface ParsedSekonicStudent {
  rowId: string;
  lineNum: number;
  formCode: string; // "840"
  schoolCode: string; // e.g. "707487"
  rawNo: string; // e.g. "00091"
  cleanNo: string; // e.g. "91"
  rawName: string; // e.g. "YİĞİT GEÇKO"
  grade: string; // e.g. "8"
  section: string; // e.g. "A"
  classFormatted: string; // e.g. "8-A"
  gender: string; // "E" or "K"
  booklet: string; // "A" or "B"
  rawAnswersString: string; // 120 chars
  branchAnswers: {
    turkce: string; // 20 chars
    sosyal: string; // 20 chars
    din: string; // 20 chars
    ingilizce: string; // 20 chars
    matematik: string; // 20 chars
    fen: string; // 20 chars
  };
  answers: string[]; // Final flattened array aligned with exam subjects & answer keys
  matchedStudent: Student | null;
  matchStatus: 'matched' | 'unmatched';
  isOverwriting: boolean;
  evaluatedScore?: any;
  totalNet: number;
  totalCorrect: number;
  totalWrong: number;
  totalEmpty: number;
  score: number;
  earnedLP?: number;
}

export interface SekonicParseResult {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  overwriteCount: number;
  students: ParsedSekonicStudent[];
  errors: string[];
}

/**
 * Normalizes student number for reliable matching:
 * "00091" -> "91", " 91 " -> "91", "123" -> "123"
 */
export function normalizeStudentNo(noStr: string | number | null | undefined): string {
  if (noStr === null || noStr === undefined) return '';
  const s = String(noStr).trim();
  const withoutLeadingZeros = s.replace(/^0+/, '');
  return withoutLeadingZeros || s;
}

/**
 * Parses a single 280-character Ertem-840 line from Sekonic SR-55D text output
 */
export function parseSekonicRow(line: string, lineNum: number): { student: ParsedSekonicStudent | null; error?: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 50) {
    return { student: null, error: `Satır ${lineNum}: Çok kısa veya boş satır.` };
  }

  const formCode = line.slice(0, 3).trim();
  if (formCode !== '840' && !formCode.includes('840')) {
    // If line doesn't start with 840, check if it's an Ertem 840 row
    if (line.length < 100) {
      return { student: null, error: `Satır ${lineNum}: Ertem 840 form kodu (840) bulunamadı.` };
    }
  }

  const schoolCode = line.slice(3, 9).trim();
  const rawNo = line.slice(9, 14).trim();
  const cleanNo = normalizeStudentNo(rawNo);
  const rawName = line.slice(14, 34).trim().toUpperCase();

  const grade = line.slice(56, 57).trim() || '8';
  const section = line.slice(57, 58).trim() || 'A';
  const gender = line.slice(58, 59).trim() || '';
  const rawBooklet = line.slice(59, 60).trim();
  const booklet = (rawBooklet === 'B' || rawBooklet === 'b') ? 'B' : 'A';

  const { cls, sec } = formatClassSec(grade, section);
  const classFormatted = cls && cls !== '-' ? (sec && sec !== '-' ? `${cls}-${sec}` : cls) : '8-A';

  // 4-8. Classes answer area (indices 160 to 280: 120 characters total)
  let answersRaw = '';
  if (line.length >= 280) {
    answersRaw = line.slice(160, 280);
  } else if (line.length > 160) {
    answersRaw = line.slice(160).padEnd(120, ' ');
  } else {
    answersRaw = ''.padEnd(120, ' ');
  }

  const turkce = answersRaw.slice(0, 20);
  const sosyal = answersRaw.slice(20, 40);
  const din = answersRaw.slice(40, 60);
  const ingilizce = answersRaw.slice(60, 80);
  const matematik = answersRaw.slice(80, 100);
  const fen = answersRaw.slice(100, 120);

  return {
    student: {
      rowId: generateId(),
      lineNum,
      formCode: '840',
      schoolCode,
      rawNo,
      cleanNo,
      rawName,
      grade,
      section,
      classFormatted,
      gender,
      booklet,
      rawAnswersString: answersRaw,
      branchAnswers: {
        turkce,
        sosyal,
        din,
        ingilizce,
        matematik,
        fen
      },
      answers: [],
      matchedStudent: null,
      matchStatus: 'unmatched',
      isOverwriting: false,
      totalNet: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalEmpty: 0,
      score: 0
    }
  };
}

/**
 * Matches a parsed Sekonic student record with the existing student roster in the app
 */
export function matchStudentInRoster(
  cleanNo: string,
  rawName: string,
  classFormatted: string,
  students: Student[]
): Student | null {
  if (!students || students.length === 0) return null;

  // 1. Primary: Exact match by student number
  if (cleanNo) {
    const foundByNo = students.find(s => normalizeStudentNo(s.no) === cleanNo);
    if (foundByNo) return foundByNo;
  }

  // 2. Secondary: Exact or fuzzy match by normalized name
  if (rawName && rawName.length >= 3) {
    const normTarget = normalizeTurkish(rawName).toLowerCase().replace(/\s+/g, ' ').trim();

    // Exact normalized name
    const exactNameMatch = students.find(s => {
      const sNorm = normalizeTurkish(s.name).toLowerCase().replace(/\s+/g, ' ').trim();
      return sNorm === normTarget;
    });
    if (exactNameMatch) return exactNameMatch;

    // Substring / Startswith match within same class
    const classMatch = students.find(s => {
      const sCls = (s.className || '').toUpperCase();
      const targetCls = classFormatted.toUpperCase();
      const sNorm = normalizeTurkish(s.name).toLowerCase().replace(/\s+/g, ' ').trim();
      const isSameClass = sCls.includes(targetCls) || targetCls.includes(sCls);
      return isSameClass && (sNorm.includes(normTarget) || normTarget.includes(sNorm));
    });
    if (classMatch) return classMatch;

    // General substring match if length >= 5
    if (normTarget.length >= 5) {
      const subMatch = students.find(s => {
        const sNorm = normalizeTurkish(s.name).toLowerCase().replace(/\s+/g, ' ').trim();
        return sNorm.includes(normTarget) || normTarget.includes(sNorm);
      });
      if (subMatch) return subMatch;
    }
  }

  return null;
}

/**
 * Maps the 6 Ertem-840 branch answer blocks to the active Exam's subjects and question counts
 */
export function buildAlignedAnswers(
  branchAnswers: { turkce: string; sosyal: string; din: string; ingilizce: string; matematik: string; fen: string },
  exam: Exam
): string[] {
  const subjects = exam.subjects || [];

  // Default LGS standard mapping if exam.subjects is empty
  if (subjects.length === 0) {
    const tr = branchAnswers.turkce.slice(0, 20).split('');
    const sos = branchAnswers.sosyal.slice(0, 10).split('');
    const din = branchAnswers.din.slice(0, 10).split('');
    const ing = branchAnswers.ingilizce.slice(0, 10).split('');
    const mat = branchAnswers.matematik.slice(0, 20).split('');
    const fen = branchAnswers.fen.slice(0, 20).split('');
    return [...tr, ...sos, ...din, ...ing, ...mat, ...fen].map(ch => (ch === ' ' || !ch ? '' : ch.toUpperCase()));
  }

  const resultAnswers: string[] = [];

  subjects.forEach(sub => {
    const count = sub.count || 20;
    const normName = normalizeTurkish(sub.name).toLowerCase();

    let branchText = '';
    if (normName.includes('turk') || normName.includes('tr')) {
      branchText = branchAnswers.turkce;
    } else if (normName.includes('sosyal') || normName.includes('ink') || normName.includes('tarih')) {
      branchText = branchAnswers.sosyal;
    } else if (normName.includes('din')) {
      branchText = branchAnswers.din;
    } else if (normName.includes('ing') || normName.includes('dil')) {
      branchText = branchAnswers.ingilizce;
    } else if (normName.includes('mat')) {
      branchText = branchAnswers.matematik;
    } else if (normName.includes('fen')) {
      branchText = branchAnswers.fen;
    } else {
      // Fallback: take remaining from available
      branchText = branchAnswers.turkce;
    }

    for (let i = 0; i < count; i++) {
      const ch = branchText[i] || '';
      resultAnswers.push(ch === ' ' || !ch ? '' : ch.toUpperCase());
    }
  });

  return resultAnswers;
}

/**
 * Main parser: Reads entire Sekonic SR-55D / Ertem-840 file content,
 * matches students, evaluates answers against internal exam keys, and returns ready-to-save records.
 */
export function parseSekonicErtem840(
  fileText: string,
  exam: Exam,
  existingStudents: Student[],
  existingResults: ExamResult[] = []
): SekonicParseResult {
  const lines = fileText.split(/\r?\n/);
  const students: ParsedSekonicStudent[] = [];
  const errors: string[] = [];

  let matchedCount = 0;
  let unmatchedCount = 0;
  let overwriteCount = 0;

  // Key map for booklet A and B
  const keyA = exam.keys?.A || exam.keys?.['a'] || [];
  const keyB = exam.keys?.B || exam.keys?.['b'] || keyA;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (!line.trim() || line.trim().length < 20) return;

    const { student, error } = parseSekonicRow(line, lineNum);
    if (error || !student) {
      if (line.trim().length > 30) {
        errors.push(error || `Satır ${lineNum}: Ayrıştırılamadı.`);
      }
      return;
    }

    // Align answers with exam subjects
    const alignedAnswers = buildAlignedAnswers(student.branchAnswers, exam);
    student.answers = alignedAnswers;

    // Student matching with roster
    const matched = matchStudentInRoster(student.cleanNo, student.rawName, student.classFormatted, existingStudents);
    if (matched) {
      student.matchedStudent = matched;
      student.matchStatus = 'matched';
      matchedCount++;
    } else {
      student.matchedStudent = null;
      student.matchStatus = 'unmatched';
      unmatchedCount++;
    }

    // Check if result already exists in this exam (will be overwritten per user requirement)
    const effectiveStudentId = matched?.id;
    const effectiveNo = student.cleanNo;
    const exists = existingResults.some(r => {
      if (effectiveStudentId && r.studentId === effectiveStudentId) return true;
      if (effectiveNo && normalizeStudentNo(r.no || r.studentNo) === effectiveNo) return true;
      return false;
    });
    if (exists) {
      student.isOverwriting = true;
      overwriteCount++;
    }

    // Evaluate answers with booklet key
    const activeKey = student.booklet === 'B' ? keyB : keyA;
    const finalKey = (activeKey && activeKey.length > 0) ? activeKey : keyA;

    try {
      const evaluated = calculateScore(
        alignedAnswers,
        finalKey,
        exam.penalty !== undefined ? exam.penalty : 3,
        exam.subjects || [],
        exam.format || 'lgs',
        exam.name,
        exam.optionsCount || 4
      );

      student.evaluatedScore = evaluated;
      student.totalNet = evaluated.total.net || 0;
      student.totalCorrect = evaluated.total.correct || 0;
      student.totalWrong = evaluated.total.wrong || 0;
      student.totalEmpty = evaluated.total.empty || 0;
      student.score = evaluated.total.lgsScore || evaluated.total.net || 0;

      // AtaLig LP calculation
      const studentTeam = matched?.leagueTeam || determineLeagueTeam(student.score) || 'Taktik Avcıları';
      const lpRes = calculateAtaLigPoints(
        student.score,
        0,
        evaluated.subjectScores || {},
        [],
        studentTeam
      );
      student.earnedLP = lpRes.earnedLP;
    } catch (e) {
      console.warn(`Row evaluation warning for ${student.rawName}:`, e);
    }

    students.push(student);
  });

  return {
    totalRows: students.length,
    matchedCount,
    unmatchedCount,
    overwriteCount,
    students,
    errors
  };
}

/**
 * Converts a ParsedSekonicStudent into a standard UnifiedExamResult for saving
 */
export function convertSekonicStudentToExamResult(
  sekonicStudent: ParsedSekonicStudent,
  exam: Exam,
  overrideStudent?: Student
): ExamResult {
  const matched = overrideStudent || sekonicStudent.matchedStudent;
  const finalNo = overrideStudent ? String(overrideStudent.no) : (sekonicStudent.cleanNo || matched?.no || '');
  const finalName = overrideStudent ? overrideStudent.name : (matched?.name || sekonicStudent.rawName);
  const finalClass = overrideStudent 
    ? (overrideStudent.className || sekonicStudent.classFormatted)
    : (matched?.className || sekonicStudent.classFormatted);

  const { cls, sec } = formatClassSec(sekonicStudent.grade, sekonicStudent.section);

  const keyA = exam.keys?.A || exam.keys?.['a'] || [];
  const keyB = exam.keys?.B || exam.keys?.['b'] || keyA;
  const activeKey = sekonicStudent.booklet === 'B' ? keyB : keyA;

  const evaluatedScore = calculateScore(
    sekonicStudent.answers,
    activeKey,
    exam.penalty !== undefined ? exam.penalty : 3,
    exam.subjects || [],
    exam.format || 'lgs',
    exam.name,
    exam.optionsCount || 4
  );

  const scoreValue = evaluatedScore.total.lgsScore || evaluatedScore.total.net || 0;
  const studentTeam = matched?.leagueTeam || determineLeagueTeam(scoreValue) || 'Taktik Avcıları';

  const lpRes = calculateAtaLigPoints(
    scoreValue,
    0,
    evaluatedScore.subjectScores || {},
    [],
    studentTeam
  );

  return {
    id: generateId(),
    studentId: matched?.id,
    studentNo: Number(finalNo) || undefined,
    studentName: finalName,
    studentClass: finalClass,
    name: finalName,
    no: finalNo,
    classStr: cls,
    sectionStr: sec,
    booklet: sekonicStudent.booklet,
    answers: sekonicStudent.answers,
    evaluatedScore,
    net: evaluatedScore.total.net || 0,
    lgsScore: scoreValue,
    totalCorrect: evaluatedScore.total.correct || 0,
    totalWrong: evaluatedScore.total.wrong || 0,
    totalEmpty: evaluatedScore.total.empty || 0,
    earnedLP: lpRes.earnedLP,
    earnedBadges: lpRes.earnedBadges,
    details: {
      source: 'sekonic_840',
      date: exam.date || new Date().toISOString().split('T')[0],
      scannedAt: new Date().toISOString()
    }
  };
}
