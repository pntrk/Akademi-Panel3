import React, { useState, useMemo } from 'react';
import { Exam, Student } from '../../types';
import { LocalQRCode } from './LocalQRCode';
import { DEFAULT_OMR, OMR_SPECS, OPTS_4, OPTS_5, getQuestionsLayout, isTytExam, isAytExam, formatClassSec, getStudentInfoFit } from '../../lib/omrEngine';
import { useAppContext } from '../../context/AppContext';
import { Printer, List, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PrintLayoutProps {
  exam: Exam;
  isColorMode: boolean;
  student: Student | null;
}

export function PrintLayout({ exam, isColorMode, student }: PrintLayoutProps) {
  const options = (exam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;
  const isTyt = isTytExam(exam);
  const isAyt = isAytExam(exam);

  // Merkezi standart OMR koordinat motoru
  const renderOMR = OMR_SPECS;

  const { items: layoutItems, finalQBoxH, isSplit, hasFourSections } = getQuestionsLayout(exam, renderOMR) as any;

  const themeColor = isColorMode ? '#ef4444' : '#000000';
  const themeBg = isColorMode ? '#fef2f2' : '#e5e7eb';

  const studentName = student?.name || "...................................................";
  const studentNo = student?.no ? String(student.no) : "...................";
  const studentClass = student ? `${student.classStr || ''} / ${student.sectionStr || ''}` : "...................";
  const qrData = student
    ? `E:${exam.id}|N:${student.no}`
    : `E:${exam.id}|N:1001`;

  const textFit = getStudentInfoFit(studentName, studentNo, studentClass);

  return (
    <div
      className="optik-page bg-white text-black font-sans relative select-none"
      style={{
        width: '210mm',
        height: '297mm',
        ['--print-color' as any]: themeColor,
        ['--print-bg' as any]: themeBg
      }}
    >
      <style>{`
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
        }
        .bubble {
          width: 4.8mm;
          height: 3.4mm;
          border: 1.2px solid var(--print-color, #000);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 7px;
          font-weight: 700;
          background-color: #fff;
          line-height: 1;
        }
        .info-bubble {
          width: 5.4mm;
          height: 5.4mm;
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

      {/* 4 Köşe Siyah Optik Çapa İşaretleri (Kamera Hizalama İçin 8x8mm SVG vektör dolgulu) */}
      <div className="anchor-mark" style={{ left: `${DEFAULT_OMR.anchorMargin}mm`, top: `${DEFAULT_OMR.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin}mm`, top: `${DEFAULT_OMR.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${DEFAULT_OMR.anchorMargin}mm`, top: `${DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>
      <div className="anchor-mark" style={{ left: `${DEFAULT_OMR.paperW - DEFAULT_OMR.anchorMargin}mm`, top: `${DEFAULT_OMR.paperH - DEFAULT_OMR.anchorMargin}mm` }}>
        <svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
          <rect width="10" height="10" fill="#000000" />
        </svg>
      </div>

      {/* Sınav ve Kurum Üst Başlığı (Köşe çapalardan bağımsız, 16.5mm'den başlar) */}
      <div
        className="absolute border-[2px] print-border bg-gray-50 flex items-center justify-between px-3 py-1"
        style={{ left: `${renderOMR.header.x}mm`, top: `${renderOMR.header.y}mm`, width: `${renderOMR.header.w}mm`, height: `${renderOMR.header.h}mm` }}
      >
        <img
          src={exam.logo || "logo.png"}
          alt="Logo"
          style={{ maxHeight: '7mm', maxWidth: '20mm', objectFit: 'contain', filter: 'grayscale(100%)' }}
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          <h1 className="text-[12px] font-black uppercase tracking-widest print-text leading-none">{exam.institution || "EĞİTİM KURUMU"}</h1>
          <h2 className="text-[8px] font-bold text-slate-600 mt-0.5 tracking-wider">{exam.name} • {exam.date || "Tarih Yok"}</h2>
        </div>
      </div>

      {/* Öğrenciye Özel Karekodlu Bilgi Kutusu */}
      <div
        className="absolute border-[2px] print-border bg-white"
        style={{ left: `${renderOMR.infoBox.x}mm`, top: `${renderOMR.infoBox.y}mm`, width: `${renderOMR.infoBox.w}mm`, height: `${renderOMR.infoBox.h}mm` }}
      >
        <div className="flex p-2.5 gap-3 h-full items-center justify-between relative">
          <div className="flex-1 flex flex-col justify-center gap-1 pl-2 min-w-0">
            <div 
              className="font-black tracking-tight text-slate-900 truncate max-w-[85mm]"
              style={textFit.style}
              title={studentName}
            >
              {studentName}
            </div>
            <div className="flex items-center gap-3.5 font-bold text-slate-600 mt-0.5" style={{ fontSize: textFit.metaFontSize }}>
              <div>ÖĞRENCİ NO: <span className="text-black font-mono font-bold" style={{ fontSize: textFit.noFontSize }}>{studentNo}</span></div>
              <div>SINIF / ŞUBE: <span className="text-black font-bold" style={{ fontSize: textFit.classFontSize }}>{studentClass}</span></div>
            </div>
            <div className="text-[7.5px] text-slate-400 font-medium truncate">
              * Kodlamalarınızı kurşun kalemle, dairelerin dışına taşırmadan yapınız.
            </div>
          </div>

          {/* Kitapçık Türü */}
          <div className="absolute text-[8px] font-bold text-center w-[30mm] -translate-x-1/2" style={{ left: `${renderOMR.infoBox.booklet.startX + 10.5}mm`, top: '5.5mm' }}>
            KİTAPÇIK TÜRÜ
          </div>
          {["A", "B", "C", "D"].map((b, idx) => {
            const bx = renderOMR.infoBox.booklet.startX + (idx * renderOMR.infoBox.booklet.gap);
            const by = renderOMR.infoBox.booklet.y;
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

          {/* Öğrenci Karekodu */}
          <div 
            className="absolute border-2 border-slate-900 p-0.5 bg-white flex flex-col items-center justify-center"
            style={{ 
              left: `${renderOMR.infoBox.qrCode.x}mm`, 
              top: `${renderOMR.infoBox.qrCode.y}mm`, 
              width: `${renderOMR.infoBox.qrCode.size}mm`, 
              height: `${renderOMR.infoBox.qrCode.size}mm` 
            }}
          >
            <LocalQRCode data={qrData} size={150} />
          </div>
        </div>
      </div>

      {/* Soru ve Cevap Optik Kabarcık Alanı (Alt köşe çapalarla çakışmaz; 276mm'de biter) */}
      <div
        className="absolute border-[2px] print-border bg-white"
        style={{ left: `${renderOMR.qBox.x}mm`, top: `${renderOMR.qBox.y}mm`, width: `${renderOMR.qBox.w}mm`, height: `${finalQBoxH}mm` }}
      >
        {/* Bölüm Başlık Şeritleri (TYT / AYT 4 Bölüm veya Standart Split Mod) */}
        {hasFourSections ? (
          <>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: '0.8mm', width: `${renderOMR.questions.colW - 1.6}mm` }}
            >
              {isTyt ? '1. TÜRKÇE TESTİ' : isAyt ? '1. EDEBİYAT - SOS-1' : '1. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: `${renderOMR.questions.colW + 0.8}mm`, width: `${renderOMR.questions.colW - 1.6}mm` }}
            >
              {isTyt ? '2. SOSYAL BİLİMLER' : isAyt ? '2. SOSYAL BİLİMLER-2' : '2. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: `${(renderOMR.questions.colW * 2) + 0.8}mm`, width: `${renderOMR.questions.colW - 1.6}mm` }}
            >
              {isTyt ? '3. TEMEL MATEMATİK' : isAyt ? '3. MATEMATİK TESTİ' : '3. TEST ALANI'}
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[7px] tracking-wider uppercase border print-border rounded-xs px-1 text-center truncate"
              style={{ left: `${(renderOMR.questions.colW * 3) + 0.8}mm`, width: `${renderOMR.questions.colW - 1.6}mm` }}
            >
              {isTyt ? '4. FEN BİLİMLERİ' : isAyt ? '4. FEN BİLİMLERİ' : '4. TEST ALANI'}
            </div>
          </>
        ) : isSplit ? (
          <>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[8px] tracking-wider uppercase border print-border rounded-sm"
              style={{ left: '0.8mm', width: `${(renderOMR.questions.colW * 2) - 1.6}mm` }}
            >
              1. BÖLÜM (SÖZEL ALAN)
            </div>
            <div
              className="absolute top-[1.2mm] h-[5.2mm] flex items-center justify-center print-bg print-text font-black text-[8px] tracking-wider uppercase border print-border rounded-sm"
              style={{ left: `${(renderOMR.questions.colW * 2) + 0.8}mm`, width: `${(renderOMR.questions.colW * 2) - 1.6}mm` }}
            >
              2. BÖLÜM (SAYISAL ALAN)
            </div>
          </>
        ) : null}

        {/* Ana Seksiyon Ayraçları */}
        {hasFourSections ? (
          <>
            <div className="absolute top-0 bottom-0 border-r-[1.5px] print-border" style={{ left: `${renderOMR.questions.colW}mm` }} />
            <div className="absolute top-0 bottom-0 border-r-[2px] print-border" style={{ left: `${renderOMR.questions.colW * 2}mm` }} />
            <div className="absolute top-0 bottom-0 border-r-[1.5px] print-border" style={{ left: `${renderOMR.questions.colW * 3}mm` }} />
          </>
        ) : isSplit ? (
          <>
            <div className="absolute top-0 bottom-0 border-r-[2px] print-border" style={{ left: `${renderOMR.questions.colW * 2}mm` }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: `${renderOMR.questions.colW}mm`, top: '7.5mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: `${renderOMR.questions.colW * 3}mm`, top: '7.5mm', bottom: '1mm' }} />
          </>
        ) : (
          <>
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: `${renderOMR.questions.colW}mm`, top: '1mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: `${renderOMR.questions.colW * 2}mm`, top: '1mm', bottom: '1mm' }} />
            <div className="absolute border-r border-dashed border-slate-200 pointer-events-none" style={{ left: `${renderOMR.questions.colW * 3}mm`, top: '1mm', bottom: '1mm' }} />
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
              {/* Soru Numarası: Her zaman tam hesaplanmış koordinat ile hizalanır */}
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
        {exam.institution || "EĞİTİM KURUMU"} • {exam.name} • KAREKODLU AKILLI OPTİK FORM
      </div>
    </div>
  );
}

interface PrintTabProps {
  examId?: string;
  exam?: Exam;
  updateExam?: (updates: Partial<Exam>) => void;
  schoolStudents?: Student[];
  showAlert?: (msg: string) => void;
}

export function PrintTab({ examId, exam: propExam, updateExam: _updateExam, schoolStudents: propStudents, showAlert: propShowAlert }: PrintTabProps) {
  const { state } = useAppContext();

  // Aktif sınavı context'ten veya prop'tan al
  const targetId = examId || (propExam ? String(propExam.id) : undefined);
  const contextExam = targetId ? state.exams.find(e => String(e.id) === String(targetId)) : undefined;
  const exam: Exam = contextExam || propExam || state.exams[0] || {
    id: "1",
    name: "Örnek Deneme Sınavı",
    date: new Date().toLocaleDateString('tr-TR'),
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
    keys: { A: Array(90).fill(""), B: Array(90).fill(""), C: [], D: [] }
  };

  const showAlert = propShowAlert || ((msg: string) => alert(msg));

  const [isColorMode, setIsColorMode] = useState(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [isPrinting, setIsPrinting] = useState(false);

  // Merkezi öğrenci kütüğünden gelen öğrencileri optik form için sınıf/şube normalize ederek hazırla
  const effectiveStudentList: Student[] = useMemo(() => {
    const rawList = (propStudents && propStudents.length > 0)
      ? propStudents
      : (state.students && state.students.length > 0)
      ? state.students
      : (exam.studentList && exam.studentList.length > 0)
      ? (exam.studentList as Student[])
      : [];

    return rawList.map(s => {
      const { cls, sec } = formatClassSec(s.classStr || s.className, s.sectionStr);
      return {
        ...s,
        id: String(s.id || s.no),
        no: Number(s.no) || 0,
        name: s.name,
        className: s.className || (cls && sec ? `${cls}/${sec}` : cls || ''),
        classStr: cls || s.classStr || s.className || '',
        sectionStr: sec || s.sectionStr || '',
        booklet: s.booklet || 'A'
      };
    });
  }, [propStudents, state.students, exam.studentList]);

  // Önizleme ölçeği (mobil ve masaüstü duyarlı)
  const [previewScale, setPreviewScale] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 0.38;
    }
    return 0.6;
  });

  const availableClasses = useMemo(() => {
    if (!effectiveStudentList) return [];
    const classesList = effectiveStudentList.map(r => {
      const c = r.classStr && r.classStr !== "-" ? r.classStr : "";
      const s = r.sectionStr && r.sectionStr !== "-" ? r.sectionStr : "";
      if (!c && !s) return null;
      if (c && s) return `${c}/${s}`;
      return c || s;
    }).filter(Boolean) as string[];
    return [...new Set(classesList)].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  }, [effectiveStudentList]);

  // Yazdırılacak / Önizlenecek Öğrenciler (Her zaman kişiye özel karekodlu)
  const printStudents: Student[] = useMemo(() => {
    if (!effectiveStudentList || effectiveStudentList.length === 0) {
      // Liste boş ise örnek önizleme tek kartı
      return [{
        id: "preview-1",
        name: "ÖRNEK ÖĞRENCİ (ÖNİZLEME)",
        no: 1001,
        className: "8-A",
        classStr: "8",
        sectionStr: "A",
        booklet: "A"
      }];
    }

    if (selectedClassFilter === "ALL") {
      return effectiveStudentList;
    }

    return effectiveStudentList.filter(r => {
      const c = r.classStr && r.classStr !== "-" ? r.classStr : "";
      const s = r.sectionStr && r.sectionStr !== "-" ? r.sectionStr : "";
      const val = (c && s) ? `${c}/${s}` : (c || s || "");
      return val === selectedClassFilter;
    });
  }, [effectiveStudentList, selectedClassFilter]);

  const hasRealStudents = effectiveStudentList && effectiveStudentList.length > 0;

  const handlePrint = () => {
    if (!hasRealStudents) {
      showAlert("Henüz öğrenci kütüğünde kayıtlı öğrenci bulunmuyor. Gerçek formları basabilmek için lütfen 'Öğrenci Kütüğü' sekmesinden e-Okul öğrenci listenizi ekleyin veya içe aktarın.");
      return;
    }

    if (printStudents.length === 0) {
      showAlert("Seçilen filtreye uygun öğrenci bulunamadı. Lütfen sınıf filtresini değiştirin.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return showAlert("Lütfen tarayıcınızın açılır pencere (pop-up) engelleyicisine izin verin.");

    printWindow.document.open();
    printWindow.document.write('<!DOCTYPE html><html lang="tr"><head><title>Baskı Hazırlanıyor...</title><style>body{font-family:sans-serif;text-align:center;padding-top:20%;color:#475569;background:#f8fafc;}</style></head><body><h2>Karekodlu Optik Formlar Yazıcıya Gönderiliyor, lütfen bekleyin...</h2></body></html>');
    printWindow.document.close();

    setIsPrinting(true);

    setTimeout(() => {
      let printHTML = '<div id="print-wrapper">';
      document.querySelectorAll('.print-page-node').forEach(c => {
        const optikPage = c.querySelector('.optik-page');
        if (optikPage) {
          printHTML += optikPage.outerHTML;
        } else {
          printHTML += c.outerHTML;
        }
      });
      printHTML += '</div>';

      printWindow.document.head.innerHTML = '<title>Karekodlu Optik Form Baskı</title>';
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(n => printWindow.document.head.appendChild(n.cloneNode(true)));

      const s = printWindow.document.createElement('style');
      s.innerHTML = `
        @page { size: A4 portrait; margin: 0 !important; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          width: 210mm !important;
          height: 297mm !important;
        }
        #print-wrapper {
          display: block;
          width: 100%;
          margin: 0;
          padding: 0;
        }
        .optik-page {
          width: 210mm !important;
          height: 297mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: white !important;
          box-sizing: border-box !important;
          border: none !important;
          box-shadow: none !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
          overflow: hidden !important;
          position: relative !important;
        }
        .optik-page:last-child {
          page-break-after: auto !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `;
      printWindow.document.head.appendChild(s);
      printWindow.document.body.innerHTML = printHTML;

      setIsPrinting(false);

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }, 1200);
  };

  const totalPages = hasRealStudents ? printStudents.length : 1;

  return (
    <div className="flex flex-col h-full w-full no-print bg-slate-100 overflow-hidden">
      {/* Üst Kontrol Paneli */}
      <div className="bg-white px-3.5 sm:px-6 py-3 shadow-2xs border-b border-slate-200/80 shrink-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Başlık ve Durum */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Öğrenciye Özel Karekodlu Form Baskısı
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {hasRealStudents ? `${totalPages} Öğrenci Hazır` : 'Örnek Önizleme'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                Her öğrenci için benzersiz karekod basılır. Kamera taramasında öğrenci bilgileri ve cevap anahtarı anında otomatik eşleşir.
              </p>
            </div>
          </div>

          {/* Yazdır Butonu */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Hazırlanıyor...' : `Karekodlu Formları Yazdır (${totalPages} Sayfa)`}</span>
            </button>
          </div>
        </div>

        {/* Araç Çubuğu (Renk Seçimi, Sınıf Filtresi, Ölçek) */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Renk Seçimi: Kırmızı Optik vs Siyah-Beyaz */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsColorMode(true)}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  isColorMode
                    ? 'bg-white text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Kırmızı Optik Mürekkebi"
              >
                🔴 Kırmızı Mürekkep
              </button>
              <button
                type="button"
                onClick={() => setIsColorMode(false)}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  !isColorMode
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Siyah-Beyaz Fotokopi Uyumu"
              >
                ⚫ Siyah / Beyaz
              </button>
            </div>

            {/* Sınıf Filtresi */}
            {availableClasses.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold shadow-2xs">
                <span className="text-slate-400 uppercase text-[10px] tracking-wider">Sınıf:</span>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="bg-transparent text-indigo-600 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">Tüm Sınıflar ({effectiveStudentList.length} Öğrenci)</option>
                  {availableClasses.map(c => <option key={c} value={c}>{c} Sınıfı</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Önizleme Yakınlaştırma (Scale) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-1 hidden sm:inline">Ölçek:</span>
            <button
              type="button"
              onClick={() => setPreviewScale(0.38)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                previewScale === 0.38 ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sığdır
            </button>
            <button
              type="button"
              onClick={() => setPreviewScale(0.6)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                previewScale === 0.6 ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Orta
            </button>
            <button
              type="button"
              onClick={() => setPreviewScale(0.85)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                previewScale === 0.85 ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Büyük
            </button>
          </div>
        </div>
      </div>

      {/* Ana Önizleme Alanı */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 md:p-8 flex flex-col items-center custom-scrollbar">
        <div className="flex flex-col gap-5 items-center w-full max-w-5xl">
          {/* Öğrenci listesi uyarısı veya durum bilgi kutusu */}
          {!hasRealStudents ? (
            <div className="w-full max-w-[210mm] bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold">Öğrenci Kütüğü Henüz Boş (Örnek Önizleme Gösteriliyor)</div>
                  <div className="text-amber-700 mt-0.5">
                    <b>"Öğrenciler"</b> sekmesinden e-Okul listenizi içe aktardığınızda, her öğrenciniz için ad, numara, sınıf ve kitapçık bilgisi karekoda işlenmiş olarak otomatik üretilecektir.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/90 px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 shadow-2xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">
                Merkezi Kütükten Kişiye Özel Karekodlu Optik Formlar ({printStudents.length} Öğrenci hazırlandı)
              </span>
            </div>
          )}

          {/* Form Önizlemeleri (Performans için ilk 3 form gösterilir) */}
          {printStudents.slice(0, 3).map((student, idx) => (
            <div
              key={`preview-${idx}`}
              className="rounded-xl overflow-hidden shadow-xl border border-slate-300/80 bg-white flex flex-col items-center"
            >
              <div className="w-full bg-slate-800 text-white text-xs font-bold px-4 py-2 flex items-center justify-between">
                <span>{idx + 1}. Form: {student.name}</span>
                <span className="text-slate-400 font-mono">No: {student.no} {student.classStr ? `(${student.classStr}/${student.sectionStr || ''})` : ''}</span>
              </div>
              <div
                className="a4-preview-container origin-top transform-gpu"
                style={{
                  transform: `scale(var(--preview-scale, ${previewScale}))`,
                  marginBottom: `calc((297mm * ${previewScale}) - 297mm)`
                }}
              >
                <PrintLayout exam={exam} isColorMode={isColorMode} student={student} />
              </div>
            </div>
          ))}

          {/* 3'ten fazla öğrenci varsa bilgilendirme kutusu */}
          {printStudents.length > 3 && (
            <div className="p-4 sm:p-5 bg-white border border-blue-200 text-blue-800 rounded-xl text-center w-full max-w-[210mm] shadow-2xs flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <List className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm sm:text-base">
                + {printStudents.length - 3} Öğrencinin Formu Daha Var
              </h4>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Cihaz performansını ve akıcılığı korumak için önizlemede ilk 3 form listelenir.<br />
                <b>"Karekodlu Formları Yazdır"</b> butonuna bastığınızda {printStudents.length} sayfanın tümü baskı penceresine aktarılacaktır.
              </p>
              <button
                onClick={handlePrint}
                className="mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Hepsini Yazdır ({printStudents.length} Sayfa)</span>
              </button>
            </div>
          )}
        </div>

        {/* Yazdırma işlemi için gizli DOM düğümleri */}
        {isPrinting && (
          <div className="hidden">
            {printStudents.map((student, idx) => (
              <div key={`print-node-${idx}`} className="print-page-node">
                <PrintLayout exam={exam} isColorMode={isColorMode} student={student} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
