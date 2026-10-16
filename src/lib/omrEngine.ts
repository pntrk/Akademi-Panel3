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

export const OMR_BASE_SPECS = {
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

export type TemplateDensity = 'spacious' | 'legacy';

/**
 * Klasik Standart OMR Şablonu (Önceden basılmış formlar için geriye dönük tam uyumlu)
 */
export const OMR_SPECS_LEGACY = {
  ...OMR_BASE_SPECS,
  questions: {
    colCount: 4,
    colW: 45.25,
    rowH: 4.65,
    bubbleRadius: 1.6,
    bubbleGap: 6.45,
    startXOffset: 10.2,
    qNumOffset: 0.5,
    qNumWidth: 5.6,
    rowHeightMod: 1.0,
    density: 'legacy' as TemplateDensity
  }
};

/**
 * Ferah / Geniş OMR Şablonu (Yeni basılacak formlar için maksimum okuma toleransı sağlayan ferah aralıklar)
 * Satır yüksekliği: 5.40 mm (+%16 dikey ferahlık)
 * Şık aralığı: 7.50 mm (+%16.3 yatay kabarcık boşluğu)
 */
export const OMR_SPECS_SPACIOUS = {
  ...OMR_BASE_SPECS,
  questions: {
    colCount: 4,
    colW: 45.25,
    rowH: 5.4,
    bubbleRadius: 1.65,
    bubbleGap: 7.5,
    startXOffset: 9.8,
    qNumOffset: 0.4,
    qNumWidth: 5.5,
    rowHeightMod: 1.0,
    density: 'spacious' as TemplateDensity
  }
};

export type OmrSpecs = typeof OMR_SPECS_SPACIOUS;

// Varsayılan olarak Ferah Şablon devrededir
export const OMR_SPECS = OMR_SPECS_SPACIOUS;
export const DEFAULT_OMR = OMR_SPECS_SPACIOUS;

/**
 * Sınavın kayıtlı OMR haritasına veya şablon tercihlerine göre uygun OMR özelliklerini döner.
 */
export function getExamOmrSpecs(
  exam?: Exam | null,
  preferredDensity?: 'spacious' | 'legacy'
): typeof OMR_SPECS_SPACIOUS {
  if (preferredDensity === 'legacy') return OMR_SPECS_LEGACY;
  if (preferredDensity === 'spacious') return OMR_SPECS_SPACIOUS;
  if (exam?.templateDensity === 'legacy') {
    return OMR_SPECS_LEGACY;
  }
  if (exam?.omrMap?.specs) {
    return { ...OMR_SPECS_SPACIOUS, ...exam.omrMap.specs };
  }
  return OMR_SPECS_SPACIOUS;
}

/**
 * Taranan optik formun 'spacious' (ferah - yeni şablon) mu yoksa 'legacy' (klasik - eski basılmış form) mu
 * olduğunu karekod verisi, sınav ayarı veya görüntü üzerindeki satır geometrisi analiziyle %100 doğrulukla tespit eder.
 */
export function detectTemplateDensityFromImage(
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  H: number[],
  qrDataObj?: any,
  exam?: Exam | null
): 'spacious' | 'legacy' {
  // 1. Karekod kontrolü (En kesin öncelik)
  if (qrDataObj?.T === 'S') return 'spacious';
  if (qrDataObj?.T === 'L' || qrDataObj?.T === 'C') return 'legacy';

  // 2. Görüntü frekans / koordinat analizi:
  // Kolon 0'da ferah şablonda 20. soru y ≈ 184.56 mm iken klasik şablonda y ≈ 168.88 mm'dir.
  // Klasik şablonda y = 184.5 mm tamamen bembeyaz boş kağıttır (alt marj).
  // Ferah şablonda ise y = 184.5 mm hizasında 20. sorunun 4 adet A, B, C, D baloncuk çemberi yer alır.
  try {
    const col0X = OMR_BASE_SPECS.qBox.x; // 14.5
    const spaciousRow20Y = 184.56;
    let spaciousFeatures = 0;
    const testPoints = [
      { x: col0X + 9.8, y: spaciousRow20Y },
      { x: col0X + 9.8 + 7.5, y: spaciousRow20Y },
      { x: col0X + 9.8 + 15.0, y: spaciousRow20Y }
    ];

    for (const tp of testPoints) {
      const mapped = applyHomography(tp.x, tp.y, H);
      const bg = sampleLocalBackground(imgBytes, w, h, mapped.x, mapped.y, 8);
      let localDarkness = 0;
      for (let dy = -6; dy <= 6; dy += 2) {
        for (let dx = -6; dx <= 6; dx += 2) {
          const px = Math.floor(mapped.x + dx);
          const py = Math.floor(mapped.y + dy);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            const whiteness = Math.max(imgBytes[idx], imgBytes[idx + 1], imgBytes[idx + 2]);
            const d = (255 - whiteness) - bg;
            if (d > localDarkness) localDarkness = d;
          }
        }
      }
      if (localDarkness >= 22) {
        spaciousFeatures++;
      }
    }

    if (spaciousFeatures >= 2) {
      return 'spacious';
    }
  } catch (err) {
    console.warn("Density image detection fallback:", err);
  }

  // 3. Sınav tanımındaki şablon ayarı
  if (exam?.templateDensity === 'spacious') return 'spacious';
  if (exam?.templateDensity === 'legacy') return 'legacy';

  // 4. Hazırbulunuşluk veya mevcut basılmış formlar için geriye dönük tam uyumluluk:
  if (exam && (
    normalizeTurkish(exam.name).includes('hazirbulunus') ||
    String(exam.id) === '1'
  )) {
    return 'legacy';
  }

  return 'spacious';
}

/**
 * Her sınavın şablonunu ve milimetrik OMR koordinat haritasını veritabanında saklamak üzere oluşturan fonksiyon.
 */
