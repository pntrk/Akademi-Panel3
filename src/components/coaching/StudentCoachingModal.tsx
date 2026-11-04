import React, { useRef, useState } from 'react';
import { 
  X, 
  Printer, 
  Download,
  Loader2,
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Compass,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Check
} from 'lucide-react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { CoachingReport } from '../../lib/coachEngine';

// Ensure fonts are registered for pdfMake
try {
  if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
  } else if ((pdfFonts as any)?.vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).vfs;
  }
} catch (e) {
  console.warn('pdfMake font init warning:', e);
}

interface Props {
  report: CoachingReport | null;
  onClose: () => void;
}

export const StudentCoachingModal: React.FC<Props> = ({ report, onClose }) => {
  if (!report) return null;

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [selectedOutcomeSubject, setSelectedOutcomeSubject] = useState<string>('all');
  const [showAllOutcomes, setShowAllOutcomes] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    outcomes: true,
    strengthsRisks: true,
    lessons: true,
    tactics: true,
    guidance: true
  });
  const reportContentRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const expandAllSections = () => {
    setOpenSections({
      outcomes: true,
      strengthsRisks: true,
      lessons: true,
      tactics: true,
      guidance: true
    });
  };

  const collapseAllSections = () => {
    setOpenSections({
      outcomes: false,
      strengthsRisks: false,
      lessons: false,
      tactics: false,
      guidance: false
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Ders kırılımlarını kesin tekilleştir (mükerrer gösterim engeli)
  const uniqueLessons = React.useMemo(() => {
    if (!report?.lessons) return [];
    const seen = new Set<string>();
    return report.lessons.filter(l => {
      const key = (l.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [report?.lessons]);

  const hasSchoolAvgInLessons = React.useMemo(() => {
    return uniqueLessons.some(l => typeof l.schoolAvgNet === 'number');
  }, [uniqueLessons]);

  const missingOutcomes = report.monthlyMissingOutcomes || [];
  const outcomeSubjects = React.useMemo(() => {
    const subs = new Set<string>();
    missingOutcomes.forEach(m => {
      if (m.subject) subs.add(m.subject);
    });
    return Array.from(subs);
  }, [missingOutcomes]);

  const filteredMissingOutcomes = React.useMemo(() => {
    if (selectedOutcomeSubject === 'all') return missingOutcomes;
    return missingOutcomes.filter(m => m.subject === selectedOutcomeSubject);
  }, [missingOutcomes, selectedOutcomeSubject]);

  const displayedMissingOutcomes = showAllOutcomes
    ? filteredMissingOutcomes
    : filteredMissingOutcomes.slice(0, 10);

  const comp = report.examComparison;

  const handleDownloadPDF = async () => {
    if (!report || isExportingPDF) return;
    setIsExportingPDF(true);

    try {
      const cleanName = (report.studentName || 'Ogrenci').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '_');
      const filename = `Koc_Rehberlik_Raporu_${cleanName}.pdf`;

      const lessonRows = uniqueLessons.map((l) => [
        { text: l.name, style: 'tableCell' },
        { text: String(l.correct), style: 'tableCellCenter', color: '#047857' },
        { text: String(l.wrong), style: 'tableCellCenter', color: '#dc2626' },
        { text: String(l.empty), style: 'tableCellCenter', color: '#b45309' },
        { text: l.net.toFixed(2), style: 'tableCellCenterBold' },
        { text: l.schoolAvgNet !== undefined ? l.schoolAvgNet.toFixed(2) : '-', style: 'tableCellCenter' },
        {
          text: l.diffFromSchoolAvg !== undefined
            ? `${l.diffFromSchoolAvg >= 0 ? '+' : ''}${l.diffFromSchoolAvg.toFixed(2)}`
            : '-',
          style: 'tableCellCenterBold',
          color: (l.diffFromSchoolAvg || 0) >= 0 ? '#047857' : '#dc2626'
        },
        { text: `%${l.accuracy}`, style: 'tableCellRight' },
      ]);

      const missingOutcomeRows = missingOutcomes.slice(0, 20).map((m) => {
        const qList = m.questionRefs.map(q => `S.${q.questionNumber} (${q.status === 'wrong' ? 'Y' : 'B'})`).join(', ');
        return [
          { text: m.subject, style: 'tableCell' },
          { text: m.code, style: 'tableCellCenterBold', color: '#4338ca' },
          { text: qList, style: 'tableCellCenter' },
          { text: m.title, style: 'tableCell' },
          { text: m.diagnosisLabel, style: 'tableCell', color: m.priority === 'critical' ? '#be123c' : '#b45309' }
        ];
      });

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [28, 24, 28, 24],
        content: [
          // Banner
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: '#0f172a',
                    padding: [10, 8, 10, 8],
                    stack: [
                      { text: 'AKADEMİ ARENA - AI KOÇ & NOKTA ATIŞI REHBERLİK RAPORU', style: 'bannerTitle' },
                      { text: `${report.periodLabel || 'Dönem Analizi'} • Eksik Kazanım Teşhisi, Ortalamalar Kıyaslaması ve Eylem Planı`, style: 'bannerSubtitle' }
                    ]
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 8]
          },

          // Student Header Card
          {
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  {
                    stack: [
                      { text: report.studentName, style: 'studentName' },
                      {
                        text: [
                          report.className ? `Sınıf: ${report.className}   ` : '',
                          report.studentNo ? `No: ${report.studentNo}   ` : '',
                          `Takım: ${report.team}`
                        ],
                        style: 'studentMeta'
                      },
                      {
                        text: [
                          `Arena Sırası: #${report.rank} / ${report.totalStudents}   |   Toplam: ${report.leaguePoints} LP`,
                          comp?.examRank && comp?.examParticipantCount
                            ? `   |   Sınav Sırası: #${comp.examRank} / ${comp.examParticipantCount} (%${comp.examPercentile})`
                            : ''
                        ],
                        style: 'studentSubMeta'
                      }
                    ]
                  },
                  {
                    alignment: 'right',
                    stack: [
                      { text: 'SON DENEME PUANI', style: 'scoreLabel' },
                      { text: report.score > 0 ? report.score.toFixed(2) : '-', style: 'scoreValue' },
                      { text: `Net: ${report.totalNet.toFixed(2)} (${report.totalCorrect}D / ${report.totalWrong}Y / ${report.totalEmpty}B)`, style: 'netValue' }
                    ]
                  }
                ]
              ]
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => '#e2e8f0',
              vLineColor: () => '#e2e8f0',
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 7,
              paddingBottom: () => 7
            },
            margin: [0, 0, 0, 8]
          },

          // Averages Comparison Bar
          ...(comp ? [
            {
              table: {
                widths: ['*', '*', '*', '*'],
                body: [
                  [
                    {
                      fillColor: '#f8fafc',
                      padding: [6, 5, 6, 5],
                      stack: [
                        { text: 'SON SINAV SONUCU', fontSize: 7, bold: true, color: '#64748b' },
                        { text: `${report.score.toFixed(2)} Puan / ${report.totalNet.toFixed(2)} Net`, fontSize: 8.5, bold: true, color: '#0f172a', margin: [0, 2, 0, 0] }
                      ]
                    },
                    {
                      fillColor: '#f8fafc',
                      padding: [6, 5, 6, 5],
                      stack: [
                        { text: 'OKUL ORTALAMASI', fontSize: 7, bold: true, color: '#64748b' },
                        {
                          text: comp.schoolAvgScore > 0
                            ? `${comp.schoolAvgScore.toFixed(2)} P / ${comp.schoolAvgNet.toFixed(2)} N (${comp.scoreDiffFromSchool >= 0 ? '+' : ''}${comp.scoreDiffFromSchool.toFixed(1)})`
                            : 'Veri Yok',
                          fontSize: 8.5,
                          bold: true,
                          color: comp.scoreDiffFromSchool >= 0 ? '#047857' : '#dc2626',
                          margin: [0, 2, 0, 0]
                        }
                      ]
                    },
                    {
                      fillColor: '#f8fafc',
                      padding: [6, 5, 6, 5],
                      stack: [
                        { text: `${report.className || 'SINIF'} ORTALAMASI`, fontSize: 7, bold: true, color: '#64748b' },
                        {
                          text: comp.classAvgScore > 0
                            ? `${comp.classAvgScore.toFixed(2)} P / ${comp.classAvgNet.toFixed(2)} N (${comp.scoreDiffFromClass >= 0 ? '+' : ''}${comp.scoreDiffFromClass.toFixed(1)})`
                            : '-',
                          fontSize: 8.5,
                          bold: true,
                          color: comp.scoreDiffFromClass >= 0 ? '#047857' : '#dc2626',
                          margin: [0, 2, 0, 0]
                        }
                      ]
                    },
                    {
                      fillColor: '#f8fafc',
                      padding: [6, 5, 6, 5],
                      stack: [
                        { text: 'ÖĞRENCİ DÖNEM ORT.', fontSize: 7, bold: true, color: '#64748b' },
                        {
                          text: `${comp.studentPeriodAvgScore.toFixed(2)} P / ${comp.studentPeriodAvgNet.toFixed(2)} N`,
                          fontSize: 8.5,
                          bold: true,
                          color: '#1d4ed8',
                          margin: [0, 2, 0, 0]
                        }
                      ]
                    }
                  ]
                ]
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#cbd5e1',
                vLineColor: () => '#cbd5e1'
              },
              margin: [0, 0, 0, 10]
            }
          ] : []),

          // Strengths & Risks Columns
          {
            columnGap: 10,
            columns: [
              {
                width: '*',
                stack: [
                  { text: '🌟 GÜÇLÜ YÖNLER & AVANTAJLAR', style: 'sectionHeaderGreen' },
                  ...report.strengths.map(s => ({
                    margin: [0, 0, 0, 5],
                    stack: [
                      { text: `${s.icon || '⭐'} ${s.title}`, style: 'itemTitle' },
                      { text: s.desc, style: 'itemDesc' }
                    ]
                  }))
                ]
              },
              {
                width: '*',
                stack: [
                  { text: '⚠️ RİSKLİ ALANLAR & NOKTA ATIŞI TESPİTLER', style: 'sectionHeaderAmber' },
                  ...report.risks.map(r => ({
                    margin: [0, 0, 0, 5],
                    stack: [
                      { text: `${r.icon || '⚠️'} ${r.title}`, style: 'itemTitle' },
                      { text: r.desc, style: 'itemDesc' }
                    ]
                  }))
                ]
              }
            ],
            margin: [0, 0, 0, 10]
          },

          // Missing Learning Outcomes Table (if available)
          ...(missingOutcomeRows.length > 0 ? [
            {
              text: `🎯 AYLIK EKSİK / KAVRANMAMIŞ KAZANIM RAPORU (Toplam ${missingOutcomes.length} Eksik Kazanım • Kavrama: %${report.overallMasteryPercentage ?? 0})`,
              style: 'sectionHeaderPurple'
            },
            {
              table: {
                headerRows: 1,
                widths: [58, 48, 52, '*', 95],
                body: [
                  [
                    { text: 'Ders', style: 'tableHeader' },
                    { text: 'Kod', style: 'tableHeaderCenter' },
                    { text: 'Soru (Drm)', style: 'tableHeaderCenter' },
                    { text: 'Eksik Kazanım Açıklaması', style: 'tableHeader' },
                    { text: 'Koç Teşhisi', style: 'tableHeader' }
                  ],
                  ...missingOutcomeRows
                ]
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 10]
            }
          ] : []),

          // Lesson Report Table
          ...(uniqueLessons.length > 0 ? [
            { text: '📊 DERS KARNESİ VE OKUL ORTALAMASI KIYASLAMASI', style: 'sectionHeader' },
            {
              table: {
                headerRows: 1,
                widths: ['*', 26, 26, 26, 38, 42, 42, 38],
                body: [
                  [
                    { text: 'Ders', style: 'tableHeader' },
                    { text: 'D', style: 'tableHeaderCenter' },
                    { text: 'Y', style: 'tableHeaderCenter' },
                    { text: 'B', style: 'tableHeaderCenter' },
                    { text: 'Net', style: 'tableHeaderCenter' },
                    { text: 'Okul Ort.', style: 'tableHeaderCenter' },
                    { text: 'Fark', style: 'tableHeaderCenter' },
                    { text: 'İsabet', style: 'tableHeaderRight' }
                  ],
                  ...lessonRows,
                  [
                    { text: 'TOPLAM', style: 'tableHeaderBold' },
                    { text: String(report.totalCorrect), style: 'tableHeaderCenterBold' },
                    { text: String(report.totalWrong), style: 'tableHeaderCenterBold' },
                    { text: String(report.totalEmpty), style: 'tableHeaderCenterBold' },
                    { text: report.totalNet.toFixed(2), style: 'tableHeaderCenterBold' },
                    { text: comp && comp.schoolAvgNet > 0 ? comp.schoolAvgNet.toFixed(2) : '-', style: 'tableHeaderCenterBold' },
                    {
                      text: comp && comp.schoolAvgNet > 0
                        ? `${comp.netDiffFromSchool >= 0 ? '+' : ''}${comp.netDiffFromSchool.toFixed(2)}`
                        : '-',
                      style: 'tableHeaderCenterBold'
                    },
                    {
                      text: report.totalCorrect + report.totalWrong > 0
                        ? `%${Math.round((report.totalCorrect / (report.totalCorrect + report.totalWrong)) * 100)}`
                        : '-',
                      style: 'tableHeaderRightBold'
                    }
                  ]
                ]
              },
              layout: 'lightHorizontalLines',
              margin: [0, 0, 0, 10]
            }
          ] : []),

          // 3 Step Action Plan
          {
            stack: [
              { text: '🚀 BİR SONRAKİ DENEME İÇİN 3 MADDELİK EYLEM PLANI', style: 'sectionHeaderBlue' },
              ...report.tactics.map(t => ({
                margin: [0, 0, 0, 5],
                stack: [
                  { text: `Adım ${t.step}: ${t.title}`, style: 'tacticTitle' },
                  { text: t.action, style: 'tacticDesc' }
                ]
              }))
            ],
            margin: [0, 0, 0, 10]
          },

          // Guidance Prescription & Coach Note
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: '#f1f5f9',
                    padding: [8, 8, 8, 8],
                    stack: [
                      { text: '🧭 REHBERLİK SERVİSİ NOKTA ATIŞI YÖNLENDİRME & DEĞERLENDİRME', style: 'coachHeader' },
                      ...(report.guidancePrescription || []).map(gp => ({
                        margin: [0, 2, 0, 4],
                        stack: [
                          { text: `${gp.icon} ${gp.title}`, fontSize: 8.5, bold: true, color: '#0f172a' },
                          ...gp.bullets.map(b => ({ text: `• ${b}`, fontSize: 7.8, color: '#334155', margin: [6, 1, 0, 0] }))
                        ]
                      })),
                      { text: report.coachSummary, style: 'coachText', margin: [0, 4, 0, 0] }
                    ]
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 6]
          }
        ],

        footer: (currentPage: number, pageCount: number) => ({
          text: `Akademi Arena AI Rehberlik & Kazanım Analiz Sistemi • 2026 LGS Projeksiyonu  |  Sayfa ${currentPage} / ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#94a3b8',
          margin: [0, 8, 0, 0]
        }),

        styles: {
          bannerTitle: { fontSize: 12, bold: true, color: '#f59e0b', alignment: 'center' },
          bannerSubtitle: { fontSize: 8, color: '#cbd5e1', alignment: 'center', margin: [0, 2, 0, 0] },
          studentName: { fontSize: 13, bold: true, color: '#0f172a' },
          studentMeta: { fontSize: 8.5, color: '#475569', margin: [0, 2, 0, 0] },
          studentSubMeta: { fontSize: 8, bold: true, color: '#1e293b', margin: [0, 2, 0, 0] },
          scoreLabel: { fontSize: 7.5, bold: true, color: '#64748b' },
          scoreValue: { fontSize: 14, bold: true, color: '#6d28d9' },
          netValue: { fontSize: 8.5, bold: true, color: '#0f172a' },
          sectionHeaderGreen: { fontSize: 9.5, bold: true, color: '#047857', margin: [0, 0, 0, 4] },
          sectionHeaderAmber: { fontSize: 9.5, bold: true, color: '#b45309', margin: [0, 0, 0, 4] },
          sectionHeaderBlue: { fontSize: 9.5, bold: true, color: '#1d4ed8', margin: [0, 0, 0, 4] },
          sectionHeaderPurple: { fontSize: 9.5, bold: true, color: '#4338ca', margin: [0, 0, 0, 4] },
          sectionHeader: { fontSize: 9.5, bold: true, color: '#0f172a', margin: [0, 0, 0, 4] },
          itemTitle: { fontSize: 8.2, bold: true, color: '#0f172a' },
          itemDesc: { fontSize: 7.8, color: '#334155', margin: [0, 1, 0, 0] },
          tacticTitle: { fontSize: 8.2, bold: true, color: '#1e1b4b' },
          tacticDesc: { fontSize: 7.8, color: '#334155', margin: [0, 1, 0, 0] },
          tableHeader: { fontSize: 8, bold: true, color: '#0f172a' },
          tableHeaderCenter: { fontSize: 8, bold: true, color: '#0f172a', alignment: 'center' },
          tableHeaderRight: { fontSize: 8, bold: true, color: '#0f172a', alignment: 'right' },
          tableHeaderBold: { fontSize: 8, bold: true, color: '#0f172a' },
          tableHeaderCenterBold: { fontSize: 8, bold: true, color: '#0f172a', alignment: 'center' },
          tableHeaderRightBold: { fontSize: 8, bold: true, color: '#0f172a', alignment: 'right' },
          tableCell: { fontSize: 7.5, color: '#0f172a' },
          tableCellCenter: { fontSize: 7.5, alignment: 'center' },
          tableCellCenterBold: { fontSize: 7.5, bold: true, color: '#0f172a', alignment: 'center' },
          tableCellRight: { fontSize: 7.5, alignment: 'right', color: '#334155' },
          coachHeader: { fontSize: 9, bold: true, color: '#b45309', margin: [0, 0, 0, 4] },
          coachText: { fontSize: 8, bold: true, color: '#1e293b' }
        },
        defaultStyle: {
          font: 'Roboto'
        }
      };

      pdfMake.createPdf(docDefinition).download(filename);
    } catch (err) {
      console.warn('PDF export failed, using print dialog:', err);
      window.print();
    } finally {
      setIsExportingPDF(false);
    }
  };

  const isKutup = report.team === 'Kutup Yıldızları';
  const isSicrama = report.team === 'Sıçrama Ustaları';

  const teamBg = isKutup 
    ? 'from-amber-500/15 to-amber-600/5 text-amber-950 border-amber-300' 
    : isSicrama 
    ? 'from-blue-500/15 to-blue-600/5 text-blue-950 border-blue-300' 
    : 'from-emerald-500/15 to-emerald-600/5 text-emerald-950 border-emerald-300';

  const teamBadgeColor = isKutup 
    ? 'bg-amber-100 text-amber-900 border-amber-300' 
    : isSicrama 
    ? 'bg-blue-100 text-blue-900 border-blue-300' 
    : 'bg-emerald-100 text-emerald-900 border-emerald-300';

  return (
    <div id="coaching-report-printable" className="fixed inset-0 z-[120] flex items-center justify-center p-1.5 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:z-auto">
      <div 
        className="relative w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-brand-border/90 flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Başlık & Kontrol Çubuğu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 print:bg-white print:text-black print:border-b-2 print:border-slate-800 print:px-0 gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center text-base sm:text-xl font-black shadow-md shrink-0 print:bg-slate-200">
              🎯
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-xs sm:text-lg font-bold font-serif tracking-tight truncate">
                  Akademi Arena AI Koç & Rehberlik Analizi
                </h2>
                {report.periodLabel && (
                  <span className="text-[9.5px] sm:text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                    {report.periodLabel}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-white/70 print:text-slate-600 font-medium truncate">
                Aylık Eksik Kazanım Raporu, Okul/Sınıf Ortalamaları Kıyaslaması ve Nokta Atışı Rehberlik Yönlendirmesi
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 print:hidden self-end sm:self-auto">
            <button
              type="button"
              disabled={isExportingPDF}
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 sm:px-3.5 sm:py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Rehberlik Raporunu doğrudan PDF dosyası olarak indir"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span>İndiriliyor...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                  <span>PDF İndir</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Rehberlik Raporunu Yazdır"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Yazdır</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Kaydırılabilir İçerik Alanı */}
        <div ref={reportContentRef} className="p-2.5 sm:p-5 md:p-6 overflow-y-auto space-y-3 sm:space-y-5 custom-scrollbar print:p-0 print:overflow-visible print:space-y-4 bg-white">
          
          {/* 1. Öğrenci Kimlik, Sınav Özeti ve Ortalamalar Kıyaslama Kartı */}
          <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border bg-gradient-to-br ${teamBg} print:bg-white print:border-slate-300 shadow-xs space-y-3.5`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-3.5 border-b border-black/10 print:border-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-brand-ink font-serif font-black text-xl flex items-center justify-center shadow-xs border border-brand-border shrink-0">
                  {report.studentName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-xl font-bold font-serif text-brand-ink">
                      {report.studentName}
                    </h3>
                    {report.className && (
                      <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-white/90 border border-brand-border/60 text-brand-ink/70">
                        {report.className}
                      </span>
                    )}
                    {report.studentNo && (
                      <span className="text-[10px] text-brand-ink/50 font-medium">
                        (No: {report.studentNo})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs font-semibold text-brand-ink/75">
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1 ${teamBadgeColor}`}>
                      <span>{isKutup ? '⭐' : isSicrama ? '🚀' : '🛡️'}</span>
                      <span>{report.team}</span>
                    </span>
                    <span>•</span>
                    <span>Arena Sırası: <strong className="text-brand-ink">#{report.rank}</strong> / {report.totalStudents}</span>
                    {comp?.examRank && comp?.examParticipantCount && (
                      <>
                        <span>•</span>
                        <span>Sınav Sırası: <strong className="text-indigo-900">#{comp.examRank}</strong> / {comp.examParticipantCount} <span className="text-indigo-700 font-bold">(% {comp.examPercentile})</span></span>
                      </>
                    )}
                    <span>•</span>
                    <span>Toplam: <strong className="text-emerald-800 font-mono">{report.leaguePoints} LP</strong></span>
                  </div>
                </div>
              </div>

              {/* Son Sınav Puanı ve Trend Göstergesi */}
              <div className="flex items-center gap-3 self-start md:self-auto bg-white/95 border border-brand-border/80 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 shadow-2xs">
                <div className="text-right">
                  <p className="text-[9.5px] font-bold text-brand-ink/50 uppercase tracking-wider">Son LGS Puanı</p>
                  <p className="text-lg sm:text-2xl font-black text-purple-700 font-mono tabular-nums leading-none">
                    {report.score > 0 ? report.score.toFixed(2) : '-'}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-[9.5px] font-bold text-brand-ink/50 uppercase tracking-wider">Toplam Net</p>
                  <p className="text-base sm:text-lg font-bold text-brand-ink font-mono tabular-nums leading-none">
                    {report.totalNet.toFixed(2)}
                  </p>
                </div>
                {report.trend !== 'first' && (
                  <>
                    <div className="h-8 w-px bg-slate-200" />
                    <div className="flex items-center gap-1 text-xs font-bold">
                      {report.trend === 'up' && (
                        <span className="text-emerald-700 flex items-center gap-0.5" title="Önceki sınava göre puan artışı">
                          <TrendingUp className="w-4 h-4" /> +{report.trendDifference}
                        </span>
                      )}
                      {report.trend === 'down' && (
                        <span className="text-rose-600 flex items-center gap-0.5" title="Önceki sınava göre puan değişimi">
                          <TrendingDown className="w-4 h-4" /> -{report.trendDifference}
                        </span>
                      )}
                      {report.trend === 'steady' && (
                        <span className="text-slate-500 flex items-center gap-0.5" title="Dengeli seyir">
                          <Minus className="w-4 h-4" /> Dengeli
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sınav Adı ve Soru Dağılım Çubuğu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-brand-ink/75 font-medium">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                <span className="truncate"><strong>Baz Alınan Son Sınav:</strong> {report.examName} {report.examDate ? `(${report.examDate})` : ''}</span>
              </div>
              <div className="flex items-center gap-2.5 font-mono text-[11px] shrink-0 bg-white/80 px-3 py-1 rounded-xl border border-black/5">
                <span className="text-emerald-700 font-bold">Doğru: {report.totalCorrect}</span>
                <span className="text-rose-600 font-bold">Yanlış: {report.totalWrong}</span>
                <span className="text-amber-700 font-bold">Boş: {report.totalEmpty}</span>
                <span className="text-brand-ink font-black">Net: {report.totalNet.toFixed(2)}</span>
              </div>
            </div>

            {/* Detaylı Ortalamalar Kıyaslama Bantları (Okul Ort, Sınıf Ort, Dönem Ort, Kazanım Kavrama) */}
            {comp && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-white/90 border border-black/10 rounded-xl p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-brand-ink/55 uppercase">
                    <span>Okul Ortalaması Kıyas</span>
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  {comp.schoolAvgScore > 0 ? (
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-xs sm:text-sm font-black font-mono text-brand-ink">
                          {comp.schoolAvgScore.toFixed(1)} P / {comp.schoolAvgNet.toFixed(1)} N
                        </span>
                        <span className={`text-[11px] font-extrabold font-mono px-1.5 py-0.2 rounded ${
                          comp.scoreDiffFromSchool >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {comp.scoreDiffFromSchool >= 0 ? '+' : ''}{comp.scoreDiffFromSchool.toFixed(1)} P
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-ink/60 mt-0.5">
                        Net Farkı: <strong className={comp.netDiffFromSchool >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {comp.netDiffFromSchool >= 0 ? '+' : ''}{comp.netDiffFromSchool.toFixed(2)} Net
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-brand-ink/50 mt-1">Tekil Öğrenci Verisi</p>
                  )}
                </div>

                <div className="bg-white/90 border border-black/10 rounded-xl p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-brand-ink/55 uppercase">
                    <span>{report.className ? `${report.className} Sınıf Ort.` : 'Sınıf Ortalaması'}</span>
                    <span className="text-[10px] font-bold text-amber-700">
                      {comp.classRank && comp.classParticipantCount ? `#${comp.classRank}/${comp.classParticipantCount}` : ''}
                    </span>
                  </div>
                  {comp.classAvgScore > 0 ? (
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-xs sm:text-sm font-black font-mono text-brand-ink">
                          {comp.classAvgScore.toFixed(1)} P / {comp.classAvgNet.toFixed(1)} N
                        </span>
                        <span className={`text-[11px] font-extrabold font-mono px-1.5 py-0.2 rounded ${
                          comp.scoreDiffFromClass >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {comp.scoreDiffFromClass >= 0 ? '+' : ''}{comp.scoreDiffFromClass.toFixed(1)} P
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-ink/60 mt-0.5">
                        Sınıf Net Farkı: <strong className={comp.netDiffFromClass >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {comp.netDiffFromClass >= 0 ? '+' : ''}{comp.netDiffFromClass.toFixed(2)} Net
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-brand-ink/50 mt-1">Sınıf Karşılaştırması Yok</p>
                  )}
                </div>

                <div className="bg-white/90 border border-black/10 rounded-xl p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-brand-ink/55 uppercase">
                    <span>Öğrenci Dönem Ort.</span>
                    <span className="text-[10px] font-bold text-blue-700">{comp.periodExamCount} Deneme</span>
                  </div>
                  <div className="mt-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs sm:text-sm font-black font-mono text-blue-900">
                        {comp.studentPeriodAvgScore.toFixed(1)} P / {comp.studentPeriodAvgNet.toFixed(1)} N
                      </span>
                    </div>
                    <p className="text-[10px] text-brand-ink/60 mt-0.5">
                      Genel Ort ({comp.totalExamCount} Sınav): <strong>{comp.studentAllTimeAvgScore.toFixed(1)} P</strong>
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 border border-black/10 rounded-xl p-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-brand-ink/55 uppercase">
                    <span>Kazanım Hakimiyeti</span>
                    <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  {report.hasKazanimData ? (
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-xs sm:text-sm font-black font-mono text-purple-800">
                          %{report.overallMasteryPercentage} Kavrama
                        </span>
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                          {missingOutcomes.length} Eksik Konu
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-ink/60 mt-0.5">
                        {report.totalMeasuredQuestions} Soruda <strong>{report.totalMasteredQuestions} Doğru Kazanım</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] font-medium text-brand-ink/50 mt-1">
                      Kazanım anahtarı yüklenmedi
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* İntaktif Akordeon Kontrol Çubuğu */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 bg-indigo-50/80 border border-indigo-100/90 rounded-2xl print:hidden text-xs gap-2">
            <div className="flex items-center gap-2 font-bold text-indigo-950">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-[11.5px] sm:text-xs">Dokunarak Detay Açılan Görünüm (Akordeon Modu)</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold self-end sm:self-auto">
              <button
                type="button"
                onClick={expandAllSections}
                className="px-2.5 py-1 rounded-xl bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100/70 active:scale-95 transition-all shadow-2xs cursor-pointer text-[11px]"
              >
                Tümünü Genişlet
              </button>
              <button
                type="button"
                onClick={collapseAllSections}
                className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs cursor-pointer text-[11px]"
              >
                Tümünü Daralt
              </button>
            </div>
          </div>
          {/* Güçlü Yönler ve Riskli Alanlar Akordeon Kartı */}
          <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/40 border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('strengthsRisks')}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8.5 h-8.5 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                  🌟
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-base font-bold text-slate-900">
                      Güçlü Yönler & Nokta Atışı Riskli Alanlar
                    </h4>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {report.strengths.length} Güçlü Yön
                    </span>
                    <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full">
                      {report.risks.length} Risk Tespiti
                    </span>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium truncate">
                    {openSections.strengthsRisks ? 'Detayları gizlemek için dokunun' : 'Dokunarak öğrencinin avantajlarını ve risk tespiti detaylarını açın'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                  {openSections.strengthsRisks ? 'Gizle' : 'Detayı Gör'}
                </span>
                <div className="p-1 rounded-lg bg-slate-100 text-slate-800 group-hover:bg-slate-200 transition-colors">
                  {openSections.strengthsRisks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            <div className={`${openSections.strengthsRisks ? 'block' : 'hidden'} print:block pt-2 border-t border-slate-200/60 animate-in fade-in duration-150`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                
                {/* Güçlü Yönler */}
                <div className="bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shadow-2xs">
                        🌟
                      </div>
                      <h4 className="text-sm font-bold text-emerald-950">Güçlü Yönler & Ortalamalar Üstünlüğü</h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {report.strengths.length} Tespit
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {report.strengths.map((item, idx) => (
                      <div key={idx} className="bg-white/95 border border-emerald-100 rounded-xl p-3 shadow-2xs flex items-start gap-2.5">
                        <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-emerald-950">{item.title}</p>
                            {item.tag && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-emerald-900/80 leading-relaxed mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Riskli Alanlar & Dikkat Noktaları */}
                <div className="bg-gradient-to-b from-amber-50/70 via-white to-orange-50/30 border border-amber-200/90 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold shadow-2xs">
                        ⚠️
                      </div>
                      <h4 className="text-sm font-bold text-amber-950">Nokta Atışı Risk & Kazanım Kaybı Tespitleri</h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                      {report.risks.length} Kritik Tespit
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {report.risks.map((item, idx) => (
                      <div key={idx} className="bg-white/95 border border-amber-100 rounded-xl p-3 shadow-2xs flex items-start gap-2.5">
                        <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-amber-950">{item.title}</p>
                            {item.tag && (
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/60">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-amber-900/80 leading-relaxed mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* 3. AYLIK / DÖNEMLİK EKSİK KAZANIMLAR & KOÇ TAVSİYELERİ TEŞHİS RAPORU */}
          <div className="bg-gradient-to-br from-purple-50/90 via-white to-indigo-50/60 border border-purple-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('outcomes')}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8.5 h-8.5 rounded-xl bg-purple-700 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                  🎯
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-base font-bold text-purple-950">
                      Kazanım Odaklı Koç Tavsiyeleri & Hata Reçetesi
                    </h4>
                    {missingOutcomes.length > 0 ? (
                      <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                        {missingOutcomes.length} Eksik Kazanım
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Tam Hakimiyet
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-purple-900/65 font-medium truncate">
                    {openSections.outcomes ? 'Detayları gizlemek için dokunun' : 'Dokunarak tüm eksik kazanımları ve telafi reçetesini açın'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                  {openSections.outcomes ? 'Gizle' : 'Detayı Gör'}
                </span>
                <div className="p-1 rounded-lg bg-purple-100 text-purple-800 group-hover:bg-purple-200 transition-colors">
                  {openSections.outcomes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            <div className={`${openSections.outcomes ? 'block' : 'hidden'} print:block space-y-3.5 pt-2 border-t border-purple-200/60 animate-in fade-in duration-150`}>
              {report.subjectOutcomeSummaries && report.subjectOutcomeSummaries.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pb-1">
                  {report.subjectOutcomeSummaries.map((s, idx) => (
                    <span
                      key={idx}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                        s.masteryPercentage >= 85
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : s.masteryPercentage >= 70
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {s.subject.split(' ')[0]}: %{s.masteryPercentage}
                    </span>
                  ))}
                </div>
              )}

            {missingOutcomes.length > 0 ? (
              <>
                {/* ⚡ NOKTA ATIŞI HIZLI KOÇ TAVSİYE ÖZETİ BANNER'I */}
                <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white shadow-md space-y-2 border border-purple-800/80">
                  <div className="flex items-center justify-between border-b border-purple-800/70 pb-2 flex-wrap gap-1.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <h5 className="text-xs sm:text-sm font-black text-amber-300 tracking-tight">
                        ⚡ Nokta Atış Hızlı Koç Özeti (Öncelikli Eylem Adımları)
                      </h5>
                    </div>
                    <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full">
                      Özet Telafi Reçetesi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-0.5">
                    {/* 1. Kritik Telafi */}
                    {(() => {
                      const criticalItem = missingOutcomes.find(m => m.priority === 'critical') || missingOutcomes[0];
                      return criticalItem ? (
                        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/15 space-y-1">
                          <p className="text-[10px] font-black text-rose-300 flex items-center gap-1">
                            <span>🎯 1. Öncelikli Telafi:</span>
                            <span className="truncate font-mono text-[9.5px] bg-rose-950/60 text-rose-200 px-1 rounded">{criticalItem.subject} {criticalItem.code}</span>
                          </p>
                          <p className="text-[11px] font-bold text-slate-100 line-clamp-1 leading-snug">
                            {criticalItem.title}
                          </p>
                          <p className="text-[10.5px] text-amber-300 font-extrabold pt-0.5">
                            💡 15 dk konu tekrarı + 20 yeni nesil soru
                          </p>
                        </div>
                      ) : null;
                    })()}

                    {/* 2. Çeldirici / Dikkatsizlik veya İkinci Kritik Eylem */}
                    {(() => {
                      const attItem = missingOutcomes.find(m => m.diagnosisType === 'dikkat_veya_kavram' || m.priority === 'high') || missingOutcomes[1] || missingOutcomes[0];
                      return attItem ? (
                        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/15 space-y-1">
                          <p className="text-[10px] font-black text-amber-300 flex items-center gap-1">
                            <span>🎯 2. Çeldirici & Taktik:</span>
                            <span className="truncate font-mono text-[9.5px] bg-amber-950/60 text-amber-200 px-1 rounded">{attItem.subject} {attItem.code}</span>
                          </p>
                          <p className="text-[11px] font-bold text-slate-100 line-clamp-1 leading-snug">
                            {attItem.title}
                          </p>
                          <p className="text-[10.5px] text-amber-200 font-extrabold pt-0.5">
                            💡 Soru kökünü yuvarlak içine al, ilk şıkka atlama
                          </p>
                        </div>
                      ) : null;
                    })()}

                    {/* 3. Haftalık Genel Reçete */}
                    <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/15 space-y-1">
                      <p className="text-[10px] font-black text-emerald-300 flex items-center gap-1">
                        <span>🎯 3. Çalışma Dozu:</span>
                      </p>
                      <p className="text-[11px] font-bold text-slate-100 line-clamp-1 leading-snug">
                        Toplam {missingOutcomes.length} eksik kazanım tespiti
                      </p>
                      <p className="text-[10.5px] text-emerald-200 font-extrabold pt-0.5">
                        💡 Günlük 25 dk odaklı test + Öğretmen analizi
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ders Filtre Sekmeleri */}
                {outcomeSubjects.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap print:hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedOutcomeSubject('all')}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedOutcomeSubject === 'all'
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'bg-white text-brand-ink/70 border border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      Tümü ({missingOutcomes.length})
                    </button>
                    {outcomeSubjects.map(sub => {
                      const count = missingOutcomes.filter(m => m.subject === sub).length;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSelectedOutcomeSubject(sub)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            selectedOutcomeSubject === sub
                              ? 'bg-purple-700 text-white shadow-2xs'
                              : 'bg-white text-brand-ink/70 border border-purple-200 hover:bg-purple-50'
                          }`}
                        >
                          {sub} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Eksik Kazanım Kartları Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayedMissingOutcomes.map((item, idx) => {
                    const isCritical = item.priority === 'critical';
                    const isAttention = item.diagnosisType === 'dikkat_veya_kavram';
                    const isEmpty = item.emptyCount > 0 && item.wrongCount === 0;
                    const qListStr = item.questionRefs
                      .map(q => `Soru ${q.questionNumber} (${q.status === 'wrong' ? `${q.studentAnswer}➔${q.correctAnswer}` : 'Boş'})`)
                      .join(' • ');

                    const coachActionSteps = isCritical
                      ? ['15 dk Konu Tekrarı', '20 Yeni Nesil Soru', 'Yanlış Soruyu Öğretmenle İncele']
                      : isAttention
                      ? ['Soru Kökünü Dikkatle Oku', 'Çeldirici Şıkkı Ele', '15 Pekiştirme Sorusu']
                      : isEmpty
                      ? ['Çözüm Videosunu İzle', 'Örnek Çözümü İncele', '15 Kavrama Sorusu']
                      : ['20 Soruluk Pekiştirme Testi', 'Yapılamayan Soruları Etütte Analiz Et'];

                    return (
                      <div
                        key={`${item.code}-${idx}`}
                        className={`rounded-2xl p-3.5 border bg-white shadow-2xs flex flex-col justify-between gap-2.5 ${
                          isCritical
                            ? 'border-rose-300 ring-1 ring-rose-200/70'
                            : isAttention
                            ? 'border-amber-200/90'
                            : 'border-purple-200/80'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-200">
                                {item.subject}
                              </span>
                              <span className="text-[10.5px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/70">
                                {item.code}
                              </span>
                            </div>
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full border ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : isAttention
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {item.diagnosisLabel}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-brand-ink leading-snug">
                            {item.title}
                          </p>

                          <p className="text-[11px] text-brand-ink/70 leading-relaxed">
                            {item.diagnosisNote}
                          </p>

                          {/* ÖNE ÇIKARILMIŞ NOKTA ATIŞ KOÇ TAVSİYESİ KUTUSU */}
                          <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-2.5 space-y-1">
                            <p className="text-[10.5px] font-black text-amber-950 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Nokta Atış Telafi Eylemleri:</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {coachActionSteps.map((step, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="bg-white border border-amber-300/80 text-amber-950 px-2 py-0.5 rounded-md shadow-2xs text-[10.5px] font-black flex items-center gap-1"
                                >
                                  <span>🎯</span>
                                  <span>{step}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] font-medium text-brand-ink/60">
                          <span className="font-mono font-semibold text-rose-700 truncate" title={qListStr}>
                            📌 {qListStr}
                          </span>
                          <span className="truncate shrink-0 max-w-[140px]" title={item.examNames.join(', ')}>
                            {item.examNames[0]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredMissingOutcomes.length > 10 && (
                  <div className="text-center pt-1 print:hidden">
                    <button
                      type="button"
                      onClick={() => setShowAllOutcomes(prev => !prev)}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      {showAllOutcomes
                        ? 'Daha Az Göster (İlk 10 Kazanım)'
                        : `Tüm Eksik Kazanımları Göster (+${filteredMissingOutcomes.length - 10} Kazanım Daha)`}
                    </button>
                  </div>
                )}
              </>
            ) : report.topWeakOutcomes && report.topWeakOutcomes.length > 0 ? (
              /* Kazanım listesi henüz tam taranmamış ama topWeakOutcomes mevcutsa fallback */
              <div className="space-y-2">
                <p className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Son Sınav Öncelikli Kazanım Tavsiyeleri:</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {report.topWeakOutcomes.map((w, idx) => (
                    <div key={idx} className="bg-white border border-purple-200 rounded-xl p-3 shadow-2xs space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900">{w.subject}</span>
                        <span className="text-[10px] font-mono font-bold text-indigo-700">{w.code}</span>
                      </div>
                      <p className="text-xs font-bold text-brand-ink">{w.desc}</p>
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/80 font-medium">
                        💡 <strong>Koç Tavsiyesi:</strong> Bu kazanımdaki net kaybını telafi etmek için 15 dakika konu özeti tekrarı yapıp 20 adet beceri temelli soru çözün.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Hiç eksik kazanım yoksa veya mükemmel kavranmışsa */
              <div className="bg-white border border-purple-200/80 rounded-2xl p-4 text-center space-y-1">
                <p className="text-xs font-bold text-purple-950 flex items-center justify-center gap-1.5">
                  <span>🏆</span>
                  <span>Harika Başarı! Eksik Kazanım Bulunmuyor</span>
                </p>
                <p className="text-[11px] text-brand-ink/70 max-w-md mx-auto">
                  Öğrencimiz seçili dönem sınavlarında ölçülen tüm temel kazanımları başarıyla kavramıştır. Mevcut net ivmesini korumak için zaman ayarlı branş denemelerine devam edilmesi önerilir.
                </p>
              </div>
            )}
            </div>
          </div>

          {/* 4. DERS DAĞILIM KARNESİ AKORDEON KARTI */}
          {uniqueLessons.length > 0 && (
            <div className="bg-[#FAF9F6] border border-brand-border/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-2xs space-y-3">
              <button
                type="button"
                onClick={() => toggleSection('lessons')}
                className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8.5 h-8.5 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                    📊
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-base font-bold text-brand-ink">
                        Detaylı Ders Karnesi & Okul Ortalaması Kıyaslaması
                      </h4>
                      <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-full">
                        {uniqueLessons.length} Ders • {report.totalNet.toFixed(2)} Net
                      </span>
                    </div>
                    <p className="text-[10.5px] sm:text-[11px] text-brand-ink/60 font-medium truncate">
                      {openSections.lessons ? 'Detayları gizlemek için dokunun' : 'Dokunarak ders bazlı D/Y/B ve okul ortalamaları tablosunu açın'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10.5px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                    {openSections.lessons ? 'Gizle' : 'Detayı Gör'}
                  </span>
                  <div className="p-1 rounded-lg bg-slate-200/60 text-slate-800 group-hover:bg-slate-200 transition-colors">
                    {openSections.lessons ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              <div className={`${openSections.lessons ? 'block' : 'hidden'} print:block pt-2 border-t border-brand-border/60 animate-in fade-in duration-150`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[480px]">
                    <thead>
                      <tr className="text-[10.5px] font-bold text-brand-ink/60 border-b border-brand-border/40">
                        <th className="py-1.5 px-2">Ders</th>
                        <th className="py-1.5 px-2 text-center text-emerald-700">D</th>
                        <th className="py-1.5 px-2 text-center text-rose-600">Y</th>
                        <th className="py-1.5 px-2 text-center text-amber-700">B</th>
                        <th className="py-1.5 px-2 text-center font-bold text-brand-ink">Öğrenci Net</th>
                        {hasSchoolAvgInLessons && (
                          <>
                            <th className="py-1.5 px-2 text-center text-indigo-800">Okul Ort.</th>
                            <th className="py-1.5 px-2 text-center">Ort. Farkı</th>
                          </>
                        )}
                        <th className="py-1.5 px-2 text-center text-blue-800">Dönem Ort.</th>
                        <th className="py-1.5 px-2 text-right">İsabet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/30 font-mono">
                      {uniqueLessons.map((l, i) => {
                        const diff = l.diffFromSchoolAvg;
                        return (
                          <tr key={`${l.name}-${i}`} className="hover:bg-white/60 transition-colors">
                            <td className="py-1.5 px-2 font-sans font-semibold text-brand-ink">{l.name}</td>
                            <td className="py-1.5 px-2 text-center text-emerald-700 font-bold">{l.correct}</td>
                            <td className="py-1.5 px-2 text-center text-rose-600 font-bold">{l.wrong}</td>
                            <td className="py-1.5 px-2 text-center text-amber-700">{l.empty}</td>
                            <td className="py-1.5 px-2 text-center font-black text-brand-ink">{l.net.toFixed(2)}</td>
                            {hasSchoolAvgInLessons && (
                              <>
                                <td className="py-1.5 px-2 text-center text-indigo-900/80 font-semibold">
                                  {l.schoolAvgNet !== undefined ? l.schoolAvgNet.toFixed(2) : '-'}
                                </td>
                                <td className="py-1.5 px-2 text-center">
                                  {diff !== undefined ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold ${
                                      diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                              </>
                            )}
                            <td className="py-1.5 px-2 text-center text-blue-800 font-semibold">
                              {l.periodAvgNet !== undefined ? l.periodAvgNet.toFixed(2) : l.net.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-sans font-semibold text-brand-ink/70">%{l.accuracy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {uniqueLessons.length > 1 && (
                      <tfoot className="border-t-2 border-brand-border/70 font-mono text-[11px] bg-white/70 font-bold">
                        <tr>
                          <td className="py-1.5 px-2 font-sans text-brand-ink">Toplam</td>
                          <td className="py-1.5 px-2 text-center text-emerald-700 font-black">{report.totalCorrect}</td>
                          <td className="py-1.5 px-2 text-center text-rose-600 font-black">{report.totalWrong}</td>
                          <td className="py-1.5 px-2 text-center text-amber-700 font-black">{report.totalEmpty}</td>
                          <td className="py-1.5 px-2 text-center text-brand-ink font-black">{report.totalNet.toFixed(2)}</td>
                          {hasSchoolAvgInLessons && (
                            <>
                              <td className="py-1.5 px-2 text-center text-indigo-900 font-black">
                                {comp && comp.schoolAvgNet > 0 ? comp.schoolAvgNet.toFixed(2) : '-'}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                {comp && comp.schoolAvgNet > 0 ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-black ${
                                    comp.netDiffFromSchool >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                                  }`}>
                                    {comp.netDiffFromSchool >= 0 ? '+' : ''}{comp.netDiffFromSchool.toFixed(2)}
                                  </span>
                                ) : '-'}
                              </td>
                            </>
                          )}
                          <td className="py-1.5 px-2 text-center text-blue-900 font-black">
                            {comp ? comp.studentPeriodAvgNet.toFixed(2) : report.totalNet.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-sans text-brand-ink/80">
                            {report.totalCorrect + report.totalWrong > 0 
                              ? `%${Math.round((report.totalCorrect / (report.totalCorrect + report.totalWrong)) * 100)}` 
                              : '-'}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. Bir Sonraki Sınav İçin 3 Maddelik Somut Taktik Reçetesi Akordeon Kartı */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/60 border border-indigo-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => toggleSection('tactics')}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8.5 h-8.5 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                  🚀
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-base font-bold text-indigo-950">
                      Bir Sonraki Deneme İçin 3 Maddelik Nokta Atışı Eylem Planı
                    </h4>
                    <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                      3 Somut Adım
                    </span>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-indigo-900/60 font-medium truncate">
                    {openSections.tactics ? 'Detayları gizlemek için dokunun' : 'Dokunarak kişiselleştirilmiş 3 eylem adımını açın'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg hidden sm:inline-block">
                  {openSections.tactics ? 'Gizle' : 'Detayı Gör'}
                </span>
                <div className="p-1 rounded-lg bg-indigo-100 text-indigo-800 group-hover:bg-indigo-200 transition-colors">
                  {openSections.tactics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            <div className={`${openSections.tactics ? 'block' : 'hidden'} print:block pt-2 border-t border-indigo-200/60 animate-in fade-in duration-150`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {report.tactics.map((tactic) => (
                  <div 
                    key={tactic.step}
                    className="bg-white border border-indigo-100 hover:border-indigo-300 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono font-black text-xs flex items-center justify-center shadow-2xs">
                        {tactic.step}
                      </span>
                      <span className="text-lg">{tactic.icon}</span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-indigo-950 mb-1 leading-snug">
                        {tactic.title}
                      </h5>
                      <p className="text-[11px] text-brand-ink/75 leading-relaxed font-normal">
                        {tactic.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Rehberlik Servisi Nokta Atışı Yönlendirme & Kapanış Değerlendirmesi Akordeon Kartı */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-md space-y-3.5 print:bg-white print:text-black print:border print:border-slate-300">
            <button
              type="button"
              onClick={() => toggleSection('guidance')}
              className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8.5 h-8.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-base shrink-0">
                  🧭
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-base font-bold text-amber-300 print:text-slate-900">
                      Rehberlik Servisi Nokta Atışı Yönlendirme & Çalışma Reçetesi
                    </h4>
                    <span className="text-[10px] font-extrabold bg-amber-400/20 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full print:bg-slate-100 print:text-slate-800">
                      Koç Yorumu
                    </span>
                  </div>
                  <p className="text-[10.5px] sm:text-[11px] text-white/65 print:text-slate-600 font-medium truncate">
                    {openSections.guidance ? 'Detayları gizlemek için dokunun' : 'Dokunarak bütünsel rehberlik değerlendirmesini ve koç yorumunu açın'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] font-bold text-amber-300 bg-white/10 px-2 py-0.5 rounded-lg hidden sm:inline-block print:hidden">
                  {openSections.guidance ? 'Gizle' : 'Detayı Gör'}
                </span>
                <div className="p-1 rounded-lg bg-white/10 text-white group-hover:bg-white/20 transition-colors print:hidden">
                  {openSections.guidance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            <div className={`${openSections.guidance ? 'block' : 'hidden'} print:block space-y-4 pt-2 border-t border-white/10 print:border-slate-300 animate-in fade-in duration-150`}>
              {report.guidancePrescription && report.guidancePrescription.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.guidancePrescription.map((gp, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-2 print:bg-slate-50 print:border-slate-200"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{gp.icon}</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 print:text-indigo-900">
                          {gp.category}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white print:text-slate-900 leading-snug">
                        {gp.title}
                      </p>
                      <p className="text-[11px] text-white/75 print:text-slate-700 leading-relaxed">
                        {gp.summary}
                      </p>
                      <ul className="space-y-1.5 pt-1 border-t border-white/10 print:border-slate-200">
                        {gp.bullets.map((b, bIdx) => (
                          <li key={bIdx} className="text-[11px] text-white/90 print:text-slate-800 leading-relaxed flex items-start gap-1.5">
                            <span className="text-amber-400 print:text-indigo-700 font-bold shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3.5 flex items-start gap-3 print:bg-amber-50 print:border-amber-200">
                <span className="text-xl shrink-0 mt-0.5">💬</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-300 print:text-slate-900 mb-0.5">
                    Rehber Öğretmen & Akademik Koç Değerlendirmesi
                  </p>
                  <p className="text-[11px] sm:text-xs text-white/95 print:text-slate-800 leading-relaxed font-medium">
                    {report.coachSummary}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Alt Butonlar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FAF9F6] border-t border-brand-border/70 shrink-0 print:hidden">
          <div className="text-[11px] text-brand-ink/60 font-medium truncate mr-2">
            Akademi Arena AI Rehberlik & Kazanım Analiz Sistemi • 2026 LGS Projeksiyonu
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isExportingPDF}
              onClick={handleDownloadPDF}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hazırlanıyor...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF İndir</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Yazdır</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 active:scale-95 text-brand-ink border border-brand-border/80 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
