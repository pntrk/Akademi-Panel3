import * as XLSX from 'xlsx';
import { Exam, QuestionOutcome, ExamLearningOutcomes, ExamResult, Student } from '../types';
import { normalizeTurkish } from './omrEngine';
import { generateId } from './utils';
import { normalizeClean } from '../views/ResultsView';
import { parseSekonicErtem840, normalizeStudentNo, matchStudentInRoster } from './sekonicParser';

export interface KazanimQuestionStat {
  outcome: QuestionOutcome;
  questionIndex: number; // 0-based global index in exam
  subjectName: string;
  correctAnswer: string;
  totalStudents: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
  successRate: number; // 0-100 percentage
  status: 'mastered' | 'developing' | 'critical'; // >70% | 50-70% | <50%
  classStats: Record<string, { total: number; correct: number; wrong: number; empty: number; rate: number }>;
}

export interface GroupedMissedOutcome {
  code?: string;
  subjectName: string;
  title: string;
  unit?: string;
  questionNumbers: number[];
}

export interface StudentKazanimReport {
  studentId?: string;
  studentNo: string;
  studentName: string;
  className: string;
  booklet: string;
  totalOutcomes: number;
  masteredCount: number;
  missedCount: number;
  emptyCount: number;
  masteryPercentage: number;
  subjectMastery: Record<string, { total: number; correct: number; percentage: number }>;
  items: {
    outcome: QuestionOutcome;
    questionIndex: number;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    isWrong: boolean;
    isEmpty: boolean;
  }[];
  missedOutcomes: QuestionOutcome[]; // Study recommendations (individual question items)
  groupedMissedOutcomes?: GroupedMissedOutcome[]; // Deduplicated grouped missed outcomes
}

export interface ExamKazanimAnalytics {
  totalOutcomes: number;
  evaluatedStudentCount: number;
  averageSuccessRate: number;
  masteredOutcomesCount: number; // >= 70%
  developingOutcomesCount: number; // 50% - 69.9%
  criticalOutcomesCount: number; // < 50%
  questionStats: KazanimQuestionStat[];
  topStrengths: KazanimQuestionStat[];
  topWeaknesses: KazanimQuestionStat[];
  availableSubjects: string[];
  availableClasses: string[];
}

/**
 * Normalizes string keys for flexible column matching in Excel/XML
 */
export function cleanKey(str: any): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[_\s\-\./\\]+/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/**
 * Standardizes subject names to Turkish MEB conventions
 */
export function normalizeKazanimSubject(name?: string): string {
  if (!name) return 'Genel';
  const c = cleanKey(name);
  if (c.includes('turk')) return 'Türkçe';
  if (c.includes('mat')) return 'Matematik';
  if (c.includes('fen')) return 'Fen Bilimleri';
  if (c.includes('ink') || c.includes('tarih') || c.includes('sosyal') || c === 'sb') return 'Tarih / Sosyal Bilgiler';
  if (c.includes('din') || c.includes('dkab')) return 'Din Kültürü ve Ahlak Bilgisi';
  if (c.includes('ing') || c.includes('yabanci') || c.includes('dil') || c.includes('english')) return 'İngilizce';
  return name.trim();
}

/**
 * Auto-detects the subject based on global question number if subject was not given
 */
export function inferSubjectFromQuestionNumber(qNum: number, exam?: Exam): string {
  if (exam?.subjects && exam.subjects.length > 0) {
    let acc = 0;
    for (const sub of exam.subjects) {
      acc += (sub.count || 0);
      if (qNum <= acc) {
        return normalizeKazanimSubject(sub.name);
      }
    }
  }
  // Standard LGS 8. Grade 90 questions distribution fallback
  if (qNum <= 20) return 'Türkçe';
  if (qNum <= 30) return 'Tarih / Sosyal Bilgiler';
  if (qNum <= 40) return 'Din Kültürü ve Ahlak Bilgisi';
  if (qNum <= 50) return 'İngilizce';
  if (qNum <= 70) return 'Matematik';
  return 'Fen Bilimleri';
}

export interface ParseKazanimResult {
  outcomes: QuestionOutcome[];
  keys: { A: string[]; B?: string[] };
}

/**
 * Parses Excel files (.xlsx, .xls, .csv, SpreadsheetML XML) into QuestionOutcome[] and answer keys
 */
