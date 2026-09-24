import { Exam, ExamResult, EvaluatedScore, LayoutItem, Point, Subject, Student, OmrStudent } from '../types';
import { generateId, calculateAtaLigPoints, determineLeagueTeam } from './utils';
import { getStudentInfoFit, getStudentNameFontSize } from './studentTextFit';
export { calculateAtaLigPoints, determineLeagueTeam, getStudentInfoFit, getStudentNameFontSize };

export const OPTS_4 = ["A", "B", "C", "D"];
export const OPTS_5 = ["A", "B", "C", "D", "E"];

export const alphabet = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H",
  "I", "İ", "J", "K", "L", "M", "N", "O", "Ö", "P",
  "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z"
];
export const numbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
export const classes = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
export const sections = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export const OMR_SPECS = {
  paperW: 210,
  paperH: 297,
  anchorMargin: 10,
  anchorSize: 8,

  // Üst Başlık Alanı (Köşe çapalarla [6-14mm] çakışmaz; 16.5mm'den başlar)
  header: {
    x: 14.5,
    y: 16.5,
    w: 181.0,
    h: 14.5
  },

  // Öğrenci Bilgi, Kitapçık ve Karekod Alanı
  infoBox: {
    x: 14.5,
    y: 33.0,
    w: 181.0,
    h: 28.0,
    booklet: {
      startX: 115.0,
      y: 15.5,
      gap: 7.0,
      bubbles: [
        { label: 'A', x: 115.0, y: 15.5 },
        { label: 'B', x: 122.0, y: 15.5 },
        { label: 'C', x: 129.0, y: 15.5 },
        { label: 'D', x: 136.0, y: 15.5 }
      ]
    },
    qrCode: {
      x: 154.0,
      y: 2.25,
      size: 23.5
    }
  },

  // Soru ve Cevap Baloncukları Alanı (Alt köşe çapalardan [283-291mm] 7mm yukarıda; 276mm'de biter)
  qBox: {
    x: 14.5,
    y: 63.0,
    w: 181.0,
    h: 213.0
  },

  questions: {
    colCount: 4,
    colW: 45.25,
    rowH: 4.65,
    bubbleRadius: 1.75,
    bubbleGap: 4.5,
    startXOffset: 13.5,
    qNumOffset: 1.0,
    qNumWidth: 6.5,
    rowHeightMod: 1.0
  },

  info: {
    colW: 4.8,
    rowH: 3.5,
    labelY: 29,
    inputY: 32,
    startY: 38,
    fields: [
      { id: 'name', label: 'ADI SOYADI', cols: 20, items: alphabet, startX: 14 },
      { id: 'no', label: 'ÖĞR. NO', cols: 5, items: numbers, startX: 119 },
      { id: 'cls', label: 'SINIF', cols: 1, items: classes, startX: 151 },
      { id: 'sec', label: 'ŞUBE', cols: 1, items: sections, startX: 165 },
      { id: 'bk', label: 'TÜR', cols: 1, items: ["A", "B", "C", "D"], startX: 179 }
    ],
    lines: [116, 146, 160, 174, 188]
  }
};

export const DEFAULT_OMR = OMR_SPECS;

/**
 * Her sınavın şablonunu ve milimetrik OMR koordinat haritasını veritabanında saklamak üzere oluşturan fonksiyon.
 */
export function generateExamOmrMap(exam: Exam, omr = OMR_SPECS) {
  const layout = getQuestionsLayout(exam, omr);
  return {
    version: '2.0-anchor-safe',
    examId: exam.id,
    examName: exam.name,
    format: exam.format || 'lgs',
    optionsCount: exam.optionsCount || 4,
    penalty: exam.penalty !== undefined ? exam.penalty : 3,
    layoutType: exam.layoutType || 'split',
    specs: {
      paperW: omr.paperW,
      paperH: omr.paperH,
      anchorMargin: omr.anchorMargin,
      anchorSize: omr.anchorSize,
      header: omr.header,
      infoBox: omr.infoBox,
      qBox: omr.qBox,
      questions: omr.questions
    },
    anchors: getAnchorMarks(omr),
    qrCodeBox: getQrCodeBox(omr),
    bookletPositions: getBookletBubblePositions(omr),
    subjects: exam.subjects || [],
    totalQuestions: layout.totalQuestions,
    bubbleMap: layout.allBubbleCenters,
    updatedAt: new Date().toISOString()
  };
}

export function getBookletBubblePositions(omr = OMR_SPECS): { booklet: string; x: number; y: number }[] {
  return omr.infoBox.booklet.bubbles.map(b => ({
    booklet: b.label,
    x: omr.infoBox.x + b.x,
    y: omr.infoBox.y + b.y
  }));
}

export function getQrCodeBox(omr = OMR_SPECS): { x: number; y: number; w: number; h: number } {
  return {
    x: omr.infoBox.x + omr.infoBox.qrCode.x,
    y: omr.infoBox.y + omr.infoBox.qrCode.y,
    w: omr.infoBox.qrCode.size,
    h: omr.infoBox.qrCode.size
  };
}

export function getAnchorMarks(omr = OMR_SPECS): { tl: Point; tr: Point; bl: Point; br: Point } {
  const m = omr.anchorMargin;
  return {
    tl: { x: m, y: m },
    tr: { x: omr.paperW - m, y: m },
    bl: { x: m, y: omr.paperH - m },
    br: { x: omr.paperW - m, y: omr.paperH - m }
  };
}

