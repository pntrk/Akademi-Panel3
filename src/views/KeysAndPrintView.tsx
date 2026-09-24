import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import { useAppContext } from '../context/AppContext';
import { Exam, Subject, Student } from '../types';
import { KeysTab } from '../components/omr/KeysTab';
import { LocalQRCode } from '../components/omr/LocalQRCode';
import { 
  DEFAULT_OMR, 
  OMR_SPECS,
  OPTS_4, 
  OPTS_5, 
  getQuestionsLayout, 
  isTytExam, 
  isAytExam, 
  formatClassSec,
  getStudentInfoFit 
} from '../lib/omrEngine';
import { 
  KeyRound, 
  Printer, 
  Settings2, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Check,
  BookOpen, 
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Info,
  Users,
  ZoomIn,
  Palette,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

/* =========================================================================
   PRESET DERS DAĞILIM ŞABLONLARI
   ========================================================================= */
const PRESET_TEMPLATES = [
  {
    name: 'LGS Standart Deneme (90 Soru)',
    format: 'lgs' as const,
    layoutType: 'split' as const,
    optionsCount: 4,
    penalty: 3,
    subjects: [
      { id: 1, name: "Türkçe", count: 20, section: 1 },
      { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
      { id: 3, name: "Din Kültürü", count: 10, section: 1 },
      { id: 4, name: "İngilizce", count: 10, section: 1 },
      { id: 5, name: "Matematik", count: 20, section: 2 },
      { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
    ]
  },
  {
    name: 'Ortaokul 5-6-7. Sınıf Genel (75 Soru)',
    format: 'lgs' as const,
    layoutType: 'split' as const,
    optionsCount: 4,
    penalty: 3,
    subjects: [
      { id: 1, name: "Türkçe", count: 15, section: 1 },
      { id: 2, name: "Sosyal Bilgiler", count: 10, section: 1 },
      { id: 3, name: "Din Kültürü", count: 10, section: 1 },
      { id: 4, name: "İngilizce", count: 10, section: 1 },
      { id: 5, name: "Matematik", count: 15, section: 2 },
      { id: 6, name: "Fen Bilimleri", count: 15, section: 2 }
    ]
  },
  {
    name: 'YKS / TYT Standart Deneme (120 Soru - 5 Şık)',
    format: 'tyt' as const,
    layoutType: 'split' as const,
    optionsCount: 5,
    penalty: 4,
    subjects: [
      { id: 1, name: "Türkçe", count: 40, section: 1 },
      { id: 2, name: "Sosyal Bilimler", count: 20, section: 1 },
      { id: 3, name: "Temel Matematik", count: 40, section: 2 },
      { id: 4, name: "Fen Bilimleri", count: 20, section: 2 }
    ]
  },
  {
    name: 'Tek Ders / Branş Denemesi (20 Soru)',
    format: 'lgs' as const,
    layoutType: 'standard' as const,
    optionsCount: 4,
    penalty: 3,
    subjects: [
      { id: 1, name: "Ders Testi", count: 20, section: 1 }
    ]
  }
];

/* Helper to generate Base64 QR Code string asynchronously using qrcode */
async function generateQrDataUrl(data: string, size = 160): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (e) {
    console.warn('QR code generation error:', e);
    return '';
  }
}

/* =========================================================================
   DİNAMİK YAZI BOYUTU (AUTO-RESIZE / TEXT-FIT) YARDIMCISI
   ========================================================================= */
/**
 * Öğrenci ismi uzunluğuna göre yazı tipi boyutunu (font size) ve harf aralığını
 * otomatik ölçeklendirerek optik form bilgi alanına tam sığmasını sağlayan yardımcı fonksiyon.
 * @param name Öğrenci adı ve soyadı
 * @param baseSize Standart maksimum font boyutu (varsayılan: 13px)
 * @param minSize İzin verilen minimum font boyutu (varsayılan: 7.5px)
 */
export function adjustFontSize(
  name?: string | null, 
  baseSize: number = 13, 
  minSize: number = 7.5
): {
  fontSize: string;
  fontSizeNum: number;
  letterSpacing: string;
  lineHeight: string | number;
  style: React.CSSProperties;
} {
  if (!name) {
    return {
      fontSize: `${baseSize}px`,
      fontSizeNum: baseSize,
      letterSpacing: 'normal',
      lineHeight: 1.15,
      style: {
        fontSize: `${baseSize}px`,
        letterSpacing: 'normal',
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    };
  }

  const trimmed = name.trim();
  const len = trimmed.length;

  let size = baseSize;
  let spacing = 'normal';

  if (len <= 16) {
    size = baseSize; // Standart kısa/orta isimler (13px)
  } else if (len <= 22) {
    size = 11.5;     // 17-22 karakter (11.5px)
  } else if (len <= 27) {
    size = 10.2;     // 23-27 karakter (10.2px)
    spacing = '-0.015em';
  } else if (len <= 34) {
    size = 9.0;      // 28-34 karakter (9px)
    spacing = '-0.025em';
  } else {
    // 35+ karakterli çok uzun çift isim ve soyisimler
    const calculated = baseSize - ((len - 16) * 0.22);
    size = Math.max(minSize, Number(calculated.toFixed(1)));
    spacing = '-0.035em';
  }

  return {
    fontSize: `${size}px`,
    fontSizeNum: size,
    letterSpacing: spacing,
    lineHeight: 1.15,
    style: {
      fontSize: `${size}px`,
      letterSpacing: spacing,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  };
}

/* =========================================================================
   CANLI A4 OPTİK FORM BİLEŞENİ (PRINT LAYOUT)
   ========================================================================= */
interface LiveOmrSheetProps {
  exam: Exam;
  student: Student | null;
  isColorMode: boolean;
}

export function LiveOmrSheet({ exam, student, isColorMode }: LiveOmrSheetProps) {
  const options = (exam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;
  const isTyt = isTytExam(exam);
  const isAyt = isAytExam(exam);

  // Tek Merkezi Koordinat Motoru Standartları
  const renderOMR = OMR_SPECS;
  const { items: layoutItems, finalQBoxH, isSplit, hasFourSections } = getQuestionsLayout(exam, renderOMR) as any;

  const themeColor = isColorMode ? '#dc2626' : '#0f172a';
  const themeBg = isColorMode ? '#fef2f2' : '#f8fafc';

  const studentName = student?.name || "ÖRNEK ÖĞRENCİ (ÖNİZLEME)";
  const studentNo = student?.no ? String(student.no) : "1001";
  const studentClass = student 
    ? (student.className || `${student.classStr || '8'}/${student.sectionStr || 'A'}`) 
    : "8/A";
  const qrData = student
    ? `E:${exam.id}|N:${student.no}`
    : `E:${exam.id}|N:1001`;

  const institutionName = exam.institution || "KIRKLARELİ ATATÜRK ORTAOKULU";
  const textFit = getStudentInfoFit(studentName, studentNo, studentClass);
  const nameStyle = adjustFontSize(studentName);

  return (
    <div
      id="optical-form-printable"
      className="optik-page bg-white text-slate-900 font-sans relative select-none shadow-2xl border border-slate-300 mx-auto"
      style={{
        width: '210mm',
        height: '297mm',
        minWidth: '210mm',
        minHeight: '297mm',
        maxWidth: '210mm',
        maxHeight: '297mm',
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        ['--print-color' as any]: themeColor,
        ['--print-bg' as any]: themeBg
      }}
    >
      <style>{`
        .anchor-mark {
          width: ${OMR_SPECS.anchorSize}mm;
          height: ${OMR_SPECS.anchorSize}mm;
          background-color: #000 !important;
          background: #000 !important;
          position: absolute;
          transform: translate(-50%, -50%);
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-shadow: inset 0 0 0 5mm #000000 !important;
          overflow: hidden;
          z-index: 50;
        }
        .bubble {
          width: 3.6mm;
          height: 3.6mm;
          border: 1.1px solid var(--print-color, #000);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6.8px;
          font-weight: 700;
          background-color: #fff;
          line-height: 1;
        }
        .info-bubble {
          width: 4.8mm;
          height: 4.8mm;
          border: 1.2px solid var(--print-color, #000);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 800;
          background-color: #fff;
          line-height: 1;
        }
        .print-border {
          border-color: var(--print-color, #000) !important;
        }
        .print-text {
          color: var(--print-color, #000) !important;
        }
        .print-bg {
          background-color: var(--print-bg, #f3f4f6) !important;
        }
      `}</style>

      {/* 4 Köşe Siyah Optik Çapa İşaretleri (Kamera Hizalama İçin 8x8mm, 10mm kenar payı) */}
      <div className="anchor-mark" style={{ left: `${OMR_SPECS.anchorMargin}mm`, top: `${OMR_SPECS.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${OMR_SPECS.paperW - OMR_SPECS.anchorMargin}mm`, top: `${OMR_SPECS.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${OMR_SPECS.anchorMargin}mm`, top: `${OMR_SPECS.paperH - OMR_SPECS.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${OMR_SPECS.paperW - OMR_SPECS.anchorMargin}mm`, top: `${OMR_SPECS.paperH - OMR_SPECS.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>

      {/* Sınav ve Kurum Üst Başlığı (x:10mm, y:12mm, w:190mm, h:18mm) */}
      <div
        className="absolute border-[2px] print-border bg-slate-50 flex items-center justify-between px-3 py-1 rounded-xs"
        style={{ left: `${renderOMR.header.x}mm`, top: `${renderOMR.header.y}mm`, width: `${renderOMR.header.w}mm`, height: `${renderOMR.header.h}mm` }}
      >
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          <h1 className="text-[12px] font-black uppercase tracking-widest print-text leading-none">{institutionName}</h1>
          <h2 className="text-[8px] font-bold text-slate-700 mt-0.5 tracking-wider">{exam.name} • {exam.date || new Date().toLocaleDateString('tr-TR')}</h2>
        </div>
      </div>

      {/* Öğrenci Bilgi ve Karekod Alanı (x:10mm, y:32mm, w:190mm, h:32mm) */}
      <div
        className="absolute border-[2px] print-border bg-white rounded-xs"
        style={{ left: `${renderOMR.infoBox.x}mm`, top: `${renderOMR.infoBox.y}mm`, width: `${renderOMR.infoBox.w}mm`, height: `${renderOMR.infoBox.h}mm` }}
      >
        <div className="flex p-3 gap-3 h-full items-center justify-between relative">
          <div className="flex-1 flex flex-col justify-center gap-1 pl-2 min-w-0">
            <div 
              className="font-black tracking-tight text-slate-900 truncate max-w-[95mm]"
              style={nameStyle.style}
              title={studentName}
            >
              {studentName}
            </div>
            <div className="flex items-center gap-4 font-bold text-slate-700 mt-0.5" style={{ fontSize: textFit.metaFontSize }}>
              <div>ÖĞRENCİ NO: <span className="text-black font-mono font-bold" style={{ fontSize: textFit.noFontSize }}>{studentNo}</span></div>
              <div>SINIF / ŞUBE: <span className="text-black font-bold" style={{ fontSize: textFit.classFontSize }}>{studentClass}</span></div>
            </div>
            <div className="text-[7.5px] text-slate-400 font-medium truncate">
              * Kodlamalarınızı kurşun kalemle, dairelerin dışına taşırmadan yapınız.
            </div>
          </div>

          {/* Kitapçık Türü (x:135mm, y:18mm nispi, aralık: 7mm) */}
          <div className="absolute text-[8px] font-bold text-center w-[30mm] -translate-x-1/2" style={{ left: '145.5mm', top: '7.5mm' }}>
            KİTAPÇIK TÜRÜ
          </div>
          {["A", "B", "C", "D"].map((b, idx) => {
            const bx = 135 + (idx * 7);
            const by = 18;
            return (
              <div
                key={b}
                className="info-bubble absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${bx}mm`, top: `${by}mm` }}
              >
                {b}
              </div>
            );
          })}

          {/* Öğrenci Karekodu (x:160mm, y:3.5mm nispi, boyut: 25x25mm) */}
          <div 
            className="absolute border-2 border-slate-900 p-0.5 bg-white flex flex-col items-center justify-center"
            style={{ left: '160mm', top: '3.5mm', width: '25mm', height: '25mm' }}
          >
            <LocalQRCode data={qrData} size={150} />
          </div>
        </div>
      </div>

      {/* Soru ve Cevap Optik Kabarcık Alanı */}
      <div
        className="absolute border-[2px] print-border bg-white rounded-xs"
        style={{ left: `${renderOMR.qBox.x}mm`, top: `${renderOMR.qBox.y}mm`, width: `${renderOMR.qBox.w}mm`, height: `${finalQBoxH}mm` }}
      >
        {/* Bölüm Başlık Şeritleri (TYT / AYT 4 Bölüm veya Standart Split Mod) */}
        {hasFourSections ? (
          <>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: '1mm', width: '45.5mm' }}
            >
              {isTyt ? '1. TÜRKÇE TESTİ' : isAyt ? '1. EDEBİYAT - SOS-1' : '1. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: '48.5mm', width: '45.5mm' }}
            >
              {isTyt ? '2. SOSYAL BİLİMLER' : isAyt ? '2. SOSYAL BİLİMLER-2' : '2. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: '96mm', width: '45.5mm' }}
            >
              {isTyt ? '3. TEMEL MATEMATİK' : isAyt ? '3. MATEMATİK TESTİ' : '3. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: '143.5mm', width: '45.5mm' }}
            >
              {isTyt ? '4. FEN BİLİMLERİ' : isAyt ? '4. FEN BİLİMLERİ' : '4. TEST ALANI'}
            </div>
          </>
        ) : isSplit ? (
          <>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[8px] tracking-wider uppercase border print-border rounded-sm"
              style={{ left: '1mm', width: '92.5mm' }}
            >
              1. BÖLÜM (SÖZEL ALAN)
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[8px] tracking-wider uppercase border print-border rounded-sm"
              style={{ left: '96.5mm', width: '92.5mm' }}
            >
              2. BÖLÜM (SAYISAL ALAN)
            </div>
          </>
        ) : null}

        {/* Ana Seksiyon Ayraçları */}
        {hasFourSections ? (
          <>
            <div className="absolute top-0 bottom-0 border-r-[1.5px] print-border" style={{ left: '47.5mm' }} />
            <div className="absolute top-0 bottom-0 border-r-[2px] print-border" style={{ left: '95mm' }} />
            <div className="absolute top-0 bottom-0 border-r-[1.5px] print-border" style={{ left: '142.5mm' }} />
          </>
        ) : isSplit ? (
          <>
            <div className="absolute top-0 bottom-0 border-r-[2px] print-border" style={{ left: '95mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: '47.5mm', top: '7.5mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: '142.5mm', top: '7.5mm', bottom: '1mm' }} />
          </>
        ) : (
          <>
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: '47.5mm', top: '1mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: '95mm', top: '1mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: '142.5mm', top: '1mm', bottom: '1mm' }} />
          </>
        )}

        {layoutItems.map((item: any, idx: number) => {
          const topY = item.y - renderOMR.qBox.y;
          const colW = renderOMR.questions.colW;
          const colLeft = item.cIdx * colW;

          if (item.type === 'header') {
            return (
              <div
                key={`h-${idx}`}
                className="absolute font-black text-[7.5px] tracking-wider uppercase text-center print-text print-bg py-0.5 border-t border-b print-border flex items-center justify-center -translate-y-1/2 px-1"
                style={{
                  left: `${colLeft + 1}mm`,
                  top: `${topY}mm`,
                  width: `${colW - 2}mm`,
                  height: `${item.h}mm`
                }}
              >
                <span className="truncate">{item.text}</span>
              </div>
            );
          }

          const qNumLeft = colLeft + (renderOMR.questions.qNumOffset ?? 0.8);
          const qNumWidth = renderOMR.questions.qNumWidth ?? 6.6;
          const qNumber = (item.localIdx !== undefined ? item.localIdx + 1 : (item.qIdx !== undefined ? item.qIdx + 1 : 1));

          return (
            <React.Fragment key={`q-${item.qIdx ?? idx}`}>
              {/* Soru Numarası */}
              <div
                className="absolute font-mono font-bold text-[8.5px] print-text text-right select-none flex items-center justify-end pr-1 pointer-events-none"
                style={{
                  left: `${qNumLeft}mm`,
                  top: `${topY}mm`,
                  width: `${qNumWidth}mm`,
                  height: `${Math.max(3.2, item.h)}mm`,
                  transform: 'translateY(-50%)',
                  lineHeight: 1
                }}
              >
                {qNumber}.
              </div>

              {/* Seçenek Kabarcıkları */}
              {options.map((o, optIdx) => {
                const centerX = colLeft + renderOMR.questions.startXOffset + (optIdx * renderOMR.questions.bubbleGap);
                return (
                  <div
                    key={`${item.qIdx}-${o}`}
                    className="bubble absolute font-bold -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${centerX}mm`, top: `${topY}mm` }}
                  >
                    {o}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Sayfa Altı Kurumsal Bilgilendirme */}
      <div
        className="absolute text-[7.5px] font-bold tracking-widest text-slate-400 uppercase text-center w-full select-none pointer-events-none"
        style={{ bottom: '6.5mm', left: 0 }}
      >
        {institutionName} • {exam.name} • KAREKODLU AKILLI OPTİK FORM
      </div>
    </div>
  );
}

/* =========================================================================
   ANA BİLEŞEN: KEYS AND PRINT VIEW
   ========================================================================= */
export function KeysAndPrintView() {
  const { state, updateExamOmr } = useAppContext();
  const [activeTab, setActiveTab] = useState<'template' | 'keys' | 'print'>('print');

  // Allow external navigation directly into a specific tab (e.g. print)
  useEffect(() => {
    (window as any).__keysPrintSetTab = (tab: 'template' | 'keys' | 'print') => setActiveTab(tab);
  }, []);

  // Filtrelenmiş Kurum İçi Sınavlar
  const internalExams = useMemo(() => {
    const list = state.exams.filter(e => e.examType === 'internal' || (!e.examType && e.keys && Object.keys(e.keys).length > 0));
    return list.length > 0 ? list : state.exams;
  }, [state.exams]);

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    if (internalExams.length > 0) return String(internalExams[0].id);
    if (state.exams.length > 0) return String(state.exams[0].id);
    return "1";
  });

  // Keep selectedExamId in sync if exams array changes
  useEffect(() => {
    if (!selectedExamId && state.exams.length > 0) {
      setSelectedExamId(String(internalExams[0]?.id || state.exams[0].id));
    }
  }, [state.exams, internalExams, selectedExamId]);

  const selectedExam: Exam = internalExams.find(e => String(e.id) === String(selectedExamId)) 
    || state.exams.find(e => String(e.id) === String(selectedExamId)) 
    || state.exams[0] 
    || {
      id: "1",
      name: "Kurum İçi Deneme Sınavı",
      date: new Date().toLocaleDateString('tr-TR'),
      subjects: PRESET_TEMPLATES[0].subjects,
      optionsCount: 4,
      penalty: 3,
      layoutType: 'split',
      format: 'lgs',
      examType: 'internal',
      keys: { A: Array(90).fill(""), B: Array(90).fill(""), C: [], D: [] }
    };

  // ==========================================
  // TAB 1: ŞABLON VE DERS YAPILANDIRMASI STATE
  // ==========================================
  const [subjectsState, setSubjectsState] = useState<Subject[]>(
    selectedExam?.subjects && selectedExam.subjects.length > 0 
      ? selectedExam.subjects 
      : PRESET_TEMPLATES[0].subjects
  );
  const [optionsCountState, setOptionsCountState] = useState<number>(selectedExam?.optionsCount || 4);
  const [penaltyState, setPenaltyState] = useState<number>(selectedExam?.penalty ?? 3);
  const [layoutTypeState, setLayoutTypeState] = useState<'standard' | 'split'>(selectedExam?.layoutType || 'split');
  const [formatState, setFormatState] = useState<'lgs' | 'mebi' | 'tyt' | 'ayt'>((selectedExam?.format as any) || 'lgs');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sınav seçimi değiştiğinde lokal state'i güncelle
  useEffect(() => {
    if (selectedExam) {
      if (selectedExam.subjects && selectedExam.subjects.length > 0) {
        setSubjectsState(selectedExam.subjects);
      } else {
        setSubjectsState(PRESET_TEMPLATES[0].subjects);
      }
      setOptionsCountState(selectedExam.optionsCount || 4);
      setPenaltyState(selectedExam.penalty ?? 3);
      setLayoutTypeState(selectedExam.layoutType || 'split');
      setFormatState((selectedExam.format as any) || 'lgs');
    }
  }, [selectedExamId, selectedExam]);

  // Toplam Soru Sayısı Hesabı
  const totalQuestions = useMemo(() => {
    return subjectsState.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  }, [subjectsState]);

  // Ders Güncelleme / Ekleme / Silme Fonksiyonları
  const handleUpdateSubject = (index: number, field: keyof Subject, value: any) => {
    const updated = [...subjectsState];
    updated[index] = { ...updated[index], [field]: value };
    setSubjectsState(updated);
  };

  const handleAddSubject = () => {
    const nextId = subjectsState.length > 0 ? Math.max(...subjectsState.map(s => Number(s.id) || 0)) + 1 : 1;
    const newSub: Subject = {
      id: nextId,
      name: `Yeni Ders ${nextId}`,
      count: 10,
      section: 1
    };
    setSubjectsState([...subjectsState, newSub]);
  };

  const handleRemoveSubject = (index: number) => {
    if (subjectsState.length <= 1) {
      setSaveSuccessMessage("En az 1 ders bulunmalıdır.");
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      return;
    }
    const updated = subjectsState.filter((_, i) => i !== index);
    setSubjectsState(updated);
  };

  const handleApplyPreset = (presetIndex: number) => {
    const preset = PRESET_TEMPLATES[presetIndex];
    if (!preset) return;
    setSubjectsState(preset.subjects);
    setOptionsCountState(preset.optionsCount);
    setPenaltyState(preset.penalty);
    setLayoutTypeState(preset.layoutType);
    setFormatState(preset.format);
    setSaveSuccessMessage(`"${preset.name}" hazır şablonu uygulandı.`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const handleSaveTemplate = async () => {
    if (!selectedExam) return;
    if (subjectsState.length === 0) {
      alert("Lütfen en az 1 ders tanımlayınız.");
      return;
    }
    if (totalQuestions === 0) {
      alert("Toplam soru sayısı 0 olamaz.");
      return;
    }

    try {
      const currentKeys = selectedExam.keys || { A: [], B: [], C: [], D: [] };
      const newKeys: { [booklet: string]: string[] } = {};
      ['A', 'B', 'C', 'D'].forEach(bk => {
        const existing = currentKeys[bk] || [];
        const arr = Array(totalQuestions).fill("");
        for (let i = 0; i < Math.min(existing.length, totalQuestions); i++) {
          arr[i] = existing[i] || "";
        }
        newKeys[bk] = arr;
      });

      await updateExamOmr(String(selectedExam.id), {
        examType: 'internal',
        subjects: subjectsState,
        optionsCount: optionsCountState,
        penalty: penaltyState,
        layoutType: layoutTypeState,
        format: formatState,
        keys: newKeys
      });

      setSaveSuccessMessage("Sınav şablonu ve ders dağılımı başarıyla kaydedildi!");
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error("Şablon kaydedilirken hata:", err);
      alert("Şablon kaydedilirken bir hata oluştu: " + err.message);
    }
  };

  // ==========================================
  // TAB 3: BASKI, ÖNİZLEME VE FİLTRE STATE
  // ==========================================
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");
  const [onlyRegisteredFilter, setOnlyRegisteredFilter] = useState<boolean>(false);
  const [isColorMode, setIsColorMode] = useState<boolean>(true);
  const [previewScale, setPreviewScale] = useState<number>(1.0);
  const [previewStudentIndex, setPreviewStudentIndex] = useState<number>(0);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Öğrenci Kütüğünden Normalleştirilmiş Liste
  const normalizedStudents = useMemo<Student[]>(() => {
    const list = state.students || [];
    return list.map(s => {
      const { cls, sec } = formatClassSec(s.classStr || s.className, s.sectionStr);
      return {
        ...s,
        id: String(s.id || s.no),
        no: Number(s.no) || 0,
        name: s.name || '',
        className: s.className || (cls && sec ? `${cls}/${sec}` : cls || ''),
        classStr: cls || s.classStr || s.className || '',
        sectionStr: sec || s.sectionStr || '',
        booklet: s.booklet || 'A',
        isRegistered: s.isRegistered === true
      };
    });
  }, [state.students]);

  // Seçili Sınava Kayıtlı Öğrenci Sayısı
  const registeredStudentsCount = useMemo(() => {
    if (!selectedExamId) return 0;
    return normalizedStudents.filter(s => {
      if (s.examRegistrations && s.examRegistrations.some(r => String(r.examId) === String(selectedExamId))) return true;
      if (selectedExam?.studentList && selectedExam.studentList.some((st: any) => String(st.no) === String(s.no) || String(st.id) === String(s.id))) return true;
      if (s.isRegistered === true) return true;
      return false;
    }).length;
  }, [normalizedStudents, selectedExamId, selectedExam]);

  // Dinamik Sınıf/Şube Listesi
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    normalizedStudents.forEach(s => {
      const c = s.classStr?.trim();
      const sc = s.sectionStr?.trim();
      if (c && sc) {
        set.add(`${c}/${sc}`);
      } else if (c) {
        set.add(c);
      } else if (s.className) {
        set.add(s.className);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  }, [normalizedStudents]);

  // Filtrelenmiş Öğrenci Listesi
  const filteredStudents = useMemo(() => {
    let result = normalizedStudents;

    if (selectedClassFilter !== "ALL") {
      result = result.filter(s => {
        const fullClass = s.classStr && s.sectionStr ? `${s.classStr}/${s.sectionStr}` : (s.classStr || s.className || "");
        return fullClass === selectedClassFilter;
      });
    }

    if (onlyRegisteredFilter) {
      result = result.filter(s => {
        if (s.examRegistrations && s.examRegistrations.some(r => String(r.examId) === String(selectedExamId))) return true;
        if (selectedExam?.studentList && selectedExam.studentList.some((st: any) => String(st.no) === String(s.no) || String(st.id) === String(s.id))) return true;
        if (s.isRegistered === true) return true;
        return false;
      });
    }

    return result.sort((a, b) => {
      const clsDiff = (a.className || '').localeCompare(b.className || '', 'tr', { numeric: true });
      if (clsDiff !== 0) return clsDiff;
      return (Number(a.no) || 0) - (Number(b.no) || 0);
    });
  }, [normalizedStudents, selectedClassFilter, onlyRegisteredFilter, selectedExamId, selectedExam]);

  // Önizlenen Öğrenci
  const currentPreviewStudent = useMemo(() => {
    if (filteredStudents.length === 0) return null;
    const clampedIndex = Math.min(Math.max(0, previewStudentIndex), filteredStudents.length - 1);
    return filteredStudents[clampedIndex];
  }, [filteredStudents, previewStudentIndex]);

  // Sayfa indeksi değiştiğinde sınırla
  useEffect(() => {
    if (previewStudentIndex >= filteredStudents.length && filteredStudents.length > 0) {
      setPreviewStudentIndex(filteredStudents.length - 1);
    }
  }, [filteredStudents.length, previewStudentIndex]);

  // ==========================================
  // TOPLU BASKI MOTORU (BATCH PRINT ENGINE)
  // ==========================================
  const handleBatchPrint = async () => {
    if (filteredStudents.length === 0) {
      alert("Yazdırılacak öğrenci bulunamadı. Lütfen filtrelerinizi kontrol ediniz.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Lütfen tarayıcınızın açılır pencere (pop-up) engelleyicisine izin veriniz.");
      return;
    }

    setIsPrinting(true);

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8"/>
        <title>Karekodlu Optik Form Baskısı - ${selectedExam?.name || 'Sınav'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            text-align: center;
            padding-top: 15%;
            color: #334155;
            background-color: #f8fafc;
          }
          .spinner {
            display: inline-block;
            width: 44px;
            height: 44px;
            border: 4px solid #cbd5e1;
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h2 style="margin-top:18px; font-weight:900;">${filteredStudents.length} Öğrenci İçin Karekodlu A4 Optik Formlar Hazırlanıyor...</h2>
        <p style="color:#64748b; font-size:14px;">Lütfen yazdırma penceresi açılana kadar bekleyiniz.</p>
      </body>
      </html>
    `);
    printWindow.document.close();

    try {
      const options = (selectedExam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;
      const isTyt = isTytExam(selectedExam);
      const isAyt = isAytExam(selectedExam);
      const institutionName = selectedExam.institution || "KIRKLARELİ ATATÜRK ORTAOKULU";

      // Tek Merkezi Koordinat Motoru Standartları
      const renderOMR = OMR_SPECS;

      const { items: layoutItems, finalQBoxH, isSplit, hasFourSections } = getQuestionsLayout(selectedExam, renderOMR) as any;
      const themeColor = isColorMode ? '#dc2626' : '#0f172a';
      const themeBg = isColorMode ? '#fef2f2' : '#f8fafc';

      // Pre-generate QR data URLs for all students in parallel
      const qrDataUrls = await Promise.all(
        filteredStudents.map(student => {
          const qrData = `E:${selectedExam.id}|N:${student.no}`;
          return generateQrDataUrl(qrData, 160);
        })
      );

      let pagesHTML = '';

      filteredStudents.forEach((student, sIdx) => {
        const studentName = student.name || 'ÖĞRENCİ';
        const studentNo = student.no ? String(student.no) : '0';
        const studentClass = student.className || `${student.classStr || ''}/${student.sectionStr || ''}`;
        const qrDataUrl = qrDataUrls[sIdx] || '';
        const textFit = getStudentInfoFit(studentName, studentNo, studentClass);

        let questionsHTML = '';

        if (hasFourSections) {
          questionsHTML += `
            <div class="sec-badge" style="left: 1mm; width: 45.5mm;">${isTyt ? '1. TÜRKÇE TESTİ' : isAyt ? '1. EDEBİYAT - SOS-1' : '1. TEST ALANI'}</div>
            <div class="sec-badge" style="left: 48.5mm; width: 45.5mm;">${isTyt ? '2. SOSYAL BİLİMLER' : isAyt ? '2. SOSYAL BİLİMLER-2' : '2. TEST ALANI'}</div>
            <div class="sec-badge" style="left: 96mm; width: 45.5mm;">${isTyt ? '3. TEMEL MATEMATİK' : isAyt ? '3. MATEMATİK TESTİ' : '3. TEST ALANI'}</div>
            <div class="sec-badge" style="left: 143.5mm; width: 45.5mm;">${isTyt ? '4. FEN BİLİMLERİ' : isAyt ? '4. FEN BİLİMLERİ' : '4. TEST ALANI'}</div>
            <div class="sec-divider" style="left: 47.5mm;"></div>
            <div class="sec-divider" style="left: 95mm; border-right-width: 2px;"></div>
            <div class="sec-divider" style="left: 142.5mm;"></div>
          `;
        } else if (isSplit) {
          questionsHTML += `
            <div class="sec-badge" style="left: 1mm; width: 92.5mm;">1. BÖLÜM (SÖZEL ALAN)</div>
            <div class="sec-badge" style="left: 96.5mm; width: 92.5mm;">2. BÖLÜM (SAYISAL ALAN)</div>
            <div class="sec-divider" style="left: 95mm; border-right-width: 2px;"></div>
            <div class="sub-divider" style="left: 47.5mm;"></div>
            <div class="sub-divider" style="left: 142.5mm;"></div>
          `;
        } else {
          questionsHTML += `
            <div class="sub-divider" style="left: 47.5mm; top: 1mm;"></div>
            <div class="sub-divider" style="left: 95mm; top: 1mm;"></div>
            <div class="sub-divider" style="left: 142.5mm; top: 1mm;"></div>
          `;
        }

        layoutItems.forEach((item: any, qIdx: number) => {
          const topY = item.y - renderOMR.qBox.y;
          const colW = renderOMR.questions.colW;
          const colLeft = item.cIdx * colW;

          if (item.type === 'header') {
            questionsHTML += `
              <div class="q-header" style="left: ${colLeft + 1}mm; top: ${topY}mm; width: ${colW - 2}mm; height: ${item.h}mm;">
                ${item.text}
              </div>
            `;
          } else {
            const qNumLeft = colLeft + (renderOMR.questions.qNumOffset ?? 1.0);
            const qNumWidth = renderOMR.questions.qNumWidth ?? 7.0;
            const qNumber = (item.localIdx !== undefined ? item.localIdx + 1 : (item.qIdx !== undefined ? item.qIdx + 1 : 1));

            questionsHTML += `
              <div class="q-num" style="left: ${qNumLeft}mm; top: ${topY}mm; width: ${qNumWidth}mm;">
                ${qNumber}.
              </div>
            `;

            options.forEach((o: string, optIdx: number) => {
              const centerX = colLeft + renderOMR.questions.startXOffset + (optIdx * renderOMR.questions.bubbleGap);
              questionsHTML += `
                <div class="bubble" style="left: ${centerX}mm; top: ${topY}mm;">
                  ${o}
                </div>
              `;
            });
          }
        });

        pagesHTML += `
          <div class="optik-page">
            <!-- 4 Köşe Siyah Optik Çapa İşareti (8x8mm, 10mm kenar payı) -->
            <div class="anchor-mark" style="left: ${OMR_SPECS.anchorMargin}mm; top: ${OMR_SPECS.anchorMargin}mm;">
              <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style="display:block;"><rect width="10" height="10" fill="#000000"/></svg>
            </div>
            <div class="anchor-mark" style="left: ${OMR_SPECS.paperW - OMR_SPECS.anchorMargin}mm; top: ${OMR_SPECS.anchorMargin}mm;">
              <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style="display:block;"><rect width="10" height="10" fill="#000000"/></svg>
            </div>
            <div class="anchor-mark" style="left: ${OMR_SPECS.anchorMargin}mm; top: ${OMR_SPECS.paperH - OMR_SPECS.anchorMargin}mm;">
              <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style="display:block;"><rect width="10" height="10" fill="#000000"/></svg>
            </div>
            <div class="anchor-mark" style="left: ${OMR_SPECS.paperW - OMR_SPECS.anchorMargin}mm; top: ${OMR_SPECS.paperH - OMR_SPECS.anchorMargin}mm;">
              <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style="display:block;"><rect width="10" height="10" fill="#000000"/></svg>
            </div>

            <!-- Kurum ve Sınav Başlığı -->
            <div class="header-box" style="left: ${renderOMR.header.x}mm; top: ${renderOMR.header.y}mm; width: ${renderOMR.header.w}mm; height: ${renderOMR.header.h}mm;">
              <h1>${institutionName}</h1>
              <h2>${selectedExam.name} • ${selectedExam.date || new Date().toLocaleDateString('tr-TR')}</h2>
            </div>

            <!-- Öğrenci Bilgi ve Karekod Alanı -->
            <div class="info-box" style="left: ${renderOMR.infoBox.x}mm; top: ${renderOMR.infoBox.y}mm; width: ${renderOMR.infoBox.w}mm; height: ${renderOMR.infoBox.h}mm;">
              <div class="info-content">
                <div class="student-details" style="max-width: 95mm; min-width: 0;">
                  <div class="st-name" style="${textFit.printStyleStr}">${studentName}</div>
                  <div class="st-meta" style="font-size: ${textFit.metaFontSize};">
                    <div>ÖĞRENCİ NO: <span class="st-bold-no" style="${textFit.noStyleStr}">${studentNo}</span></div>
                    <div>SINIF / ŞUBE: <span class="st-bold" style="${textFit.classStyleStr}">${studentClass}</span></div>
                  </div>
                  <div class="st-note">* Kodlamalarınızı kurşun kalemle, dairelerin dışına taşırmadan yapınız.</div>
                </div>

                <div class="booklet-label">KİTAPÇIK TÜRÜ</div>
                <div class="info-bubble" style="left: 135mm; top: 18mm;">A</div>
                <div class="info-bubble" style="left: 142mm; top: 18mm;">B</div>
                <div class="info-bubble" style="left: 149mm; top: 18mm;">C</div>
                <div class="info-bubble" style="left: 156mm; top: 18mm;">D</div>

                <div class="qr-container" style="left: 160mm; top: 3.5mm; width: 25mm; height: 25mm;">
                  ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width: 25mm; height: 25mm; display: block;"/>` : ''}
                </div>
              </div>
            </div>

            <!-- Soru ve Cevap Alanı -->
            <div class="q-box" style="left: ${renderOMR.qBox.x}mm; top: ${renderOMR.qBox.y}mm; width: ${renderOMR.qBox.w}mm; height: ${finalQBoxH}mm;">
              ${questionsHTML}
            </div>

            <!-- Dipnot -->
            <div class="footer-text">
              ${institutionName} • ${selectedExam.name} • KAREKODLU AKILLI OPTİK FORM
            </div>
          </div>
        `;
      });

      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="utf-8"/>
          <title>${selectedExam.name} - Toplu Karekodlu Optik Formlar</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .optik-page {
              width: 210mm;
              height: 297mm;
              page-break-after: always;
              position: relative;
              overflow: hidden;
              background-color: #fff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            .optik-page:last-child {
              page-break-after: auto;
            }
            .anchor-mark {
              width: 8mm;
              height: 8mm;
              background-color: #000 !important;
              background: #000 !important;
              position: absolute;
              transform: translate(-50%, -50%);
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              box-shadow: inset 0 0 0 5mm #000000 !important;
              overflow: hidden;
              z-index: 50;
              display: block !important;
            }
            .header-box {
              position: absolute;
              border: 2px solid ${themeColor};
              background-color: #f8fafc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 2px 8px;
            }
            .header-box h1 {
              font-size: 12px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              color: ${themeColor};
              line-height: 1;
              margin: 0;
            }
            .header-box h2 {
              font-size: 8px;
              font-weight: 700;
              color: #334155;
              margin-top: 2px;
              letter-spacing: 0.5px;
            }
            .info-box {
              position: absolute;
              border: 2px solid ${themeColor};
              background-color: #fff;
            }
            .info-content {
              position: relative;
              width: 100%;
              height: 100%;
              padding: 10px;
            }
            .student-details {
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 4px;
              padding-left: 8px;
            }
            .st-name {
              font-size: 13px;
              font-weight: 900;
              color: #0f172a;
              letter-spacing: -0.2px;
            }
            .st-meta {
              display: flex;
              gap: 16px;
              font-size: 10px;
              font-weight: 700;
              color: #475569;
            }
            .st-bold-no {
              font-size: 12px;
              color: #000;
              font-family: monospace;
              font-weight: 800;
            }
            .st-bold {
              font-size: 12px;
              color: #000;
              font-weight: 800;
            }
            .st-note {
              font-size: 7.5px;
              color: #94a3b8;
              font-weight: 500;
            }
            .booklet-label {
              position: absolute;
              font-size: 8px;
              font-weight: 800;
              text-align: center;
              width: 30mm;
              left: 145.5mm;
              top: 7.5mm;
              transform: translateX(-50%);
              color: #1e293b;
            }
            .info-bubble {
              position: absolute;
              width: 4.8mm;
              height: 4.8mm;
              border: 1.2px solid ${themeColor};
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              font-weight: 800;
              color: #0f172a;
              background-color: #fff;
              line-height: 1;
              transform: translate(-50%, -50%);
            }
            .qr-container {
              position: absolute;
              left: 160mm;
              top: 3.5mm;
              width: 25mm;
              height: 25mm;
              border: 2px solid #0f172a;
              padding: 1px;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .q-box {
              position: absolute;
              border: 2px solid ${themeColor};
              background-color: #fff;
            }
            .sec-badge {
              position: absolute;
              top: 1.2mm;
              height: 5.2mm;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: ${themeBg};
              color: ${themeColor};
              font-weight: 900;
              font-size: 7.5px;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              border: 1px solid ${themeColor};
              border-radius: 2px;
              text-align: center;
              overflow: hidden;
              white-space: nowrap;
            }
            .sec-divider {
              position: absolute;
              top: 0;
              bottom: 0;
              border-right: 1.5px solid ${themeColor};
            }
            .sub-divider {
              position: absolute;
              top: 7.5mm;
              bottom: 1mm;
              border-right: 1px dashed #e2e8f0;
            }
            .q-header {
              position: absolute;
              font-weight: 900;
              font-size: 7.5px;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              text-align: center;
              color: ${themeColor};
              background-color: ${themeBg};
              border-top: 1px solid ${themeColor};
              border-bottom: 1px solid ${themeColor};
              display: flex;
              align-items: center;
              justify-content: center;
              transform: translateY(-50%);
              overflow: hidden;
              white-space: nowrap;
            }
            .q-num {
              position: absolute;
              font-family: monospace;
              font-weight: 700;
              font-size: 8.5px;
              color: ${themeColor};
              text-align: right;
              padding-right: 2px;
              transform: translateY(-50%);
              line-height: 1;
            }
            .bubble {
              position: absolute;
              width: 3.6mm;
              height: 3.6mm;
              border: 1.1px solid ${themeColor};
              border-radius: 9999px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 6.8px;
              font-weight: 700;
              color: #0f172a;
              background-color: #fff;
              line-height: 1;
              transform: translate(-50%, -50%);
            }
            .footer-text {
              position: absolute;
              font-size: 7.5px;
              font-weight: 700;
              letter-spacing: 1.5px;
              color: #94a3b8;
              text-transform: uppercase;
              text-align: center;
              width: 100%;
              bottom: 6.5mm;
              left: 0;
            }
          </style>
        </head>
        <body>
          ${pagesHTML}
        </body>
        </html>
      `);
      printWindow.document.close();

      setIsPrinting(false);

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } catch (err: any) {
      console.error("Baskı oluşturulurken hata:", err);
      setIsPrinting(false);
      setSaveSuccessMessage("Baskı sayfası hazırlanırken bir hata oluştu: " + err.message);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    }
  };

  return (
    <div className="bg-slate-50 min-h-full flex flex-col gap-4 pb-12 p-3 sm:p-6 font-sans">
      
      {/* =========================================================================
          ÜST PANEL: SINAV SEÇİCİ VE 3'LÜ ÇALIŞMA MODÜLÜ SWITCHER
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Cevap Anahtarı & Optik Form Baskı Merkezi
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                Kurum İçi Akıllı Optik Sistem
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
              Sınavınızın ders ve soru yapısını yapılandırın, 4 kitapçık cevap anahtarını tanımlayın ve her öğrenciye özel karekodlu A4 optik form üretin.
            </p>
          </div>
        </div>

        {/* Sağ Alan: Sınav Seçici */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Kurum İçi Sınav Seçici Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 transition-all p-1.5 pl-3 rounded-xl border border-slate-200/90 shadow-2xs">
            <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">Aktif Sınav:</span>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer max-w-[260px] truncate shadow-2xs transition-all"
            >
              {internalExams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.examType === 'internal' ? '🎯' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3'LÜ ANA MODÜL SEKMELERİ (Modern Step-Based Tab Switcher)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Aşama 1: Sınav Şablonu */}
        <button
          type="button"
          onClick={() => setActiveTab('template')}
          className={`relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer group select-none ${
            activeTab === 'template'
              ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white border-purple-600 shadow-md shadow-purple-600/20 ring-2 ring-purple-600/30'
              : 'bg-white hover:bg-slate-50/90 text-slate-700 border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            activeTab === 'template' 
              ? 'bg-white/20 text-white shadow-inner' 
              : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:scale-105'
          }`}>
            <Settings2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                activeTab === 'template' ? 'bg-white/20 text-purple-100' : 'bg-slate-100 text-slate-500'
              }`}>
                1. AŞAMA
              </span>
              <span className={`text-[11px] font-bold ${activeTab === 'template' ? 'text-purple-100' : 'text-slate-400'}`}>
                {totalQuestions} Soru
              </span>
            </div>
            <div className="text-sm font-black truncate">
              Sınav Şablonu & Dersler
            </div>
            <div className={`text-[11px] mt-0.5 truncate ${activeTab === 'template' ? 'text-purple-100/90' : 'text-slate-500'}`}>
              Ders ekle, soru sayısı ve oturumları düzenle
            </div>
          </div>
          {activeTab === 'template' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-xs"></div>
          )}
        </button>

        {/* Aşama 2: Cevap Anahtarları */}
        <button
          type="button"
          onClick={() => setActiveTab('keys')}
          className={`relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer group select-none ${
            activeTab === 'keys'
              ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white border-purple-600 shadow-md shadow-purple-600/20 ring-2 ring-purple-600/30'
              : 'bg-white hover:bg-slate-50/90 text-slate-700 border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            activeTab === 'keys' 
              ? 'bg-white/20 text-white shadow-inner' 
              : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 group-hover:scale-105'
          }`}>
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                activeTab === 'keys' ? 'bg-white/20 text-purple-100' : 'bg-slate-100 text-slate-500'
              }`}>
                2. AŞAMA
              </span>
              <span className={`text-[11px] font-bold ${activeTab === 'keys' ? 'text-purple-100' : 'text-slate-400'}`}>
                A-B-C-D
              </span>
            </div>
            <div className="text-sm font-black truncate">
              Cevap Anahtarları
            </div>
            <div className={`text-[11px] mt-0.5 truncate ${activeTab === 'keys' ? 'text-purple-100/90' : 'text-slate-500'}`}>
              Kitapçık doğru şıklarını seri/matris gir
            </div>
          </div>
          {activeTab === 'keys' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-xs"></div>
          )}
        </button>

        {/* Aşama 3: Baskı & Önizleme */}
        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer group select-none ${
            activeTab === 'print'
              ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 text-white border-purple-600 shadow-md shadow-purple-600/20 ring-2 ring-purple-600/30'
              : 'bg-white hover:bg-slate-50/90 text-slate-700 border-slate-200/90 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            activeTab === 'print' 
              ? 'bg-white/20 text-white shadow-inner' 
              : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:scale-105'
          }`}>
            <Printer className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                activeTab === 'print' ? 'bg-white/20 text-purple-100' : 'bg-emerald-100 text-emerald-800'
              }`}>
                3. AŞAMA • CANLI ÖNİZLEME
              </span>
              <span className={`text-[11px] font-bold ${activeTab === 'print' ? 'text-purple-100' : 'text-slate-400'}`}>
                {filteredStudents.length} Form
              </span>
            </div>
            <div className="text-sm font-black truncate">
              Optik Form Baskı & PDF
            </div>
            <div className={`text-[11px] mt-0.5 truncate ${activeTab === 'print' ? 'text-purple-100/90' : 'text-slate-500'}`}>
              Öğrenciye özel QR kodlu A4 form bas
            </div>
          </div>
          {activeTab === 'print' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-xs"></div>
          )}
        </button>
      </div>

      {/* =========================================================================
          SEKME 1: SINAV ŞABLONU & DERS DAĞILIMI
          ========================================================================= */}
      {activeTab === 'template' && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
          
          {/* Bildirim Toast */}
          {saveSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* =========================================================================
              KULLANICI DOSTU GELİŞMİŞ HAZIR ŞABLON SEÇİM MENÜSÜ (Interactive Preset Cards)
              ========================================================================= */}
          <div className="bg-gradient-to-br from-slate-50 via-purple-50/40 to-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-purple-100/90 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-purple-100/80">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight">
                    Hazır Deneme Sınav Şablonları
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Müfredata tam uyumlu ders dağılımı ve soru sayılarını tek tıkla şablon olarak yükleyin.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100/80 px-2.5 py-1 rounded-full w-fit">
                ⚡ Hızlı Kurulum
              </span>
            </div>

            {/* Şablon Kartları Menü Izgarası */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {PRESET_TEMPLATES.map((preset, idx) => {
                const isCurrentMatch = totalQuestions === preset.subjects.reduce((a, b) => a + b.count, 0) &&
                                       formatState === preset.format &&
                                       optionsCountState === preset.optionsCount;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(idx)}
                    className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between gap-2 select-none ${
                      isCurrentMatch
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-500/25 ring-2 ring-purple-500/20'
                        : 'bg-white hover:bg-purple-50/60 text-slate-800 border-slate-200/90 hover:border-purple-300 shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isCurrentMatch ? 'bg-white/25 text-white' : 'bg-purple-100/80 text-purple-800'
                        }`}>
                          {preset.format.toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold ${isCurrentMatch ? 'text-purple-100' : 'text-slate-400'}`}>
                          {preset.optionsCount} Şık
                        </span>
                      </div>
                      <div className="text-xs font-black leading-tight line-clamp-2">
                        {preset.name}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100/80 border-dashed">
                      <span className={`font-mono font-bold ${isCurrentMatch ? 'text-purple-100' : 'text-purple-700'}`}>
                        {preset.subjects.reduce((sum, s) => sum + s.count, 0)} Soru
                      </span>
                      <span className={`text-[10px] font-semibold ${isCurrentMatch ? 'text-white' : 'text-slate-500 group-hover:text-purple-700'}`}>
                        {isCurrentMatch ? '✓ Aktif Şablon' : 'Uygula →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Genel Sınav Ayarları Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                Genel Sınav & Optik Form Ayarları
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              
              {/* Seçenek Sayısı */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs">
                <div>
                  <label className="text-xs font-black text-slate-800 block">Seçenek Sayısı</label>
                  <p className="text-[11px] text-slate-500">Sorulardaki şık adedi</p>
                </div>
                <select
                  value={optionsCountState}
                  onChange={(e) => setOptionsCountState(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value={4}>4 Şık (A, B, C, D) - LGS / Ortaokul</option>
                  <option value={5}>5 Şık (A, B, C, D, E) - YKS / Lise</option>
                </select>
              </div>

              {/* Yanlış Götürme Oranı */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs">
                <div>
                  <label className="text-xs font-black text-slate-800 block">Yanlış Götürme Oranı</label>
                  <p className="text-[11px] text-slate-500">Net hesaplama cezası</p>
                </div>
                <select
                  value={penaltyState}
                  onChange={(e) => setPenaltyState(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value={3}>3 Yanlış 1 Doğruyu Götürür (LGS)</option>
                  <option value={4}>4 Yanlış 1 Doğruyu Götürür (YKS)</option>
                  <option value={0}>Yanlışlar Doğruyu Götürmez (Ceza Yok)</option>
                </select>
              </div>

              {/* Form Sütun Düzeni */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs">
                <div>
                  <label className="text-xs font-black text-slate-800 block">Optik Form Düzeni</label>
                  <p className="text-[11px] text-slate-500">A4 kağıt sütun yapısı</p>
                </div>
                <select
                  value={layoutTypeState}
                  onChange={(e) => setLayoutTypeState(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value="split">Çift Sütun (Sözel 1. Bölüm / Sayısal 2. Bölüm)</option>
                  <option value="standard">Standart Tek Blok / Düz 4 Sütun</option>
                </select>
              </div>

              {/* Format / Puanlama Türü */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col justify-between gap-2 shadow-2xs">
                <div>
                  <label className="text-xs font-black text-slate-800 block">Format & Puanlama</label>
                  <p className="text-[11px] text-slate-500">Puan katsayı formülü</p>
                </div>
                <select
                  value={formatState}
                  onChange={(e) => setFormatState(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-2xs"
                >
                  <option value="lgs">LGS Standart (500 Üzerinden)</option>
                  <option value="mebi">MEBİ / Kazanım Değerlendirme</option>
                  <option value="tyt">TYT (500 Üzerinden)</option>
                  <option value="ayt">AYT (500 Üzerinden)</option>
                </select>
              </div>

            </div>
          </div>

          {/* Ders Dağılım Listesi ve Yapılandırma */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ders Dağılımı ve Soru Sayıları
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toplam Soru: <strong className="text-purple-700 font-mono text-sm">{totalQuestions}</strong> soru ({subjectsState.length} ders)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddSubject}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Ders Ekle</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Ders Adı</th>
                      <th className="p-3 w-36">Soru Sayısı</th>
                      <th className="p-3 w-48">Oturum / Bölüm</th>
                      <th className="p-3 w-20 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {subjectsState.map((sub, idx) => (
                      <tr key={sub.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={sub.name}
                            onChange={(e) => handleUpdateSubject(idx, 'name', e.target.value)}
                            placeholder="Ders Adı"
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={sub.count}
                            onChange={(e) => handleUpdateSubject(idx, 'count', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={sub.section || 1}
                            onChange={(e) => handleUpdateSubject(idx, 'section', parseInt(e.target.value) || 1)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                          >
                            <option value={1}>1. Bölüm (Sözel)</option>
                            <option value={2}>2. Bölüm (Sayısal)</option>
                            <option value={3}>3. Bölüm / Ek Oturum</option>
                            <option value={4}>4. Bölüm / Ek Oturum</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveSubject(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Dersi Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Kaydet Alt Barı */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              * Şablonu kaydettiğinizde soru sayısı değişiklikleri cevap anahtarlarına ve optik form yerleşimine anında yansır.
            </div>
            <button
              type="button"
              onClick={handleSaveTemplate}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Şablonu ve Dersleri Kaydet</span>
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          SEKME 2: DERS DERS CEVAP ANAHTARI (A-B-C-D)
          ========================================================================= */}
      {activeTab === 'keys' && selectedExam && (
        <KeysTab examId={String(selectedExam.id)} />
      )}

      {/* =========================================================================
          SEKME 3: ÖĞRENCİYE ÖZEL KAREKODLU OPTİK FORM BASKISI & CANLI ÖNİZLEME
          ========================================================================= */}
      {activeTab === 'print' && selectedExam && (
        <div className="flex flex-col gap-4">
          
          {/* BASKI VE FİLTRELEME ARAÇ ÇUBUĞU */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col gap-4">
            
            {/* Üst Satır: Başlık, Durum ve Toplu Yazdır Ana Butonu */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Karekodlu A4 Optik Form Baskı Merkezi
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                      {filteredStudents.length} Öğrenci Seçili
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Her öğrenci için benzersiz QR kod basılır; canlı kamera taramasında öğrenci ve cevap anahtarı anında tanınır.
                  </p>
                </div>
              </div>

              {/* Toplu Yazdır Butonu */}
              <button
                type="button"
                onClick={handleBatchPrint}
                disabled={isPrinting || filteredStudents.length === 0}
                className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>
                  {isPrinting 
                    ? 'Baskı Hazırlanıyor...' 
                    : `🖨️ Toplu Form Yazdır / PDF İndir (${filteredStudents.length} Öğrenci)`}
                </span>
              </button>
            </div>

            {/* Alt Satır: Filtreler ve Renk Modu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              
              {/* Sınıf / Şube Filtresi */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1">
                  <Filter className="w-3.5 h-3.5 text-purple-600" />
                  Sınıf / Şube Seçimi
                </label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => {
                    setSelectedClassFilter(e.target.value);
                    setPreviewStudentIndex(0);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="ALL">Tüm Okul ({normalizedStudents.length} Öğrenci)</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>
                      {cls} Şubesi ({normalizedStudents.filter(s => (s.classStr && s.sectionStr ? `${s.classStr}/${s.sectionStr}` : (s.classStr || s.className || "")) === cls).length} Öğrenci)
                    </option>
                  ))}
                </select>
              </div>

              {/* Sadece Kayıtlılar Filtresi Butonu */}
              <button
                type="button"
                onClick={() => {
                  setOnlyRegisteredFilter(prev => !prev);
                  setPreviewStudentIndex(0);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left select-none ${
                  onlyRegisteredFilter
                    ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
                title="Sadece bu sınava kayıtlı öğrencileri filtrele"
              >
                <div className="min-w-0 pr-2">
                  <span className={`text-[11px] font-bold block ${onlyRegisteredFilter ? 'text-purple-900' : 'text-slate-700'}`}>
                    Sadece Sınava Kayıtlılar
                  </span>
                  <span className={`text-[10px] block truncate mt-0.5 ${onlyRegisteredFilter ? 'text-purple-700 font-semibold' : 'text-slate-500'}`}>
                    {registeredStudentsCount > 0 ? `${registeredStudentsCount} Kayıtlı Öğrenci` : 'Sınava kayıtlı öğrenci yok'}
                  </span>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                  onlyRegisteredFilter 
                    ? 'bg-purple-600 border-purple-600 text-white shadow-2xs' 
                    : 'bg-white border-slate-300 text-transparent'
                }`}>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </button>

              {/* Renk Modu: Optik Kırmızı vs Siyah-Beyaz */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  Baskı Renk Modu
                </label>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setIsColorMode(true)}
                    className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      isColorMode ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔴 Kırmızı Optik
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsColorMode(false)}
                    className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      !isColorMode ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⚫ Siyah-Beyaz
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* ÖĞRENCİ GEZİNME VE CANLI A4 ÖNİZLEME ALANI */}
          <div className="bg-slate-900/5 border border-slate-200/80 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[500px] overflow-x-auto relative">
            
            {/* Öğrenci Seçici Gezinme Barı */}
            {filteredStudents.length > 0 && (
              <div className="w-full max-w-xl bg-white rounded-xl p-2.5 mb-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewStudentIndex(prev => Math.max(0, prev - 1))}
                  disabled={previewStudentIndex <= 0}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer text-slate-700"
                  title="Önceki Öğrenci"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2 text-center truncate">
                  <Users className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">
                    Öğrenci {previewStudentIndex + 1} / {filteredStudents.length}:
                    <strong className="text-purple-700 ml-1">
                      {currentPreviewStudent?.name} ({currentPreviewStudent?.className || 'Şube Yok'} - No: {currentPreviewStudent?.no})
                    </strong>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline-block shrink-0">
                    Önizleme: %100 A4
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewStudentIndex(prev => Math.min(filteredStudents.length - 1, prev + 1))}
                  disabled={previewStudentIndex >= filteredStudents.length - 1}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer text-slate-700"
                  title="Sonraki Öğrenci"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Ölçeklendirilmiş Canlı A4 Form Önizlemesi */}
            <div 
              className="transition-transform origin-top duration-200 my-2"
              style={{
                transform: `scale(${previewScale})`,
                marginBottom: `${-(297 * 3.7795 * (1 - previewScale))}px`,
                marginRight: `${-(210 * 3.7795 * (1 - previewScale))}px`
              }}
            >
              <LiveOmrSheet
                exam={selectedExam}
                student={currentPreviewStudent}
                isColorMode={isColorMode}
              />
            </div>

            {filteredStudents.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center border border-slate-200 max-w-md my-8">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-sm">Seçili Filtreye Uygun Öğrenci Bulunamadı</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Lütfen yukarıdaki sınıf filtresini veya 'Sadece Kayıtlılar' onay kutusunu kontrol ediniz.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {!selectedExam && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">Kurum İçi Sınav Bulunamadı</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Lütfen önce 'Sınav Takvimi' ekranından <strong>'Kurum İçi Optik Deneme'</strong> türünde yeni bir sınav ekleyiniz.
          </p>
        </div>
      )}

    </div>
  );
}

export default KeysAndPrintView;