export async function parseKazanimExcel(file: File | ArrayBuffer, exam?: Exam): Promise<ParseKazanimResult> {
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return { outcomes: [], keys: { A: [] } };

  // Read entire sheet as a raw 2D matrix
  const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) return { outcomes: [], keys: { A: [] } };

  // Search top 25 rows for the actual header row
  let headerRowIdx = -1;
  let maxHeaderScore = 0;
  let cols = {
    booklet: -1,
    test: -1,
    subject: -1,
    qNumA: -1,
    qNumB: -1,
    answer: -1,
    code: -1,
    title1: -1,
    title2: -1
  };

  for (let r = 0; r < Math.min(25, matrix.length); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    let tempCols = { booklet: -1, test: -1, subject: -1, qNumA: -1, qNumB: -1, answer: -1, code: -1, title1: -1, title2: -1 };

    for (let c = 0; c < row.length; c++) {
      const cellVal = cleanKey(row[c]);
      if (!cellVal) continue;

      if (cellVal === 'kitapcik' || cellVal === 'booklet') {
        tempCols.booklet = c;
      } else if (cellVal === 'test' || cellVal === 'bolum') {
        tempCols.test = c;
      } else if (cellVal === 'ders' || cellVal === 'brans' || cellVal === 'subject' || cellVal === 'dersadi') {
        tempCols.subject = c;
        score += 2;
      } else if (cellVal === 'asoru' || cellVal === 'soruno' || cellVal === 'soru' || cellVal === 'no' || cellVal === 'q' || cellVal === 'question' || cellVal === 'sorunumarasi') {
        tempCols.qNumA = c;
        score += 3;
      } else if (cellVal === 'bsoru') {
        tempCols.qNumB = c;
      } else if (cellVal === 'cevap' || cellVal === 'dogrucevap' || cellVal.includes('anahtar') || cellVal === 'answer') {
        tempCols.answer = c;
        score += 2;
      } else if (cellVal.includes('kazanimkodu') || cellVal === 'kod' || cellVal === 'code' || cellVal === 'kazanimno') {
        tempCols.code = c;
        score += 3;
      } else if (cellVal.includes('kazanim') || cellVal === 'ogrenme' || cellVal === 'aciklama' || cellVal === 'outcome' || cellVal === 'baslik' || cellVal === 'hedef') {
        if (tempCols.title1 === -1) tempCols.title1 = c;
        else if (tempCols.title2 === -1) tempCols.title2 = c;
        score += 3;
      }
    }

    if (score > maxHeaderScore) {
      maxHeaderScore = score;
      headerRowIdx = r;
      cols = tempCols;
    }
  }

  const outcomes: QuestionOutcome[] = [];
  const keyMapA: Record<number, string> = {};
  const keyMapB: Record<number, string> = {};

  const subjectOffsets: Record<string, { start: number; count: number }> = {};
  let offsetCounter = 0;
  const subjectsList = (exam?.subjects && exam.subjects.length > 0)
    ? exam.subjects
    : [
        { name: 'Türkçe', count: 20 },
        { name: 'Tarih / Sosyal Bilgiler', count: 10 },
        { name: 'Din Kültürü ve Ahlak Bilgisi', count: 10 },
        { name: 'İngilizce', count: 10 },
        { name: 'Matematik', count: 20 },
        { name: 'Fen Bilimleri', count: 20 }
      ];

  for (const s of subjectsList) {
    const norm = normalizeKazanimSubject(s.name);
    subjectOffsets[norm] = { start: offsetCounter, count: s.count };
    offsetCounter += s.count;
  }

  if (headerRowIdx !== -1) {
    let globalCounter = 1;

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      // Booklet check: Skip B/C/D duplicate rows if Booklet A is specified
      const bookletVal = cols.booklet !== -1 ? String(row[cols.booklet] || '').trim().toUpperCase() : '';
      if (bookletVal && bookletVal !== 'A' && bookletVal !== '1') {
        continue;
      }

      const rawTest = cols.test !== -1 ? String(row[cols.test] || '').trim() : '';
      const rawSubject = cols.subject !== -1 ? String(row[cols.subject] || '').trim() : '';
      const rawCode = cols.code !== -1 ? String(row[cols.code] || '').trim() : '';
      let rawTitle = cols.title1 !== -1 ? String(row[cols.title1] || '').trim() : '';
      if (!rawTitle && cols.title2 !== -1) {
        rawTitle = String(row[cols.title2] || '').trim();
      }

      const rawQNumA = cols.qNumA !== -1 ? String(row[cols.qNumA] || '').trim() : '';
      const rawQNumB = cols.qNumB !== -1 ? String(row[cols.qNumB] || '').trim() : '';
      const rawAnswer = cols.answer !== -1 ? String(row[cols.answer] || '').trim().toUpperCase() : '';

      // Filter out header repetition or title/metadata rows
      const lowerTitle = rawTitle.toLowerCase().trim();
      const lowerCode = rawCode.toLowerCase().trim();
      const combinedRowText = row.join(' ').toLowerCase();

      if (
        combinedRowText.includes('kitapçık') || 
        combinedRowText.includes('a soru') ||
        lowerTitle === '8.sınıf' || 
        lowerTitle === '8.sinif' || 
        lowerTitle === 'kazanım kodu' || 
        lowerTitle === 'kazanim-1' || 
        lowerTitle === 'kazanim' ||
        lowerTitle === 'ders' ||
        lowerCode === 'kazanım kodu' ||
        lowerCode === 'kod' ||
        (!rawTitle && !rawCode && !rawSubject)
      ) {
        continue;
      }

      const validAnswer = (rawAnswer && ['A', 'B', 'C', 'D', 'E'].includes(rawAnswer)) ? rawAnswer : undefined;

      // Skip non-question rows that have no title description and no valid question answer
      if (!validAnswer && !rawCode && lowerTitle.length < 15 && !rawQNumA) {
        continue;
      }

      let subjectName = rawSubject ? normalizeKazanimSubject(rawSubject) : '';
      if (!subjectName && rawTest) {
        subjectName = normalizeKazanimSubject(rawTest);
      }

      let parsedQNumA = parseInt(rawQNumA.replace(/[^\d]/g, ''), 10);
      if (isNaN(parsedQNumA) || parsedQNumA <= 0) {
        parsedQNumA = globalCounter;
      }

      let parsedQNumB = parseInt(rawQNumB.replace(/[^\d]/g, ''), 10);

      if (!subjectName) {
        subjectName = inferSubjectFromQuestionNumber(globalCounter, exam);
      }

      const subjStart = subjectOffsets[subjectName]?.start ?? (globalCounter <= 20 ? 0 : globalCounter <= 30 ? 20 : globalCounter <= 40 ? 30 : globalCounter <= 50 ? 40 : globalCounter <= 70 ? 50 : 70);

      const globalA = globalCounter;
      let globalB: number | undefined = undefined;
      if (!isNaN(parsedQNumB) && parsedQNumB > 0) {
        globalB = subjStart + parsedQNumB;
      }

      if (validAnswer) {
        keyMapA[globalA] = validAnswer;
        if (globalB) {
          keyMapB[globalB] = validAnswer;
        }
      }

      outcomes.push({
        id: generateId(),
        questionNumber: globalA, // Global continuous 1..90 question number
        subjectQuestionNumber: parsedQNumA,
        subjectName,
        code: (rawCode && rawCode !== '-' && rawCode.length < 50) ? rawCode : undefined,
        title: rawTitle || `Soru ${globalA} Kazanımı`,
        correctAnswer: validAnswer,
        qIndex: globalA,
        altQIndex: globalB
      });

      globalCounter++;
    }
  } else {
    // Fallback row-by-row object parser
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    let autoCounter = 1;

    for (const row of rawRows) {
      const rowKeys = Object.keys(row);
      let rawQNum = '';
      let rawSubject = '';
      let rawCode = '';
      let rawTitle = '';
      let rawAnswer = '';

      for (const k of rowKeys) {
        const ck = cleanKey(k);
        const val = String(row[k] || '').trim();

        if (ck === 'soruno' || ck === 'soru' || ck === 'no' || ck === 'q' || ck === 'asoru') rawQNum = val;
        else if (ck === 'ders' || ck === 'brans' || ck === 'subject') rawSubject = val;
        else if (ck.includes('kazanimkodu') || ck === 'kod' || ck === 'code') rawCode = val;
        else if (ck.includes('kazanim') || ck === 'aciklama' || ck === 'outcome' || ck === 'baslik') rawTitle = val;
        else if (ck === 'cevap' || ck === 'dogrucevap' || ck === 'answer') rawAnswer = val.toUpperCase();
      }

      if (!rawTitle && !rawCode) continue;

      const lowerTitle = rawTitle.toLowerCase().trim();
      const lowerCode = rawCode.toLowerCase().trim();
      if (
        lowerTitle === '8.sınıf' || 
        lowerTitle === '8.sinif' || 
        lowerTitle === 'kazanım kodu' || 
        lowerTitle === 'kazanim-1' || 
        lowerTitle === 'kazanim' ||
        lowerTitle === 'ders' ||
        lowerCode === 'kazanım kodu'
      ) {
        continue;
      }

      const subjectName = rawSubject ? normalizeKazanimSubject(rawSubject) : inferSubjectFromQuestionNumber(autoCounter, exam);
      const validAnswer = (rawAnswer && ['A', 'B', 'C', 'D', 'E'].includes(rawAnswer)) ? rawAnswer : undefined;

      if (validAnswer) {
        keyMapA[autoCounter] = validAnswer;
      }

      outcomes.push({
        id: generateId(),
        questionNumber: autoCounter,
        subjectName,
        code: rawCode || undefined,
        title: rawTitle || `Soru ${autoCounter} Kazanımı`,
        correctAnswer: validAnswer,
        qIndex: autoCounter
      });

      autoCounter++;
    }
  }

  const maxQ = Math.max(outcomes.length, 90);
  const keysA: string[] = [];
  const keysB: string[] = [];
  for (let i = 1; i <= maxQ; i++) {
    keysA.push(keyMapA[i] || '');
    keysB.push(keyMapB[i] || '');
  }

  const hasBKey = keysB.some(k => Boolean(k));
  const keysResult: { A: string[]; B?: string[] } = {
    A: keysA,
    ...(hasBKey ? { B: keysB } : {})
  };

  return { outcomes, keys: keysResult };
}

