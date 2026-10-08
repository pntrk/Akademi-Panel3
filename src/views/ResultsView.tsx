import React, { useState, useMemo, useEffect } from 'react';
import { Exam, ExamResult, EvaluatedScore, Student } from '../types';
import { useAppContext } from '../context/AppContext';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { 
  OPTS_4, 
  OPTS_5, 
  calculateScore, 
  formatClassSec, 
  normalizeTurkish,
  handleDownloadTemplate, 
  isLgsExam, 
  isTytExam, 
  isAytExam,
  calculateAtaLigPoints
} from '../lib/omrEngine';
import { generateId, exportToExcel, exportAoaToExcel, importFromExcel } from '../lib/utils';
import {
  BarChart3,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  Download,
  Upload,
  Printer,
  BookOpen,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  Copy,
  Edit3,
  CheckCircle2,
  X,
  Plus,
  List,
  Calendar,
  AlertTriangle,
  Award,
  Sparkles,
  Camera,
  FileSpreadsheet,
  Share2,
  Send,
  ExternalLink,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trophy,
  Target,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  FileCheck,
  Loader2
} from 'lucide-react';
import { AnalysisView } from './AnalysisView';
import { generateBatchReportCardsPdf, StudentEvaluatedData } from '../lib/pdfReportGenerator';

/* =========================================================================
   1. STUDENT REPORT MODAL (Öğrenci Sınav Karnesi & Anlık Cevap Düzenleme)
   ========================================================================= */
interface StudentReportModalProps {
  student: ExamResult & { scores: EvaluatedScore };
  exam: Exam;
  onClose: () => void;
  onUpdateStudent?: (updated: ExamResult) => void;
}

