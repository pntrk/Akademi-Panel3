import React, { useState, useEffect, useRef } from 'react';
import { Exam, Subject, ExamKeys } from '../../types';
import { OPTS_4, OPTS_5 } from '../../lib/omrEngine';
import { useAppContext } from '../../context/AppContext';
import {
  CheckCircle2,
  SlidersHorizontal,
  Edit3,
  Layers,
  Copy,
  Printer,
  RotateCcw,
  Trash2,
  ChevronDown,
  X
} from 'lucide-react';

interface QuickInputProps {
  valueArray: string[];
  onChange: (newArr: string[]) => void;
  maxLength: number;
  optionsCount: number;
  subjectName: string;
}

function QuickInput({ valueArray, onChange, maxLength, optionsCount, subjectName }: QuickInputProps) {
  const [localStr, setLocalStr] = useState("");

  useEffect(() => {
    let lastIdx = -1;
    for (let i = valueArray.length - 1; i >= 0; i--) {
      if (valueArray[i] !== "") {
        lastIdx = i;
        break;
      }
    }
    let str = "";
    for (let i = 0; i <= lastIdx; i++) {
      str += valueArray[i] || " ";
    }
    setLocalStr(str.trimEnd());
  }, [valueArray]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validChars = optionsCount === 4 ? /[^A-D \-*X]/gi : /[^A-E \-*X]/gi;
    const val = e.target.value.toUpperCase().replace(validChars, "");
    setLocalStr(val);

    const newArr = Array(maxLength).fill("");
    for (let i = 0; i < Math.min(val.length, maxLength); i++) {
      if (val[i] !== " " && val[i] !== "-") newArr[i] = val[i];
    }
    onChange(newArr);
  };

  const filledCount = valueArray.filter(v => v !== "").length;

  return (
    <div className="relative flex items-center w-full sm:w-52">
      <input
        type="text"
        value={localStr}
        onChange={handleChange}
        maxLength={maxLength}
        placeholder={optionsCount === 4 ? "Hızlı: ABCD..." : "Hızlı: ABCDE..."}
        className="w-full pl-3 pr-14 py-1.5 text-xs font-mono tracking-wider bg-white border border-slate-200/90 rounded-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 uppercase shadow-2xs outline-none transition-all placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 font-bold text-slate-800"
        title={`${subjectName} için ardışık cevap tuşlayın (Örn: ABCDDCBA)`}
      />
      <span className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 font-mono pointer-events-none border border-slate-200/70">
        {filledCount}/{maxLength}
      </span>
    </div>
  );
}

interface KeysTabProps {
  examId?: string;
  exam?: Exam;
  updateExam?: (updates: Partial<Exam>) => void;
  totalQ?: number;
}