/**
 * Parses XML string into ParseKazanimResult
 */
export async function parseKazanimXml(xmlContent: string, exam?: Exam): Promise<ParseKazanimResult> {
  if (!xmlContent || !xmlContent.trim()) return { outcomes: [], keys: { A: [] } };

  // If XML is an Excel SpreadsheetML file (starts with <?xml or <Workbook)
  if (xmlContent.includes('<Workbook') || xmlContent.includes('<ss:Workbook') || xmlContent.includes('<Table')) {
    const encoder = new TextEncoder();
    const uint8Arr = encoder.encode(xmlContent);
    return await parseKazanimExcel(uint8Arr.buffer as ArrayBuffer, exam);
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML sözdizimi geçersiz: ' + parserError.textContent);
  }

  const outcomes: QuestionOutcome[] = [];
  const keyMapA: Record<number, string> = {};

  let nodes = xmlDoc.querySelectorAll('soru, question, item, row, kazanim');
  if (nodes.length === 0) {
    const root = xmlDoc.documentElement;
    if (root && root.children.length > 0) {
      nodes = root.querySelectorAll('*');
    }
  }

  let autoQCounter = 1;

  nodes.forEach((node) => {
    const getAttrOrChild = (names: string[]): string => {
      for (const name of names) {
        const attr = node.getAttribute(name);
        if (attr) return attr.trim();
        const child = node.querySelector(name);
        if (child && child.textContent) return child.textContent.trim();
      }
      return '';
    };

    const rawNo = getAttrOrChild(['no', 'soruno', 'number', 'q', 'id', 'soru_no']);
    const rawSubject = getAttrOrChild(['ders', 'subject', 'brans', 'ders_adi', 'alan']);
    const rawCode = getAttrOrChild(['kod', 'code', 'kazanim_kodu', 'kazanimkodu', 'kazanim_no']);
    let rawTitle = getAttrOrChild(['kazanim', 'title', 'outcome', 'aciklama', 'text', 'kazanim_aciklamasi', 'hedef']);
    const rawUnit = getAttrOrChild(['konu', 'unite', 'unit', 'topic']);
    const rawAnswer = getAttrOrChild(['cevap', 'answer', 'key', 'dogru_cevap', 'anahtar']).toUpperCase();

    if (!rawTitle && node.textContent && node.children.length === 0) {
      rawTitle = node.textContent.trim();
    }

    if (!rawTitle && !rawCode) return;

    const lowerTitle = rawTitle.toLowerCase().trim();
    const lowerCode = rawCode.toLowerCase().trim();
    if (
      lowerTitle === '8.sınıf' || 
      lowerTitle === '8.sinif' || 
      lowerTitle === 'kazanım kodu' || 
      lowerTitle === 'kazanim-1' || 
      lowerTitle === 'kazanim' ||
      lowerTitle === 'ders' ||
      lowerCode === 'kazanım kodu'
    ) {
      return;
    }

    let qNum = parseInt(rawNo.replace(/[^\d]/g, ''), 10);
    if (isNaN(qNum) || qNum <= 0) {
      qNum = autoQCounter;
    }

    const subjectName = rawSubject ? normalizeKazanimSubject(rawSubject) : inferSubjectFromQuestionNumber(autoQCounter, exam);
    const validAnswer = (rawAnswer && ['A', 'B', 'C', 'D', 'E'].includes(rawAnswer)) ? rawAnswer : undefined;

    if (validAnswer) {
      keyMapA[autoQCounter] = validAnswer;
    }

    outcomes.push({
      id: generateId(),
      questionNumber: autoQCounter,
      subjectQuestionNumber: qNum,
      subjectName,
      code: rawCode || undefined,
      title: rawTitle || `Soru ${autoQCounter} Kazanımı`,
      unit: rawUnit || undefined,
      correctAnswer: validAnswer,
      qIndex: autoQCounter
    });

    autoQCounter++;
  });

  const maxQ = Math.max(outcomes.length, 90);
  const keysA: string[] = [];
  for (let i = 1; i <= maxQ; i++) {
    keysA.push(keyMapA[i] || '');
  }

  return { outcomes, keys: { A: keysA } };
}