export const initialExam: Exam = {
  id: "1",
  no: 1,
  name: "LGS GENEL DENEME SINAVI - 1",
  examType: 'internal',
  institution: "EĞİTİM KURUMU",
  date: new Date().toLocaleDateString('tr-TR'),
  logo: null,
  participantCount: 0,
  studentList: [],
  layoutType: 'split',
  format: 'lgs',
  subjects: [
    { id: 1, name: "Türkçe", count: 20, section: 1 },
    { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
    { id: 3, name: "Din Kültürü", count: 10, section: 1 },
    { id: 4, name: "İngilizce", count: 10, section: 1 },
    { id: 5, name: "Matematik", count: 20, section: 2 },
    { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
  ],
  optionsCount: 4,
  penalty: 3,
  keys: { A: Array(90).fill(""), B: Array(90).fill(""), C: [], D: [] },
  results: []
};

export function getTotalQuestions(subjects: Subject[]): number {
  if (!subjects || !Array.isArray(subjects)) return 0;
  return subjects.reduce((sum, s) => sum + s.count, 0);
}

export interface BubbleCenterPoint {
  option: string;
  x: number;
  y: number;
  qIdx?: number;
  localIdx?: number;
  optIdx?: number;
  cIdx?: number;
  subjectId?: string | number;
  subjectName?: string;
}

export interface QuestionsLayoutResult {
  items: LayoutItem[];
  questions: LayoutItem[];
  headers: LayoutItem[];
  allBubbleCenters: BubbleCenterPoint[];
  rowH: number;
  colW: number;
  finalQBoxH: number;
  isSplit: boolean;
  hasFourSections: boolean;
  topPadding: number;
  totalQuestions: number;
}

export function getQuestionsLayout(exam: Exam, omr = OMR_SPECS): QuestionsLayoutResult {
  const items: LayoutItem[] = [];
  const allBubbleCenters: BubbleCenterPoint[] = [];

  const hasFourSections = Boolean(exam && exam.subjects && exam.subjects.some(s => s.section === 3 || s.section === 4));
  const isSplit = exam?.layoutType === 'split';
  const topPadding = (isSplit || hasFourSections) ? 7.5 : 2.5;

  const rowH = omr.questions.rowH || 4.8;
  const colW = omr.questions.colW || 47.5;
  const optionsCount = exam?.optionsCount || 4;
  const optionsList = optionsCount === 5 ? OPTS_5 : OPTS_4;

  if (!exam || !exam.subjects || exam.subjects.length === 0) {
    return {
      items: [],
      questions: [],
      headers: [],
      allBubbleCenters: [],
      rowH,
      colW,
      finalQBoxH: omr.qBox.h || 220,
      isSplit,
      hasFourSections,
      topPadding,
      totalQuestions: 0
    };
  }

  const cols: Subject[][] = [[], [], [], []];
  const colUnits = [0, 0, 0, 0];

  if (hasFourSections) {
    [1, 2, 3, 4].forEach((secNum, cIdx) => {
      const subsInSec = (exam.subjects || []).filter(s => (s.section || 1) === secNum);
      subsInSec.forEach(sub => {
        cols[cIdx].push(sub);
        colUnits[cIdx] += sub.count + 2.5;
      });
    });
  } else if (isSplit) {
    let sec1Subs = (exam.subjects || []).filter(s => s.section !== 2);
    let sec2Subs = (exam.subjects || []).filter(s => s.section === 2);

    if (sec2Subs.length === 0 && sec1Subs.length >= 2) {
      const half = Math.ceil(sec1Subs.length / 2);
      sec2Subs = sec1Subs.slice(half);
      sec1Subs = sec1Subs.slice(0, half);
    }

    const assignOrdered = (subs: Subject[], colA: number, colB: number) => {
      const total = subs.reduce((acc, s) => acc + s.count + 2.5, 0);
      const halfTotal = total / 2;
      subs.forEach(sub => {
        if (cols[colA].length > 0 && (colUnits[colA] + (sub.count + 2.5) / 2 > halfTotal)) {
          cols[colB].push(sub);
          colUnits[colB] += sub.count + 2.5;
        } else {
          cols[colA].push(sub);
          colUnits[colA] += sub.count + 2.5;
        }
      });
    };

    assignOrdered(sec1Subs, 0, 1);
    assignOrdered(sec2Subs, 2, 3);
  } else {
    const total = (exam.subjects || []).reduce((acc, s) => acc + s.count + 2.5, 0);
    const targetPerCol = Math.max(15, Math.ceil(total / 4));
    let curCol = 0;
    (exam.subjects || []).forEach(sub => {
      if (curCol < 3 && cols[curCol].length > 0 && colUnits[curCol] + sub.count + 2.5 > targetPerCol + 2.5) {
        curCol++;
      }
      cols[curCol].push(sub);
      colUnits[curCol] += sub.count + 2.5;
    });
  }

  const subStartQ: { [id: number]: number } = {};
  let currentGlobal = 0;
  (exam.subjects || []).forEach(sub => {
    subStartQ[Number(sub.id)] = currentGlobal;
    currentGlobal += sub.count;
  });

  const colMaxY = [
    omr.qBox.y + topPadding,
    omr.qBox.y + topPadding,
    omr.qBox.y + topPadding,
    omr.qBox.y + topPadding
  ];

  cols.forEach((subArr, currentCIdx) => {
    let currentY = omr.qBox.y + topPadding;
    const colLeft = omr.qBox.x + currentCIdx * colW;

    subArr.forEach(sub => {
      const headerH = 1.4 * rowH;
      items.push({
        type: 'header',
        text: sub.name,
        cIdx: currentCIdx,
        x: colLeft,
        y: currentY + (headerH / 2),
        h: headerH,
        subjectId: sub.id,
        subjectName: sub.name
      });
      currentY += headerH + 1.2;

      const startQForSub = subStartQ[Number(sub.id)] ?? 0;
      for (let i = 0; i < sub.count; i++) {
        const globalQIdx = startQForSub + i;
        const qCenterY = currentY + (rowH / 2);

        // Strict OMR_SPECS calculation of exact bubble centers
        const bubbleCenters: BubbleCenterPoint[] = optionsList.map((opt, optIdx) => {
          const centerX = colLeft + omr.questions.startXOffset + (optIdx * omr.questions.bubbleGap);
          const centerPt: BubbleCenterPoint = {
            option: opt,
            x: centerX,
            y: qCenterY,
            qIdx: globalQIdx,
            localIdx: i,
            optIdx,
            cIdx: currentCIdx,
            subjectId: sub.id,
            subjectName: sub.name
          };
          allBubbleCenters.push(centerPt);
          return centerPt;
        });

        items.push({
          type: 'question',
          qIdx: globalQIdx,
          localIdx: i,
          cIdx: currentCIdx,
          x: colLeft,
          y: qCenterY,
          h: rowH,
          subjectId: sub.id,
          subjectName: sub.name,
          options: optionsList,
          bubbleCenters
        });
        currentY += rowH;
      }
      currentY += 1.8;
    });
    colMaxY[currentCIdx] = currentY;
  });

  const finalQBoxH = Math.max(omr.qBox.h || 213.0, Math.max(...colMaxY) - omr.qBox.y);
  const questions = items.filter(it => it.type === 'question');
  const headers = items.filter(it => it.type === 'header');

  return {
    items,
    questions,
    headers,
    allBubbleCenters,
    rowH,
    colW,
    finalQBoxH: omr.qBox.h ? Math.max(omr.qBox.h, finalQBoxH) : finalQBoxH,
    isSplit,
    hasFourSections,
    topPadding,
    totalQuestions: currentGlobal
  };
}

// LGS 2026 Sınav Verilerine Göre Frekans & Yüzdelik Dilim Dağılım Tablosu (MEB Projeksiyonu)
export const LGS_2026_PERCENTILE_TABLE = [
  { score: 500.00, percentile: 0.01 },
  { score: 495.00, percentile: 0.08 },
  { score: 490.00, percentile: 0.22 },
  { score: 485.00, percentile: 0.55 },
  { score: 480.00, percentile: 0.98 },
  { score: 475.00, percentile: 1.55 },
  { score: 470.00, percentile: 2.25 },
  { score: 465.00, percentile: 3.10 },
  { score: 460.00, percentile: 4.10 },
  { score: 455.00, percentile: 5.20 },
  { score: 450.00, percentile: 6.45 },
  { score: 440.00, percentile: 9.20 },
  { score: 430.00, percentile: 12.30 },
  { score: 420.00, percentile: 15.90 },
  { score: 410.00, percentile: 19.80 },
  { score: 400.00, percentile: 24.10 },
  { score: 380.00, percentile: 33.60 },
  { score: 360.00, percentile: 43.90 },
  { score: 340.00, percentile: 54.60 },
  { score: 320.00, percentile: 65.20 },
  { score: 300.00, percentile: 74.80 },
  { score: 250.00, percentile: 88.60 },
  { score: 200.00, percentile: 96.60 },
  { score: 100.00, percentile: 99.99 }
];

export function normalizeTurkish(text?: string): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export function isTytExam(exam: { format?: string; name?: string; subjects?: Subject[]; optionsCount?: number } | undefined | null): boolean {
  if (!exam) return false;
  if (exam.format === 'tyt') return true;
  const nameNorm = normalizeTurkish(exam.name);
  if (nameNorm.includes('tyt') || nameNorm.includes('temel yeterlilik')) return true;
  if (exam.subjects && exam.subjects.some(s => normalizeTurkish(s.name).includes('temel mat'))) return true;
  const totalQ = exam.subjects ? exam.subjects.reduce((sum, s) => sum + s.count, 0) : 0;
  if (totalQ === 120 && exam.optionsCount === 5) return true;
  return false;
}

export function isAytExam(exam: { format?: string; name?: string; subjects?: Subject[]; optionsCount?: number } | undefined | null): boolean {
  if (!exam) return false;
  if (exam.format === 'ayt') return true;
  const nameNorm = normalizeTurkish(exam.name);
  if (nameNorm.includes('ayt') || nameNorm.includes('alan yeterlilik')) return true;
  if (exam.subjects && exam.subjects.some(s => {
    const sn = normalizeTurkish(s.name);
    return sn.includes('edebiyat') || sn.includes('sosyal-2') || sn.includes('sosyal 2');
  })) return true;
  const totalQ = exam.subjects ? exam.subjects.reduce((sum, s) => sum + s.count, 0) : 0;
  if (totalQ === 160 && exam.optionsCount === 5) return true;
  return false;
}

export function isLgsExam(exam: { format?: string; name?: string; subjects?: Subject[]; optionsCount?: number } | undefined | null): boolean {
  if (!exam) return false;
  if (isTytExam(exam) || isAytExam(exam)) return false;
  if (exam.format === 'lgs') return true;
  const nameNorm = normalizeTurkish(exam.name);
  if (nameNorm.includes('lgs') || nameNorm.includes('liselere gecis')) return true;

  if (exam.subjects && exam.subjects.length >= 4) {
    const normSubjectNames = exam.subjects.map(s => normalizeTurkish(s.name));
    const hasTurkce = normSubjectNames.some(n => n.includes('turk'));
    const hasMat = normSubjectNames.some(n => n.includes('mat'));
    const hasFen = normSubjectNames.some(n => n.includes('fen'));
    const hasInkilap = normSubjectNames.some(n => n.includes('inkilap') || n.includes('sosyal'));

    if (hasInkilap && (hasTurkce || hasMat || hasFen)) return true;
    if (exam.subjects.length === 6 && (hasTurkce && hasMat && hasFen)) return true;
    if (hasTurkce && (hasMat || hasFen) && (exam.optionsCount === 4 || !exam.optionsCount)) return true;
  }

  const totalQ = exam.subjects ? exam.subjects.reduce((sum, s) => sum + s.count, 0) : 0;
  if (totalQ === 90 && (exam.optionsCount === 4 || !exam.optionsCount)) return true;
  if (exam.format === 'mebi') return true;

  return false;
}

export function calculateLgsPercentile(score: number): number {
  if (score >= 500) return 0.01;
  if (score <= 100) return 99.99;

  for (let i = 0; i < LGS_2026_PERCENTILE_TABLE.length - 1; i++) {
    const upper = LGS_2026_PERCENTILE_TABLE[i];
    const lower = LGS_2026_PERCENTILE_TABLE[i + 1];
    if (score <= upper.score && score >= lower.score) {
      const scoreSpan = upper.score - lower.score;
      const percentileSpan = lower.percentile - upper.percentile;
      const diff = upper.score - score;
      const p = upper.percentile + (diff / scoreSpan) * percentileSpan;
      return Math.max(0.01, Math.min(99.99, parseFloat(p.toFixed(2))));
    }
  }
  return 99.99;
}

export function calculateScore(
  studentAnswers: string[],
  key: string[],
  penalty: number,
  subjects: Subject[],
  format?: string,
  examName?: string,
  optionsCount?: number
): EvaluatedScore {
  const total = { correct: 0, wrong: 0, empty: 0, net: 0, lgsScore: 0, percentile: 100.0, tytScore: 0, aytScore: 0, examType: 'standard' as 'lgs' | 'tyt' | 'ayt' | 'standard' };
  const subjectScores: { [key: number]: { correct: number; wrong: number; empty: number; net: number } } = {};
  let qIndex = 0;

  const mockExam = { format, name: examName, subjects, optionsCount: optionsCount ?? 4 };
  const isTyt = isTytExam(mockExam);
  const isAyt = isAytExam(mockExam);
  const isLgs = isLgsExam(mockExam);

  let lgsBaseScore = 194.76;
  let totalNetPointsContribution = 0;
  let allZeroNet = true;

  (subjects || []).forEach(sub => {
    const subScore = { correct: 0, wrong: 0, empty: 0, net: 0 };
    for (let i = 0; i < sub.count; i++) {
      const ans = studentAnswers[qIndex];
      const k = key ? key[qIndex] : undefined;
      if (k === "*" || k === "X") {
        // İptal edilen soru (MEB/ÖSYM standardı: herkese doğru kabul edilir)
        subScore.correct++;
      } else if (!ans || ans === "") {
        subScore.empty++;
      } else if (ans === k) {
        subScore.correct++;
      } else {
        subScore.wrong++;
      }
      qIndex++;
    }
    const netVal = subScore.correct - (penalty > 0 ? (subScore.wrong / penalty) : 0);
    subScore.net = netVal;
    subjectScores[sub.id] = subScore;

    total.correct += subScore.correct;
    total.wrong += subScore.wrong;
    total.empty += subScore.empty;
    total.net += subScore.net;

    if (netVal > 0) {
      allZeroNet = false;
    }

    const nameNorm = normalizeTurkish(sub.name);

    if (isTyt) {
      // TYT 2026 Standart Katsayı Projeksiyonu:
      // Taban: 100.00 Puan
      // Türkçe (40 Soru): 3.30 Puan/Net
      // Temel Matematik (40 Soru): 3.30 Puan/Net
      // Sosyal Bilimler (20 Soru): 3.40 Puan/Net
      // Fen Bilimleri (20 Soru): 3.40 Puan/Net
      let coeff = 3.30;
      if (nameNorm.includes("turk")) coeff = 3.30;
      else if (nameNorm.includes("mat")) coeff = 3.30;
      else if (nameNorm.includes("sosyal") || nameNorm.includes("tarih") || nameNorm.includes("cograf") || nameNorm.includes("felsefe") || nameNorm.includes("din")) coeff = 3.40;
      else if (nameNorm.includes("fen") || nameNorm.includes("fizik") || nameNorm.includes("kimya") || nameNorm.includes("biyoloji")) coeff = 3.40;
      totalNetPointsContribution += (netVal * coeff);
    } else if (isAyt) {
      // AYT Genel Puan Projeksiyonu: 100 Taban + (Netler * 2.50)
      totalNetPointsContribution += (netVal * 2.50);
    } else if (isLgs) {
      // LGS 2026 Resmi MEB Katsayı Değerleri
      let coeff = 1.60;
      if (nameNorm.includes("turk")) coeff = 4.326;
      else if (nameNorm.includes("mat")) coeff = 5.048;
      else if (nameNorm.includes("fen")) coeff = 4.116;
      else if (nameNorm.includes("ink") || nameNorm.includes("sosyal") || nameNorm.includes("tarih")) coeff = 1.674;
      else if (nameNorm.includes("din") || nameNorm.includes("ahlak")) coeff = 1.652;
      else if (nameNorm.includes("ing") || nameNorm.includes("yabanci") || nameNorm.includes("dil")) coeff = 1.568;
      else coeff = sub.count >= 20 ? 4.20 : 1.65;

      totalNetPointsContribution += (netVal * coeff);
    }
  });

  if (isTyt) {
    total.examType = 'tyt';
    if (total.net <= 0 && allZeroNet) {
      total.tytScore = 100.00;
    } else {
      const calc = 100.0 + totalNetPointsContribution;
      total.tytScore = Math.max(100.0, Math.min(500.0, Math.round(calc * 1000) / 1000));
    }
    total.lgsScore = total.tytScore;
    total.percentile = 0;
  } else if (isAyt) {
    total.examType = 'ayt';
    if (total.net <= 0 && allZeroNet) {
      total.aytScore = 100.00;
    } else {
      const calc = 100.0 + totalNetPointsContribution;
      total.aytScore = Math.max(100.0, Math.min(500.0, Math.round(calc * 1000) / 1000));
    }
    total.lgsScore = total.aytScore;
    total.percentile = 0;
  } else if (isLgs) {
    total.examType = 'lgs';
    if (total.net <= 0 && allZeroNet) {
      total.lgsScore = 100.00;
      total.percentile = 99.99;
    } else {
      const calculatedScore = lgsBaseScore + totalNetPointsContribution;
      total.lgsScore = Math.max(100.0, Math.min(500.0, Math.round(calculatedScore * 1000) / 1000));
      total.percentile = calculateLgsPercentile(total.lgsScore);
    }
  } else {
    total.examType = 'standard';
    total.lgsScore = 0;
    total.percentile = 0;
  }

  return { total, subjectScores };
}

export function exportToCSV(exam: Exam, specificResults: ExamResult[] | null = null) {
  const isLgs = isLgsExam(exam);
  const isTyt = isTytExam(exam);
  const isAyt = isAytExam(exam);
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Ogrenci No;Ad Soyad;Sinif;Sube;Kitapcik;";
  (exam.subjects || []).forEach(sub => { csvContent += `${sub.name} D;${sub.name} Y;${sub.name} N;`; });
  csvContent += "TOPLAM D;TOPLAM Y;TOPLAM B;TOPLAM NET;";
  if (isTyt) csvContent += "TYT PUANI;";
  else if (isAyt) csvContent += "AYT PUANI;";
  else if (isLgs) csvContent += "LGS PUANI;DİLİM;";
  else csvContent += "PUAN;";
  csvContent += "\n";

  const resultsToExport = specificResults || exam.results || [];

  resultsToExport.forEach(res => {
    const key = exam.keys ? (exam.keys[res.booklet || 'A'] || exam.keys["A"] || []) : [];
    const score = calculateScore(res.answers || [], key, exam.penalty || 0, exam.subjects || [], exam.format, exam.name, exam.optionsCount);

    let row = `${res.no ?? res.studentNo ?? ''};${res.name ?? res.studentName ?? ''};${res.classStr ?? res.studentClass ?? ""};${res.sectionStr ?? ""};${res.booklet ?? 'A'};`;
    (exam.subjects || []).forEach(sub => {
      const ss = score.subjectScores[sub.id] || { correct: 0, wrong: 0, empty: 0, net: 0 };
      row += `${ss.correct};${ss.wrong};${ss.net.toFixed(2).replace('.', ',')};`;
    });
    row += `${score.total.correct};${score.total.wrong};${score.total.empty};${score.total.net.toFixed(2).replace('.', ',')};`;
    if (isTyt) {
      row += `${(score.total.tytScore || score.total.lgsScore).toFixed(2).replace('.', ',')};`;
    } else if (isAyt) {
      row += `${(score.total.aytScore || score.total.lgsScore).toFixed(2).replace('.', ',')};`;
    } else if (isLgs) {
      row += `${score.total.lgsScore.toFixed(2).replace('.', ',')};`;
      row += `%${score.total.percentile.toFixed(2).replace('.', ',')};`;
    } else {
      row += `${score.total.lgsScore.toFixed(2).replace('.', ',')};`;
    }
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${exam.name}_Sonuclar.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getHomography(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x, y = src[i].y;
    const u = dst[i].x, v = dst[i].y;
    A.push([-x, -y, -1, 0, 0, 0, x * u, y * u, -u]);
    A.push([0, 0, 0, -x, -y, -1, x * v, y * v, -v]);
  }
  for (let i = 0; i < 8; i++) {
    let maxRow = i;
    for (let j = i + 1; j < 8; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) maxRow = j;
    }
    const temp = A[i]; A[i] = A[maxRow]; A[maxRow] = temp;
    for (let j = i + 1; j < 8; j++) {
      const c = A[j][i] / A[i][i];
      for (let k = i; k < 9; k++) A[j][k] -= A[i][k] * c;
    }
  }
  const h: number[] = new Array(8);
  for (let i = 7; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < 8; j++) sum += A[i][j] * h[j];
    h[i] = (A[i][8] - sum) / A[i][i];
  }
  return h;
}

export function applyHomography(x: number, y: number, h: number[]): Point {
  const den = h[6] * x + h[7] * y + 1;
  return {
    x: (h[0] * x + h[1] * y + h[2]) / den,
    y: (h[3] * x + h[4] * y + h[5]) / den
  };
}

export interface BubbleMetricResult {
  meanDarkness: number;    // Ortalama koyuluk (0-255)
  fillRatio: number;       // Doldurulan piksel oranı (0.0 - 1.0)
  score: number;           // Bileşik doluluk skoru
  isMarked: boolean;       // Eşik değerini aşıp aşmadığı
  x: number;
  y: number;
}

/**
 * Optik formdaki yerel arka plan koyuluğunu (kağıt beyazlığı/gölgesi) örnekler.
 */
export function sampleLocalBackground(
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius = 8
): number {
  let dSum = 0;
  let dCnt = 0;
  for (let dy = -radius; dy <= radius; dy += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      const px = Math.floor(cx + dx);
      const py = Math.floor(cy + dy);
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const idx = (py * w + px) * 4;
        const whiteness = Math.max(imgBytes[idx], imgBytes[idx + 1], imgBytes[idx + 2]);
        dSum += (255 - whiteness);
        dCnt++;
      }
    }
  }
  return dCnt > 0 ? dSum / dCnt : 15;
}

