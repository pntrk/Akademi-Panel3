import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  FileCode2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  TrendingUp, 
  BarChart3, 
  Printer, 
  Search, 
  Filter, 
  Check, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Users, 
  GraduationCap, 
  Target, 
  ArrowRight, 
  BookOpen, 
  FileText, 
  Save, 
  RefreshCw,
  Award,
  ChevronDown
} from 'lucide-react';
import { Exam, QuestionOutcome, ExamResult, Student } from '../types';
import { useAppContext } from '../context/AppContext';
import { 
  parseKazanimExcel, 
  parseKazanimXml, 
  generateKazanimExcelTemplate, 
  generateKazanimXmlTemplate,
  parseOpticalTxtAnswers,
  evaluateExamKazanimAnalytics,
  evaluateStudentKazanimReport,
  normalizeKazanimSubject
} from '../lib/kazanimParser';
import { normalizeTurkish, createUnifiedExamResult } from '../lib/omrEngine';
import { generateId } from '../lib/utils';
import { normalizeStudentNo } from '../lib/sekonicParser';
import * as XLSX from 'xlsx';

interface KazanimMatchingModalProps {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
}

export function KazanimMatchingModal({ exam, isOpen, onClose }: KazanimMatchingModalProps) {
  const { state, updateExamOmr, saveOmrExamResults } = useAppContext();

  // Active top-level modal tab
  const [activeTab, setActiveTab] = useState<'upload' | 'analytics' | 'classes' | 'student'>('upload');

  // Outcomes state initialized from exam.learningOutcomes
  const [outcomes, setOutcomes] = useState<QuestionOutcome[]>(() => {
    return exam.learningOutcomes?.items || [];
  });

  // Source info
  const [sourceFile, setSourceFile] = useState<string>(exam.learningOutcomes?.sourceFile || '');
  const [sourceType, setSourceType] = useState<'excel' | 'xml' | 'manual'>(exam.learningOutcomes?.sourceType || 'manual');
  const [extractedKeys, setExtractedKeys] = useState<{ [bk: string]: string[] }>(() => {
    return exam.keys || {};
  });

  // File loading states
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Optical TXT answers state
  const [txtFileName, setTxtFileName] = useState<string>('');
  const [txtParsedCount, setTxtParsedCount] = useState<number>(0);
  const [isApplyingTxtAnswers, setIsApplyingTxtAnswers] = useState<boolean>(false);

  // Editing outcome state
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('');

  // Search & Filters in Analytics Tab
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'mastered' | 'developing' | 'critical'>('all');
  const [searchOutcomeText, setSearchOutcomeText] = useState<string>('');

  // Student Tab state
  const [selectedStudentNo, setSelectedStudentNo] = useState<string>('');
  const [studentSearchInput, setStudentSearchInput] = useState<string>('');

  // Refs for file inputs
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const txtFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync outcomes when exam changes
  useEffect(() => {
    if (exam.learningOutcomes?.items && exam.learningOutcomes.items.length > 0) {
      setOutcomes(exam.learningOutcomes.items);
      setSourceFile(exam.learningOutcomes.sourceFile || '');
      setSourceType(exam.learningOutcomes.sourceType || 'excel');
    }
  }, [exam.id, exam.learningOutcomes]);

  // Exam results pool
  const examResults: ExamResult[] = useMemo(() => {
    if (exam.results && exam.results.length > 0) return exam.results;
    return state.results.filter(r => 
      r.scores && (r.scores[String(exam.id)] !== undefined || r.scores[exam.name] !== undefined)
    );
  }, [exam, state.results]);

  // Check how many students have optical answers recorded
  const studentsWithAnswersCount = useMemo(() => {
    return examResults.filter(r => r.answers && r.answers.length > 0).length;
  }, [examResults]);

  // Overall analytics calculation
  const analytics = useMemo(() => {
    return evaluateExamKazanimAnalytics(outcomes, exam, examResults);
  }, [outcomes, exam, examResults]);

  // Filtered question stats
  const filteredQuestionStats = useMemo(() => {
    return analytics.questionStats.filter(item => {
      if (selectedSubjectFilter !== 'ALL' && item.subjectName !== selectedSubjectFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) {
        return false;
      }
      if (searchOutcomeText.trim()) {
        const query = searchOutcomeText.trim().toLowerCase();
        const tMatch = (item.outcome.title || '').toLowerCase().includes(query);
        const cMatch = (item.outcome.code || '').toLowerCase().includes(query);
        const sMatch = (item.subjectName || '').toLowerCase().includes(query);
        const qMatch = String(item.outcome.questionNumber).includes(query);
        if (!tMatch && !cMatch && !sMatch && !qMatch) return false;
      }
      return true;
    });
  }, [analytics.questionStats, selectedSubjectFilter, selectedStatusFilter, searchOutcomeText]);

  // Active student report
  const activeStudentResult = useMemo(() => {
    if (!examResults || examResults.length === 0) return null;
    if (selectedStudentNo) {
      return examResults.find(r => String(r.no || r.studentNo).trim() === selectedStudentNo.trim()) || examResults[0];
    }
    return examResults[0];
  }, [examResults, selectedStudentNo]);

  const studentKazanimReport = useMemo(() => {
    if (!activeStudentResult || outcomes.length === 0) return null;
    return evaluateStudentKazanimReport(activeStudentResult, outcomes, exam);
  }, [activeStudentResult, outcomes, exam]);

  if (!isOpen) return null;

  // Handle Excel upload
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);
    try {
      const res = await parseKazanimExcel(file, exam);
      if (res.outcomes.length === 0) {
        throw new Error("Excel dosyasında soru veya kazanım satırı bulunamadı. Lütfen şablonu kontrol ediniz.");
      }
      setOutcomes(res.outcomes);
      if (res.keys && Object.keys(res.keys).length > 0) {
        setExtractedKeys(prev => ({ ...prev, ...res.keys }));
      }
      setSourceFile(file.name);
      setSourceType('excel');
      const keysMsg = res.keys?.B && res.keys.B.some(k => Boolean(k)) ? " (A ve B kitapçığı cevap anahtarları çekildi)" : "";
      showToast(`✓ ${res.outcomes.length} soru kazanımı Excel'den başarıyla yüklendi${keysMsg}.`);
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || "Excel dosyası okunurken hata oluştu.");
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle XML upload
  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);
    try {
      const text = await file.text();
      const res = await parseKazanimXml(text, exam);
      if (res.outcomes.length === 0) {
        throw new Error("XML dosyasında soru veya kazanım etiketi (<soru>, <question> vb.) bulunamadı.");
      }
      setOutcomes(res.outcomes);
      if (res.keys && Object.keys(res.keys).length > 0) {
        setExtractedKeys(prev => ({ ...prev, ...res.keys }));
      }
      setSourceFile(file.name);
      setSourceType('xml');
      const keysMsg = res.keys?.B && res.keys.B.some(k => Boolean(k)) ? " (A ve B kitapçığı cevap anahtarları çekildi)" : "";
      showToast(`✓ ${res.outcomes.length} soru kazanımı XML'den başarıyla yüklendi${keysMsg}.`);
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || "XML dosyası okunurken hata oluştu.");
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle Optical TXT upload
  const handleTxtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);
    try {
      let decodedText = '';
      const buffer = await file.arrayBuffer();
      try {
        decodedText = new TextDecoder('windows-1254').decode(buffer);
      } catch {
        decodedText = new TextDecoder('utf-8').decode(buffer);
      }

      const mergedKeys = {
        ...(exam.keys || {}),
        ...extractedKeys
      };
      const updatedExam = { ...exam, keys: mergedKeys };

      const parsedAnswers = parseOpticalTxtAnswers(decodedText, updatedExam, state.students);
      if (parsedAnswers.length === 0) {
        throw new Error("TXT dosyasında geçerli öğrenci optik okuma satırı (Sekonic Ertem-840 veya CSV) bulunamadı.");
      }

      setTxtFileName(file.name);
      setTxtParsedCount(parsedAnswers.length);

      // Match and update exam results with these answers & evaluate with active keys
      setIsApplyingTxtAnswers(true);
      const updatedResults = [...examResults];
      const newStudentsToAdd: Student[] = [];
      let matchedCount = 0;
      let newCount = 0;

      parsedAnswers.forEach(pa => {
        const cleanNo = normalizeStudentNo(pa.studentNo);
        const normName = normalizeTurkish(pa.studentName || '').toLowerCase().trim();

        // 1. Search in current exam results first
        let targetRes = updatedResults.find(r => {
          const rNo = normalizeStudentNo(r.no || r.studentNo);
          if (cleanNo && rNo && rNo === cleanNo) return true;
          const rName = normalizeTurkish(r.name || r.studentName || '').toLowerCase().trim();
          if (normName && rName && (rName === normName || (normName.length >= 5 && rName.includes(normName)))) return true;
          return false;
        });

        // 2. Search in master school roster
        const rosterMatch = (state.students || []).find(s => {
          const sNo = normalizeStudentNo(s.no);
          if (cleanNo && sNo && cleanNo === sNo) return true;
          const sName = normalizeTurkish(s.name || '').toLowerCase().trim();
          if (normName && sName && (sName === normName || (normName.length >= 5 && sName.includes(normName)))) return true;
          return false;
        });

        const finalNo = rosterMatch ? rosterMatch.no : (parseInt(cleanNo, 10) || targetRes?.no || 0);
        const finalName = rosterMatch ? rosterMatch.name : (pa.studentName || targetRes?.studentName || targetRes?.name || 'İsimsiz');
        const finalClass = rosterMatch ? rosterMatch.className : (pa.classFormatted || targetRes?.studentClass || '8-A');
        const finalBooklet = (pa.booklet || targetRes?.booklet || 'A').toUpperCase();

        const unifiedRes = createUnifiedExamResult(
          {
            id: targetRes?.id || generateId(),
            studentId: rosterMatch?.id || targetRes?.studentId,
            studentNo: finalNo,
            studentName: finalName,
            studentClass: finalClass,
            booklet: finalBooklet,
            answers: pa.answers
          },
          updatedExam,
          rosterMatch || targetRes
        );

        if (targetRes) {
          Object.assign(targetRes, unifiedRes);
        } else {
          updatedResults.push(unifiedRes);
        }
        matchedCount++;

        const parsedNoNum = parseInt(String(cleanNo), 10) || 0;
        if (!rosterMatch && parsedNoNum > 0) {
          newStudentsToAdd.push({
            id: generateId(),
            no: parsedNoNum,
            name: finalName,
            className: finalClass,
            classStr: pa.classFormatted ? pa.classFormatted.split('-')[0] : '8',
            sectionStr: pa.classFormatted ? pa.classFormatted.split('-')[1] : 'A'
          });
          newCount++;
        }
      });

      if (matchedCount > 0) {
        await saveOmrExamResults(String(exam.id), updatedResults, newStudentsToAdd);
        if (Object.keys(extractedKeys).length > 0) {
          await updateExamOmr(String(exam.id), { keys: mergedKeys });
        }
        const addedMsg = newCount > 0 ? ` (${newCount} yeni öğrenci okul kütüğüne kaydedildi)` : '';
        showToast(`✓ TXT dosyasındaki ${matchedCount} öğrencinin soru cevapları ve şıkları sınavla başarıyla eşleştirildi${addedMsg}.`);
      } else {
        showToast(`TXT dosyasındaki öğrenciler sınavla eşleştirilemedi.`);
      }
    } catch (err: any) {
      console.error(err);
      setFileError(err.message || "TXT dosyası işlenirken hata oluştu.");
    } finally {
      setIsProcessingFile(false);
      setIsApplyingTxtAnswers(false);
      if (e.target) e.target.value = '';
    }
  };

  // Save learning outcomes & answer keys to exam and re-evaluate all student scores
  const handleSaveOutcomes = async () => {
    if (outcomes.length === 0) {
      showToast("Lütfen önce Excel veya XML tablosu yükleyiniz.");
      return;
    }

    try {
      const mergedKeys = {
        ...(exam.keys || {}),
        ...extractedKeys
      };

      const updatedExam = {
        ...exam,
        keys: mergedKeys,
        learningOutcomes: {
          updatedAt: new Date().toISOString(),
          sourceFile: sourceFile || 'kazanimlar.xlsx',
          sourceType,
          items: outcomes
        }
      };

      // Re-evaluate current exam results with updated booklet keys
      const currentResults = exam.results || [];
      const reevaluatedResults = currentResults.map(res => {
        if (!res.answers || res.answers.length === 0) return res;
        return createUnifiedExamResult(res, updatedExam);
      });

      await updateExamOmr(String(exam.id), {
        keys: mergedKeys,
        learningOutcomes: updatedExam.learningOutcomes,
        results: reevaluatedResults
      });

      showToast("✓ Kazanım tablosu ve kitapçık cevap anahtarı sınava kaydedildi, tüm öğrenci net ve puanları güncellendi!");
      setActiveTab('analytics');
    } catch (err: any) {
      console.error(err);
      showToast("Kazanımlar kaydedilirken hata oluştu: " + (err.message || ''));
    }
  };

  // Clear / remove learning outcomes
  const handleClearOutcomes = async () => {
    if (!window.confirm("Bu sınav için tanımlanmış kazanım tablosu silinsin mi? Sınav normal sonuç gösterim moduna dönecektir.")) {
      return;
    }

    try {
      await updateExamOmr(String(exam.id), {
        learningOutcomes: undefined
      });
      setOutcomes([]);
      setSourceFile('');
      showToast("Kazanım tablosu kaldırıldı. Sınav normal sonuç gösteriminde kalacaktır.");
    } catch (err: any) {
      console.error(err);
      showToast("Kazanımlar silinirken hata oluştu.");
    }
  };

  // Inline outcome edit helpers
  const startEditOutcome = (item: QuestionOutcome) => {
    setEditingOutcomeId(item.id);
    setEditTitle(item.title);
    setEditCode(item.code || '');
    setEditAnswer(item.correctAnswer || '');
    setEditSubject(item.subjectName || '');
  };

  const saveEditOutcome = () => {
    if (!editingOutcomeId) return;
    setOutcomes(prev => prev.map(o => {
      if (o.id === editingOutcomeId) {
        return {
          ...o,
          title: editTitle.trim(),
          code: editCode.trim() || undefined,
          correctAnswer: editAnswer.trim().toUpperCase() || undefined,
          subjectName: editSubject.trim() || o.subjectName
        };
      }
      return o;
    }));
    setEditingOutcomeId(null);
    showToast("Kazanım güncellendi.");
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const data = generateKazanimExcelTemplate(exam);
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.name || 'Sinav'}_Kazanim_Sablonu.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Örnek Excel kazanım şablonu indirildi.");
  };

  // Download Sample XML Template
  const handleDownloadSampleXml = () => {
    const xml = generateKazanimXmlTemplate(exam);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.name || 'Sinav'}_Kazanim_Sablonu.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Örnek XML kazanım şablonu indirildi.");
  };

  // Export Analytics to Excel
  const handleExportAnalyticsExcel = () => {
    if (analytics.questionStats.length === 0) return;

    const exportRows = analytics.questionStats.map((item, idx) => ({
      'Sıra': idx + 1,
      'Soru No': item.outcome.questionNumber,
      'Ders': item.subjectName,
      'Kazanım Kodu': item.outcome.code || '-',
      'Kazanım Açıklaması': item.outcome.title,
      'Doğru Şık': item.correctAnswer || '-',
      'Katılımcı Sayısı': item.totalStudents,
      'Doğru Yapan': item.correctCount,
      'Yanlış Yapan': item.wrongCount,
      'Boş Bırakan': item.emptyCount,
      'Okul Başarı Oranı (%)': item.successRate,
      'Durum': item.status === 'mastered' ? 'Kavranmış (İyi)' : item.status === 'developing' ? 'Orta (Pekiştirilmeli)' : 'Kritik Eksik'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kazanım Analizi');
    XLSX.writeFile(workbook, `${exam.name}_Kazanim_Analiz_Raporu.xlsx`);
    showToast("Kazanım analizi Excel tablosu indirildi.");
  };

  // Print A4 Kazanim Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return showToast("Lütfen pop-up engelleyicisini kaldırınız.");

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${exam.name} - Kazanım Analiz Raporu</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 10px; color: #1e293b; line-height: 1.3; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .header h1 { font-size: 14px; margin: 0 0 4px 0; text-transform: uppercase; }
    .header p { margin: 0; font-size: 10px; color: #475569; }
    .kpi-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .kpi-card { flex: 1; border: 1px solid #cbd5e1; padding: 6px; border-radius: 6px; text-align: center; background: #f8fafc; }
    .kpi-num { font-size: 14px; font-weight: bold; color: #4338ca; }
    .kpi-label { font-size: 9px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; }
    th { background: #f1f5f9; font-weight: bold; font-size: 9px; text-transform: uppercase; }
    .center { text-align: center; }
    .rate { font-weight: bold; font-family: monospace; }
    .mastered { color: #15803d; font-weight: bold; }
    .developing { color: #b45309; font-weight: bold; }
    .critical { color: #b91c1c; font-weight: bold; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>T.C. MİLLİ EĞİTİM BAKANLIĞI • ATATÜRK ORTAOKULU</h1>
    <p><strong>${exam.name}</strong> • AYRINTILI SORU VE KAZANIM ANALİZ RAPORU • ${new Date().toLocaleDateString('tr-TR')}</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-num">${analytics.totalOutcomes}</div>
      <div class="kpi-label">Toplam Kazanım</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num">%${analytics.averageSuccessRate}</div>
      <div class="kpi-label">Okul Ortalaması</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #15803d;">${analytics.masteredOutcomesCount}</div>
      <div class="kpi-label">Kavranmış (≥%70)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #b45309;">${analytics.developingOutcomesCount}</div>
      <div class="kpi-label">Geliştirilmeli</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-num" style="color: #b91c1c;">${analytics.criticalOutcomesCount}</div>
      <div class="kpi-label">Kritik Eksik (&lt;%50)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width: 25px;">No</th>
        <th style="width: 80px;">Ders</th>
        <th class="center" style="width: 55px;">Kod</th>
        <th>Kazanım Açıklaması</th>
        <th class="center" style="width: 30px;">Cvp</th>
        <th class="center" style="width: 45px;">D / Y / B</th>
        <th class="center" style="width: 45px;">Başarı</th>
        <th class="center" style="width: 60px;">Durum</th>
      </tr>
    </thead>
    <tbody>
      ${analytics.questionStats.map((item, i) => `
        <tr>
          <td class="center font-bold">${item.outcome.questionNumber || (i + 1)}</td>
          <td><strong>${item.subjectName}</strong></td>
          <td class="center font-mono">${item.outcome.code || '-'}</td>
          <td>${item.outcome.title}</td>
          <td class="center font-bold">${item.correctAnswer || '-'}</td>
          <td class="center font-mono text-[9px]">${item.correctCount}/${item.wrongCount}/${item.emptyCount}</td>
          <td class="center rate %${item.successRate >= 70 ? 'mastered' : item.successRate >= 50 ? 'developing' : 'critical'}">%${item.successRate}</td>
          <td class="center ${item.status}">
            ${item.status === 'mastered' ? 'Kavranmış' : item.status === 'developing' ? 'Orta' : 'Kritik'}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">Kazanım Eşleştirme & Ayrıntılı Analiz</h2>
                {outcomes.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    ✓ {outcomes.length} Kazanım Aktif
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {exam.name} • {examResults.length} Öğrenci Katılımcı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tab Switcher */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'upload'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>1. Kazanım & TXT Yükle</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              disabled={outcomes.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                outcomes.length === 0
                  ? 'text-slate-400 cursor-not-allowed opacity-50'
                  : activeTab === 'analytics'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 cursor-pointer'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>2. Okul & Soru Analizi</span>
              {outcomes.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                  {outcomes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              disabled={outcomes.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                outcomes.length === 0
                  ? 'text-slate-400 cursor-not-allowed opacity-50'
                  : activeTab === 'classes'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 cursor-pointer'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>3. Şube Karşılaştırması</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('student')}
              disabled={outcomes.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                outcomes.length === 0
                  ? 'text-slate-400 cursor-not-allowed opacity-50'
                  : activeTab === 'student'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 cursor-pointer'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>4. Öğrenci Kazanım Karnesi</span>
            </button>
          </div>

          {outcomes.length > 0 && activeTab !== 'upload' && (
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAnalyticsExcel}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                title="Kazanım Analizini Excel Olarak İndir"
              >
                <Download className="w-3 h-3" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                title="A4 Rapor Olarak Yazdır"
              >
                <Printer className="w-3 h-3" />
                <span>Yazdır</span>
              </button>
            </div>
          )}
        </div>

        {/* Toast Alert Notification */}
        {toastMessage && (
          <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 text-center animate-in fade-in shrink-0">
            {toastMessage}
          </div>
        )}

        {/* Modal Body Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar text-xs">
          
          {/* TAB 1: UPLOAD & MATCHING */}
          {activeTab === 'upload' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              {/* Informative Guidance */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 space-y-1">
                  <p className="font-bold">Kazanım Eşleştirme ve Optik TXT Entegrasyonu Nasıl Çalışır?</p>
                  <p className="text-blue-800 leading-relaxed text-[11px]">
                    1. <strong>Kazanım Tablosu:</strong> Sınavdaki soruların ders, konu ve kazanım açıklamalarını Excel (.xlsx) veya XML tablosu olarak yükleyiniz. Dilerseniz hazır örnek şablonu indirebilirsiniz.
                    <br />
                    2. <strong>Optik TXT Verisi:</strong> Öğrencilerin hangi soruda hangi şıkkı (A, B, C, D) işaretlediğini eşleştirmek için Sekonic / Optik Okuyucu TXT dosyasını yükleyebilir veya daha önce taranmış optik sonuçları doğrudan kullanabilirsiniz.
                    <br />
                    3. <strong>Otomatik Analiz:</strong> Kazanım ve öğrenci cevapları eşleştiğinde okul geneli, şube bazlı ve tekil öğrenci kazanım karneleri anında üretilir. Tablo yüklenmediğinde sınav normal sonuç modunda kalır.
                  </p>
                </div>
              </div>

              {/* Upload Dropzones Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Excel & XML Kazanim Upload Card */}
                <div className="bg-slate-50/70 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        Adım 1: Kazanımlar
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mb-1">Kazanım Tablosu Yükle</h4>
                    <p className="text-slate-500 text-[11px] mb-4">
                      Soru numaraları, ders adları, kazanım kodları ve açıklamalarını içeren <strong>Excel (.xlsx, .xls)</strong> veya <strong>XML</strong> tablosu.
                    </p>

                    <input
                      ref={excelFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleExcelUpload}
                    />
                    <input
                      ref={xmlFileInputRef}
                      type="file"
                      accept=".xml"
                      className="hidden"
                      onChange={handleXmlUpload}
                    />

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => excelFileInputRef.current?.click()}
                        disabled={isProcessingFile}
                        className="p-3 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl font-bold text-slate-800 text-xs flex flex-col items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Excel (.xlsx) Seç</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => xmlFileInputRef.current?.click()}
                        disabled={isProcessingFile}
                        className="p-3 bg-white hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 rounded-xl font-bold text-slate-800 text-xs flex flex-col items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      >
                        <FileCode2 className="w-4 h-4 text-purple-600" />
                        <span>XML Dosyası Seç</span>
                      </button>
                    </div>

                    {sourceFile && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-emerald-900 text-[11px]">
                        <span className="truncate font-semibold">Aktif: {sourceFile} ({outcomes.length} soru)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Şablon mu gerekiyor?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDownloadSampleExcel}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg px-2 py-1 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3 h-3 text-emerald-600" />
                        <span>Örnek Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSampleXml}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-slate-200 rounded-lg px-2 py-1 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3 h-3 text-purple-600" />
                        <span>Örnek XML</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optical TXT Answers Integration Card */}
                <div className="bg-slate-50/70 border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Adım 2: Öğrenci Şıkları (TXT)
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mb-1">Optik TXT Cevap Verisi</h4>
                    <p className="text-slate-500 text-[11px] mb-4">
                      Öğrencinin hangi soruyu hangi şıkkı işaretlediğini eşleştirmek için optik okuyucudan alınan <strong>.TXT</strong> verisi.
                    </p>

                    <input
                      ref={txtFileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      className="hidden"
                      onChange={handleTxtUpload}
                    />

                    {studentsWithAnswersCount > 0 ? (
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 mb-3 text-xs space-y-1">
                        <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>{studentsWithAnswersCount} Öğrencinin Cevapları Hazır</span>
                        </div>
                        <p className="text-emerald-800 text-[11px]">
                          Bu sınava ait optik okuma kayıtlarında öğrencilerin işaretlediği soru cevapları zaten mevcut. Ek dosya yüklemenize gerek yoktur.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 mb-3 text-xs space-y-1">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>Öğrenci Şık Verisi Eksik</span>
                        </div>
                        <p className="text-amber-800 text-[11px]">
                          Sınav yayıncı Excel'i ile yüklenmişse veya cevap şıkları henüz aktarılmadıysa Sekonic / optik .TXT dosyasını yükleyiniz.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => txtFileInputRef.current?.click()}
                      disabled={isProcessingFile || isApplyingTxtAnswers}
                      className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-slate-800 text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span>{studentsWithAnswersCount > 0 ? 'Farklı / Güncel TXT Dosyası Yükle' : 'Optik (.TXT) Dosyası Seç'}</span>
                    </button>

                    {txtFileName && (
                      <div className="mt-2 text-[11px] text-slate-500 font-mono">
                        Yüklenen: {txtFileName} ({txtParsedCount} satır)
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-400">
                    Desteklenen: Sekonic SR-55D (Ertem-840), optik raw TXT veya No, Kitapçık, Cevap dizisi formatı.
                  </div>
                </div>
              </div>

              {/* Error Alert if any */}
              {fileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Loaded Outcomes Preview & Inline Editor */}
              {outcomes.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="bg-slate-800 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs sm:text-sm">
                        Yüklenen Kazanımlar ({outcomes.length} Soru)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearOutcomes}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/40 border border-rose-400/30 transition-colors cursor-pointer"
                      >
                        Temizle
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveOutcomes}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Kazanımları Kaydet & Eşleştir</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Form if an outcome is being edited */}
                  {editingOutcomeId && (
                    <div className="bg-indigo-50/90 border-b border-indigo-200 p-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-indigo-900">Düzenle:</span>
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        placeholder="Ders"
                        className="w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800"
                      />
                      <input
                        type="text"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        placeholder="Kod (T.8.1.1)"
                        className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-800"
                      />
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Kazanım Açıklaması"
                        className="flex-1 min-w-[200px] bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-800"
                      />
                      <input
                        type="text"
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value.toUpperCase())}
                        maxLength={1}
                        placeholder="Şık"
                        className="w-12 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={saveEditOutcome}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                      >
                        Tamam
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOutcomeId(null)}
                        className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                      >
                        İptal
                      </button>
                    </div>
                  )}

                  {/* Table View */}
                  <div className="overflow-x-auto max-h-72 custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-center w-12">Soru</th>
                          <th className="py-2 px-3 w-32">Ders</th>
                          <th className="py-2 px-3 w-28">Kazanım Kodu</th>
                          <th className="py-2 px-3">Kazanım Açıklaması</th>
                          <th className="py-2 px-3 text-center w-16">Doğru</th>
                          <th className="py-2 px-3 text-right w-16">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {outcomes.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-center font-bold font-mono text-slate-600">
                              {item.questionNumber || (idx + 1)}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {item.subjectName || '-'}
                            </td>
                            <td className="py-2 px-3 font-mono text-indigo-700 text-[11px]">
                              {item.code || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {item.title}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700 font-mono">
                              {item.correctAnswer || (exam.keys?.A?.[(item.questionNumber || idx + 1) - 1]) || '-'}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => startEditOutcome(item)}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                title="Kazanımı Düzenle"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OVERALL & QUESTION-LEVEL ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Toplam Kazanım</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{analytics.totalOutcomes}</div>
                  <div className="text-[10px] text-slate-400">Soru Sayısı</div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-indigo-700 font-bold uppercase">Okul Ortalaması</div>
                  <div className="text-xl font-bold font-mono text-indigo-700 mt-0.5">%{analytics.averageSuccessRate}</div>
                  <div className="text-[10px] text-indigo-600 font-semibold">{analytics.evaluatedStudentCount} Öğrenci</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Kavranmış (≥%70)</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">{analytics.masteredOutcomesCount}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Yüksek Başarı</div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-amber-700 font-bold uppercase">Geliştirilmeli (%50-70)</div>
                  <div className="text-xl font-bold font-mono text-amber-700 mt-0.5">{analytics.developingOutcomesCount}</div>
                  <div className="text-[10px] text-amber-600 font-semibold">Pekiştirilmeli</div>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-rose-700 font-bold uppercase">Kritik Eksik (&lt;%50)</div>
                  <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">{analytics.criticalOutcomesCount}</div>
                  <div className="text-[10px] text-rose-600 font-semibold">Müdahale Gerekli</div>
                </div>
              </div>

              {/* Strengths & Weaknesses Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Critical Weaknesses */}
                <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>En Düşük Başarılı Kazanımlar (Kritik Eksikler)</span>
                    </span>
                    <span className="text-[10px] text-rose-700">Tekrar Edilmeli</span>
                  </div>
                  <div className="space-y-1.5">
                    {analytics.topWeaknesses.slice(0, 3).map((item) => (
                      <div key={item.outcome.id} className="bg-white p-2 rounded-lg border border-rose-100 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800">[Soru {item.outcome.questionNumber}] {item.subjectName}: </span>
                          <span className="text-slate-600 text-[11px] truncate block">{item.outcome.title}</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-rose-600 shrink-0">%{item.successRate}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Strengths */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-600" />
                      <span>En Yüksek Başarılı Kazanımlar (Güçlü Yönler)</span>
                    </span>
                    <span className="text-[10px] text-emerald-700">Tam Kavranmış</span>
                  </div>
                  <div className="space-y-1.5">
                    {analytics.topStrengths.slice(0, 3).map((item) => (
                      <div key={item.outcome.id} className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800">[Soru {item.outcome.questionNumber}] {item.subjectName}: </span>
                          <span className="text-slate-600 text-[11px] truncate block">{item.outcome.title}</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-emerald-600 shrink-0">%{item.successRate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {/* Subject filter */}
                  <div className="relative min-w-[140px]">
                    <select
                      value={selectedSubjectFilter}
                      onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="ALL">Tüm Dersler</option>
                      {analytics.availableSubjects.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status filter buttons */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('all')}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tümü
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('critical')}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'critical' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Kritik (&lt;%50)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('developing')}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'developing' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      Orta
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('mastered')}
                      className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedStatusFilter === 'mastered' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Kavranmış (≥%70)
                    </button>
                  </div>
                </div>

                {/* Search Text */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchOutcomeText}
                    onChange={(e) => setSearchOutcomeText(e.target.value)}
                    placeholder="Kazanım metni veya kod ara..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
                  />
                  {searchOutcomeText && (
                    <button
                      type="button"
                      onClick={() => setSearchOutcomeText('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Main Outcomes Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Soru</th>
                        <th className="py-2.5 px-3 w-32">Ders</th>
                        <th className="py-2.5 px-3 w-24">Kod</th>
                        <th className="py-2.5 px-3 min-w-[250px]">Kazanım Açıklaması</th>
                        <th className="py-2.5 px-3 text-center w-14">Cvp</th>
                        <th className="py-2.5 px-3 text-center w-28">D / Y / B</th>
                        <th className="py-2.5 px-3 text-center w-36">Okul Başarısı</th>
                        <th className="py-2.5 px-3 text-center w-24">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredQuestionStats.map((item) => (
                        <tr key={item.outcome.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center font-bold font-mono text-slate-600">
                            {item.outcome.questionNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {item.subjectName}
                          </td>
                          <td className="py-2 px-3 font-mono text-indigo-700 text-[11px]">
                            {item.outcome.code || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className="font-medium">{item.outcome.title}</span>
                            {item.outcome.unit && (
                              <span className="text-[10px] text-slate-400 block">{item.outcome.unit}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-black text-slate-800 font-mono">
                            {item.correctAnswer || '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[11px] whitespace-nowrap">
                            <span className="text-emerald-700 font-bold">{item.correctCount} D</span> •{' '}
                            <span className="text-rose-700 font-bold">{item.wrongCount} Y</span> •{' '}
                            <span className="text-slate-400">{item.emptyCount} B</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.status === 'mastered'
                                      ? 'bg-emerald-600'
                                      : item.status === 'developing'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-600'
                                  }`}
                                  style={{ width: `${item.successRate}%` }}
                                />
                              </div>
                              <span className="font-bold font-mono text-xs w-9 text-right">%{item.successRate}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'mastered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'developing'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.status === 'mastered'
                                ? 'Kavranmış'
                                : item.status === 'developing'
                                  ? 'Orta'
                                  : 'Kritik Eksik'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLASS COMPARISON */}
          {activeTab === 'classes' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Şube Bazlı Kazanım Başarı Karşılaştırması</h4>
                  <p className="text-slate-500 text-[11px]">Sınıfların her bir sorudaki doğru cevaplama oranları (%)</p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                  {analytics.availableClasses.length} Şube Karşılaştırılıyor
                </span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto max-h-[460px] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Soru</th>
                        <th className="py-2.5 px-3 w-28">Ders</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Kazanım</th>
                        <th className="py-2.5 px-3 text-center w-16 bg-indigo-50/50">Genel %</th>
                        {analytics.availableClasses.map(cls => (
                          <th key={cls} className="py-2.5 px-3 text-center w-20">
                            {cls}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.questionStats.map((item) => (
                        <tr key={item.outcome.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center font-bold font-mono text-slate-600">
                            {item.outcome.questionNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {item.subjectName}
                          </td>
                          <td className="py-2 px-3 text-slate-700 truncate max-w-xs" title={item.outcome.title}>
                            {item.outcome.code ? `${item.outcome.code}: ` : ''}{item.outcome.title}
                          </td>
                          <td className="py-2 px-3 text-center font-black font-mono bg-indigo-50/30 text-indigo-900">
                            %{item.successRate}
                          </td>
                          {analytics.availableClasses.map(cls => {
                            const cs = item.classStats[cls];
                            const rate = cs ? cs.rate : 0;
                            const isAbove = rate >= item.successRate;
                            return (
                              <td key={cls} className="py-2 px-3 text-center font-mono">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                    rate >= 70
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : rate >= 50
                                        ? 'text-amber-700 bg-amber-50'
                                        : 'text-rose-700 bg-rose-50'
                                  }`}
                                >
                                  %{rate}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: INDIVIDUAL STUDENT KAZANIM REPORT CARD */}
          {activeTab === 'student' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              {/* Student Selector Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Raporu Görüntülenecek Öğrenciyi Seçiniz:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedStudentNo}
                      onChange={(e) => setSelectedStudentNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {examResults.map(res => (
                        <option key={res.id} value={String(res.no || res.studentNo)}>
                          [{res.no || res.studentNo}] {res.name || res.studentName} ({res.classStr || res.studentClass || '-'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {studentKazanimReport && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-center shadow-2xs">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Kazanım Başarısı</div>
                      <div className="text-lg font-bold font-mono text-indigo-700">%{studentKazanimReport.masteryPercentage}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center shadow-2xs">
                      <div className="text-[10px] text-emerald-700 font-bold uppercase">Kavranan</div>
                      <div className="text-lg font-bold font-mono text-emerald-700">{studentKazanimReport.masteredCount} Soru</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 text-center shadow-2xs">
                      <div className="text-[10px] text-rose-700 font-bold uppercase">Eksik / Boş</div>
                      <div className="text-lg font-bold font-mono text-rose-700">{studentKazanimReport.missedCount + studentKazanimReport.emptyCount} Soru</div>
                    </div>
                  </div>
                )}
              </div>

              {studentKazanimReport ? (
                <>
                  {/* Missed Outcomes - Actionable Study Advice */}
                  {((studentKazanimReport.groupedMissedOutcomes && studentKazanimReport.groupedMissedOutcomes.length > 0) || studentKazanimReport.missedOutcomes.length > 0) && (
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Öğrencinin Eksik Kalan & Tekrar Etmesi Önerilen Konuları ({studentKazanimReport.groupedMissedOutcomes?.length || studentKazanimReport.missedOutcomes.length}):</span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full font-mono">
                          {studentKazanimReport.missedCount + studentKazanimReport.emptyCount} Hatalı/Boş Soru
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {(studentKazanimReport.groupedMissedOutcomes && studentKazanimReport.groupedMissedOutcomes.length > 0
                          ? studentKazanimReport.groupedMissedOutcomes
                          : studentKazanimReport.missedOutcomes.map(m => ({
                              code: m.code,
                              subjectName: m.subjectName || 'Genel',
                              title: m.title,
                              unit: m.unit,
                              questionNumbers: [m.questionNumber]
                            }))
                        ).map((item, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 mb-1">
                              <span className="text-amber-900">
                                [Soru {item.questionNumbers.join(', ')}] {item.subjectName}
                              </span>
                              {item.code && <span className="font-mono text-indigo-600 text-[10px] bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">{item.code}</span>}
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">{item.title}</p>
                            {item.unit && <span className="text-[10px] text-slate-400 mt-1 block font-medium">Ünite: {item.unit}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Student Soru-Cevap Detay Tablosu */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold">
                      <span>{studentKazanimReport.studentName} • Soru Bazlı Cevap ve Kazanım Detayı</span>
                      <span className="font-mono text-slate-300">Kitapçık: {studentKazanimReport.booklet}</span>
                    </div>

                    <div className="overflow-x-auto max-h-[380px] custom-scrollbar">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200 z-10">
                          <tr>
                            <th className="py-2 px-3 text-center w-12">Soru</th>
                            <th className="py-2 px-3 w-28">Ders</th>
                            <th className="py-2 px-3 min-w-[250px]">Kazanım</th>
                            <th className="py-2 px-3 text-center w-14">Doğru</th>
                            <th className="py-2 px-3 text-center w-14">Öğrenci</th>
                            <th className="py-2 px-3 text-center w-24">Sonuç</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentKazanimReport.items.map((row) => (
                            <tr key={row.outcome.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 text-center font-bold font-mono text-slate-600">
                                {row.outcome.questionNumber}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {row.outcome.subjectName}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                <span className="font-medium">{row.outcome.title}</span>
                                {row.outcome.code && <span className="text-indigo-600 font-mono text-[10px] ml-1.5 font-bold">({row.outcome.code})</span>}
                              </td>
                              <td className="py-2 px-3 text-center font-black font-mono text-slate-800">
                                {row.correctAnswer || '-'}
                              </td>
                              <td className="py-2 px-3 text-center font-black font-mono">
                                <span
                                  className={`inline-block w-6 h-6 leading-6 rounded-md border text-center ${
                                    row.isEmpty
                                      ? 'bg-slate-100 border-slate-200 text-slate-400'
                                      : row.isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-rose-50 border-rose-300 text-rose-700'
                                  }`}
                                >
                                  {row.studentAnswer || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    row.isEmpty
                                      ? 'bg-slate-100 text-slate-500'
                                      : row.isCorrect
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {row.isEmpty ? 'BOŞ' : row.isCorrect ? 'DOĞRU ✓' : 'YANLIŞ ✗'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Öğrenci verisi yüklenemedi.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500">
            {outcomes.length > 0 ? (
              <span>✓ Bu sınav için <strong>{outcomes.length}</strong> kazanım eşleştirildi.</span>
            ) : (
              <span>Kazanım tablosu yüklenmediği sürece sınav normal sonuç gösteriminde kalır.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {outcomes.length > 0 && activeTab === 'upload' && (
              <button
                type="button"
                onClick={handleSaveOutcomes}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Kazanımları Kaydet & Eşleştir</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
