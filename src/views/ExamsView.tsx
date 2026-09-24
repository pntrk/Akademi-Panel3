import React, { useRef, useState, useEffect, useMemo } from 'react';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { useAppContext } from '../context/AppContext';
import { Exam, ExamSubject } from '../types';
import { exportToExcel, importFromExcel, generateId, normalizeForSearch, formatDateLong, formatDateShort } from '../lib/utils';
import { 
  Upload, Download, Plus, Trash2, X, Calendar, DollarSign, Building, 
  Users, CheckSquare, Square, ExternalLink, Award, FileText, 
  MapPin, HelpCircle, Activity, TrendingUp, Sparkles, BookOpen, AlertCircle, Settings,
  Search, Filter, ChevronDown, Package, Layers, DoorOpen, Printer, Edit3, Check, Bell,
  FileJson, RotateCcw, Type, Palette, Sliders, CheckCircle2, ZoomIn, ZoomOut, Maximize2,
  QrCode, Key, SlidersHorizontal
} from 'lucide-react';

// Setup pdfMake Turkish fonts
if (typeof window !== 'undefined') {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;
}

export interface PaletteColor {
  id: string;
  label: string;
  bgClass: string;
  hex: string;
  borderHex: string;
  textHex: string;
}

export const PUBLISHER_COLOR_PALETTE: PaletteColor[] = [
  { id: 'gray', label: 'Gri (Standart)', bgClass: 'bg-gray-100', hex: '#f3f4f6', borderHex: '#d1d5db', textHex: '#374151' },
  { id: 'amber', label: 'Kehribar', bgClass: 'bg-amber-100', hex: '#fef3c7', borderHex: '#fcd34d', textHex: '#92400e' },
  { id: 'orange', label: 'Turuncu', bgClass: 'bg-orange-100', hex: '#ffedd5', borderHex: '#fdba74', textHex: '#9a3412' },
  { id: 'yellow', label: 'Sarı', bgClass: 'bg-yellow-100', hex: '#fef9c3', borderHex: '#fde047', textHex: '#854d0e' },
  { id: 'lime', label: 'Açık Yeşil', bgClass: 'bg-lime-100', hex: '#ecfccb', borderHex: '#bef264', textHex: '#3f6212' },
  { id: 'green', label: 'Yeşil', bgClass: 'bg-green-100', hex: '#dcfce7', borderHex: '#86efac', textHex: '#166534' },
  { id: 'emerald', label: 'Zümrüt', bgClass: 'bg-emerald-100', hex: '#d1fae5', borderHex: '#6ee7b7', textHex: '#065f46' },
  { id: 'teal', label: 'Turkuaz', bgClass: 'bg-teal-100', hex: '#ccfbf1', borderHex: '#5eead4', textHex: '#115e59' },
  { id: 'cyan', label: 'Camgöbeği', bgClass: 'bg-cyan-100', hex: '#cffafe', borderHex: '#67e8f9', textHex: '#155e75' },
  { id: 'sky', label: 'Gök Mavisi', bgClass: 'bg-sky-100', hex: '#e0f2fe', borderHex: '#7dd3fc', textHex: '#0369a1' },
  { id: 'blue', label: 'Mavi', bgClass: 'bg-blue-100', hex: '#dbeafe', borderHex: '#93c5fd', textHex: '#1e40af' },
  { id: 'indigo', label: 'İndigo', bgClass: 'bg-indigo-100', hex: '#e0e7ff', borderHex: '#a5b4fc', textHex: '#3730a3' },
  { id: 'purple', label: 'Mor', bgClass: 'bg-purple-100', hex: '#f3e8ff', borderHex: '#d8b4fe', textHex: '#6b21a8' },
  { id: 'fuchsia', label: 'Fuşya', bgClass: 'bg-fuchsia-100', hex: '#fae8ff', borderHex: '#f0abfc', textHex: '#86198f' },
  { id: 'pink', label: 'Pembe', bgClass: 'bg-pink-100', hex: '#fce7f3', borderHex: '#f472b6', textHex: '#9d174d' },
  { id: 'rose', label: 'Gül Kurusu', bgClass: 'bg-rose-100', hex: '#ffe4e6', borderHex: '#fda4af', textHex: '#9f1239' },
];

export const COLOR_OPTIONS = PUBLISHER_COLOR_PALETTE.map(p => ({
  label: p.label,
  value: p.hex,
}));

export const getPublisherColorInfo = (
  pubName: string | undefined, 
  customColors: Record<string, string> = {}
): PaletteColor => {
  const clean = (pubName || '').trim();
  const selectedVal = clean ? customColors[clean] : '';

  if (selectedVal) {
    const found = PUBLISHER_COLOR_PALETTE.find(
      p => p.id === selectedVal || p.bgClass === selectedVal || p.hex.toLowerCase() === selectedVal.toLowerCase()
    );
    if (found) return found;

    if (selectedVal.startsWith('#')) {
      return {
        id: 'custom',
        label: 'Özel Renk',
        bgClass: '',
        hex: selectedVal,
        borderHex: selectedVal,
        textHex: '#111827',
      };
    }
  }

  // Predefined keyword matching
  const p = clean.toLowerCase();
  if (p.includes('işler')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'orange')!;
  if (p.includes('çınar')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'green')!;
  if (p.includes('arı')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'yellow')!;
  if (p.includes('mozaik')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'amber')!;
  if (p.includes('okyanus')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'blue')!;
  if (p.includes('palme')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'cyan')!;
  if (p.includes('ulti')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'purple')!;
  if (p.includes('işleyen zeka')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'rose')!;
  if (p.includes('sinan kuzucu')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'pink')!;
  if (p.includes('nartest')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'emerald')!;
  if (p.includes('hız')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'fuchsia')!;
  if (p.includes('sadık uygun')) return PUBLISHER_COLOR_PALETTE.find(x => x.id === 'indigo')!;

  // Stable hash fallback among diverse palette colors
  if (clean) {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const candidateColors = PUBLISHER_COLOR_PALETTE.filter(c => c.id !== 'gray');
    return candidateColors[Math.abs(hash) % candidateColors.length];
  }

  return PUBLISHER_COLOR_PALETTE[0]; // gray
};

export interface PrintSettingsConfig {
  showPublisher: boolean;
  showParticipants: boolean;
  showOrderQuantity: boolean;
  showHalls: boolean;
  orientation: 'portrait' | 'landscape';
  pageCount: '1' | '2' | 'auto';
  fontFamily: 'sans' | 'serif' | 'mono';
  fontScale: 'auto' | 'compact' | 'normal' | 'spacious';
  fontWeight: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  tableDensity: 'compact' | 'normal' | 'comfortable';
  showFooter: boolean;
  footerText: string;
  colorMode: 'nameCell' | 'fullRow';
  tableScale: number; // Yüzde olarak ölçek: 70 - 150 (varsayılan 100)
}

const DEFAULT_PRINT_SETTINGS: PrintSettingsConfig = {
  showPublisher: false,
  showParticipants: true,
  showOrderQuantity: false,
  showHalls: false,
  orientation: 'portrait',
  pageCount: '1',
  fontFamily: 'sans',
  fontScale: 'auto',
  fontWeight: 'normal',
  tableDensity: 'compact',
  showFooter: true,
  footerText: 'Kırklareli Atatürk Ortaokulu Sınav Koordinatörlüğü',
  colorMode: 'nameCell',
  tableScale: 100,
};