/**
 * Tek bir baloncuk için iç çekirdek doluluk oranını (Fill Ratio) ve koyuluk skorunu hesaplar.
 * Baloncuğun dış çember sınırına değmeyecek şekilde güvenli iç yarıçap kullanılır.
 */
export function evaluateBubbleFill(
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  bubbleRadiusPx: number = 13.0,
  bgDarkness: number = 15
): BubbleMetricResult {
  // İç güvenli örnekleme yarıçapı: Dış çember çizgisini hariç tutmak için %65 yarıçap
  const sampleRadius = Math.max(3, Math.round(bubbleRadiusPx * 0.65));
  const r2 = sampleRadius * sampleRadius;

  // Küçük mikroskobik homografi kaymalarını (±2px) kompanse etmek için 
  // en yüksek iç doluluğu veren hafif yerel ofset araması
  let bestScore = -1;
  let bestMean = 0;
  let bestRatio = 0;
  let bestX = cx;
  let bestY = cy;

  for (let oy = -2; oy <= 2; oy += 1) {
    for (let ox = -2; ox <= 2; ox += 1) {
      const curX = cx + ox;
      const curY = cy + oy;

      let totalDark = 0;
      let darkCount = 0;
      let totalSamples = 0;

      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          if (dx * dx + dy * dy <= r2) {
            const px = Math.floor(curX + dx);
            const py = Math.floor(curY + dy);
            if (px >= 0 && px < w && py >= 0 && py < h) {
              const i = (py * w + px) * 4;
              const whiteness = Math.max(imgBytes[i], imgBytes[i + 1], imgBytes[i + 2]);
              const darkness = 255 - whiteness;
              const relDark = Math.max(0, darkness - bgDarkness);

              totalDark += relDark;
              totalSamples++;

              // Kağıt beyazlığının en az 35 üzerinde koyuluk varsa işaretli piksel say
              if (relDark > 35) {
                darkCount++;
              }
            }
          }
        }
      }

      const meanDark = totalSamples > 0 ? totalDark / totalSamples : 0;
      const fillRatio = totalSamples > 0 ? darkCount / totalSamples : 0;
      // Bileşik skor: Ortalama koyuluk ve doluluk alanı oranının ağırlıklı çarpımı
      const score = meanDark * (0.35 + 0.65 * fillRatio);

      if (score > bestScore) {
        bestScore = score;
        bestMean = meanDark;
        bestRatio = fillRatio;
        bestX = curX;
        bestY = curY;
      }
    }
  }

  // Bir baloncuğun gerçekten kurşun kalem/tükenmezle doldurulmuş sayılması için:
  // 1. Doluluk oranı en az %28 olmalıdır (boş baloncuk içindeki ince "A, B" harfi sadece %8-%15 yer kaplar)
  // 2. Ortalama göreli koyuluk en az 38 olmalıdır
  // 3. Bileşik skor en az 35 olmalıdır
  const isMarked = bestRatio >= 0.28 && bestMean >= 38 && bestScore >= 35;

  return {
    meanDarkness: bestMean,
    fillRatio: bestRatio,
    score: bestScore,
    isMarked,
    x: bestX,
    y: bestY
  };
}