export function StudentReportModal({ student, exam, onClose, onUpdateStudent }: StudentReportModalProps) {
  const { state, userRole } = useAppContext();
  const [currentStudent, setCurrentStudent] = useState<ExamResult & { scores: EvaluatedScore }>(student);
  const [lastEditedQuestion, setLastEditedQuestion] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setCurrentStudent(student);
  }, [student]);

  const key = exam.keys?.[currentStudent.booklet || "A"] || exam.keys?.["A"] || [];
  const isLgs = isLgsExam(exam);
  const isTyt = isTytExam(exam);
  const isAyt = isAytExam(exam);
  const options = (exam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;
  const scoreData = currentStudent.evaluatedScore || (currentStudent as any).scores;

  // Öğrencinin son 3 kurum içi sınavındaki net gelişim verileri (Recharts için)
  const recentExamsNetData = useMemo(() => {
    const studentNo = currentStudent.no || (currentStudent as any).studentNo;
    const studentName = (currentStudent.name || (currentStudent as any).studentName || '').trim().toLowerCase();

    // Kurum içi / optik sınavları veya mevcut sınavı filtrele ve tarihe göre sırala
    const candidateExams = (state.exams || [])
      .filter(e => e.examType === 'internal' || (e.subjects && e.subjects.length > 0) || e.id === exam.id)
      .sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.no || 0) - (b.no || 0);
      });

    const points: Array<{
      id: string;
      examName: string;
      displayName: string;
      date: string;
      net: number;
      correct: number;
      wrong: number;
      isCurrent: boolean;
    }> = [];

    candidateExams.forEach(ex => {
      let dataForEx: { net: number; correct: number; wrong: number; isCurrent: boolean } | null = null;

      if (ex.id === exam.id) {
        // Şu anki modalda açık olan sınav (anlık güncellenen skor)
        dataForEx = {
          net: Number(Number(scoreData?.total?.net ?? 0).toFixed(2)),
          correct: scoreData?.total?.correct ?? 0,
          wrong: scoreData?.total?.wrong ?? 0,
          isCurrent: true
        };
      } else {
        // Geçmiş sınavdaki öğrenci sonucu
        const match = (ex.results || []).find((r: any) => {
          if (studentNo && (r.no === studentNo || r.studentNo === studentNo)) return true;
          if (studentName && r.name && r.name.trim().toLowerCase() === studentName) return true;
          return false;
        });

        if (match) {
          const matchScores = match.evaluatedScore || match.scores;
          const netVal = matchScores?.total?.net ?? (match as any).netTotal ?? (typeof matchScores === 'number' ? matchScores : 0);
          const cVal = matchScores?.total?.correct ?? (match as any).correctCount ?? 0;
          const wVal = matchScores?.total?.wrong ?? (match as any).wrongCount ?? 0;
          dataForEx = {
            net: Number(Number(netVal).toFixed(2)),
            correct: cVal,
            wrong: wVal,
            isCurrent: false
          };
        }
      }

      if (dataForEx) {
        const shortName = ex.name.length > 16 ? ex.name.substring(0, 14) + '..' : ex.name;
        points.push({
          id: ex.id,
          examName: ex.name,
          displayName: shortName,
          date: ex.date ? new Date(ex.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) : '',
          net: dataForEx.net,
          correct: dataForEx.correct,
          wrong: dataForEx.wrong,
          isCurrent: dataForEx.isCurrent
        });
      }
    });

    // Son 3 sınavı alalım
    return points.slice(-3);
  }, [state.exams, currentStudent, exam.id, scoreData]);

  // Net artış/azalış trendi
  const netTrend = useMemo(() => {
    if (recentExamsNetData.length < 2) return null;
    const prev = recentExamsNetData[recentExamsNetData.length - 2].net;
    const curr = recentExamsNetData[recentExamsNetData.length - 1].net;
    const diff = Number((curr - prev).toFixed(2));
    return {
      diff,
      isUp: diff > 0,
      isEqual: diff === 0
    };
  }, [recentExamsNetData]);

  const handleAnswerChange = (qIndex: number, newAns: string) => {
    const updatedAnswers = [...(currentStudent.answers || [])];
    const totalQuestions = (exam.subjects || []).reduce((sum, s) => sum + s.count, 0) || 90;
    while (updatedAnswers.length < totalQuestions) {
      updatedAnswers.push("");
    }
    const cleanAns = newAns.toUpperCase().trim();
    updatedAnswers[qIndex] = cleanAns;

    const currentKey = exam.keys?.[currentStudent.booklet || "A"] || exam.keys?.["A"] || [];
    const newScores = calculateScore(
      updatedAnswers,
      currentKey,
      exam.penalty ?? 3,
      exam.subjects || [],
      exam.format,
      exam.name,
      exam.optionsCount || 4
    );

    const updatedStudentObj: ExamResult & { scores: EvaluatedScore } = {
      ...currentStudent,
      answers: updatedAnswers,
      scores: newScores,
      evaluatedScore: newScores
    };

    setCurrentStudent(updatedStudentObj);
    setLastEditedQuestion(qIndex);
    onUpdateStudent?.(updatedStudentObj);
  };

  const handleBookletChange = (newBooklet: string) => {
    const newKey = exam.keys?.[newBooklet] || exam.keys?.["A"] || [];
    const newScores = calculateScore(
      currentStudent.answers || [],
      newKey,
      exam.penalty ?? 3,
      exam.subjects || [],
      exam.format,
      exam.name,
      exam.optionsCount || 4
    );

    const updatedStudentObj: ExamResult & { scores: EvaluatedScore } = {
      ...currentStudent,
      booklet: newBooklet,
      scores: newScores,
      evaluatedScore: newScores
    };

    setCurrentStudent(updatedStudentObj);
    onUpdateStudent?.(updatedStudentObj);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Lütfen pop-up engelleyiciye izin verin.");

    const scoreData = currentStudent.evaluatedScore || currentStudent.scores as any;

    let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${currentStudent.name} - Sınav Karnesi</title><style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 0; margin: 0; color: #333; font-size: 11px; line-height: 1.2; }
      .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; }
      .header h2 { margin: 0 0 4px 0; font-size: 14px; color: #475569; text-transform: uppercase; }
      .header h1 { margin: 0; font-size: 18px; font-weight: 900; }
      .info { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; font-weight: bold; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
      .info span { color: #2563eb; }
      .summary { display: flex; gap: 10px; margin-bottom: 15px; }
      .sum-box { flex: 1; padding: 8px; text-align: center; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
      .sum-title { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
      .sum-val { font-size: 20px !important; font-weight: 900; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: start; }
      .subject { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #fff; }
      .sub-head { background: #1e293b; color: white; padding: 5px; font-weight: bold; text-align: center; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; }
      th { background: #f1f5f9; padding: 3px; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
      td { border-bottom: 1px solid #f1f5f9; padding: 3px; }
      tr:last-child td { border-bottom: none; }
      .D { color: #16a34a; font-weight: bold; }
      .Y { color: #dc2626; font-weight: bold; }
      .B { color: #94a3b8; font-weight: bold; }
      @media print { 
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
        .subject { page-break-inside: avoid; } 
      }
    </style></head><body>
      <div class="header">
        <h2>${exam.name}</h2>
        <h1>ÖĞRENCİ SINAV KARNESİ</h1>
      </div>
      <div class="info">
        <div>Adı Soyadı: <span>${currentStudent.name}</span></div>
        <div>Öğrenci No: <span>${currentStudent.no}</span></div>
        <div>Sınıf/Şube: <span>${currentStudent.classStr || '-'} / ${currentStudent.sectionStr || '-'}</span></div>
        <div>Kitapçık: <span>${currentStudent.booklet || 'A'}</span></div>
      </div>
      <div class="summary">
        <div class="sum-box"><div class="sum-title">Toplam Doğru</div><div class="sum-val" style="color: #16a34a">${scoreData?.total?.correct || 0}</div></div>
        <div class="sum-box"><div class="sum-title">Toplam Yanlış</div><div class="sum-val" style="color: #dc2626">${scoreData?.total?.wrong || 0}</div></div>
        <div class="sum-box"><div class="sum-title">Toplam Boş</div><div class="sum-val" style="color: #64748b">${scoreData?.total?.empty || 0}</div></div>
        <div class="sum-box" style="background:#eff6ff; border-color:#bfdbfe;"><div class="sum-title" style="color:#1d4ed8;">Toplam Net</div><div class="sum-val" style="color: #1d4ed8">${(scoreData?.total?.net || 0).toFixed(2).replace('.', ',')}</div></div>
        ${isLgs && scoreData?.total?.lgsScore ? `<div class="sum-box" style="background:#fdf4ff; border-color:#c084fc;"><div class="sum-title" style="color:#7e22ce;">PUAN (LGS)</div><div class="sum-val" style="color: #7e22ce">${scoreData.total.lgsScore.toFixed(2).replace('.', ',')}</div></div><div class="sum-box" style="background:#faf5ff; border-color:#e879f9;"><div class="sum-title" style="color:#a21caf;">DİLİM</div><div class="sum-val" style="color: #a21caf">%${(scoreData.total.percentile || 0).toFixed(2).replace('.', ',')}</div></div>` : ''}
      </div>
      <div class="grid">
    `;

    if (!currentStudent.answers || currentStudent.answers.length === 0) {
      html += `
        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; overflow:hidden; margin-top:14px;">
          <div style="background:#1e293b; color:white; padding:8px 12px; font-weight:bold; font-size:12px; text-transform:uppercase;">Ders Bazlı Sonuç ve Net Dağılımı</div>
          <table style="width:100%; border-collapse:collapse; text-align:center; font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9; font-weight:bold; font-size:10px;">
                <th style="padding:7px 10px; text-align:left;">DERS ADI</th>
                <th style="padding:7px; color:#16a34a;">DOĞRU</th>
                <th style="padding:7px; color:#dc2626;">YANLIŞ</th>
                <th style="padding:7px; color:#64748b;">BOŞ</th>
                <th style="padding:7px; color:#2563eb; background:#eff6ff;">NET</th>
              </tr>
            </thead>
            <tbody>
      `;
      const subScores = scoreData?.subjectScores || {};
      const subKeys = Object.keys(subScores);
      if (subKeys.length > 0) {
        subKeys.forEach(sId => {
          const subObj = exam.subjects?.find(s => String(s.id) === String(sId));
          const subName = subObj ? subObj.name : sId;
          const ss = subScores[sId];
          html += `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 10px; text-align:left; font-weight:bold;">${subName}</td>
              <td style="padding:7px; color:#16a34a; font-weight:bold;">${ss.correct ?? '-'}</td>
              <td style="padding:7px; color:#dc2626; font-weight:bold;">${ss.wrong ?? '-'}</td>
              <td style="padding:7px; color:#64748b;">${ss.empty ?? '-'}</td>
              <td style="padding:7px; color:#2563eb; font-weight:900; background:#eff6ff;">${typeof ss.net === 'number' ? ss.net.toFixed(2).replace('.', ',') : (ss.net || '-')}</td>
            </tr>
          `;
        });
      } else {
        html += `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:7px 10px; text-align:left; font-weight:bold;">Genel Sınav Toplamı</td>
            <td style="padding:7px; color:#16a34a; font-weight:bold;">${scoreData?.total?.correct || '-'}</td>
            <td style="padding:7px; color:#dc2626; font-weight:bold;">${scoreData?.total?.wrong || '-'}</td>
            <td style="padding:7px; color:#64748b;">${scoreData?.total?.empty || '-'}</td>
            <td style="padding:7px; color:#2563eb; font-weight:900; background:#eff6ff;">${(scoreData?.total?.net || 0).toFixed(2).replace('.', ',')}</td>
          </tr>
        `;
      }
      html += `</tbody></table></div>`;
    } else {
      html += `<div class="grid">`;
      let qIndex = 0;
      (exam.subjects || []).forEach(sub => {
        const ss = scoreData?.subjectScores?.[sub.id] || { correct: 0, wrong: 0, net: 0 };
        html += `<div class="subject">
          <div class="sub-head">${sub.name} (D:${ss.correct} Y:${ss.wrong} N:${ss.net.toFixed(2).replace('.', ',')})</div>
          <table><tr><th>#</th><th>Cevap</th><th>Öğr.</th><th>Durum</th></tr>`;
        for (let i = 0; i < sub.count; i++) {
          const ans = currentStudent.answers?.[qIndex];
          const k = key ? key[qIndex] : undefined;
          const status = !ans ? "B" : (ans === k ? "D" : "Y");
          html += `<tr><td>${i + 1}</td><td>${k || "-"}</td><td>${ans || "-"}</td><td class="${status}">${!ans ? "BOŞ" : (ans === k ? "DOĞRU" : "YANLIŞ")}</td></tr>`;
          qIndex++;
        }
        html += `</table></div>`;
      });
      html += `</div>`;
    }

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  // Direct colorful, searchable PDF download for student
  const handleDownloadSinglePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateBatchReportCardsPdf(
        exam,
        [{
          ...currentStudent,
          naturalRank: (currentStudent as any).naturalRank || 1,
          evaluatedScore: (scoreData || {}) as any
        }],
        {
          includeQuestionMatrix: true,
          cardsPerPage: 1,
          schoolName: exam.institution || 'T.C. MİLLİ EĞİTİM BAKANLIĞI'
        }
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl relative flex flex-col max-h-[92vh] overflow-hidden border border-slate-300">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                Öğrenci Sınav Karnesi
              </h2>
              <p className="text-xs text-slate-500 font-medium">{currentStudent.name} • No: {currentStudent.no}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5 custom-scrollbar">
          {/* Student Info Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Öğrenci Adı</div>
              <div className="font-bold text-blue-600 truncate text-sm">{currentStudent.name}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Numara</div>
              <div className="font-bold font-mono text-slate-800 text-sm">{currentStudent.no}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Sınıf / Şube</div>
              <div className="font-bold text-slate-800 text-sm">{currentStudent.classStr || '-'} / {currentStudent.sectionStr || '-'}</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Kitapçık</div>
              {userRole === 'admin' ? (
                <select
                  value={currentStudent.booklet || 'A'}
                  onChange={(e) => handleBookletChange(e.target.value)}
                  className="font-bold text-indigo-700 text-xs sm:text-sm bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:bg-indigo-100 transition-colors w-full"
                >
                  <option value="A">A Kitapçığı</option>
                  <option value="B">B Kitapçığı</option>
                  <option value="C">C Kitapçığı</option>
                  <option value="D">D Kitapçığı</option>
                </select>
              ) : (
                <div className="font-bold font-mono text-indigo-700 text-sm py-0.5 px-2 bg-indigo-50 rounded-lg border border-indigo-200">
                  {currentStudent.booklet || 'A'} Kitapçığı
                </div>
              )}
            </div>
          </div>

          {/* Quick Metric Bubbles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-center">
            <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] text-emerald-700 font-bold uppercase mb-0.5">Doğru</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700">{scoreData?.total?.correct || 0}</div>
            </div>
            <div className="bg-rose-50/80 border border-rose-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] text-rose-700 font-bold uppercase mb-0.5">Yanlış</div>
              <div className="text-xl sm:text-2xl font-black text-rose-700">{scoreData?.total?.wrong || 0}</div>
            </div>
            <div className="bg-slate-100 border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] text-slate-600 font-bold uppercase mb-0.5">Boş</div>
              <div className="text-xl sm:text-2xl font-black text-slate-700">{scoreData?.total?.empty || 0}</div>
            </div>
            <div className="bg-blue-50/80 border border-blue-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
              <div className="text-[10px] text-blue-700 font-bold uppercase mb-0.5">Genel Net</div>
              <div className="text-xl sm:text-2xl font-black text-blue-700">{(scoreData?.total?.net || 0).toFixed(2).replace('.', ',')}</div>
            </div>
            {isLgs && (
              <>
                <div className="bg-purple-50/80 border border-purple-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
                  <div className="text-[10px] text-purple-700 font-bold uppercase mb-0.5">LGS Puanı</div>
                  <div className="text-xl sm:text-2xl font-black text-purple-700">{(scoreData?.total?.lgsScore || 0).toFixed(2).replace('.', ',')}</div>
                </div>
                <div className="bg-fuchsia-50/80 border border-fuchsia-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
                  <div className="text-[10px] text-fuchsia-700 font-bold uppercase mb-0.5">Genel Dilim</div>
                  <div className="text-xl sm:text-2xl font-black text-fuchsia-700">%{(scoreData?.total?.percentile || 0).toFixed(2).replace('.', ',')}</div>
                </div>
              </>
            )}
          </div>

          {/* Akademi Arena (AtaLig) LP Kartı */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <span>Akademi Arena Lig Puanı (LP)</span>
                  <span className="bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                    +{currentStudent.earnedLP || Math.round((scoreData?.total?.net || 0) * 10)} LP
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Bu sınavdan kazanılan puan ve rozetler öğrencinin genel lig sıralamasına işlenmiştir.
                </p>
              </div>
            </div>
            {currentStudent.earnedBadges && currentStudent.earnedBadges.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentStudent.earnedBadges.map((badge, bIdx) => (
                  <span key={bIdx} className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{badge}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Son 3 Kurum İçi Sınav Net Gelişimi Çizgi Grafiği (Recharts) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Son 3 Kurum İçi Sınav Net Gelişimi</span>
                    <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {recentExamsNetData.length} Sınav
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Öğrencinin kurum içi denemelerdeki net performans seyri
                  </p>
                </div>
              </div>
              {netTrend && (
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto ${
                  netTrend.isUp 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : netTrend.isEqual 
                      ? 'bg-slate-50 text-slate-700 border border-slate-200' 
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Son Sınava Göre:</span>
                  <span className="font-mono font-black">
                    {netTrend.isUp ? `+${netTrend.diff}` : `${netTrend.diff}`} Net {netTrend.isUp ? '↗' : netTrend.isEqual ? '→' : '↘'}
                  </span>
                </div>
              )}
            </div>

            {recentExamsNetData.length > 0 ? (
              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentExamsNetData} margin={{ top: 12, right: 20, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="displayName" 
                      tick={{ fontSize: 10.5, fill: '#64748b' }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-xs text-white p-2.5 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1 z-50">
                              <div className="font-bold text-slate-100 flex items-center justify-between gap-3">
                                <span>{data.examName}</span>
                                {data.isCurrent && (
                                  <span className="text-[9px] bg-blue-600 px-1.5 py-0.5 rounded font-bold">Mevcut</span>
                                )}
                              </div>
                              {data.date && <div className="text-[10px] text-slate-400">{data.date}</div>}
                              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                                <span className="text-blue-400 font-bold">Toplam Net:</span>
                                <span className="text-white font-mono font-black text-sm">
                                  {Number(data.net).toFixed(2).replace('.', ',')}
                                </span>
                              </div>
                              {(data.correct > 0 || data.wrong > 0) && (
                                <div className="text-[10px] text-slate-300 flex items-center gap-2">
                                  <span>D: <strong className="text-emerald-400">{data.correct}</strong></span>
                                  <span>Y: <strong className="text-rose-400">{data.wrong}</strong></span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="net" 
                      name="Net" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      dot={{ r: 4.5, fill: "#2563eb", strokeWidth: 2, stroke: "#ffffff" }}
                      activeDot={{ r: 6.5, fill: "#1d4ed8", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Öğrenciye ait geçmiş kurum içi sınav verisi bulunamadı.
              </div>
            )}
          </div>

          {!currentStudent.answers || currentStudent.answers.length === 0 ? (
            /* Publisher Exam: Clean Scorecard Table */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  Ders Bazlı Sonuç ve Net Dağılımı (Yayıncı Denemesi)
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  Toplam Net: {(scoreData?.total?.net || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Ders Adı</th>
                      <th className="p-3 text-center text-emerald-600">Doğru</th>
                      <th className="p-3 text-center text-rose-600">Yanlış</th>
                      <th className="p-3 text-center text-slate-500">Boş</th>
                      <th className="p-3 text-center text-blue-600 bg-blue-50/50">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.keys(scoreData?.subjectScores || {}).length > 0 ? (
                      Object.entries(scoreData?.subjectScores || {}).map(([sId, ss]: [string, any], idx) => {
                        const subObj = exam.subjects?.find(s => String(s.id) === String(sId));
                        const name = subObj ? subObj.name : sId;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-bold text-slate-800">{name}</td>
                            <td className="p-3 text-center font-bold text-emerald-600 font-mono">{ss.correct ?? '-'}</td>
                            <td className="p-3 text-center font-bold text-rose-600 font-mono">{ss.wrong ?? '-'}</td>
                            <td className="p-3 text-center font-medium text-slate-500 font-mono">{ss.empty ?? '-'}</td>
                            <td className="p-3 text-center font-black text-blue-700 bg-blue-50/30 font-mono">
                              {typeof ss.net === 'number' ? ss.net.toFixed(2).replace('.', ',') : (ss.net || '-')}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="p-3 font-bold text-slate-800">Genel Sınav Sonucu</td>
                        <td className="p-3 text-center font-bold text-emerald-600 font-mono">{scoreData?.total?.correct || '-'}</td>
                        <td className="p-3 text-center font-bold text-rose-600 font-mono">{scoreData?.total?.wrong || '-'}</td>
                        <td className="p-3 text-center font-medium text-slate-500 font-mono">{scoreData?.total?.empty || '-'}</td>
                        <td className="p-3 text-center font-black text-blue-700 bg-blue-50/30 font-mono">
                          {(scoreData?.total?.net || 0).toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Kurum İçi Optik Deneme: Subject Breakdown Cards & Manual Edit */
            <div className="space-y-2.5">
              {userRole === 'admin' && (
                <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-950 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs">
                      <Edit3 className="w-3 h-3" />
                    </span>
                    <div>
                      <span className="font-black text-blue-900">Manuel Müdahale: </span>
                      <span className="text-blue-800 text-[11px]">
                        Öğrenci cevaplarını aşağıdaki <strong>Öğr.</strong> kutucuklarından doğrudan değiştirebilirsiniz. Puanlar ve netler anında güncellenir.
                      </span>
                    </div>
                  </div>
                  {lastEditedQuestion !== null && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 animate-pulse">
                      ✓ Soru {lastEditedQuestion + 1} Güncellendi
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {(() => {
                  let globalQIndex = 0;
                  return (exam.subjects || []).map(sub => {
                    const ss = scoreData?.subjectScores?.[sub.id] || { correct: 0, wrong: 0, net: 0 };
                    const questions: React.ReactNode[] = [];
                    for (let i = 0; i < sub.count; i++) {
                      const currGlobalIdx = globalQIndex;
                      const ans = currentStudent.answers?.[currGlobalIdx];
                      const k = key ? key[currGlobalIdx] : undefined;
                      const isCorrect = ans && k && ans === k;
                      const isWrong = ans && k && ans !== k;
                      const isEmpty = !ans;
                      const statusClass = isEmpty
                        ? "text-slate-400 font-medium"
                        : isCorrect
                          ? "text-emerald-600 font-bold"
                          : "text-rose-600 font-bold";
                      const statusText = isEmpty ? "BOŞ" : isCorrect ? "DOĞRU" : "YANLIŞ";

                      questions.push(
                        <tr
                          key={i}
                          className={`border-b border-slate-100 transition-colors ${
                            lastEditedQuestion === currGlobalIdx ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-1 px-1.5 text-center text-slate-400 font-mono text-xs">{i + 1}</td>
                          <td className="py-1 px-1.5 text-center font-bold text-slate-700 font-mono">{k || "-"}</td>
                          <td className="py-1 px-1 text-center">
                            {userRole === 'admin' ? (
                              <select
                                value={ans || ""}
                                onChange={(e) => handleAnswerChange(currGlobalIdx, e.target.value)}
                                className={`w-11 h-7 text-xs font-black rounded-lg border text-center transition-all cursor-pointer outline-none shadow-2xs ${
                                  isEmpty
                                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                                    : isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                      : 'bg-rose-50 border-rose-300 text-rose-700'
                                }`}
                              >
                                <option value="">-</option>
                                {options.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`inline-block w-8 h-6 leading-6 text-xs font-black rounded-md border text-center font-mono ${
                                isEmpty
                                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                                  : isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                    : 'bg-rose-50 border-rose-300 text-rose-700'
                              }`}>
                                {ans || "-"}
                              </span>
                            )}
                          </td>
                          <td className={`py-1 px-1.5 text-center text-[10px] ${statusClass}`}>{statusText}</td>
                        </tr>
                      );
                      globalQIndex++;
                    }

                    return (
                      <div key={sub.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                        <div className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center text-xs font-bold">
                          <span className="truncate pr-2">{sub.name}</span>
                          <span className="shrink-0 text-[10px] bg-slate-700 px-2 py-0.5 rounded-full font-mono">
                            D:{ss.correct} Y:{ss.wrong} <span className="text-emerald-300 ml-1">N:{(ss.net || 0).toFixed(2).replace('.', ',')}</span>
                          </span>
                        </div>
                        <div className="overflow-x-auto max-h-60 custom-scrollbar">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] sticky top-0 border-b border-slate-100 z-10">
                              <tr>
                                <th className="py-1.5 px-1.5 text-center w-10">Soru</th>
                                <th className="py-1.5 px-1.5 text-center w-12">Cevap</th>
                                <th className="py-1.5 px-1 text-center w-14">Öğr.</th>
                                <th className="py-1.5 px-1.5 text-center">Durum</th>
                              </tr>
                            </thead>
                            <tbody>{questions}</tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-end gap-2.5 shrink-0">
          <button
            onClick={handleDownloadSinglePdf}
            disabled={isGeneratingPdf}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xs cursor-pointer"
          >
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>{isGeneratingPdf ? 'PDF Hazırlanıyor...' : 'Renkli PDF Karne İndir'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Karneyi Yazdır (A4)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. EDIT RESULT MODAL (Öğrenci Künye ve Cevap Düzenleme)
   ========================================================================= */
interface EditResultModalProps {
  student: ExamResult;
  exam: Exam;
  onClose: () => void;
  onSave: (updated: ExamResult) => void;
}

export function EditResultModal({ student, exam, onClose, onSave }: EditResultModalProps) {
  const [formData, setFormData] = useState({
    name: student.name || student.studentName || '',
    no: String(student.no || student.studentNo || ''),
    classStr: student.classStr || '',
    sectionStr: student.sectionStr || '',
    booklet: student.booklet || 'A'
  });
  const [answers, setAnswers] = useState<string[]>([...(student.answers || [])]);
  const options = (exam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;

  const setKey = (gIdx: number, val: string) => {
    const n = [...answers];
    n[gIdx] = n[gIdx] === val ? "" : val;
    setAnswers(n);
  };

  let gCounter = 0;

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl relative flex flex-col max-h-[92vh] overflow-hidden border border-slate-300">
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Öğrenci Sonucunu Düzenle
              </h2>
              <p className="text-xs text-slate-500 font-medium">Hatalı okunan bilgileri veya optik şıkları düzeltebilirsiniz.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Adı Soyadı</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold uppercase outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Öğrenci No</label>
              <input
                type="text"
                value={formData.no}
                onChange={e => setFormData({ ...formData, no: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Sınıf</label>
              <input
                type="text"
                value={formData.classStr}
                onChange={e => setFormData({ ...formData, classStr: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Şube</label>
              <input
                type="text"
                value={formData.sectionStr}
                onChange={e => setFormData({ ...formData, sectionStr: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold uppercase outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Kitapçık</label>
              <select
                value={formData.booklet}
                onChange={e => setFormData({ ...formData, booklet: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold cursor-pointer outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="A">A Kitapçığı</option>
                <option value="B">B Kitapçığı</option>
                <option value="C">C Kitapçığı</option>
                <option value="D">D Kitapçığı</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {(exam.subjects || []).map((sub) => {
              const startGlobalIdx = gCounter;
              gCounter += sub.count;
              const chunks: number[][] = [];
              for (let i = 0; i < sub.count; i += 10) {
                chunks.push(Array.from({ length: Math.min(10, sub.count - i) }).map((_, idx) => i + idx));
              }

              return (
                <div key={sub.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-700 text-xs sm:text-sm flex justify-between items-center">
                    <span>{sub.name}</span>
                    <span className="text-xs text-slate-400 font-mono">({sub.count} Soru)</span>
                  </div>
                  <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 bg-white">
                    {chunks.map((chunk, cIdx) => (
                      <div key={cIdx} className="flex flex-col gap-1.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 w-full">
                        {chunk.map(lIdx => {
                          const gIdx = startGlobalIdx + lIdx;
                          return (
                            <div key={gIdx} className="flex items-center justify-between hover:bg-slate-100 p-1 rounded-lg transition-colors">
                              <span className="w-6 font-bold text-slate-500 text-xs font-mono">{lIdx + 1}.</span>
                              <div className="flex gap-1 sm:gap-1.5">
                                {options.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setKey(gIdx, opt)}
                                    className={`w-7 h-7 rounded-full border-2 font-bold text-xs transition-all cursor-pointer ${
                                      answers[gIdx] === opt ? 'bg-blue-600 border-blue-600 text-white scale-105 shadow-2xs' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            İptal
          </button>
          <button
            onClick={() => onSave({ ...student, ...formData, answers })}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-xs flex gap-1.5 items-center cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Değişiklikleri Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Veritabanı ve arayüzdeki sınıfları tutarlı ve resmi formatta (örn. 8-A) gösterir.
 */
export const formatDisplayClass = (record: any): string => {
  if (!record) return '-';
  const { cls, sec } = formatClassSec(
    record.className || record.studentClass || record.classStr,
    record.sectionStr
  );
  if (cls && sec) return `${cls}-${sec}`;
  if (record.className && record.className !== '-') return record.className;
  if (record.studentClass && record.studentClass !== '-') return record.studentClass;
  if (cls) return `${cls}. Sınıf`;
  return '-';
};

/**
 * Bir öğrencinin veya sınav sonucunun seçilen sınıf filtresine uyup uymadığını kontrol eder.
 * Veritabanındaki '8A', '8-A', '8/A' varyasyonlarını akıllıca eşit kabul eder.
 */
export const isStudentInClass = (record: any, targetClass: string): boolean => {
  if (!targetClass || targetClass === 'ALL') return true;
  if (!record) return false;

  const targetParsed = formatClassSec(targetClass);
  const recordParsed = formatClassSec(
    record.className || record.studentClass || record.classStr,
    record.sectionStr
  );

  if (targetParsed.cls && targetParsed.sec && recordParsed.cls && recordParsed.sec) {
    return targetParsed.cls === recordParsed.cls && targetParsed.sec === recordParsed.sec;
  }

  const rCls = String(record.className || record.studentClass || record.classStr || '').replace(/[\s\-_/.]/g, '').toUpperCase();
  const tCls = String(targetClass).replace(/[\s\-_/.]/g, '').toUpperCase();
  return rCls === tCls || rCls.startsWith(tCls) || tCls.startsWith(rCls);
};

/**
 * Excel'den okunan ham satırı veritabanımızdaki (masterStudents) resmi öğrenci kaydıyla eşleştirir.
 */
export function findDatabaseStudent(
  rawNo: any,
  rawName: string,
  rawClass: string,
  studentsList: Student[]
): Student | null {
  if (!studentsList || studentsList.length === 0) return null;

  const numNo = parseInt(String(rawNo || '').replace(/[^\d]/g, ''), 10);
  const cleanName = (rawName || '').trim();
  const normName = normalizeTurkish(cleanName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const { cls: exGrade, sec: exSec } = formatClassSec(rawClass);

  // 1. ADIM: Numaraya göre arama (En yüksek güvenilirlik)
  if (numNo > 0) {
    const byNo = studentsList.filter(s => Number(s.no) === numNo);
    if (byNo.length === 1) {
      const cand = byNo[0];
      const candCls = formatClassSec(cand.classStr || cand.className, cand.sectionStr);
      // Eğer kademe belirtilmemişse veya aynı kademedeyse (örn. 8. sınıf)
      if (!exGrade || !candCls.cls || exGrade === candCls.cls) {
        return cand;
      }
    } else if (byNo.length > 1) {
      // Okulda aynı numaraya sahip farklı kademe/şubeler varsa:
      // A) Hem kademe hem şube eşleşmesi (örn. 8A <-> 8-A)
      const exactClass = byNo.find(s => {
        const c = formatClassSec(s.classStr || s.className, s.sectionStr);
        return exGrade && exSec && c.cls === exGrade && c.sec === exSec;
      });
      if (exactClass) return exactClass;

      // B) Kademe eşleşmesi (örn. 8. sınıf)
      const exactGrade = byNo.find(s => {
        const c = formatClassSec(s.classStr || s.className, s.sectionStr);
        return exGrade && c.cls === exGrade;
      });
      if (exactGrade) return exactGrade;

      // C) İsim benzerliği
      const nameMatch = byNo.find(s => {
        const sNorm = normalizeTurkish(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return sNorm && (sNorm.includes(normName) || normName.includes(sNorm));
      });
      if (nameMatch) return nameMatch;

      return byNo[0];
    }
  }

  // 2. ADIM: İsim ve Sınıf/Şube eşleşmesi (Excel'de numara eksik/farklıysa)
  if (normName.length >= 3) {
    const byName = studentsList.filter(s => {
      const sNorm = normalizeTurkish(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return sNorm === normName ||
        (sNorm.includes(normName) && normName.length >= 5) ||
        (normName.includes(sNorm) && sNorm.length >= 5);
    });

    if (byName.length === 1) {
      return byName[0];
    } else if (byName.length > 1) {
      const exactClass = byName.find(s => {
        const c = formatClassSec(s.classStr || s.className, s.sectionStr);
        return exGrade && exSec && c.cls === exGrade && c.sec === exSec;
      });
      if (exactClass) return exactClass;

      const exactGrade = byName.find(s => {
        const c = formatClassSec(s.classStr || s.className, s.sectionStr);
        return exGrade && c.cls === exGrade;
      });
      if (exactGrade) return exactGrade;

      return byName[0];
    }
  }

  return null;
}

/* =========================================================================
   3. MAIN RESULTS VIEW (3'lü Sekme: Sonuçlar | Devamsızlar | Öğrenci Kayıtları)
   ========================================================================= */
export function ResultsView() {
  const { 
    state, 
    setStudents, 
    saveOmrExamResults, 
    deleteOmrExamResult, 
    deleteAllOmrExamResults, 
    updateExamOmr, 
    userRole 
  } = useAppContext();

  // Active top-level tab switcher
  const [activeMainTab, setActiveMainTab] = useState<'results' | 'analysis'>('results');
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [isMobileMoreActionsOpen, setIsMobileMoreActionsOpen] = useState(false);

  // Active selected exam
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    try {
      const savedId = sessionStorage.getItem('active_exam_id');
      if (savedId && state.exams.some(e => String(e.id) === String(savedId))) {
        return String(savedId);
      }
    } catch (e) {}
    return state.exams.length > 0 ? String(state.exams[0].id) : "";
  });

  useEffect(() => {
    try {
      const savedId = sessionStorage.getItem('active_exam_id');
      if (savedId && state.exams.some(e => String(e.id) === String(savedId))) {
        setSelectedExamId(String(savedId));
      }
    } catch (e) {}
  }, [state.exams]);

  const exam: Exam = state.exams.find(e => String(e.id) === String(selectedExamId)) || state.exams[0] || {
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
    keys: { A: Array(90).fill(""), B: Array(90).fill(""), C: [], D: [] },
    results: []
  };

  const isLgs = isLgsExam(exam);
  const isTyt = isTytExam(exam);
  const isAyt = isAytExam(exam);

  // Soru & Madde Analizi sekmesi yalnızca Kurum İçi Optik sınavlarda aktiftir.
  // Yayıncı sınavı seçilirse otomatik olarak Sonuçlar / Sıralama sekmesine dönülür.
  useEffect(() => {
    if (exam && exam.examType !== 'internal' && activeMainTab === 'analysis') {
      setActiveMainTab('results');
    }
  }, [exam?.id, exam?.examType, activeMainTab]);

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<(ExamResult & { scores: EvaluatedScore }) | null>(null);
  const [editingStudent, setEditingStudent] = useState<ExamResult | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<ExamResult | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch PDF Report Cards Modal State
  const [isBatchPdfModalOpen, setIsBatchPdfModalOpen] = useState(false);
  const [batchPdfScope, setBatchPdfScope] = useState<'all' | 'class'>('all');
  const [batchPdfSelectedClass, setBatchPdfSelectedClass] = useState<string>('ALL');
  const [batchPdfIncludeMatrix, setBatchPdfIncludeMatrix] = useState<boolean>(true);
  const [batchPdfCardsPerPage, setBatchPdfCardsPerPage] = useState<1 | 2>(1);
  const [batchPdfSchoolName, setBatchPdfSchoolName] = useState<string>('T.C. MİLLİ EĞİTİM BAKANLIĞI');
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState<boolean>(false);
  const [batchPdfProgress, setBatchPdfProgress] = useState<{ current: number; total: number; statusText: string }>({
    current: 0,
    total: 0,
    statusText: ''
  });

  // Search & Filters & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classDropdownSearch, setClassDropdownSearch] = useState("");
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'cards' | 'table'>('cards');
  const [toastAlert, setToastAlert] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<'rank' | 'no' | 'name' | 'class' | 'net' | 'lgsScore' | 'correct' | 'wrong'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSubjectColumns, setShowSubjectColumns] = useState(true);

  const handleSort = (column: 'rank' | 'no' | 'name' | 'class' | 'net' | 'lgsScore' | 'correct' | 'wrong') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' || column === 'class' || column === 'no' || column === 'rank' ? 'asc' : 'desc');
    }
  };

  // Student list form state
  const [no, setNo] = useState("");
  const [name, setName] = useState("");
  const [classStr, setClassStr] = useState("");
  const [sectionStr, setSectionStr] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentNo, setEditingStudentNo] = useState<string | null>(null);
  const [uploadCls, setUploadCls] = useState("");
  const [uploadSec, setUploadSec] = useState("");
  const [activeMobileStudentView, setActiveMobileStudentView] = useState<'list' | 'add' | 'upload'>('list');

  const showAlert = (msg: string) => {
    setToastAlert(msg);
    setTimeout(() => setToastAlert(null), 3500);
  };

  // Central student roster
  const masterStudents = useMemo(() => {
    return state.students || [];
  }, [state.students]);

  // Exam results: prefer exam.results, fallback to state.results
  const currentExamResults: ExamResult[] = useMemo(() => {
    if (exam.results && exam.results.length > 0) return exam.results;
    return state.results.filter(r => 
      r.scores && (r.scores[String(exam.id)] !== undefined || r.scores[exam.name] !== undefined)
    );
  }, [exam, state.results]);

  const scannedNosSet = useMemo(() => {
    return new Set(currentExamResults.map(r => String(r.no || r.studentNo || '').trim()));
  }, [currentExamResults]);

  // Devamsız / Sınava Girmeyen Öğrenciler
  const absentStudents = useMemo(() => {
    return masterStudents.filter(s => {
      const sNo = String(s.no).trim();
      if (scannedNosSet.has(sNo)) return false;

      if (selectedClassFilter !== "ALL") {
        if (!isStudentInClass(s, selectedClassFilter)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (s.name || '').toLowerCase().includes(q) || sNo.includes(q);
      }

      return true;
    });
  }, [masterStudents, scannedNosSet, selectedClassFilter, searchQuery]);

  // Evaluated results with scores
  const evaluatedResults = useMemo(() => {
    let filtered = currentExamResults;

    if (selectedClassFilter !== "ALL") {
      filtered = filtered.filter(r => isStudentInClass(r, selectedClassFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(r =>
        ((r.name || r.studentName || '').toLowerCase().includes(q)) ||
        (String(r.no || r.studentNo || '').includes(q))
      );
    }

    return filtered.map(res => {
      // Veritabanımızdaki kayıtlı öğrenci bilgisiyle otomatik eşle
      const dbStudent = findDatabaseStudent(
        res.no || res.studentNo,
        res.name || res.studentName,
        res.studentClass || res.classStr,
        masterStudents
      );

      const effectiveNo = dbStudent ? dbStudent.no : (res.no || res.studentNo);
      const effectiveName = dbStudent ? dbStudent.name : (res.name || res.studentName);
      const effectiveCls = dbStudent?.classStr || formatClassSec(dbStudent?.className).cls || res.classStr;
      const effectiveSec = dbStudent?.sectionStr || formatClassSec(dbStudent?.className).sec || res.sectionStr;
      const effectiveClass = dbStudent 
        ? (dbStudent.className || formatDisplayClass(dbStudent))
        : (res.studentClass || formatDisplayClass(res));

      const hasAnswers = res.answers && res.answers.length > 0;
      const hasKeys = exam.keys && Object.keys(exam.keys).length > 0;

      if (hasAnswers && hasKeys) {
        const bk = res.booklet || 'A';
        const key = exam.keys?.[bk] || exam.keys?.["A"] || [];
        const score = calculateScore(
          res.answers || [],
          key,
          exam.penalty ?? 3,
          exam.subjects || [],
          exam.format,
          exam.name,
          exam.optionsCount || 4
        );
        return { 
          ...res, 
          no: effectiveNo,
          studentNo: effectiveNo,
          name: effectiveName,
          studentName: effectiveName,
          classStr: effectiveCls,
          sectionStr: effectiveSec,
          studentClass: effectiveClass,
          evaluatedScore: score,
          scores: score as any 
        };
      }

      if (res.evaluatedScore && typeof res.evaluatedScore === 'object' && res.evaluatedScore.total) {
        return {
          ...res,
          no: effectiveNo,
          studentNo: effectiveNo,
          name: effectiveName,
          studentName: effectiveName,
          classStr: effectiveCls,
          sectionStr: effectiveSec,
          studentClass: effectiveClass,
          evaluatedScore: res.evaluatedScore,
          scores: res.scores || (res.evaluatedScore as any)
        };
      }

      const totalNet = typeof res.scores === 'number'
        ? res.scores
        : (typeof res.average === 'number'
          ? res.average
          : (res.scores?.[String(exam.id)] || res.scores?.[exam.name] || 0));

      const fallbackScore: EvaluatedScore = {
        total: {
          correct: 0,
          wrong: 0,
          empty: 0,
          net: Number(totalNet) || 0,
          lgsScore: isLgs ? (Number(totalNet) * 5) : undefined,
          tytScore: isTyt ? (Number(totalNet) * 5) : undefined,
          percentile: undefined
        },
        subjectScores: typeof res.scores === 'object' ? (res.scores as any) : {}
      };

      return { 
        ...res, 
        no: effectiveNo,
        studentNo: effectiveNo,
        name: effectiveName,
        studentName: effectiveName,
        classStr: effectiveCls,
        sectionStr: effectiveSec,
        studentClass: effectiveClass,
        evaluatedScore: fallbackScore,
        scores: res.scores || (fallbackScore as any) 
      };
    }).sort((a, b) => {
      if (isLgs) {
        if (b.evaluatedScore.total.lgsScore !== a.evaluatedScore.total.lgsScore) {
          return b.evaluatedScore.total.lgsScore - a.evaluatedScore.total.lgsScore;
        }
      }
      return b.evaluatedScore.total.net - a.evaluatedScore.total.net;
    });
  }, [currentExamResults, exam, selectedClassFilter, searchQuery, isLgs]);

  // Evaluated results with ranking and sorting
  const evaluatedResultsWithRank = useMemo(() => {
    const list = evaluatedResults.map((r, idx) => ({
      ...r,
      naturalRank: idx + 1
    }));

    return [...list].sort((a, b) => {
      if (sortColumn === 'rank') {
        return sortDirection === 'asc' 
          ? a.naturalRank - b.naturalRank 
          : b.naturalRank - a.naturalRank;
      }
      if (sortColumn === 'no') {
        const noA = Number(String(a.no || a.studentNo || '0').replace(/[^\d]/g, '')) || 0;
        const noB = Number(String(b.no || b.studentNo || '0').replace(/[^\d]/g, '')) || 0;
        return sortDirection === 'asc' ? noA - noB : noB - noA;
      }
      if (sortColumn === 'name') {
        const nameA = (a.name || a.studentName || '').toString();
        const nameB = (b.name || b.studentName || '').toString();
        return sortDirection === 'asc' 
          ? nameA.localeCompare(nameB, 'tr') 
          : nameB.localeCompare(nameA, 'tr');
      }
      if (sortColumn === 'class') {
        const clsA = `${a.classStr || ''}/${a.sectionStr || ''}`;
        const clsB = `${b.classStr || ''}/${b.sectionStr || ''}`;
        return sortDirection === 'asc' 
          ? clsA.localeCompare(clsB, 'tr') 
          : clsB.localeCompare(clsA, 'tr');
      }
      if (sortColumn === 'net') {
        const netA = a.evaluatedScore.total.net;
        const netB = b.evaluatedScore.total.net;
        return sortDirection === 'asc' ? netA - netB : netB - netA;
      }
      if (sortColumn === 'lgsScore') {
        const sA = a.evaluatedScore.total.lgsScore ?? 0;
        const sB = b.evaluatedScore.total.lgsScore ?? 0;
        return sortDirection === 'asc' ? sA - sB : sB - sA;
      }
      if (sortColumn === 'correct') {
        const cA = a.evaluatedScore.total.correct ?? 0;
        const cB = b.evaluatedScore.total.correct ?? 0;
        return sortDirection === 'asc' ? cA - cB : cB - cA;
      }
      if (sortColumn === 'wrong') {
        const wA = a.evaluatedScore.total.wrong ?? 0;
        const wB = b.evaluatedScore.total.wrong ?? 0;
        return sortDirection === 'asc' ? wA - wB : wB - wA;
      }
      return a.naturalRank - b.naturalRank;
    });
  }, [evaluatedResults, sortColumn, sortDirection]);

  // Statistical summary
  const summaryStats = useMemo(() => {
    const totalMaster = masterStudents.length;
    if (evaluatedResults.length === 0) {
      return {
        avgNet: "0,00",
        maxNet: "0,00",
        minNet: "0,00",
        avgCorrect: "0",
        avgWrong: "0",
        avgEmpty: "0",
        totalScanned: 0,
        totalMaster,
        participationRate: "0",
        avgLgs: "0,00",
        maxLgs: "0,00",
        bestPercentile: "0,00"
      };
    }
    const totalNet = evaluatedResults.reduce((acc, curr) => acc + curr.evaluatedScore.total.net, 0);
    const totalCorrect = evaluatedResults.reduce((acc, curr) => acc + curr.evaluatedScore.total.correct, 0);
    const totalWrong = evaluatedResults.reduce((acc, curr) => acc + curr.evaluatedScore.total.wrong, 0);
    const totalEmpty = evaluatedResults.reduce((acc, curr) => acc + curr.evaluatedScore.total.empty, 0);
    const maxNet = Math.max(...evaluatedResults.map(r => r.evaluatedScore.total.net));
    const minNet = Math.min(...evaluatedResults.map(r => r.evaluatedScore.total.net));
    const avgNet = (totalNet / evaluatedResults.length).toFixed(2).replace('.', ',');
    const avgCorrect = (totalCorrect / evaluatedResults.length).toFixed(1).replace('.', ',');
    const avgWrong = (totalWrong / evaluatedResults.length).toFixed(1).replace('.', ',');
    const avgEmpty = (totalEmpty / evaluatedResults.length).toFixed(1).replace('.', ',');

    const totalLgs = evaluatedResults.reduce((acc, curr) => acc + (curr.evaluatedScore.total.lgsScore || 0), 0);
    const avgLgs = (totalLgs / evaluatedResults.length).toFixed(2).replace('.', ',');
    const maxLgs = Math.max(...evaluatedResults.map(r => r.evaluatedScore.total.lgsScore || 0)).toFixed(2).replace('.', ',');
    const validPercentiles = evaluatedResults.map(r => r.evaluatedScore.total.percentile).filter((p): p is number => typeof p === 'number');
    const bestPercentile = validPercentiles.length > 0 ? Math.min(...validPercentiles).toFixed(2).replace('.', ',') : "0,00";

    const relevantMasterCount = selectedClassFilter === "ALL" 
      ? totalMaster 
      : masterStudents.filter(s => isStudentInClass(s, selectedClassFilter)).length;

    const participationRate = relevantMasterCount > 0 
      ? Math.min(100, Math.round((evaluatedResults.length / relevantMasterCount) * 100))
      : 100;

    return {
      avgNet,
      maxNet: maxNet.toFixed(2).replace('.', ','),
      minNet: minNet.toFixed(2).replace('.', ','),
      avgCorrect,
      avgWrong,
      avgEmpty,
      totalScanned: evaluatedResults.length,
      totalMaster: relevantMasterCount || evaluatedResults.length,
      participationRate,
      avgLgs,
      maxLgs,
      bestPercentile
    };
  }, [evaluatedResults, masterStudents, selectedClassFilter]);

  // Export results to Excel
  const handleExportResultsExcel = () => {
    if (evaluatedResults.length === 0) {
      showAlert("Dışa aktarılacak sonuç bulunmuyor.");
      return;
    }
    const data = evaluatedResults.map((r, idx) => {
      const row: Record<string, any> = {
        "Sıra": idx + 1,
        "Okul No": r.no || r.studentNo || "-",
        "Öğrenci Adı Soyadı": r.name || r.studentName || "İsimsiz",
        "Sınıf": formatDisplayClass(r),
        "Şube": r.sectionStr || (formatClassSec(r.studentClass).sec) || "-",
        "Kitapçık": r.booklet || "A",
      };

      (exam.subjects || []).forEach(sub => {
        const ss = r.evaluatedScore?.subjectScores?.[sub.id] || { correct: 0, wrong: 0, net: 0 };
        row[`${sub.name} (D)`] = ss.correct;
        row[`${sub.name} (Y)`] = ss.wrong;
        row[`${sub.name} (Net)`] = typeof ss.net === 'number' ? Number(ss.net.toFixed(2)) : ss.net;
      });

      row["Toplam Doğru"] = r.evaluatedScore.total.correct;
      row["Toplam Yanlış"] = r.evaluatedScore.total.wrong;
      row["Toplam Boş"] = r.evaluatedScore.total.empty;
      row["Toplam Net"] = Number(r.evaluatedScore.total.net.toFixed(2));

      if (isLgs && r.evaluatedScore.total.lgsScore) {
        row["LGS Puanı"] = Number(r.evaluatedScore.total.lgsScore.toFixed(2));
        if (r.evaluatedScore.total.percentile) {
          row["Genel Yüzdelik Dilim (%)"] = Number(r.evaluatedScore.total.percentile.toFixed(2));
        }
      }
      return row;
    });

    const safeFilename = `${exam.name.replace(/[^\w\s-ğüşıöçĞÜŞİÖÇ]/gi, '_')}_Sonuc_Listesi`;
    exportToExcel(data, safeFilename);
    showAlert("Sınav sonuç listesi Excel olarak başarıyla indirildi.");
  };

  // Batch Report Card PDF Generator Handler
  const handleDownloadBatchPdf = async () => {
    let targetStudents = evaluatedResultsWithRank;
    if (batchPdfScope === 'class' && batchPdfSelectedClass !== 'ALL') {
      targetStudents = targetStudents.filter(r => isStudentInClass(r, batchPdfSelectedClass));
    }

    if (targetStudents.length === 0) {
      showAlert("Karnesi çıkarılacak öğrenci bulunamadı.");
      return;
    }

    setIsGeneratingBatchPdf(true);
    setBatchPdfProgress({
      current: 0,
      total: targetStudents.length,
      statusText: 'PDF karneler oluşturuluyor...'
    });

    try {
      await generateBatchReportCardsPdf(
        exam,
        targetStudents as StudentEvaluatedData[],
        {
          includeQuestionMatrix: batchPdfIncludeMatrix,
          cardsPerPage: batchPdfCardsPerPage,
          schoolName: batchPdfSchoolName.trim() || exam.institution || 'T.C. MİLLİ EĞİTİM BAKANLIĞI',
          onProgress: (current, total, statusText) => {
            setBatchPdfProgress({ current, total, statusText });
          }
        }
      );
      showAlert(`${targetStudents.length} öğrencinin karnesi renkli ve aranabilir PDF formatında başarıyla indirildi.`);
      setIsBatchPdfModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showAlert("PDF oluşturulurken bir hata oluştu: " + (err?.message || 'Bilinmeyen hata'));
    } finally {
      setIsGeneratingBatchPdf(false);
    }
  };

  // Available classes for filtering - Always reflects Database Classes
  const availableClasses = useMemo(() => {
    const classMap = new Map<string, string>(); // canonicalKey -> displayClass (örn. "8-A")

    // 1. Veritabanımızdaki öğrencilerin sınıflarını al
    masterStudents.forEach(s => {
      const { cls, sec } = formatClassSec(s.classStr || s.className, s.sectionStr);
      if (cls && sec) {
        classMap.set(`${cls}-${sec}`, `${cls}-${sec}`);
      } else if (s.className && s.className.trim() && s.className !== '-') {
        classMap.set(s.className.trim(), s.className.trim());
      }
    });

    // 2. Sınav sonuçlarındaki sınıfları da dahil et
    currentExamResults.forEach(r => {
      const { cls, sec } = formatClassSec(r.studentClass || r.classStr, r.sectionStr);
      if (cls && sec) {
        classMap.set(`${cls}-${sec}`, `${cls}-${sec}`);
      } else if (r.studentClass && r.studentClass.trim() && r.studentClass !== '-') {
        classMap.set(r.studentClass.trim(), r.studentClass.trim());
      }
    });

    // 3. Veritabanında sınıf yoksa standart 8. sınıf şubelerini ekle
    if (classMap.size === 0) {
      ['8-A', '8-B', '8-C', '8-D'].forEach(c => classMap.set(c, c));
    }

    const allSorted = Array.from(classMap.values()).sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    // Aktif sınav LGS veya 8. sınıf sınavıysa 8. sınıf şubelerini öne al
    const isExamLgs = isLgs || (exam.name && /8|lgs/i.test(exam.name));
    if (isExamLgs) {
      const g8 = allSorted.filter(c => c.startsWith('8'));
      const others = allSorted.filter(c => !c.startsWith('8'));
      return [...g8, ...others];
    }

    return allSorted;
  }, [masterStudents, currentExamResults, isLgs, exam.name]);

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableClasses.forEach(cls => {
      counts[cls] = currentExamResults.filter(r => isStudentInClass(r, cls)).length;
    });
    return counts;
  }, [availableClasses, currentExamResults]);

  // Veritabanı kütüğündeki sınıf mevcudu sayıları
  const classDbCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableClasses.forEach(cls => {
      counts[cls] = masterStudents.filter(s => isStudentInClass(s, cls)).length;
    });
    return counts;
  }, [availableClasses, masterStudents]);

  const safeConfirm = (msg: string): boolean => {
    try {
      return typeof window !== 'undefined' && window.confirm ? window.confirm(msg) : true;
    } catch {
      return true;
    }
  };

  // Delete result confirmation
  const handleDeleteResult = (student: ExamResult) => {
    setStudentToDelete(student);
  };

  const confirmDeleteResult = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const identifier = studentToDelete.id ?? studentToDelete.studentId ?? studentToDelete.studentNo ?? studentToDelete.no;
      if (identifier !== undefined && identifier !== null) {
        await deleteOmrExamResult(String(exam.id), identifier);
      }
      showAlert(`${studentToDelete.name || 'Öğrencinin'} sınav sonucu başarıyla silindi.`);
      setStudentToDelete(null);
    } catch (err) {
      console.error(err);
      showAlert("Sonuç silinirken bir hata oluştu.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete all results confirmation
  const handleDeleteAllResults = () => {
    if (currentExamResults.length === 0) return;
    setIsDeleteAllModalOpen(true);
  };

  const confirmDeleteAllResults = async () => {
    setIsDeleting(true);
    try {
      await deleteAllOmrExamResults(String(exam.id));
      showAlert("Bu sınava ait tüm sonuçlar başarıyla silindi.");
      setIsDeleteAllModalOpen(false);
    } catch (err) {
      console.error(err);
      showAlert("Tüm sonuçlar silinirken bir hata oluştu.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Save edit student result
  const handleSaveResultEdit = async (updated: ExamResult) => {
    const existing = [...currentExamResults];
    const idx = existing.findIndex(r => String(r.id) === String(updated.id));
    if (idx >= 0) {
      existing[idx] = updated;
    } else {
      existing.push(updated);
    }
    await saveOmrExamResults(String(exam.id), existing);
    setEditingStudent(null);
    showAlert(`${updated.name} başarıyla güncellendi.`);
  };

  // Print results table
  const handlePrintResults = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return showAlert("Lütfen pop-up engelleyiciye izin verin.");

    let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${exam.name} - Sonuç Listesi</title><style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 15px; text-transform: uppercase; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; text-align: center; font-size: 10px; }
      th, td { border: 1px solid #cbd5e1; padding: 5px; }
      th { background-color: #f1f5f9; font-weight: bold; font-size: 9px; text-transform: uppercase; }
      .net { font-weight: bold; color: #2563eb; }
      .lgs-puan { font-weight: 900; color: #7e22ce; background-color: #fdf4ff !important; }
      .D { color: #16a34a; }
      .Y { color: #dc2626; }
      .name-col { text-align: left; font-weight: bold; }
      @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    </style></head><body>
      <h1>${exam.name} - GENEL SONUÇ LİSTESİ</h1>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Sıra</th>
            <th rowspan="2">Öğr. No</th>
            <th rowspan="2">Adı Soyadı</th>
            <th rowspan="2">Sınıf</th>
            <th rowspan="2">Kit.</th>`;

    (exam.subjects || []).forEach(sub => {
      html += `<th colspan="3">${sub.name}</th>`;
    });

    html += `<th colspan="${isLgs ? 6 : 4}" style="background-color: #e2e8f0;">GENEL TOPLAM</th></tr><tr>`;

    (exam.subjects || []).forEach(() => {
      html += `<th class="D">D</th><th class="Y">Y</th><th class="net">N</th>`;
    });
    html += `<th class="D">D</th><th class="Y">Y</th><th>B</th><th class="net" style="background-color: #e2e8f0;">NET</th>`;
    if (isLgs) {
      html += `<th class="lgs-puan">PUAN</th><th>DİLİM</th>`;
    }
    html += `</tr></thead><tbody>`;

    evaluatedResults.forEach((student, idx) => {
      html += `<tr>
        <td>${idx + 1}</td>
        <td style="font-weight:bold; color:#dc2626;">${student.no}</td>
        <td class="name-col">${student.name}</td>
        <td>${student.classStr || '-'}/${student.sectionStr || '-'}</td>
        <td>${student.booklet || 'A'}</td>`;

      (exam.subjects || []).forEach(sub => {
        const ss = student.evaluatedScore?.subjectScores?.[sub.id] || { correct: 0, wrong: 0, net: 0 };
        html += `<td class="D">${ss.correct}</td><td class="Y">${ss.wrong}</td><td class="net">${ss.net.toFixed(2).replace('.', ',')}</td>`;
      });

      html += `<td class="D" style="font-weight:bold;">${student.evaluatedScore.total.correct}</td>
               <td class="Y" style="font-weight:bold;">${student.evaluatedScore.total.wrong}</td>
               <td style="font-weight:bold;">${student.evaluatedScore.total.empty}</td>
               <td class="net" style="background-color: #f8fafc; font-size: 11px;">${student.evaluatedScore.total.net.toFixed(2).replace('.', ',')}</td>`;
      if (isLgs) {
        html += `<td class="lgs-puan">${student.evaluatedScore.total.lgsScore.toFixed(2).replace('.', ',')}</td>`;
        html += `<td>%${student.evaluatedScore.total.percentile.toFixed(2).replace('.', ',')}</td>`;
      }
      html += `</tr>`;
    });

    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  // Copy absent list
  const handleCopyAbsentList = () => {
    if (absentStudents.length === 0) return;
    const text = `Sınava Girmeyen Öğrenciler (${exam.name} - ${selectedClassFilter === 'ALL' ? 'Tüm Okul' : selectedClassFilter}):\n` +
      absentStudents.map((s, i) => `${i + 1}. [No: ${s.no}] ${s.name} (${s.classStr || s.className || ''}/${s.sectionStr || ''})`).join('\n');
    navigator.clipboard.writeText(text);
    showAlert("Sınava girmeyen öğrencilerin listesi panoya kopyalandı.");
  };

  // WhatsApp Share for absent students
  const handleShareWhatsApp = () => {
    if (absentStudents.length === 0) return;
    const text = `*${exam.name} - Sınava Katılmayan Öğrenciler*\n` +
      `Sınıf/Şube: ${selectedClassFilter === 'ALL' ? 'Tüm Okul' : selectedClassFilter}\n` +
      `Toplam: ${absentStudents.length} Öğrenci\n\n` +
      absentStudents.map((s, i) => `${i + 1}. [No: ${s.no}] ${s.name} (${s.classStr || s.className || ''}/${s.sectionStr || ''})`).join('\n');
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Print Absent List (A4)
  const handlePrintAbsentList = () => {
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) return;
    let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Sınava Katılmayanlar - ${exam.name}</title><style>
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 10px; }
      .header { border-bottom: 2px solid #334155; padding-bottom: 8px; margin-bottom: 12px; }
      .header h2 { margin: 0; font-size: 16px; font-weight: 900; }
      .header p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
      th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left; }
      td { padding: 6px; border: 1px solid #e2e8f0; }
      .center { text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
      <div class="header">
        <h2>${exam.name} - SINAVA KATILMAYAN (DEVAMSIZ) ÖĞRENCİLER</h2>
        <p>Filtre: ${selectedClassFilter === 'ALL' ? 'Tüm Okul' : selectedClassFilter} • Toplam: ${absentStudents.length} Öğrenci • Tarih: ${new Date().toLocaleDateString('tr-TR')}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th class="center" style="width: 35px;">#</th>
            <th class="center" style="width: 80px;">Okul No</th>
            <th>Öğrenci Adı Soyadı</th>
            <th class="center" style="width: 90px;">Sınıf / Şube</th>
            <th class="center" style="width: 100px;">İmza / Durum</th>
          </tr>
        </thead>
        <tbody>
          ${absentStudents.map((s, idx) => `
            <tr>
              <td class="center">${idx + 1}</td>
              <td class="center" style="font-weight: bold; font-family: monospace;">${s.no}</td>
              <td style="font-weight: bold;">${s.name}</td>
              <td class="center">${s.classStr || s.className || '-'}/${s.sectionStr || '-'}</td>
              <td class="center" style="color: #dc2626; font-weight: bold;">GİRMEDİ</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  // Publisher Exam Excel Upload & Template
  const publisherFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDownloadPublisherTemplate = () => {
    const institutionTitle = "ATATÜRK ORTAOKULU (KIRKLARELİ/KIRKLARELİ MERKEZ)";
    const examTitle = exam.name ? `${exam.name.toUpperCase()}` : "ULTİ 8. SINIF SÜREÇ TARAMA SERİSİ 1";

    const aoa: any[][] = [
      // Satır 1: Kurum Başlığı & Bölüm Başlıkları
      [
        institutionTitle, null, null,
        "Sözel (TÜR)", null, null,
        "Sözel (TAR)", null, null,
        "Sözel (DİN)", null, null,
        "Sözel (İNG)", null, null,
        "Sayısal (MAT)", null, null,
        "Sayısal (FEN)", null, null,
        "Toplam", null, null,
        "LGS", null, null, null, null, null
      ],
      // Satır 2: Sınav Adı & Dersler
      [
        examTitle, null, null,
        "Türkçe", null, null,
        "Tarih", null, null,
        "Din K.ve A.B.", null, null,
        "İngilizce", null, null,
        "Matematik", null, null,
        "Fen", null, null,
        null, null, null,
        "Puan",
        "Dereceler", null, null, null, null
      ],
      // Satır 3: Detaylı Sütun Başlıkları
      [
        "Öğr.No", "Ad, Soyad", "Sınıf",
        "D", "Y", "N",
        "D", "Y", "N",
        "D", "Y", "N",
        "D", "Y", "N",
        "D", "Y", "N",
        "D", "Y", "N",
        "D", "Y", "N",
        "Puan",
        "Sınıf", "Kurum", "İlçe", "İl", "Genel"
      ],
      // Satır 4: Genel Ortalama
      [
        "Genel Ortalama: ", null, null,
        13.08, 5.98, 11.09,
        6.45, 3.08, 5.42,
        7.46, 2.04, 6.78,
        6.25, 2.81, 5.32,
        9.55, 5.76, 7.63,
        13.48, 5.09, 11.78,
        56.27, 24.76, 48.02,
        352.68, null, null, null, null, null
      ],
      // Satır 5: Kurum Ortalaması
      [
        "Kurum Ortalaması: ", null, null,
        11.74, 7.11, 9.37,
        5.47, 3.80, 4.20,
        6.91, 2.53, 6.06,
        5.71, 3.28, 4.61,
        7.14, 6.35, 5.02,
        10.11, 7.39, 7.64,
        47.07, 30.46, 36.92,
        313.47, null, null, null, null, null
      ]
    ];

    // Okul kütüğünde kayıtlı gerçek öğrenciler varsa, şablona onların numara, isim ve sınıflarını öncelikli yerleştir
    let sampleStudentRows: any[][] = [];
    if (masterStudents && masterStudents.length > 0) {
      sampleStudentRows = masterStudents.slice(0, 15).map((s, idx) => {
        const clsStr = formatDisplayClass(s);
        const turD = Math.max(0, 18 - (idx % 4));
        const turY = idx % 3;
        const turN = +(turD - turY / 3).toFixed(2);
        const tarD = Math.max(0, 9 - (idx % 3));
        const tarY = idx % 2;
        const tarN = +(tarD - tarY / 3).toFixed(2);
        const dinD = Math.max(0, 9 - (idx % 2));
        const dinY = (idx + 1) % 2;
        const dinN = +(dinD - dinY / 3).toFixed(2);
        const ingD = Math.max(0, 8 - (idx % 3));
        const ingY = idx % 2;
        const ingN = +(ingD - ingY / 3).toFixed(2);
        const matD = Math.max(0, 17 - (idx % 5));
        const matY = idx % 4;
        const matN = +(matD - matY / 3).toFixed(2);
        const fenD = Math.max(0, 19 - (idx % 3));
        const fenY = idx % 2;
        const fenN = +(fenD - fenY / 3).toFixed(2);
        const totD = turD + tarD + dinD + ingD + matD + fenD;
        const totY = turY + tarY + dinY + ingY + matY + fenY;
        const totN = +(turN + tarN + dinN + ingN + matN + fenN).toFixed(2);
        const puan = +(250 + totN * 2.7).toFixed(2);
        return [
          s.no,
          s.name,
          clsStr,
          turD, turY, turN,
          tarD, tarY, tarN,
          dinD, dinY, dinN,
          ingD, ingY, ingN,
          matD, matY, matN,
          fenD, fenY, fenN,
          totD, totY, totN,
          puan,
          idx + 1, idx + 1, idx + 2, idx + 2, 100 + idx * 50
        ];
      });
    }

    if (sampleStudentRows.length === 0) {
      sampleStudentRows = [
        [8, "ALP KARA", "8-A", 19, 1, 18.67, 9, 1, 8.67, 9, 1, 8.67, 9, 1, 8.67, 19, 1, 18.67, 20, 0, 20.00, 85, 5, 83.33, 481.58, 1, 1, 3, 3, 516],
        [89, "SERKAN ALTUN", "8-A", 19, 1, 18.67, 9, 1, 8.67, 8, 2, 7.33, 7, 3, 6.00, 18, 2, 17.33, 20, 0, 20.00, 81, 9, 78.00, 468.89, 2, 2, 6, 6, 1491],
        [45, "EMİR MEYDAN", "8-B", 15, 5, 13.33, 7, 3, 6.00, 9, 1, 8.67, 10, 0, 10.00, 20, 0, 20.00, 20, 0, 20.00, 81, 9, 78.00, 463.27, 1, 3, 9, 9, 2006],
        [60, "MELİS ÖZTÜRK", "8-A", 16, 4, 14.67, 7, 3, 6.00, 9, 1, 8.67, 7, 3, 6.00, 18, 2, 17.33, 20, 0, 20.00, 77, 13, 72.67, 450.28, 3, 4, 14, 14, 3392],
        [70, "MİNEL DARCANLI", "8-B", 14, 5, 12.33, 7, 2, 6.33, 10, 0, 10.00, 10, 0, 10.00, 15, 3, 14.00, 19, 1, 18.67, 75, 11, 71.33, 429.19, 2, 5, 28, 28, 5849],
        [129, "CEYLİN SU GÖK", "8-B", 17, 3, 16.00, 7, 3, 6.00, 9, 1, 8.67, 8, 2, 7.33, 12, 8, 9.33, 20, 0, 20.00, 73, 17, 67.33, 420.73, 3, 6, 32, 32, 6900],
        [542, "YİĞİT TUĞRUL IŞIKLAR", "8-A", 17, 3, 16.00, 7, 3, 6.00, 7, 3, 6.00, 9, 1, 8.67, 15, 2, 14.33, 16, 4, 14.67, 71, 16, 65.67, 420.34, 4, 7, 33, 33, 6955],
        [122, "BERK POLATOĞLU", "8-B", 14, 6, 12.00, 10, 0, 10.00, 9, 1, 8.67, 9, 1, 8.67, 15, 4, 13.67, 17, 3, 16.00, 74, 15, 69.00, 417.78, 4, 8, 34, 34, 7258],
        [123, "CEMRE SÖZENER", "8-B", 14, 6, 12.00, 4, 6, 2.00, 9, 1, 8.67, 9, 1, 8.67, 17, 2, 16.33, 17, 3, 16.00, 70, 19, 63.67, 416.30, 5, 9, 35, 35, 7446],
        [20, "BADE UMAN", "8-A", 15, 2, 14.33, 8, 1, 7.67, 9, 1, 8.67, 6, 2, 5.33, 14, 1, 13.67, 16, 2, 15.33, 68, 9, 65.00, 415.63, 5, 10, 36, 36, 7532]
      ];
    }

    aoa.push(...sampleStudentRows);

    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
      { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },
      { s: { r: 0, c: 12 }, e: { r: 0, c: 14 } },
      { s: { r: 0, c: 15 }, e: { r: 0, c: 17 } },
      { s: { r: 0, c: 18 }, e: { r: 0, c: 20 } },
      { s: { r: 0, c: 21 }, e: { r: 0, c: 23 } },
      { s: { r: 0, c: 24 }, e: { r: 0, c: 29 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
      { s: { r: 1, c: 6 }, e: { r: 1, c: 8 } },
      { s: { r: 1, c: 9 }, e: { r: 1, c: 11 } },
      { s: { r: 1, c: 12 }, e: { r: 1, c: 14 } },
      { s: { r: 1, c: 15 }, e: { r: 1, c: 17 } },
      { s: { r: 1, c: 18 }, e: { r: 1, c: 20 } },
      { s: { r: 1, c: 25 }, e: { r: 1, c: 29 } }
    ];

    const cols = [
      { wch: 10 }, // Öğr.No
      { wch: 25 }, // Ad, Soyad
      { wch: 8 },  // Sınıf
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // TÜR D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // TAR D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // DİN D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // İNG D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // MAT D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 7 }, // FEN D, Y, N
      { wch: 6 }, { wch: 6 }, { wch: 8 }, // TOPLAM D, Y, N
      { wch: 12 }, // Puan
      { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 8 } // Sınıf, Kurum, İlçe, İl, Genel
    ];

    exportAoaToExcel(aoa, `${exam.name || 'Yayin'}_Kurum_Net_Listesi_Sablonu`, {
      sheetName: 'Kurum Net Listesi',
      merges,
      cols
    });
    showAlert("Kurum Net Listesi Excel örnek şablonu başarıyla indirildi.");
  };

  const handlePublisherExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      importFromExcel(file, (data, rawRows) => {
        if ((!data || data.length === 0) && (!rawRows || rawRows.length === 0)) {
          showAlert("Yüklenen dosyada geçerli veri bulunamadı.");
          return;
        }

        const newResults: ExamResult[] = [];
        const newStudentsToAdd: Student[] = [];
        let matchedWithDbCount = 0;

        // 1. ÖNCE: Kurum Net Listesi (Çok satırlı başlık içeren resmi yayıncı formatı) Denemesi
        let processedWithKurumNetListesi = false;

        if (rawRows && Array.isArray(rawRows) && rawRows.length >= 3) {
          let headerRowIdx = -1;

          for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const row = rawRows[i] || [];
            const rowStr = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
            if (
              (rowStr.includes('öğr.no') || rowStr.includes('okul no') || rowStr.includes('numara') || rowStr.includes('öğrenci no') || rowStr.includes('ogr.no') || rowStr.includes('no')) &&
              (rowStr.includes('ad') || rowStr.includes('soyad') || rowStr.includes('isim'))
            ) {
              headerRowIdx = i;
              break;
            }
          }

          if (headerRowIdx >= 0) {
            const headerRow = rawRows[headerRowIdx] || [];
            const prevRow = headerRowIdx > 0 ? (rawRows[headerRowIdx - 1] || []) : [];
            const prevPrevRow = headerRowIdx > 1 ? (rawRows[headerRowIdx - 2] || []) : [];

            let noCol = -1;
            let nameCol = -1;
            let classCol = -1;
            let puanCol = -1;
            let totalNetCol = -1;
            let totalDCol = -1;
            let totalYCol = -1;

            const subjectsMap: Record<string, { name: string; dCol: number; yCol: number; nCol: number }> = {};
            let currentSub = '';

            for (let c = 0; c < headerRow.length; c++) {
              const h = String(headerRow[c] || '').trim();
              const hl = h.toLowerCase();
              const p = String(prevRow[c] || '').trim();
              const pl = p.toLowerCase();
              const pp = String(prevPrevRow[c] || '').trim();
              const ppl = pp.toLowerCase();

              if (p && !['puan', 'dereceler', 'toplam', 'lgs'].includes(pl)) {
                currentSub = p;
              } else if (pp && (ppl.includes('toplam') || pl.includes('toplam'))) {
                currentSub = 'Toplam';
              } else if ((p && pl.includes('puan')) || hl === 'puan') {
                currentSub = 'Puan';
              }

              // Kimlik Sütunları
              if (noCol === -1 && (hl === 'öğr.no' || hl === 'okul no' || hl === 'no' || hl === 'numara' || hl === 'öğrenci no' || hl === 'ogr.no')) {
                noCol = c;
              } else if (nameCol === -1 && (hl.includes('ad') || hl.includes('soyad') || hl.includes('isim'))) {
                nameCol = c;
              } else if (classCol === -1 && (hl === 'sınıf' || hl === 'sinif' || hl === 'şube')) {
                classCol = c;
              } else if (hl === 'puan' || hl === 'lgs puanı' || pl === 'puan') {
                puanCol = c;
              } else if (currentSub === 'Toplam') {
                if (hl === 'd') totalDCol = c;
                else if (hl === 'y') totalYCol = c;
                else if (hl === 'n' || hl === 'net') totalNetCol = c;
              } else if (currentSub && currentSub !== 'Puan' && !['sınıf', 'kurum', 'ilçe', 'il', 'genel'].includes(hl)) {
                if (!subjectsMap[currentSub]) {
                  subjectsMap[currentSub] = { name: currentSub, dCol: -1, yCol: -1, nCol: -1 };
                }
                if (hl === 'd') subjectsMap[currentSub].dCol = c;
                else if (hl === 'y') subjectsMap[currentSub].yCol = c;
                else if (hl === 'n' || hl === 'net') subjectsMap[currentSub].nCol = c;
              }
            }

            // Başlık gibi geçersiz eşleşmeleri temizle
            Object.keys(subjectsMap).forEach(k => {
              if (subjectsMap[k].dCol === -1 && subjectsMap[k].yCol === -1 && subjectsMap[k].nCol === -1) {
                delete subjectsMap[k];
              }
            });

            if (noCol >= 0 && nameCol >= 0) {
              for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
                const row = rawRows[r] || [];
                if (!row || row.length === 0) continue;

                const cell0 = String(row[noCol] || '').trim().toLowerCase();
                const cell1 = String(row[nameCol] || '').trim().toLowerCase();

                // Özet ve ortalama satırlarını atla
                if (
                  cell0.includes('ortalama') || cell1.includes('ortalama') ||
                  cell0.includes('toplam') || cell1.includes('toplam') ||
                  cell0.includes('genel') || cell1.includes('genel') ||
                  cell0.includes('kurum') || cell1.includes('kurum')
                ) {
                  continue;
                }

                const rawNo = row[noCol];
                const rawName = row[nameCol];
                const rawClass = classCol >= 0 ? row[classCol] : '';

                const studentNo = parseInt(String(rawNo || '').replace(/[^\d]/g, ''), 10);
                const studentName = String(rawName || '').trim().toUpperCase();

                if (!studentNo || !studentName || studentName.length < 2) continue;

                let classStr = '';
                let sectionStr = '';
                if (rawClass) {
                  const cStr = String(rawClass).trim();
                  const match = cStr.match(/^(\d+)[\s\-_/]*([A-Za-zÇĞİÖŞÜçğıöşü]?)/);
                  if (match) {
                    classStr = match[1];
                    sectionStr = (match[2] || '').toUpperCase();
                  } else {
                    classStr = cStr;
                  }
                }

                // Uygulama veritabanındaki öğrenci ve sınıf bilgileriyle akıllı eşleştir
                const foundStudent = findDatabaseStudent(studentNo, studentName, rawClass, masterStudents);
                if (foundStudent) {
                  matchedWithDbCount++;
                }

                const finalNo = foundStudent ? foundStudent.no : studentNo;
                const finalName = foundStudent ? foundStudent.name : studentName;
                const finalClassStr = foundStudent ? (foundStudent.classStr || formatClassSec(foundStudent.className).cls || classStr) : classStr;
                const finalSectionStr = foundStudent ? (foundStudent.sectionStr || formatClassSec(foundStudent.className).sec || sectionStr) : sectionStr;
                const finalDisplayClass = foundStudent 
                  ? (foundStudent.className || (finalSectionStr ? `${finalClassStr}-${finalSectionStr}` : finalClassStr)) 
                  : (sectionStr ? `${classStr}-${sectionStr}` : classStr);

                if (!foundStudent && studentNo > 0 && studentName) {
                  newStudentsToAdd.push({
                    id: generateId(),
                    no: studentNo,
                    name: studentName,
                    className: finalDisplayClass,
                    classStr: finalClassStr,
                    sectionStr: finalSectionStr
                  });
                }

                const subjectScores: Record<string, { correct: number; wrong: number; empty: number; net: number }> = {};
                let sumNets = 0;
                let sumCorrect = 0;
                let sumWrong = 0;

                for (const [subKey, mapping] of Object.entries(subjectsMap)) {
                  const dVal = mapping.dCol >= 0 ? parseFloat(String(row[mapping.dCol] || '').replace(',', '.')) : 0;
                  const yVal = mapping.yCol >= 0 ? parseFloat(String(row[mapping.yCol] || '').replace(',', '.')) : 0;
                  const nVal = mapping.nCol >= 0 ? parseFloat(String(row[mapping.nCol] || '').replace(',', '.')) : (dVal - (yVal / 3));

                  const cleanD = isNaN(dVal) ? 0 : Math.max(0, Math.round(dVal));
                  const cleanY = isNaN(yVal) ? 0 : Math.max(0, Math.round(yVal));
                  const cleanN = isNaN(nVal) ? 0 : parseFloat(nVal.toFixed(2));

                  let stdName = mapping.name;
                  const nl = mapping.name.toLowerCase();
                  if (nl.includes('türk')) stdName = 'Türkçe';
                  else if (nl.includes('tarih') || nl.includes('ink')) stdName = 'T.C. İnkılap Tarihi ve Atatürkçülük';
                  else if (nl.includes('din')) stdName = 'Din Kültürü ve Ahlak Bilgisi';
                  else if (nl.includes('ing') || nl.includes('yabancı')) stdName = 'İngilizce';
                  else if (nl.includes('mat')) stdName = 'Matematik';
                  else if (nl.includes('fen')) stdName = 'Fen Bilimleri';

                  const subScoreObj = {
                    correct: cleanD,
                    wrong: cleanY,
                    empty: 0,
                    net: cleanN
                  };

                  subjectScores[stdName] = subScoreObj;

                  const matchingExamSub = exam.subjects?.find(es => {
                    const esl = es.name.toLowerCase();
                    const nll = stdName.toLowerCase();
                    return esl === nll ||
                      (nll.includes('türk') && esl.includes('türk')) ||
                      (nll.includes('tarih') && (esl.includes('tarih') || esl.includes('ink'))) ||
                      (nll.includes('din') && esl.includes('din')) ||
                      (nll.includes('ing') && esl.includes('ing')) ||
                      (nll.includes('mat') && esl.includes('mat')) ||
                      (nll.includes('fen') && esl.includes('fen'));
                  });
                  if (matchingExamSub) {
                    subjectScores[String(matchingExamSub.id)] = subScoreObj;
                    subjectScores[matchingExamSub.name] = subScoreObj;
                  }

                  sumNets += cleanN;
                  sumCorrect += cleanD;
                  sumWrong += cleanY;
                }

                let totalD = totalDCol >= 0 ? parseInt(String(row[totalDCol] || '').replace(/[^\d]/g, ''), 10) : sumCorrect;
                if (isNaN(totalD)) totalD = sumCorrect;

                let totalY = totalYCol >= 0 ? parseInt(String(row[totalYCol] || '').replace(/[^\d]/g, ''), 10) : sumWrong;
                if (isNaN(totalY)) totalY = sumWrong;

                let parsedTotalNet = totalNetCol >= 0 ? parseFloat(String(row[totalNetCol] || '').replace(',', '.')) : sumNets;
                if (isNaN(parsedTotalNet) || parsedTotalNet === 0) parsedTotalNet = parseFloat(sumNets.toFixed(2));

                const rawScore = puanCol >= 0 ? parseFloat(String(row[puanCol] || '').replace(',', '.')) : 0;
                const lgsScore = !isNaN(rawScore) && rawScore > 0 ? rawScore : (isLgs ? (parsedTotalNet * 5) : 0);

                const ataLigResult = calculateAtaLigPoints(
                  lgsScore || parsedTotalNet,
                  parsedTotalNet,
                  subjectScores,
                  [],
                  ''
                );

                newResults.push({
                  id: generateId(),
                  studentNo: finalNo,
                  studentName: finalName,
                  studentClass: finalDisplayClass,
                  no: finalNo,
                  name: finalName,
                  classStr: finalClassStr,
                  sectionStr: finalSectionStr,
                  booklet: 'A',
                  scores: {
                    [String(exam.id)]: parsedTotalNet,
                    ...Object.fromEntries(Object.entries(subjectScores).map(([k, v]) => [k, v.net]))
                  },
                  average: parsedTotalNet,
                  net: parsedTotalNet,
                  totalCorrect: totalD,
                  totalWrong: totalY,
                  totalEmpty: Math.max(0, 90 - totalD - totalY),
                  lgsScore: isLgs ? lgsScore : undefined,
                  earnedLP: ataLigResult.earnedLP,
                  earnedBadges: ataLigResult.earnedBadges,
                  evaluatedScore: {
                    total: {
                      correct: totalD,
                      wrong: totalY,
                      empty: Math.max(0, 90 - totalD - totalY),
                      net: parsedTotalNet,
                      lgsScore: isLgs ? lgsScore : undefined,
                      percentile: undefined
                    },
                    subjectScores
                  }
                });
              }

              if (newResults.length > 0) {
                processedWithKurumNetListesi = true;
              }
            }
          }
        }

        // 2. EĞER Kurum Net Listesi değilse: Düz tek satırlı tablo formatını çözümle
        if (!processedWithKurumNetListesi && data && Array.isArray(data) && data.length > 0) {
          data.forEach((row: any) => {
            const normalizedRow: Record<string, any> = {};
            Object.keys(row).forEach(k => {
              normalizedRow[k.trim().toLowerCase()] = row[k];
            });

            const rawNo = normalizedRow["okul no"] || normalizedRow["no"] || normalizedRow["numara"] || normalizedRow["öğrenci no"] || normalizedRow["öğr.no"];
            const rawName = normalizedRow["adı soyadı"] || normalizedRow["ad soyad"] || normalizedRow["ad, soyad"] || normalizedRow["öğrenci adı"] || normalizedRow["isim"];
            if (!rawNo && !rawName) return;

            const studentNo = parseInt(String(rawNo).replace(/[^\d]/g, ''), 10) || 0;
            const studentName = String(rawName || '').trim().toUpperCase();
            const cls = String(normalizedRow["sınıf"] || normalizedRow["sinif"] || '').trim();
            const sec = String(normalizedRow["şube"] || normalizedRow["sube"] || '').trim().toUpperCase();

            const foundStudent = findDatabaseStudent(studentNo, studentName, cls, masterStudents);
            if (foundStudent) {
              matchedWithDbCount++;
            }

            const finalNo = foundStudent ? foundStudent.no : studentNo;
            const finalName = foundStudent ? foundStudent.name : studentName;
            const finalClassStr = foundStudent ? (foundStudent.classStr || formatClassSec(foundStudent.className).cls || cls) : cls;
            const finalSectionStr = foundStudent ? (foundStudent.sectionStr || formatClassSec(foundStudent.className).sec || sec) : sec;
            const finalClassName = foundStudent 
              ? (foundStudent.className || (finalSectionStr ? `${finalClassStr}-${finalSectionStr}` : finalClassStr)) 
              : (sec ? `${cls}-${sec}` : cls);

            if (!foundStudent && studentNo > 0 && studentName) {
              newStudentsToAdd.push({
                id: generateId(),
                no: studentNo,
                name: studentName,
                className: finalClassName,
                classStr: finalClassStr,
                sectionStr: finalSectionStr
              });
            }

            const subjectScores: Record<string, { correct: number; wrong: number; empty: number; net: number }> = {};
            let parsedTotalNet = 0;

            Object.keys(row).forEach(key => {
              const lKey = key.trim().toLowerCase();
              const val = parseFloat(String(row[key]).replace(',', '.'));
              if (!isNaN(val)) {
                if (lKey.includes("toplam net") || lKey === "net") {
                  parsedTotalNet = val;
                } else if (
                  lKey.includes("türk") || lKey.includes("turk") || 
                  lKey.includes("mat") || 
                  lKey.includes("fen") || 
                  lKey.includes("ink") || lKey.includes("tarih") || 
                  lKey.includes("din") || 
                  lKey.includes("ing") || lKey.includes("yabancı")
                ) {
                  let stdName = key.trim();
                  if (lKey.includes("türk")) stdName = "Türkçe";
                  else if (lKey.includes("tarih") || lKey.includes("ink")) stdName = "T.C. İnkılap Tarihi ve Atatürkçülük";
                  else if (lKey.includes("din")) stdName = "Din Kültürü ve Ahlak Bilgisi";
                  else if (lKey.includes("ing") || lKey.includes("yabancı")) stdName = "İngilizce";
                  else if (lKey.includes("mat")) stdName = "Matematik";
                  else if (lKey.includes("fen")) stdName = "Fen Bilimleri";

                  const subScoreObj = {
                    correct: Math.round(val),
                    wrong: 0,
                    empty: 0,
                    net: val
                  };

                  subjectScores[stdName] = subScoreObj;

                  const matchingExamSub = exam.subjects?.find(es => {
                    const esl = es.name.toLowerCase();
                    const nll = stdName.toLowerCase();
                    return esl === nll ||
                      (nll.includes('türk') && esl.includes('türk')) ||
                      (nll.includes('tarih') && (esl.includes('tarih') || esl.includes('ink'))) ||
                      (nll.includes('din') && esl.includes('din')) ||
                      (nll.includes('ing') && esl.includes('ing')) ||
                      (nll.includes('mat') && esl.includes('mat')) ||
                      (nll.includes('fen') && esl.includes('fen'));
                  });
                  if (matchingExamSub) {
                    subjectScores[String(matchingExamSub.id)] = subScoreObj;
                    subjectScores[matchingExamSub.name] = subScoreObj;
                  }
                }
              }
            });

            if (parsedTotalNet === 0 && Object.keys(subjectScores).length > 0) {
              parsedTotalNet = Object.values(subjectScores).reduce((acc, curr) => acc + curr.net, 0);
            }

            const rawScore = normalizedRow["puan"] || normalizedRow["lgs puanı"] || normalizedRow["lgs puani"] || normalizedRow["tyt puanı"];
            const lgsScore = parseFloat(String(rawScore).replace(',', '.')) || (isLgs ? (parsedTotalNet * 5) : 0);

            const ataLigResult = calculateAtaLigPoints(
              lgsScore || parsedTotalNet,
              parsedTotalNet,
              subjectScores,
              [],
              ''
            );
            const lp = ataLigResult.earnedLP;
            const badges = ataLigResult.earnedBadges;

            newResults.push({
              id: generateId(),
              studentNo: finalNo,
              studentName: finalName,
              studentClass: finalClassName,
              no: finalNo,
              name: finalName,
              classStr: finalClassStr,
              sectionStr: finalSectionStr,
              booklet: 'A',
              scores: {
                [String(exam.id)]: parsedTotalNet,
                ...Object.fromEntries(Object.entries(subjectScores).map(([k, v]) => [k, v.net]))
              },
              average: parsedTotalNet,
              net: parsedTotalNet,
              totalCorrect: Math.round(parsedTotalNet),
              totalWrong: 0,
              totalEmpty: 0,
              lgsScore: isLgs ? lgsScore : undefined,
              earnedLP: lp,
              earnedBadges: badges,
              evaluatedScore: {
                total: {
                  correct: Math.round(parsedTotalNet),
                  wrong: 0,
                  empty: 0,
                  net: parsedTotalNet,
                  lgsScore: isLgs ? lgsScore : undefined,
                  percentile: undefined
                },
                subjectScores
              }
            });
          });
        }

        if (newResults.length === 0) {
          showAlert("Excel dosyasında öğrenci net verisi okunamadı. Lütfen şablonu inceleyiniz.");
          return;
        }

        const existingResultsMap = new Map(currentExamResults.map(r => [String(r.no || r.studentNo).trim(), r]));
        newResults.forEach(nr => {
          existingResultsMap.set(String(nr.no || nr.studentNo).trim(), nr);
        });
        const updatedList = Array.from(existingResultsMap.values());

        saveOmrExamResults(String(exam.id), updatedList);

        if (newStudentsToAdd.length > 0) {
          setStudents([...masterStudents, ...newStudentsToAdd]);
        }

        const matchMsg = matchedWithDbCount > 0 ? ` (${matchedWithDbCount} öğrenci okul kütüğüyle eşleştirildi)` : '';
        showAlert(`✓ ${newResults.length} öğrencinin sınav sonuçları ve ders netleri başarıyla aktarıldı${matchMsg}.`);
      });
    } catch (err: any) {
      console.error(err);
      showAlert("Excel dosyası okunurken hata oluştu: " + (err.message || "Bilinmeyen hata"));
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  // Student Roster Functions
  const handleSaveStudentRecord = () => {
    if (!no.trim() || !name.trim()) {
      return showAlert("Öğrenci Numarası ve Adı Soyadı alanları zorunludur.");
    }

    const { cls, sec } = formatClassSec(classStr, sectionStr);
    const parsedNo = parseInt(no.trim(), 10) || 0;
    const newList = [...masterStudents];
    const existingIdx = editingStudentId 
      ? newList.findIndex(s => s.id === editingStudentId)
      : (editingStudentNo ? newList.findIndex(s => String(s.no).trim() === editingStudentNo.trim()) : -1);

    if (existingIdx >= 0) {
      newList[existingIdx] = {
        ...newList[existingIdx],
        no: parsedNo,
        name: name.trim().toUpperCase(),
        className: cls,
        classStr: cls,
        sectionStr: sec
      };
      showAlert(`${name.trim().toUpperCase()} isimli öğrencinin bilgileri güncellendi.`);
    } else {
      newList.push({
        id: generateId(),
        no: parsedNo,
        name: name.trim().toUpperCase(),
        className: cls,
        classStr: cls,
        sectionStr: sec,
        examRegistrations: []
      });
      showAlert(`${name.trim().toUpperCase()} kütüğe eklendi.`);
    }

    setStudents(newList);
    setNo(""); setName(""); setClassStr(""); setSectionStr(""); 
    setEditingStudentNo(null); setEditingStudentId(null);
    setActiveMobileStudentView('list');
  };

  const handleDeleteStudentRecord = (studentId: string | undefined, studentNo: string | number, studentName: string) => {
    if (!safeConfirm(`${studentName} (${studentNo}) öğrenci kütüğünden silinsin mi?`)) return;
    setStudents(masterStudents.filter(s => studentId ? s.id !== studentId : String(s.no).trim() !== String(studentNo).trim()));
    showAlert(`${studentName} silindi.`);
  };

  const handleBulkStudentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      importFromExcel(file, (data) => {
        if (!data || !Array.isArray(data) || data.length === 0) {
          return showAlert("Excel dosyasından öğrenci verisi okunamadı.");
        }
        const list: Student[] = [];
        data.forEach((row: any) => {
          const normalized: Record<string, any> = {};
          Object.keys(row).forEach(k => { normalized[k.trim().toLowerCase()] = row[k]; });
          const rawNo = normalized["okul no"] || normalized["no"] || normalized["numara"] || normalized["öğrenci no"];
          const rawName = normalized["adı soyadı"] || normalized["ad soyad"] || normalized["öğrenci adı"] || normalized["isim"];
          if (rawNo && rawName) {
            const { cls, sec } = formatClassSec(uploadCls || normalized["sınıf"] || normalized["sinif"], uploadSec || normalized["şube"] || normalized["sube"]);
            list.push({
              id: generateId(),
              no: parseInt(String(rawNo).replace(/[^\d]/g, ''), 10) || 0,
              name: String(rawName).trim().toUpperCase(),
              className: cls,
              classStr: cls,
              sectionStr: sec
            });
          }
        });

        if (list.length > 0) {
          const currentList = [...masterStudents];
          list.forEach(item => {
            const idx = currentList.findIndex(s => String(s.no).trim() === String(item.no).trim());
            if (idx >= 0) {
              currentList[idx] = { ...currentList[idx], ...item };
            } else {
              currentList.push(item);
            }
          });
          setStudents(currentList);
          showAlert(`${list.length} öğrenci Excel'den kütüğe aktarıldı.`);
        } else {
          showAlert("Excel dosyasında 'Okul No' ve 'Adı Soyadı' sütunları bulunamadı.");
        }
      });
      if (e.target) e.target.value = "";
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      let text = "";
      try {
        const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
        text = utf8Decoder.decode(arrayBuffer);
      } catch {
        const winDecoder = new TextDecoder("windows-1254");
        text = winDecoder.decode(arrayBuffer);
      }

      const lines = text.split(/\r?\n/);
      const list: Student[] = [];

      lines.forEach((line) => {
        if (!line.trim()) return;
        const parts = line.split(/[,;\t|]/).map(p => p.replace(/^"|"$/g, '').trim());
        const rawNo = parts[0]?.replace(/[^\d]/g, '') || parts[1]?.replace(/[^\d]/g, '');
        const rawName = parts[1] && isNaN(Number(parts[1])) ? parts[1] : parts[0];
        if (rawNo && rawName) {
          const { cls, sec } = formatClassSec(uploadCls || parts[2], uploadSec || parts[3]);
          list.push({
            id: generateId(),
            no: parseInt(rawNo, 10) || 0,
            name: rawName.toUpperCase(),
            className: cls,
            classStr: cls,
            sectionStr: sec
          });
        }
      });

      if (list.length > 0) {
        const currentList = [...masterStudents];
        list.forEach(item => {
          const idx = currentList.findIndex(s => String(s.no).trim() === String(item.no).trim());
          if (idx >= 0) {
            currentList[idx] = { ...currentList[idx], ...item };
          } else {
            currentList.push(item);
          }
        });
        setStudents(currentList);
        showAlert(`${list.length} öğrenci başarıyla işlendi ve kütüğe aktarıldı.`);
      } else {
        showAlert("Dosyadan öğrenci kaydı çözümlenemedi. Lütfen geçerli bir liste yükleyin.");
      }
    } catch (err) {
      showAlert("Dosya okunurken bir hata oluştu.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="bg-slate-50 min-h-full flex flex-col gap-3 pb-8 no-print p-3 sm:p-6">
      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed top-4 right-4 z-[300] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold border border-slate-700 animate-in slide-in-from-top-2">
          {toastAlert}
        </div>
      )}

      {/* Modals */}
      {isBatchPdfModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Toplu Öğrenci Karnesi (PDF)</h3>
                  <p className="text-xs text-slate-500 font-medium">Renkli, aranabilir ve Türkçe karakter destekli PDF karne oluşturun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGeneratingBatchPdf && setIsBatchPdfModalOpen(false)}
                disabled={isGeneratingBatchPdf}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-xs">
              {/* Sınav Bilgi Kartı */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Sınav Adı</div>
                  <div className="font-bold text-slate-800 text-xs sm:text-sm">{exam.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Toplam Katılımcı</div>
                  <div className="font-bold text-indigo-600 font-mono text-xs sm:text-sm">{evaluatedResults.length} Öğrenci</div>
                </div>
              </div>

              {/* Kapsam Seçimi */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">Karne Çıkarılacak Öğrenciler</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchPdfScope('all')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      batchPdfScope === 'all'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Tüm Katılımcılar</span>
                      {batchPdfScope === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sınava giren {evaluatedResults.length} öğrencinin tamamı</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchPdfScope('class')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      batchPdfScope === 'class'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>Sınıf / Şube Bazlı</span>
                      {batchPdfScope === 'class' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">Yalnızca seçilen sınıfın karneleri</p>
                  </button>
                </div>

                {batchPdfScope === 'class' && (
                  <div className="pt-2 animate-in fade-in">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Sınıf Seçiniz:</label>
                    <select
                      value={batchPdfSelectedClass}
                      onChange={(e) => setBatchPdfSelectedClass(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="ALL">Tüm Sınıflar (Ayrı ayrı sıralı)</option>
                      {availableClasses.map(cls => (
                        <option key={cls} value={cls}>
                          {cls} ({classCounts[cls] || 0} Öğrenci)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Karne Ayarları ve Opsiyonlar */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">Karne Biçimlendirme & Düzen</label>

                {/* Kurum / Okul Başlığı */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Kurum / Okul Başlığı</label>
                  <input
                    type="text"
                    value={batchPdfSchoolName}
                    onChange={(e) => setBatchPdfSchoolName(e.target.value)}
                    placeholder="T.C. MİLLİ EĞİTİM BAKANLIĞI / OKUL ADI"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Sayfa Düzeni */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchPdfCardsPerPage(1)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      batchPdfCardsPerPage === 1
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">Sayfa Başına 1 Karne</div>
                    <div className="text-[10px] text-slate-400 font-normal">Tam Sayfa A4 (Geniş & Okunaklı)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchPdfCardsPerPage(2)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      batchPdfCardsPerPage === 2
                        ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">Sayfa Başına 2 Karne</div>
                    <div className="text-[10px] text-slate-400 font-normal">Yarı Sayfa (Kağıt Tasarrufu)</div>
                  </button>
                </div>

                {/* Soru Matrisi Toggle */}
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={batchPdfIncludeMatrix}
                    onChange={(e) => setBatchPdfIncludeMatrix(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Kazanım & Soru Cevap Tablosunu Dahil Et</span>
                    <span className="text-[10px] text-slate-500 block">Doğru cevaplar, öğrenci işaretleri ve D/Y/B detay matrisi</span>
                  </div>
                </label>
              </div>

              {/* Canlı İlerleme Çubuğu */}
              {isGeneratingBatchPdf && (
                <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      {batchPdfProgress.statusText || 'PDF Karneler Hazırlanıyor...'}
                    </span>
                    <span className="font-mono">
                      {batchPdfProgress.current} / {batchPdfProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                      style={{
                        width: `${batchPdfProgress.total > 0 ? (batchPdfProgress.current / batchPdfProgress.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsBatchPdfModalOpen(false)}
                disabled={isGeneratingBatchPdf}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDownloadBatchPdf}
                disabled={isGeneratingBatchPdf || evaluatedResults.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingBatchPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Oluşturuluyor...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>PDF Karneleri İndir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <StudentReportModal
          student={selectedStudent}
          exam={exam}
          onClose={() => setSelectedStudent(null)}
          onUpdateStudent={handleSaveResultEdit}
        />
      )}
      {editingStudent && (
        <EditResultModal
          student={editingStudent}
          exam={exam}
          onClose={() => setEditingStudent(null)}
          onSave={handleSaveResultEdit}
        />
      )}

      {/* Tek Öğrenci Sonucunu Silme Onay Modalı */}
      {studentToDelete && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Öğrenci Sonucunu Sil</h3>
                <p className="text-xs text-slate-500">Bu işlem bu sınava ait sonucu sistemden kaldırır.</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl mb-5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Öğrenci Adı:</span>
                <span className="font-bold text-slate-900">{studentToDelete.name || 'İsimsiz'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Numara:</span>
                <span className="font-bold font-mono text-rose-700">{studentToDelete.no || studentToDelete.studentNo || '-'}</span>
              </div>
              {(studentToDelete.classStr || studentToDelete.sectionStr) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Sınıf/Şube:</span>
                  <span className="font-semibold text-slate-700">{studentToDelete.classStr || '-'}/{studentToDelete.sectionStr || '-'}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Sınav:</span>
                <span className="font-semibold text-slate-700 truncate max-w-[200px]">{exam.name}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              <strong>{studentToDelete.name}</strong> adlı öğrencinin bu sınava ait okunan optik formu ve puanı kalıcı olarak silinecektir. Bu işlem geri alınamaz. Onaylıyor musunuz?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmDeleteResult}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Siliniyor...' : 'Evet, Sonucu Sil'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tüm Sınav Sonuçlarını Silme Onay Modalı */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tüm Sınav Sonuçlarını Sil</h3>
                <p className="text-xs text-rose-600 font-semibold">DİKKAT: Bu işlem geri alınamaz!</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              <strong>{exam.name}</strong> sınavına ait toplam <strong>{currentExamResults.length}</strong> öğrencinin sonuç verileri, karneleri ve optik kayıtları tamamen silinecektir. Devam etmek istediğinize emin misiniz?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllResults}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Siliniyor...' : 'Tüm Sonuçları Kalıcı Sil'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ÜST KONTROL VE GEÇİŞ ÇUBUĞU (Mobil Açılır / Masaüstü Segmented Tabs)
          ===================================================================== */}
      <div className="bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-2 sm:p-3.5 border border-slate-200/90 shadow-sm flex flex-col gap-2 transition-all">
        {/* MOBİL: Optimize Edilmiş Kompakt Kontrol & Sınav Seçici (sm:hidden) */}
        <div className="flex sm:hidden flex-col gap-1.5">
          {/* Üst Satır: Sınav Seçici Dropdown (Tam genişlikte, sınav adı ve tarihi rahatça okunur) */}
          <div className="relative w-full">
            {state.exams.length > 1 ? (
              <div className="relative">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-indigo-50/70 hover:bg-indigo-100/70 focus:bg-white border border-indigo-200 text-indigo-950 font-bold text-xs rounded-xl pl-8 pr-7 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none truncate shadow-2xs transition-colors"
                  aria-label="Sınavı Değiştir"
                >
                  {state.exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.examType === 'internal' ? '🎯 ' : '📚 '}{e.name}{e.date ? ` (${e.date})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-2 truncate shadow-2xs">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{exam.name}{exam.date ? ` (${exam.date})` : ''}</span>
              </div>
            )}
          </div>

          {/* Alt Satır: Mobil Sekme Seçici (Sıralama vs Analiz) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-1 w-full">
            <button
              type="button"
              onClick={() => setActiveMainTab('results')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMainTab === 'results'
                  ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Sıralama ({evaluatedResults.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (exam.examType === 'internal') {
                  setActiveMainTab('analysis');
                }
              }}
              disabled={exam.examType !== 'internal'}
              title={exam.examType === 'internal' ? 'Soru ve madde analizini görüntüle' : 'Soru ve madde analizi yalnızca Kurum İçi Optik denemelerde aktiftir'}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                exam.examType === 'internal'
                  ? activeMainTab === 'analysis'
                    ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/60 cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                  : 'text-slate-400 bg-slate-200/40 cursor-not-allowed opacity-60'
              }`}
            >
              <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${exam.examType === 'internal' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Soru Analizi</span>
              {exam.examType !== 'internal' && (
                <span className="text-[9px] font-bold text-slate-400 bg-slate-200/70 px-1 py-0.2 rounded border border-slate-300/50">
                  Optik
                </span>
              )}
            </button>
          </div>
        </div>

        {/* MASAÜSTÜ / TABLET GÖRÜNÜMÜ (hidden sm:flex) */}
        <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Genişletilmiş Segmented Tab Switcher */}
          <div className="flex-1 flex items-center bg-slate-100/90 p-1.5 rounded-xl border border-slate-200/80 gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveMainTab('results')}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeMainTab === 'results'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                activeMainTab === 'results' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200/50 text-slate-500'
              }`}>
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <span>Sınav Sıralaması & Karneler</span>
              <span className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full font-bold transition-colors ${
                activeMainTab === 'results' 
                  ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200' 
                  : 'bg-slate-200/70 text-slate-600'
              }`}>
                {evaluatedResults.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (exam.examType === 'internal') {
                  setActiveMainTab('analysis');
                }
              }}
              disabled={exam.examType !== 'internal'}
              title={exam.examType === 'internal' ? 'Soru ve madde analizini görüntüle' : 'Soru ve madde analizi yalnızca Kurum İçi Optik denemelerde aktiftir'}
              className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                exam.examType === 'internal'
                  ? activeMainTab === 'analysis'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 scale-[1.01] cursor-pointer'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer'
                  : 'text-slate-400 bg-slate-200/30 cursor-not-allowed opacity-60'
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                exam.examType === 'internal'
                  ? activeMainTab === 'analysis' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200/50 text-slate-500'
                  : 'bg-slate-200/40 text-slate-400'
              }`}>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span>Soru & Madde Analizi</span>
              {exam.examType === 'internal' ? (
                <span className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-full font-bold transition-colors ${
                  activeMainTab === 'analysis' 
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' 
                    : 'bg-slate-200/70 text-slate-600'
                }`}>
                  {exam.subjects?.reduce((acc, s) => acc + (s.count || 0), 0) || 90} Soru
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full border border-slate-300/40">
                  Yalnızca Kurum İçi
                </span>
              )}
            </button>
          </div>

          {/* Aktif Sınav Seçici Dropdown (Her sınavın yanında tarihi gösterilir) */}
          <div className="relative shrink-0 min-w-[240px] max-w-sm">
            {state.exams.length > 1 ? (
              <div className="relative">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/90 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl pl-8.5 pr-8 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all truncate shadow-2xs appearance-none"
                  aria-label="Sınav Seçiniz"
                >
                  {state.exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.examType === 'internal' ? '🎯 ' : `📚 [${e.publisher || 'Yayın'}] `}{e.name}{e.date ? ` (${e.date})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-800 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 truncate flex items-center gap-2 shadow-2xs">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">{exam.name}{exam.date ? ` (${exam.date})` : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: SINAV SONUÇLARI & SIRALAMA
          ===================================================================== */}
      {activeMainTab === 'results' && (
        <div className="flex flex-col gap-3">
          {/* Executive Header Card */}
          <div className="bg-white rounded-2xl p-2.5 sm:p-5 shadow-2xs border border-slate-200/80">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3.5 pb-2.5 sm:pb-4 border-b border-slate-100">
              {/* Sınav Bilgisi & İkon */}
              <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <h3 className="text-xs sm:text-lg font-bold text-slate-900 tracking-tight truncate max-w-full">
                      {exam.name}
                    </h3>
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                      {exam.examType === 'internal' ? (
                        <span className="text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-2xs shrink-0">
                          <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" /> Kurum İçi Optik
                        </span>
                      ) : (
                        <span className="text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/80 flex items-center gap-1 shadow-2xs shrink-0">
                          <FileSpreadsheet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-600" /> Yayıncı Denemesi
                        </span>
                      )}
                      <span className="text-[9px] sm:text-[11px] font-mono tabular-nums font-bold px-1.5 sm:px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs shrink-0">
                        {evaluatedResults.length} Öğrenci
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">
                    {exam.examType === 'internal' 
                      ? 'Optik kamera tarama & kütük eşleştirmeli anlık sonuç değerlendirmesi' 
                      : 'Yayıncı veri aktarımı ve öğrenci gelişim takip karnesi'}
                  </p>
                </div>
              </div>

              {/* MASAÜSTÜ: Action Buttons Toolbar */}
              <div className="hidden md:flex items-center gap-2 flex-wrap">
                {exam.examType === 'internal' && userRole === 'admin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => (window as any).__navigateToTab?.('scan')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Canlı Optik Tara</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => (window as any).__navigateToTab?.('omr-setup')}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Form Bas (PDF)</span>
                    </button>
                  </>
                )}

                {exam.examType !== 'internal' && userRole === 'admin' && (
                  <>
                    <input
                      ref={publisherFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.xml"
                      className="hidden"
                      onChange={handlePublisherExcelUpload}
                    />
                    <button
                      type="button"
                      onClick={() => publisherFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Excel Yükle</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPublisherTemplate}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      title="Örnek Kurum Net Listesi Excel Şablonu İndir"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Örnek Şablon</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleExportResultsExcel}
                  disabled={evaluatedResults.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-50"
                  title="Sonuçları Excel dosyası olarak indir"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel İndir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBatchPdfModalOpen(true)}
                  disabled={evaluatedResults.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Öğrenci karnelerini renkli ve aranabilir Türkçe destekli toplu PDF olarak indir"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Toplu Karne (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintResults}
                  disabled={evaluatedResults.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>A4 Yazdır</span>
                </button>

                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={handleDeleteAllResults}
                    disabled={currentExamResults.length === 0}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                    title="Sınav sonuçlarını sıfırla / temizle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Temizle</span>
                  </button>
                )}
              </div>

              {/* MOBİL: Optimize Edilmiş Tek Satır Hızlı İşlem Çubuğu (md:hidden) */}
              <div className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
                <button
                  type="button"
                  onClick={() => setIsBatchPdfModalOpen(true)}
                  disabled={evaluatedResults.length === 0}
                  className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-2xs active:scale-95 transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Toplu Karne (PDF)</span>
                </button>

                {userRole === 'admin' && (
                  exam.examType === 'internal' ? (
                    <button
                      type="button"
                      onClick={() => (window as any).__navigateToTab?.('scan')}
                      className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xs active:scale-95 transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-white shrink-0" />
                      <span>Optik Tara</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => publisherFileInputRef.current?.click()}
                        className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-2xs active:scale-95 transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-white shrink-0" />
                        <span>Excel Yükle</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPublisherTemplate}
                        className="h-8 px-2 text-[11px] font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Örnek Kurum Net Listesi Excel Şablonu İndir"
                      >
                        <Download className="w-3 h-3 text-slate-600 shrink-0" />
                        <span>Şablon</span>
                      </button>
                    </>
                  )
                )}

                <button
                  type="button"
                  onClick={handleExportResultsExcel}
                  disabled={evaluatedResults.length === 0}
                  className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100 text-slate-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintResults}
                  disabled={evaluatedResults.length === 0}
                  className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100 text-slate-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3 h-3 text-slate-600 shrink-0" />
                  <span>A4 Liste</span>
                </button>

                {exam.examType === 'internal' && userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => (window as any).__navigateToTab?.('omr-setup')}
                    className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100 text-slate-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span>Form Bas</span>
                  </button>
                )}

                {exam.examType !== 'internal' && userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={handleDownloadPublisherTemplate}
                    className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-slate-200/90 bg-slate-50/90 hover:bg-slate-100 text-slate-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span>Şablon</span>
                  </button>
                )}

                {userRole === 'admin' && currentExamResults.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllResults}
                    className="h-8 px-2.5 text-[11px] font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 active:scale-95 shadow-2xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>Temizle</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Metric Strip - Kompakt Mobil & Responsive Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2.5 pt-2 sm:pt-3.5">
              {/* Katılım Oranı */}
              <div className="bg-slate-50/90 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Katılım Oranı</span>
                <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                  <span className="text-xs sm:text-lg font-black font-mono tabular-nums text-slate-800">
                    {summaryStats.totalScanned}
                  </span>
                  <span className="text-[9px] sm:text-xs text-slate-500 font-mono">/ {summaryStats.totalMaster}</span>
                  <span className="text-[9px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-1 py-0.2 rounded-md font-mono ml-auto">
                    %{summaryStats.participationRate}
                  </span>
                </div>
              </div>

              {/* Net Ortalaması */}
              <div className="bg-blue-50/60 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-blue-200/70 flex flex-col justify-between shadow-2xs">
                <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-700 truncate">Net Ortalaması</span>
                <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                  <span className="text-xs sm:text-lg font-black font-mono tabular-nums text-blue-900">
                    {summaryStats.avgNet}
                  </span>
                  <span className="text-[9px] sm:text-[11px] text-blue-600 font-bold">Net</span>
                </div>
              </div>

              {/* Zirve Net */}
              <div className="bg-emerald-50/60 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-emerald-200/70 flex flex-col justify-between shadow-2xs">
                <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 truncate">Zirve Net</span>
                <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                  <span className="text-xs sm:text-lg font-black font-mono tabular-nums text-emerald-900">
                    {summaryStats.maxNet}
                  </span>
                  <span className="text-[9px] sm:text-[11px] text-emerald-600 font-bold">Net</span>
                </div>
              </div>

              {/* Doğru / Yanlış */}
              <div className="bg-amber-50/60 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-amber-200/70 flex flex-col justify-between shadow-2xs">
                <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-700 truncate">D / Y Ortalaması</span>
                <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                  <span className="text-[11px] sm:text-base font-black font-mono tabular-nums text-emerald-700">
                    {summaryStats.avgCorrect} D
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-[11px] sm:text-base font-black font-mono tabular-nums text-rose-600">
                    {summaryStats.avgWrong} Y
                  </span>
                </div>
              </div>

              {/* LGS Puan / En Düşük Net */}
              <div className="bg-purple-50/60 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-purple-200/70 col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-between shadow-2xs">
                <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-700 truncate">
                  {isLgs ? 'LGS Puan Ortalaması' : 'En Düşük Net'}
                </span>
                <div className="flex items-baseline justify-between sm:justify-start gap-1 mt-0.5 sm:mt-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs sm:text-lg font-black font-mono tabular-nums text-purple-900">
                      {isLgs ? summaryStats.avgLgs : summaryStats.minNet}
                    </span>
                    <span className="text-[9px] sm:text-[11px] text-purple-600 font-bold">
                      {isLgs ? 'Puan' : 'Net'}
                    </span>
                  </div>
                  {isLgs && (
                    <span className="sm:hidden text-[9px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded border border-purple-200/60">
                      500 Üzerinden
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter & View Controls */}
          <div className="bg-white rounded-2xl p-2.5 sm:p-3.5 shadow-2xs border border-slate-200/80 flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center justify-between transition-all">
            {/* Arama Çubuğu */}
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Öğrenci adı veya no ile ara..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50/90 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-full hover:bg-slate-100"
                  aria-label="Aramayı Temizle"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtre ve Görünüm Kontrolleri (Mobilde 2 Eşit Sütun, Masaüstünde Yan Yana) */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              {/* Sınıf Filtresi */}
              {availableClasses.length > 0 && (
                <div className="relative w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl pl-2.5 pr-7 py-2 text-xs font-bold text-slate-800 transition-colors shadow-2xs cursor-pointer">
                    <Filter className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <select
                      value={selectedClassFilter}
                      onChange={e => setSelectedClassFilter(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs w-full appearance-none truncate"
                      aria-label="Sınıf Filtresi"
                    >
                      <option value="ALL">Tüm Sınıflar ({currentExamResults.length}{masterStudents.length > 0 ? ` / ${masterStudents.length} Kütük` : ''})</option>
                      {availableClasses.map(cls => {
                        const examCount = classCounts[cls] || 0;
                        const dbCount = classDbCounts[cls] || 0;
                        return (
                          <option key={cls} value={cls}>
                            {cls} ({examCount}{dbCount > 0 ? ` / ${dbCount} Öğrenci` : ''})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Ders Detay Sütunları Aç/Kapa Toggle */}
              {exam.subjects && exam.subjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSubjectColumns(prev => !prev)}
                  className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                    showSubjectColumns
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Tabloda ders bazlı Doğru/Yanlış/Net sütunlarını göster veya gizle"
                >
                  <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${showSubjectColumns ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="truncate">{showSubjectColumns ? 'Dersleri Daralt' : 'Ders Netleri'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Table Grid */}
          {evaluatedResultsWithRank.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-2xs">
                <BarChart3 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700">Henüz kayıtlı sınav sonucu bulunmuyor.</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Canlı Tarama sekmesinden kamera ile optik formları taratabilir veya Excel yükleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto max-h-[680px] custom-scrollbar">
                <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                  <thead className="bg-slate-900 text-white sticky top-0 z-10 text-[11px] font-semibold select-none">
                    <tr>
                      <th 
                        onClick={() => handleSort('rank')}
                        className="p-3 text-center w-14 cursor-pointer hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Sıra</span>
                          {sortColumn === 'rank' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-500" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('no')}
                        className="p-3 cursor-pointer hover:bg-slate-800 transition-colors w-20"
                      >
                        <div className="flex items-center gap-1">
                          <span>No</span>
                          {sortColumn === 'no' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-500" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('name')}
                        className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Öğrenci Adı Soyadı</span>
                          {sortColumn === 'name' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-500" />}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('class')}
                        className="p-3 text-center cursor-pointer hover:bg-slate-800 transition-colors w-24"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Sınıf</span>
                          {sortColumn === 'class' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-500" />}
                        </div>
                      </th>
                      <th className="p-3 text-center w-14 text-slate-400">Kit.</th>

                      {/* Ders Detay Sütunları (Opsiyonel) */}
                      {showSubjectColumns && exam.subjects && exam.subjects.map(sub => (
                        <th key={sub.id} className="p-3 text-center border-l border-slate-800 font-normal">
                          <div className="text-[10px] text-indigo-300 font-bold">{sub.name}</div>
                          <div className="text-[9px] text-slate-400 font-mono">D / Y / Net</div>
                        </th>
                      ))}

                      <th 
                        onClick={() => handleSort('correct')}
                        className="p-3 text-center text-emerald-400 cursor-pointer hover:bg-slate-800 transition-colors w-14"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>D</span>
                          {sortColumn === 'correct' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : null}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('wrong')}
                        className="p-3 text-center text-rose-400 cursor-pointer hover:bg-slate-800 transition-colors w-14"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Y</span>
                          {sortColumn === 'wrong' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : null}
                        </div>
                      </th>
                      <th className="p-3 text-center text-slate-400 w-14">B</th>
                      <th 
                        onClick={() => handleSort('net')}
                        className="p-3 text-center text-amber-300 font-black cursor-pointer hover:bg-slate-800 transition-colors w-24 bg-slate-800/80"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>TOPLAM NET</span>
                          {sortColumn === 'net' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-300" /> : <ArrowDown className="w-3 h-3 text-amber-300" />
                          ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-500" />}
                        </div>
                      </th>
                      {isLgs && (
                        <th 
                          onClick={() => handleSort('lgsScore')}
                          className="p-3 text-center text-fuchsia-300 font-black cursor-pointer hover:bg-slate-800 transition-colors w-24"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>LGS PUANI</span>
                            {sortColumn === 'lgsScore' ? (
                              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-fuchsia-300" /> : <ArrowDown className="w-3 h-3 text-fuchsia-300" />
                            ) : null}
                          </div>
                        </th>
                      )}
                      <th className="p-3 text-center w-24">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {evaluatedResultsWithRank.map((student, idx) => {
                      const isTop1 = student.naturalRank === 1;
                      const isTop2 = student.naturalRank === 2;
                      const isTop3 = student.naturalRank === 3;

                      return (
                        <tr 
                          key={student.id ? `eval-${student.id}-${idx}` : `eval-${student.no || student.studentNo}-${idx}`} 
                          className="hover:bg-indigo-50/30 transition-colors group"
                        >
                          <td className="p-3 text-center font-bold font-mono tabular-nums text-slate-500">
                            {isTop1 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs shadow-2xs border border-amber-300">
                                🥇
                              </span>
                            ) : isTop2 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs shadow-2xs border border-slate-300">
                                🥈
                              </span>
                            ) : isTop3 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-900 font-black text-xs shadow-2xs border border-amber-600/30">
                                🥉
                              </span>
                            ) : (
                              student.naturalRank
                            )}
                          </td>
                          <td className="p-3 font-bold font-mono tabular-nums text-slate-700">
                            {student.no || student.studentNo || "-"}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => setSelectedStudent(student)}
                              className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-left cursor-pointer hover:underline flex items-center gap-1.5"
                            >
                              <span>{student.name || student.studentName || "İsimsiz"}</span>
                              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                            </button>
                          </td>
                          <td className="p-3 text-center text-slate-700 font-bold font-mono tabular-nums">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] text-slate-800">
                              {formatDisplayClass(student)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold font-mono text-slate-500">
                            {student.booklet || 'A'}
                          </td>

                          {/* Subject Breakdown Columns */}
                          {showSubjectColumns && exam.subjects && exam.subjects.map(sub => {
                            const ss = student.evaluatedScore?.subjectScores?.[sub.id] || 
                                       student.evaluatedScore?.subjectScores?.[String(sub.id)] ||
                                       student.evaluatedScore?.subjectScores?.[sub.name] || 
                                       { correct: 0, wrong: 0, net: 0 };
                            return (
                              <td key={sub.id} className="p-3 text-center border-l border-slate-100 font-mono tabular-nums">
                                <span className="text-emerald-700 font-semibold">{ss.correct}</span>
                                <span className="text-slate-300 mx-0.5">/</span>
                                <span className="text-rose-600">{ss.wrong}</span>
                                <span className="text-slate-300 mx-0.5">/</span>
                                <span className="text-blue-700 font-black">{ss.net.toFixed(2).replace('.', ',')}</span>
                              </td>
                            );
                          })}

                          <td className="p-3 text-center text-emerald-700 font-bold font-mono tabular-nums">
                            {student.evaluatedScore.total.correct}
                          </td>
                          <td className="p-3 text-center text-rose-600 font-bold font-mono tabular-nums">
                            {student.evaluatedScore.total.wrong}
                          </td>
                          <td className="p-3 text-center text-slate-400 font-mono tabular-nums">
                            {student.evaluatedScore.total.empty}
                          </td>
                          <td className="p-3 text-center text-slate-900 font-black font-mono tabular-nums text-sm bg-slate-50/80 border-x border-slate-100">
                            {student.evaluatedScore.total.net.toFixed(2).replace('.', ',')}
                          </td>
                          {isLgs && (
                            <td className="p-3 text-center text-fuchsia-800 font-black font-mono tabular-nums bg-fuchsia-50/30">
                              {(student.evaluatedScore.total.lgsScore ?? 0).toFixed(2).replace('.', ',')}
                            </td>
                          )}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(student)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Öğrenci Karnesi & Detay"
                              >
                                <BookOpen className="w-4 h-4" />
                              </button>
                              {userRole === 'admin' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStudent(student)}
                                    className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Öğrenci Bilgisini Düzenle"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteResult(student)}
                                    className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                    title="Sınav Sonucunu Sil"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: SORU & MADDE ANALİZİ
          ===================================================================== */}

      {activeMainTab === 'analysis' && (
        <AnalysisView examId={String(exam.id)} embedded={true} />
      )}
    </div>
  );
}

export default ResultsView;