/**
 * Parses optical student answers from a raw TXT file using Sekonic Ertem-840 parser
 */
export function parseOpticalTxtAnswers(
  txtContent: string,
  exam: Exam,
  existingStudents: Student[] = []
): { studentNo: string; studentName?: string; classFormatted?: string; booklet?: string; answers: string[] }[] {
  if (!txtContent || !txtContent.trim()) return [];

  // Use the Sekonic Ertem-840 parser
  const parseResult = parseSekonicErtem840(txtContent, exam, existingStudents, exam.results || []);

  if (parseResult.students.length > 0) {
    return parseResult.students.map(s => ({
      studentNo: s.cleanNo,
      studentName: s.rawName,
      classFormatted: s.classFormatted,
      booklet: s.booklet,
      answers: s.answers
    }));
  }

  // Fallback CSV / Delimited parser
  const lines = txtContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const parsedStudents: { studentNo: string; studentName?: string; classFormatted?: string; booklet?: string; answers: string[] }[] = [];

  for (const line of lines) {
    if (line.length < 5) continue;
    if (line.includes(',') || line.includes(';') || line.includes('\t')) {
      const parts = line.split(/[,;\t]/).map(p => p.trim());
      if (parts.length >= 2) {
        const rawNo = parts[0].replace(/[^\d]/g, '');
        if (rawNo) {
          let booklet = 'A';
          let answersStr = '';
          let name = '';

          for (let pIdx = 1; pIdx < parts.length; pIdx++) {
            const p = parts[pIdx];
            if (p.length === 1 && (p === 'A' || p === 'B' || p === 'C' || p === 'D')) {
              booklet = p;
            } else if (p.length >= 10 && /^[A-E\s]+$/i.test(p)) {
              answersStr = p;
            } else if (!name && p.length > 2) {
              name = p;
            }
          }

          if (answersStr) {
            const answers = answersStr.split('').map(c => c === ' ' ? '' : c.toUpperCase());
            parsedStudents.push({
              studentNo: normalizeStudentNo(rawNo),
              studentName: name || undefined,
              booklet,
              answers
            });
          }
        }
      }
    }
  }

  return parsedStudents;
}