export function KeysTab({ examId, exam: propExam, updateExam: propUpdateExam, totalQ: propTotalQ }: KeysTabProps) {
  const { state, updateExamKeys, updateExamOmr } = useAppContext();

  // Aktif sınavı context'ten veya prop'tan çöz
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

  const updateExam = (updates: Partial<Exam>) => {
    if (propUpdateExam) {
      propUpdateExam(updates);
    }
    if (exam && exam.id) {
      if (updates.keys) {
        updateExamKeys(String(exam.id), updates.keys);
      } else {
        updateExamOmr(String(exam.id), updates);
      }
    }
  };

  const calculatedTotalQ = (exam.subjects && exam.subjects.length > 0)
    ? exam.subjects.reduce((sum, s) => sum + s.count, 0)
    : (propTotalQ || 90);
  const totalQ = calculatedTotalQ;

  const [activeBooklet, setActiveBooklet] = useState<string>("A");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | string | 'all'>('all');
  
  // Modallar ve paneller
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState<string>("A");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchTarget, setBatchTarget] = useState<'all' | number | string>('all');
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ders akordiyon durumu
  const [collapsedSubjects, setCollapsedSubjects] = useState<{ [id: string | number]: boolean }>({});

  // Seri klavye modu
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [focusedQuestionIdx, setFocusedQuestionIdx] = useState<number | null>(null);

  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const options = (exam.optionsCount || 4) === 4 ? OPTS_4 : OPTS_5;
  const booklets = ["A", "B", "C", "D"];

  const examKeys: ExamKeys = exam.keys || { A: [], B: [], C: [], D: [] };
  const currentKeys = [...(examKeys[activeBooklet] || [])];
  while (currentKeys.length < totalQ) currentKeys.push("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Menü dışı tıklamada kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seri klavye dinleyicisi
  useEffect(() => {
    if (!isKeyboardMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      const key = e.key.toUpperCase();
      const validKeys = (exam.optionsCount || 4) === 4 ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];

      if (validKeys.includes(key)) {
        e.preventDefault();
        const targetIdx = focusedQuestionIdx !== null ? focusedQuestionIdx : 0;
        setKey(targetIdx, key);
        if (targetIdx < totalQ - 1) {
          setFocusedQuestionIdx(targetIdx + 1);
        }
      } else if (key === '*' || key === 'X') {
        e.preventDefault();
        const targetIdx = focusedQuestionIdx !== null ? focusedQuestionIdx : 0;
        toggleCancelled(targetIdx);
        if (targetIdx < totalQ - 1) {
          setFocusedQuestionIdx(targetIdx + 1);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const targetIdx = focusedQuestionIdx !== null ? Math.max(0, focusedQuestionIdx - 1) : 0;
        setKey(targetIdx, "");
        setFocusedQuestionIdx(targetIdx);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedQuestionIdx(prev => (prev === null ? 0 : Math.min(totalQ - 1, prev + 1)));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedQuestionIdx(prev => (prev === null ? 0 : Math.max(0, prev - 1)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardMode, focusedQuestionIdx, currentKeys, totalQ, exam.optionsCount]);

  const setKey = (gIdx: number, val: string) => {
    const n = [...currentKeys];
    n[gIdx] = n[gIdx] === val ? "" : val;
    updateExam({ keys: { ...examKeys, [activeBooklet]: n } });
  };

  const toggleCancelled = (gIdx: number) => {
    const n = [...currentKeys];
    n[gIdx] = n[gIdx] === "*" ? "" : "*";
    updateExam({ keys: { ...examKeys, [activeBooklet]: n } });
  };

  const handleClearBooklet = () => {
    if (window.confirm(`${activeBooklet} Kitapçığındaki tüm cevaplar temizlensin mi?`)) {
      updateExam({
        keys: {
          ...examKeys,
          [activeBooklet]: Array(totalQ).fill("")
        }
      });
      setShowToolsMenu(false);
      showToast(`${activeBooklet} kitapçığı temizlendi.`);
    }
  };

  const handleCopyBooklet = (fromBooklet: string) => {
    const sourceKeys = examKeys[fromBooklet] || [];
    const newKeys = Array(totalQ).fill("");
    for (let i = 0; i < totalQ; i++) {
      newKeys[i] = sourceKeys[i] || "";
    }
    updateExam({
      keys: {
        ...examKeys,
        [activeBooklet]: newKeys
      }
    });
    setShowCopyModal(false);
    showToast(`${fromBooklet} kitapçığı ${activeBooklet} kitapçığına kopyalandı.`);
  };

  const handleClearSubjectKeys = (startIdx: number, count: number) => {
    const newKeys = [...currentKeys];
    for (let i = 0; i < count; i++) newKeys[startIdx + i] = "";
    showToast("Ders cevapları temizlendi.");
    updateExam({ keys: { ...examKeys, [activeBooklet]: newKeys } });
  };

  const parseBatchText = (text: string): string[] => {
    if (!text.trim()) return [];
    const validLetters = (exam.optionsCount || 4) === 4 ? ['A', 'B', 'C', 'D', '*', 'X'] : ['A', 'B', 'C', 'D', 'E', '*', 'X'];
    const numberedRegex = /\b(?:\d{1,3}[\.\-\:\)\s]+)([A-Ea-e\*X])/g;
    const numberedMatches: string[] = [];
    let match;
    while ((match = numberedRegex.exec(text)) !== null) {
      numberedMatches.push(match[1].toUpperCase());
    }
    if (numberedMatches.length > 0) return numberedMatches;

    const cleaned = text.toUpperCase().replace(/[^A-E\*X\s]/g, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    const result: string[] = [];
    for (const w of words) {
      for (const char of w) {
        if (validLetters.includes(char)) result.push(char);
      }
    }
    return result;
  };

  const batchParsed = parseBatchText(batchText);

  const handleApplyBatch = () => {
    if (batchParsed.length === 0) {
      alert("Yapıştırılan metinde geçerli cevap şıkkı tespit edilemedi.");
      return;
    }
    const newKeys = [...currentKeys];
    if (batchTarget === 'all') {
      const applyCount = Math.min(batchParsed.length, totalQ);
      for (let i = 0; i < applyCount; i++) newKeys[i] = batchParsed[i];
      showToast(`${applyCount} soru cevap anahtarına aktarıldı.`);
    } else {
      const sub = subjectIndexMap.find(s => s.id === batchTarget);
      if (sub) {
        const applyCount = Math.min(batchParsed.length, sub.count);
        for (let i = 0; i < applyCount; i++) newKeys[sub.startIdx + i] = batchParsed[i];
        showToast(`${sub.name} dersine ${applyCount} cevap aktarıldı.`);
      }
    }
    updateExam({ keys: { ...examKeys, [activeBooklet]: newKeys } });
    setShowBatchModal(false);
    setBatchText("");
  };

  const handleCopyFormattedText = () => {
    let output = `📌 ${exam.name} - ${activeBooklet} KİTAPÇIĞI CEVAP ANAHTARI\n`;
    output += `────────────────────────────\n`;
    subjectIndexMap.forEach(sub => {
      output += `\n📖 ${sub.name.toLocaleUpperCase('tr-TR')} (${sub.count} Soru):\n`;
      const subKeys = currentKeys.slice(sub.startIdx, sub.startIdx + sub.count);
      const rows: string[] = [];
      for (let i = 0; i < subKeys.length; i++) {
        const ans = subKeys[i] || "-";
        rows.push(`${i + 1}-${ans}`);
      }
      for (let i = 0; i < rows.length; i += 5) {
        output += rows.slice(i, i + 5).join("   ") + "\n";
      }
    });

    navigator.clipboard.writeText(output).then(() => {
      showToast("Cevap anahtarı panoya kopyalandı!");
      setShowToolsMenu(false);
    }).catch(() => {
      showToast("Panoya kopyalanamadı.");
    });
  };

  const filledCount = currentKeys.filter(k => k !== "").length;
  const isComplete = totalQ > 0 && filledCount === totalQ;
  const completionPercentage = totalQ > 0 ? Math.round((filledCount / totalQ) * 100) : 0;

  let runningIndex = 0;
  const subjects = exam.subjects || [];
  const subjectIndexMap = subjects.map(sub => {
    const start = runningIndex;
    runningIndex += sub.count;
    const subKeys = currentKeys.slice(start, start + sub.count);
    const subFilled = subKeys.filter(k => k !== "").length;
    return {
      ...sub,
      startIdx: start,
      filledCount: subFilled,
      isDone: subFilled === sub.count && sub.count > 0
    };
  });

  const toggleSubjectCollapse = (id: number | string) => {
    setCollapsedSubjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => setCollapsedSubjects({});
  const collapseAll = () => {
    const all: { [id: string | number]: boolean } = {};
    subjects.forEach(s => { all[s.id] = true; });
    setCollapsedSubjects(all);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 pb-20 select-none">
      {/* Toast Bildirimi */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-150 text-xs font-semibold">
          <span className="text-emerald-400"><CheckCircle2 className="w-4 h-4" /></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. ÜST KONTROL & KİTAPÇIK YÖNETİM PANELİ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs px-2.5 py-2 sm:px-4 sm:py-2.5 transition-all flex items-center justify-between gap-2">
        {/* Sol Taraf: Kitapçık Butonları (A - B - C - D) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider hidden md:inline">
            Kitapçık:
          </span>
          <div className="flex items-center bg-slate-100/90 p-0.5 sm:p-1 rounded-xl gap-0.5 border border-slate-200/80">
            {booklets.map(bk => {
              const bkKeys = examKeys[bk] || [];
              const bkFilled = bkKeys.filter(k => k !== "").length;
              const isActive = activeBooklet === bk;
              const isBkDone = totalQ > 0 && bkFilled === totalQ;

              return (
                <button
                  key={bk}
                  type="button"
                  onClick={() => {
                    setActiveBooklet(bk);
                    if (focusedQuestionIdx !== null) setFocusedQuestionIdx(0);
                  }}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-semibold'
                  }`}
                  title={`${bk} Kitapçığı (${bkFilled}/${totalQ} soru kodlandı)`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isBkDone ? 'bg-emerald-500' : bkFilled > 0 ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className="text-xs">{bk}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sağ Taraf: Doluluk Durumu & Yardımcı Araçlar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Kompakt Doluluk Göstergesi */}
          <div
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 sm:py-1.5 rounded-xl border transition-colors select-none shrink-0 ${
              isComplete
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
                : filledCount > 0
                ? 'bg-blue-50/70 text-blue-700 border-blue-200/80'
                : 'bg-slate-50 text-slate-600 border-slate-200/80'
            }`}
            title={`${activeBooklet} Kitapçığı: ${filledCount}/${totalQ} soru kodlandı (%${completionPercentage})`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isComplete ? 'bg-emerald-500' : filledCount > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
            }`} />
            <span className="font-mono text-xs">{filledCount}/{totalQ}</span>
            <span className="text-[10px] opacity-75 font-normal hidden sm:inline">
              (%{completionPercentage})
            </span>
          </div>

          {/* Yardımcı İşlemler Açılır Menüsü */}
          <div className="relative shrink-0" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs select-none"
              title="Ek Araçlar ve İşlemler"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">İşlemler</span>
              <span className="text-[9px] text-slate-400">▼</span>
            </button>

            {/* Dropdown Menü */}
            {showToolsMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in duration-100 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setBatchTarget('all');
                    setShowBatchModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" /> <span>Hızlı Yapıştır (Word/Excel)...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setShowMatrixModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> <span>Kitapçık Karşılaştırma Matrisi</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyFormattedText}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-600" /> <span>Panoya Kopyala (WhatsApp)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setShowPrintModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> <span>A4 Çizelge / Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setShowCopyModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> <span>Başka Kitapçıktan Kopyala</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={handleClearBooklet}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" /> <span>{activeBooklet} Kitapçığını Temizle</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seri Mod Açıkken Bilgi Barı */}
      {isKeyboardMode && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-150 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>
              <strong>Seri Kodlama Modu:</strong> Klavyeden <strong>A, B, C, D{(exam.optionsCount || 4) === 5 ? ', E' : ''}</strong> tuşlarına bastığınızda sıradaki soru otomatik kodlanır. Geri gitmek için <strong>Silme (Backspace)</strong> tuşunu kullanın.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsKeyboardMode(false)}
            className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer shrink-0"
          >
            Kapat
          </button>
        </div>
      )}

      {/* 2. DERS FİLTRELEME & GÖRÜNÜM KONTROLLERİ */}
      <div className="flex items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedSubjectId('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border text-xs ${
              selectedSubjectId === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Tüm Dersler ({subjects.length})
          </button>
          {subjectIndexMap.map(sub => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border text-xs flex items-center gap-1.5 ${
                selectedSubjectId === sub.id
                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                sub.isDone 
                  ? selectedSubjectId === sub.id ? 'bg-emerald-300' : 'bg-emerald-500'
                  : sub.filledCount > 0 
                  ? selectedSubjectId === sub.id ? 'bg-amber-300' : 'bg-amber-500' 
                  : selectedSubjectId === sub.id ? 'bg-purple-300' : 'bg-slate-300'
              }`} />
              <span>{sub.name}</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                selectedSubjectId === sub.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {sub.filledCount}/{sub.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-slate-700"
          >
            Genişlet
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-slate-700"
          >
            Daralt
          </button>
        </div>
      </div>

      {/* 3. DERS KARTLARI VE ŞIK GRUPLARI */}
      <div className="space-y-3.5">
        {subjectIndexMap
          .filter(sub => selectedSubjectId === 'all' || selectedSubjectId === sub.id)
          .map(sub => {
            const isCollapsed = !!collapsedSubjects[sub.id];

            // 5'erli optik gruplar
            const chunks: number[][] = [];
            for (let i = 0; i < sub.count; i += 5) {
              chunks.push(
                Array.from({ length: Math.min(5, sub.count - i) }).map((_, idx) => i + idx)
              );
            }

            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
              >
                {/* Ders Başlığı */}
                <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none flex-wrap"
                    onClick={() => toggleSubjectCollapse(sub.id)}
                  >
                    <span className={`w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transform transition-transform duration-200 shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </span>
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                      {sub.name}
                    </h4>
                    <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-md">
                      {sub.startIdx + 1} - {sub.startIdx + sub.count}. Sorular
                    </span>
                    {sub.isDone ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ✓ Tamamlandı
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-full shadow-2xs font-mono">
                        {sub.filledCount}/{sub.count} Kodlandı
                      </span>
                    )}
                  </div>

                  {/* Sağ Taraf: Hızlı Tuşlama Kutusu ve Şablon Butonları */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    <QuickInput
                      valueArray={currentKeys.slice(sub.startIdx, sub.startIdx + sub.count)}
                      maxLength={sub.count}
                      optionsCount={exam.optionsCount || 4}
                      subjectName={sub.name}
                      onChange={(newArr) => {
                        const newKeys = [...currentKeys];
                        for (let i = 0; i < sub.count; i++) {
                          newKeys[sub.startIdx + i] = newArr[i] || "";
                        }
                        updateExam({ keys: { ...examKeys, [activeBooklet]: newKeys } });
                      }}
                    />

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleClearSubjectKeys(sub.startIdx, sub.count)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200/80 active:scale-95"
                        title="Bu dersin cevaplarını temizle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Soru Kodlama Izgarası */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                      {chunks.map((chunk, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-slate-50/70 hover:bg-slate-50/90 p-2 sm:p-2.5 rounded-xl border border-slate-200/70 flex flex-col gap-1.5 shadow-2xs transition-colors min-w-0"
                        >
                          <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/60 text-[10px] font-bold text-slate-400 font-mono">
                            <span>{chunk[0] + 1} - {chunk[chunk.length - 1] + 1}. Sorular</span>
                            <span className="text-slate-400/80 font-normal">5'li Blok</span>
                          </div>

                          {chunk.map(lIdx => {
                            const gIdx = sub.startIdx + lIdx;
                            const curVal = currentKeys[gIdx] || "";
                            const isFocused = isKeyboardMode && focusedQuestionIdx === gIdx;
                            const isCancelled = curVal === "*" || curVal === "X";

                            return (
                              <div
                                key={gIdx}
                                onClick={() => {
                                  if (isKeyboardMode) setFocusedQuestionIdx(gIdx);
                                }}
                                className={`flex items-center justify-between gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl transition-all border min-w-0 ${
                                  isFocused
                                    ? 'bg-amber-50/90 ring-2 ring-amber-400 shadow-xs border-amber-300'
                                    : curVal
                                    ? 'bg-white shadow-2xs border-slate-200/90'
                                    : 'bg-white/80 hover:bg-white border-slate-200/60 hover:border-slate-300'
                                }`}
                              >
                                {/* Soru No Rozeti */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`w-6 sm:w-6.5 py-0.5 text-center font-mono text-[11px] sm:text-xs font-black rounded-lg border select-none transition-colors ${
                                      isFocused
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : curVal
                                        ? 'bg-blue-50 text-blue-700 border-blue-200/90 font-black'
                                        : 'bg-slate-100 text-slate-500 border-slate-200/80'
                                    }`}
                                  >
                                    {String(lIdx + 1).padStart(2, '0')}
                                  </span>
                                </div>

                                {/* Şıkları Tam Kapsayan Çerçeve (Enclosing Frame) */}
                                <div
                                  className={`flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl border transition-all shrink-0 ${
                                    isFocused
                                      ? 'bg-amber-100/50 border-amber-200'
                                      : curVal
                                      ? 'bg-blue-50/50 border-blue-200/80 shadow-2xs'
                                      : 'bg-slate-100/80 border-slate-200/80 shadow-2xs'
                                  }`}
                                >
                                  {options.map(opt => {
                                    const isSelected = curVal === opt;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setKey(gIdx, opt);
                                          if (isKeyboardMode) {
                                            setFocusedQuestionIdx(Math.min(totalQ - 1, gIdx + 1));
                                          }
                                        }}
                                        className={`rounded-full font-mono font-black transition-all cursor-pointer flex items-center justify-center select-none active:scale-90 shrink-0 ${
                                          (exam.optionsCount || 4) === 5
                                            ? 'w-6 h-6 sm:w-6.5 sm:h-6.5 text-[11px]'
                                            : 'w-6.5 h-6.5 sm:w-7 sm:h-7 text-xs'
                                        } ${
                                          isSelected
                                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30 scale-105'
                                            : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-700 shadow-2xs'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}

                                  {/* İnce Ayırıcı Çizgi */}
                                  <span className="w-px h-3.5 sm:h-4 bg-slate-300/80 mx-0.5 shrink-0" />

                                  {/* İptal / Joker Soru (★) Butonu */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCancelled(gIdx);
                                    }}
                                    className={`rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center select-none active:scale-90 shrink-0 ${
                                      (exam.optionsCount || 4) === 5
                                        ? 'w-6 h-6 sm:w-6.5 sm:h-6.5 text-[11px]'
                                        : 'w-6.5 h-6.5 sm:w-7 sm:h-7 text-xs'
                                    } ${
                                      isCancelled
                                        ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400'
                                        : 'bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-400 border border-slate-200/80 shadow-2xs'
                                    }`}
                                    title="İptal / Joker Soru (MEB Standardı: Herkese Doğru Sayılır)"
                                  >
                                    ★
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* MODAL 1: HIZLI YAPIŞTIR */}
      {showBatchModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setShowBatchModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-3 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-800">
                    Cevapları Hızlı Yapıştır
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Word, Excel veya PDF metninden otomatik şık aktarımı
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Hedef Kapsam
              </label>
              <select
                value={batchTarget}
                onChange={(e) => setBatchTarget(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Tüm {activeBooklet} Kitapçığı ({totalQ} Soru)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.count} Soru)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Cevap Metni (Örn: ABCD... veya 1-A 2-B...)
              </label>
              <textarea
                rows={4}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="Örn: ABCDDCBAACBD..."
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white outline-none uppercase"
              />
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600 font-medium">Algılanan Şık Sayısı:</span>
              <span className="font-mono font-bold text-blue-600">{batchParsed.length} Soru</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={batchParsed.length === 0}
                onClick={handleApplyBatch}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl transition-all cursor-pointer ${
                  batchParsed.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
              >
                Uygula ({batchParsed.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: KİTAPÇIK MATRİSİ */}
      {showMatrixModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-100"
          onClick={() => setShowMatrixModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">
                Kitapçık Karşılaştırma Matrisi (A - B - C - D)
              </h3>
              <button
                type="button"
                onClick={() => setShowMatrixModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              {subjectIndexMap.map(sub => (
                <div key={sub.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="px-3.5 py-2 bg-slate-100 font-bold text-xs text-slate-700 flex justify-between">
                    <span>{sub.name}</span>
                    <span className="font-mono text-slate-500">{sub.count} Soru</span>
                  </div>
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-1.5 px-2 text-left font-mono w-16">No</th>
                        {booklets.map(bk => (
                          <th key={bk} className="py-1.5 px-2 font-bold">{bk}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono font-bold">
                      {Array.from({ length: sub.count }).map((_, lIdx) => {
                        const gIdx = sub.startIdx + lIdx;
                        return (
                          <tr key={gIdx} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-2 text-left text-slate-500 font-normal">{lIdx + 1}</td>
                            {booklets.map(bk => {
                              const ans = (examKeys[bk] || [])[gIdx] || "";
                              const isCanc = ans === "*" || ans === "X";
                              return (
                                <td key={bk} className="py-1.5 px-2">
                                  {ans ? (
                                    <span className={`inline-block w-5.5 h-5.5 leading-5.5 rounded-full text-xs font-bold ${
                                      isCanc ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                                    }`}>
                                      {isCanc ? '★' : ans}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowMatrixModal(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KİTAPÇIK KOPYALA */}
      {showCopyModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-100"
          onClick={() => setShowCopyModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-sm text-slate-800">
                Kitapçıktan Kopyala
              </h4>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Hangi kitapçığın cevaplarını <strong>{activeBooklet}</strong> kitapçığına aktarmak istiyorsunuz?
            </p>

            <div className="grid grid-cols-3 gap-2">
              {booklets
                .filter(b => b !== activeBooklet)
                .map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setCopySource(b)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      copySource === b
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {b} Kitapçığı
                  </button>
                ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => handleCopyBooklet(copySource)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer active:scale-95"
              >
                Kopyala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: A4 YAZDIR / ÖNİZLEME */}
      {showPrintModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-100"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">
                {exam.name} - Cevap Anahtarı Çizelgesi
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Yazdır
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans bg-white">
              <div className="text-center border-b pb-3 mb-4">
                <h2 className="text-base font-black text-slate-900">{exam.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeBooklet} KİTAPÇIĞI CEVAP ANAHTARI
                </p>
              </div>

              <div className="space-y-4">
                {subjectIndexMap.map(sub => {
                  const subKeys = currentKeys.slice(sub.startIdx, sub.startIdx + sub.count);
                  return (
                    <div key={sub.id} className="border border-slate-200 rounded-xl p-3 shadow-2xs">
                      <div className="font-bold text-xs text-slate-800 mb-2 border-b pb-1">
                        {sub.name} ({sub.count} Soru)
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 text-center font-mono">
                        {subKeys.map((ans, idx) => (
                          <div key={idx} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-xs">
                            <div className="text-[10px] text-slate-400">{idx + 1}</div>
                            <div className="font-bold text-slate-800">{ans || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