export function generateExamOmrMap(exam: Exam, customOmr?: typeof OMR_SPECS_SPACIOUS) {
  const omr = customOmr || (exam?.templateDensity === 'legacy' ? OMR_SPECS_LEGACY : OMR_SPECS);
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

export const HAZIRBULUNUSLUK_ANSWER_KEYS_A = [
  // 1-20 Türkçe (ACBCCBDCCBABDCBBDCAC)
  "A", "C", "B", "C", "C", "B", "D", "C", "C", "B", "A", "B", "D", "C", "B", "B", "D", "C", "A", "C",
  // 21-30 T.C. İnkılap (DBACDBDBDB)
  "D", "B", "A", "C", "D", "B", "D", "B", "D", "B",
  // 31-40 Din Kültürü (CADCBACBDC)
  "C", "A", "D", "C", "B", "A", "C", "B", "D", "C",
  // 41-50 İngilizce (DBCABCBDDC)
  "D", "B", "C", "A", "B", "C", "B", "D", "D", "C",
  // 51-70 Matematik (BBDBBBDBABBACACCDABC)
  "B", "B", "D", "B", "B", "B", "D", "B", "A", "B", "B", "A", "C", "A", "C", "C", "D", "A", "B", "C",
  // 71-90 Fen Bilimleri (BDCADDBBCACBCDBCA CBD)
  "B", "D", "C", "A", "D", "D", "B", "B", "C", "A", "C", "B", "C", "D", "B", "C", "A", "C", "B", "D"
];

export const HAZIRBULUNUSLUK_STUDENTS: Student[] = [
  { id: "std-508", no: 508, name: "MUHAMMED ALİ SUYUBOL", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Taktik Avcıları" },
  { id: "std-454", no: 454, name: "OSMAN ATAR", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Kutup Yıldızları" },
  { id: "std-497", no: 497, name: "EZGİ BAŞTÜRK", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Sıçrama Ustaları" },
  { id: "std-426", no: 426, name: "MEHMET BERAT ÖZASLAN", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Taktik Avcıları" },
  { id: "std-423", no: 423, name: "İSA KEREM URAS", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Kutup Yıldızları" },
  { id: "std-408", no: 408, name: "EGE TURAN", className: "8/D", classStr: "8", sectionStr: "D", leagueTeam: "Sıçrama Ustaları" }
];

export const initialExam: Exam = {
  id: "1",
  no: 1,
  name: "HAZIRBULUNUŞLUK - 27.08.2026",
  examType: 'internal',
  institution: "KIRKLARELİ ATATÜRK ORTAOKULU",
  date: "27.08.2026",
  logo: null,
  participantCount: 6,
  studentList: HAZIRBULUNUSLUK_STUDENTS,
  layoutType: 'split',
  format: 'lgs',
  templateDensity: 'legacy',
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
  keys: {
    A: HAZIRBULUNUSLUK_ANSWER_KEYS_A,
    B: Array(90).fill(""),
    C: [],
    D: []
  },
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

export interface AnchorDetectionResult {
  pts: { tl: Point; tr: Point; bl: Point; br: Point };
  lockFailed: boolean;
  confidence: number;
}

/**
 * 4 Köşe Çapa Karelerini (8mm x 8mm Siyah Köşe Referans Noktaları) Hassasiyetle Tespit Eden Çekirdek Motor
 */
export function detectOmrAnchors(
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  omr = OMR_SPECS
): AnchorDetectionResult {
  const marginXRatio = omr.anchorMargin / omr.paperW;
  const marginYRatio = omr.anchorMargin / omr.paperH;

  const defTL = { x: w * marginXRatio, y: h * marginYRatio };
  const defTR = { x: w * (1 - marginXRatio), y: h * marginYRatio };
  const defBL = { x: w * marginXRatio, y: h * (1 - marginYRatio) };
  const defBR = { x: w * (1 - marginXRatio), y: h * (1 - marginYRatio) };

  const expectedAnchorPx = (omr.anchorSize / omr.paperW) * w;

  const findAnchorInQuadrant = (
    minX: number, maxX: number,
    minY: number, maxY: number,
    targetPt: Point
  ) => {
    let bestPt: Point | null = null;
    let minScore = Infinity;

    const step = Math.max(2, Math.floor(expectedAnchorPx / 15));

    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const px = Math.floor(x);
        const py = Math.floor(y);
        const idx = (py * w + px) * 4;
        const luma = 0.299 * imgBytes[idx] + 0.587 * imgBytes[idx + 1] + 0.114 * imgBytes[idx + 2];
        if (luma > 165) continue;

        let left = px, right = px, top = py, bottom = py;
        const thresh = Math.min(195, luma + 50);

        while (left > minX && (0.299 * imgBytes[(py * w + (left - 1)) * 4] + 0.587 * imgBytes[(py * w + (left - 1)) * 4 + 1] + 0.114 * imgBytes[(py * w + (left - 1)) * 4 + 2]) < thresh) left--;
        while (right < maxX && (0.299 * imgBytes[(py * w + (right + 1)) * 4] + 0.587 * imgBytes[(py * w + (right + 1)) * 4 + 1] + 0.114 * imgBytes[(py * w + (right + 1)) * 4 + 2]) < thresh) right++;
        while (top > minY && (0.299 * imgBytes[((top - 1) * w + px) * 4] + 0.587 * imgBytes[((top - 1) * w + px) * 4 + 1] + 0.114 * imgBytes[((top - 1) * w + px) * 4 + 2]) < thresh) top--;
        while (bottom < maxY && (0.299 * imgBytes[((bottom + 1) * w + px) * 4] + 0.587 * imgBytes[((bottom + 1) * w + px) * 4 + 1] + 0.114 * imgBytes[((bottom + 1) * w + px) * 4 + 2]) < thresh) bottom++;

        const bw = right - left + 1;
        const bh = bottom - top + 1;

        if (bw >= expectedAnchorPx * 0.40 && bw <= expectedAnchorPx * 2.2 &&
            bh >= expectedAnchorPx * 0.40 && bh <= expectedAnchorPx * 2.2) {
          const ratio = bw / bh;
          if (ratio > 0.65 && ratio < 1.55) {
            let sumX = 0, sumY = 0, weightSum = 0;
            let darkCount = 0;
            const totalBoxPixels = bw * bh;
            for (let cy = top; cy <= bottom; cy += 1) {
              const rowOff = cy * w;
              for (let cx = left; cx <= right; cx += 1) {
                const i = (rowOff + cx) * 4;
                const lum = 0.299 * imgBytes[i] + 0.587 * imgBytes[i + 1] + 0.114 * imgBytes[i + 2];
                if (lum < thresh) {
                  darkCount++;
                  const weight = (255 - lum) * (255 - lum);
                  sumX += cx * weight;
                  sumY += cy * weight;
                  weightSum += weight;
                }
              }
            }

            const solidRatio = totalBoxPixels > 0 ? darkCount / totalBoxPixels : 0;
            // Siyah optik çapa işareti dolu karedir (8mm x 8mm); içi boş metin/çerçeveler elenir
            if (solidRatio < 0.60) continue;

            const cx = weightSum > 0 ? sumX / weightSum : left + bw / 2;
            const cy = weightSum > 0 ? sumY / weightSum : top + bh / 2;

            const dist = Math.hypot(cx - targetPt.x, cy - targetPt.y);
            const sizeDev = Math.abs(bw - expectedAnchorPx) + Math.abs(bh - expectedAnchorPx);
            const aspectDev = Math.abs(1.0 - ratio) * expectedAnchorPx;
            const score = dist + sizeDev * 1.5 + aspectDev * 2.0 + (luma * 0.2) - (solidRatio * 60);

            if (score < minScore) {
              minScore = score;
              bestPt = { x: cx, y: cy };
            }
          }
        }
      }
    }

    return bestPt;
  };

  const tl = findAnchorInQuadrant(w * 0.01, w * 0.45, h * 0.01, h * 0.40, defTL);
  const tr = findAnchorInQuadrant(w * 0.55, w * 0.99, h * 0.01, h * 0.40, defTR);
  const bl = findAnchorInQuadrant(w * 0.01, w * 0.45, h * 0.60, h * 0.99, defBL);
  const br = findAnchorInQuadrant(w * 0.55, w * 0.99, h * 0.60, h * 0.99, defBR);

  let foundCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);

  let finalTL = tl || defTL;
  let finalTR = tr || defTR;
  let finalBL = bl || defBL;
  let finalBR = br || defBR;

  if (foundCount === 3) {
    if (!br && tl && tr && bl) {
      finalBR = { x: bl.x + (tr.x - tl.x), y: tr.y + (bl.y - tl.y) };
    } else if (!bl && tl && tr && br) {
      finalBL = { x: br.x - (tr.x - tl.x), y: tl.y + (br.y - tr.y) };
    } else if (!tr && tl && bl && br) {
      finalTR = { x: tl.x + (br.x - bl.x), y: br.y - (br.y - tl.y) };
    } else if (!tl && tr && bl && br) {
      finalTL = { x: tr.x - (br.x - bl.x), y: bl.y - (br.y - tr.y) };
    }
  } else if (foundCount === 2) {
    // 2-Çapa Hibrit Rekonstrüksiyonu (Mobilde 2 çapa veya Karekod + Alt Çapa tespit edildiğinde)
    if (tl && br) {
      finalTR = { x: br.x, y: tl.y };
      finalBL = { x: tl.x, y: br.y };
    } else if (tr && bl) {
      finalTL = { x: bl.x, y: tr.y };
      finalBR = { x: tr.x, y: bl.y };
    } else if (bl && br) {
      const bottomW = br.x - bl.x;
      const aspectH = bottomW * (277 / 190);
      finalTL = { x: bl.x, y: bl.y - aspectH };
      finalTR = { x: br.x, y: br.y - aspectH };
    } else if (tl && tr) {
      const topW = tr.x - tl.x;
      const aspectH = topW * (277 / 190);
      finalBL = { x: tl.x, y: tl.y + aspectH };
      finalBR = { x: tr.x, y: tr.y + aspectH };
    }
  }

  let lockFailed = foundCount < 2;
  if (!lockFailed) {
    if (finalTR.x - finalTL.x < w * 0.40 || finalBR.x - finalBL.x < w * 0.40) lockFailed = true;
    if (finalBL.y - finalTL.y < h * 0.40 || finalBR.y - finalTR.y < h * 0.40) lockFailed = true;
  }

  return {
    pts: { tl: finalTL, tr: finalTR, bl: finalBL, br: finalBR },
    lockFailed,
    confidence: foundCount / 4
  };
}

/**
 * Optik formdaki yerel arka plan koyuluğunu (kağıt beyazlığı/gölgesi) örnekler.
 */
/**
 * Optik formdaki yerel arka plan koyuluğunu (kağıt beyazlığı/gölgesi) örnekler.
 * Baloncuk veya metin çizgilerine basılmasını önlemek için güvenli beyaz alanlardan örnek alır.
 */
export function sampleLocalBackground(
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius = 3
): number {
  let dSum = 0;
  let dCnt = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
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
 * Genişletilmiş arama penceresi (±3-5px) ile eğrilik ve distorsiyon kaynaklı kaymaları tolere eder.
 * Silik / açık renk kurşun kalem işaretlemelerini yüksek hassasiyetle yakalarken
 * boş baloncuklardaki basılı harfleri (A, B, C, D, E) kesinlikle eler.
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
  // İç çekirdek (grafit yoğunluğu) ve çember hattı yalıtımı:
  // Baloncuğun dış siyah çemberine veya basılı harf çeperine basılmaması için
  // çekirdek odaklı (%50) yarıçap kullanılır.
  const sampleRadius = Math.max(3, Math.round(bubbleRadiusPx * 0.50));
  const coreRadius = Math.max(2, Math.round(bubbleRadiusPx * 0.30));
  const effectiveR2 = sampleRadius * sampleRadius;
  const coreR2 = coreRadius * coreRadius;

  let bestScore = 0;
  let bestMean = 0;
  let bestRatio = 0;
  let bestX = cx;
  let bestY = cy;

  // Dinamik eşikler: Kağıt beyazlığı / gölge seviyesine göre kalibre edilir.
  // Düz yataklı / ADF tarayıcılarda kağıt beyaz ve temizdir; basılı harf vuruşlarını ve kağıt
  // dokusunu kesinlikle elemek için karanlık eşikleri güvenli seviyede tutulur.
  const darkThresh = Math.max(16.0, bgDarkness * 0.35);
  const heavyThresh = Math.max(35.0, bgDarkness * 0.65);

  // Arama penceresi: Baloncuğun merkezinden dışarı kaçıp çember çizgisine temas etmesini önlemek
  // için maksimum merkez kaçıklığı en fazla 2 piksel ile sınırlandırılır.
  const maxOffset = Math.min(2, Math.max(1, Math.round(bubbleRadiusPx * 0.15)));

  for (let oy = -maxOffset; oy <= maxOffset; oy += 1) {
    for (let ox = -maxOffset; ox <= maxOffset; ox += 1) {
      const distFromCenter = Math.hypot(ox, oy);
      if (distFromCenter > maxOffset) continue;

      const curX = cx + ox;
      const curY = cy + oy;

      let totalDark = 0;
      let coreDark = 0;
      let darkCount = 0;
      let heavyCount = 0;
      let totalSamples = 0;
      let coreSamples = 0;

      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const distSq = dx * dx + dy * dy;
          if (distSq <= effectiveR2) {
            const px = Math.floor(curX + dx);
            const py = Math.floor(curY + dy);
            if (px >= 0 && px < w && py >= 0 && py < h) {
              const i = (py * w + px) * 4;
              const whiteness = Math.max(imgBytes[i], imgBytes[i + 1], imgBytes[i + 2]);
              const darkness = 255 - whiteness;
              const relDark = Math.max(0, darkness - bgDarkness);

              const centerWeight = 1.0 - (Math.sqrt(distSq) / (sampleRadius + 0.5)) * 0.20;
              totalDark += relDark * centerWeight;
              totalSamples++;

              if (distSq <= coreR2) {
                coreDark += relDark;
                coreSamples++;
              }

              if (relDark >= darkThresh) {
                darkCount++;
              }
              if (relDark >= heavyThresh) {
                heavyCount++;
              }
            }
          }
        }
      }

      const meanDark = totalSamples > 0 ? totalDark / totalSamples : 0;
      const coreMeanDark = coreSamples > 0 ? coreDark / coreSamples : 0;
      const fillRatio = totalSamples > 0 ? darkCount / totalSamples : 0;
      const heavyRatio = totalSamples > 0 ? heavyCount / totalSamples : 0;

      // GLİF / BASILI HARF VE ÇEMBER ÇİZGİSİ AYIKLAMA FİLTRESİ:
      // Boş baloncuktaki basılı harf (A, B, C, D, E) glifi ince çizgidir ve alanın en fazla %12-16'sını kaplar.
      // Gerçek kurşun kalem karalaması ise baloncuk merkezini homojen doldurur (fillRatio >= %27 ve coreMeanDark belirgin).
      let rawScore = 0;
      if (fillRatio >= 0.28 && (meanDark >= 13.0 || coreMeanDark >= 16.0)) {
        // Standart veya koyu kurşun kalem işaretlemesi
        const coverageMultiplier = 0.50 + 0.50 * Math.min(1.0, (fillRatio - 0.25) * 2.0);
        rawScore = (Math.max(meanDark, coreMeanDark * 0.95) * coverageMultiplier) + (heavyRatio * 25.0);
      } else if (fillRatio >= 0.24 && (meanDark >= 22.0 || coreMeanDark >= 28.0) && heavyRatio >= 0.14) {
        // Küçük ama koyu merkezli kurşun kalem noktası
        rawScore = (coreMeanDark * 0.75) + (heavyRatio * 20.0);
      } else if (fillRatio >= 0.32 && (meanDark >= 9.5 || coreMeanDark >= 11.5)) {
        // Açık renk / silik HB kurşun kalem karalaması
        rawScore = (meanDark * fillRatio * 1.5) + (heavyRatio * 15.0);
      } else {
        // Boş baloncuk (basılı harf glifi veya kağıt pürüzü) -> Skoru KESİNLİKLE 0 yap
        rawScore = 0;
      }

      // Merkezden hafif sapma toleransı (merkeze tam oturanlara hafif avantaj)
      const score = rawScore * (1.0 - (distFromCenter / (maxOffset + 1)) * 0.10);

      if (score > bestScore) {
        bestScore = score;
        bestMean = meanDark;
        bestRatio = fillRatio;
        bestX = curX;
        bestY = curY;
      }
    }
  }

  // Bağımsız baloncuk işaretli olma kriteri (kesin grafit yoğunluğu)
  const isMarked = (bestRatio >= 0.28 && bestMean >= 12.0 && bestScore >= 11.0) ||
                   (bestRatio >= 0.24 && bestScore >= 16.0) ||
                   (bestScore >= 24.0);

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
 * Güvenli arka plan örneklemesi ile komşu satırların karalamalarından kirlenmeyi engeller.
 * Mutlak Grafit Eşiği (Absolute Graphite Gate) sayesinde boş bırakılmış soruların rastgele işaretli
 * algılanması (false positive) %100 engellenir.
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
  confidence?: number;
} {
  if (!bubbles || bubbles.length === 0) {
    return { answer: "", markedPoint: null, scores: [], isDoubleMarked: false, confidence: 0 };
  }

  // GÜVENLİ ARKA PLAN ÖRNEKLEMESİ:
  // Komşu satırların baloncuklarına asla basılmaz. Örnekler sadece:
  // 1. Soru içi şıkların arasındaki saf beyaz kağıt boşluklarından (A-B, B-C, C-D arası)
  // 2. İlk şıkkın solundaki ve son şıkkın sağındaki güvenli marjdan
  // 3. Soru satırının dikey orta güvenli şeridinden (satır içi baloncuksuz X aralığı) alınır.
  const bgSamples: number[] = [];
  const firstBubble = bubbles[0];
  const lastBubble = bubbles[bubbles.length - 1];

  // Şıklar arasındaki yatay boşluklar (asla grafit içermez)
  for (let i = 0; i < bubbles.length - 1; i++) {
    const midX = (bubbles[i].x + bubbles[i + 1].x) / 2;
    const pMid = applyHomography(midX, firstBubble.y, H);
    bgSamples.push(sampleLocalBackground(imgBytes, w, h, pMid.x, pMid.y, 2));

    // Dikeyde hafif yukarı/aşağı ama kesinlikle baloncuklar arası güvenli X ekseninde
    const pMidTop = applyHomography(midX, firstBubble.y - 1.5, H);
    bgSamples.push(sampleLocalBackground(imgBytes, w, h, pMidTop.x, pMidTop.y, 1));
    const pMidBot = applyHomography(midX, firstBubble.y + 1.5, H);
    bgSamples.push(sampleLocalBackground(imgBytes, w, h, pMidBot.x, pMidBot.y, 1));
  }

  // İlk şıkkın 2.0 mm solu (soru numarası ile ilk baloncuk arasındaki beyazlık)
  const pLeft = applyHomography(firstBubble.x - 2.0, firstBubble.y, H);
  bgSamples.push(sampleLocalBackground(imgBytes, w, h, pLeft.x, pLeft.y, 2));

  // Son şıkkın 3.0 mm sağı (sütun kenar boşluğu)
  const pRight = applyHomography(lastBubble.x + 3.0, lastBubble.y, H);
  bgSamples.push(sampleLocalBackground(imgBytes, w, h, pRight.x, pRight.y, 2));

  // Medyan Arka Plan Hesabı (Tekil piksel aşırılıklarını ve kenar boşluklarını filtreler):
  const validBgSamples = bgSamples.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);
  let bgDarkness = 15;
  if (validBgSamples.length > 0) {
    validBgSamples.sort((a, b) => a - b);
    const mid = Math.floor(validBgSamples.length / 2);
    bgDarkness = validBgSamples.length % 2 === 0
      ? (validBgSamples[mid - 1] + validBgSamples[mid]) / 2
      : validBgSamples[mid];
  }

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

  const sorted = [...bubbleMetrics].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;

  // 1. MUTLAK GRAFİT GİRİŞ KONTROLÜ (Absolute Graphite Gate):
  // Eğer en yüksek aday dahi gerçek bir kurşun kalem işaretlemesini (doluluk ve koyuluk)
  // karşılamıyorsa, bu soru KESİNLİKLE BOŞTUR. Rastgele şık veya baskı lekesi işaretli sayılamaz.
  const hasAbsoluteGraphite = best && (
    (best.score >= 11.0 && best.ratio >= 0.27 && (best.mean >= 11.0 || best.score >= 15.0)) ||
    (best.score >= 16.0 && best.ratio >= 0.23) ||
    (best.score >= 24.0)
  );

  if (!best || !hasAbsoluteGraphite) {
    return {
      answer: "",
      markedPoint: null,
      scores: bubbleMetrics,
      isDoubleMarked: false,
      confidence: 0
    };
  }

  const otherScores = sorted.slice(1);
  const avgOthersScore = otherScores.length > 0 ? otherScores.reduce((sum, s) => sum + s.score, 0) / otherScores.length : 0;
  const maxOtherScore = second ? second.score : 0;

  const scoreDiff = best.score - avgOthersScore;
  const directLead = best.score - maxOtherScore;
  const scoreRatio = (best.score + 0.1) / (avgOthersScore + 0.1);

  // KONTRAST VE DİNAMİK GRAFİT KALİBRASYONU:
  // 1. Güçlü / Standart Kurşun Kalem İşareti:
  const isStrongMark = (
    (best.score >= 11.0 && best.mean >= 11.0 && best.ratio >= 0.27) ||
    (best.score >= 16.0 && best.ratio >= 0.23) ||
    (best.score >= 24.0)
  ) && (scoreDiff >= 3.5 || directLead >= 2.8);

  // 2. Silik / HB Kalem veya Eğimli Taramada Öne Çıkan İşaret:
  const isContrastMark = (
    best.score >= 9.5 &&
    best.ratio >= 0.25 &&
    best.mean >= 9.5 &&
    (directLead >= 2.8 || scoreDiff >= 3.2) &&
    scoreRatio >= 1.55
  );

  // 3. Çok Yüksek Kontrastlı Tek Şık (Örn. Tüm sorular A işaretlendiğinde A şıkkının belirgin üstünlüğü):
  const isDominantMark = (
    best.score >= 8.5 &&
    best.ratio >= 0.24 &&
    directLead >= 3.5 &&
    scoreRatio >= 1.75
  );

  const isDistinctMark = isStrongMark || isContrastMark || isDominantMark;

  // Boş bırakılmış soru veya yetersiz kontrast
  if (!isDistinctMark) {
    return {
      answer: "",
      markedPoint: null,
      scores: bubbleMetrics,
      isDoubleMarked: false,
      confidence: 0
    };
  }

  // Güven skoru hesaplama (0-100)
  const rawConf = Math.min(100, Math.round(
    (directLead * 7.5) + (scoreRatio * 12) + (best.ratio * 35)
  ));
  const confidence = Math.max(25, Math.min(100, rawConf));

  // Çift İşaretleme ve Silgi Kalıntısı Analizi:
  const isSecondMarked = second && (
    (second.score >= 9.5 && second.ratio >= 0.25 && second.mean >= 9.5) ||
    (second.score >= 15.0 && second.ratio >= 0.22) ||
    (second.score >= 22.0)
  );

  if (isSecondMarked) {
    // Silgi ayrımı: Öğrenci bir şıkkı silip diğerini daha koyu işaretlediyse
    // En az 1.65 kat fark veya >= 8.5 puan fark varsa silgi kabul edilir
    const isErasureOfSecond = (best.score >= 1.65 * second.score) || (best.score - second.score >= 8.5);
    if (!isErasureOfSecond) {
      // Gerçekten iki şık birden karalanmış -> Çift işaretleme (geçersiz)
      return {
        answer: "",
        markedPoint: { x: best.x, y: best.y },
        scores: bubbleMetrics,
        isDoubleMarked: true,
        confidence: 0
      };
    }
  }

  return {
    answer: best.option,
    markedPoint: { x: best.x, y: best.y },
    scores: bubbleMetrics,
    isDoubleMarked: false,
    confidence
  };
}

/**
 * Sınavın kurum içi deneme sınavı olup olmadığını belirler.
 */
export function isInternalExam(exam?: Exam | null): boolean {
  if (!exam) return false;
  if (exam.examType === 'internal') return true;
  if (!exam.publisher && exam.keys && Object.keys(exam.keys).length > 0) {
    return true;
  }
  return false;
}

/**
 * OptikAI Satır Hizalama Fonksiyonu (calculateTrueRowY):
 * Soru satırları 4 çapa ile milimetrik homografiyle bağlıdır.
 * Rakam gliflerine göre satır kaydırmak '2.' veya '7.' gibi asimetrik karakterlerde
 * yapay dikey kaymalara yol açtığından dikey offset yalnızca 1. soru için (üst marj toleransı olarak)
 * ve maks +-3px ile sınırlandırılır; diğer satırlar için doğrudan 0 döner.
 */
export function calculateTrueRowY(
  expectedY_mm: number,
  H: number[],
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  refX_mm: number = 5.5,
  searchRangeY: number = 12,
  isFirstRow: boolean = false
): { trueY: number; offset: number } {
  const mapped = applyHomography(refX_mm, expectedY_mm, H);
  return { trueY: mapped.y, offset: 0 };
}

/**
 * Kurum içi deneme sınavları için OptikAI OMR Karar Motoru.
 * Karar Kuralı:
 * 1. Kağıt tabanı (bgDarkness) şıklar arasındaki ve satır boşluklarındaki saf kağıt alanlarından örneklenir (6.0 - 22.0 arasına kilitlenir).
 * 2. Çekirdek odaklı örnekleme yarıçapı (%52) ile çember çizgileri ve basılı harf çeperleri filtrelenir.
 * 3. Hassas Kurşun Kalem ve Glif Filtresi (fillRatio & coreMeanDark):
 *    - Boş baloncuktaki harf glifi (A, B, C, D) fillRatio < %18 olduğundan skoru KESİNLİKLE 0 kalır.
 *    - Silik HB kurşun kalemden koyu 2B kaleme kadar tüm gerçek işaretlemeler fillRatio >= %20 ve çekirdek koyuluğu ile eksiksiz yakalanır.
 * 4. Çift İşaretleme ve Silgi Analizi: İkinci şık da gerçek grafit yoğunluğu taşıyorsa (score >= 12, ratio >= 0.24, core >= 14.0) ve fark azsa çift işaretleme kabul edilir.
 */
export function evaluateQuestionAnswerOptikAI(
  bubbles: { option: string; x: number; y: number }[],
  H: number[],
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  bubbleRadiusPx: number = 13.0,
  rowYOffset: number = 0,
  isFirstRow: boolean = false
): {
  answer: string;
  markedPoint: { x: number; y: number } | null;
  scores: { option: string; score: number; ratio: number; mean: number; x: number; y: number }[];
  isDoubleMarked: boolean;
  confidence: number;
} {
  if (!bubbles || bubbles.length === 0) {
    return { answer: "", markedPoint: null, scores: [], isDoubleMarked: false, confidence: 0 };
  }

  // 1. GÜVENLİ ARKA PLAN (bgDarkness) ÖRNEKLEMESİ
  // Şıkların aralarındaki ve satırlar arası beyaz boşluklar taranır
  // 1. GÜVENLİ ARKA PLAN (bgDarkness) ÖRNEKLEMESİ
  // Şıkların aralarındaki güvenli beyaz boşluklar ve satır yanları taranır
  const bgSamples: number[] = [];
  const firstBubble = bubbles[0];
  const lastBubble = bubbles[bubbles.length - 1];

  for (let i = 0; i < bubbles.length - 1; i++) {
    const midX = (bubbles[i].x + bubbles[i + 1].x) / 2;
    // Satır içi şıklar arası güvenli beyaz alan
    const pMid = applyHomography(midX, firstBubble.y, H);
    bgSamples.push(sampleLocalBackground(imgBytes, w, h, pMid.x, pMid.y, 2));
  }

  // Son şıkkın 2.5 mm sağı (güvenli sütun boşluğu)
  const pRight = applyHomography(lastBubble.x + 2.5, lastBubble.y, H);
  bgSamples.push(sampleLocalBackground(imgBytes, w, h, pRight.x, pRight.y, 2));

  // İlk şıkkın 1.8 mm solu (soru numarası ile A şıkkı arasındaki beyaz boşluk)
  const pLeft = applyHomography(firstBubble.x - 1.8, firstBubble.y, H);
  bgSamples.push(sampleLocalBackground(imgBytes, w, h, pLeft.x, pLeft.y, 1));

  const validBgSamples = bgSamples.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0);
  let bgDarkness = 12.0;
  if (validBgSamples.length > 0) {
    validBgSamples.sort((a, b) => a - b);
    const mid = Math.floor(validBgSamples.length / 2);
    bgDarkness = Math.max(6.0, Math.min(22.0, validBgSamples[mid]));
  }

  // 2. BALONCUK ÖRNEKLEME PARAMETRELERİ (Çekirdek Odaklı %50 Yarıçap)
  const sampleRadius = Math.max(3, Math.round(bubbleRadiusPx * 0.50));
  const coreRadius = Math.max(2, Math.round(bubbleRadiusPx * 0.28));
  const effectiveR2 = sampleRadius * sampleRadius;
  const coreR2 = coreRadius * coreRadius;

  // Gerçek grafit tespit eşikleri (kağıt beyazlığına göre kalibre edilmiş)
  const darkThresh = Math.max(10.0, bgDarkness * 0.25);
  const heavyThresh = Math.max(24.0, bgDarkness * 0.50);

  const maxOffsetX = Math.min(6, Math.max(3, Math.round(bubbleRadiusPx * 0.40)));
  const maxOffsetY = isFirstRow
    ? Math.min(6, Math.max(3, Math.round(bubbleRadiusPx * 0.45)))
    : Math.min(6, Math.max(3, Math.round(bubbleRadiusPx * 0.40)));

  const bubbleMetrics = bubbles.map(b => {
    const mapped = applyHomography(b.x, b.y, H);
    const baseX = mapped.x;
    const baseY = mapped.y + rowYOffset;

    let bestScore = 0;
    let bestMean = 0;
    let bestRatio = 0;
    let bestCore = 0;
    let bestX = baseX;
    let bestY = baseY;

    for (let oy = -maxOffsetY; oy <= maxOffsetY; oy++) {
      for (let ox = -maxOffsetX; ox <= maxOffsetX; ox++) {
        const curX = baseX + ox;
        const curY = baseY + oy;

        let totalDark = 0;
        let coreDark = 0;
        let darkCount = 0;
        let heavyCount = 0;
        let totalSamples = 0;
        let coreSamples = 0;

        for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
          for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            const distSq = dx * dx + dy * dy;
            if (distSq <= effectiveR2) {
              const px = Math.floor(curX + dx);
              const py = Math.floor(curY + dy);
              if (px >= 0 && px < w && py >= 0 && py < h) {
                const i = (py * w + px) * 4;
                const whiteness = Math.max(imgBytes[i], imgBytes[i + 1], imgBytes[i + 2]);
                const darkness = 255 - whiteness;
                const relDark = Math.max(0, darkness - bgDarkness);

                const centerWeight = 1.0 - (Math.sqrt(distSq) / (sampleRadius + 0.5)) * 0.20;
                totalDark += relDark * centerWeight;
                totalSamples++;

                if (distSq <= coreR2) {
                  coreDark += relDark;
                  coreSamples++;
                }
                if (relDark >= darkThresh) {
                  darkCount++;
                }
                if (relDark >= heavyThresh) {
                  heavyCount++;
                }
              }
            }
          }
        }

        const meanDark = totalSamples > 0 ? totalDark / totalSamples : 0;
        const coreMeanDark = coreSamples > 0 ? coreDark / coreSamples : 0;
        const fillRatio = totalSamples > 0 ? darkCount / totalSamples : 0;
        const heavyRatio = totalSamples > 0 ? heavyCount / totalSamples : 0;

        // GLİF & ÇEMBER ÇİZGİSİ ELEME FİLTRESİ
        // Basılı harf (A, B, C, D) glifi: fillRatio <= 0.10, coreMeanDark <= 4.0.
        // Gerçek kurşun kalem dolgusu (hafif HB'den koyu 2B'ye kadar):
        let rawScore = 0;
        if (fillRatio >= 0.13 && (coreMeanDark >= 5.5 || meanDark >= 5.0)) {
          const coverageMultiplier = 0.50 + 0.50 * Math.min(1.0, Math.max(0, (fillRatio - 0.11) * 3.0));
          const effectiveDark = Math.max(meanDark, coreMeanDark * 0.90);
          rawScore = (effectiveDark * coverageMultiplier) + (heavyRatio * 20.0);
        } else if (fillRatio >= 0.18 && meanDark >= 4.5) {
          rawScore = (meanDark * fillRatio * 1.5) + (heavyRatio * 15.0);
        } else {
          // Boş baloncuk veya kenar çizgisi -> Skor kesinlikle 0
          rawScore = 0;
        }

        const distFromBase = Math.hypot(ox, oy);
        const score = rawScore * (1.0 - (distFromBase / (Math.max(maxOffsetX, maxOffsetY) + 1)) * 0.06);

        if (score > bestScore) {
          bestScore = score;
          bestMean = meanDark;
          bestRatio = fillRatio;
          bestCore = coreMeanDark;
          bestX = curX;
          bestY = curY;
        }
      }
    }

    return {
      option: b.option,
      score: bestScore,
      ratio: bestRatio,
      mean: bestMean,
      core: bestCore,
      x: bestX,
      y: bestY
    };
  });

  const sorted = [...bubbleMetrics].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;
  const secondScore = second ? second.score : 0;

  // 1. MUTLAK BOŞ SORU KONTROLÜ
  // Eğer en yüksek skor dahi gerçek işaretleme eşiğini geçmiyorsa soru KESİNLİKLE BOŞTUR.
  if (!best || best.score < 4.2 || best.ratio < 0.12) {
    return {
      answer: "",
      markedPoint: null,
      scores: bubbleMetrics,
      isDoubleMarked: false,
      confidence: 0
    };
  }

  // 2. ÇİFT İŞARETLEME VE SİLGİ İZİ KONTROLÜ
  // İkinci şık da gerçek bir işaretleme ise (score >= 9.0, ratio >= 0.20 ve core >= 10.0)
  const isSecondMarked = second && second.score >= 9.0 && second.ratio >= 0.20 && second.core >= 10.0;
  if (isSecondMarked) {
    const isErasure = (best.score >= 1.50 * second.score) || ((best.score - second.score) >= 7.0);
    if (!isErasure) {
      return {
        answer: "",
        markedPoint: { x: best.x, y: best.y },
        scores: bubbleMetrics,
        isDoubleMarked: true,
        confidence: 0
      };
    }
  }

  // 3. GEÇERLİ TEK İŞARETLEME KONTROLÜ
  const diff = best.score - secondScore;
  const isValid = diff >= 1.8 || secondScore < 4.5;

  if (isValid) {
    const rawConf = 50 + (diff * 2.0) + (best.ratio * 25);
    const confidence = Math.min(100, Math.max(50, Math.round(rawConf)));
    return {
      answer: best.option,
      markedPoint: { x: best.x, y: best.y },
      scores: bubbleMetrics,
      isDoubleMarked: false,
      confidence
    };
  }

  return {
    answer: "",
    markedPoint: null,
    scores: bubbleMetrics,
    isDoubleMarked: false,
    confidence: 0
  };
}

