import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  RefreshCw, 
  UserPlus, 
  Search, 
  Sparkles, 
  Trash2, 
  ArrowRight, 
  HelpCircle, 
  Check, 
  X, 
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Exam, Student, ExamResult } from '../types';
import { useAppContext } from '../context/AppContext';
import { 
  parseSekonicErtem840, 
  convertSekonicStudentToExamResult, 
  ParsedSekonicStudent, 
  SekonicParseResult,
  normalizeStudentNo
} from '../lib/sekonicParser';
import { generateId } from '../lib/utils';
import { determineLeagueTeam } from '../lib/omrEngine';

interface SekonicUploadTabProps {
  exam: Exam;
  onNavigate?: (tab: string) => void;
  onSuccess?: (savedCount: number) => void;
}

export const SekonicUploadTab: React.FC<SekonicUploadTabProps> = ({ exam, onNavigate, onSuccess }) => {
  const { state, saveOmrExamResults, saveNow } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [isReading, setIsReading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Parsed students state
  const [studentsList, setStudentsList] = useState<ParsedSekonicStudent[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  
  // Custom manual mappings or created students
  // rowId -> Student
  const [manualMappedStudents, setManualMappedStudents] = useState<Record<string, Student>>({});
  // Set of rowIds ignored by teacher
  const [ignoredRowIds, setIgnoredRowIds] = useState<Set<string>>(new Set());

  // Search filter for preview table
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'matched' | 'unmatched' | 'overwrite'>('all');

  // Search in student roster for matching modal/dropdown
  const [activeResolvingRowId, setActiveResolvingRowId] = useState<string | null>(null);
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');

  // Process file with windows-1254 encoding
  const handleFileProcess = async (selectedFile: File) => {
    setIsReading(true);
    setFileName(selectedFile.name);
    setFile(selectedFile);
    setSaveMessage('');

    try {
      const buffer = await selectedFile.arrayBuffer();
      let decodedText = '';
      try {
        const decoder = new TextDecoder('windows-1254');
        decodedText = decoder.decode(buffer);
      } catch (e) {
        // Fallback to utf-8 if windows-1254 fails
        const decoder = new TextDecoder('utf-8');
        decodedText = decoder.decode(buffer);
      }

      setRawText(decodedText);
      runParse(decodedText);
    } catch (err: any) {
      console.error('File read error:', err);
      setParseErrors([`Dosya okunamadı: ${err?.message || 'Bilinmeyen hata'}`]);
    } finally {
      setIsReading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Run Sekonic Ertem-840 parser
  const runParse = (text: string) => {
    const existingExamResults = (exam.results || state.results.filter(r => r.examId === exam.id)) as ExamResult[];
    const result: SekonicParseResult = parseSekonicErtem840(
      text,
      exam,
      state.students,
      existingExamResults
    );

    setStudentsList(result.students);
    setParseErrors(result.errors);
    setManualMappedStudents({});
    setIgnoredRowIds(new Set());
  };

  // Load sample Sekonic TXT bundled in workspace
  const loadSampleFile = async () => {
    setIsReading(true);
    try {
      const res = await fetch('/assets/aistudio/ataturk_ortaokulu_8_son_viraj_32d3b760.TXT');
      if (!res.ok) throw new Error('Örnek dosya bulunamadı.');
      const buffer = await res.arrayBuffer();
      const decoder = new TextDecoder('windows-1254');
      const text = decoder.decode(buffer);

      setFileName('ataturk_ortaokulu_8_son_viraj.TXT (Örnek Sekonic Verisi)');
      setRawText(text);
      runParse(text);
    } catch (e: any) {
      console.error(e);
      setParseErrors([`Örnek veri yüklenirken hata oluştu: ${e.message}`]);
    } finally {
      setIsReading(false);
    }
  };

  // Resolve unmatched student: Add as New Student to Roster
  const handleAddNewStudentToRoster = (studentRow: ParsedSekonicStudent) => {
    const newStudentId = generateId();
    const cleanNo = studentRow.cleanNo || String(Math.floor(100 + Math.random() * 900));
    const targetTeam = determineLeagueTeam(studentRow.score) || 'Taktik Avcıları';

    const numNo = Number(cleanNo) || Math.floor(100 + Math.random() * 900);
    const newStudent: Student = {
      id: newStudentId,
      no: numNo,
      name: studentRow.rawName || `Öğrenci ${cleanNo}`,
      className: studentRow.classFormatted,
      leagueTeam: targetTeam
    };

    setManualMappedStudents(prev => ({
      ...prev,
      [studentRow.rowId]: newStudent
    }));
  };

  // Resolve unmatched student: Link to Existing Student from Roster
  const handleLinkToExistingStudent = (studentRow: ParsedSekonicStudent, existingStudent: Student) => {
    setManualMappedStudents(prev => ({
      ...prev,
      [studentRow.rowId]: existingStudent
    }));
    setActiveResolvingRowId(null);
    setRosterSearchQuery('');
  };

  // Resolve unmatched student: Ignore / Skip this row
  const handleIgnoreRow = (rowId: string) => {
    setIgnoredRowIds(prev => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });
  };

  // Restore skipped row
  const handleRestoreRow = (rowId: string) => {
    setIgnoredRowIds(prev => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  };

  // Compute stats dynamically factoring manual mappings and ignored rows
  const activeStudents = useMemo(() => {
    return studentsList.filter(s => !ignoredRowIds.has(s.rowId));
  }, [studentsList, ignoredRowIds]);

  const unresolvedStudents = useMemo(() => {
    return activeStudents.filter(s => !s.matchedStudent && !manualMappedStudents[s.rowId]);
  }, [activeStudents, manualMappedStudents]);

  const readyToSaveStudents = useMemo(() => {
    return activeStudents.filter(s => Boolean(s.matchedStudent || manualMappedStudents[s.rowId]));
  }, [activeStudents, manualMappedStudents]);

  const overwriteCount = useMemo(() => {
    return readyToSaveStudents.filter(s => s.isOverwriting).length;
  }, [readyToSaveStudents]);

  // Filtered list for display in table
  const displayedStudents = useMemo(() => {
    return studentsList.filter(s => {
      const isIgnored = ignoredRowIds.has(s.rowId);
      const isResolved = Boolean(s.matchedStudent || manualMappedStudents[s.rowId]);
      
      if (statusFilter === 'matched' && (!isResolved || isIgnored)) return false;
      if (statusFilter === 'unmatched' && (isResolved || isIgnored)) return false;
      if (statusFilter === 'overwrite' && (!s.isOverwriting || isIgnored)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (manualMappedStudents[s.rowId]?.name || s.matchedStudent?.name || s.rawName || '').toLowerCase();
      const no = (manualMappedStudents[s.rowId]?.no || s.matchedStudent?.no || s.cleanNo || '').toLowerCase();
      const cls = (s.classFormatted || '').toLowerCase();

      return name.includes(q) || no.includes(q) || cls.includes(q);
    });
  }, [studentsList, ignoredRowIds, manualMappedStudents, statusFilter, searchQuery]);

  // Candidates in student roster for active matching modal
  const rosterCandidates = useMemo(() => {
    if (!activeResolvingRowId) return [];
    const targetRow = studentsList.find(s => s.rowId === activeResolvingRowId);
    if (!targetRow) return [];

    const q = rosterSearchQuery.toLowerCase().trim();
    if (!q) {
      // Suggest students from same grade/class first
      const targetGrade = targetRow.grade;
      return state.students
        .filter(s => (s.className || '').startsWith(targetGrade))
        .slice(0, 15);
    }

    return state.students.filter(s => {
      const name = (s.name || '').toLowerCase();
      const no = String(s.no || '').toLowerCase();
      const cls = (s.className || '').toLowerCase();
      return name.includes(q) || no.includes(q) || cls.includes(q);
    }).slice(0, 20);
  }, [activeResolvingRowId, rosterSearchQuery, studentsList, state.students]);

  // Save all resolved exam results into AppContext state & Firestore
  const handleSaveAll = async () => {
    if (readyToSaveStudents.length === 0) return;
    setIsSaving(true);
    setSaveProgress(10);
    setSaveMessage('Sonuçlar hesaplanıyor ve kaydediliyor...');

    try {
      const newStudentsToCreate: Student[] = [];
      const newResults: ExamResult[] = [];

      readyToSaveStudents.forEach(row => {
        const manualTarget = manualMappedStudents[row.rowId];
        // If manualTarget is brand new (not yet in state.students), add to newStudentsToCreate
        if (manualTarget && !state.students.some(s => s.id === manualTarget.id)) {
          if (!newStudentsToCreate.some(s => s.id === manualTarget.id)) {
            newStudentsToCreate.push(manualTarget);
          }
        }

        const examResult = convertSekonicStudentToExamResult(row, exam, manualTarget);
        newResults.push(examResult);
      });

      setSaveProgress(50);
      setSaveMessage(`${newResults.length} öğrenci sonucu veritabanına aktarılıyor...`);

      // Invoke saveOmrExamResults (which automatically handles updates & new student creation)
      await saveOmrExamResults(exam.id, newResults, newStudentsToCreate);

      // Trigger background immediate flush to Firestore
      saveNow().catch(() => {});

      setSaveProgress(100);
      setSaveMessage(`✅ ${newResults.length} öğrencinin sınav sonucu başarıyla kaydedildi!`);

      if (onSuccess) {
        onSuccess(newResults.length);
      }
    } catch (err: any) {
      console.error('Save Sekonic results error:', err);
      setSaveMessage(`Hata: ${err?.message || 'Kayıt sırasında bir problem oluştu'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 text-slate-100 p-2.5 sm:p-5 pb-24 sm:pb-8">
      {/* Top Banner: Kurum İçi Sınav Bilgilendirmesi */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-xl mb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-black text-white tracking-tight">
                  TXT Veri Yükleme
                </h2>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap">
                    ⚡ Sekonic SR-55D (Ertem-840)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                    🎯 Kurum İçi
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono whitespace-nowrap">
                    CP1254 Türkçe
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={loadSampleFile}
              disabled={isReading}
              className="w-full sm:w-auto justify-center px-3 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-xl text-[11px] sm:text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Örnek Sekonic SR-55D çıktısı yükleyerek sistemi hemen test edin"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Örnek TXT ile Dene</span>
            </button>
          </div>
        </div>

        {/* Exam Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-2.5 pt-2.5 border-t border-indigo-500/20 text-xs">
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Hedef Sınav</span>
            <span className="font-bold text-white truncate block">{exam.name}</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Kitapçık Anahtarları</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              A ({exam.keys?.A?.length || 90} Soru) {exam.keys?.B ? `• B (${exam.keys.B.length} Soru)` : ''}
            </span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Kayıtlı Kütük</span>
            <span className="font-bold text-slate-200">{state.students.length} Öğrenci</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Mevcut Okunan</span>
            <span className="font-bold text-cyan-400">{(exam.results || []).length} Sonuç</span>
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer relative overflow-hidden group shadow-lg ${
          fileName 
            ? 'border-indigo-500/60 bg-gradient-to-b from-indigo-950/30 to-slate-900/90 hover:border-indigo-400' 
            : 'border-slate-700 hover:border-indigo-500/60 bg-slate-900/60 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.dat,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center max-w-md mx-auto">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 shadow-xl ${
            fileName ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-slate-800 text-indigo-400'
          }`}>
            {isReading ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : fileName ? (
              <FileSpreadsheet className="w-7 h-7" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-base font-bold text-white mb-1">
            {fileName ? fileName : 'TXT Veri Yükleme Dosyasını Buraya Sürükleyin'}
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            {fileName 
              ? `${studentsList.length} öğrenci satırı başarıyla okundu. Değiştirmek için tıklayın.`
              : 'veya bilgisayarınızdan dosya seçmek için tıklayın (.txt, .dat)'}
          </p>

          <span className="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all">
            {fileName ? 'Farklı Bir Dosya Seç' : 'Dosya Seç'}
          </span>
        </div>
      </div>

      {/* Parse Errors if any */}
      {parseErrors.length > 0 && (
        <div className="mt-3 bg-red-950/40 border border-red-500/40 rounded-xl p-3 text-xs text-red-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-red-300">
            <AlertTriangle className="w-4 h-4" />
            <span>Ayrıştırma Uyarıları ({parseErrors.length})</span>
          </div>
          {parseErrors.slice(0, 3).map((err, idx) => (
            <div key={idx} className="opacity-90">• {err}</div>
          ))}
          {parseErrors.length > 3 && (
            <div className="text-[11px] opacity-75">ve {parseErrors.length - 3} uyarı daha...</div>
          )}
        </div>
      )}

      {/* Processing / Statistics Overview Cards */}
      {studentsList.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div 
              onClick={() => setStatusFilter('all')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'all' 
                  ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/40' 
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-[11px] text-slate-400 font-medium">Toplam Okunan</div>
              <div className="text-xl font-black text-white mt-0.5">{activeStudents.length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {ignoredRowIds.size > 0 ? `(${ignoredRowIds.size} satır atlandı)` : 'Ertem-840 formu'}
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter('matched')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'matched' 
                  ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40' 
                  : 'bg-emerald-950/20 border-emerald-800/40 hover:border-emerald-700'
              }`}
            >
              <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Eşleşen Öğrenci
              </div>
              <div className="text-xl font-black text-emerald-300 mt-0.5">{readyToSaveStudents.length}</div>
              <div className="text-[10px] text-emerald-400/70 mt-0.5">Kayda hazır</div>
            </div>

            <div 
              onClick={() => setStatusFilter('unmatched')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'unmatched' 
                  ? 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/40' 
                  : 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700'
              }`}
            >
              <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Eşleşmeyen Öğrenci
              </div>
              <div className="text-xl font-black text-amber-300 mt-0.5">{unresolvedStudents.length}</div>
              <div className="text-[10px] text-amber-400/70 mt-0.5">
                {unresolvedStudents.length > 0 ? 'Öğretmen onayı bekleniyor' : 'Tümü eşleştirildi'}
              </div>
            </div>

            <div 
              onClick={() => setStatusFilter('overwrite')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                statusFilter === 'overwrite' 
                  ? 'bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/40' 
                  : 'bg-blue-950/20 border-blue-800/40 hover:border-blue-700'
              }`}
            >
              <div className="text-[11px] text-blue-400 font-medium flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Güncellenecek
              </div>
              <div className="text-xl font-black text-blue-300 mt-0.5">{overwriteCount}</div>
              <div className="text-[10px] text-blue-400/70 mt-0.5">Mevcut sonucun üzerine yazar</div>
            </div>
          </div>

          {/* UNMATCHED STUDENTS RESOLUTION PANEL (User Requirement #2) */}
          {unresolvedStudents.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/50 rounded-2xl p-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Eşleşmeyen Öğrenciler Paneli ({unresolvedStudents.length})
                    </h3>
                    <p className="text-xs text-amber-200/80">
                      Optik formda numara veya isim kütükteki kayıtlarla tam uyuşmadı. Lütfen her satır için bir aksiyon seçin:
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Quick add all unmatched as new students
                    unresolvedStudents.forEach(row => handleAddNewStudentToRoster(row));
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer self-start sm:self-auto"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tümünü Kütüğe Yeni Öğrenci Olarak Ekle</span>
                </button>
              </div>

              {/* Unmatched list cards */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {unresolvedStudents.map(studentRow => (
                  <div
                    key={studentRow.rowId}
                    className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold flex items-center justify-center shrink-0">
                        {studentRow.cleanNo || '?'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-white flex items-center gap-2 truncate">
                          <span>{studentRow.rawName || 'İsimsiz Öğrenci'}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                            {studentRow.classFormatted}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                            Kitapçık: {studentRow.booklet}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Satır {studentRow.lineNum} • Toplam Net: <strong className="text-emerald-400">{studentRow.totalNet.toFixed(2)}</strong> • LGS Puanı: <strong className="text-amber-400">{studentRow.score.toFixed(1)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* 3 Action Buttons */}
                    <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleAddNewStudentToRoster(studentRow)}
                        className="px-2 py-2 sm:px-2.5 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Bu öğrenciyi okul kütüğüne otomatik ekle ve sonucu bağla"
                      >
                        <UserPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>Kütüğe Ekle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveResolvingRowId(studentRow.rowId);
                          setRosterSearchQuery('');
                        }}
                        className="px-2 py-2 sm:px-2.5 sm:py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Mevcut öğrenci listesinden arayıp eşleştir"
                      >
                        <Search className="w-3.5 h-3.5 shrink-0" />
                        <span>Kütükten Seç</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleIgnoreRow(studentRow.rowId)}
                        className="px-2 py-2 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 rounded-lg text-[11px] sm:text-xs font-medium transition-all cursor-pointer border border-slate-700 flex items-center justify-center active:scale-95"
                        title="Bu satırı atla (kaydedilmez)"
                      >
                        <span>Atla</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABLE HEADER ACTIONS: Search & Save Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="İsim, numara veya sınıfa göre ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 text-white pl-9 pr-3 py-2 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving || readyToSaveStudents.length === 0}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {isSaving 
                    ? 'Kaydediliyor...' 
                    : `Tüm Sonuçları Kaydet (${readyToSaveStudents.length} Öğrenci)`}
                </span>
              </button>
            </div>
          </div>

          {/* Saving Progress Indicator */}
          {isSaving && (
            <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/40 space-y-2">
              <div className="flex justify-between text-xs font-bold text-emerald-400">
                <span>{saveMessage}</span>
                <span>%{saveProgress}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Banner */}
          {saveMessage && !isSaving && (
            <div className="bg-emerald-950/60 border border-emerald-500/50 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">{saveMessage}</span>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('results')}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Sonuç Ekranına Git →
                </button>
              )}
            </div>
          )}

          {/* RESULTS PREVIEW (Desktop Table + Mobile Cards) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3 font-semibold">Sıra</th>
                    <th className="py-2.5 px-3 font-semibold">No</th>
                    <th className="py-2.5 px-3 font-semibold">Ad Soyad</th>
                    <th className="py-2.5 px-3 font-semibold">Sınıf</th>
                    <th className="py-2.5 px-2 font-semibold text-center">Kit.</th>
                    <th className="py-2.5 px-2 font-semibold text-center">TR (20)</th>
                    <th className="py-2.5 px-2 font-semibold text-center">SOS (10)</th>
                    <th className="py-2.5 px-2 font-semibold text-center">DİN (10)</th>
                    <th className="py-2.5 px-2 font-semibold text-center">İNG (10)</th>
                    <th className="py-2.5 px-2 font-semibold text-center">MAT (20)</th>
                    <th className="py-2.5 px-2 font-semibold text-center">FEN (20)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Toplam Net</th>
                    <th className="py-2.5 px-3 font-semibold text-center">LGS Puan</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedStudents.map((row, idx) => {
                    const isIgnored = ignoredRowIds.has(row.rowId);
                    const manualTarget = manualMappedStudents[row.rowId];
                    const effectiveStudent = manualTarget || row.matchedStudent;
                    const finalName = effectiveStudent ? effectiveStudent.name : row.rawName;
                    const finalNo = effectiveStudent ? effectiveStudent.no : (row.cleanNo || '?');
                    const subScores = row.evaluatedScore?.subjectScores || {};

                    return (
                      <tr 
                        key={row.rowId}
                        className={`transition-colors ${
                          isIgnored 
                            ? 'opacity-40 bg-slate-950' 
                            : !effectiveStudent 
                            ? 'bg-amber-950/15 hover:bg-amber-950/25'
                            : row.isOverwriting 
                            ? 'bg-blue-950/15 hover:bg-blue-950/25'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-300">{finalNo}</td>
                        <td className="py-2 px-3 font-semibold text-white">
                          <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                            <span className="truncate">{finalName}</span>
                            {manualTarget && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                Eşlendi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-mono">{row.classFormatted}</td>
                        <td className="py-2 px-2 text-center font-bold text-indigo-400">{row.booklet}</td>

                        {/* Subject Nets */}
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['Türkçe'] !== undefined ? subScores['Türkçe'].net.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['T.C. İnkılap Tarihi ve Atatürkçülük'] !== undefined 
                            ? subScores['T.C. İnkılap Tarihi ve Atatürkçülük'].net.toFixed(1) 
                            : (subScores['Sosyal Bilgiler'] !== undefined ? subScores['Sosyal Bilgiler'].net.toFixed(1) : '-')}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['Din Kültürü ve Ahlak Bilgisi'] !== undefined ? subScores['Din Kültürü ve Ahlak Bilgisi'].net.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['İngilizce'] !== undefined ? subScores['İngilizce'].net.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['Matematik'] !== undefined ? subScores['Matematik'].net.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {subScores['Fen Bilimleri'] !== undefined ? subScores['Fen Bilimleri'].net.toFixed(1) : '-'}
                        </td>

                        <td className="py-2 px-3 text-center font-bold text-emerald-400 font-mono">
                          {row.totalNet.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-amber-400 font-mono">
                          {row.score.toFixed(1)}
                        </td>

                        <td className="py-2 px-3 text-center">
                          {isIgnored ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreRow(row.rowId)}
                              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                            >
                              Geri Al
                            </button>
                          ) : !effectiveStudent ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveResolvingRowId(row.rowId);
                                setRosterSearchQuery('');
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer"
                            >
                              ⚠️ Eşleştir
                            </button>
                          ) : row.isOverwriting ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Güncellenecek
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Yeni
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden p-3 space-y-2 divide-y divide-slate-800/80">
              {displayedStudents.map((row, idx) => {
                const isIgnored = ignoredRowIds.has(row.rowId);
                const manualTarget = manualMappedStudents[row.rowId];
                const effectiveStudent = manualTarget || row.matchedStudent;
                const finalName = effectiveStudent ? effectiveStudent.name : row.rawName;
                const finalNo = effectiveStudent ? effectiveStudent.no : (row.cleanNo || '?');
                const subScores = row.evaluatedScore?.subjectScores || {};

                return (
                  <div
                    key={row.rowId}
                    className={`pt-2.5 first:pt-0 flex flex-col gap-1.5 text-xs ${
                      isIgnored ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 font-mono font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span>{finalName}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                              No: {finalNo}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Sınıf: {row.classFormatted} • Kitapçık: <strong className="text-indigo-300">{row.booklet}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-emerald-400 font-mono">
                          {row.totalNet.toFixed(2)} Net
                        </div>
                        <div className="text-[10px] font-bold text-amber-400 font-mono">
                          {row.score.toFixed(1)} LGS Puan
                        </div>
                      </div>
                    </div>

                    {/* Subject Nets Mini Row */}
                    <div className="grid grid-cols-6 gap-1 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 text-[10px] text-center font-mono">
                      <div>
                        <span className="text-slate-500 block text-[8px]">TR</span>
                        <span className="text-slate-200 font-bold">{subScores['Türkçe'] !== undefined ? subScores['Türkçe'].net.toFixed(1) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px]">SOS</span>
                        <span className="text-slate-200 font-bold">{subScores['T.C. İnkılap Tarihi ve Atatürkçülük'] !== undefined ? subScores['T.C. İnkılap Tarihi ve Atatürkçülük'].net.toFixed(1) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px]">DİN</span>
                        <span className="text-slate-200 font-bold">{subScores['Din Kültürü ve Ahlak Bilgisi'] !== undefined ? subScores['Din Kültürü ve Ahlak Bilgisi'].net.toFixed(1) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px]">İNG</span>
                        <span className="text-slate-200 font-bold">{subScores['İngilizce'] !== undefined ? subScores['İngilizce'].net.toFixed(1) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px]">MAT</span>
                        <span className="text-slate-200 font-bold">{subScores['Matematik'] !== undefined ? subScores['Matematik'].net.toFixed(1) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[8px]">FEN</span>
                        <span className="text-slate-200 font-bold">{subScores['Fen Bilimleri'] !== undefined ? subScores['Fen Bilimleri'].net.toFixed(1) : '-'}</span>
                      </div>
                    </div>

                    {/* Bottom Status / Action */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {isIgnored ? 'Atlandı' : effectiveStudent ? 'Kütükle eşleşti' : 'Kütükte bulunamadı'}
                      </span>

                      {isIgnored ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreRow(row.rowId)}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Geri Al
                        </button>
                      ) : !effectiveStudent ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveResolvingRowId(row.rowId);
                            setRosterSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer active:scale-95"
                        >
                          ⚠️ Eşleştir
                        </button>
                      ) : row.isOverwriting ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Güncellenecek
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Yeni
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Link Row to Existing Student from Roster */}
      {activeResolvingRowId && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-5 text-white flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm sm:text-base">Kütükten Öğrenci Eşleştir</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveResolvingRowId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target row details */}
            {(() => {
              const targetRow = studentsList.find(s => s.rowId === activeResolvingRowId);
              if (!targetRow) return null;
              return (
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Optikten Okunan:</span>
                    <strong className="text-white text-sm">{targetRow.rawName || 'İsimsiz'}</strong>
                    <span className="text-slate-400 ml-2">No: {targetRow.cleanNo || '?'} • {targetRow.classFormatted}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleAddNewStudentToRoster(targetRow);
                      setActiveResolvingRowId(null);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Yeni Olarak Ekle</span>
                  </button>
                </div>
              );
            })()}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Öğrenci adı veya numarası ile ara..."
                value={rosterSearchQuery}
                onChange={(e) => setRosterSearchQuery(e.target.value)}
                className="w-full bg-slate-800 text-white pl-9 pr-3 py-2 rounded-xl border border-slate-700 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Candidates list */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
              {rosterCandidates.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Eşleşen öğrenci bulunamadı.
                </div>
              ) : (
                rosterCandidates.map(st => (
                  <div
                    key={st.id}
                    onClick={() => {
                      const targetRow = studentsList.find(s => s.rowId === activeResolvingRowId);
                      if (targetRow) {
                        handleLinkToExistingStudent(targetRow, st);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-indigo-950/60 hover:border-indigo-500/60 border border-slate-700/60 flex items-center justify-between text-xs cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {st.no}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{st.name}</div>
                        <div className="text-[10px] text-slate-400">{st.className} • {st.leagueTeam || 'Takım Yok'}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold shrink-0"
                    >
                      Seç
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveResolvingRowId(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