/**
 * Bir soruya ait tüm şıkların (A, B, C, D, E) baloncuklarını analiz ederek işaretlenen cevabı belirler.
 * Boş sorular kesinlikle "" (boş) olarak döner, çift işaretlemeler tespit edilir.
 */
export function evaluateQuestionAnswer(
  bubbles: { option: string; x: number; y: number }[],
  H: number[],
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  bubbleRadiusPx: number = 13.0
): {
  answer: string;
  markedPoint: { x: number; y: number } | null;
  scores: { option: string; score: number; ratio: number; mean: number; x: number; y: number }[];
  isDoubleMarked: boolean;
} {
  if (!bubbles || bubbles.length === 0) {
    return { answer: "", markedPoint: null, scores: [], isDoubleMarked: false };
  }

  // Sorunun sol tarafındaki boşluktan yerel arka plan kağıt koyuluğunu al
  const firstMapped = applyHomography(bubbles[0].x - 6, bubbles[0].y, H);
  const bgDarkness = sampleLocalBackground(imgBytes, w, h, firstMapped.x, firstMapped.y, 8);

  const bubbleMetrics = bubbles.map(b => {
    const mapped = applyHomography(b.x, b.y, H);
    const metric = evaluateBubbleFill(imgBytes, w, h, mapped.x, mapped.y, bubbleRadiusPx, bgDarkness);
    return {
      option: b.option,
      score: metric.score,
      ratio: metric.fillRatio,
      mean: metric.meanDarkness,
      isMarked: metric.isMarked,
      x: metric.x,
      y: metric.y
    };
  });

  // Skorlara göre azalan sırada sırala
  const sorted = [...bubbleMetrics].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;

  // Hiçbir baloncuk işaretleme eşiğini aşmıyorsa -> Kesinlikle BOŞ (Unanswered)
  if (!best || !best.isMarked || best.score < 35 || best.ratio < 0.28) {
    return {
      answer: "",
      markedPoint: null,
      scores: bubbleMetrics,
      isDoubleMarked: false
    };
  }

  // Çift işaretleme kontrolü: İkinci şık da belirgin şekilde doldurulmuş ve fark çok küçükse
  if (second && second.isMarked && second.ratio >= 0.26 && (best.score - second.score) < 18) {
    return {
      answer: "", // Çift işaretleme -> Geçersiz / Boş sayılır
      markedPoint: { x: best.x, y: best.y },
      scores: bubbleMetrics,
      isDoubleMarked: true
    };
  }

  // Belirgin tek işaretleme
  return {
    answer: best.option,
    markedPoint: { x: best.x, y: best.y },
    scores: bubbleMetrics,
    isDoubleMarked: false
  };
}