export const ExamsView = () => {
  const { state, setExams, setResults, setExamHalls, updateBudget, setStudents, userRole, openNotificationModal } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileRef = useRef<HTMLInputElement>(null);

  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Local modal form states
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examNo, setExamNo] = useState<number>(0);
  const [examParticipantCount, setExamParticipantCount] = useState<number>(0);
  const [examPublisher, setExamPublisher] = useState('');
  const [examPublisherFee, setExamPublisherFee] = useState<number>(0);
  const [examOrderQuantity, setExamOrderQuantity] = useState<number>(0);
  const [examGradeOrderQuantities, setExamGradeOrderQuantities] = useState<Record<string, number>>({});
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedHalls, setSelectedHalls] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Hibrit Deneme Sınavı (Yayıncı vs Kurum İçi Optik) Form Durumları
  const [examType, setExamType] = useState<'publisher' | 'internal'>('publisher');
  const [examOptionsCount, setExamOptionsCount] = useState<number>(4);
  const [examPenalty, setExamPenalty] = useState<number>(3);
  const [examLayoutType, setExamLayoutType] = useState<'standard' | 'split'>('split');
  const [examFormat, setExamFormat] = useState<'lgs' | 'mebi' | 'tyt' | 'ayt'>('lgs');
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([
    { id: 1, name: "Türkçe", count: 20, section: 1 },
    { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
    { id: 3, name: "Din Kültürü", count: 10, section: 1 },
    { id: 4, name: "İngilizce", count: 10, section: 1 },
    { id: 5, name: "Matematik", count: 20, section: 2 },
    { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
  ]);
  const [examKeys, setExamKeys] = useState<{ [booklet: string]: string[] }>({
    A: Array(90).fill(''),
    B: Array(90).fill('')
  });
  const [activeKeyBooklet, setActiveKeyBooklet] = useState<string>('A');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [quickKeyInput, setQuickKeyInput] = useState<string>('');
  const [newSubName, setNewSubName] = useState<string>('');
  const [newSubCount, setNewSubCount] = useState<number>(10);

  // Search filter and manual score states in modal
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualStudentScore, setManualStudentScore] = useState('');

  // Sınıf filtresi (Çoklu Seçim), yayıncı filtresi, arama ve sıralama durumu
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['Tümü']);
  const [filterPublisher, setFilterPublisher] = useState<string>('Tümü');
  const [sortBy, setSortBy] = useState<'date-asc' | 'date-desc' | 'no-asc' | 'no-desc' | 'name-asc'>('date-asc');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'layout' | 'typography' | 'content' | 'colors'>('layout');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  
  // Takvim yazdırma başlıkları (elle düzenlenebilir ve kaydedilebilir)
  const [printMainTitle, setPrintMainTitle] = useState('KIRKLARELİ ATATÜRK ORTAOKULU');
  const [printSubTitle, setPrintSubTitle] = useState('2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ');

  const [printSettings, setPrintSettings] = useState<PrintSettingsConfig>(DEFAULT_PRINT_SETTINGS);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [publisherColors, setPublisherColors] = useState<Record<string, string>>({});

  // Uyumlu filterGrade okuma (Tekli metin beklentisi olan yerler için)
  const filterGrade = useMemo(() => {
    if (selectedGrades.includes('Tümü') || selectedGrades.length === 0) return 'Tümü';
    return selectedGrades.join(', ');
  }, [selectedGrades]);

  // Yazdırma ve filtre ayarlarını ilk açılışta yerel hafızadan yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem('akademi_exam_calendar_print_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.selectedGrades) && parsed.selectedGrades.length > 0) {
          setSelectedGrades(parsed.selectedGrades);
        }
        if (parsed.printMainTitle) setPrintMainTitle(parsed.printMainTitle);
        if (parsed.printSubTitle) setPrintSubTitle(parsed.printSubTitle);
        if (parsed.printSettings) {
          setPrintSettings(prev => ({
            ...DEFAULT_PRINT_SETTINGS,
            ...prev,
            ...parsed.printSettings,
          }));
        }
        if (parsed.publisherColors) setPublisherColors(parsed.publisherColors);
      }
    } catch (e) {
      console.warn('Yazdırma ayarları okunamadı:', e);
    }

    // Uygulama genel yedek geri yüklendiğinde ayarları otomatik eşitle
    const handleSettingsRestored = (e: any) => {
      try {
        const data = e.detail;
        if (!data) return;
        if (data.printMainTitle) setPrintMainTitle(data.printMainTitle);
        if (data.printSubTitle) setPrintSubTitle(data.printSubTitle);
        if (Array.isArray(data.selectedGrades) && data.selectedGrades.length > 0) {
          setSelectedGrades(data.selectedGrades);
        }
        if (data.printSettings) {
          setPrintSettings(prev => ({ ...DEFAULT_PRINT_SETTINGS, ...prev, ...data.printSettings }));
        }
        if (data.publisherColors) setPublisherColors(data.publisherColors);
        setSaveFeedback('✓ Sınav takvimi ayarları uygulama yedeğinden geri yüklendi.');
        setTimeout(() => setSaveFeedback(null), 3500);
      } catch (err) {
        console.warn('Yedek senkron hatası:', err);
      }
    };

    window.addEventListener('exam-calendar-settings-restored', handleSettingsRestored);
    return () => {
      window.removeEventListener('exam-calendar-settings-restored', handleSettingsRestored);
    };
  }, []);

  // Yazdırma ayarlarını uygulama yedeği ve yerel depolamaya otomatik kaydet
  useEffect(() => {
    try {
      const config = {
        selectedGrades,
        printMainTitle,
        printSubTitle,
        printSettings,
        publisherColors,
      };
      localStorage.setItem('akademi_exam_calendar_print_config', JSON.stringify(config));
    } catch (e) {
      console.warn('Yazdırma ayarları kaydedilemedi:', e);
    }
  }, [selectedGrades, printMainTitle, printSubTitle, printSettings, publisherColors]);

  // Yazdırma ayarlarını manuel kaydetme
  const handleSavePrintSettings = () => {
    try {
      const config = {
        selectedGrades,
        printMainTitle,
        printSubTitle,
        printSettings,
        publisherColors,
      };
      localStorage.setItem('akademi_exam_calendar_print_config', JSON.stringify(config));
      setSaveFeedback('✓ Sınav takvimi yazdırma ayarları uygulama yedeğine kaydedildi!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (e) {
      console.warn('Yazdırma ayarları kaydedilemedi:', e);
    }
  };

  // Yazdırma ayarlarını varsayılana sıfırla
  const handleResetPrintSettings = () => {
    setPrintSettings(DEFAULT_PRINT_SETTINGS);
    setPrintMainTitle('KIRKLARELİ ATATÜRK ORTAOKULU');
    updateSubTitleForGrades(selectedGrades);
    setPublisherColors({});
    setSaveFeedback('✓ Yazdırma ayarları ve renkler varsayılan değerlere sıfırlandı.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Tüm yayıncılara benzersiz şık pastel renkleri otomatik ata
  const handleAutoDistributeColors = () => {
    const newColors: Record<string, string> = {};
    const palette = PUBLISHER_COLOR_PALETTE.filter(p => p.id !== 'gray');
    uniquePublishers.forEach((pub, idx) => {
      const pubName = pub || 'Bilinmiyor';
      const assigned = palette[idx % palette.length];
      newColors[pubName] = assigned.hex;
    });
    setPublisherColors(prev => ({ ...prev, ...newColors }));
    setSaveFeedback('✓ Tüm yayıncılara benzersiz pastel renkler otomatik atandı.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Sadece yayıncı renklerini sıfırla
  const handleResetPublisherColors = () => {
    setPublisherColors({});
    setSaveFeedback('✓ Yayıncı renkleri varsayılan değerlere sıfırlandı.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Seçili sınıflara göre alt başlığı akıllı güncelle
  const updateSubTitleForGrades = (grades: string[]) => {
    if (grades.includes('Tümü') || grades.length === 0) {
      setPrintSubTitle('2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ');
    } else {
      const sorted = [...grades].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
      const label = sorted.map(g => g === 'Diğer' ? 'DİĞER' : `${g}`).join(', ');
      setPrintSubTitle(`2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ (${label}. SINIFLAR)`);
    }
  };

  // Çoklu seçim mantığı ile sınıf seviyesi ekle/çıkar
  const handleGradeToggle = (lvl: string) => {
    let nextGrades: string[];
    if (lvl === 'Tümü') {
      nextGrades = ['Tümü'];
    } else {
      if (selectedGrades.includes('Tümü')) {
        nextGrades = [lvl];
      } else if (selectedGrades.includes(lvl)) {
        nextGrades = selectedGrades.filter(g => g !== lvl);
        if (nextGrades.length === 0) nextGrades = ['Tümü'];
      } else {
        nextGrades = [...selectedGrades, lvl];
      }
    }
    setSelectedGrades(nextGrades);
    updateSubTitleForGrades(nextGrades);
  };

  // Sync state when modal is opened
  useEffect(() => {
    if (editingExam) {
      setExamType(editingExam.examType || (editingExam.keys && Object.keys(editingExam.keys).length > 0 ? 'internal' : 'publisher'));
      setExamName(editingExam.name || '');
      setExamDate(editingExam.date ? (formatDateShort(editingExam.date) || editingExam.date) : '');
      setExamNo(editingExam.no || 0);
      setExamParticipantCount(editingExam.participantCount || 0);
      setExamPublisher(editingExam.publisher || '');
      setExamPublisherFee(editingExam.publisherFee || 0);
      setExamOrderQuantity(editingExam.orderQuantity || 0);
      setExamGradeOrderQuantities(editingExam.gradeOrderQuantities || {});
      setSelectedClasses(editingExam.participatingClasses || []);
      setSelectedHalls(editingExam.assignedHalls || []);
      setExamOptionsCount(editingExam.optionsCount || 4);
      setExamPenalty(editingExam.penalty !== undefined ? editingExam.penalty : 3);
      setExamLayoutType(editingExam.layoutType || 'split');
      setExamFormat(editingExam.format || 'lgs');
      setExamSubjects(
        editingExam.subjects && editingExam.subjects.length > 0
          ? editingExam.subjects
          : [
              { id: 1, name: "Türkçe", count: 20, section: 1 },
              { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
              { id: 3, name: "Din Kültürü", count: 10, section: 1 },
              { id: 4, name: "İngilizce", count: 10, section: 1 },
              { id: 5, name: "Matematik", count: 20, section: 2 },
              { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
            ]
      );
      setExamKeys(
        editingExam.keys || {
          A: Array(90).fill(''),
          B: Array(90).fill('')
        }
      );
      setShowDeleteConfirm(false);
      setShowKeyModal(false);
      setQuickKeyInput('');
      setResultsSearchQuery('');
      setManualStudentId('');
      setManualStudentScore('');
    }
  }, [editingExam]);

  const handleGradeOrderQuantityChange = (lvl: string, val: number) => {
    const updated: Record<string, number> = {
      ...examGradeOrderQuantities,
      [lvl]: val
    };
    setExamGradeOrderQuantities(updated);
    
    // Sum them up to set total order quantity
    const total = Object.values(updated).reduce((sum: number, current: number) => sum + current, 0);
    setExamOrderQuantity(total);
  };

  // Optik Sınav Soru Sayısı ve Ders / Cevap Anahtarı Yönetim Yardımcıları
  const totalExamQuestions = useMemo(() => {
    return examSubjects.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  }, [examSubjects]);

  const handleUpdateSubjectCount = (id: string | number, newCount: number) => {
    setExamSubjects(prev => prev.map(s => s.id === id ? { ...s, count: Math.max(1, newCount) } : s));
  };

  const handleRemoveSubject = (id: string | number) => {
    setExamSubjects(prev => prev.filter(s => s.id !== id));
  };

  const handleAddSubject = () => {
    if (!newSubName.trim()) return;
    const newId = Date.now();
    setExamSubjects(prev => [
      ...prev,
      { id: newId, name: newSubName.trim(), count: Math.max(1, newSubCount || 10) }
    ]);
    setNewSubName('');
    setNewSubCount(10);
  };

  const handleSetKeyOption = (booklet: string, questionIndex: number, option: string) => {
    setExamKeys(prev => {
      const currentList = [...(prev[booklet] || Array(totalExamQuestions).fill(''))];
      while (currentList.length < totalExamQuestions) {
        currentList.push('');
      }
      currentList[questionIndex] = option;
      return {
        ...prev,
        [booklet]: currentList
      };
    });
  };

  const handleApplyQuickKey = () => {
    if (!quickKeyInput.trim()) return;
    const cleanChars = quickKeyInput.toUpperCase().replace(/[^A-E]/g, '').split('');
    if (cleanChars.length === 0) return;
    setExamKeys(prev => {
      const currentList = [...(prev[activeKeyBooklet] || Array(totalExamQuestions).fill(''))];
      while (currentList.length < totalExamQuestions) {
        currentList.push('');
      }
      cleanChars.forEach((ch, idx) => {
        if (idx < totalExamQuestions) {
          currentList[idx] = ch;
        }
      });
      return {
        ...prev,
        [activeKeyBooklet]: currentList
      };
    });
    setQuickKeyInput('');
  };

  const handleClearBookletKeys = (booklet: string) => {
    setExamKeys(prev => ({
      ...prev,
      [booklet]: Array(totalExamQuestions).fill('')
    }));
  };

  // Unique classes compiled from students & results
  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    state.students.forEach(s => {
      if (s.className) classes.add(s.className.trim());
    });
    state.results.forEach(r => {
      if (r.studentClass) classes.add(r.studentClass.trim());
    });
    return Array.from(classes).sort();
  }, [state.students, state.results]);

  // Unique grade levels compiled from uniqueClasses
  const availableGradeLevels = useMemo(() => {
    const levels = new Set<string>();
    uniqueClasses.forEach(cls => {
      const match = cls.trim().match(/^(\d+)/);
      if (match) {
        levels.add(match[1]);
      } else {
        levels.add('Diğer');
      }
    });
    return Array.from(levels).sort((a, b) => {
      if (a === 'Diğer') return 1;
      if (b === 'Diğer') return -1;
      return parseInt(a) - parseInt(b);
    });
  }, [uniqueClasses]);

  // Unique publishers compiled from exams
  const availablePublishers = useMemo(() => {
    const pubMap = new Map<string, string>(); // normalized -> display name

    state.exams.forEach(e => {
      if (e.publisher && e.publisher.trim()) {
        const trimmed = e.publisher.trim();
        const normKey = normalizeForSearch(trimmed);
        if (normKey && !pubMap.has(normKey)) {
          pubMap.set(normKey, trimmed);
        }
      }
    });

    return Array.from(pubMap.values()).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [state.exams]);

  // Sort and filter exams
  const filteredAndSortedExams = useMemo(() => {
    let result = [...state.exams];
    
    // Arama filtresi
    if (searchQuery.trim()) {
      const q = normalizeForSearch(searchQuery);
      result = result.filter(e => 
        normalizeForSearch(e.name || '').includes(q) || 
        normalizeForSearch(e.publisher || '').includes(q) ||
        (e.date && e.date.includes(searchQuery.trim())) ||
        (e.no && e.no.toString().includes(searchQuery.trim()))
      );
    }

    // Katılan sınıf seviyesine göre filtrele (Çoklu Seçim)
    if (!selectedGrades.includes('Tümü') && selectedGrades.length > 0) {
      result = result.filter(e => {
        const grades = e.participatingClasses || [];
        if (grades.length > 0) {
          return grades.some(g => selectedGrades.includes(g));
        }
        // Eğer sınav kartında sınıf seçimi yapılmamışsa, sınav adında geçen seviyeyi kontrol et
        if (e.name) {
          const norm = e.name.toLowerCase();
          return selectedGrades.some(g => 
            norm.includes(`${g}. sınıf`) || norm.includes(`${g}.sınıf`) || norm.includes(`${g}/`)
          );
        }
        return false;
      });
    }

    // Yayıncı adına göre filtrele (Sadece deneme sınavında girilen yayıncı adı bilgisi)
    if (filterPublisher !== 'Tümü') {
      const targetNorm = normalizeForSearch(filterPublisher);
      result = result.filter(e => {
        if (!e || !e.publisher) return false;
        const pubNorm = normalizeForSearch(e.publisher.trim());
        return pubNorm === targetNorm || pubNorm.includes(targetNorm) || targetNorm.includes(pubNorm);
      });
    }

    // Tarihe göre sırala
    const parseDate = (dateStr: string) => {
       if (!dateStr) return 0;
       
       const clean = dateStr.trim();
       
       // Handle standard DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
       const delimiterMatch = clean.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
       if (delimiterMatch) {
         const day = parseInt(delimiterMatch[1], 10);
         const month = parseInt(delimiterMatch[2], 10);
         let year = parseInt(delimiterMatch[3], 10);
         if (year < 100) year += 2000;
         if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month - 1, day).getTime();
         }
       }
       
       // Handle TR natural language dates like "6 Mart 2026 Cuma", "15 Ekim 2025"
       const monthsTR: Record<string, number> = {
         'ocak': 0, 'şubat': 1, 'subat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'mayis': 4,
         'haziran': 5, 'temmuz': 6, 'ağustos': 7, 'agustos': 7, 'eylül': 8, 'eylul': 8,
         'ekim': 9, 'kasım': 10, 'kasim': 10, 'aralık': 11, 'aralik': 11
       };
       const cleanStr = clean.toLowerCase().replace(/[^a-z0-9şğüöçı]/g, ' ');
       const tokens = cleanStr.split(/\s+/).filter(Boolean);
       let day = 1;
       let month = 0;
       let year = 0;
       
       tokens.forEach(token => {
         if (/^\d{1,2}$/.test(token) && parseInt(token, 10) <= 31 && day === 1) {
            day = parseInt(token, 10);
         } else if (/^\d{4}$/.test(token)) {
            year = parseInt(token, 10);
         } else if (monthsTR[token] !== undefined) {
            month = monthsTR[token];
         }
       });
       
       if (year > 0) {
         return new Date(year, month, day).getTime();
       }

       const d = new Date(dateStr);
       return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    result.sort((a, b) => {
      if (sortBy === 'date-asc') {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        // Tarihi olanlar en yakın tarihten en uzak tarihe (kronolojik artan)
        if (dateA > 0 && dateB > 0) {
          if (dateA !== dateB) return dateA - dateB;
          return (a.no || 0) - (b.no || 0);
        }
        // Tarihi girilmiş olanlar önce, tarihi henüz girilmemiş olanlar sonda
        if (dateA > 0 && dateB === 0) return -1;
        if (dateB > 0 && dateA === 0) return 1;
        return (a.no || 0) - (b.no || 0);
      }
      
      if (sortBy === 'date-desc') {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (dateA > 0 && dateB > 0) {
          if (dateA !== dateB) return dateB - dateA;
          return (b.no || 0) - (a.no || 0);
        }
        if (dateA > 0 && dateB === 0) return -1;
        if (dateB > 0 && dateA === 0) return 1;
        return (b.no || 0) - (a.no || 0);
      }
      
      if (sortBy === 'no-asc') {
        return (a.no || 0) - (b.no || 0);
      }
      
      if (sortBy === 'no-desc') {
        return (b.no || 0) - (a.no || 0);
      }
      
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '', 'tr');
      }

      return 0;
    });

    return result;
  }, [state.exams, selectedGrades, filterPublisher, searchQuery, sortBy]);

  const uniquePublishers = useMemo(() => {
    const pubs = new Set<string>();
    filteredAndSortedExams.forEach(e => {
      if (e.publisher) pubs.add(e.publisher.trim());
    });
    return Array.from(pubs).sort();
  }, [filteredAndSortedExams]);

  // Dinamik takvim yazdırma ve önizleme ölçü hesaplamaları (otomatik senkronize)
  const examCount = filteredAndSortedExams.length;
  const isLandscape = printSettings.orientation === 'landscape';
  const isSinglePage = printSettings.pageCount === '1';
  const targetPages = printSettings.pageCount === 'auto' ? 'auto' : parseInt(printSettings.pageCount, 10);

  // Yazı tipi ailesi CSS değeri
  const fontFamilyCss = useMemo(() => {
    switch (printSettings.fontFamily) {
      case 'serif':
        return '"Times New Roman", Times, Georgia, "Cambria", serif';
      case 'mono':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
      case 'sans':
      default:
        return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    }
  }, [printSettings.fontFamily]);

  const fontWeightCss = useMemo(() => {
    switch (printSettings.fontWeight) {
      case 'light':
        return '300';
      case 'medium':
        return '500';
      case 'semibold':
        return '600';
      case 'bold':
        return '700';
      case 'normal':
      default:
        return '400';
    }
  }, [printSettings.fontWeight]);

  // A4 kullanılabilir sayfa yüksekliği (A4: 297mm dikey, 210mm yatay; 4mm üst-alt marjinler ile)
  // Dikey: 297 - 8 = 289mm
  // Yatay: 210 - 8 = 202mm
  const pageHeightMm = isLandscape ? 202 : 289;

  // Başlık yükseklik ve punto hesaplaması (1 sayfa seçeneğinde otomatik optimize edilir)
  const headerLayout = useMemo(() => {
    if (!isSinglePage) {
      return {
        mainTitlePt: isLandscape ? '12.5pt' : '13.5pt',
        subTitlePt: isLandscape ? '9pt' : '9.5pt',
        headerHeightMm: isLandscape ? 12 : 14,
        paddingY: '2px',
        marginBottom: '4px',
      };
    }
    // 1 sayfa seçeneğinde sınav sayısına göre dinamik ölçekleme
    if (examCount > 32) {
      return {
        mainTitlePt: isLandscape ? '10pt' : '11pt',
        subTitlePt: isLandscape ? '7.5pt' : '8pt',
        headerHeightMm: isLandscape ? 8 : 9,
        paddingY: '1px',
        marginBottom: '2px',
      };
    }
    if (examCount > 22) {
      return {
        mainTitlePt: isLandscape ? '11pt' : '12pt',
        subTitlePt: isLandscape ? '8pt' : '8.5pt',
        headerHeightMm: isLandscape ? 9 : 10,
        paddingY: '1.5px',
        marginBottom: '2.5px',
      };
    }
    if (examCount > 12) {
      return {
        mainTitlePt: isLandscape ? '12pt' : '13pt',
        subTitlePt: isLandscape ? '8.5pt' : '9pt',
        headerHeightMm: isLandscape ? 10 : 12,
        paddingY: '2px',
        marginBottom: '3px',
      };
    }
    return {
      mainTitlePt: isLandscape ? '13pt' : '14.5pt',
      subTitlePt: isLandscape ? '9pt' : '10pt',
      headerHeightMm: isLandscape ? 12 : 14,
      paddingY: '2.5px',
      marginBottom: '4px',
    };
  }, [isSinglePage, examCount, isLandscape]);

  // Alt bilgi (Footer) yükseklik ve punto
  const footerLayout = useMemo(() => {
    if (!printSettings.showFooter) return { footerHeightMm: 0, fontSizePt: '6pt' };
    if (isSinglePage && examCount > 28) {
      return { footerHeightMm: 4, fontSizePt: '6.5pt' };
    }
    return { footerHeightMm: 5.5, fontSizePt: '7pt' };
  }, [printSettings.showFooter, isSinglePage, examCount]);

  // Tablo başlığı (thead) yükseklik ve punto
  const theadLayout = useMemo(() => {
    if (isSinglePage && examCount > 25) {
      return { theadHeightMm: 5, theadFontSizePt: '7.5pt', paddingY: '1px' };
    }
    if (isSinglePage && examCount > 16) {
      return { theadHeightMm: 5.5, theadFontSizePt: '8pt', paddingY: '1.5px' };
    }
    return { theadHeightMm: 6.5, theadFontSizePt: isLandscape ? '8.5pt' : '9pt', paddingY: '2px' };
  }, [isSinglePage, examCount, isLandscape]);

  // Kullanılabilir tbody alanı ve optimum satır yüksekliği & punto hesaplaması (30 deneme 1 sayfayı tam dolduracak hassas kalibrasyon)
  const { optimalRowHeightMm, optimalFontSizePt, cellPaddingY, cellPaddingX } = useMemo(() => {
    let baseRowHeight: number;
    let baseFontSizePt: string;
    let padY = '1.8px';
    let padX = '3px';
    const scaleMultiplier = (printSettings.tableScale || 100) / 100;

    if (isSinglePage) {
      const nonTbodyHeight = headerLayout.headerHeightMm + footerLayout.footerHeightMm + theadLayout.theadHeightMm + 2.5;
      const availableTbodyMm = Math.max(50, pageHeightMm - nonTbodyHeight);
      
      // 30 deneme sınavında A4 dikey (289mm) sayfayı boşluksuz tam doldurması için satır yüksekliği:
      const rawRowHeight = examCount > 0 ? (availableTbodyMm / examCount) : 10;
      baseRowHeight = Math.max(3.8, Math.min(isLandscape ? 14 : 18, Math.round(rawRowHeight * 100) / 100));

      if (rawRowHeight >= 12) {
        baseFontSizePt = isLandscape ? '9.5pt' : '10pt';
        padY = '2.5px';
        padX = '4px';
      } else if (rawRowHeight >= 8.4) {
        // 30 sınav burada yer alır (~8.9mm): ferah 8.6pt yazı boyutu ve dengeli dolgu
        baseFontSizePt = isLandscape ? '8.2pt' : '8.6pt';
        padY = '2px';
        padX = '3.5px';
      } else if (rawRowHeight >= 6.8) {
        baseFontSizePt = '7.6pt';
        padY = '1.2px';
        padX = '2.5px';
      } else {
        baseFontSizePt = '6.6pt';
        padY = '0.8px';
        padX = '2px';
      }
    } else {
      // 2 Sayfa veya Otomatik
      baseRowHeight = isLandscape ? 8.5 : 10;
      baseFontSizePt = isLandscape ? '9pt' : '9.5pt';
      padY = '2px';
      padX = '4px';
    }

    // Kullanıcı elle fontScale seçtiyse hafif ölçekle
    if (printSettings.fontScale === 'compact') {
      const num = parseFloat(baseFontSizePt);
      baseFontSizePt = `${Math.max(5.5, Math.round((num - 0.7) * 10) / 10)}pt`;
      padY = '1px';
    } else if (printSettings.fontScale === 'spacious') {
      const num = parseFloat(baseFontSizePt);
      baseFontSizePt = `${Math.min(14, Math.round((num + 0.8) * 10) / 10)}pt`;
      padY = '3px';
    }

    // Kullanıcı Tablo Büyütme / Küçültme (tableScale) çarpanını uygula:
    const scaledRowHeight = Math.max(3.5, Math.round(baseRowHeight * scaleMultiplier * 100) / 100);
    const scaledFontSizeNum = Math.max(5, Math.min(16, Math.round(parseFloat(baseFontSizePt) * scaleMultiplier * 10) / 10));
    const scaledPadYNum = Math.max(0.5, Math.min(8, Math.round(parseFloat(padY) * scaleMultiplier * 10) / 10));

    return {
      optimalRowHeightMm: scaledRowHeight,
      optimalFontSizePt: `${scaledFontSizeNum}pt`,
      cellPaddingY: `${scaledPadYNum}px`,
      cellPaddingX: padX,
    };
  }, [isSinglePage, examCount, pageHeightMm, headerLayout, footerLayout, theadLayout, isLandscape, printSettings.fontScale, printSettings.tableScale]);

  const maxPageHeightPx = isLandscape ? 740 : 1070;

  const handleDownloadPdf = async () => {
    setIsPdfGenerating(true);
    try {
      const scaleMultiplier = (printSettings.tableScale || 100) / 100;
      const dateColWidth = isLandscape 
        ? Math.max(132, Math.round(136 * scaleMultiplier)) 
        : Math.max(124, Math.round(126 * scaleMultiplier));

      const widths: any[] = [];
      widths.push(isLandscape ? 40 : 36); // ÖLÇME (Genişletilmiş ve ferah)
      widths.push(dateColWidth); // TARİH (En büyük puntoda bile tek satırda taşmadan gösterilir)
      widths.push('*'); // SINAV ADI
      if (printSettings.showOrderQuantity) widths.push(42);
      if (printSettings.showHalls) widths.push(75);
      if (printSettings.showParticipants) widths.push(48);

      let tableFontSize = isLandscape ? 8.5 : 8.5;
      let headerFontSize = isLandscape ? 9 : 9.0;
      let cellPadV = 3.5;

      if (isSinglePage) {
        // A4 dikey (842pt) veya yatay (595pt) toplam alanı 30 sınavda 1 sayfayı tam dolduracak şekilde dağıt
        const totalPagePt = isLandscape ? 595 : 842;
        const pageMarginV = examCount > 25 ? 24 : 32;
        const headerFooterPt = (printSettings.showFooter ? 24 : 10) + (isLandscape ? 36 : 46);
        const availableTablePt = totalPagePt - pageMarginV - headerFooterPt;
        const targetRowHeightPt = examCount > 0 ? (availableTablePt / (examCount + 1)) : 22;

        if (targetRowHeightPt >= 22) {
          // 30 sınav burada yer alır: ~24.5pt hedef satır yüksekliğiyle sayfayı tam doldurur
          tableFontSize = isLandscape ? 8.2 : 8.6;
          headerFontSize = isLandscape ? 8.8 : 9.2;
          cellPadV = Math.max(2, Math.round(((targetRowHeightPt - tableFontSize * 1.15) / 2 - 0.4) * 10) / 10);
        } else if (targetRowHeightPt >= 17) {
          tableFontSize = 7.8;
          headerFontSize = 8.4;
          cellPadV = Math.max(1.8, Math.round(((targetRowHeightPt - tableFontSize * 1.15) / 2 - 0.4) * 10) / 10);
        } else if (targetRowHeightPt >= 13) {
          tableFontSize = 7.2;
          headerFontSize = 7.8;
          cellPadV = Math.max(1.2, Math.round(((targetRowHeightPt - tableFontSize * 1.15) / 2 - 0.3) * 10) / 10);
        } else {
          tableFontSize = 6.2;
          headerFontSize = 6.8;
          cellPadV = Math.max(0.6, Math.round(((targetRowHeightPt - tableFontSize * 1.15) / 2 - 0.3) * 10) / 10);
        }
      }

      if (printSettings.fontScale === 'compact') {
        tableFontSize = Math.max(5.5, tableFontSize - 0.7);
        headerFontSize = Math.max(6, headerFontSize - 0.7);
      } else if (printSettings.fontScale === 'spacious') {
        tableFontSize = Math.min(13, tableFontSize + 0.8);
        headerFontSize = Math.min(13.5, headerFontSize + 0.8);
      }

      // Tablo Büyütme / Küçültme (tableScale: 60 - 160) çarpanını uygula
      tableFontSize = Math.max(5, Math.min(15, Math.round(tableFontSize * scaleMultiplier * 10) / 10));
      headerFontSize = Math.max(5.5, Math.min(16, Math.round(headerFontSize * scaleMultiplier * 10) / 10));
      cellPadV = Math.max(0.6, Math.min(14, Math.round(cellPadV * scaleMultiplier * 10) / 10));

      const isLightMode = printSettings.fontWeight === 'light';
      const isBoldMode = printSettings.fontWeight === 'bold' || printSettings.fontWeight === 'semibold';

      const headerRow: any[] = [
        { text: 'ÖLÇME', style: 'tableHeader', fontSize: headerFontSize },
        { text: 'TARİH', style: 'tableHeader', fontSize: headerFontSize },
        { text: 'SINAV ADI / YAYIN', style: 'tableHeader', fontSize: headerFontSize, alignment: 'left' },
      ];
      if (printSettings.showOrderQuantity) {
        headerRow.push({ text: 'SİPARİŞ', style: 'tableHeader', fontSize: headerFontSize });
      }
      if (printSettings.showHalls) {
        headerRow.push({ text: 'SALONLAR', style: 'tableHeader', fontSize: headerFontSize });
      }
      if (printSettings.showParticipants) {
        headerRow.push({ text: 'KATILAN', style: 'tableHeader', fontSize: headerFontSize });
      }

      const tableBody: any[][] = [headerRow];

      filteredAndSortedExams.forEach((exam, idx) => {
        const pubName = (exam.publisher || '').trim();
        const colorInfo = getPublisherColorInfo(pubName, publisherColors);
        const fillHex = colorInfo.hex;
        const isFullRow = printSettings.colorMode === 'fullRow';

        const row: any[] = [];

        // Col 1: Ölçme No
        row.push({
          text: String(exam.no || (idx + 1)),
          alignment: 'center',
          bold: !isLightMode,
          fontSize: tableFontSize,
          fillColor: isFullRow ? fillHex : '#ffffff',
        });

        // Col 2: Tarih
        const formattedDate = exam.date ? (formatDateLong(exam.date) || exam.date) : '-';
        row.push({
          text: formattedDate,
          alignment: 'center',
          bold: !isLightMode,
          fontSize: tableFontSize,
          fillColor: isFullRow ? fillHex : '#ffffff',
          noWrap: true,
        });

        // Col 3: Sınav Adı + Yayıncı (Seçilen yayıncı rengi tam uygulanır)
        const nameParts: any[] = [
          { text: (exam.name || 'Deneme Sınavı'), bold: !isLightMode, color: '#111827' }
        ];
        if (printSettings.showPublisher && exam.publisher) {
          nameParts.push({ text: ` [${exam.publisher}]`, bold: false, color: '#4b5563' });
        }
        row.push({
          text: nameParts,
          alignment: 'left',
          fontSize: tableFontSize,
          fillColor: fillHex,
        });

        // Col 4: Sipariş
        if (printSettings.showOrderQuantity) {
          row.push({
            text: String(exam.orderQuantity || 0),
            alignment: 'center',
            bold: !isLightMode,
            fontSize: tableFontSize,
            fillColor: isFullRow ? fillHex : '#ffffff',
          });
        }

        // Col 5: Salonlar
        if (printSettings.showHalls) {
          const hallCount = exam.assignedHalls?.length || 0;
          const hallText = hallCount > 0 ? `${hallCount} Salon` : 'Tüm Salonlar';
          row.push({
            text: hallText,
            alignment: 'center',
            fontSize: Math.max(6, tableFontSize - 1),
            fillColor: isFullRow ? fillHex : '#ffffff',
          });
        }

        // Col 6: Katılan
        if (printSettings.showParticipants) {
          row.push({
            text: String(exam.participantCount || 0),
            alignment: 'center',
            bold: true,
            fontSize: tableFontSize,
            fillColor: '#dc2626',
            color: '#ffffff',
          });
        }

        tableBody.push(row);
      });

      const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: isLandscape ? 'landscape' : 'portrait',
        pageMargins: isSinglePage 
          ? (examCount > 25 ? [15, 12, 15, 12] : [20, 16, 20, 16]) 
          : [25, 20, 25, 20],
        content: [
          {
            text: (printMainTitle || 'KIRKLARELİ ATATÜRK ORTAOKULU').toLocaleUpperCase('tr-TR'),
            style: 'docHeaderMain',
            alignment: 'center',
            fontSize: isSinglePage ? (examCount > 25 ? 12 : 14) : 15,
          },
          {
            text: (printSubTitle || '2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ').toLocaleUpperCase('tr-TR'),
            style: 'docHeaderSub',
            alignment: 'center',
            fontSize: isSinglePage ? (examCount > 25 ? 8 : 9.5) : 10.5,
            margin: [0, 2, 0, isSinglePage && examCount > 25 ? 4 : 8],
          },
          {
            table: {
              headerRows: 1,
              dontBreakRows: isSinglePage,
              widths,
              body: tableBody,
            },
            layout: {
              hLineWidth: () => 0.8,
              vLineWidth: () => 0.8,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
              paddingLeft: () => 3,
              paddingRight: () => 3,
              paddingTop: () => cellPadV,
              paddingBottom: () => cellPadV,
            },
          },
        ],
        footer: printSettings.showFooter ? (currentPage: number, pageCountTotal: number) => ({
          text: `${printSettings.footerText || printMainTitle || 'Kırklareli Atatürk Ortaokulu Sınav Koordinatörlüğü'} • Toplam ${examCount} Sınav • Basım Tarihi: ${new Date().toLocaleDateString('tr-TR')} • Sayfa ${currentPage} / ${pageCountTotal}`,
          alignment: 'center',
          fontSize: 7,
          color: '#4b5563',
          margin: [0, 4, 0, 0],
        }) : undefined,
        styles: {
          docHeaderMain: {
            bold: true,
            color: '#111827',
            lineHeight: 1.1,
          },
          docHeaderSub: {
            bold: true,
            color: '#374151',
            lineHeight: 1.1,
          },
          tableHeader: {
            bold: true,
            fillColor: '#e5e7eb',
            color: '#000000',
            lineHeight: 1.1,
          },
        },
        defaultStyle: {
          font: 'Roboto',
        },
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const cleanSchool = (printMainTitle || 'Sinav')
        .replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/g, '_')
        .replace(/_+/g, '_');
      const fileName = `${cleanSchool}_Sinav_Takvimi_${dateStr}.pdf`;
      pdfMake.createPdf(docDefinition).download(fileName);
      setSaveFeedback('✓ Aranabilir Türkçe PDF başarıyla indirildi!');
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
      setSaveFeedback('❌ PDF oluşturulurken hata oluştu.');
      setTimeout(() => setSaveFeedback(null), 3000);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    // In sandboxed iframe environments (like AI Studio preview), browser security blocks modal dialogs (print, alert)
    // Always provide the print-ready PDF directly so printing never fails.
    if (isInIframe) {
      setSaveFeedback('✓ Önizleme ortamı kısıtlaması nedeniyle takvim baskıya hazır PDF olarak indirildi. Dosyayı açıp doğrudan yazdırabilirsiniz.');
      handleDownloadPdf();
      try {
        window.print();
      } catch {}
      setIsPrinting(false);
      setTimeout(() => setSaveFeedback(null), 5000);
      return;
    }

    setSaveFeedback('✓ Yazdırma sayfası hazırlanıyor...');

    const printContent = document.getElementById('print-area-takvim');
    if (!printContent) {
      try {
        window.print();
      } catch {
        handleDownloadPdf();
      }
      setIsPrinting(false);
      return;
    }
    
    try {
      // Offscreen rendered iframe (opacity: 0 and real dimensions prevent Chromium from ignoring print() on unrendered frame)
      let printFrame = document.getElementById('takvim-print-iframe') as HTMLIFrameElement | null;
      if (printFrame) {
        try {
          printFrame.remove();
        } catch {}
      }
      printFrame = document.createElement('iframe');
      printFrame.id = 'takvim-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.left = '-99999px';
      printFrame.style.top = '0';
      printFrame.style.width = isLandscape ? '297mm' : '210mm';
      printFrame.style.height = isLandscape ? '210mm' : '297mm';
      printFrame.style.border = 'none';
      printFrame.style.opacity = '0';
      printFrame.style.pointerEvents = 'none';
      printFrame.style.zIndex = '-99999';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (!frameDoc) {
        try {
          window.print();
        } catch {
          handleDownloadPdf();
        }
        setIsPrinting(false);
        return;
      }

      const tableHtml = document.querySelector('#print-area-takvim .takvim-table-wrapper')?.innerHTML || '';

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Deneme Sınavları Takvimi - ${printMainTitle || 'Kırklareli Atatürk Ortaokulu'}</title>
            <style>
              @page {
                size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                margin: 4mm 6mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100%;
                ${isSinglePage ? 'height: 100%; max-height: 100vh; overflow: hidden;' : ''}
                background-color: #ffffff;
                color: #000000;
                font-family: ${fontFamilyCss};
              }
              .takvim-page-wrapper {
                width: 100%;
                ${isSinglePage ? `height: ${isLandscape ? '202mm' : '289mm'}; max-height: ${isLandscape ? '202mm' : '289mm'}; overflow: hidden; page-break-inside: avoid; break-inside: avoid; justify-content: space-between;` : ''}
                margin: 0 auto;
                padding: 0;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
              }
              .takvim-header {
                flex-shrink: 0;
                text-align: center;
                margin-bottom: ${headerLayout.marginBottom};
                padding-bottom: ${headerLayout.paddingY};
                border-bottom: 1.5px solid #000000;
              }
              .takvim-title-main {
                font-size: ${headerLayout.mainTitlePt};
                font-weight: 900;
                text-transform: uppercase;
                margin: 0 0 1px 0;
                line-height: 1.15;
                letter-spacing: 0.3px;
                color: #111827;
              }
              .takvim-title-sub {
                font-size: ${headerLayout.subTitlePt};
                font-weight: 800;
                text-transform: uppercase;
                color: #374151;
                line-height: 1.15;
                margin: 0;
              }
              .takvim-table-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                width: 100%;
                ${isSinglePage ? 'height: 100%; min-height: 0; overflow: hidden;' : ''}
              }
              table.takvim-table {
                width: 100%;
                ${isSinglePage ? 'height: 100%;' : ''}
                border-collapse: collapse;
                border: 1.5px solid #000000;
                table-layout: fixed;
              }
              table.takvim-table thead tr {
                height: ${theadLayout.theadHeightMm}mm;
              }
              table.takvim-table th {
                border: 1.5px solid #000000;
                background-color: #e5e7eb !important;
                font-weight: ${printSettings.fontWeight === 'light' ? '600' : '800'};
                font-size: ${theadLayout.theadFontSizePt};
                line-height: 1.1;
                padding: ${theadLayout.paddingY} 3px;
                text-align: center;
                vertical-align: middle;
              }
              table.takvim-table tbody {
                ${isSinglePage ? 'height: calc(100% - 24px);' : ''}
              }
              table.takvim-table tbody tr {
                height: ${optimalRowHeightMm}mm;
                min-height: ${optimalRowHeightMm}mm;
                ${isSinglePage ? 'page-break-inside: avoid; break-inside: avoid;' : ''}
              }
              table.takvim-table td {
                border: 1.5px solid #000000;
                padding: ${cellPaddingY} ${cellPaddingX};
                text-align: center;
                vertical-align: middle;
                font-size: ${optimalFontSizePt};
                font-weight: ${fontWeightCss};
                line-height: 1.15;
              }
              td.col-no {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-weight: ${printSettings.fontWeight === 'light' ? '500' : '700'};
                font-size: ${optimalFontSizePt};
                width: ${isLandscape ? '40px' : '44px'};
              }
              td.col-date {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-weight: ${printSettings.fontWeight === 'light' ? '400' : '600'};
                font-size: ${optimalFontSizePt};
                white-space: nowrap;
                width: ${isLandscape ? '145px' : '155px'};
                padding: ${cellPaddingY} 3px;
              }
              td.col-name {
                text-align: left;
                padding-left: 6px;
                padding-right: 4px;
                font-weight: ${printSettings.fontWeight === 'light' ? '400' : printSettings.fontWeight === 'normal' ? '500' : printSettings.fontWeight === 'medium' ? '600' : '700'};
                font-size: ${optimalFontSizePt};
                line-height: 1.2;
                color: #1e1b4b;
              }
              td.col-order {
                font-weight: ${printSettings.fontWeight === 'light' ? '500' : '700'};
                font-size: ${optimalFontSizePt};
                width: ${isLandscape ? '46px' : '50px'};
              }
              td.col-halls {
                font-size: ${optimalFontSizePt};
                line-height: 1.1;
                width: ${isLandscape ? '95px' : '105px'};
              }
              td.col-participants {
                background-color: #dc2626 !important;
                color: #ffffff !important;
                font-weight: 800;
                font-size: ${optimalFontSizePt};
                width: ${isLandscape ? '55px' : '60px'};
              }
              .takvim-footer {
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 1.5px;
                margin-top: 2px;
                border-top: 1px solid #000000;
                font-size: ${footerLayout.fontSizePt};
                font-weight: ${fontWeightCss};
                color: #374151;
              }
              
              /* Publisher Background Colors */
              .bg-gray-100 { background-color: #f3f4f6 !important; }
              .bg-yellow-100 { background-color: #fef9c3 !important; }
              .bg-orange-100 { background-color: #ffedd5 !important; }
              .bg-red-100 { background-color: #fee2e2 !important; }
              .bg-rose-100 { background-color: #ffe4e6 !important; }
              .bg-purple-100 { background-color: #f3e8ff !important; }
              .bg-blue-100 { background-color: #dbeafe !important; }
              .bg-cyan-100 { background-color: #cffafe !important; }
              .bg-teal-100 { background-color: #ccfbf1 !important; }
              .bg-emerald-100 { background-color: #d1fae5 !important; }
              .bg-green-100 { background-color: #dcfce7 !important; }
              .bg-lime-100 { background-color: #ecfccb !important; }
              .bg-amber-100 { background-color: #fef3c7 !important; }
              .bg-indigo-100 { background-color: #e0e7ff !important; }
              .bg-fuchsia-100 { background-color: #fae8ff !important; }
              
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                }
                ${isSinglePage ? `
                .takvim-page-wrapper {
                  height: ${isLandscape ? '202mm' : '289mm'};
                  max-height: ${isLandscape ? '202mm' : '289mm'};
                  overflow: hidden !important;
                }
                ` : ''}
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div id="takvim-print-wrapper" class="takvim-page-wrapper">
              <div class="takvim-header">
                <h2 class="takvim-title-main">${printMainTitle || 'KIRKLARELİ ATATÜRK ORTAOKULU'}</h2>
                <p class="takvim-title-sub">${printSubTitle || '2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ'}</p>
              </div>
              <div class="takvim-table-wrapper">
                ${tableHtml}
              </div>
              ${printSettings.showFooter ? `
              <div class="takvim-footer">
                <span>${printSettings.footerText || (printMainTitle ? `${printMainTitle} Sınav Koordinatörlüğü` : 'Kırklareli Atatürk Ortaokulu Sınav Koordinatörlüğü')}</span>
                <span>Basım Tarihi: ${new Date().toLocaleDateString('tr-TR')} • Toplam: ${examCount} Sınav</span>
              </div>
              ` : ''}
            </div>
            <script>
              function ensureFit() {
                var wrapper = document.getElementById('takvim-print-wrapper');
                if (!wrapper) return;
                var isOnePage = ${isSinglePage};
                if (isOnePage) {
                  var maxHeightPx = ${maxPageHeightPx};
                  var currentHeight = wrapper.offsetHeight || wrapper.scrollHeight;
                  if (currentHeight > maxHeightPx) {
                    var ratio = Math.floor((maxHeightPx / currentHeight) * 100) / 100;
                    wrapper.style.transform = 'scale(' + Math.max(0.65, ratio) + ')';
                    wrapper.style.transformOrigin = 'top center';
                  }
                }
              }
              window.onload = function() {
                ensureFit();
              };
            </script>
          </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        setIsPrinting(false);
        let triggered = false;
        try {
          if (printFrame?.contentWindow) {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
            triggered = true;
            setSaveFeedback('✓ Yazdırma iletişim kutusu açıldı.');
            setTimeout(() => setSaveFeedback(null), 3000);
          }
        } catch (err) {
          console.warn('Iframe print error:', err);
        }

        if (!triggered) {
          try {
            window.print();
            setSaveFeedback('✓ Yazdırma başlatıldı.');
            setTimeout(() => setSaveFeedback(null), 3000);
          } catch (err2) {
            console.warn('Window print error, falling back to PDF:', err2);
            setSaveFeedback('ℹ️ Tarayıcı kısıtlaması nedeniyle takvim PDF olarak indiriliyor...');
            handleDownloadPdf();
          }
        }
      }, 300);
    } catch (err) {
      console.warn('Print process failed:', err);
      setIsPrinting(false);
      try {
        window.print();
      } catch {
        setSaveFeedback('ℹ️ Yazdırma açılamadı, PDF olarak indiriliyor...');
        handleDownloadPdf();
      }
    }
  };

  // Query actual results matching this specific exam
  const originalExamName = editingExam ? editingExam.name : '';
  const examResults = useMemo(() => {
    if (!originalExamName) return [];
    return state.results.filter(r => r.scores[originalExamName] !== undefined);
  }, [state.results, originalExamName]);

  // Calculate stats for these results
  const resultStats = useMemo(() => {
    if (examResults.length === 0) return null;
    const scores = examResults.map(r => r.scores[originalExamName]);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / examResults.length;
    return { count: examResults.length, max, min, avg };
  }, [examResults, originalExamName]);

  // Filter exam results list inside modal
  const filteredExamResults = useMemo(() => {
    return examResults.filter(r => {
      const query = normalizeForSearch(resultsSearchQuery);
      return normalizeForSearch(r.studentName).includes(query) || r.studentNo.toString().includes(resultsSearchQuery);
    });
  }, [examResults, resultsSearchQuery]);

  // Eligible students for manual score entry (students in participating classes who don't have a score)
  const eligibleStudentsForManualScore = useMemo(() => {
    if (selectedClasses.length === 0) return [];
    return state.students.filter(s => {
      const studentGrade = s.className ? (s.className.trim().match(/^(\d+)/)?.[1] || 'Diğer') : 'Diğer';
      return selectedClasses.includes(studentGrade) && 
             !examResults.some(r => r.studentNo === s.no);
    }).sort((a, b) => a.no - b.no);
  }, [state.students, selectedClasses, examResults]);

  // Import mock exams list from main dashboard Excel
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFromExcel(file, (data) => {
        const newExams: Exam[] = data.map((row: any) => ({
          id: generateId(),
          no: parseInt(row['ÖLÇME'] || row['ölçme'] || row['No'] || '0'),
          date: row['TARİH'] || row['Tarih'] || row['date'] || '',
          name: row['8. SINIF'] || row['8. Sınıf'] || row['Deneme'] || '',
          participantCount: parseInt(row['KATILAN KİŞİ'] || row['Katılan Kişi'] || '0'),
          publisher: row['Yayıncı'] || row['YAYINCI'] || '',
          publisherFee: parseFloat(row['Ücret'] || row['ÜCRET'] || '0') || 0,
          orderQuantity: parseInt(row['Sipariş'] || row['SİPARİŞ'] || '0') || 0,
          participatingClasses: [],
          assignedHalls: []
        }));
        setExams([...state.exams, ...newExams]);
      });
    }
  };

  // Export mock exams to Excel
  const handleExport = () => {
    const dataToExport = state.exams.map(e => ({
      'ÖLÇME': e.no,
      'TARİH': e.date,
      'SINAV ADI': e.name,
      'YAYINCI': e.publisher || '',
      'YAYINCI ÜCRETİ': e.publisherFee || 0,
      'SİPARİŞ MİKTARI': e.orderQuantity || 0,
      'TOPLAM GİDER': (e.publisherFee || 0) * (e.orderQuantity || 0),
      'KATILAN KİŞİ': e.participantCount,
      'KATILACAK SINIFLAR': (e.participatingClasses || []).map(g => g === 'Diğer' ? 'Diğer Sınıflar' : `${g}. Sınıf`).join(', ')
    }));
    exportToExcel(dataToExport, 'deneme_sinavlari_detayli');
  };

  // Add a brand-new blank exam
  const addEmptyExam = () => {
    const maxNo = state.exams.reduce((max, e) => Math.max(max, e.no || 0), 0);
    const nextNo = maxNo > 0 ? maxNo + 1 : state.exams.length + 1;
    const newExam: Exam = { 
      id: generateId(), 
      no: nextNo, 
      date: '', 
      name: `Yeni Deneme Sınavı ${nextNo}`, 
      examType: 'publisher',
      participantCount: 0,
      publisher: '',
      publisherFee: 0,
      orderQuantity: 0,
      participatingClasses: [],
      assignedHalls: [],
      optionsCount: 4,
      penalty: 3,
      layoutType: 'split',
      format: 'lgs',
      subjects: [
        { id: 1, name: "Türkçe", count: 20, section: 1 },
        { id: 2, name: "T.C. İnkılap", count: 10, section: 1 },
        { id: 3, name: "Din Kültürü", count: 10, section: 1 },
        { id: 4, name: "İngilizce", count: 10, section: 1 },
        { id: 5, name: "Matematik", count: 20, section: 2 },
        { id: 6, name: "Fen Bilimleri", count: 20, section: 2 }
      ],
      keys: { A: Array(90).fill(''), B: Array(90).fill('') }
    };
    setExams([...state.exams, newExam]);
    setEditingExam(newExam);
  };

  // Quick edit directly in the table row
  const updateExam = (id: string, field: keyof Exam, value: string | number) => {
    setExams(state.exams.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  // Remove mock exam
  const removeExam = (id: string) => {
    setExams(state.exams.filter(e => e.id !== id));
  };

  const syncExamNameInResults = (oldName: string, newName: string) => {
    const updatedResults = state.results.map(r => {
      let scoresChanged = false;
      let detailsChanged = false;
      const newScores = { ...r.scores };
      let newDetails = r.details ? { ...r.details } : undefined;

      if (newScores[oldName] !== undefined) {
        newScores[newName] = newScores[oldName];
        delete newScores[oldName];
        scoresChanged = true;
      }

      if (newDetails && newDetails[oldName] !== undefined) {
        newDetails[newName] = newDetails[oldName];
        delete newDetails[oldName];
        detailsChanged = true;
      }

      if (scoresChanged || detailsChanged) {
        const values = Object.values(newScores) as number[];
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return {
          ...r,
          scores: newScores,
          details: newDetails,
          average
        };
      }
      return r;
    });
    setResults(updatedResults);
  };

  // Save changes from the details modal
  const handleSaveChanges = () => {
    if (!examName.trim()) {
      alert("Lütfen sınav adı giriniz.");
      return;
    }

    const oldName = editingExam!.name;
    const newName = examName.trim();

    // 1. Update the exam inside state.exams
    const updatedExams = state.exams.map(e => {
      if (e.id === editingExam!.id) {
        return {
          ...e,
          examType,
          no: examNo,
          date: formatDateShort(examDate) || examDate.trim(),
          name: newName,
          participantCount: examParticipantCount || examResults.length,
          publisher: examType === 'publisher' ? examPublisher.trim() : (examPublisher.trim() || 'Kurum İçi'),
          publisherFee: examType === 'publisher' ? examPublisherFee : 0,
          orderQuantity: examType === 'publisher' ? examOrderQuantity : 0,
          gradeOrderQuantities: examType === 'publisher' ? examGradeOrderQuantities : {},
          participatingClasses: selectedClasses,
          assignedHalls: selectedHalls,
          optionsCount: examOptionsCount,
          penalty: examPenalty,
          layoutType: examLayoutType,
          format: examFormat,
          subjects: examSubjects,
          keys: examKeys
        };
      }
      return e;
    });
    setExams(updatedExams);

    // 2. Results key name sync
    if (oldName !== newName) {
      syncExamNameInResults(oldName, newName);
    }

    setEditingExam(null);
    alert(`"${newName}" sınavı detayları başarıyla kaydedildi ve bütçe, sonuçlar, sınıflar ve salonlarla senkronize edildi!`);
  };

  // Inside modal: update a student's score inline
  const handleUpdateScoreInModal = (resultId: string, newScoreStr: string) => {
    const score = parseFloat(newScoreStr) || 0;
    setResults(state.results.map(r => {
      if (r.id === resultId) {
        const newScores = { ...r.scores, [originalExamName]: score };
        const values = Object.values(newScores) as number[];
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return { ...r, scores: newScores, average };
      }
      return r;
    }));
  };

  // Inside modal: delete a student's score for this exam
  const handleDeleteScoreInModal = (resultId: string) => {
    setResults(state.results.map(r => {
      if (r.id === resultId) {
        const newScores = { ...r.scores };
        delete newScores[originalExamName];
        
        const newDetails = r.details ? { ...r.details } : undefined;
        if (newDetails) {
          delete newDetails[originalExamName];
        }

        const values = Object.values(newScores) as number[];
        const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return { ...r, scores: newScores, details: newDetails, average };
      }
      return r;
    }));
  };

  // Inside modal: add manual student score
  const handleAddManualScore = () => {
    if (!manualStudentId) {
      alert("Lütfen öğrenci seçiniz.");
      return;
    }
    const scoreVal = parseFloat(manualStudentScore);
    if (isNaN(scoreVal)) {
      alert("Lütfen geçerli bir puan giriniz.");
      return;
    }

    const student = state.students.find(s => s.id === manualStudentId);
    if (!student) return;

    const existingResultIndex = state.results.findIndex(r => r.studentNo === student.no);
    let updatedResults = [...state.results];

    if (existingResultIndex !== -1) {
      const r = updatedResults[existingResultIndex];
      const newScores = { ...r.scores, [originalExamName]: scoreVal };
      const values = Object.values(newScores) as number[];
      const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

      updatedResults[existingResultIndex] = {
        ...r,
        scores: newScores,
        average
      };
    } else {
      updatedResults.push({
        id: generateId(),
        studentId: student.id,
        studentNo: student.no,
        studentName: student.name,
        studentClass: student.className,
        scores: { [originalExamName]: scoreVal },
        average: scoreVal
      });
    }

    setResults(updatedResults);
    setManualStudentId('');
    setManualStudentScore('');
    alert(`${student.name} için ${scoreVal} puanı sınav sonuçlarına kaydedildi.`);
  };

  // Inside modal: upload Excel scores sheet
  const handleUploadResultsForExam = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingExam) {
      const examNameKey = editingExam.name;
      importFromExcel(file, (data) => {
        let updatedResults = [...state.results];
        let importedCount = 0;

        data.forEach((rawRow: any) => {
          const row: any = {};
          Object.keys(rawRow).forEach(k => {
            row[k.toString().trim().toUpperCase()] = rawRow[k];
          });

          let studentNo = parseInt(row['NO'] || row['ÖĞRENCİ NO'] || row['ÖĞR. NO'] || row['ÖĞR.NO'] || row['NUMARA'] || row['ÖĞRENCİ NUMARASI'] || '0');
          
          const name = (row['ADI SOYADI'] || row['ADI'] || row['SOYADI'] || row['AD SOYAD'] || row['İSİM'] || row['NAME'] || '').toString().trim();
          const className = (row['SINIFI'] || row['SINIF'] || row['ŞUBE'] || row['CLASS'] || '').toString().trim();
          
          let existingSystemStudent = state.students.find(s => s.no === studentNo && studentNo !== 0);
          
          if (!existingSystemStudent && name) {
             existingSystemStudent = state.students.find(s => s.name.toLowerCase() === name.toLowerCase());
             if (existingSystemStudent) {
                 studentNo = existingSystemStudent.no;
             }
          }
          
          if (!studentNo && !name) return;

          // Puan lookup in row keys
          let score = 0;
          const scoreKeys = ['PUAN', 'Puan', 'puan', 'SCORE', 'Score', 'Skor', 'SKOR', examNameKey];
          for (const key of scoreKeys) {
            if (row[key] !== undefined) {
              score = parseFloat(row[key]) || 0;
              break;
            }
          }
          if (score === 0) {
            Object.entries(row).forEach(([k, v]) => {
              if (k.toLowerCase().includes('puan') || k.toLowerCase().includes('score') || k.toLowerCase().includes('net')) {
                score = parseFloat(v as any) || 0;
              }
            });
          }

          const nameToUse = existingSystemStudent ? existingSystemStudent.name : name;
          const classToUse = existingSystemStudent ? existingSystemStudent.className : className;

          const existingResultIndex = updatedResults.findIndex(r => r.studentNo === studentNo);

          if (existingResultIndex !== -1) {
            const r = updatedResults[existingResultIndex];
            const newScores = { ...r.scores, [examNameKey]: score };
            const values = Object.values(newScores) as number[];
            const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

            updatedResults[existingResultIndex] = {
              ...r,
              studentName: nameToUse,
              studentClass: classToUse,
              scores: newScores,
              average
            };
          } else {
            updatedResults.push({
              id: generateId(),
              studentId: existingSystemStudent?.id || generateId(),
              studentNo: studentNo,
              studentName: nameToUse,
              studentClass: classToUse,
              scores: { [examNameKey]: score },
              average: score
            });
          }
          importedCount++;
        });

        setResults(updatedResults);
        alert(`"${examNameKey}" sınavı için ${importedCount} öğrenci sonucu başarıyla güncellendi/eklendi!`);
      });
    }
    if (modalFileRef.current) modalFileRef.current.value = '';
  };

  // Helper info calculations
  const totalStudentsInSelectedClasses = useMemo(() => {
    return state.students.filter(s => {
      const studentGrade = s.className ? (s.className.trim().match(/^(\d+)/)?.[1] || 'Diğer') : 'Diğer';
      return selectedClasses.includes(studentGrade);
    }).length;
  }, [state.students, selectedClasses]);

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return '';
    let dateObj: Date | null = null;
    
    const parts = dateStr.trim().split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
         dateObj = new Date(year, month - 1, day);
      }
    } else {
       const monthsTR: Record<string, number> = {
         'ocak': 0, 'şubat': 1, 'subat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'mayis': 4,
         'haziran': 5, 'temmuz': 6, 'ağustos': 7, 'agustos': 7, 'eylül': 8, 'eylul': 8,
         'ekim': 9, 'kasım': 10, 'kasim': 10, 'aralık': 11, 'aralik': 11
       };
       const cleanStr = dateStr.toLowerCase().replace(/[^a-z0-9şğüöçı]/g, ' ');
       const tokens = cleanStr.split(/\s+/).filter(Boolean);
       let day = 1;
       let month = 0;
       let year = 0;
       
       tokens.forEach(token => {
         if (/^\d{1,2}$/.test(token) && parseInt(token) <= 31) {
            day = parseInt(token);
         } else if (/^\d{4}$/.test(token)) {
            year = parseInt(token);
         } else if (monthsTR[token] !== undefined) {
            month = monthsTR[token];
         }
       });
       
       if (year > 0) {
         dateObj = new Date(year, month, day);
       }
    }
    
    if (dateObj && !isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
      });
    }
    return dateStr;
  };

  // Total participants registered across filtered exams
  const totalRegisteredParticipants = useMemo(() => {
    return filteredAndSortedExams.reduce((sum, exam) => {
      const regCount = state.students.filter(s => s.examRegistrations?.some(r => r.examId === exam.id)).length;
      return sum + regCount;
    }, 0);
  }, [filteredAndSortedExams, state.students]);

  return (
    <div className="space-y-2 sm:space-y-6 md:space-y-8 flex flex-col h-full relative font-sans text-brand-ink">
      {/* Upper header action bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                <Award className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-serif text-brand-ink font-bold tracking-tight leading-tight">Deneme Sınavları</h2>
            </div>
            <span className="sm:hidden text-xs font-semibold text-brand-ink/70 bg-[#F5F4F0] px-2.5 py-0.5 rounded-full border border-brand-border/60">
              {filteredAndSortedExams.length} Sınav
            </span>
          </div>
          <p className="hidden sm:block text-brand-ink/60 text-xs sm:text-sm mt-1">Yıllık sınav takvimi, yayıncı ödemeleri, katılım sınıfları ve salon senkronizasyonu</p>
        </div>
        
        {/* Action Buttons: Touch-Friendly Grid on Mobile, Flex on Desktop */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto py-0.5">
          <button 
            onClick={() => setIsPrintModalOpen(true)} 
            className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-brand-border text-xs font-bold text-brand-ink rounded-xl transition-all hover:bg-[#FAF9F6] active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
            title="Sınav Takvimi Raporu Yazdır"
          >
            <Printer className="w-3.5 h-3.5 text-brand-ink/70 shrink-0" />
            <span className="truncate">Yazdır</span>
          </button>
          
          {userRole === 'admin' && (
            <>
              <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImport} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-brand-border text-xs font-bold text-brand-ink rounded-xl transition-all hover:bg-[#FAF9F6] active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
                title="Excel'den İçe Aktar"
              >
                <Upload className="w-3.5 h-3.5 text-brand-ink/70 shrink-0" />
                <span className="truncate">İçe Aktar</span>
              </button>

              <button 
                onClick={() => {
                  openNotificationModal({
                    type: 'exam_created',
                    title: 'Yeni Sınav Takvimi Duyurusu',
                    message: 'Yaklaşan deneme sınavları takvimi güncellendi. Sınav tarihleri, oturum salonları ve yerleşim planını inceleyebilirsiniz.',
                    linkTab: 'exams',
                    targetGrade: filterGrade === 'Tümü' ? 'Tümü' : filterGrade,
                    urgent: false
                  });
                }} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500/15 to-brand-accent/20 border border-brand-accent/40 text-xs font-bold text-amber-900 dark:text-amber-300 rounded-xl transition-all hover:bg-brand-accent/30 active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
                title="Tüm kullanıcılara tarayıcı üzerinden anlık sınav duyurusu bildirimi gönder"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Sınav Bildir</span>
              </button>

              <button 
                onClick={handleExport} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-brand-border text-xs font-bold text-brand-ink rounded-xl transition-all hover:bg-[#FAF9F6] active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
                title="Excel'e Dışa Aktar"
              >
                <Download className="w-3.5 h-3.5 text-brand-ink/70 shrink-0" />
                <span className="truncate">Dışa Aktar</span>
              </button>

              <button 
                onClick={addEmptyExam} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-[#151618] border border-[#151618] text-white text-xs font-bold rounded-xl transition-all hover:bg-black active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">+ Yeni Sınav</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Quick Toggles & Active Filter Pill Bar */}
      <div className="flex sm:hidden items-center gap-2 px-0.5">
        <button
          type="button"
          onClick={() => setIsMobileStatsOpen(prev => !prev)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
            isMobileStatsOpen 
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 shadow-2xs' 
              : 'bg-white border-brand-border/80 text-brand-ink/75 hover:text-brand-ink shadow-2xs'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>İstatistikler</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileStatsOpen ? 'rotate-180 text-amber-700' : 'text-brand-ink/40'}`} />
        </button>

        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(prev => !prev)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
            isMobileFiltersOpen || searchQuery || filterGrade !== 'Tümü' || filterPublisher !== 'Tümü'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950 shadow-2xs' 
              : 'bg-white border-brand-border/80 text-brand-ink/75 hover:text-brand-ink shadow-2xs'
          }`}
        >
          <Filter className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Filtreler</span>
          {(searchQuery || filterGrade !== 'Tümü' || filterPublisher !== 'Tümü') && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileFiltersOpen ? 'rotate-180 text-emerald-700' : 'text-brand-ink/40'}`} />
        </button>
      </div>

      {/* Mobile Active Filter Chips (shows when filters are active and drawer is closed) */}
      {!isMobileFiltersOpen && (searchQuery || filterGrade !== 'Tümü' || filterPublisher !== 'Tümü') && (
        <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200 shrink-0">
              <span>"{searchQuery.slice(0, 12)}{searchQuery.length > 12 ? '...' : ''}"</span>
              <button onClick={() => setSearchQuery('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filterGrade !== 'Tümü' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-medium border border-blue-200 shrink-0">
              <span>{filterGrade}. Sınıf</span>
              <button onClick={() => { setSelectedGrades(['Tümü']); updateSubTitleForGrades(['Tümü']); }}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filterPublisher !== 'Tümü' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-[10px] font-medium border border-purple-200 shrink-0">
              <span>{filterPublisher}</span>
              <button onClick={() => setFilterPublisher('Tümü')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          <button 
            onClick={() => { setSearchQuery(''); setSelectedGrades(['Tümü']); updateSubTitleForGrades(['Tümü']); setFilterPublisher('Tümü'); }}
            className="text-[10px] text-rose-600 font-bold px-1 py-0.5 shrink-0 underline"
          >
            Sıfırla
          </button>
        </div>
      )}

      {/* Summary Stats - Collapsible on Mobile, 4 Cols on Desktop */}
      <section className={`${isMobileStatsOpen ? 'grid' : 'hidden'} sm:grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-4 md:gap-5`}>
        {/* Stat 1: Listelenen Sınav */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Listelenen </span>Sınav
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-brand-ink leading-none">{filteredAndSortedExams.length}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">sınav</span>
          </div>
        </div>

        {/* Stat 2: Toplam Sipariş Adedi */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Toplam </span>Sipariş
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-brand-ink leading-none">
              {filteredAndSortedExams.reduce((sum, e) => sum + (e.orderQuantity || 0), 0)}
            </span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">adet</span>
          </div>
        </div>

        {/* Stat 3: Toplam Yayıncı Maliyeti */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-amber-300">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Yayıncı </span>Maliyeti
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-brand-accent leading-none">
              ₺{filteredAndSortedExams.reduce((sum, e) => sum + ((e.publisherFee || 0) * (e.orderQuantity || 0)), 0).toLocaleString('tr-TR')}
            </span>
          </div>
        </div>

        {/* Stat 4: Aktif Kayıtlı Katılım */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Kayıtlı </span>Katılım
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-emerald-700 leading-none">{totalRegisteredParticipants}</span>
            <span className="text-[9px] sm:text-xs text-emerald-600/70 font-medium">öğrenci</span>
          </div>
        </div>
      </section>

      {/* Filter Bar - Collapsible on Mobile, Expanded on Desktop */}
      <section className={`${isMobileFiltersOpen ? 'flex' : 'hidden sm:flex'} bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-brand-border/70 shadow-xs sm:shadow-sm flex-col gap-1.5 sm:gap-3`}>
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2.5 items-stretch sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/40 h-3.5 w-3.5 sm:h-4 sm:w-4 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Sınav adı, yayıncı veya tarih ile ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F5F4F0] border border-transparent rounded-lg sm:rounded-xl pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 text-[11px] sm:text-sm text-brand-ink placeholder-brand-ink/40 font-medium focus:bg-white focus:border-brand-accent focus:ring-1 sm:ring-2 focus:ring-brand-accent/20 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink p-0.5 sm:p-1 rounded-full"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* Grade, Publisher & Sort Filter Dropdowns */}
          <div className="flex flex-nowrap sm:flex-wrap gap-1.5 sm:gap-2 items-center overflow-x-auto no-scrollbar shrink-0 py-0.5 w-full sm:w-auto">
            {/* Grade Filter */}
            <div className="relative shrink-0">
              <select
                value={filterGrade}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'Tümü') {
                    setSelectedGrades(['Tümü']);
                    updateSubTitleForGrades(['Tümü']);
                  } else {
                    setSelectedGrades([val]);
                    updateSubTitleForGrades([val]);
                  }
                }}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[95px] sm:min-w-[120px] shadow-xs cursor-pointer"
              >
                <option value="Tümü">Tüm Sınıflar</option>
                {availableGradeLevels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl === 'Diğer' ? 'Diğer Sınıflar' : `${lvl}. Sınıf`}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Publisher Filter */}
            <div className="relative shrink-0">
              <select
                value={filterPublisher}
                onChange={(e) => setFilterPublisher(e.target.value)}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[105px] sm:min-w-[130px] max-w-[150px] sm:max-w-[200px] shadow-xs cursor-pointer truncate"
                title="Yayıncı Filtresi"
              >
                <option value="Tümü">Tüm Yayıncılar</option>
                {availablePublishers.map(pub => (
                  <option key={pub} value={pub}>{pub}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Order Selector */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[125px] sm:min-w-[170px] shadow-xs cursor-pointer"
                title="Sıralama Seçeneği"
              >
                <option value="date-asc">Tarih: En Yakın → Uzak</option>
                <option value="date-desc">Tarih: En Uzak → Yakın</option>
                <option value="no-asc">Sıra No: 1 → N</option>
                <option value="no-desc">Sıra No: N → 1</option>
                <option value="name-asc">Sınav Adı: A → Z</option>
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(searchQuery || filterGrade !== 'Tümü' || filterPublisher !== 'Tümü' || sortBy !== 'date-asc') && (
              <button 
                onClick={() => { setSearchQuery(''); setSelectedGrades(['Tümü']); updateSubTitleForGrades(['Tümü']); setFilterPublisher('Tümü'); setSortBy('date-asc'); }}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg sm:rounded-xl font-bold shrink-0 transition-colors shadow-xs active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Temizle</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Exams List Container */}
      <div className="bg-white border border-brand-border/70 rounded-2xl shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
        {/* Desktop Table View */}
        <div className="overflow-auto flex-1 w-full hidden md:block">
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="bg-[#FAF9F6] border-b-2 border-brand-ink">
                <th style={{ width: 80 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider text-center sticky top-0 bg-[#FAF9F6]">SIRA NO</th>
                <th style={{ width: 210 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">TARİH</th>
                <th className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">SINAV ADI</th>
                <th style={{ width: 190 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">YAYINCI</th>
                <th style={{ width: 120 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider text-center sticky top-0 bg-[#FAF9F6]">KATILAN</th>
                <th style={{ width: 110 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider text-center sticky top-0 bg-[#FAF9F6]">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredAndSortedExams.map((exam, index) => {
                const registeredCount = state.students.filter(s => s.examRegistrations?.some(r => r.examId === exam.id)).length;
                
                return (
                  <tr key={exam.id} className="border-b border-brand-border transition-all hover:bg-[#FAF9F6]">
                    <td className="py-3.5 px-4 text-center" data-label="SIRA NO">
                      {userRole === 'admin' ? (
                        <input 
                          type="number" 
                          value={exam.no !== undefined && exam.no !== null && exam.no !== 0 ? exam.no : ''} 
                          onChange={(e) => updateExam(exam.id, 'no', parseInt(e.target.value) || 0)} 
                          className="w-14 text-center font-mono font-bold text-brand-accent bg-[#F5F4F0] hover:bg-white focus:bg-white border border-transparent hover:border-brand-border focus:border-brand-accent rounded-lg py-1 px-1 text-sm outline-none transition-all cursor-pointer" 
                          placeholder={exam.no ? exam.no.toString() : (index + 1).toString()}
                          title="Sınav Sıra No - Değiştirmek için tıklayın"
                        />
                      ) : (
                        <span className="font-mono font-bold text-brand-accent text-sm">
                          {exam.no !== undefined && exam.no > 0 ? exam.no : index + 1}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 min-w-[220px]" data-label="TARİH">
                      <input 
                        type="text" 
                        value={formatDateLong(exam.date) || exam.date} 
                        onChange={(e) => updateExam(exam.id, 'date', e.target.value)} 
                        onBlur={(e) => {
                          const short = formatDateShort(e.target.value);
                          if (short && short !== exam.date) {
                            updateExam(exam.id, 'date', short);
                          }
                        }}
                        className="w-full bg-transparent border-none focus:ring-0 text-brand-ink focus:outline-none p-1 font-sans text-xs font-semibold" 
                        placeholder="10.10.2026"
                        title={formatDateLong(exam.date) || "Sınav Tarihi ve Günü"}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-semibold" data-label="SINAV ADI">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button 
                          onClick={() => setEditingExam(exam)}
                          className="text-left font-serif font-bold text-base text-brand-ink hover:text-brand-accent transition-colors outline-none cursor-pointer"
                        >
                          {exam.name || '(İsimsiz Sınav)'}
                        </button>
                        {exam.examType === 'internal' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0 shadow-2xs">
                            <QrCode className="w-2.5 h-2.5 text-purple-600" />
                            Kurum İçi Optik
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 shadow-2xs">
                            <Building className="w-2.5 h-2.5 text-amber-700" />
                            Yayıncı Denemesi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5" data-label="BİLGİ">
                      <input 
                        type="text" 
                        value={exam.publisher || ''} 
                        onChange={(e) => updateExam(exam.id, 'publisher', e.target.value)} 
                        className="w-full bg-transparent border-none focus:ring-0 text-brand-ink/60 focus:outline-none p-1 text-[0.8rem]" 
                        placeholder="Yayın evi girilmemiş"
                      />
                    </td>

                    <td className="py-4 px-5 text-center" data-label="KATILAN">
                      <span className="inline-block bg-[#F3F2EE] text-brand-ink px-2.5 py-0.5 rounded-none text-[0.75rem] font-bold" title="Kayıtlı Öğrenci Sayısı">
                        {registeredCount} Öğr.
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center" data-label="İŞLEMLER">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => setEditingExam(exam)} 
                          className="w-7 h-7 rounded-full border border-brand-border flex items-center justify-center cursor-pointer transition-all bg-white hover:border-brand-accent hover:text-brand-accent"
                          title="Tüm Bağlantılı Detayları Düzenle"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => removeExam(exam.id)} 
                          className="w-7 h-7 rounded-full border border-brand-border flex items-center justify-center cursor-pointer transition-all bg-white hover:border-red-500 hover:text-red-500 hover:bg-red-50"
                          title="Sınavı Sil"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAndSortedExams.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-brand-ink/40 font-medium">
                    {state.exams.length === 0 
                      ? "Kayıtlı sınav bulunmuyor. Yeni sınav ekleyebilir veya Excel'den aktarabilirsiniz."
                      : "Arama kriterine uyan sınav bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Modern Cards View */}
        <div className="md:hidden flex-1 overflow-auto w-full p-2 sm:p-3 flex flex-col gap-2 bg-[#F9F8F5]">
          {/* Mobile List Quick Control Bar */}
          <div className="flex items-center justify-between px-1 py-0.5 text-xs text-brand-ink/60 font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-brand-ink">{filteredAndSortedExams.length}</span>
              <span>sınav listelendi</span>
            </div>
            <span className="text-[10px] text-brand-ink/50">Tıklayarak düzenleyin</span>
          </div>

          {filteredAndSortedExams.map((exam, index) => {
            const registeredCount = state.students.filter(s => s.examRegistrations?.some(r => r.examId === exam.id)).length;
            const totalCost = (exam.publisherFee || 0) * (exam.orderQuantity || 0);

            return (
              <div 
                key={exam.id} 
                className="bg-white rounded-xl p-2.5 sm:p-3 border border-brand-border/80 hover:border-brand-border transition-all duration-200 shadow-2xs flex flex-col gap-2"
              >
                {/* Card Header: Compact Number Button + Exam Name + Quick Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setEditingExam(exam)}
                      className="flex items-center justify-center min-w-[26px] h-6 px-1.5 bg-[#151618] hover:bg-brand-accent text-white rounded-md text-[11px] font-mono font-bold shrink-0 shadow-2xs mt-0.5 transition-colors cursor-pointer active:scale-95"
                      title={`Sınav No: #${exam.no !== undefined && exam.no > 0 ? exam.no : index + 1}`}
                    >
                      #{exam.no !== undefined && exam.no > 0 ? exam.no : index + 1}
                    </button>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button 
                          onClick={() => setEditingExam(exam)}
                          className="font-serif font-bold text-sm sm:text-base text-brand-ink text-left hover:text-brand-accent transition-all truncate leading-snug cursor-pointer"
                        >
                          {exam.name || '(İsimsiz Sınav)'}
                        </button>
                        {exam.examType === 'internal' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            <QrCode className="w-2.5 h-2.5 text-purple-600" />
                            Kurum İçi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                            <Building className="w-2.5 h-2.5 text-amber-700" />
                            Yayıncı
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-brand-ink/70 font-medium mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                        <span className="font-semibold text-brand-ink">{formatDateLong(exam.date) || exam.date || 'Tarih belirtilmedi'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => setEditingExam(exam)}
                      className="w-7 h-7 rounded-lg bg-gray-50 border border-brand-border/70 flex items-center justify-center text-brand-ink/70 hover:text-brand-accent hover:border-brand-accent transition-all active:scale-95 cursor-pointer"
                      title="Detayları Düzenle"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => removeExam(exam.id)}
                      className="w-7 h-7 rounded-lg bg-gray-50 border border-brand-border/70 flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-95 cursor-pointer"
                      title="Sınavı Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Meta Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {/* Publisher Badge */}
                  <div className="bg-indigo-50/80 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold flex items-center gap-1">
                    <Building className="w-3 h-3 opacity-70 shrink-0" />
                    <span className="truncate max-w-[120px]">{exam.publisher || 'Yayıncı Yok'}</span>
                  </div>

                  {/* Registered Students Badge */}
                  <div className="bg-purple-50/80 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold flex items-center gap-1">
                    <Users className="w-3 h-3 opacity-70 shrink-0" />
                    <span>{registeredCount} Kayıtlı</span>
                  </div>

                  {/* Order Quantity Badge */}
                  {(exam.orderQuantity || 0) > 0 && (
                    <div className="bg-blue-50/80 border border-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold flex items-center gap-1">
                      <Package className="w-3 h-3 opacity-70 shrink-0" />
                      <span>{exam.orderQuantity} Sipariş</span>
                    </div>
                  )}

                  {/* Publisher Cost Badge */}
                  {totalCost > 0 && (
                    <div className="bg-amber-50/80 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold flex items-center gap-1">
                      <DollarSign className="w-3 h-3 opacity-70 shrink-0" />
                      <span>₺{totalCost.toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                </div>

                {/* Participating classes & Quick edit bar */}
                <div className="flex items-center justify-between pt-1 border-t border-brand-border/40 text-[11px]">
                  <div className="flex items-center gap-1 text-brand-ink/60 min-w-0 flex-1 mr-2">
                    <Layers className="w-3 h-3 text-brand-ink/40 shrink-0" />
                    <span className="font-semibold truncate">
                      {exam.participatingClasses && exam.participatingClasses.length > 0 
                        ? exam.participatingClasses.map(c => `${c}. Sınıf`).join(', ')
                        : 'Tüm Sınıflar'}
                    </span>
                  </div>

                  <button
                    onClick={() => setEditingExam(exam)}
                    className="text-brand-accent font-bold hover:underline flex items-center gap-1 text-xs shrink-0 cursor-pointer"
                  >
                    <span>Yönet & Notlar</span>
                    <ChevronDown className="w-3 h-3 -rotate-90" />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredAndSortedExams.length === 0 && (
            <div className="text-center py-8 text-brand-ink/50 italic bg-white rounded-2xl border border-brand-border/60 p-4">
              Sınav bulunamadı.
            </div>
          )}
        </div>
      </div>

      {/* ============================================== */}
      {/* PROFESSIONAL INTERACTIVE MOCK EXAM DETAILS MODAL */}
      {/* ============================================== */}
      {editingExam && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 md:p-6 transition-opacity animate-fade-in"
          onClick={() => {
            setEditingExam(null);
            setShowDeleteConfirm(false);
          }}
        >
          <div 
            className="bg-white rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-[#e6e2d3] shadow-2xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Indicator */}
            <div className="w-12 h-1.5 bg-[#dcd8c8] rounded-full mx-auto my-2 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="bg-[#fcfbf7] border-b border-[#e6e2d3]/90 px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="bg-[#5a5a40]/10 border border-[#5a5a40]/20 text-[#5a5a40] p-2.5 rounded-2xl shadow-xs shrink-0 flex items-center justify-center">
                    <Award className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      <span className="text-[11px] font-black uppercase tracking-wider bg-[#5a5a40] text-white px-2 py-0.5 rounded-md shadow-xs">
                        Sınav #{examNo || '—'}
                      </span>
                      {examDate && (
                        <span className="text-[11px] font-semibold bg-white text-[#5a5a40] px-2 py-0.5 rounded-md border border-[#e6e2d3] hidden sm:inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-brand-accent shrink-0" />
                          {formatDateLong(examDate) || examDate}
                        </span>
                      )}
                      {examPublisher && (
                        <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 hidden md:inline-flex items-center gap-1 truncate max-w-[140px]">
                          <Building className="w-3 h-3 opacity-70 shrink-0" />
                          {examPublisher}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-serif text-[#2e2d26] font-bold truncate">
                      {examName || 'Sınav Detayları ve Entegrasyon'}
                    </h3>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    setEditingExam(null);
                    setShowDeleteConfirm(false);
                  }}
                  className="p-2 sm:p-2.5 text-[#8e8d82] hover:text-[#2d2c25] hover:bg-[#f2efe9] active:scale-95 rounded-full transition-all border border-transparent hover:border-[#e6e2d3] shrink-0"
                  aria-label="Kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - All Sections Fully Visible */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-[#faf9f5]/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                
                {/* COLUMN 1: GENERAL INFO & BUDGET */}
                <div className="space-y-5 sm:space-y-6">
                    
                    {/* Section 1: Sınav Temel Bilgileri */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] shadow-xs space-y-4 hover:border-[#d4d0be] transition-colors">
                      <div className="flex items-center justify-between border-b border-[#f2efe9] pb-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-[#5a5a40]/10 rounded-lg text-[#5a5a40]">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-[#43423b] uppercase tracking-wider">
                            Sınav Temel Bilgileri
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {examType === 'internal' ? (
                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                              <QrCode className="w-3 h-3 text-purple-600" />
                              Kurum İçi Optik
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                              <Building className="w-3 h-3 text-amber-700" />
                              Yayıncı Denemesi
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-[#8e8d82] bg-[#fcfbf7] px-2 py-0.5 rounded-md border border-[#e6e2d3]/60">
                            ID: #{editingExam.id.slice(-6)}
                          </span>
                        </div>
                      </div>

                      {/* Sınav Kaynağı / Türü Seçici */}
                      <div className="bg-[#fcfbf7] p-3 rounded-xl border border-[#e6e2d3] space-y-2">
                        <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider">
                          Sınav Kaynağı ve Değerlendirme Modeli
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setExamType('publisher')}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              examType === 'publisher'
                                ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold ring-2 ring-amber-400/20 shadow-xs'
                                : 'bg-white border-[#e6e2d3] text-[#737265] hover:border-[#d4d0be]'
                            }`}
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${examType === 'publisher' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-[#737265]'}`}>
                              <Building className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#2d2c25]">🏢 Yayıncı Denemesi</div>
                              <div className="text-[10px] text-[#737265] leading-tight mt-0.5">Dışarıdan hazır alım, sipariş adedi & bütçe faturası takibi</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExamType('internal')}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              examType === 'internal'
                                ? 'bg-purple-50/90 border-purple-300 text-purple-950 font-bold ring-2 ring-purple-400/20 shadow-xs'
                                : 'bg-white border-[#e6e2d3] text-[#737265] hover:border-[#d4d0be]'
                            }`}
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${examType === 'internal' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-[#737265]'}`}>
                              <QrCode className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#2d2c25]">🎯 Kurum İçi Optik Deneme</div>
                              <div className="text-[10px] text-[#737265] leading-tight mt-0.5">Ders/soru dağılımı, cevap anahtarları & optik okuma</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                              Sınav Sıra No
                            </label>
                            <input 
                              type="number" 
                              value={examNo || ''} 
                              onChange={(e) => setExamNo(parseInt(e.target.value) || 0)}
                              className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl px-3.5 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] transition-all shadow-2xs"
                              placeholder="Örn: 1"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                              Sınav Adı
                            </label>
                            <input 
                              type="text" 
                              value={examName} 
                              onChange={(e) => setExamName(e.target.value)}
                              className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl px-3.5 py-2 text-sm font-semibold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] transition-all shadow-2xs"
                              placeholder="Deneme Sınavı Adı"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                              Sınav Tarihi
                            </label>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={examDate} 
                                onChange={(e) => setExamDate(e.target.value)}
                                onBlur={(e) => {
                                  const short = formatDateShort(e.target.value);
                                  if (short && short !== e.target.value) {
                                    setExamDate(short);
                                  }
                                }}
                                className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl pl-9 pr-3.5 py-2 text-sm font-semibold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] transition-all shadow-2xs"
                                placeholder="10.10.2026"
                              />
                              <Calendar className="w-4 h-4 text-[#8e8d82] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            {examDate && formatDateLong(examDate) && (
                              <div className="text-[11px] font-semibold text-brand-accent mt-1.5 flex items-center gap-1.5 bg-[#fcfbf7] px-2.5 py-1 rounded-lg border border-[#e6e2d3]/80">
                                <Calendar className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                                <span className="truncate">{formatDateLong(examDate)}</span>
                              </div>
                            )}
                          </div>

                          {examType === 'publisher' ? (
                            <div>
                              <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                                Yayıncı Bilgisi
                              </label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={examPublisher} 
                                  onChange={(e) => setExamPublisher(e.target.value)}
                                  className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl pl-9 pr-3.5 py-2 text-sm font-semibold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] transition-all shadow-2xs"
                                  placeholder="Yayın Evi / Marka (Örn: Hız, Mozaik)"
                                />
                                <Building className="w-4 h-4 text-[#8e8d82] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                                Sınav Formatı
                              </label>
                              <select
                                value={examFormat}
                                onChange={(e) => setExamFormat(e.target.value as any)}
                                className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl px-3.5 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all shadow-2xs"
                              >
                                <option value="lgs">LGS (Ortaokul Standart)</option>
                                <option value="mebi">MEBİ / Ara Sınıf Denemesi</option>
                                <option value="tyt">YKS / TYT</option>
                                <option value="ayt">YKS / AYT</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 2: HİBRİT KOŞULLU ALAN */}
                    {examType === 'publisher' ? (
                      /* Section 2A: Yayıncı Denemesi Bütçe Takibi Entegrasyonu */
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] shadow-xs space-y-4 hover:border-[#d4d0be] transition-colors">
                        <div className="flex items-center justify-between border-b border-[#f2efe9] pb-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                              <DollarSign className="h-4 w-4" />
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-[#43423b] uppercase tracking-wider">
                              Bütçe Gider Entegrasyonu
                            </h4>
                          </div>
                          <span className="text-[10px] sm:text-[11px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Canlı Bağlantı
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                                Kişi Başı Kitapçık Ücreti
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737265] text-sm font-bold">₺</span>
                                <input 
                                  type="number" 
                                  step="0.5"
                                  value={examPublisherFee || ''} 
                                  onChange={(e) => setExamPublisherFee(parseFloat(e.target.value) || 0)}
                                  className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl pl-8 pr-3.5 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                                Toplam Sipariş Miktarı
                              </label>
                              <div className="relative">
                                <input 
                                  type="number" 
                                  min="0"
                                  value={examOrderQuantity || ''} 
                                  onChange={(e) => setExamOrderQuantity(parseInt(e.target.value) || 0)}
                                  className="w-full bg-[#fcfbf7] hover:bg-white focus:bg-white border border-[#e6e2d3] rounded-xl pl-9 pr-3.5 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] transition-all shadow-2xs"
                                  placeholder="Adet"
                                />
                                <Package className="w-4 h-4 text-[#8e8d82] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          {/* Sınıf Seviyelerine Göre Sipariş Detayı */}
                          <div className="bg-[#fcfbf7] p-3.5 sm:p-4 rounded-xl border border-[#e6e2d3]/80 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-bold text-[#43423b] flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-[#737265]" />
                                Sınıf Seviyelerine Göre Sipariş Adetleri
                              </span>
                              {(() => {
                                const sum = (Object.values(examGradeOrderQuantities) as number[]).reduce((acc, val) => acc + (val || 0), 0);
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-[#737265] bg-white px-2 py-0.5 rounded-md border border-[#e6e2d3]">
                                      Sınıf Toplamı: <strong className="text-[#2d2c25]">{sum}</strong> adet
                                    </span>
                                    {sum !== examOrderQuantity && sum > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setExamOrderQuantity(sum)}
                                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                                        title="Sipariş adedini sınıf toplamına eşitle"
                                      >
                                        Siparişe Eşitle
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {availableGradeLevels.map(lvl => {
                                const qty = examGradeOrderQuantities[lvl] || 0;
                                return (
                                  <div key={lvl} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-[#e6e2d3] gap-2 shadow-2xs">
                                    <span className="text-xs font-bold text-[#43423b] truncate">
                                      {lvl === 'Diğer' ? 'Diğer' : `${lvl}. Sınıf`}
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={qty || ''}
                                      onChange={(e) => handleGradeOrderQuantityChange(lvl, parseInt(e.target.value) || 0)}
                                      className="w-16 bg-[#fcfbf7] border border-[#e6e2d3] rounded-lg px-2 py-1 text-xs font-bold text-[#2d2c25] text-center focus:ring-1 focus:ring-[#5a5a40] focus:border-[#5a5a40]"
                                      placeholder="0"
                                    />
                                  </div>
                                );
                              })}
                              {availableGradeLevels.length === 0 && (
                                <span className="text-xs text-[#8e8d82] italic col-span-2 py-2 text-center">
                                  Sistemde henüz sınıf bulunmamaktadır.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Canlı Hesaplanan Gider Özeti Kartı */}
                          {examPublisherFee > 0 && examOrderQuantity > 0 ? (
                            <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 p-3.5 sm:p-4 rounded-xl border border-emerald-200/80 text-xs text-emerald-950 space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="font-bold flex items-center text-emerald-900 gap-1.5">
                                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                                  Otomatik Gider Senkronu Aktif
                                </span>
                                <span className="text-sm font-black text-emerald-800 bg-white/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                  ₺{(examPublisherFee * examOrderQuantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <p className="text-emerald-800/80 leading-relaxed text-[11px]">
                                Sınavı kaydettiğinizde, bütçede harcama sütununa {examOrderQuantity} adet × ₺{examPublisherFee} = <strong>₺{(examPublisherFee * examOrderQuantity).toLocaleString('tr-TR')}</strong> tutarında <strong>"{examName || 'Sınav'} Yayın Ücreti"</strong> kalemi işlenecektir.
                              </p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#8e8d82] leading-normal italic bg-[#fcfbf7] p-2.5 rounded-lg border border-[#e6e2d3]/50">
                              💡 Kişi başı kitapçık ücreti ve sipariş adedi girildiğinde toplam tutar Bütçe Harcamalar tablosuna otomatik olarak gider olarak yansıtılır.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Section 2B: Kurum İçi Optik Deneme Konfigürasyonu */
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-purple-200 shadow-xs space-y-4 hover:border-purple-300 transition-colors">
                        <div className="flex items-center justify-between border-b border-purple-100 pb-3 flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                              <QrCode className="h-4 w-4" />
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-purple-950 uppercase tracking-wider">
                              Kurum İçi Optik Ölçme Ayarları
                            </h4>
                          </div>
                          <span className="text-[10px] sm:text-[11px] bg-purple-50 text-purple-800 font-bold px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                            Toplam {totalExamQuestions} Soru
                          </span>
                        </div>

                        <div className="space-y-4">
                          {/* Parametreler: Şık Sayısı, Ceza Katsayısı, Düzen */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="bg-[#fcfbf7] p-2.5 rounded-xl border border-[#e6e2d3]">
                              <label className="block text-[10px] font-bold text-[#737265] uppercase tracking-wider mb-1">
                                Şık Sayısı
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setExamOptionsCount(4)}
                                  className={`py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    examOptionsCount === 4
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white text-[#737265] border-[#e6e2d3] hover:bg-gray-50'
                                  }`}
                                >
                                  4 Şık (A-D)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExamOptionsCount(5)}
                                  className={`py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    examOptionsCount === 5
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white text-[#737265] border-[#e6e2d3] hover:bg-gray-50'
                                  }`}
                                >
                                  5 Şık (A-E)
                                </button>
                              </div>
                            </div>

                            <div className="bg-[#fcfbf7] p-2.5 rounded-xl border border-[#e6e2d3]">
                              <label className="block text-[10px] font-bold text-[#737265] uppercase tracking-wider mb-1">
                                Yanlış Katsayısı
                              </label>
                              <select
                                value={examPenalty}
                                onChange={(e) => setExamPenalty(parseFloat(e.target.value))}
                                className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1 text-xs font-bold text-[#2d2c25] focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                              >
                                <option value={3}>3 Yanlış 1 Doğru (LGS)</option>
                                <option value={4}>4 Yanlış 1 Doğru (TYT)</option>
                                <option value={0}>Yanlış Götürmez (0)</option>
                              </select>
                            </div>

                            <div className="bg-[#fcfbf7] p-2.5 rounded-xl border border-[#e6e2d3]">
                              <label className="block text-[10px] font-bold text-[#737265] uppercase tracking-wider mb-1">
                                Optik Form Düzeni
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setExamLayoutType('split')}
                                  className={`py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    examLayoutType === 'split'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white text-[#737265] border-[#e6e2d3] hover:bg-gray-50'
                                  }`}
                                  title="Sözel (50) ve Sayısal (40) iki ayrı blok"
                                >
                                  Ayrık (Split)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExamLayoutType('standard')}
                                  className={`py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    examLayoutType === 'standard'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white text-[#737265] border-[#e6e2d3] hover:bg-gray-50'
                                  }`}
                                  title="Standart tek parça optik blok"
                                >
                                  Standart
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Ders ve Soru Dağılımı Yönetimi */}
                          <div className="bg-[#fcfbf7] p-3 rounded-xl border border-[#e6e2d3] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#43423b] flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                Dersler ve Soru Dağılımı
                              </span>
                              <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                Toplam: <strong>{totalExamQuestions}</strong> soru
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                              {examSubjects.map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-[#e6e2d3] gap-1.5 shadow-2xs">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-bold text-[#2d2c25] truncate block" title={sub.name}>
                                      {sub.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={sub.count || ''}
                                      onChange={(e) => handleUpdateSubjectCount(sub.id, parseInt(e.target.value) || 0)}
                                      className="w-12 bg-[#fcfbf7] border border-[#e6e2d3] rounded-lg px-1.5 py-0.5 text-xs font-bold text-center text-[#2d2c25]"
                                      title="Soru Sayısı"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubject(sub.id)}
                                      className="text-gray-400 hover:text-red-600 p-0.5 rounded-md hover:bg-red-50 transition-colors"
                                      title="Dersi Kaldır"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Yeni Ders Ekleme */}
                            <div className="flex items-center gap-2 pt-1 border-t border-[#e6e2d3]/60">
                              <input
                                type="text"
                                value={newSubName}
                                onChange={(e) => setNewSubName(e.target.value)}
                                placeholder="Yeni ders adı..."
                                className="flex-1 bg-white border border-[#e6e2d3] rounded-lg px-2.5 py-1 text-xs text-[#2d2c25] font-semibold"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubject();
                                  }
                                }}
                              />
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={newSubCount || ''}
                                onChange={(e) => setNewSubCount(parseInt(e.target.value) || 10)}
                                placeholder="Soru"
                                className="w-16 bg-white border border-[#e6e2d3] rounded-lg px-2 py-1 text-xs text-[#2d2c25] font-bold text-center"
                              />
                              <button
                                type="button"
                                onClick={handleAddSubject}
                                className="px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Ekle
                              </button>
                            </div>
                          </div>

                          {/* Cevap Anahtarları Tanımlama & Düzenleme Butonu */}
                          <div className="bg-gradient-to-br from-purple-50/90 to-indigo-50/70 p-3.5 sm:p-4 rounded-xl border border-purple-200/80 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-600 text-white rounded-lg">
                                  <Key className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-purple-950 block">
                                    Cevap Anahtarları (A / B / C / D)
                                  </span>
                                  <span className="text-[11px] text-purple-800/80">
                                    Optik form ve kamera taramasında doğru cevap eşleşmesi
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveKeyBooklet('A');
                                  setShowKeyModal(true);
                                }}
                                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Key className="w-3.5 h-3.5" />
                                Cevap Anahtarını Düzenle
                              </button>
                            </div>

                            {/* Kitapçık Durum Rozetleri */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                              {['A', 'B', 'C', 'D'].map(bk => {
                                const filledCount = (examKeys[bk] || []).filter(Boolean).length;
                                const isReady = filledCount > 0 && filledCount >= totalExamQuestions;
                                return (
                                  <div
                                    key={bk}
                                    onClick={() => {
                                      setActiveKeyBooklet(bk);
                                      setShowKeyModal(true);
                                    }}
                                    className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                      filledCount > 0
                                        ? 'bg-white border-purple-200 hover:border-purple-400'
                                        : 'bg-white/60 border-dashed border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs font-black text-purple-900">{bk} Kitapçığı</span>
                                      {isReady ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      ) : filledCount > 0 ? (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Eksik</span>
                                      ) : (
                                        <span className="text-[9px] text-gray-400">Boş</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-purple-950/70 font-semibold font-mono">
                                      {filledCount} / {totalExamQuestions} Soru
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

                {/* COLUMN 2: CLASSES & HALLS */}
                <div className="space-y-5 sm:space-y-6">
                    
                    {/* Section 3: Katılacak Sınıflar (Öğrenci Kayıtları Entegrasyonu) */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] shadow-xs space-y-4 hover:border-[#d4d0be] transition-colors">
                      <div className="flex items-center justify-between border-b border-[#f2efe9] pb-3 flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                            <Users className="h-4 w-4" />
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-[#43423b] uppercase tracking-wider">
                            Katılacak Sınıf Seviyeleri
                          </h4>
                        </div>
                        <span className="text-[11px] bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold border border-indigo-100 flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-600 shrink-0" />
                          {totalStudentsInSelectedClasses} Öğrenci Aktif
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-[#8e8d82]">
                          <span>Sınava girecek sınıf kademelerini seçin:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedClasses([...availableGradeLevels])}
                              className="text-[11px] font-bold text-[#5a5a40] hover:underline cursor-pointer"
                            >
                              Tümünü Seç
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedClasses([])}
                              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Temizle
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-[#e6e2d3]/80 rounded-xl p-2.5 bg-[#fcfbf7] max-h-[220px] overflow-y-auto">
                          {availableGradeLevels.map(lvl => {
                            const isChecked = selectedClasses.includes(lvl);
                            const studentCount = state.students.filter(s => {
                              const match = s.className?.trim().match(/^(\d+)/);
                              const studentLvl = match ? match[1] : 'Diğer';
                              return studentLvl === lvl;
                            }).length;

                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedClasses(selectedClasses.filter(c => c !== lvl));
                                  } else {
                                    setSelectedClasses([...selectedClasses, lvl]);
                                  }
                                }}
                                className={`p-3 rounded-xl text-xs font-bold border transition-all text-center flex flex-col justify-center items-center min-h-[56px] cursor-pointer ${
                                  isChecked 
                                    ? 'bg-[#5a5a40] text-white border-transparent shadow-xs ring-1 ring-[#5a5a40]' 
                                    : 'bg-white text-[#43423b] border-[#e6e2d3] hover:bg-[#f5f5f0] shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  {isChecked && <Check className="w-3.5 h-3.5 shrink-0 text-amber-200" />}
                                  <span>{lvl === 'Diğer' ? 'Diğer Sınıflar' : `${lvl}. Sınıflar`}</span>
                                </div>
                                <span className={`text-[10px] mt-0.5 font-normal ${isChecked ? 'text-amber-100' : 'text-[#8e8d82]'}`}>
                                  {studentCount} Kayıtlı Öğrenci
                                </span>
                              </button>
                            );
                          })}
                          {availableGradeLevels.length === 0 && (
                            <div className="text-center text-xs text-[#8e8d82] py-4 col-span-full">
                              Sistemde kayıtlı sınıf bulunmuyor.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Sınav Salonları Entegrasyonu */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e6e2d3] shadow-xs space-y-4 hover:border-[#d4d0be] transition-colors">
                      <div className="flex items-center justify-between border-b border-[#f2efe9] pb-3 flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-amber-50 text-amber-800 rounded-lg">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-[#43423b] uppercase tracking-wider">
                            Atanan Sınav Salonları
                          </h4>
                        </div>
                        <span className="text-[11px] bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-full font-bold border border-amber-200/80">
                          {selectedHalls.length} / {state.examHalls.length} Salon
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-[#8e8d82]">
                          <span>Kullanılacak oturma ve yoklama salonları:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedHalls(state.examHalls.map(h => h.id))}
                              className="text-[11px] font-bold text-[#5a5a40] hover:underline cursor-pointer"
                            >
                              Tümünü Seç
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedHalls([])}
                              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Temizle
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto border border-[#e6e2d3]/80 rounded-xl p-2.5 bg-[#fcfbf7]">
                          {state.examHalls.map(hall => {
                            const isChecked = selectedHalls.includes(hall.id);
                            const studentCount = hall.capacity || 0;
                            return (
                              <label 
                                key={hall.id} 
                                className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  isChecked 
                                    ? 'bg-amber-50/70 border-[#d4d19d] shadow-2xs' 
                                    : 'bg-white border-[#e6e2d3] hover:bg-[#f5f5f0]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedHalls([...selectedHalls, hall.id]);
                                    } else {
                                      setSelectedHalls(selectedHalls.filter(id => id !== hall.id));
                                    }
                                  }}
                                  className="rounded border-[#c8c4b2] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-[#2d2c25] truncate">{hall.name}</div>
                                  <div className="text-[10px] text-[#737265] truncate">
                                    Kapasite: <strong className="text-[#2d2c25]">{studentCount}</strong> • {hall.selectedClasses?.join(', ') || 'Sınıf sınırı yok'}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                          {state.examHalls.length === 0 && (
                            <div className="col-span-full text-center text-xs text-[#8e8d82] py-4">
                              Sistemde kayıtlı sınav salonu bulunmuyor. Salonlar sekmesinden salon tanımlayabilirsiniz.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#fcfbf7] border-t border-[#e6e2d3] px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
              {/* Left Action: Danger/Delete with Confirmation Protection */}
              <div>
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center justify-center w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200/80 active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5 shrink-0" />
                    Sınavı Tamamen Sil
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 rounded-xl">
                    <span className="text-xs font-bold text-rose-800 px-2">Emin misiniz?</span>
                    <button
                      type="button"
                      onClick={() => removeExam(editingExam.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      Evet, Sil
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-xs font-bold bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100/50 transition-colors cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                )}
              </div>
              
              {/* Right Action: Cancel, Push Notify & Save */}
              <div className="flex items-center justify-end gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    openNotificationModal({
                      type: 'exam_created',
                      title: `${examName || 'Yeni Deneme Sınavı'} Takvime Eklendi!`,
                      message: `${examName || 'Deneme Sınavı'} tarihi: ${formatDateLong(examDate) || examDate || 'Yakında'}. Lütfen sınav salon ve yerleşim planınızı kontrol ediniz.`,
                      linkTab: 'exams',
                      urgent: false
                    });
                  }}
                  className="px-3.5 py-2.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-500/30 rounded-xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Öğrencilere ve öğretmenlere anlık push bildirimi gönder"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">Sınavı Bildir</span>
                  <span className="sm:hidden">Bildir</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingExam(null);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-4 py-2.5 text-sm font-bold border border-[#e6e2d3] rounded-xl hover:bg-[#f2efe9] text-[#5a5a40] transition-all bg-white shadow-2xs active:scale-95 text-center cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  className="px-5 py-2.5 text-sm font-bold bg-[#5a5a40] hover:bg-[#43423b] text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* ANSWER KEY MODAL (Cevap Anahtarı Tanımlama)   */}
      {/* ============================================== */}
      {showKeyModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4 animate-fade-in"
          onClick={() => setShowKeyModal(false)}
        >
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl border border-[#e6e2d3] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#fcfbf7] border-b border-[#e6e2d3] px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-serif font-bold text-[#2d2c25]">
                    Cevap Anahtarı Yönetimi
                  </h3>
                  <p className="text-xs text-[#8e8d82]">
                    {examName || 'Kurum İçi Sınav'} • Toplam {totalExamQuestions} Soru • {examOptionsCount} Şıklı
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="p-2 text-[#8e8d82] hover:text-[#2d2c25] hover:bg-[#f2efe9] rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Booklet Tabs & Quick Actions */}
            <div className="bg-[#faf9f5] border-b border-[#e6e2d3] px-5 py-3 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Booklet Selection Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['A', 'B', 'C', 'D'].map(bk => {
                  const filled = (examKeys[bk] || []).filter(Boolean).length;
                  const isActive = activeKeyBooklet === bk;
                  return (
                    <button
                      key={bk}
                      type="button"
                      onClick={() => setActiveKeyBooklet(bk)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-white text-[#737265] border border-[#e6e2d3] hover:border-purple-300'
                      }`}
                    >
                      <span>{bk} Kitapçığı</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-purple-700 text-purple-100' : 'bg-gray-100 text-[#737265]'
                      }`}>
                        {filled}/{totalExamQuestions}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Actions (Clear) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleClearBookletKeys(activeKeyBooklet)}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  {activeKeyBooklet} Kitapçığını Temizle
                </button>
              </div>
            </div>

            {/* Quick Paste String Input */}
            <div className="px-5 py-3 bg-white border-b border-[#e6e2d3]/70 shrink-0">
              <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1">
                Hızlı Metin Yapıştırarak Doldur ({activeKeyBooklet} Kitapçığı)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickKeyInput}
                  onChange={(e) => setQuickKeyInput(e.target.value)}
                  placeholder="Örn: CADBBACDACBB... veya harfleri aralarında boşlukla yapıştırın"
                  className="flex-1 bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#2d2c25] focus:ring-1 focus:ring-purple-600 focus:border-purple-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyQuickKey();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyQuickKey}
                  className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  Yapıştır & Doldur
                </button>
              </div>
            </div>

            {/* Questions Grid Matrix */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#faf9f5]/40">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {Array.from({ length: totalExamQuestions }, (_, qIndex) => {
                  const currentOpt = (examKeys[activeKeyBooklet] || [])[qIndex] || '';
                  const options = examOptionsCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D'];
                  return (
                    <div
                      key={qIndex}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        currentOpt
                          ? 'bg-purple-50/60 border-purple-200 shadow-2xs'
                          : 'bg-white border-[#e6e2d3]'
                      }`}
                    >
                      <span className="text-xs font-mono font-bold text-[#737265] w-7 shrink-0">
                        {qIndex + 1}.
                      </span>
                      <div className="flex items-center gap-1">
                        {options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSetKeyOption(activeKeyBooklet, qIndex, currentOpt === opt ? '' : opt)}
                            className={`w-6 h-6 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentOpt === opt
                                ? 'bg-purple-600 text-white shadow-2xs scale-105'
                                : 'bg-white text-[#737265] border border-[#e6e2d3] hover:bg-gray-100'
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
            </div>

            {/* Modal Footer */}
            <div className="bg-[#fcfbf7] border-t border-[#e6e2d3] px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="text-xs font-medium text-[#737265]">
                {activeKeyBooklet} Kitapçığında{' '}
                <strong className="text-purple-700 font-bold">
                  {(examKeys[activeKeyBooklet] || []).filter(Boolean).length}
                </strong>{' '}
                / {totalExamQuestions} Soru Dolduruldu
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Tamamla ve Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PRINT MODAL (Sınav Takvimi İlan Raporu)         */}
      {/* ============================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in print:bg-white print:p-0 print:absolute print:inset-0">
          <div className="bg-white rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up print:w-full print:max-w-none print:h-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
            {/* Header (Hidden in Print) */}
            <div className="bg-[#fcfbf7] border-b border-[#e6e2d3] p-5 flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-3">
                <div className="bg-[#d4d19d]/30 p-2.5 rounded-2xl border border-[#d4d19d]/50">
                  <FileText className="h-6 w-6 text-[#5a5a40]" />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-[#5a5a40] font-bold">
                    Sınav Takvimi Raporu
                  </h3>
                  <p className="text-xs text-[#8e8d82]">
                    İlan ve duyuru amaçlı sınıf bazlı sınav takvimi (Tablo görünümü)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Tablo Büyüt / Küçült (Zoom / Ölçek) */}
                <div className="flex items-center bg-[#f0ece1] border border-[#e6e2d3] rounded-full px-1 py-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: Math.max(60, (prev.tableScale || 100) - 5) }))}
                    className="p-1 text-[#5a5a40] hover:bg-white rounded-full transition-all cursor-pointer active:scale-90"
                    title="Tabloyu Küçült (-%5)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: 100 }))}
                    className="px-2 py-0.5 text-[11px] font-black text-[#5a5a40] hover:bg-white rounded-full transition-all cursor-pointer tracking-tight"
                    title="Varsayılan Boyuta Sıfırla (%100 - 30 Sınavı 1 Sayfaya Tam Doldur)"
                  >
                    %{printSettings.tableScale || 100}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: Math.min(160, (prev.tableScale || 100) + 5) }))}
                    className="p-1 text-[#5a5a40] hover:bg-white rounded-full transition-all cursor-pointer active:scale-90"
                    title="Tabloyu Büyüt (+%5)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* PDF İndir */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="flex items-center px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-full text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                  title="Aranabilir Türkçe PDF formatında takvim indir"
                >
                  <Download className="h-3.5 w-3.5 mr-1 text-white" />
                  {isPdfGenerating ? 'PDF Hazırlanıyor...' : 'PDF İndir'}
                </button>

                {/* Yazdır */}
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting || isPdfGenerating}
                  className="flex items-center px-4 py-1.5 bg-[#5a5a40] text-white rounded-full text-xs font-bold shadow-xs hover:bg-[#43423b] disabled:opacity-75 transition-all cursor-pointer active:scale-95"
                  title="Sınav takvimini doğrudan yazdır"
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  {isPrinting || isPdfGenerating ? 'Hazırlanıyor...' : 'Yazdır'}
                </button>

                {/* Ayarlar Aç/Kapa */}
                <button
                  type="button"
                  onClick={() => setShowPrintSettings(!showPrintSettings)}
                  className={`flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs transition-colors border cursor-pointer ${
                    showPrintSettings 
                      ? 'bg-[#e6e2d3] text-[#5a5a40] border-[#d4d19d]' 
                      : 'bg-white text-[#5a5a40] border-[#e6e2d3] hover:bg-[#fcfbf7]'
                  }`}
                  title="Yazdırma, font, sütun ve sayfa ayarları"
                >
                  <Settings className="h-3.5 w-3.5 mr-1" />
                  Ayarlar
                </button>

                {/* Kapat */}
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-[#8e8d82] hover:text-[#5a5a40] hover:bg-[#f5f5f0] rounded-full transition-all border border-transparent hover:border-[#e6e2d3] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Save Feedback Banner */}
            {saveFeedback && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs font-bold text-emerald-800 flex items-center justify-between animate-fade-in print:hidden">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveFeedback}</span>
                </div>
                <button 
                  onClick={() => setSaveFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold underline cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            )}

            {/* Print Settings Panel (Hidden in Print) */}
            {showPrintSettings && (
              <div className="bg-[#fcfbf7] border-b border-[#e6e2d3] p-4 sm:p-5 print:hidden max-h-[60vh] overflow-y-auto">
                {/* Header of settings panel */}
                <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-[#e6e2d3] gap-2">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#5a5a40]" />
                    <span className="text-xs font-black text-[#5a5a40] uppercase tracking-wider">
                      Yazdırma ve Belge Yapılandırması
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Canlı Önizleme &amp; Otomatik Kayıt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPrintSettings}
                    className="flex items-center gap-1.5 text-[11px] text-[#8e8d82] hover:text-[#5a5a40] font-bold px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-[#e6e2d3] transition-all cursor-pointer"
                    title="Tüm ayarları varsayılanlara sıfırla"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Varsayılana Sıfırla</span>
                  </button>
                </div>

                {/* Header & Tabs Navigation */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#e6e2d3]">
                  {/* Segmented Tab Controls */}
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#f0ece1] rounded-2xl border border-[#e6e2d3]">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('layout')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsTab === 'layout'
                          ? 'bg-white text-[#5a5a40] shadow-xs'
                          : 'text-[#8e8d82] hover:text-[#5a5a40] hover:bg-white/50'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Sayfa &amp; Düzen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettingsTab('typography')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsTab === 'typography'
                          ? 'bg-white text-[#5a5a40] shadow-xs'
                          : 'text-[#8e8d82] hover:text-[#5a5a40] hover:bg-white/50'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      <span>Tipografi &amp; Sütunlar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettingsTab('content')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsTab === 'content'
                          ? 'bg-white text-[#5a5a40] shadow-xs'
                          : 'text-[#8e8d82] hover:text-[#5a5a40] hover:bg-white/50'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Başlıklar &amp; Alt Bilgi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettingsTab('colors')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsTab === 'colors'
                          ? 'bg-white text-[#5a5a40] shadow-xs ring-1 ring-amber-300'
                          : 'text-[#8e8d82] hover:text-[#5a5a40] hover:bg-white/50'
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5 text-amber-600" />
                      <span>Yayıncı Renk Paleti</span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.2 rounded-full">
                        {uniquePublishers.length}
                      </span>
                    </button>
                  </div>

                  {/* Actions on top right */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
                      ✓ Canlı Önizleme &amp; Otomatik Kayıt
                    </span>
                    <button
                      type="button"
                      onClick={handleResetPrintSettings}
                      className="flex items-center gap-1.5 text-xs text-[#8e8d82] hover:text-[#5a5a40] font-bold px-2.5 py-1.5 rounded-xl hover:bg-white border border-transparent hover:border-[#e6e2d3] transition-all cursor-pointer"
                      title="Tüm ayarları ve renkleri varsayılana sıfırla"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Varsayılana Sıfırla</span>
                    </button>
                  </div>
                </div>

                {/* Tab 1: Sayfa & Düzen */}
                {settingsTab === 'layout' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Sınıf Seviyeleri (Çoklu Seçim) */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#5a5a40]" />
                            Sınıf Seviyesi Filtresi
                          </h4>
                          {!selectedGrades.includes('Tümü') && (
                            <button
                              type="button"
                              onClick={() => handleGradeToggle('Tümü')}
                              className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                            >
                              Tümünü Seç
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8e8d82] mb-3">
                          Birden fazla sınıf seçebilirsiniz. Başlık seçime göre otomatik uyarlanır.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGradeToggle('Tümü')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedGrades.includes('Tümü')
                                ? 'bg-[#5a5a40] text-white shadow-xs'
                                : 'bg-[#fcfbf7] text-[#5a5a40] hover:bg-[#f0ede4] border border-[#e6e2d3]'
                            }`}
                          >
                            <span>Tümü</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              selectedGrades.includes('Tümü') ? 'bg-white/25 text-white' : 'bg-[#e6e2d3] text-[#5a5a40]'
                            }`}>
                              {state.exams.length}
                            </span>
                          </button>

                          {availableGradeLevels.map(lvl => {
                            const isSelected = selectedGrades.includes(lvl);
                            const count = state.exams.filter(e => {
                              const grades = e.participatingClasses || [];
                              if (grades.length > 0) return grades.includes(lvl);
                              if (e.name) {
                                const norm = e.name.toLowerCase();
                                return norm.includes(`${lvl}. sınıf`) || norm.includes(`${lvl}.sınıf`) || norm.includes(`${lvl}/`);
                              }
                              return false;
                            }).length;

                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleGradeToggle(lvl)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-300'
                                    : 'bg-[#fcfbf7] text-[#5a5a40] hover:bg-[#f0ede4] border border-[#e6e2d3]'
                                }`}
                              >
                                <span>{lvl === 'Diğer' ? 'Diğer' : `${lvl}. Sınıf`}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                  isSelected ? 'bg-white/25 text-white' : 'bg-[#e6e2d3] text-[#5a5a40]'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Sayfa Yönlendirme */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-[#5a5a40]" />
                            Sayfa Yönlendirme
                          </h4>
                          <span className="text-[10px] text-[#8e8d82] font-semibold">A4 Standart</span>
                        </div>
                        <p className="text-[11px] text-[#8e8d82] mb-3">
                          Yazdırma ve PDF belgesinin kağıt yerleşimini belirleyin.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, orientation: 'portrait' }))}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              printSettings.orientation === 'portrait'
                                ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                            }`}
                          >
                            <span className="w-5 h-7 border-2 border-current rounded-xs mb-1.5 inline-block"></span>
                            <span>Dikey (Portrait)</span>
                            <span className="text-[10px] opacity-75 font-normal mt-0.5">Klasik Pano İlanı</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, orientation: 'landscape' }))}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              printSettings.orientation === 'landscape'
                                ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                            }`}
                          >
                            <span className="w-7 h-5 border-2 border-current rounded-xs mb-1.5 inline-block"></span>
                            <span>Yatay (Landscape)</span>
                            <span className="text-[10px] opacity-75 font-normal mt-0.5">Geniş Tablo Düzeni</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sayfa Sığdırma & Sayfa Sayısı */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#5a5a40]" />
                            Sayfa Sığdırma (Fit)
                          </h4>
                          {isSinglePage && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              ★ 1 Sayfa Fit
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8e8d82] mb-3">
                          Tüm sınavları tek bir sayfaya sığdırın veya sayfalara bölün.
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['1', '2', 'auto'] as const).map(pc => (
                            <button
                              key={pc}
                              type="button"
                              onClick={() => setPrintSettings(prev => ({ ...prev, pageCount: pc }))}
                              className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                printSettings.pageCount === pc
                                  ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                  : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                              }`}
                            >
                              <div className="text-xs font-black">
                                {pc === '1' ? '1 Sayfa' : pc === '2' ? '2 Sayfa' : 'Otomatik'}
                              </div>
                              <div className="text-[9px] opacity-75 mt-0.5">
                                {pc === '1' ? 'Tam Sığdır' : pc === '2' ? 'Genişletilmiş' : 'Standart'}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Tablo Ölçeği & Büyütme / Küçültme (Zoom) */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                            <ZoomIn className="w-3.5 h-3.5 text-[#5a5a40]" />
                            Tablo Boyutu &amp; Zoom
                          </h4>
                          <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            %{printSettings.tableScale || 100}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8e8d82] mb-2.5">
                          Tüm tablonun (satır yüksekliği, punto, boşluklar) boyutunu orantılı ayarlayın.
                        </p>

                        <div className="flex items-center gap-1.5 mb-2.5">
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: Math.max(60, (prev.tableScale || 100) - 5) }))}
                            className="p-1.5 bg-[#fcfbf7] border border-[#e6e2d3] hover:bg-[#f0ede4] rounded-lg text-[#5a5a40] cursor-pointer"
                            title="Küçült (-%5)"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="65"
                            max="145"
                            step="5"
                            value={printSettings.tableScale || 100}
                            onChange={(e) => setPrintSettings(prev => ({ ...prev, tableScale: Number(e.target.value) }))}
                            className="flex-1 accent-[#5a5a40] cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: Math.min(160, (prev.tableScale || 100) + 5) }))}
                            className="p-1.5 bg-[#fcfbf7] border border-[#e6e2d3] hover:bg-[#f0ede4] rounded-lg text-[#5a5a40] cursor-pointer"
                            title="Büyüt (+%5)"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: 85 }))}
                            className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center ${
                              printSettings.tableScale === 85
                                ? 'bg-[#5a5a40] text-white border-[#5a5a40]'
                                : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                            }`}
                          >
                            %85 Kompakt
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: 100 }))}
                            className={`px-1.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer text-center ${
                              (printSettings.tableScale || 100) === 100
                                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            ★ %100 Tam Doldur
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, tableScale: 115 }))}
                            className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center ${
                              printSettings.tableScale === 115
                                ? 'bg-[#5a5a40] text-white border-[#5a5a40]'
                                : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                            }`}
                          >
                            %115 Geniş
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] font-medium text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200/80 flex items-center gap-1 mt-2">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>30 deneme sınavı A4 dikey 1 sayfayı tam dolduracak şekilde kalibre edilmiştir.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Tipografi & Sütunlar */}
                {settingsTab === 'typography' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Yazı Tipi Ailesi */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Yazı Tipi (Font)
                        </h4>
                        <p className="text-[11px] text-[#8e8d82] mb-3">Rapor tipografisini seçin.</p>
                        <div className="space-y-1.5">
                          {[
                            { id: 'sans', label: 'Modern (Sans-Serif)', sample: 'Atatürk Ortaokulu 2026' },
                            { id: 'serif', label: 'Resmi / Klasik (Serif)', sample: 'Atatürk Ortaokulu 2026', fontClass: 'font-serif' },
                            { id: 'mono', label: 'Teknik / Tablo (Mono)', sample: 'Atatürk Ortaokulu 2026', fontClass: 'font-mono' },
                          ].map(font => (
                            <button
                              key={font.id}
                              type="button"
                              onClick={() => setPrintSettings(prev => ({ ...prev, fontFamily: font.id as any }))}
                              className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer ${
                                printSettings.fontFamily === font.id
                                  ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                  : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                              }`}
                            >
                              <div className="text-xs font-bold">{font.label}</div>
                              <div className={`text-[10px] opacity-80 ${font.fontClass || ''}`}>{font.sample}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Yazı Büyüklüğü */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Yazı Büyüklüğü
                        </h4>
                        <p className="text-[11px] text-[#8e8d82] mb-3">Tablo yazı puntosu ölçeği.</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'auto', label: 'Otomatik', sub: 'Akıllı Fit' },
                            { id: 'compact', label: 'Kompakt', sub: 'Küçük Punto' },
                            { id: 'normal', label: 'Standart', sub: 'Dengeli' },
                            { id: 'spacious', label: 'Geniş', sub: 'Büyük Punto' },
                          ].map(scale => (
                            <button
                              key={scale.id}
                              type="button"
                              onClick={() => setPrintSettings(prev => ({ ...prev, fontScale: scale.id as any }))}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                printSettings.fontScale === scale.id
                                  ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                  : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                              }`}
                            >
                              <div className="text-xs font-bold">{scale.label}</div>
                              <div className="text-[9px] opacity-75">{scale.sub}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Yazı Kalınlığı */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Yazı Kalınlığı
                        </h4>
                        <p className="text-[11px] text-[#8e8d82] mb-3">Metin ağırlık derecesi.</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'light', label: 'İnce (Light)', cls: 'font-normal' },
                            { id: 'normal', label: 'Normal (Regular)', cls: 'font-medium' },
                            { id: 'medium', label: 'Orta (Medium)', cls: 'font-semibold' },
                            { id: 'bold', label: 'Kalın (Bold)', cls: 'font-black' },
                          ].map(w => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setPrintSettings(prev => ({ ...prev, fontWeight: w.id as any }))}
                              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${w.cls} ${
                                printSettings.fontWeight === w.id
                                  ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                  : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f0ede4]'
                              }`}
                            >
                              <div className="text-xs">{w.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Görünecek Sütunlar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Görünecek Sütunlar
                        </h4>
                        <p className="text-[11px] text-[#8e8d82] mb-3">Tabloda yer alacak veriler.</p>
                        <div className="space-y-1.5">
                          <label className="flex items-center justify-between p-2 rounded-xl bg-[#fcfbf7] border border-[#e6e2d3] cursor-pointer hover:bg-[#f0ede4] transition-colors">
                            <span className="text-xs font-bold text-[#5a5a40]">Katılımcı Sayısı (Katılan)</span>
                            <input 
                              type="checkbox" 
                              checked={printSettings.showParticipants}
                              onChange={(e) => setPrintSettings(prev => ({ ...prev, showParticipants: e.target.checked }))}
                              className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4"
                            />
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-xl bg-[#fcfbf7] border border-[#e6e2d3] cursor-pointer hover:bg-[#f0ede4] transition-colors">
                            <span className="text-xs font-bold text-[#5a5a40]">Yayıncı Adı [Yayıncı]</span>
                            <input 
                              type="checkbox" 
                              checked={printSettings.showPublisher}
                              onChange={(e) => setPrintSettings(prev => ({ ...prev, showPublisher: e.target.checked }))}
                              className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4"
                            />
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-xl bg-[#fcfbf7] border border-[#e6e2d3] cursor-pointer hover:bg-[#f0ede4] transition-colors">
                            <span className="text-xs font-bold text-[#5a5a40]">Sipariş Miktarı</span>
                            <input 
                              type="checkbox" 
                              checked={printSettings.showOrderQuantity}
                              onChange={(e) => setPrintSettings(prev => ({ ...prev, showOrderQuantity: e.target.checked }))}
                              className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4"
                            />
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-xl bg-[#fcfbf7] border border-[#e6e2d3] cursor-pointer hover:bg-[#f0ede4] transition-colors">
                            <span className="text-xs font-bold text-[#5a5a40]">Sınav Salonları</span>
                            <input 
                              type="checkbox" 
                              checked={printSettings.showHalls}
                              onChange={(e) => setPrintSettings(prev => ({ ...prev, showHalls: e.target.checked }))}
                              className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Başlıklar & Alt Bilgi */}
                {settingsTab === 'content' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Başlık Metinleri */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Belge Başlıkları
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setPrintMainTitle('KIRKLARELİ ATATÜRK ORTAOKULU');
                            updateSubTitleForGrades(selectedGrades);
                          }}
                          className="text-xs text-[#8e8d82] hover:text-[#5a5a40] font-bold underline cursor-pointer"
                        >
                          Varsayılana Dön
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-[#5a5a40] mb-1">
                            Ana Başlık (Kurum / Okul Adı)
                          </label>
                          <input
                            type="text"
                            value={printMainTitle}
                            onChange={(e) => setPrintMainTitle(e.target.value)}
                            placeholder="Örn: KIRKLARELİ ATATÜRK ORTAOKULU"
                            className="w-full bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs font-bold text-[#5a5a40] focus:ring-2 focus:ring-[#5a5a40] outline-none"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-[#5a5a40]">
                              Alt Başlık (Dönem &amp; Takvim Adı)
                            </label>
                            <button
                              type="button"
                              onClick={() => updateSubTitleForGrades(selectedGrades)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                            >
                              Sınıfa Göre Başlık Üret
                            </button>
                          </div>
                          <input
                            type="text"
                            value={printSubTitle}
                            onChange={(e) => setPrintSubTitle(e.target.value)}
                            placeholder="Örn: 2025-2026 EĞİTİM ÖĞRETİM YILI DENEME SINAVLARI TAKVİMİ"
                            className="w-full bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs font-semibold text-[#5a5a40] focus:ring-2 focus:ring-[#5a5a40] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Alt Bilgi (Footer) Yapılandırması */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#5a5a40]" />
                          Alt Bilgi (Footer) Ayarları
                        </h4>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center space-x-2 bg-[#fcfbf7] p-2.5 rounded-xl border border-[#e6e2d3] cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={printSettings.showFooter}
                            onChange={(e) => setPrintSettings(prev => ({ ...prev, showFooter: e.target.checked }))}
                            className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-4 w-4"
                          />
                          <span className="text-xs font-bold text-[#5a5a40]">Sayfa Alt Bilgisini (Footer) Yazdır</span>
                        </label>

                        {printSettings.showFooter && (
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-[#5a5a40]">
                              Alt Bilgi Metni
                            </label>
                            <input 
                              type="text"
                              value={printSettings.footerText}
                              onChange={(e) => setPrintSettings(prev => ({ ...prev, footerText: e.target.value }))}
                              placeholder="Örn: Kırklareli Atatürk Ortaokulu Sınav Koordinatörlüğü"
                              className="w-full bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs font-semibold text-[#5a5a40] focus:ring-2 focus:ring-[#5a5a40] outline-none"
                            />
                            <p className="text-[11px] text-[#8e8d82]">
                              ℹ Sayfa numarası, toplam sınav adedi ve basım tarihi PDF çıktısında otomatik eklenir.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Yayıncı Renk Paleti (Canlı Eşitleme & PDF Desteği) */}
                {settingsTab === 'colors' && (
                  <div className="space-y-4">
                    {/* Üst Yönetim Çubuğu */}
                    <div className="bg-white p-4 rounded-2xl border border-[#e6e2d3] shadow-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-[#5a5a40] uppercase tracking-wider flex items-center gap-2">
                          <Palette className="w-4 h-4 text-amber-600" />
                          Yayıncı Renk Yönetim Merkezi
                        </h4>
                        <p className="text-xs text-[#8e8d82] mt-0.5">
                          Belirlediğiniz renkler ekrandaki takvimde, PDF indirmesinde ve baskıda %100 birebir aynı tonda uygulanır.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Renklendirme Stili (Sadece Sınav Adı vs Tüm Satır) */}
                        <div className="flex items-center gap-1 bg-[#fcfbf7] p-1 rounded-xl border border-[#e6e2d3]">
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, colorMode: 'nameCell' }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              printSettings.colorMode !== 'fullRow'
                                ? 'bg-[#5a5a40] text-white shadow-xs'
                                : 'text-[#8e8d82] hover:text-[#5a5a40]'
                            }`}
                          >
                            Sadece Sınav Adı
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintSettings(prev => ({ ...prev, colorMode: 'fullRow' }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              printSettings.colorMode === 'fullRow'
                                ? 'bg-[#5a5a40] text-white shadow-xs'
                                : 'text-[#8e8d82] hover:text-[#5a5a40]'
                            }`}
                          >
                            Tüm Satır
                          </button>
                        </div>

                        {/* Otomatik Renk Dağıt */}
                        <button
                          type="button"
                          onClick={handleAutoDistributeColors}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer shadow-xs"
                          title="Tüm yayıncılara çakışmayan estetik pastel renkler ata"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Renkleri Otomatik Dağıt</span>
                        </button>

                        {/* Renkleri Sıfırla */}
                        <button
                          type="button"
                          onClick={handleResetPublisherColors}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fcfbf7] text-[#8e8d82] hover:text-[#5a5a40] border border-[#e6e2d3] rounded-xl text-xs font-bold hover:bg-white transition-all cursor-pointer"
                          title="Tüm yayıncı renklerini varsayılana sıfırla"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Renkleri Sıfırla</span>
                        </button>
                      </div>
                    </div>

                    {/* Yayıncı Renk Kartları */}
                    {uniquePublishers.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-[#e6e2d3] text-center text-[#8e8d82]">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-[#8e8d82]/60" />
                        <p className="text-xs font-bold">Listelenen sınavlarda tanımlı yayıncı bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {uniquePublishers.map(pub => {
                          const pubName = pub || 'Bilinmiyor';
                          const colorInfo = getPublisherColorInfo(pubName, publisherColors);
                          const examCountForPub = state.exams.filter(e => (e.publisher || '').trim() === pubName).length;

                          return (
                            <div 
                              key={pub} 
                              className="bg-white p-3.5 rounded-2xl border border-[#e6e2d3] shadow-xs hover:border-[#5a5a40]/30 transition-all"
                            >
                              {/* Kart Başlığı */}
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div 
                                    className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-xs"
                                    style={{ backgroundColor: colorInfo.hex }}
                                  />
                                  <span className="text-xs font-black text-[#5a5a40] truncate" title={pubName}>
                                    {pubName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] bg-[#f0ece1] text-[#5a5a40] font-bold px-2 py-0.5 rounded-full">
                                    {examCountForPub} Sınav
                                  </span>
                                  <span 
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded border"
                                    style={{ 
                                      backgroundColor: colorInfo.hex, 
                                      borderColor: colorInfo.borderHex,
                                      color: colorInfo.textHex 
                                    }}
                                  >
                                    {colorInfo.hex}
                                  </span>
                                </div>
                              </div>

                              {/* 16 Renkli Hızlı Pastel Palet Seçici */}
                              <div className="space-y-2 pt-1 border-t border-[#e6e2d3]/60">
                                <div className="flex flex-wrap gap-1.5">
                                  {PUBLISHER_COLOR_PALETTE.map(opt => {
                                    const isCurrent = colorInfo.hex.toLowerCase() === opt.hex.toLowerCase();
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setPublisherColors(prev => ({ ...prev, [pubName]: opt.hex }))}
                                        className={`w-6 h-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center cursor-pointer border ${
                                          isCurrent 
                                            ? 'ring-2 ring-[#5a5a40] ring-offset-1 scale-105 border-black/30' 
                                            : 'border-black/10 hover:border-black/30'
                                        }`}
                                        style={{ backgroundColor: opt.hex }}
                                        title={`${opt.label} (${opt.hex})`}
                                      >
                                        {isCurrent && (
                                          <Check className="w-3 h-3 text-[#111827] stroke-[3]" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Özel Renk Damlalığı ve Sıfırlama */}
                                <div className="flex items-center justify-between pt-1">
                                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#8e8d82] hover:text-[#5a5a40] cursor-pointer">
                                    <input
                                      type="color"
                                      value={colorInfo.hex}
                                      onChange={(e) => setPublisherColors(prev => ({ ...prev, [pubName]: e.target.value }))}
                                      className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                                      title="Özel Renk Seç"
                                    />
                                    <span>Özel Renk Seç</span>
                                  </label>

                                  {publisherColors[pubName] && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPublisherColors(prev => {
                                          const next = { ...prev };
                                          delete next[pubName];
                                          return next;
                                        });
                                      }}
                                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                                      title="Bu yayıncının rengini varsayılana döndür"
                                    >
                                      Sıfırla
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Print Body */}
            <div 
              id="print-area-takvim" 
              className={`flex-1 overflow-y-auto p-3 md:p-4 bg-white print:p-0 print:overflow-visible flex flex-col justify-start max-w-full ${
                isSinglePage ? 'single-page-mode print:justify-between' : ''
              }`}
              style={{ fontFamily: fontFamilyCss }}
            >
              {/* Native Print Page Orientation Stylesheet */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page {
                    size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                    margin: 4mm 6mm;
                  }
                  #print-area-takvim {
                    font-family: ${fontFamilyCss} !important;
                    height: ${isSinglePage ? (isLandscape ? '202mm' : '289mm') : 'auto'} !important;
                    max-height: ${isSinglePage ? (isLandscape ? '202mm' : '289mm') : 'none'} !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: ${isSinglePage ? 'space-between' : 'flex-start'} !important;
                  }
                  .takvim-table-wrapper {
                    flex: ${isSinglePage ? '1 1 auto' : 'none'} !important;
                  }
                  .takvim-table {
                    height: ${isSinglePage ? '100%' : 'auto'} !important;
                  }
                  .col-no {
                    width: ${isLandscape ? '16mm' : '15mm'} !important;
                    min-width: ${isLandscape ? '16mm' : '15mm'} !important;
                    white-space: nowrap !important;
                  }
                  .col-date {
                    width: ${isLandscape ? '46mm' : '44mm'} !important;
                    min-width: ${isLandscape ? '46mm' : '44mm'} !important;
                    white-space: nowrap !important;
                  }
                }
              `}} />

              {/* Takvim Header (Başlıklar dahil optimize edilir) */}
              <div 
                className="takvim-header text-center border-b-[1.5px] border-black group"
                style={{ 
                  marginBottom: headerLayout.marginBottom, 
                  paddingBottom: headerLayout.paddingY 
                }}
              >
                <div className="flex items-center justify-center relative">
                  <input
                    type="text"
                    value={printMainTitle}
                    onChange={(e) => setPrintMainTitle(e.target.value)}
                    placeholder="OKUL / KURUM ADI"
                    style={{ fontSize: headerLayout.mainTitlePt }}
                    className="takvim-title-main text-center font-black uppercase tracking-wide text-gray-900 w-full bg-transparent hover:bg-amber-50/60 focus:bg-amber-50/90 focus:ring-1 focus:ring-amber-400 rounded-lg px-2 py-0.5 outline-none transition-all cursor-text leading-tight"
                    title="Okul adını doğrudan düzenlemek için tıklayın (Elle doldurulabilir)"
                  />
                </div>
                <div className="flex items-center justify-center relative mt-0.5">
                  <input
                    type="text"
                    value={printSubTitle}
                    onChange={(e) => setPrintSubTitle(e.target.value)}
                    placeholder="DENEME SINAVLARI TAKVİMİ BAŞLIĞI"
                    style={{ fontSize: headerLayout.subTitlePt }}
                    className="takvim-title-sub text-center font-extrabold text-gray-700 uppercase w-full bg-transparent hover:bg-amber-50/60 focus:bg-amber-50/90 focus:ring-1 focus:ring-amber-400 rounded-lg px-2 py-0.5 outline-none transition-all cursor-text leading-tight"
                    title="Takvim başlığını doğrudan düzenlemek için tıklayın (Elle doldurulabilir)"
                  />
                </div>
              </div>

              {/* Takvim Table */}
              <div className="takvim-table-wrapper flex-1 overflow-x-auto">
                <table className="takvim-table w-full border-collapse border-[1.5px] border-black text-center text-xs">
                  <thead>
                    <tr style={{ height: `${theadLayout.theadHeightMm}mm` }}>
                      <th 
                        className="col-no border-[1.5px] border-black bg-gray-200 px-1.5 text-center leading-none whitespace-nowrap"
                        style={{ 
                          width: isLandscape ? '60px' : '56px',
                          minWidth: isLandscape ? '60px' : '56px',
                          fontSize: theadLayout.theadFontSizePt, 
                          fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                          paddingTop: theadLayout.paddingY, 
                          paddingBottom: theadLayout.paddingY 
                        }}
                      >
                        ÖLÇME
                      </th>
                      <th 
                        className="col-date border-[1.5px] border-black bg-gray-200 px-2 text-center leading-none whitespace-nowrap"
                        style={{ 
                          width: isLandscape ? '180px' : '168px',
                          minWidth: isLandscape ? '180px' : '168px',
                          fontSize: theadLayout.theadFontSizePt, 
                          fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                          paddingTop: theadLayout.paddingY, 
                          paddingBottom: theadLayout.paddingY 
                        }}
                      >
                        TARİH
                      </th>
                      <th 
                        className="border-[1.5px] border-black bg-gray-200 px-2 text-left leading-none"
                        style={{ 
                          fontSize: theadLayout.theadFontSizePt, 
                          fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                          paddingTop: theadLayout.paddingY, 
                          paddingBottom: theadLayout.paddingY 
                        }}
                      >
                        {!selectedGrades.includes('Tümü') && selectedGrades.length > 0
                          ? selectedGrades.sort((a,b) => a.localeCompare(b, 'tr', {numeric: true})).map(g => g === 'Diğer' ? 'DİĞER' : `${g}. SINIF`).join(', ')
                          : 'SINAV ADI'}
                      </th>
                      {printSettings.showOrderQuantity && (
                        <th 
                          className="border-[1.5px] border-black bg-gray-200 px-1 w-14 text-center leading-none"
                          style={{ 
                            fontSize: theadLayout.theadFontSizePt, 
                            fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                            paddingTop: theadLayout.paddingY, 
                            paddingBottom: theadLayout.paddingY 
                          }}
                        >
                          SİPARİŞ
                        </th>
                      )}
                      {printSettings.showHalls && (
                        <th 
                          className="border-[1.5px] border-black bg-gray-200 px-1 w-24 text-center leading-none"
                          style={{ 
                            fontSize: theadLayout.theadFontSizePt, 
                            fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                            paddingTop: theadLayout.paddingY, 
                            paddingBottom: theadLayout.paddingY 
                          }}
                        >
                          SALONLAR
                        </th>
                      )}
                      {printSettings.showParticipants && (
                        <th 
                          className="border-[1.5px] border-black bg-gray-200 px-1 w-16 text-center leading-none"
                          style={{ 
                            fontSize: theadLayout.theadFontSizePt, 
                            fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                            paddingTop: theadLayout.paddingY, 
                            paddingBottom: theadLayout.paddingY 
                          }}
                        >
                          KATILAN KİŞİ
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody style={{ fontWeight: fontWeightCss }}>
                    {filteredAndSortedExams.map((exam, index) => {
                      const pubName = (exam.publisher || 'Bilinmiyor').trim();
                      const colorInfo = getPublisherColorInfo(pubName, publisherColors);
                      const isFullRow = printSettings.colorMode === 'fullRow';
                      const rowBgHex = isFullRow ? colorInfo.hex : undefined;
                      
                      const registeredCount = state.students.filter(s => s.examRegistrations?.some(r => r.examId === exam.id)).length;
                      const assignedHallsText = exam.assignedHalls && exam.assignedHalls.length > 0
                        ? exam.assignedHalls.map(hid => state.examHalls.find((h: any) => h.id === hid)?.name).filter(Boolean).join(', ')
                        : 'Atanmadı';

                      return (
                        <tr 
                          key={exam.id} 
                          className="border-b border-black" 
                          style={{ height: `${optimalRowHeightMm}mm`, minHeight: `${optimalRowHeightMm}mm` }}
                        >
                          <td 
                            className="col-no border-[1.5px] border-black font-mono text-center whitespace-nowrap"
                            style={{ 
                              width: isLandscape ? '60px' : '56px',
                              minWidth: isLandscape ? '60px' : '56px',
                              whiteSpace: 'nowrap',
                              backgroundColor: rowBgHex,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontSize: optimalFontSizePt, 
                              fontWeight: printSettings.fontWeight === 'light' ? 500 : 700,
                              paddingTop: cellPaddingY, 
                              paddingBottom: cellPaddingY, 
                              paddingLeft: cellPaddingX, 
                              paddingRight: cellPaddingX 
                            }}
                          >
                            {exam.no !== undefined && exam.no > 0 ? exam.no : index + 1}
                          </td>
                          <td 
                            className="col-date border-[1.5px] border-black font-mono text-center whitespace-nowrap"
                            style={{ 
                              width: isLandscape ? '180px' : '168px',
                              minWidth: isLandscape ? '180px' : '168px',
                              whiteSpace: 'nowrap',
                              backgroundColor: rowBgHex,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                              fontSize: optimalFontSizePt, 
                              fontWeight: printSettings.fontWeight === 'light' ? 400 : 600,
                              paddingTop: cellPaddingY, 
                              paddingBottom: cellPaddingY, 
                              paddingLeft: cellPaddingX, 
                              paddingRight: cellPaddingX 
                            }}
                          >
                            {formatDateLong(exam.date)}
                          </td>
                          <td 
                            className="col-name border-[1.5px] border-black text-left text-gray-900 print:exact-colors leading-snug" 
                            style={{ 
                              backgroundColor: colorInfo.hex,
                              WebkitPrintColorAdjust: 'exact', 
                              printColorAdjust: 'exact',
                              fontSize: optimalFontSizePt, 
                              fontWeight: printSettings.fontWeight === 'light' ? 400 : printSettings.fontWeight === 'normal' ? 500 : printSettings.fontWeight === 'medium' ? 600 : 700,
                              paddingTop: cellPaddingY, 
                              paddingBottom: cellPaddingY, 
                              paddingLeft: '6px', 
                              paddingRight: '4px' 
                            }}
                          >
                            {exam.name} {printSettings.showPublisher && exam.publisher ? `(${exam.publisher})` : ''}
                          </td>
                          {printSettings.showOrderQuantity && (
                            <td 
                              className="col-order border-[1.5px] border-black text-center"
                              style={{ 
                                backgroundColor: rowBgHex,
                                WebkitPrintColorAdjust: 'exact',
                                printColorAdjust: 'exact',
                                fontSize: optimalFontSizePt, 
                                fontWeight: printSettings.fontWeight === 'light' ? 500 : 700,
                                paddingTop: cellPaddingY, 
                                paddingBottom: cellPaddingY, 
                                paddingLeft: cellPaddingX, 
                                paddingRight: cellPaddingX 
                              }}
                            >
                              {exam.orderQuantity || 0}
                            </td>
                          )}
                          {printSettings.showHalls && (
                            <td 
                              className="col-halls border-[1.5px] border-black leading-tight text-center"
                              style={{ 
                                backgroundColor: rowBgHex,
                                WebkitPrintColorAdjust: 'exact',
                                printColorAdjust: 'exact',
                                fontSize: optimalFontSizePt, 
                                fontWeight: printSettings.fontWeight === 'light' ? 400 : 500,
                                paddingTop: cellPaddingY, 
                                paddingBottom: cellPaddingY, 
                                paddingLeft: cellPaddingX, 
                                paddingRight: cellPaddingX 
                              }}
                            >
                              {assignedHallsText}
                            </td>
                          )}
                          {printSettings.showParticipants && (
                            <td 
                              className="col-participants border-[1.5px] border-black bg-red-600 text-white print:exact-colors text-center" 
                              style={{ 
                                WebkitPrintColorAdjust: 'exact', 
                                printColorAdjust: 'exact',
                                fontSize: optimalFontSizePt, 
                                fontWeight: printSettings.fontWeight === 'light' ? 600 : 800,
                                paddingTop: cellPaddingY, 
                                paddingBottom: cellPaddingY, 
                                paddingLeft: cellPaddingX, 
                                paddingRight: cellPaddingX 
                              }}
                            >
                              {registeredCount > 0 ? registeredCount : (exam.participantCount || 0)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filteredAndSortedExams.length === 0 && (
                      <tr>
                        <td colSpan={6} className="border-[1.5px] border-black py-4 text-gray-500 font-semibold text-xs">
                          Bu filtreye uygun sınav bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Kurumsal Alt Bilgi / Footer */}
              {printSettings.showFooter && (
                <div 
                  className="takvim-footer flex items-center justify-between pt-1 mt-1 border-t border-black text-gray-700"
                  style={{ 
                    fontSize: footerLayout.fontSizePt,
                    fontWeight: fontWeightCss
                  }}
                >
                  <span className="truncate max-w-[65%]">{printSettings.footerText || (printMainTitle ? `${printMainTitle} Sınav Koordinatörlüğü` : 'Kırklareli Atatürk Ortaokulu Sınav Koordinatörlüğü')}</span>
                  <span className="shrink-0 text-right">Yazdırma Tarihi: {new Date().toLocaleDateString('tr-TR')} • Toplam: {examCount} Sınav</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
