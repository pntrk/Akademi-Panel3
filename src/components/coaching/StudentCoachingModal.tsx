import React, { useRef, useState } from 'react';
import { 
  X, 
  Printer, 
  Download,
  Loader2,
  Award, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  AlertTriangle, 
  Target, 
  Calendar,
  Sparkles
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
  const reportContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!report || isExportingPDF) return;
    setIsExportingPDF(true);

    try {
      const cleanName = (report.studentName || 'Ogrenci').replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '_');
      const filename = `Koc_Raporu_${cleanName}.pdf`;

      const lessonRows = (report.lessons || []).map((l) => [
        { text: l.name, style: 'tableCell' },
        { text: String(l.correct), style: 'tableCellCenter', color: '#047857' },
        { text: String(l.wrong), style: 'tableCellCenter', color: '#dc2626' },
        { text: String(l.empty), style: 'tableCellCenter', color: '#b45309' },
        { text: l.net.toFixed(2), style: 'tableCellCenterBold' },
        { text: `%${l.accuracy}`, style: 'tableCellRight' },
      ]);

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [30, 25, 30, 25],
        content: [
          // Banner
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: '#0f172a',
                    padding: [10, 10, 10, 10],
                    stack: [
                      { text: 'AKADEMİ ARENA - YÖNLENDİRME KOÇU & GELİŞİM REÇETESİ', style: 'bannerTitle' },
                      { text: 'Son Sınav Netleri ve Aylık Rozet Performansı Analizi', style: 'bannerSubtitle' }
                    ]
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 10]
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
                        text: `Arena Sıralaması: #${report.rank} / ${report.totalStudents}   |   Toplam: ${report.leaguePoints} LP`,
                        style: 'studentSubMeta'
                      }
                    ]
                  },
                  {
                    alignment: 'right',
                    stack: [
                      { text: 'SON LGS PUANI', style: 'scoreLabel' },
                      { text: report.score > 0 ? report.score.toFixed(2) : '-', style: 'scoreValue' },
                      { text: `Net: ${report.totalNet.toFixed(2)}`, style: 'netValue' }
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
              paddingTop: () => 8,
              paddingBottom: () => 8
            },
            margin: [0, 0, 0, 10]
          },

          // Exam Summary Info Bar
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: '#f8fafc',
                    padding: [6, 6, 6, 6],
                    text: [
                      { text: 'Sınav: ', bold: true, color: '#334155' },
                      { text: `${report.examName} ${report.examDate ? `(${report.examDate})` : ''}   |   `, color: '#0f172a' },
                      { text: `D: ${report.totalCorrect}   `, bold: true, color: '#047857' },
                      { text: `Y: ${report.totalWrong}   `, bold: true, color: '#dc2626' },
                      { text: `B: ${report.totalEmpty}   `, bold: true, color: '#b45309' },
                      { text: `Net: ${report.totalNet.toFixed(2)}`, bold: true, color: '#0f172a' }
                    ],
                    style: 'examInfoText'
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 12]
          },

          // Strengths & Risks Columns
          {
            columnGap: 10,
            columns: [
              // Strengths
              {
                width: '*',
                stack: [
                  { text: '🌟 GÜÇLÜ YÖNLER & KAZANIMLAR', style: 'sectionHeaderGreen' },
                  ...report.strengths.map(s => ({
                    margin: [0, 0, 0, 6],
                    stack: [
                      { text: `${s.icon || '⭐'} ${s.title}`, style: 'itemTitle' },
                      { text: s.desc, style: 'itemDesc' }
                    ]
                  }))
                ]
              },
              // Risks
              {
                width: '*',
                stack: [
                  { text: '⚠️ GELİŞİME AÇIK & RİSKLİ ALANLAR', style: 'sectionHeaderAmber' },
                  ...report.risks.map(r => ({
                    margin: [0, 0, 0, 6],
                    stack: [
                      { text: `${r.icon || '⚠️'} ${r.title}`, style: 'itemTitle' },
                      { text: r.desc, style: 'itemDesc' }
                    ]
                  }))
                ]
              }
            ],
            margin: [0, 0, 0, 12]
          },

          // 3 Step Action Plan
          {
            stack: [
              { text: '🚀 BİR SONRAKİ DENEME İÇİN 3 MADDELİK EYLEM PLANI', style: 'sectionHeaderBlue' },
              ...report.tactics.map(t => ({
                margin: [0, 0, 0, 6],
                stack: [
                  { text: `Adım ${t.step}: ${t.title}`, style: 'tacticTitle' },
                  { text: t.action, style: 'tacticDesc' }
                ]
              }))
            ],
            margin: [0, 0, 0, 12]
          },

          // Lesson Report Table (if available)
          ...(report.lessons && report.lessons.length > 0 ? [
            { text: '📊 SON DENEME DERS KARNESİ', style: 'sectionHeader' },
            {
              table: {
                headerRows: 1,
                widths: ['*', 35, 35, 35, 45, 55],
                body: [
                  [
                    { text: 'Ders', style: 'tableHeader' },
                    { text: 'D', style: 'tableHeaderCenter' },
                    { text: 'Y', style: 'tableHeaderCenter' },
                    { text: 'B', style: 'tableHeaderCenter' },
                    { text: 'Net', style: 'tableHeaderCenter' },
                    { text: 'İsabet', style: 'tableHeaderRight' }
                  ],
                  ...lessonRows,
                  [
                    { text: 'TOPLAM', style: 'tableHeaderBold' },
                    { text: String(report.totalCorrect), style: 'tableHeaderCenterBold' },
                    { text: String(report.totalWrong), style: 'tableHeaderCenterBold' },
                    { text: String(report.totalEmpty), style: 'tableHeaderCenterBold' },
                    { text: report.totalNet.toFixed(2), style: 'tableHeaderCenterBold' },
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
              margin: [0, 0, 0, 12]
            }
          ] : []),

          // Coach Note
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    fillColor: '#f1f5f9',
                    padding: [8, 8, 8, 8],
                    stack: [
                      { text: '💬 REHBERLİK & MENTORLUK DEĞERLENDİRMESİ', style: 'coachHeader' },
                      { text: report.coachSummary, style: 'coachText' }
                    ]
                  }
                ]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 10]
          }
        ],

        footer: (currentPage: number, pageCount: number) => ({
          text: `Akademi Arena Rehberlik Sistemi • 2026 LGS Projeksiyonu  |  Sayfa ${currentPage} / ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          color: '#94a3b8',
          margin: [0, 10, 0, 0]
        }),

        styles: {
          bannerTitle: { fontSize: 13, bold: true, color: '#f59e0b', alignment: 'center' },
          bannerSubtitle: { fontSize: 8.5, color: '#cbd5e1', alignment: 'center', margin: [0, 2, 0, 0] },
          studentName: { fontSize: 14, bold: true, color: '#0f172a' },
          studentMeta: { fontSize: 8.5, color: '#475569', margin: [0, 2, 0, 0] },
          studentSubMeta: { fontSize: 8.5, bold: true, color: '#1e293b', margin: [0, 2, 0, 0] },
          scoreLabel: { fontSize: 7.5, bold: true, color: '#64748b' },
          scoreValue: { fontSize: 15, bold: true, color: '#6d28d9' },
          netValue: { fontSize: 9.5, bold: true, color: '#0f172a' },
          examInfoText: { fontSize: 8.5 },
          sectionHeaderGreen: { fontSize: 10, bold: true, color: '#047857', margin: [0, 0, 0, 4] },
          sectionHeaderAmber: { fontSize: 10, bold: true, color: '#b45309', margin: [0, 0, 0, 4] },
          sectionHeaderBlue: { fontSize: 10, bold: true, color: '#1d4ed8', margin: [0, 0, 0, 4] },
          sectionHeader: { fontSize: 10, bold: true, color: '#0f172a', margin: [0, 0, 0, 4] },
          itemTitle: { fontSize: 8.5, bold: true, color: '#0f172a' },
          itemDesc: { fontSize: 8, color: '#334155', margin: [0, 1, 0, 0] },
          tacticTitle: { fontSize: 8.5, bold: true, color: '#1e1b4b' },
          tacticDesc: { fontSize: 8, color: '#334155', margin: [0, 1, 0, 0] },
          tableHeader: { fontSize: 8.5, bold: true, color: '#0f172a' },
          tableHeaderCenter: { fontSize: 8.5, bold: true, color: '#0f172a', alignment: 'center' },
          tableHeaderRight: { fontSize: 8.5, bold: true, color: '#0f172a', alignment: 'right' },
          tableHeaderBold: { fontSize: 8.5, bold: true, color: '#0f172a' },
          tableHeaderCenterBold: { fontSize: 8.5, bold: true, color: '#0f172a', alignment: 'center' },
          tableHeaderRightBold: { fontSize: 8.5, bold: true, color: '#0f172a', alignment: 'right' },
          tableCell: { fontSize: 8, color: '#0f172a' },
          tableCellCenter: { fontSize: 8, alignment: 'center' },
          tableCellCenterBold: { fontSize: 8, bold: true, color: '#0f172a', alignment: 'center' },
          tableCellRight: { fontSize: 8, alignment: 'right', color: '#334155' },
          coachHeader: { fontSize: 9, bold: true, color: '#b45309', margin: [0, 0, 0, 3] },
          coachText: { fontSize: 8.5, color: '#1e293b' }
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
  const isTaktik = report.team === 'Taktik Avcıları';

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

  return (
    <div id="coaching-report-printable" className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:z-auto">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-brand-border/90 flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst Başlık & Kontrol Çubuğu */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 print:bg-white print:text-black print:border-b-2 print:border-slate-800 print:px-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center text-lg sm:text-xl font-black shadow-md shrink-0 print:bg-slate-200">
              🎯
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold font-serif tracking-tight truncate">
                Yönlendirme Koçu & Gelişim Reçetesi
              </h2>
              <p className="text-[10px] sm:text-xs text-white/70 print:text-slate-600 font-medium truncate">
                Son Sınav Netleri ve Aylık Rozet Performansı Analizi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              disabled={isExportingPDF}
              onClick={handleDownloadPDF}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Rehberlik Raporunu doğrudan PDF dosyası olarak indir"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span className="hidden sm:inline">İndiriliyor...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-950" />
                  <span>PDF İndir</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Rehberlik Raporunu Yazdır"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Yazdır</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Kaydırılabilir İçerik Alanı (Yazdırıldığında ve PDF alındığında tam döküm) */}
        <div ref={reportContentRef} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 custom-scrollbar print:p-0 print:overflow-visible print:space-y-4 bg-white">
          
          {/* 1. Öğrenci Kimlik ve Sınav Karnesi Özeti */}
          <div className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border bg-gradient-to-br ${teamBg} print:bg-white print:border-slate-300 shadow-xs`}>
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
                  <p className="text-[9.5px] font-bold text-brand-ink/50 uppercase tracking-wider">Net</p>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 text-xs text-brand-ink/75 font-medium">
              <div className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-brand-ink/50 shrink-0" />
                <span className="truncate"><strong>Son Sınav:</strong> {report.examName} {report.examDate ? `(${report.examDate})` : ''}</span>
              </div>
              <div className="flex items-center gap-2.5 font-mono text-[11px] shrink-0">
                <span className="text-emerald-700 font-bold">D: {report.totalCorrect}</span>
                <span className="text-rose-600 font-bold">Y: {report.totalWrong}</span>
                <span className="text-amber-700 font-bold">B: {report.totalEmpty}</span>
                <span className="text-brand-ink font-black">Net: {report.totalNet.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 2. Ana Analiz Bölümü: Güçlü Yönler & Riskli Alanlar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            
            {/* Güçlü Yönler (Pillars of Success) */}
            <div className="bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold shadow-2xs">
                    🌟
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950">Güçlü Yönler & Kazanımlar</h4>
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
                  <h4 className="text-sm font-bold text-amber-950">Gelişime Açık & Riskli Alanlar</h4>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  {report.risks.length} Dikkat Noktası
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

          {/* 3. Bir Sonraki Sınav İçin 3 Maddelik Somut Taktik Reçetesi */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/60 border border-indigo-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-indigo-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
                  🚀
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-indigo-950">
                    Bir Sonraki Deneme İçin 3 Maddelik Eylem Planı
                  </h4>
                  <p className="text-[10px] sm:text-xs text-indigo-900/60 font-medium">
                    Doğrudan puan ve net artışına odaklanmış pedagojik koçluk adımları
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-black text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
                <Target className="w-3.5 h-3.5" /> Hedef Odaklı
              </span>
            </div>

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

          {/* 4. Ders Dağılım Karnesi ve Koç Notu */}
          {uniqueLessons.length > 0 && (
            <div className="bg-[#FAF9F6] border border-brand-border/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-brand-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📊</span>
                  <p className="text-xs font-bold text-brand-ink">Son Deneme Ders Karnesi</p>
                </div>
                <p className="text-[10px] text-brand-ink/60 font-medium">
                  {uniqueLessons.length} Ders • Toplam {report.totalNet.toFixed(2)} Net
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[320px]">
                  <thead>
                    <tr className="text-[10.5px] font-bold text-brand-ink/60 border-b border-brand-border/40">
                      <th className="py-1.5 px-2">Ders</th>
                      <th className="py-1.5 px-2 text-center text-emerald-700">D</th>
                      <th className="py-1.5 px-2 text-center text-rose-600">Y</th>
                      <th className="py-1.5 px-2 text-center text-amber-700">B</th>
                      <th className="py-1.5 px-2 text-center font-bold text-brand-ink">Net</th>
                      <th className="py-1.5 px-2 text-right">İsabet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30 font-mono">
                    {uniqueLessons.map((l, i) => (
                      <tr key={`${l.name}-${i}`} className="hover:bg-white/60 transition-colors">
                        <td className="py-1.5 px-2 font-sans font-semibold text-brand-ink">{l.name}</td>
                        <td className="py-1.5 px-2 text-center text-emerald-700 font-bold">{l.correct}</td>
                        <td className="py-1.5 px-2 text-center text-rose-600 font-bold">{l.wrong}</td>
                        <td className="py-1.5 px-2 text-center text-amber-700">{l.empty}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-brand-ink">{l.net.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-sans font-semibold text-brand-ink/70">%{l.accuracy}</td>
                      </tr>
                    ))}
                  </tbody>
                  {uniqueLessons.length > 1 && (
                    <tfoot className="border-t-2 border-brand-border/70 font-mono text-[11px] bg-white/70 font-bold">
                      <tr>
                        <td className="py-1.5 px-2 font-sans text-brand-ink">Toplam</td>
                        <td className="py-1.5 px-2 text-center text-emerald-700 font-black">{report.totalCorrect}</td>
                        <td className="py-1.5 px-2 text-center text-rose-600 font-black">{report.totalWrong}</td>
                        <td className="py-1.5 px-2 text-center text-amber-700 font-black">{report.totalEmpty}</td>
                        <td className="py-1.5 px-2 text-center text-brand-ink font-black">{report.totalNet.toFixed(2)}</td>
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
          )}

          {/* 5. Koç Özeti & Kapanış Değerlendirmesi */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-3.5 sm:p-4 shadow-sm flex items-start gap-3 print:bg-white print:text-black print:border print:border-slate-300">
            <span className="text-xl shrink-0 mt-0.5">💬</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300 print:text-slate-900 mb-0.5">
                Rehberlik & Mentorluk Değerlendirmesi
              </p>
              <p className="text-[11px] sm:text-xs text-white/90 print:text-slate-700 leading-relaxed font-medium">
                {report.coachSummary}
              </p>
            </div>
          </div>

        </div>

        {/* Alt Butonlar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FAF9F6] border-t border-brand-border/70 shrink-0 print:hidden">
          <div className="text-[11px] text-brand-ink/60 font-medium truncate mr-2">
            Akademi Arena Rehberlik Sistemi • 2026 LGS Projeksiyonu
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