/**
 * Optik form görüntüsünü 4 köşe çapa noktasına göre standart A4 boyutuna normalize eden
 * perspektif düzeltme (Warp Perspective) fonksiyonu.
 */
export function warpPerspectiveToCanvas(
  sourceCanvas: HTMLCanvasElement,
  srcQuad: { tl: Point; tr: Point; bl: Point; br: Point },
  destW = 840,
  destH = 1188,
  omr = OMR_SPECS
): HTMLCanvasElement {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destW;
  destCanvas.height = destH;
  const destCtx = destCanvas.getContext('2d');
  if (!destCtx) return destCanvas;

  const m = omr.anchorMargin;
  const scaleX = destW / omr.paperW;
  const scaleY = destH / omr.paperH;

  const dstAnchorPts: Point[] = [
    { x: m * scaleX, y: m * scaleY },
    { x: (omr.paperW - m) * scaleX, y: m * scaleY },
    { x: m * scaleX, y: (omr.paperH - m) * scaleY },
    { x: (omr.paperW - m) * scaleX, y: (omr.paperH - m) * scaleY }
  ];

  const srcAnchorPts: Point[] = [
    srcQuad.tl,
    srcQuad.tr,
    srcQuad.bl,
    srcQuad.br
  ];

  const Hinv = getHomography(dstAnchorPts, srcAnchorPts);

  const srcCtx = sourceCanvas.getContext('2d');
  if (!srcCtx) return destCanvas;
  const srcImgData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const srcBytes = srcImgData.data;
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  const destImgData = destCtx.createImageData(destW, destH);
  const destBytes = destImgData.data;

  for (let y = 0; y < destH; y++) {
    const rowOffset = y * destW;
    for (let x = 0; x < destW; x++) {
      const pt = applyHomography(x, y, Hinv);
      const sx = Math.round(pt.x);
      const sy = Math.round(pt.y);

      const dIdx = (rowOffset + x) * 4;
      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const sIdx = (sy * srcW + sx) * 4;
        destBytes[dIdx] = srcBytes[sIdx];
        destBytes[dIdx + 1] = srcBytes[sIdx + 1];
        destBytes[dIdx + 2] = srcBytes[sIdx + 2];
        destBytes[dIdx + 3] = 255;
      } else {
        destBytes[dIdx] = 255;
        destBytes[dIdx + 1] = 255;
        destBytes[dIdx + 2] = 255;
        destBytes[dIdx + 3] = 255;
      }
    }
  }

  destCtx.putImageData(destImgData, 0, 0);
  return destCanvas;
}