/**
 * Generates sample Excel workbook (.xlsx) with 90 questions for standard 8th grade LGS or based on exam
 */
export function generateKazanimExcelTemplate(exam?: Exam): Uint8Array {
  const subjects = exam?.subjects && exam.subjects.length > 0 
    ? exam.subjects 
    : [
        { name: 'Türkçe', count: 20 },
        { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', count: 10 },
        { name: 'Din Kültürü ve Ahlak Bilgisi', count: 10 },
        { name: 'İngilizce', count: 10 },
        { name: 'Matematik', count: 20 },
        { name: 'Fen Bilimleri', count: 20 }
      ];

  const rows: any[] = [];
  let globalQNum = 1;

  const sampleOutcomesMap: Record<string, { code: string; title: string; unit: string }[]> = {
    'Türkçe': [
      { code: 'T.8.3.2.1', title: 'Bağlamdan yararlanarak bilmediği kelime ve kelime gruplarının anlamını tahmin eder.', unit: 'Sözcükte Anlam' },
      { code: 'T.8.3.2.2', title: 'Deyim, atasözü ve özdeyişlerin metne katkısını belirler.', unit: 'Sözcükte Anlam' },
      { code: 'T.8.3.3.14', title: 'Okudukları ile ilgili çıkarımlarda bulunur.', unit: 'Paragrafta Anlam' },
      { code: 'T.8.3.3.10', title: 'Metnin içeriğini yorumlar.', unit: 'Paragrafta Anlam' },
      { code: 'T.8.3.3.6', title: 'Metnin ana fikrini/ana duygusunu belirler.', unit: 'Paragrafta Anlam' }
    ],
    'T.C. İnkılap Tarihi ve Atatürkçülük': [
      { code: 'İTA.8.1.1.1', title: 'Avrupa’daki gelişmelerin yansımaları bağlamında Osmanlı Devleti’nin yirminci yüzyılın başlarındaki durumunu kavrar.', unit: 'Bir Kahraman Doğuyor' },
      { code: 'İTA.8.1.1.2', title: 'Mustafa Kemal’in öğrenim hayatı ve kişilik özelliklerini ilişkilendirir.', unit: 'Bir Kahraman Doğuyor' }
    ],
    'Din Kültürü ve Ahlak Bilgisi': [
      { code: 'DİN.8.1.1.1', title: 'Kader ve kaza inancını ayet ve hadislerle açıklar.', unit: 'Kader İnancı' }
    ],
    'İngilizce': [
      { code: 'E8.1.4.2', title: 'Students will be able to understand short and simple invitation letters, cards and e-mails.', unit: 'Friendship' }
    ],
    'Matematik': [
      { code: 'M.8.1.1.1', title: 'Verilen pozitif tam sayıların pozitif tam sayı çarpanlarını bulur.', unit: 'Çarpanlar ve Katlar' },
      { code: 'M.8.1.1.2', title: 'İki doğal sayının en büyük ortak bölenini (EBOB) ve en küçük ortak katını (EKOK) hesaplar.', unit: 'Çarpanlar ve Katlar' }
    ],
    'Fen Bilimleri': [
      { code: 'F.8.1.1.1.5', title: 'Dünya’nın ekseninin eğikliğinin mevsimlerin oluşumuna etkisini açıklar.', unit: 'Mevsimler ve İklim' }
    ]
  };

  const sampleAnswerOptions = ['A', 'B', 'C', 'D'];

  subjects.forEach(sub => {
    const stdSubName = normalizeKazanimSubject(sub.name);
    const samplePool = sampleOutcomesMap[stdSubName] || [
      { code: `${stdSubName.slice(0, 3).toUpperCase()}.8.1.1`, title: `${stdSubName} temel konu ve kavramlarını açıklar.`, unit: '1. Ünite' }
    ];

    for (let i = 1; i <= sub.count; i++) {
      const sampleItem = samplePool[(i - 1) % samplePool.length];
      const ansKeyFromExam = exam?.keys?.A?.[globalQNum - 1] || sampleAnswerOptions[(globalQNum - 1) % 4];

      rows.push({
        'Kitapçık': 'A',
        'Test': stdSubName,
        'Ders': stdSubName,
        'A Soru': i,
        'B Soru': i,
        'Cevap': ansKeyFromExam,
        'Kazanım Kodu': sampleItem.code,
        'Kazanım-1': sampleItem.title
      });

      globalQNum++;
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 10 }, // Kitapçık
    { wch: 20 }, // Test
    { wch: 20 }, // Ders
    { wch: 10 }, // A Soru
    { wch: 10 }, // B Soru
    { wch: 10 }, // Cevap
    { wch: 16 }, // Kazanım Kodu
    { wch: 65 }  // Kazanım-1
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kazanımlar');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}

/**
 * Generates sample XML template
 */
export function generateKazanimXmlTemplate(exam?: Exam): string {
  const subjects = exam?.subjects && exam.subjects.length > 0 
    ? exam.subjects 
    : [
        { name: 'Türkçe', count: 20 },
        { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', count: 10 },
        { name: 'Din Kültürü ve Ahlak Bilgisi', count: 10 },
        { name: 'İngilizce', count: 10 },
        { name: 'Matematik', count: 20 },
        { name: 'Fen Bilimleri', count: 20 }
      ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<exam title="${exam?.name || 'LGS Deneme Sınavı'}" date="${exam?.date || new Date().toLocaleDateString('tr-TR')}">\n  <questions>\n`;
  let globalQNum = 1;

  subjects.forEach(sub => {
    const stdSub = normalizeKazanimSubject(sub.name);
    for (let i = 1; i <= sub.count; i++) {
      const code = `${stdSub.slice(0, 3).toUpperCase()}.8.1.${i}`;
      const title = `${stdSub} dersi ${i}. sorunun ölçtüğü temel kazanım ve beceri ifadesi.`;
      const ans = exam?.keys?.A?.[globalQNum - 1] || ['A', 'B', 'C', 'D'][(globalQNum - 1) % 4];

      xml += `    <question number="${globalQNum}" subject="${stdSub}" code="${code}" answer="${ans}">\n      <outcome>${title}</outcome>\n    </question>\n`;
      globalQNum++;
    }
  });

  xml += `  </questions>\n</exam>`;
  return xml;
}

/**
 * Comprehensive Evaluation: Matches Outcomes with Exam Results & Answers
 */
export function evaluateExamKazanimAnalytics(
  outcomes: QuestionOutcome[],
  exam: Exam,
  results: ExamResult[]
): ExamKazanimAnalytics {
  if (!outcomes || outcomes.length === 0) {
    return {
      totalOutcomes: 0,
      evaluatedStudentCount: 0,
      averageSuccessRate: 0,
      masteredOutcomesCount: 0,
      developingOutcomesCount: 0,
      criticalOutcomesCount: 0,
      questionStats: [],
      topStrengths: [],
      topWeaknesses: [],
      availableSubjects: [],
      availableClasses: []
    };
  }

  const activeResults = results.filter(r => {
    if (r.answers && r.answers.length > 0) return true;
    if (r.scores && (r.scores[String(exam.id)] !== undefined || r.scores[exam.name] !== undefined)) return true;
    return false;
  });

  const studentCount = activeResults.length;
  const availableClassesSet = new Set<string>();
  const availableSubjectsSet = new Set<string>();

  activeResults.forEach(r => {
    const c = r.classStr ? (r.sectionStr ? `${r.classStr}-${r.sectionStr}` : r.classStr) : (r.studentClass || '');
    if (c) availableClassesSet.add(c);
  });

  const questionStats: KazanimQuestionStat[] = outcomes.map((outcome, idx) => {
    const qIdx = outcome.questionNumber ? outcome.questionNumber - 1 : idx;
    const subName = outcome.subjectName || inferSubjectFromQuestionNumber(qIdx + 1, exam);
    availableSubjectsSet.add(subName);

    let correctCount = 0;
    let wrongCount = 0;
    let emptyCount = 0;
    const classStats: Record<string, { total: number; correct: number; wrong: number; empty: number; rate: number }> = {};

    activeResults.forEach(res => {
      const clsName = res.classStr ? (res.sectionStr ? `${res.classStr}-${res.sectionStr}` : res.classStr) : (res.studentClass || '-');
      if (!classStats[clsName]) {
        classStats[clsName] = { total: 0, correct: 0, wrong: 0, empty: 0, rate: 0 };
      }
      classStats[clsName].total++;

      const booklet = (res.booklet || 'A').toUpperCase().trim();
      const key = exam.keys?.[booklet] || exam.keys?.['A'] || [];
      const answerIndex = (booklet === 'B' && outcome.altQIndex) ? (outcome.altQIndex - 1) : qIdx;

      const trueAns = (booklet === 'B' && key[answerIndex]) 
        ? key[answerIndex].toUpperCase().trim() 
        : (outcome.correctAnswer || key[qIdx] || '').toUpperCase().trim();

      const studentAns = (res.answers && res.answers[answerIndex] !== undefined) 
        ? String(res.answers[answerIndex] || '').toUpperCase().trim() 
        : '';

      if (!studentAns || studentAns === '' || studentAns === '-') {
        emptyCount++;
        classStats[clsName].empty++;
      } else if (trueAns && studentAns === trueAns) {
        correctCount++;
        classStats[clsName].correct++;
      } else {
        wrongCount++;
        classStats[clsName].wrong++;
      }
    });

    Object.keys(classStats).forEach(cls => {
      const cs = classStats[cls];
      cs.rate = cs.total > 0 ? Math.round((cs.correct / cs.total) * 100) : 0;
    });

    const evaluatedTotal = correctCount + wrongCount + emptyCount || studentCount || 1;
    const successRate = evaluatedTotal > 0 ? Math.round((correctCount / evaluatedTotal) * 100) : 0;

    let status: 'mastered' | 'developing' | 'critical' = 'developing';
    if (successRate >= 70) status = 'mastered';
    else if (successRate < 50) status = 'critical';

    const defaultTrueAns = outcome.correctAnswer || (exam.keys?.['A']?.[qIdx]) || '-';

    return {
      outcome,
      questionIndex: qIdx,
      subjectName: subName,
      correctAnswer: defaultTrueAns,
      totalStudents: evaluatedTotal,
      correctCount,
      wrongCount,
      emptyCount,
      successRate,
      status,
      classStats
    };
  });

  const totalOutcomes = questionStats.length;
  const masteredOutcomesCount = questionStats.filter(q => q.status === 'mastered').length;
  const developingOutcomesCount = questionStats.filter(q => q.status === 'developing').length;
  const criticalOutcomesCount = questionStats.filter(q => q.status === 'critical').length;
  
  const sumRates = questionStats.reduce((acc, curr) => acc + curr.successRate, 0);
  const averageSuccessRate = totalOutcomes > 0 ? Math.round(sumRates / totalOutcomes) : 0;

  const sortedStats = [...questionStats].sort((a, b) => b.successRate - a.successRate);
  const topStrengths = sortedStats.slice(0, 5);
  const topWeaknesses = [...questionStats].sort((a, b) => a.successRate - b.successRate).slice(0, 5);

  return {
    totalOutcomes,
    evaluatedStudentCount: studentCount,
    averageSuccessRate,
    masteredOutcomesCount,
    developingOutcomesCount,
    criticalOutcomesCount,
    questionStats,
    topStrengths,
    topWeaknesses,
    availableSubjects: Array.from(availableSubjectsSet),
    availableClasses: Array.from(availableClassesSet).sort()
  };
}

/**
 * Evaluates individual student outcome report card
 */
export function evaluateStudentKazanimReport(
  student: ExamResult,
  outcomes: QuestionOutcome[],
  exam: Exam
): StudentKazanimReport {
  const booklet = (student.booklet || 'A').toUpperCase().trim();
  const key = exam.keys?.[booklet] || exam.keys?.['A'] || [];
  const answers = student.answers || [];

  let masteredCount = 0;
  let missedCount = 0;
  let emptyCount = 0;

  const subjectMastery: Record<string, { total: number; correct: number; percentage: number }> = {};
  const missedOutcomes: QuestionOutcome[] = [];

  const items = outcomes.map((outcome, idx) => {
    const qIdx = outcome.questionNumber ? outcome.questionNumber - 1 : idx;
    const subName = outcome.subjectName || inferSubjectFromQuestionNumber(qIdx + 1, exam);
    
    if (!subjectMastery[subName]) {
      subjectMastery[subName] = { total: 0, correct: 0, percentage: 0 };
    }
    subjectMastery[subName].total++;

    // For Booklet B, student answer for this outcome is at (outcome.altQIndex - 1)
    const answerIndex = (booklet === 'B' && outcome.altQIndex) ? (outcome.altQIndex - 1) : qIdx;
    
    // Correct answer on student's booklet
    const trueAns = (booklet === 'B' && key[answerIndex]) 
      ? key[answerIndex].toUpperCase().trim() 
      : (outcome.correctAnswer || key[qIdx] || '').toUpperCase().trim();
    
    // Student's marked answer
    const studentAns = (answers[answerIndex] || '').toUpperCase().trim();

    const isEmpty = !studentAns || studentAns === '' || studentAns === '-';
    const isCorrect = !isEmpty && trueAns !== '' && studentAns === trueAns;
    const isWrong = !isEmpty && (!trueAns || studentAns !== trueAns);

    const actualQNumOnPaper = answerIndex + 1;
    const outcomeWithActualQNum = { ...outcome, questionNumber: actualQNumOnPaper };

    if (isCorrect) {
      masteredCount++;
      subjectMastery[subName].correct++;
    } else if (isWrong) {
      missedCount++;
      missedOutcomes.push(outcomeWithActualQNum);
    } else {
      emptyCount++;
      missedOutcomes.push(outcomeWithActualQNum);
    }

    return {
      outcome: outcomeWithActualQNum,
      questionIndex: answerIndex,
      studentAnswer: studentAns,
      correctAnswer: trueAns,
      isCorrect,
      isWrong,
      isEmpty
    };
  });

  Object.keys(subjectMastery).forEach(sub => {
    const sm = subjectMastery[sub];
    sm.percentage = sm.total > 0 ? Math.round((sm.correct / sm.total) * 100) : 0;
  });

  const totalOutcomes = outcomes.length;
  const masteryPercentage = totalOutcomes > 0 ? Math.round((masteredCount / totalOutcomes) * 100) : 0;

  // Deduplicate and group missed outcomes cleanly by code and title
  const groupedMap = new Map<string, GroupedMissedOutcome>();
  missedOutcomes.forEach((o) => {
    const groupKey = `${o.subjectName || ''}_${o.code || o.title}`.trim();
    const existing = groupedMap.get(groupKey);
    if (existing) {
      if (!existing.questionNumbers.includes(o.questionNumber)) {
        existing.questionNumbers.push(o.questionNumber);
      }
    } else {
      groupedMap.set(groupKey, {
        code: o.code,
        subjectName: o.subjectName || 'Genel',
        title: o.title,
        unit: o.unit,
        questionNumbers: [o.questionNumber]
      });
    }
  });

  const groupedMissedOutcomes = Array.from(groupedMap.values()).map(g => ({
    ...g,
    questionNumbers: g.questionNumbers.sort((a, b) => a - b)
  }));

  const cleanNo = String(student.no || student.studentNo || '-');
  const cleanName = student.name || student.studentName || 'İsimsiz';
  const className = student.classStr 
    ? (student.sectionStr ? `${student.classStr}-${student.sectionStr}` : student.classStr) 
    : (student.studentClass || '-');

  return {
    studentId: student.id,
    studentNo: cleanNo,
    studentName: cleanName,
    className,
    booklet,
    totalOutcomes,
    masteredCount,
    missedCount,
    emptyCount,
    masteryPercentage,
    subjectMastery,
    items,
    missedOutcomes,
    groupedMissedOutcomes
  };
}
