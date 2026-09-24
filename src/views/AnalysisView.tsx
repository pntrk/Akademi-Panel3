import React, { useState, useMemo } from 'react';
import { Exam } from '../types';
import { calculateScore } from '../lib/omrEngine';
import { useAppContext } from '../context/AppContext';
import { 
  BarChart3, 
  Printer, 
  Search, 
  X, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  TrendingUp, 
  Flame, 
  Award, 
  Filter,
  Calendar
} from 'lucide-react';

interface QuestionStat {
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  options: { [opt: string]: number };
  students: {
    correct: { name: string; no: string; ans: string; trueAns: string; booklet: string }[];
    wrong: { name: string; no: string; ans: string; trueAns: string; booklet: string }[];
    empty: { name: string; no: string; ans: string; trueAns: string; booklet: string }[];
  };
  p: number;
  r: number;
}

export interface AnalysisViewProps {
  examId?: string;
  embedded?: boolean;
}

export function AnalysisView({ examId, embedded = false }: AnalysisViewProps = {}) {
  const { state } = useAppContext();

  // Selected exam ID
  const [selectedExamId, setSelectedExamId] = useState<string>(
    examId || (state.exams.length > 0 ? String(state.exams[0].id) : "")
  );

  React.useEffect(() => {
    if (examId) {
      setSelectedExamId(examId);
    }
  }, [examId]);

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

  const totalQ = (exam.subjects && exam.subjects.length > 0)
    ? exam.subjects.reduce((sum, s) => sum + s.count, 0)
    : 90;

  const [selectedQuestion, setSelectedQuestion] = useState<{
    subName: string;
    qNum: number;
    stat: QuestionStat;
  } | null>(null);

  // Active subject filter (default 'ALL' or subject ID)
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string | number>("ALL");

  // Filter questions by difficulty or discrimination
  const [statusFilter, setStatusFilter] = useState<'all' | 'hard' | 'discriminative' | 'problematic'>('all');

  // Search input for question number or student in detail
  const [searchQuery, setSearchQuery] = useState("");

  // Modal student search and tab filter inside question modal
  const [modalFilter, setModalFilter] = useState<'all' | 'correct' | 'wrong' | 'empty' | 'A' | 'B' | 'C' | 'D' | 'E'>('all');
  const [modalStudentSearch, setModalStudentSearch] = useState("");
  const [toastAlert, setToastAlert] = useState<string | null>(null);

  const showAlert = (msg: string) => {
    setToastAlert(msg);
    setTimeout(() => setToastAlert(null), 3500);
  };

  // Exam results to evaluate: Prefer exam.results, fallback to state.results matching examId/examName
  const examResults = useMemo(() => {
    if (exam.results && exam.results.length > 0) return exam.results;
    return state.results.filter(r => 
      (r.scores && (r.scores[String(exam.id)] !== undefined || r.scores[exam.name] !== undefined))
    );
  }, [exam, state.results]);

  const analysis: QuestionStat[] = useMemo(() => {
    if (examResults.length === 0) return [];

    const sortedResults = [...examResults].sort((a, b) => {
      const keyA = exam.keys?.[a.booklet] || exam.keys?.["A"] || [];
      const keyB = exam.keys?.[b.booklet] || exam.keys?.["A"] || [];
      const scoreA = calculateScore(a.answers || [], keyA, exam.penalty ?? 3, exam.subjects || [], exam.format, exam.name, exam.optionsCount || 4).total.net;
      const scoreB = calculateScore(b.answers || [], keyB, exam.penalty ?? 3, exam.subjects || [], exam.format, exam.name, exam.optionsCount || 4).total.net;
      return scoreB - scoreA;
    });

    const n = sortedResults.length;
    const groupSize = Math.max(1, Math.round(n * 0.27));
    const upperGroup = sortedResults.slice(0, groupSize);
    const lowerGroup = sortedResults.slice(-groupSize);

    const stats: QuestionStat[] = Array(totalQ).fill(0).map(() => ({
      correct: 0,
      wrong: 0,
      empty: 0,
      total: n,
      options: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      students: { correct: [], wrong: [], empty: [] },
      p: 0,
      r: 0
    }));

    examResults.forEach(res => {
      const key = exam.keys?.[res.booklet] || exam.keys?.["A"] || [];
      const ansArr = res.answers || [];
      ansArr.forEach((ans, qIdx) => {
        if (qIdx >= totalQ) return;
        const trueAns = key[qIdx];
        const studentData = { name: res.name || res.studentName || 'İsimsiz', no: String(res.no || res.studentNo || '-'), ans: ans, trueAns: trueAns, booklet: res.booklet || 'A' };

        if (!ans) {
          stats[qIdx].empty++;
          stats[qIdx].students.empty.push(studentData);
        } else {
          if (stats[qIdx].options[ans] !== undefined) stats[qIdx].options[ans]++;
          if (ans === trueAns) {
            stats[qIdx].correct++;
            stats[qIdx].students.correct.push(studentData);
          } else {
            stats[qIdx].wrong++;
            stats[qIdx].students.wrong.push(studentData);
          }
        }
      });
    });

    stats.forEach((stat, qIdx) => {
      stat.p = n > 0 ? (stat.correct / n) : 0;

      let uC = 0, lC = 0;
      upperGroup.forEach(res => {
        const key = exam.keys?.[res.booklet] || exam.keys?.["A"] || [];
        if (res.answers && res.answers[qIdx] === key[qIdx]) uC++;
      });
      lowerGroup.forEach(res => {
        const key = exam.keys?.[res.booklet] || exam.keys?.["A"] || [];
        if (res.answers && res.answers[qIdx] === key[qIdx]) lC++;
      });

      stat.r = groupSize > 0 ? ((uC - lC) / groupSize) : 0;
    });

    return stats;
  }, [exam, totalQ, examResults]);

  const getDifficultyBadge = (p: number) => {
    if (p < 0.20) return { label: "Çok Zor", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
    if (p < 0.40) return { label: "Zor", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    if (p < 0.60) return { label: "Orta", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    if (p < 0.80) return { label: "Kolay", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    return { label: "Çok Kolay", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" };
  };

  const getDiscriminationBadge = (r: number) => {
    if (r >= 0.40) return { label: "Mükemmel", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (r >= 0.30) return { label: "İyi", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    if (r >= 0.20) return { label: "Geliştirilmeli", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    return { label: "Zayıf / Hatalı", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
  };

  const examOverview = useMemo(() => {
    if (analysis.length === 0) return null;
    const avgP = analysis.reduce((a, b) => a + b.p, 0) / analysis.length;
    const avgR = analysis.reduce((a, b) => a + b.r, 0) / analysis.length;
    const hardCount = analysis.filter(q => q.p < 0.35).length;
    const excellentCount = analysis.filter(q => q.r >= 0.30).length;

    return {
      avgP: avgP.toFixed(2),
      avgR: avgR.toFixed(2),
      hardCount,
      excellentCount,
      totalParticipants: examResults.length
    };
  }, [analysis, examResults.length]);

  const handlePrintAnalysis = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return showAlert("Lütfen tarayıcı pop-up engelleyicisine izin verin.");

    let html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${exam.name} - Madde Analiz Raporu</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #333; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 5px; text-transform: uppercase; }
      .subtitle { text-align: center; color: #64748b; margin-bottom: 15px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 15px; font-size: 10px; }
      th, td { border: 1px solid #cbd5e1; padding: 4px; }
      th { background-color: #f1f5f9; font-weight: bold; }
      .sub-title { background-color: #1e293b; color: white; padding: 5px; font-weight: bold; text-align: left; margin-top: 10px; font-size: 11px; }
      .D { color: #16a34a; font-weight: bold; }
      .Y { color: #dc2626; font-weight: bold; }
      .B { color: #64748b; font-weight: bold; }
      .bar-bg { width: 60px; background: #e2e8f0; height: 8px; border-radius: 4px; display: inline-block; overflow: hidden; margin: 0 auto; vertical-align: middle; }
      .bar-fg { height: 100%; display: inline-block; float: left; }
      @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    </style></head><body>
      <h1>${exam.name} - SORU MADDE ANALİZ RAPORU</h1>
      <div class="subtitle">Toplam Katılım: ${examResults.length} Öğrenci | Alt/Üst Grup (%27) Madde Analizi</div>
    `;

    let globalIdxCounter = 0;
    exam.subjects.forEach(sub => {
      html += `<div class="sub-title">${sub.name}</div>
      <table><tr><th style="width:30px;">Soru</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Güçlük (P)</th><th>Ayırt Edicilik (R)</th><th>Grafik</th></tr>`;
      for (let i = 0; i < sub.count; i++) {
        const stat = analysis[globalIdxCounter];
        const cPct = Math.round((stat.correct / (stat.total || 1)) * 100) || 0;
        const wPct = Math.round((stat.wrong / (stat.total || 1)) * 100) || 0;
        const ePct = Math.round((stat.empty / (stat.total || 1)) * 100) || 0;
        html += `<tr>
          <td>S${i + 1}</td>
          <td class="D">%${cPct} (${stat.correct})</td>
          <td class="Y">%${wPct} (${stat.wrong})</td>
          <td class="B">%${ePct} (${stat.empty})</td>
          <td>${stat.p.toFixed(2)} (${getDifficultyBadge(stat.p).label})</td>
          <td>${stat.r.toFixed(2)} (${getDiscriminationBadge(stat.r).label})</td>
          <td>
            <div class="bar-bg">
              <div class="bar-fg" style="width:${cPct}%; background:#22c55e;"></div>
              <div class="bar-fg" style="width:${wPct}%; background:#ef4444;"></div>
              <div class="bar-fg" style="width:${ePct}%; background:#94a3b8;"></div>
            </div>
          </td>
        </tr>`;
        globalIdxCounter++;
      }
      html += `</table>`;
    });

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  const isPublisherExam = exam.examType === 'publisher' || (!exam.keys && (!exam.subjects || exam.subjects.length === 0));
  const internalExams = state.exams.filter(e => e.examType === 'internal' || (e.keys && Object.keys(e.keys).length > 0));

  if (isPublisherExam) {
    return (
      <div className={embedded ? "flex flex-col gap-4 no-print animate-in fade-in" : "bg-slate-50 min-h-full flex flex-col gap-4 pb-8 p-3 sm:p-6 no-print"}>
        {!embedded && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                      Madde ve Soru Analizi
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      📚 Yayıncı Denemesi Seçili
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {exam.name}
                  </p>
                </div>
              </div>

              {state.exams.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Sınav Değiştir:</span>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs px-3 py-2 font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    {state.exams.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.examType === 'internal' ? '🎯 [Kurum İçi Optik] ' : '📚 [Yayıncı Denemesi] '}{e.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-amber-200 shadow-xs flex flex-col items-center justify-center gap-4 max-w-2xl mx-auto my-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-base sm:text-lg font-black text-slate-800">
              Madde & Soru Analizi Bilgilendirmesi
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 max-w-lg leading-relaxed font-medium">
              Madde ve çeldirici analizi optik okuma yapılan kurum içi sınavlarda aktiftir. Yayıncı denemelerinde yayıncıdan gelen toplu ders netleri üzerinden değerlendirme yapılır.
            </p>
            <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
              Seçili olan <strong>{exam.name}</strong> bir yayıncı denemesidir. Soru bazlı madde güçlüğü (P) ve ayırt edicilik (R) analizi için kurum içi optik deneme sınavlarını seçebilirsiniz.
            </p>
          </div>

          {internalExams.length > 0 ? (
            <button
              onClick={() => setSelectedExamId(String(internalExams[0].id))}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <span>Kurum İçi Sınava Geç: {internalExams[0].name}</span>
            </button>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Henüz tanımlı bir Kurum İçi Optik Deneme bulunmuyor. "Sınav Takvimi" menüsünden yeni bir Kurum İçi Optik deneme tanımlayabilirsiniz.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "flex flex-col gap-3 pb-8 no-print animate-in fade-in" : "bg-slate-50 min-h-full flex flex-col gap-3 pb-8 no-print p-3 sm:p-6"}>
      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed top-4 right-4 z-[300] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold border border-slate-700 animate-in slide-in-from-top-2">
          {toastAlert}
        </div>
      )}

      {/* Soru Detay Modalı */}
      {selectedQuestion && (() => {
        const stat = selectedQuestion.stat;
        const total = stat.total || 1;
        const cPct = Math.round((stat.correct / total) * 100);
        const wPct = Math.round((stat.wrong / total) * 100);
        const ePct = Math.round((stat.empty / total) * 100);
        const diff = getDifficultyBadge(stat.p);
        const disc = getDiscriminationBadge(stat.r);

        const filterQuery = modalStudentSearch.toLowerCase().trim();
        const filterList = (list: typeof stat.students.correct) => {
          if (!filterQuery) return list;
          return list.filter(s => s.name.toLowerCase().includes(filterQuery) || s.no.toLowerCase().includes(filterQuery));
        };

        const filteredCorrect = filterList(stat.students.correct);
        const filteredWrong = filterList(stat.students.wrong);
        const filteredEmpty = filterList(stat.students.empty);
        const optionsList = ['A', 'B', 'C', 'D', ...(exam.optionsCount === 5 ? ['E'] : [])];

        return (
          <div
            className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs"
            onClick={() => setSelectedQuestion(null)}
          >
            <div
              className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl relative flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3.5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                        {selectedQuestion.subName} • Soru {selectedQuestion.qNum}
                      </h2>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                        {stat.total} Öğrenci
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md border font-bold text-[11px] ${diff.bg} ${diff.text} ${diff.border}`}>
                        P: {stat.p.toFixed(2)} ({diff.label})
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border font-bold text-[11px] ${disc.bg} ${disc.text} ${disc.border}`}>
                        R: {stat.r.toFixed(2)} ({disc.label})
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
                  title="Pencereyi Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Option Breakdown Bar */}
              <div className="bg-white px-4 sm:px-6 py-3 border-b border-slate-200/70 flex flex-col gap-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Şık Dağılımı:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {optionsList.map(opt => {
                        const count = stat.options[opt] || 0;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div
                            key={opt}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-mono font-bold text-slate-700"
                            title={`${opt} şıkkını işaretleyen: ${count} öğrenci (%${pct})`}
                          >
                            <span className="text-indigo-600">{opt}:</span>
                            <span>{count}</span>
                            <span className="text-[10px] text-slate-400 font-normal">(%{pct})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="text-emerald-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> %{cPct} Doğru
                    </span>
                    <span className="text-rose-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> %{wPct} Yanlış
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-400" /> %{ePct} Boş
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                  <div style={{ width: `${cPct}%` }} className="bg-emerald-500 transition-all" />
                  <div style={{ width: `${wPct}%` }} className="bg-rose-500 transition-all" />
                  <div style={{ width: `${ePct}%` }} className="bg-slate-400 transition-all" />
                </div>
              </div>

              {/* Filter Tabs & Student Search Inside Modal */}
              <div className="bg-slate-100/90 px-4 sm:px-6 py-2.5 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/80 text-xs font-bold overflow-x-auto shadow-2xs gap-0.5">
                  <button
                    type="button"
                    onClick={() => setModalFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      modalFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tümü ({stat.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalFilter('correct')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      modalFilter === 'correct'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Doğru ({stat.correct})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalFilter('wrong')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      modalFilter === 'wrong'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Yanlış ({stat.wrong})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalFilter('empty')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      modalFilter === 'empty'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Boş ({stat.empty})
                  </button>
                  {optionsList.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setModalFilter(opt as any)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap font-mono ${
                        modalFilter === opt
                          ? 'bg-purple-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {opt} ({stat.options[opt] || 0})
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={modalStudentSearch}
                    onChange={(e) => setModalStudentSearch(e.target.value)}
                    placeholder="Öğrenci adı veya no ara..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-medium shadow-2xs transition-all"
                  />
                  {modalStudentSearch && (
                    <button
                      onClick={() => setModalStudentSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-3 sm:p-5 overflow-y-auto flex-1 custom-scrollbar">
                {modalFilter === 'all' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {/* Doğru Yapanlar */}
                    <div className="bg-white border border-emerald-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col h-72 sm:h-96">
                      <div className="bg-emerald-50 text-emerald-800 px-3.5 py-2.5 font-bold flex justify-between items-center border-b border-emerald-100 sticky top-0 text-xs z-10">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Doğru Yapanlar
                        </span>
                        <span className="bg-emerald-200/80 px-2 py-0.5 rounded-full font-mono text-[11px]">
                          {filteredCorrect.length} / {stat.correct}
                        </span>
                      </div>
                      <div className="p-2 overflow-y-auto flex-1 text-xs custom-scrollbar">
                        {filteredCorrect.length > 0 ? (
                          <ul className="divide-y divide-slate-100">
                            {filteredCorrect.map((s, i) => (
                              <li key={i} className="py-2 px-2.5 hover:bg-emerald-50/50 flex justify-between items-center rounded-lg transition-colors">
                                <span className="text-slate-700 font-bold truncate pr-2">{s.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {s.booklet && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                      {s.booklet}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{s.no}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-center text-slate-400 py-10 italic text-xs">
                            {modalStudentSearch ? "Aramaya uygun öğrenci bulunamadı." : "Doğru yapan öğrenci yok."}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Yanlış Yapanlar */}
                    <div className="bg-white border border-rose-200/90 rounded-xl shadow-2xs overflow-hidden flex flex-col h-72 sm:h-96">
                      <div className="bg-rose-50 text-rose-800 px-3.5 py-2.5 font-bold flex justify-between items-center border-b border-rose-100 sticky top-0 text-xs z-10">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Yanlış Yapanlar
                        </span>
                        <span className="bg-rose-200/80 px-2 py-0.5 rounded-full font-mono text-[11px]">
                          {filteredWrong.length} / {stat.wrong}
                        </span>
                      </div>
                      <div className="p-2 overflow-y-auto flex-1 text-xs custom-scrollbar">
                        {filteredWrong.length > 0 ? (
                          <ul className="divide-y divide-slate-100">
                            {filteredWrong.map((s, i) => (
                              <li key={i} className="py-2 px-2.5 hover:bg-rose-50/50 flex justify-between items-center rounded-lg transition-colors">
                                <div className="min-w-0 pr-2">
                                  <div className="text-slate-700 font-bold truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    No: {s.no} {s.booklet && `• Kitapçık: ${s.booklet}`}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full shrink-0 font-mono">
                                  İşaret: {s.ans || "-"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-center text-slate-400 py-10 italic text-xs">
                            {modalStudentSearch ? "Aramaya uygun öğrenci bulunamadı." : "Yanlış yapan öğrenci yok."}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Boş Bırakanlar */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden flex flex-col h-72 sm:h-96">
                      <div className="bg-slate-100 text-slate-700 px-3.5 py-2.5 font-bold flex justify-between items-center border-b border-slate-200 sticky top-0 text-xs z-10">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          Boş Bırakanlar
                        </span>
                        <span className="bg-slate-200 px-2 py-0.5 rounded-full font-mono text-[11px]">
                          {filteredEmpty.length} / {stat.empty}
                        </span>
                      </div>
                      <div className="p-2 overflow-y-auto flex-1 text-xs custom-scrollbar">
                        {filteredEmpty.length > 0 ? (
                          <ul className="divide-y divide-slate-100">
                            {filteredEmpty.map((s, i) => (
                              <li key={i} className="py-2 px-2.5 hover:bg-slate-50 flex justify-between items-center rounded-lg transition-colors">
                                <span className="text-slate-600 font-medium truncate pr-2">{s.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {s.booklet && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                      {s.booklet}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{s.no}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-center text-slate-400 py-10 italic text-xs">
                            {modalStudentSearch ? "Aramaya uygun öğrenci bulunamadı." : "Boş bırakan öğrenci yok."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>
                        {modalFilter === 'correct' && "Doğru Cevap Veren Öğrenciler"}
                        {modalFilter === 'wrong' && "Yanlış Cevap Veren Öğrenciler"}
                        {modalFilter === 'empty' && "Boş Bırakan Öğrenciler"}
                        {['A', 'B', 'C', 'D', 'E'].includes(modalFilter) && `"${modalFilter}" Şıkkını İşaretleyen Öğrenciler`}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {(() => {
                          if (modalFilter === 'correct') return filteredCorrect.length;
                          if (modalFilter === 'wrong') return filteredWrong.length;
                          if (modalFilter === 'empty') return filteredEmpty.length;
                          const allMarked = [...stat.students.correct, ...stat.students.wrong];
                          return filterList(allMarked.filter(s => (s.ans || '').toUpperCase() === modalFilter)).length;
                        })()} Öğrenci
                      </span>
                    </div>
                    <div className="p-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                      {(() => {
                        let targetList: typeof stat.students.correct = [];
                        if (modalFilter === 'correct') targetList = filteredCorrect;
                        else if (modalFilter === 'wrong') targetList = filteredWrong;
                        else if (modalFilter === 'empty') targetList = filteredEmpty;
                        else {
                          const allMarked = [...stat.students.correct, ...stat.students.wrong];
                          targetList = filterList(allMarked.filter(s => (s.ans || '').toUpperCase() === modalFilter));
                        }

                        if (targetList.length === 0) {
                          return (
                            <div className="text-center text-slate-400 py-12 italic text-xs">
                              {modalStudentSearch ? "Aramaya uygun öğrenci bulunamadı." : "Bu seçeneği işaretleyen öğrenci bulunmuyor."}
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {targetList.map((s, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                                  s.ans === s.trueAns
                                    ? 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50'
                                    : s.ans
                                    ? 'bg-rose-50/40 border-rose-100 hover:bg-rose-50'
                                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate">{s.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    No: {s.no} {s.booklet && `• Kitapçık: ${s.booklet}`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {s.ans === s.trueAns ? (
                                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">
                                      ✓ Doğru ({s.ans})
                                    </span>
                                  ) : s.ans ? (
                                    <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-mono">
                                      İşaret: {s.ans} (Doğru: {s.trueAns || '-'})
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                                      Boş
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex justify-between items-center shrink-0">
                <span className="text-xs text-slate-400 font-medium">
                  {stat.total} öğrenciden {stat.correct} doğru (%{cPct})
                </span>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer active:scale-95"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main Analysis Header Card */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-xs border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-xs shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                  Madde ve Çeldirici Analizi
                </h3>
                {state.exams.length > 1 && (
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs px-2.5 py-1 font-bold outline-none cursor-pointer"
                  >
                    {state.exams.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.examType === 'internal' ? '🎯 [Kurum İçi Optik] ' : '📚 [Yayıncı Denemesi] '}{e.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {totalQ} Soru İncelendi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {exam.name} • Madde Güçlüğü (P) ve Ayırt Edicilik (R) katsayıları ile çeldirici dağılımları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <button
              onClick={handlePrintAnalysis}
              className="flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Analiz Raporunu Yazdır</span>
            </button>
          </div>
        </div>

        {/* Global Exam Metrics Summary */}
        {examOverview && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
            <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ortalama Güçlük (P)</span>
              <span className="text-base sm:text-lg font-black font-mono text-slate-700">{examOverview.avgP}</span>
            </div>
            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Ortalama Ayırt Edicilik (R)</span>
              <span className="text-base sm:text-lg font-black font-mono text-indigo-700">{examOverview.avgR}</span>
            </div>
            <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Zor / Kritik Soru</span>
              <span className="text-base sm:text-lg font-black font-mono text-rose-700">{examOverview.hardCount} Soru</span>
            </div>
            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Yüksek Ayırt Edici (R ≥ 0.3)</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-700">{examOverview.excellentCount} Soru</span>
            </div>
          </div>
        )}
      </div>

      {examResults.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-2xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-700">Analiz Edilecek Sınav Verisi Yok</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Madde Güçlük İndeksi (P) ve Ayırt Edicilik (R) hesaplamaları için önce Canlı Tarama menüsünden öğrenci kağıtlarını okutmalısınız.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Toolbar: Subject Tabs & Status Filter */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setActiveSubjectFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeSubjectFilter === "ALL"
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tüm Dersler ({totalQ} Soru)
              </button>
              {exam.subjects.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubjectFilter(sub.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                    activeSubjectFilter === sub.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{sub.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeSubjectFilter === sub.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {sub.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('hard')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'hard' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔥 Zor Sorular (P &lt; 0.40)
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('discriminative')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'discriminative' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⭐ Ayırt Edici (R ≥ 0.30)
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('problematic')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'problematic' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚠️ Sorunlu / Zayıf (R &lt; 0.20)
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Soru no ara (Örn: 5)..."
                  className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Question Cards by Subject */}
          <div className="space-y-4">
            {(() => {
              let globalIdxCounter = 0;
              return exam.subjects.map(sub => {
                const startIdx = globalIdxCounter;
                const subStats = analysis.slice(startIdx, startIdx + sub.count);
                globalIdxCounter += sub.count;

                if (activeSubjectFilter !== "ALL" && activeSubjectFilter !== sub.id) {
                  return null;
                }

                const filteredSubStats = subStats.map((stat, localIdx) => ({
                  stat,
                  localIdx,
                  globalIdx: startIdx + localIdx
                })).filter(({ stat, localIdx }) => {
                  if (searchQuery.trim()) {
                    const qNumStr = (localIdx + 1).toString();
                    if (!qNumStr.includes(searchQuery.trim())) return false;
                  }

                  if (statusFilter === 'hard' && stat.p >= 0.40) return false;
                  if (statusFilter === 'discriminative' && stat.r < 0.30) return false;
                  if (statusFilter === 'problematic' && stat.r >= 0.20) return false;

                  return true;
                });

                if (filteredSubStats.length === 0 && (searchQuery || statusFilter !== 'all')) {
                  return null;
                }

                return (
                  <div key={sub.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                        <h4 className="font-bold text-sm tracking-tight">{sub.name}</h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {filteredSubStats.length} / {sub.count} Soru
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 space-y-2.5">
                      {filteredSubStats.map(({ stat, localIdx }) => {
                        const cPct = Math.round((stat.correct / (stat.total || 1)) * 100) || 0;
                        const wPct = Math.round((stat.wrong / (stat.total || 1)) * 100) || 0;
                        const ePct = Math.round((stat.empty / (stat.total || 1)) * 100) || 0;
                        const diff = getDifficultyBadge(stat.p);
                        const disc = getDiscriminationBadge(stat.r);

                        return (
                          <div
                            key={localIdx}
                            onClick={() => {
                              setModalFilter('all');
                              setModalStudentSearch("");
                              setSelectedQuestion({ subName: sub.name, qNum: localIdx + 1, stat });
                            }}
                            className="p-3 sm:p-3.5 rounded-xl bg-slate-50/70 hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs group flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                          >
                            <div className="flex items-center justify-between sm:justify-center sm:flex-col w-full sm:w-16 shrink-0 bg-white sm:bg-slate-100 p-2 rounded-xl border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                              <span className="text-[10px] font-bold uppercase text-slate-400">SORU</span>
                              <span className="font-mono font-black text-base sm:text-lg text-slate-800 group-hover:text-indigo-700">
                                {localIdx + 1}
                              </span>
                              <div className="sm:hidden text-indigo-600 font-bold text-xs flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> Detay
                              </div>
                            </div>

                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-full bg-slate-200 rounded-full flex overflow-hidden shadow-inner">
                                <div style={{ width: `${cPct}%` }} className="bg-emerald-500 transition-all" title={`Doğru: %${cPct}`} />
                                <div style={{ width: `${wPct}%` }} className="bg-rose-500 transition-all" title={`Yanlış: %${wPct}`} />
                                <div style={{ width: `${ePct}%` }} className="bg-slate-400 transition-all" title={`Boş: %${ePct}`} />
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                                <span className="font-bold text-emerald-700 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  D: %{cPct} <span className="font-mono text-[10px] text-slate-500">({stat.correct})</span>
                                </span>
                                <span className="font-bold text-rose-700 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Y: %{wPct} <span className="font-mono text-[10px] text-slate-500">({stat.wrong})</span>
                                </span>
                                <span className="font-bold text-slate-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  B: %{ePct} <span className="font-mono text-[10px] text-slate-500">({stat.empty})</span>
                                </span>

                                <div className="hidden sm:block h-3 w-px bg-slate-300 mx-0.5" />

                                <span className={`px-2 py-0.5 rounded-md border font-bold text-[11px] ${diff.bg} ${diff.text} ${diff.border}`}>
                                  P: {stat.p.toFixed(2)} ({diff.label})
                                </span>

                                <span className={`px-2 py-0.5 rounded-md border font-bold text-[11px] ${disc.bg} ${disc.text} ${disc.border}`}>
                                  R: {stat.r.toFixed(2)} ({disc.label})
                                </span>
                              </div>
                            </div>

                            <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0 pl-2">
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detay</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}

export default AnalysisView;