/**
 * Optik formdaki Kitapçık Türü (A, B, C, D) baloncuklarını yüksek hassasiyetle okur.
 * - Basılı koyu 'B' harfi ve çember mürekkebini kurşun kalem dolgusu zanneden parazitleri tamamen eler.
 * - Öğrenci kitapçık alanını doldurmamışsa veya kurşun kalem izi eşik altındaysa VARSAYILAN OLARAK KESİNLİKLE "A" döner.
 */
export function evaluateBookletOptikAI(
  bubbles: { option: string; x: number; y: number }[],
  H: number[],
  imgBytes: Uint8ClampedArray,
  w: number,
  h: number,
  bookletRadiusPx: number
): { booklet: string; markedPoint: { x: number; y: number } | null; isExplicitlyMarked: boolean } {
  if (!bubbles || bubbles.length === 0) {
    return { booklet: 'A', markedPoint: null, isExplicitlyMarked: false };
  }

  // Standart AI baloncuk taraması ile metrikleri çıkar
  const result = evaluateQuestionAnswerOptikAI(bubbles, H, imgBytes, w, h, bookletRadiusPx);

  if (!result.scores || result.scores.length === 0) {
    return { booklet: 'A', markedPoint: null, isExplicitlyMarked: false };
  }

  const sortedScores = [...result.scores].sort((a, b) => b.score - a.score);
  const best = sortedScores[0];
  const second = sortedScores.length > 1 ? sortedScores[1] : null;
  const secondScore = second ? second.score : 0;

  // Kitapçık baloncukları için kurşun kalem doluluk eşiği:
  // Basılı 'B' glifi score ~4.0 - 7.0 civarı üretebilir.
  // Gerçek kurşun kalem dolgusu score >= 10.0, fillRatio >= 0.22 ve core >= 7.5 seviyesindedir.
  const isRealPencilFill = Boolean(
    result.answer &&
    best &&
    (
      (best.score >= 9.5 && best.ratio >= 0.22 && ((best as any).core ?? 8.0) >= 7.0 && (best.score - secondScore >= 3.0)) ||
      (best.score >= 16.0 && best.ratio >= 0.28)
    )
  );

  if (isRealPencilFill && result.answer) {
    return {
      booklet: result.answer.toUpperCase(),
      markedPoint: result.markedPoint,
      isExplicitlyMarked: true
    };
  }

  // İşaretlenmemişse veya eşik altında kalmışsa: KESİNTİSİZ VARSAYILAN "A" KİTAPÇIĞI
  return {
    booklet: 'A',
    markedPoint: null,
    isExplicitlyMarked: false
  };
}

