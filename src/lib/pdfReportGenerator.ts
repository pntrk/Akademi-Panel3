import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { Exam, ExamResult } from '../types';

// Register vfs fonts for pdfMake
try {
  if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
  } else if (pdfFonts && (pdfFonts as any).vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
  } else if (pdfFonts) {
    (pdfMake as any).vfs = pdfFonts;
  }
} catch (e) {
  console.warn('pdfMake vfs initialization error:', e);
}

export interface BatchPdfOptions {
  includeQuestionMatrix?: boolean;
  cardsPerPage?: 1 | 2;
  schoolName?: string;
  classFilter?: string;
  onProgress?: (current: number, total: number, statusText: string) => void;
}

export type StudentEvaluatedData = ExamResult & {
  naturalRank?: number;
  evaluatedScore?: {
    total: {
      correct: number;
      wrong: number;
      empty: number;
      net: number;
      lgsScore?: number;
      percentile?: number;
      tytScore?: number;
      aytScore?: number;
    };
    subjectScores?: Record<string | number, {
      correct: number;
      wrong: number;
      empty?: number;
      net: number;
    }>;
  };
};

/**
 * Generates and downloads a colorful, searchable, Turkish-supported multi-student Report Card (Karne) PDF.
 */
export async function generateBatchReportCardsPdf(
  exam: Exam,
  students: StudentEvaluatedData[],
  options: BatchPdfOptions = {}
): Promise<void> {
  const {
    includeQuestionMatrix = true,
    cardsPerPage = 1,
    schoolName = 'T.C. MİLLİ EĞİTİM BAKANLIĞI',
    onProgress
  } = options;

  const totalStudents = students.length;
  if (totalStudents === 0) {
    throw new Error('Karnesi oluşturulacak öğrenci bulunamadı.');
  }

  // Calculate exam subject averages for comparison column
  const subjectAverages: Record<string | number, number> = {};
  if (exam.subjects && exam.subjects.length > 0) {
    exam.subjects.forEach(sub => {
      let totalNet = 0;
      let count = 0;
      students.forEach(st => {
        const ss = st.evaluatedScore?.subjectScores?.[sub.id];
        if (ss && typeof ss.net === 'number') {
          totalNet += ss.net;
          count++;
        }
      });
      subjectAverages[sub.id] = count > 0 ? (totalNet / count) : 0;
    });
  }

  const examTotalNetAvg = students.length > 0
    ? (students.reduce((sum, s) => sum + (s.evaluatedScore?.total?.net || s.net || 0), 0) / students.length)
    : 0;

  const docContent: any[] = [];

  students.forEach((student, index) => {
    if (onProgress) {
      onProgress(index + 1, totalStudents, `${student.name || student.studentName || 'Öğrenci'} karnesi hazırlanıyor...`);
    }

    const rank = student.naturalRank || (index + 1);
    const score = student.evaluatedScore?.total || {
      correct: student.totalCorrect || 0,
      wrong: student.totalWrong || 0,
      empty: student.totalEmpty || 0,
      net: student.net || 0,
      lgsScore: student.lgsScore || 0,
      percentile: student.percentile || 0
    };
    const isLgs = exam.format === 'lgs' || (exam.subjects && exam.subjects.length === 6 && exam.subjects.reduce((s, sub) => s + sub.count, 0) === 90);
    const booklet = student.booklet || 'A';
    const key = exam.keys?.[booklet] || exam.keys?.['A'] || [];

    // --- 1. STUDENT REPORT CARD CONTAINER ---
    const studentCardContent: any[] = [];

    // Header Band
    studentCardContent.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              fillColor: '#1e1b4b', // Deep Indigo
              margin: [10, 8, 10, 8],
              stack: [
                {
                  text: schoolName.toUpperCase(),
                  fontSize: 8.5,
                  bold: true,
                  color: '#c7d2fe',
                  alignment: 'center',
                  characterSpacing: 0.5
                },
                {
                  text: `${exam.name.toUpperCase()} - ÖĞRENCİ SINAV SONUÇ KARNESİ`,
                  fontSize: 12,
                  bold: true,
                  color: '#ffffff',
                  alignment: 'center',
                  margin: [0, 2, 0, 2]
                },
                {
                  text: `Sınav Tarihi: ${exam.date || new Date().toLocaleDateString('tr-TR')} • Toplam Katılımcı: ${totalStudents} Öğrenci`,
                  fontSize: 7.5,
                  color: '#e0e7ff',
                  alignment: 'center'
                }
              ]
            }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    });

    // Student Information Grid & Rank Badge
    studentCardContent.push({
      table: {
        widths: ['*', '*', '*', '*', 'auto'],
        body: [
          [
            {
              fillColor: '#f8fafc',
              border: [true, true, true, true],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [4, 4, 4, 4],
              stack: [
                { text: 'ÖĞRENCİ ADI SOYADI', fontSize: 6.5, color: '#64748b', bold: true },
                { text: (student.name || student.studentName || 'İSİMSİZ').toUpperCase(), fontSize: 9.5, bold: true, color: '#0f172a', margin: [0, 1, 0, 0] }
              ]
            },
            {
              fillColor: '#f8fafc',
              border: [true, true, true, true],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [4, 4, 4, 4],
              stack: [
                { text: 'OKUL NUMARASI', fontSize: 6.5, color: '#64748b', bold: true },
                { text: String(student.no || student.studentNo || '-'), fontSize: 9.5, bold: true, color: '#1e293b', margin: [0, 1, 0, 0] }
              ]
            },
            {
              fillColor: '#f8fafc',
              border: [true, true, true, true],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [4, 4, 4, 4],
              stack: [
                { text: 'SINIF / ŞUBE', fontSize: 6.5, color: '#64748b', bold: true },
                { text: `${student.classStr || '-'}/${student.sectionStr || '-'}`, fontSize: 9.5, bold: true, color: '#1e293b', margin: [0, 1, 0, 0] }
              ]
            },
            {
              fillColor: '#f8fafc',
              border: [true, true, true, true],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [4, 4, 4, 4],
              stack: [
                { text: 'KİTAPÇIK', fontSize: 6.5, color: '#64748b', bold: true },
                { text: `${booklet} Kitapçığı`, fontSize: 9.5, bold: true, color: '#4338ca', margin: [0, 1, 0, 0] }
              ]
            },
            {
              fillColor: '#eff6ff',
              border: [true, true, true, true],
              borderColor: ['#93c5fd', '#93c5fd', '#93c5fd', '#93c5fd'],
              margin: [6, 4, 6, 4],
              stack: [
                { text: 'GENEL DERECE', fontSize: 6.5, color: '#1e40af', bold: true, alignment: 'center' },
                { text: `${rank} / ${totalStudents}`, fontSize: 10, bold: true, color: '#1e3a8a', alignment: 'center', margin: [0, 1, 0, 0] }
              ]
            }
          ]
        ]
      },
      margin: [0, 0, 0, 8]
    });

    // Score KPI Cards (Doğru, Yanlış, Boş, Toplam Net, LGS Puanı, AtaLig LP)
    const kpiCells: any[] = [
      {
        fillColor: '#ecfdf5',
        border: [true, true, true, true],
        borderColor: ['#a7f3d0', '#a7f3d0', '#a7f3d0', '#a7f3d0'],
        margin: [4, 4, 4, 4],
        stack: [
          { text: 'DOĞRU', fontSize: 7, color: '#065f46', bold: true, alignment: 'center' },
          { text: String(score.correct ?? 0), fontSize: 12, bold: true, color: '#047857', alignment: 'center' }
        ]
      },
      {
        fillColor: '#fff1f2',
        border: [true, true, true, true],
        borderColor: ['#fecdd3', '#fecdd3', '#fecdd3', '#fecdd3'],
        margin: [4, 4, 4, 4],
        stack: [
          { text: 'YANLIŞ', fontSize: 7, color: '#9f1239', bold: true, alignment: 'center' },
          { text: String(score.wrong ?? 0), fontSize: 12, bold: true, color: '#e11d48', alignment: 'center' }
        ]
      },
      {
        fillColor: '#f1f5f9',
        border: [true, true, true, true],
        borderColor: ['#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1'],
        margin: [4, 4, 4, 4],
        stack: [
          { text: 'BOŞ', fontSize: 7, color: '#475569', bold: true, alignment: 'center' },
          { text: String(score.empty ?? 0), fontSize: 12, bold: true, color: '#475569', alignment: 'center' }
        ]
      },
      {
        fillColor: '#eff6ff',
        border: [true, true, true, true],
        borderColor: ['#bfdbfe', '#bfdbfe', '#bfdbfe', '#bfdbfe'],
        margin: [4, 4, 4, 4],
        stack: [
          { text: 'TOPLAM NET', fontSize: 7, color: '#1e40af', bold: true, alignment: 'center' },
          { text: (score.net ?? 0).toFixed(2).replace('.', ','), fontSize: 13, bold: true, color: '#1d4ed8', alignment: 'center' }
        ]
      }
    ];

    if (isLgs && typeof score.lgsScore === 'number' && score.lgsScore > 0) {
      kpiCells.push({
        fillColor: '#faf5ff',
        border: [true, true, true, true],
        borderColor: ['#e9d5ff', '#e9d5ff', '#e9d5ff', '#e9d5ff'],
        margin: [4, 4, 4, 4],
        stack: [
          { text: 'LGS PUANI', fontSize: 7, color: '#6b21a8', bold: true, alignment: 'center' },
          { text: score.lgsScore.toFixed(2).replace('.', ','), fontSize: 12, bold: true, color: '#7e22ce', alignment: 'center' }
        ]
      });
      if (typeof score.percentile === 'number' && score.percentile > 0) {
        kpiCells.push({
          fillColor: '#fdf4ff',
          border: [true, true, true, true],
          borderColor: ['#f5d0fe', '#f5d0fe', '#f5d0fe', '#f5d0fe'],
          margin: [4, 4, 4, 4],
          stack: [
            { text: 'GENEL DİLİM', fontSize: 7, color: '#86198f', bold: true, alignment: 'center' },
            { text: `%${score.percentile.toFixed(2).replace('.', ',')}`, fontSize: 12, bold: true, color: '#a21caf', alignment: 'center' }
          ]
        });
      }
    }

    studentCardContent.push({
      table: {
        widths: Array(kpiCells.length).fill('*'),
        body: [kpiCells]
      },
      margin: [0, 0, 0, 9]
    });

    // Subject Performance Table (Ders Dağılımı ve Ortalamalar)
    const subjectTableRows: any[] = [
      [
        { text: 'DERS ADI', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#334155', margin: [4, 3, 4, 3] },
        { text: 'SORU', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#334155', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'DOĞRU', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#059669', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'YANLIŞ', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#e11d48', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'BOŞ', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#64748b', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'ÖĞR. NET', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#2563eb', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'OKUL ORT.', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#475569', alignment: 'center', margin: [2, 3, 2, 3] },
        { text: 'BAŞARI %', fontSize: 7.5, bold: true, color: '#ffffff', fillColor: '#4f46e5', alignment: 'center', margin: [2, 3, 2, 3] }
      ]
    ];

    let totalQCount = 0;

    if (exam.subjects && exam.subjects.length > 0) {
      exam.subjects.forEach((sub, subIdx) => {
        totalQCount += sub.count;
        const ss = student.evaluatedScore?.subjectScores?.[sub.id] || { correct: 0, wrong: 0, empty: sub.count, net: 0 };
        const emptyCount = ss.empty !== undefined ? ss.empty : Math.max(0, sub.count - (ss.correct + ss.wrong));
        const subAvg = subjectAverages[sub.id] || 0;
        const successRate = sub.count > 0 ? Math.max(0, Math.min(100, Math.round((ss.net / sub.count) * 100))) : 0;
        const rowBg = subIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

        subjectTableRows.push([
          { text: sub.name, fontSize: 7.5, bold: true, color: '#1e293b', fillColor: rowBg, margin: [4, 2.5, 4, 2.5] },
          { text: String(sub.count), fontSize: 7.5, alignment: 'center', color: '#64748b', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] },
          { text: String(ss.correct), fontSize: 7.5, bold: true, alignment: 'center', color: '#047857', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] },
          { text: String(ss.wrong), fontSize: 7.5, bold: true, alignment: 'center', color: '#e11d48', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] },
          { text: String(emptyCount), fontSize: 7.5, alignment: 'center', color: '#64748b', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] },
          { text: ss.net.toFixed(2).replace('.', ','), fontSize: 8, bold: true, alignment: 'center', color: '#1d4ed8', fillColor: subIdx % 2 === 0 ? '#eff6ff' : '#dbeafe', margin: [2, 2.5, 2, 2.5] },
          { text: subAvg.toFixed(2).replace('.', ','), fontSize: 7.5, alignment: 'center', color: '#475569', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] },
          { text: `%${successRate}`, fontSize: 7.5, bold: true, alignment: 'center', color: successRate >= 70 ? '#059669' : successRate >= 45 ? '#d97706' : '#dc2626', fillColor: rowBg, margin: [2, 2.5, 2, 2.5] }
        ]);
      });
    }

    // Table Summary Total Row
    const totalSuccessRate = totalQCount > 0 ? Math.max(0, Math.min(100, Math.round((score.net / totalQCount) * 100))) : 0;
    subjectTableRows.push([
      { text: 'GENEL TOPLAM', fontSize: 8, bold: true, color: '#ffffff', fillColor: '#1e293b', margin: [4, 3, 4, 3] },
      { text: String(totalQCount), fontSize: 8, bold: true, color: '#ffffff', fillColor: '#1e293b', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: String(score.correct), fontSize: 8, bold: true, color: '#ffffff', fillColor: '#059669', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: String(score.wrong), fontSize: 8, bold: true, color: '#ffffff', fillColor: '#e11d48', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: String(score.empty), fontSize: 8, bold: true, color: '#ffffff', fillColor: '#475569', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: score.net.toFixed(2).replace('.', ','), fontSize: 8.5, bold: true, color: '#ffffff', fillColor: '#1d4ed8', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: examTotalNetAvg.toFixed(2).replace('.', ','), fontSize: 8, bold: true, color: '#ffffff', fillColor: '#334155', alignment: 'center', margin: [2, 3, 2, 3] },
      { text: `%${totalSuccessRate}`, fontSize: 8, bold: true, color: '#ffffff', fillColor: '#4338ca', alignment: 'center', margin: [2, 3, 2, 3] }
    ]);

    studentCardContent.push({
      table: {
        headerRows: 1,
        widths: ['*', 32, 34, 34, 30, 44, 44, 42],
        body: subjectTableRows
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#cbd5e1'
      },
      margin: [0, 0, 0, 8]
    });

    // Question-by-Question Matrix if answers exist and requested
    if (includeQuestionMatrix && student.answers && student.answers.length > 0 && key.length > 0 && exam.subjects) {
      studentCardContent.push({
        text: 'DETAYLI CEVAP VE KAZANIM ANALİZİ',
        fontSize: 7.5,
        bold: true,
        color: '#475569',
        margin: [0, 2, 0, 4]
      });

      const matrixCols: any[] = [];
      let currentQIdx = 0;

      exam.subjects.forEach(sub => {
        const qRows: any[] = [
          [
            { text: sub.name.toUpperCase(), colSpan: 4, fontSize: 6.5, bold: true, color: '#ffffff', fillColor: '#475569', alignment: 'center', margin: [1, 2, 1, 2] },
            {}, {}, {}
          ],
          [
            { text: '#', fontSize: 6, bold: true, color: '#64748b', fillColor: '#f1f5f9', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: 'D.C', fontSize: 6, bold: true, color: '#64748b', fillColor: '#f1f5f9', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: 'ÖĞR', fontSize: 6, bold: true, color: '#64748b', fillColor: '#f1f5f9', alignment: 'center', margin: [1, 1, 1, 1] },
            { text: 'DUR', fontSize: 6, bold: true, color: '#64748b', fillColor: '#f1f5f9', alignment: 'center', margin: [1, 1, 1, 1] }
          ]
        ];

        for (let q = 0; q < sub.count; q++) {
          const ans = student.answers?.[currentQIdx] || '';
          const correctKey = key[currentQIdx] || '';
          const isCorrect = ans && correctKey && ans === correctKey;
          const isWrong = ans && correctKey && ans !== correctKey;
          const isEmpty = !ans;

          const statusChar = isEmpty ? 'B' : (isCorrect ? 'D' : 'Y');
          const statusBg = isEmpty ? '#f8fafc' : (isCorrect ? '#dcfce7' : '#fee2e2');
          const statusColor = isEmpty ? '#94a3b8' : (isCorrect ? '#15803d' : '#b91c1c');

          qRows.push([
            { text: String(q + 1), fontSize: 6, alignment: 'center', color: '#64748b', margin: [0.5, 0.5, 0.5, 0.5] },
            { text: correctKey || '-', fontSize: 6, bold: true, alignment: 'center', color: '#334155', margin: [0.5, 0.5, 0.5, 0.5] },
            { text: ans || '-', fontSize: 6, bold: true, alignment: 'center', color: isCorrect ? '#15803d' : (isWrong ? '#b91c1c' : '#94a3b8'), margin: [0.5, 0.5, 0.5, 0.5] },
            { text: statusChar, fontSize: 6, bold: true, alignment: 'center', color: statusColor, fillColor: statusBg, margin: [0.5, 0.5, 0.5, 0.5] }
          ]);

          currentQIdx++;
        }

        matrixCols.push({
          width: '*',
          table: {
            widths: [11, 13, 13, 13],
            body: qRows
          },
          layout: {
            hLineWidth: () => 0.3,
            vLineWidth: () => 0.3,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0'
          },
          margin: [0, 0, 2, 0]
        });
      });

      studentCardContent.push({
        columns: matrixCols,
        margin: [0, 0, 0, 6]
      });
    }

    // Karne Alt Bilgilendirme Notu & İmza Alanı
    studentCardContent.push({
      table: {
        widths: ['*', 'auto'],
        body: [
          [
            {
              stack: [
                {
                  text: 'NOT: D = Doğru, Y = Yanlış, B = Boş. Net = Doğru - (Yanlış / Soru Başına Yanlış Katsayısı).',
                  fontSize: 6,
                  color: '#94a3b8',
                  italics: true
                },
                {
                  text: `Bu karne akıllı optik değerlendirme merkezi tarafından ${new Date().toLocaleString('tr-TR')} tarihinde üretilmiştir.`,
                  fontSize: 6,
                  color: '#94a3b8'
                }
              ],
              border: [false, true, false, false],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [0, 4, 0, 0]
            },
            {
              text: 'Okul / Kurum Onayı / Kaşe',
              fontSize: 6.5,
              bold: true,
              color: '#64748b',
              alignment: 'right',
              border: [false, true, false, false],
              borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
              margin: [0, 4, 0, 0]
            }
          ]
        ]
      },
      margin: [0, 4, 0, 0]
    });

    // Add student card to document
    docContent.push({
      stack: studentCardContent,
      pageBreak: (index < totalStudents - 1 && cardsPerPage === 1) ? 'after' : undefined,
      margin: [0, 0, 0, cardsPerPage === 2 && index % 2 === 0 ? 16 : 0]
    });

    if (cardsPerPage === 2 && index % 2 === 1 && index < totalStudents - 1) {
      docContent.push({
        text: '',
        pageBreak: 'after'
      });
    }
  });

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [20, 16, 20, 16],
    defaultStyle: {
      fontSize: 8,
      font: 'Roboto'
    },
    content: docContent,
    info: {
      title: `${exam.name} - Öğrenci Karneleri`,
      author: 'Akıllı Optik Sınav Sistemi',
      subject: `${exam.name} Toplu Öğrenci Sonuç Karneleri`,
      keywords: 'karne, sınav sonucu, optik değerlendirme, lgs, deneme'
    }
  };

  // Trigger download with sanitized filename
  const cleanExamName = (exam.name || 'Sinav').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanExamName}_Ogrenci_Karneleri.pdf`;

  pdfMake.createPdf(docDefinition).download(filename);
}