export function formatClassSec(cStr?: string, sStr?: string): { cls: string; sec: string } {
  let cls = (cStr || "").toString().replace(/^"|"$/g, '').trim().toUpperCase();
  let sec = (sStr || "").toString().replace(/^"|"$/g, '').trim().toUpperCase();

  // If section is provided separately, clean up both
  if (sec) {
    const secMatch = sec.match(/([A-ZÇĞİÖŞÜ])/i);
    if (secMatch) sec = secMatch[1].toUpperCase();
    const clsMatch = cls.match(/(\d+)/);
    if (clsMatch) cls = clsMatch[1];
    return { cls, sec };
  }

  // Combined formats: "7A", "7/A", "7-A", "7 A", "7. SINIF A", "7. SINIF / A ŞUBESİ", "8B"
  const matchCombined = cls.match(/(\d+)\s*(?:\.|\/|-|\s|SINIF|\.SINIF)*\s*([A-ZÇĞİÖŞÜ])(?:\s*(?:ŞUBE|ŞUBESİ|SUBE|SUBESI))?/i);
  if (matchCombined) {
    cls = matchCombined[1];
    sec = matchCombined[2].toUpperCase();
    return { cls, sec };
  }

  // Only digits (class only)
  const onlyDigits = cls.match(/^(\d+)$/);
  if (onlyDigits) {
    return { cls: onlyDigits[1], sec: "" };
  }

  return { cls, sec };
}