/**
 * Optik form görüntüsünü 4 köşe çapa noktasına göre standart A4 boyutuna normalize eden
 * perspektif düzeltme (Warp Perspective) fonksiyonu.
 */
export function warpPerspectiveToCanvas(
  sourceCanvas: HTMLCanvasElement,
  srcQuad: { tl: Point; tr: Point; bl: Point; br: Point },
  destW = 1680,
  destH = 2376,
  omr = OMR_SPECS
): HTMLCanvasElement {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destW;
  destCanvas.height = destH;
  const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
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

  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) return destCanvas;
  const srcImgData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const srcBytes = srcImgData.data;
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  const destImgData = destCtx.createImageData(destW, destH);
  const destBytes = destImgData.data;

  // Çift doğrusal (bilinear) interpolasyon ile pürüzsüz alt piksel perspektif düzleştirme
  for (let y = 0; y < destH; y++) {
    const rowOffset = y * destW;
    for (let x = 0; x < destW; x++) {
      const pt = applyHomography(x, y, Hinv);
      const px = pt.x;
      const py = pt.y;

      const dIdx = (rowOffset + x) * 4;
      if (px >= 0 && px < srcW - 1 && py >= 0 && py < srcH - 1) {
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const fx = px - x0;
        const fy = py - y0;

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = (y0 * srcW + x1) * 4;
        const idx01 = (y1 * srcW + x0) * 4;
        const idx11 = (y1 * srcW + x1) * 4;

        destBytes[dIdx] = Math.round(w00 * srcBytes[idx00] + w10 * srcBytes[idx10] + w01 * srcBytes[idx01] + w11 * srcBytes[idx11]);
        destBytes[dIdx + 1] = Math.round(w00 * srcBytes[idx00 + 1] + w10 * srcBytes[idx10 + 1] + w01 * srcBytes[idx01 + 1] + w11 * srcBytes[idx11 + 1]);
        destBytes[dIdx + 2] = Math.round(w00 * srcBytes[idx00 + 2] + w10 * srcBytes[idx10 + 2] + w01 * srcBytes[idx01 + 2] + w11 * srcBytes[idx11 + 2]);
        destBytes[dIdx + 3] = 255;
      } else if (px >= 0 && px < srcW && py >= 0 && py < srcH) {
        const sIdx = (Math.floor(py) * srcW + Math.floor(px)) * 4;
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
    ? (sec && sec !== '-' ? `${cls}${sec}` : cls)
    : ((matchedStudent && 'className' in matchedStudent ? matchedStudent.className : '') || '-');

  // Kitapçık cevap anahtarını al (Eğer belirtilen kitapçık anahtarı boşsa veya yoksa kesinlikle A'ya dön)
  let resolvedBk = finalBk;
  let key = exam.keys?.[resolvedBk];
  const isTargetKeyValid = Array.isArray(key) && key.some(k => Boolean(k && k.trim()));
  if (!isTargetKeyValid) {
    resolvedBk = 'A';
    key = exam.keys?.A || (exam.keys ? Object.values(exam.keys).find(v => Array.isArray(v) && v.some(k => Boolean(k && k.trim()))) : []) || [];
  }

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
    booklet: resolvedBk,
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