export function handleDownloadTemplate() {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "NUMARASI;ADI;SOYADI;SINIFI;SUBESI\n";
  csvContent += "1453;ELİF;SEÇME;8;C\n";

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Ogrenci_Sablonu.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface OpticalScanInput {
  id?: string;
  studentId?: string;
  studentNo?: number | string;
  no?: string | number;
  studentName?: string;
  name?: string;
  studentClass?: string;
  classStr?: string;
  sectionStr?: string;
  booklet?: string;
  answers: string[];
  earnedLP?: number;
  earnedBadges?: string[];
}

/**
 * Optik taramadan gelen veriyi standart AkademiPanel sınav sonucuna dönüştüren yardımcı fonksiyon.
 * - Öğrenci numarası, adı, sınıf ve şube bilgisi eşleme/formatlama
 * - Kitapçık ve soru cevap anahtarı eşleşmesi
 * - Doğru, yanlış, boş, net ve LGS/TYT/AYT puanı hesaplaması
 * - AkademiPanel ve karne analizi verilerini (details[examName].lessons) oluşturma
 */
export function createUnifiedExamResult(
  scanDataOrStudent: OpticalScanInput | Student | OmrStudent | any,
  exam: Exam,
  matchedStudentOrBooklet?: Student | OmrStudent | string | null,
  maybeAnswers?: string[]
): ExamResult {
  let scanData: OpticalScanInput;
  let matchedStudent: Student | OmrStudent | null = null;

  if (typeof matchedStudentOrBooklet === 'string' && Array.isArray(maybeAnswers)) {
    // Called as: createUnifiedExamResult(student, exam, booklet, answers)
    scanData = {
      id: scanDataOrStudent?.id,
      studentId: scanDataOrStudent?.id,
      no: scanDataOrStudent?.no,
      studentNo: scanDataOrStudent?.no,
      name: scanDataOrStudent?.name,
      studentName: scanDataOrStudent?.name,
      classStr: scanDataOrStudent?.classStr || scanDataOrStudent?.className,
      sectionStr: scanDataOrStudent?.sectionStr,
      booklet: matchedStudentOrBooklet,
      answers: maybeAnswers
    };
    matchedStudent = scanDataOrStudent as Student;
  } else {
    // Called as: createUnifiedExamResult(scanData, exam, matchedStudent)
    scanData = scanDataOrStudent as OpticalScanInput;
    matchedStudent = (matchedStudentOrBooklet as (Student | OmrStudent)) || null;
  }

  const finalNo = String(scanData.no ?? scanData.studentNo ?? matchedStudent?.no ?? "").trim();
  const finalName = (scanData.name ?? scanData.studentName ?? matchedStudent?.name ?? "İSİMSİZ").trim().toUpperCase();
  const finalBk = (scanData.booklet || 'A').toUpperCase();

  // Sınıf ve şube formatlama
  const rawCls = scanData.classStr || scanData.studentClass || matchedStudent?.classStr || (matchedStudent && 'className' in matchedStudent ? matchedStudent.className : '') || "";
  const rawSec = scanData.sectionStr || matchedStudent?.sectionStr || "";
  const { cls, sec } = formatClassSec(rawCls, rawSec);
  const studentClassFormatted = cls && cls !== '-'
    ? (sec && sec !== '-' ? `${cls}/${sec}` : cls)
    : ((matchedStudent && 'className' in matchedStudent ? matchedStudent.className : '') || '-');

  // Kitapçık cevap anahtarını al
  const key = exam.keys?.[finalBk] || exam.keys?.A || (exam.keys ? Object.values(exam.keys)[0] : []) || [];

  // Puan ve net hesaplaması
  const evaluatedScore = calculateScore(
    scanData.answers || [],
    key,
    exam.penalty !== undefined ? exam.penalty : 3,
    exam.subjects || [],
    exam.format,
    exam.name,
    exam.optionsCount || 4
  );

  const scoreValue = evaluatedScore.total.lgsScore || evaluatedScore.total.tytScore || evaluatedScore.total.aytScore || evaluatedScore.total.net;

  // AkademiPanel karne analizi için ders bazlı detaylar (StudentProgressCharts ile tam uyumlu)
  const lessonsMap: Record<string, { D: number; Y: number; B: number; N: number; totalQuestions: number }> = {};
  const lessonNetsMap: Record<string, number> = {};

  (exam.subjects || []).forEach(sub => {
    const ss = evaluatedScore.subjectScores[sub.id as any] || { correct: 0, wrong: 0, empty: 0, net: 0 };
    const roundedNet = Math.round(ss.net * 100) / 100;
    lessonsMap[sub.name] = {
      D: ss.correct,
      Y: ss.wrong,
      B: ss.empty,
      N: roundedNet,
      totalQuestions: sub.count
    };
    lessonNetsMap[sub.name] = roundedNet;
  });

  // AkademiPanel AtaLig puanı (LP) ve rozet hesaplaması
  let finalLP = scanData.earnedLP;
  let finalBadges = scanData.earnedBadges || [];

  if (finalLP === undefined || finalLP === null) {
    const studentTeam = (matchedStudent && 'leagueTeam' in matchedStudent ? matchedStudent.leagueTeam : undefined) || determineLeagueTeam(scoreValue) || 'Taktik Avcıları';
    const lpCalculation = calculateAtaLigPoints(
      scoreValue,
      0, // previousAverage
      lessonsMap,
      [],
      studentTeam
    );
    finalLP = lpCalculation.earnedLP;
    finalBadges = lpCalculation.earnedBadges;
  }

  return {
    id: scanData.id || generateId(),
    studentId: (matchedStudent && 'id' in matchedStudent ? matchedStudent.id : undefined) || scanData.studentId,
    studentNo: Number(finalNo) || undefined,
    studentName: finalName,
    studentClass: studentClassFormatted,
    name: finalName,
    no: finalNo,
    classStr: cls,
    sectionStr: sec,
    booklet: finalBk,
    answers: scanData.answers,
    evaluatedScore,
    scores: {
      [String(exam.id)]: scoreValue,
      [exam.name]: scoreValue,
      ...lessonNetsMap
    },
    average: scoreValue,
    details: {
      [exam.name]: {
        puan: scoreValue,
        lessons: lessonsMap
      }
    },
    net: evaluatedScore.total.net,
    totalCorrect: evaluatedScore.total.correct,
    totalWrong: evaluatedScore.total.wrong,
    totalEmpty: evaluatedScore.total.empty,
    lgsScore: evaluatedScore.total.lgsScore,
    tytScore: evaluatedScore.total.tytScore,
    aytScore: evaluatedScore.total.aytScore,
    percentile: evaluatedScore.total.percentile,
    earnedLP: finalLP,
    earnedBadges: finalBadges
  };
}

/**
 * Öğrencinin optik form şıklarını ve kitapçığını doğrudan değerlendirip
 * tam kapsamlı AkademiPanel ExamResult nesnesine dönüştüren yardımcı fonksiyon.
 */
export function evaluateOpticalExamResult(
  studentAnswers: string[],
  booklet: string,
  exam: Exam,
  matchedStudent?: Student | null
): ExamResult {
  return createUnifiedExamResult(
    {
      answers: studentAnswers,
      booklet: booklet || 'A',
      studentId: matchedStudent?.id,
      studentNo: matchedStudent?.no,
      studentName: matchedStudent?.name,
      studentClass: matchedStudent?.className,
      classStr: matchedStudent?.classStr,
      sectionStr: matchedStudent?.sectionStr
    },
    exam,
    matchedStudent
  );
}
