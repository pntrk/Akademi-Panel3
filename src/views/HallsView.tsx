import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ExamHall, SeatingPlanItem, Exam, AbsentStudentInfo, HallAttendance } from '../types';
import { generateId, exportToExcel, formatDateLong, parseDateObj } from '../lib/utils';
import { auth } from '../lib/firebase';
import { 
  findTodayExamForHall, 
  submitHallAttendance, 
  fetchAllAttendances, 
  getLocalAttendances,
  isExamDateMatches 
} from '../lib/attendance';
import { 
  Plus, Trash2, Download, LayoutTemplate, X, Users, RefreshCw, 
  AlertCircle, Building, MapPin, Search, ChevronDown, 
  ChevronRight, CheckCircle2, Eye, Printer, FileSpreadsheet, Sparkles, Check,
  UserCheck, UserX, Clock, Calendar, BellRing, Send, AlertTriangle, ShieldCheck
} from 'lucide-react';

// Renkli şube rozetleri için dinamik pastel renk eşleştirici (Kelebek dağıtımını görselleştirir)
const getClassBadgeColor = (className?: string) => {
  if (!className) return 'bg-gray-100 text-gray-700 border-gray-200';
  const colors = [
    'bg-blue-50 text-blue-700 border-blue-200/80',
    'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    'bg-purple-50 text-purple-700 border-purple-200/80',
    'bg-amber-50 text-amber-800 border-amber-200/80',
    'bg-rose-50 text-rose-700 border-rose-200/80',
    'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    'bg-teal-50 text-teal-700 border-teal-200/80',
  ];
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Sisteme giriş yapmış olan öğretmenin veya yöneticinin doğrulanmış e-posta ve ad bilgilerini tespit eder
const getActiveTeacherIdentity = (teachersList: string[] = []): { email: string; displayName: string } => {
  // 1. Firebase Auth doğrudan kontrolü
  const currentUser = auth.currentUser;
  if (currentUser?.email) {
    return {
      email: currentUser.email.trim().toLowerCase(),
      displayName: currentUser.displayName || currentUser.email.split('@')[0]
    };
  }

  // 2. Tarayıcı oturum hafızası kontrolü
  try {
    const rawSession = localStorage.getItem('akademi_user_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.email) {
        return {
          email: parsed.email.trim().toLowerCase(),
          displayName: parsed.displayName || parsed.name || parsed.email.split('@')[0]
        };
      }
    }
  } catch {}

  // 3. Tekil kullanıcı e-posta anahtarı
  try {
    const savedEmail = localStorage.getItem('akademi_user_email');
    if (savedEmail) {
      return {
        email: savedEmail.trim().toLowerCase(),
        displayName: savedEmail.split('@')[0]
      };
    }
  } catch {}

  // 4. Öğretmenler listesindeki ilk kayıt veya genel etiket
  const fallback = teachersList.length > 0 ? teachersList[0] : '';
  if (fallback.includes('@')) {
    return {
      email: fallback.trim().toLowerCase(),
      displayName: fallback.split('@')[0]
    };
  }

  return {
    email: fallback || '',
    displayName: fallback || 'Gözetmen Öğretmen'
  };
};

export const HallsView = () => {
  const { state, setExamHalls, userRole } = useAppContext();
  // Adminler yönetici modunda tam yetkilidir, öğretmenler ise salt-okunur moddadır
  const isReadOnly = userRole !== 'admin';
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHallId, setEditingHallId] = useState<string | null>(null);
  const [mobileModalTab, setMobileModalTab] = useState<'settings' | 'preview'>('preview');
  
  // State declarations
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingHallId, setDeletingHallId] = useState<string | null>(null);

  // Modal states
  const [hallName, setHallName] = useState('');
  const [columns, setColumns] = useState<{id: string, deskCount: number, seatsPerDesk: number, name: string}[]>([
    { id: generateId(), name: 'Cam Kenarı', deskCount: 5, seatsPerDesk: 2 },
    { id: generateId(), name: 'Orta', deskCount: 5, seatsPerDesk: 2 },
    { id: generateId(), name: 'Duvar Kenarı', deskCount: 5, seatsPerDesk: 2 }
  ]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [seatingPlan, setSeatingPlan] = useState<SeatingPlanItem[]>([]);
  const [deselectedStudentIds, setDeselectedStudentIds] = useState<string[]>([]);
  const [draggedSeatNum, setDraggedSeatNum] = useState<number | null>(null);
  const [dragOverSeatNum, setDragOverSeatNum] = useState<number | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [highlightStudentQuery, setHighlightStudentQuery] = useState('');

  // -------------------------------------------------------------
  // YENİLİKÇİ ÖZELLİK: Sınav Takvimi, Yoklama ve İdareye Bildirim
  // -------------------------------------------------------------
  const [attendances, setAttendances] = useState<Record<string, HallAttendance>>({});
  const [modalMode, setModalMode] = useState<'layout' | 'attendance'>('layout');
  const [activeExamForAttendance, setActiveExamForAttendance] = useState<Exam | null>(null);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [simulationDateStr, setSimulationDateStr] = useState<string>(''); // Test simülasyonu için

  const capacity = columns.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0);

  // Toast bildirim yöneticisi
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3500);
  };

  // Yoklama verilerini başlangıçta ve periyodik yükle
  useEffect(() => {
    const cached = getLocalAttendances();
    if (cached && Object.keys(cached).length > 0) {
      setAttendances(cached);
    }

    fetchAllAttendances('main').then(remote => {
      if (remote && Object.keys(remote).length > 0) {
        setAttendances(prev => ({ ...prev, ...remote }));
      }
    });
  }, []);

  // Tarih değerlendirme: Simülasyon seçilmişse o tarihi, yoksa bugünün gerçek tarihini kullanır
  const effectiveCalendarDate = useMemo(() => {
    if (simulationDateStr) {
      const parsed = parseDateObj(simulationDateStr);
      if (parsed) return parsed;
    }
    return new Date();
  }, [simulationDateStr]);

  // Takvimde bugün veya seçili günde olan genel sınavları bul
  const examsOnSelectedDate = useMemo(() => {
    return state.exams.filter(e => isExamDateMatches(e.date, effectiveCalendarDate));
  }, [state.exams, effectiveCalendarDate]);

  const connectedExamNames = useMemo(() => {
    if (!selectedExamIds || selectedExamIds.length === 0) return [];
    return state.exams.filter(ex => selectedExamIds.includes(ex.id)).map(e => e.name);
  }, [state.exams, selectedExamIds]);

  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(state.students.map(s => s.className).filter(Boolean))).sort();
  }, [state.students]);

  // Helper to extract grade level from class name
  const getGradeLevel = (clsName: string): string => {
    const match = clsName.trim().match(/^(\d+)/);
    return match ? match[1] : 'Diğer';
  };

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

  const toggleGrade = (grade: string) => {
    const isChecked = selectedGrades.includes(grade);
    const classesOfThisGrade = uniqueClasses.filter(c => getGradeLevel(c) === grade);
    
    if (isChecked) {
      setSelectedGrades(selectedGrades.filter(g => g !== grade));
      setSelectedClasses(selectedClasses.filter(c => getGradeLevel(c) !== grade));
    } else {
      setSelectedGrades([...selectedGrades, grade]);
      const otherClasses = selectedClasses.filter(c => getGradeLevel(c) !== grade);
      setSelectedClasses([...otherClasses, ...classesOfThisGrade]);
    }
  };

  const toggleBranch = (clsName: string) => {
    const grade = getGradeLevel(clsName);
    if (selectedClasses.includes(clsName)) {
      const newClasses = selectedClasses.filter(c => c !== clsName);
      setSelectedClasses(newClasses);
      const remainingOfGrade = newClasses.filter(c => getGradeLevel(c) === grade);
      if (remainingOfGrade.length === 0) {
        setSelectedGrades(selectedGrades.filter(g => g !== grade));
      }
    } else {
      const newClasses = [...selectedClasses, clsName];
      setSelectedClasses(newClasses);
      if (!selectedGrades.includes(grade)) {
        setSelectedGrades([...selectedGrades, grade]);
      }
    }
  };

  const filteredExams = useMemo(() => {
    if (selectedGrades.length === 0) return [];
    return state.exams.filter(exam => {
      if (exam.participatingClasses && exam.participatingClasses.length > 0) {
        return exam.participatingClasses.some(cls => {
          const match = cls.trim().match(/^(\d+)/);
          const g = match ? match[1] : 'Diğer';
          return selectedGrades.includes(g);
        });
      }
      return selectedGrades.some(g => exam.name.toLowerCase().includes(`${g}.sınıf`) || exam.name.toLowerCase().includes(`${g}. sınıf`));
    });
  }, [state.exams, selectedGrades]);

  const registeredStudentsForSeating = useMemo(() => {
    if (selectedClasses.length === 0) return [];
    return state.students.filter(student => {
      const classMatch = selectedClasses.includes(student.className);
      if (!classMatch) return false;
      if (selectedExamIds.length > 0) {
        const studentRegistrations = student.examRegistrations || [];
        return studentRegistrations.some(reg => selectedExamIds.includes(reg.examId));
      }
      return true;
    });
  }, [state.students, selectedClasses, selectedExamIds]);

  const activeStudentsForSeating = useMemo(() => {
    return registeredStudentsForSeating.filter(s => !deselectedStudentIds.includes(s.id));
  }, [registeredStudentsForSeating, deselectedStudentIds]);

  const openNewModal = () => {
    if (isReadOnly) return;
    setEditingHallId(null);
    setHallName('');
    setColumns([
      { id: generateId(), name: 'Cam Kenarı', deskCount: 5, seatsPerDesk: 2 },
      { id: generateId(), name: 'Orta', deskCount: 5, seatsPerDesk: 2 },
      { id: generateId(), name: 'Duvar Kenarı', deskCount: 5, seatsPerDesk: 2 }
    ]);
    setSelectedExamIds([]);
    setSelectedClasses([]);
    setSelectedGrades([]);
    setSeatingPlan([]);
    setDeselectedStudentIds([]);
    setMobileModalTab('settings');
    setModalMode('layout');
    setIsModalOpen(true);
  };

  const openEditModal = (hall: ExamHall, initialTab?: 'layout' | 'attendance', specificExam?: Exam) => {
    setEditingHallId(hall.id);
    setHallName(hall.name);
    setColumns(hall.columns && hall.columns.length > 0 ? hall.columns : [
      { id: generateId(), name: 'Sıra Düzeni', deskCount: Math.ceil((hall.capacity || 30) / 2), seatsPerDesk: 2 }
    ]);
    
    let initialExamIds = hall.examIds || [];
    if (initialExamIds.length === 0 && hall.examId) {
      initialExamIds = [hall.examId];
    }
    setSelectedExamIds(initialExamIds);
    setSelectedClasses(hall.selectedClasses || []);
    
    const initialClasses = hall.selectedClasses || [];
    const initialGrades = Array.from(new Set(initialClasses.map(c => {
      const match = c.trim().match(/^(\d+)/);
      return match ? match[1] : 'Diğer';
    })));
    setSelectedGrades(initialGrades);
    setSeatingPlan(hall.seatingPlan || []);
    
    const registered = state.students.filter(s => {
      const classMatch = (hall.selectedClasses || []).includes(s.className);
      if (!classMatch) return false;
      if (initialExamIds.length > 0) {
        return (s.examRegistrations || []).some(reg => initialExamIds.includes(reg.examId));
      }
      return (s.examRegistrations || []).length > 0;
    });
    const seatedIds = (hall.seatingPlan || []).map(sp => sp.studentId);
    const initialDeselected = registered.filter(s => !seatedIds.includes(s.id)).map(s => s.id);
    setDeselectedStudentIds(initialDeselected);
    setHighlightStudentQuery('');

    // Otomatik Sınav ve Gün Tespiti:
    // Salona ait bugünkü sınavı veya seçilen sınavı tespit et
    const detectedTodayExam = specificExam || findTodayExamForHall(hall, state.exams, effectiveCalendarDate);
    const matchedExam = detectedTodayExam || (state.exams.length > 0 ? state.exams[0] : null);
    setActiveExamForAttendance(matchedExam);

    // Eğer bu sınav ve salon için önceden kaydedilmiş yoklama varsa devamsızları yükle
    const existingKey = matchedExam ? `${matchedExam.id}_${hall.id}` : '';
    const existingRecord = existingKey ? attendances[existingKey] : undefined;
    const fallbackRecord = (Object.values(attendances) as HallAttendance[]).find(a => a.hallId === hall.id);
    const targetRecord = existingRecord || fallbackRecord;

    if (targetRecord && targetRecord.absentStudents && targetRecord.absentStudents.length > 0) {
      setAbsentStudentIds(targetRecord.absentStudents.map(s => s.studentId));
    } else {
      setAbsentStudentIds([]);
    }

    // Modal Sekmesi Seçimi:
    // 1. initialTab parametre olarak açıkça verildiyse onu kullan.
    // 2. Öğretmen kullanıcılar (isReadOnly):
    //    - Eğer bugün salonda aktif sınav varsa (detectedTodayExam) -> Varsayılan: 'attendance' (Sınav Yoklaması)
    //    - Sınav olmayan günlerde -> Varsayılan: 'layout' (Oturma Planı Önizlemesi)
    // 3. İdareciler (Admin): Varsayılan: 'layout' (Salon Düzenleme)
    let modeToOpen: 'layout' | 'attendance' = 'layout';
    if (initialTab) {
      modeToOpen = initialTab;
    } else if (isReadOnly) {
      modeToOpen = detectedTodayExam ? 'attendance' : 'layout';
    } else {
      modeToOpen = 'layout';
    }

    setModalMode(modeToOpen);
    setMobileModalTab(isReadOnly ? 'preview' : 'settings');
    setIsModalOpen(true);
  };

  // Doğrudan yoklama modunu açma kısayolu
  const openAttendanceModal = (hall: ExamHall, exam?: Exam) => {
    openEditModal(hall, 'attendance', exam);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHallId(null);
    setHighlightStudentQuery('');
    setModalMode('layout');
    setActiveExamForAttendance(null);
  };

  // Aktif salona ait kaydedilmiş yoklamadaki devamsız öğrenci ID'leri (Oturma Planı sekmesinde de kırmızı çerçeve ile gösterilir)
  const savedAbsentStudentIds = useMemo(() => {
    if (!editingHallId) return [];
    const relatedAttendances = (Object.values(attendances) as HallAttendance[]).filter(a => a.hallId === editingHallId);
    if (relatedAttendances.length === 0) return [];
    const latest = relatedAttendances.sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
    return latest?.absentStudents?.map(s => s.studentId) || [];
  }, [editingHallId, attendances]);

  // Keep active modal seating plan synced when state updates from Firebase
  useEffect(() => {
    if (isModalOpen && editingHallId) {
      const currentHall = state.examHalls.find(h => h.id === editingHallId);
      if (currentHall) {
        setHallName(currentHall.name);
        if (currentHall.seatingPlan) {
          setSeatingPlan(currentHall.seatingPlan);
        }
      }
    }
  }, [state.examHalls, editingHallId, isModalOpen]);

  // ESC tuşu ile modal kapatma desteği
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Drag & drop handlers (Yalnızca Admin düzenleme modunda)
  const handleDragStart = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly || modalMode === 'attendance') return;
    setDraggedSeatNum(seatNum);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', seatNum.toString());
  };

  const handleDragOver = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly || modalMode === 'attendance') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSeatNum !== seatNum) {
      setDragOverSeatNum(seatNum);
    }
  };

  const handleDragLeave = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly || modalMode === 'attendance') return;
    e.preventDefault();
    if (dragOverSeatNum === seatNum) {
      setDragOverSeatNum(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSeatNum: number) => {
    if (isReadOnly || modalMode === 'attendance') return;
    e.preventDefault();
    setDragOverSeatNum(null);
    const sourceSeatNum = draggedSeatNum;
    if (sourceSeatNum === null || sourceSeatNum === targetSeatNum) return;

    swapSeats(sourceSeatNum, targetSeatNum);
    setDraggedSeatNum(null);
  };

  const handleSeatClick = (seatNum: number) => {
    const seatedStudent = seatingPlan.find(s => s.deskNumber === seatNum);
    const targetStudentId = seatedStudent?.studentId || (seatedStudent as any)?.id;

    // Yoklama modunda VEYA öğretmen inceleme modunda sıraya/öğrenciye dokunulduğunda devamsızlık durumu değişir
    if (modalMode === 'attendance' || isReadOnly) {
      if (targetStudentId) {
        toggleStudentAbsent(targetStudentId);
      }
      return;
    }
    if (draggedSeatNum === null) {
      const hasStudent = seatingPlan.some(s => s.deskNumber === seatNum);
      if (hasStudent) {
        setDraggedSeatNum(seatNum);
      }
    } else {
      if (draggedSeatNum !== seatNum) {
        swapSeats(draggedSeatNum, seatNum);
      }
      setDraggedSeatNum(null);
    }
  };

  const swapSeats = (sourceSeatNum: number, targetSeatNum: number) => {
    if (isReadOnly) return;
    const sourceStudent = seatingPlan.find(s => s.deskNumber === sourceSeatNum);
    const targetStudent = seatingPlan.find(s => s.deskNumber === targetSeatNum);

    if (!sourceStudent && !targetStudent) return;

    let newPlan = seatingPlan.filter(s => s.deskNumber !== sourceSeatNum && s.deskNumber !== targetSeatNum);

    if (sourceStudent) {
      newPlan.push({ ...sourceStudent, deskNumber: targetSeatNum });
    }
    if (targetStudent) {
      newPlan.push({ ...targetStudent, deskNumber: sourceSeatNum });
    }

    setSeatingPlan(newPlan);

    // Auto save if editing an existing hall
    if (editingHallId) {
      const currentHall = state.examHalls.find(h => h.id === editingHallId);
      if (currentHall) {
        const updatedHall: ExamHall = {
          ...currentHall,
          seatingPlan: newPlan
        };
        setExamHalls(state.examHalls.map(h => h.id === editingHallId ? updatedHall : h));
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2000);
      }
    }
  };

  // Öğrenci devamsızlık durumunu aç/kapat
  const toggleStudentAbsent = (studentId: string) => {
    try {
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(35);
      }
    } catch {}
    setAbsentStudentIds(prev => {
      const isAlreadyAbsent = prev.includes(studentId);
      if (isAlreadyAbsent) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const markAllPresent = () => {
    setAbsentStudentIds([]);
    showToast('Tüm öğrenciler salonda (mevcut) olarak işaretlendi.');
  };

  // -------------------------------------------------------------
  // YOKLAMA KAYDI VE İDAREYE ANLIK PUSH BİLDİRİM GÖNDERME
  // -------------------------------------------------------------
  const handleSaveAndBroadcastAttendance = async () => {
    if (!activeExamForAttendance) {
      showToast('Lütfen önce yoklama alınacak sınavı seçin.');
      return;
    }

    const currentHall = state.examHalls.find(h => h.id === editingHallId);
    if (!currentHall) {
      showToast('Salon bilgisi bulunamadı.');
      return;
    }

    setIsSendingNotification(true);
    try {
      const absentList: AbsentStudentInfo[] = seatingPlan
        .filter(sp => absentStudentIds.includes(sp.studentId))
        .map(sp => ({
          studentId: sp.studentId,
          studentNo: sp.studentNo,
          studentName: sp.studentName,
          studentClass: sp.studentClass,
          deskNumber: sp.deskNumber
        }));

      const attendanceId = `${activeExamForAttendance.id}_${currentHall.id}`;
      const teacherIdentity = getActiveTeacherIdentity(state.teachers);
      const teacherEmail = teacherIdentity.email || '';
      const teacherName = teacherIdentity.displayName || 'Gözetmen Öğretmen';

      // İdarecilerin bildirimde ve kayıtta göreceği gözetmen ismi ve maili
      const takenByDisplay = teacherEmail && !teacherName.includes(teacherEmail)
        ? `${teacherName} (${teacherEmail})`
        : (teacherName || teacherEmail || 'Gözetmen Öğretmen');

      const payload: HallAttendance = {
        id: attendanceId,
        examId: activeExamForAttendance.id,
        examName: activeExamForAttendance.name,
        hallId: currentHall.id,
        hallName: currentHall.name,
        date: activeExamForAttendance.date || new Date().toISOString().split('T')[0],
        takenBy: takenByDisplay,
        takenByEmail: teacherEmail,
        takenAt: new Date().toISOString(),
        totalAssigned: seatingPlan.length,
        presentCount: seatingPlan.length - absentList.length,
        absentCount: absentList.length,
        absentStudents: absentList,
        status: 'submitted'
      };

      const result = await submitHallAttendance(payload, 'main');
      if (result.success) {
        setAttendances(prev => ({ ...prev, [attendanceId]: payload }));
        if (result.unchanged) {
          showToast(`✓ ${currentHall.name} yoklaması zaten en güncel haliyle kayıtlı. (Ekstra kota harcanmadı)`);
        } else {
          showToast(`✓ ${currentHall.name} yoklaması kaydedildi ve idareye anlık bildirim iletildi! (${absentList.length} devamsız)`);
        }
      } else {
        showToast(`Yoklama kaydedildi ancak bildirimde gecikme yaşandı: ${result.error || ''}`);
      }
    } catch (err: any) {
      showToast(`Hata: ${err?.message || 'Yoklama gönderilemedi'}`);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleGenerateSeating = () => {
    if (isReadOnly) return;
    const eligibleStudents = [...activeStudentsForSeating];
    
    if (eligibleStudents.length === 0) {
      showToast('Yerleştirilecek öğrenci bulunamadı. Lütfen şube ve sınav seçimlerini kontrol edin.');
      return;
    }

    // Kelebek Dağıtım Algoritması
    const classGroups: { [className: string]: typeof eligibleStudents } = {};
    eligibleStudents.forEach(student => {
      if (!classGroups[student.className]) {
        classGroups[student.className] = [];
      }
      classGroups[student.className].push(student);
    });

    Object.keys(classGroups).forEach(cls => {
      classGroups[cls] = classGroups[cls].sort(() => Math.random() - 0.5);
    });

    const shuffled: typeof eligibleStudents = [];
    const classes = Object.keys(classGroups);
    let classIndex = 0;

    while (shuffled.length < eligibleStudents.length) {
      const currentClass = classes[classIndex % classes.length];
      if (classGroups[currentClass].length > 0) {
        shuffled.push(classGroups[currentClass].pop()!);
      }
      classIndex++;
    }

    let globalSeatIndex = 1;
    const newSeatingPlan: SeatingPlanItem[] = [];

    columns.forEach(col => {
      for (let row = 0; row < col.deskCount; row++) {
        for (let seat = 0; seat < col.seatsPerDesk; seat++) {
          if (shuffled.length > 0) {
            const student = shuffled.shift()!;
            newSeatingPlan.push({
              deskNumber: globalSeatIndex,
              studentId: student.id,
              studentNo: student.no,
              studentName: student.name,
              studentClass: student.className
            });
          }
          globalSeatIndex++;
        }
      }
    });

    setSeatingPlan(newSeatingPlan);
    setMobileModalTab('preview');
    showToast(`✓ Kelebek oturma düzeni oluşturuldu (${newSeatingPlan.length} öğrenci yerleşti)`);
  };

  const handleSaveHall = () => {
    if (isReadOnly) return;
    if (!hallName.trim()) {
      showToast('Lütfen salon adını girin');
      return;
    }

    const hallData: ExamHall = {
      id: editingHallId || generateId(),
      name: hallName.trim(),
      capacity,
      columns,
      examIds: selectedExamIds,
      selectedClasses,
      seatingPlan
    };

    if (editingHallId) {
      setExamHalls(state.examHalls.map(h => h.id === editingHallId ? hallData : h));
      showToast(`✓ "${hallName}" başarıyla güncellendi`);
    } else {
      setExamHalls([...state.examHalls, hallData]);
      showToast(`✓ "${hallName}" yeni salon olarak kaydedildi`);
    }
    closeModal();
  };

  const confirmDeleteHall = (hallId: string) => {
    if (isReadOnly) return;
    const hall = state.examHalls.find(h => h.id === hallId);
    const name = hall?.name || 'Bu salon';
    setExamHalls(state.examHalls.filter(h => h.id !== hallId));
    setDeletingHallId(null);
    showToast(`✓ "${name}" silindi`);
  };

  // Summary Stats
  const summaryStats = useMemo(() => {
    const totalHalls = state.examHalls.length;
    const totalCapacity = state.examHalls.reduce((acc, h) => acc + (h.capacity || 0), 0);
    const totalSeated = state.examHalls.reduce((acc, h) => acc + (h.seatingPlan?.length || 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((totalSeated / totalCapacity) * 100) : 0;

    return {
      totalHalls,
      totalCapacity,
      totalSeated,
      occupancyRate
    };
  }, [state.examHalls]);

  // Halls to display
  const filteredHalls = state.examHalls;

  const handleExport = (hall: ExamHall) => {
    if (!hall.seatingPlan || hall.seatingPlan.length === 0) {
      showToast('Bu salonda henüz dışa aktarılacak oturma düzeni bulunmuyor.');
      return;
    }

    const data = hall.seatingPlan.map(item => ({
      'SIRA NO / SIRA': item.deskNumber,
      'ÖĞRENCİ NO': item.studentNo,
      'ADI SOYADI': item.studentName,
      'SINIFI': item.studentClass,
      'İMZA / YOKLAMA': ''
    }));
    
    exportToExcel(data, `Sinav_Salonu_Yoklama_${hall.name.replace(/\s+/g, '_')}`);
    showToast(`✓ "${hall.name}" yoklama listesi Excel olarak indirildi`);
  };

  const handlePrintSchematic = (specificHall?: ExamHall) => {
    const targetName = specificHall?.name || hallName || 'Sınav Salonu';
    const targetCols = specificHall?.columns || columns;
    const targetPlan = specificHall?.seatingPlan || seatingPlan;

    if (!targetPlan || targetPlan.length === 0) {
      showToast('Bu salonda henüz yazdırılacak oturma planı bulunmuyor.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Açılır pencere (popup) engellendi. Lütfen tarayıcı ayarlarından popup izni verin.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${targetName} - Oturma Düzeni Şeması</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { 
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
              color: #111; 
              margin: 0; 
              padding: 0; 
              width: 194mm;
              height: 280mm;
              display: flex;
              flex-direction: column;
            }
            * { box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; }
            .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 0; color: #555; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .board-banner {
              text-align: center;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              background: #f0f0f0;
              border: 1.5px solid #333;
              border-radius: 4px;
              padding: 4px;
              margin-bottom: 12px;
            }
            .grid-container {
               display: flex;
               gap: 12px;
               justify-content: center;
               align-items: stretch;
               flex: 1;
               min-height: 0;
            }
            .column {
               display: flex;
               flex-direction: column;
               gap: 8px;
               flex: 1;
               min-width: 0;
            }
            .col-title {
               text-align: center;
               font-weight: 800;
               text-transform: uppercase;
               color: #111;
               margin-bottom: 2px;
               font-size: 11px;
               padding: 2px 4px;
               background: #eee;
               border-radius: 3px;
            }
            .desk-row {
               display: flex;
               gap: 6px;
               background: #fafafa;
               border: 1px solid #ccc;
               border-radius: 6px;
               padding: 4px;
               flex: 1;
               min-height: 48px;
            }
            .seat-pod {
               flex: 1;
               border: 1px solid #bbb;
               background: #fff;
               border-radius: 4px;
               padding: 4px;
               display: flex;
               flex-direction: column;
               justify-content: space-between;
               position: relative;
               min-width: 0;
            }
            .seat-num {
               font-size: 9px;
               font-weight: 800;
               color: #777;
               line-height: 1;
            }
            .seat-name {
               font-size: 10px;
               font-weight: 800;
               color: #000;
               text-align: center;
               white-space: nowrap;
               overflow: hidden;
               text-overflow: ellipsis;
               margin: 2px 0;
            }
            .seat-meta {
               display: flex;
               justify-content: space-between;
               align-items: center;
               font-size: 8px;
               font-weight: 700;
            }
            .seat-class {
               background: #f0f0f0;
               padding: 1px 3px;
               border-radius: 2px;
               border: 0.5px solid #ccc;
            }
            .empty-pod {
               border: 1px dashed #ccc;
               background: #fdfdfd;
               display: flex;
               align-items: center;
               justify-content: center;
               font-size: 9px;
               color: #999;
               font-style: italic;
            }
            .footer {
               margin-top: 10px;
               padding-top: 8px;
               border-top: 1px solid #ddd;
               display: flex;
               justify-content: space-between;
               font-size: 9px;
               color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${targetName}</h1>
            <p>Sınav Salonu Oturma Düzeni & Gözetmenlik Şeması • Toplam ${targetPlan.length} Öğrenci</p>
          </div>
          <div class="board-banner">
            🏫 YAZI TAHTASI / KÜRSÜ (ÖN CEPHE)
          </div>
          <div class="grid-container">
            ${targetCols.map((col, colIdx) => `
              <div class="column">
                <div class="col-title">${col.name}</div>
                ${Array.from({ length: col.deskCount }).map((_, rowIdx) => `
                  <div class="desk-row">
                    ${Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                      let sNum = 0;
                      for (let i = 0; i < colIdx; i++) {
                        sNum += targetCols[i].deskCount * targetCols[i].seatsPerDesk;
                      }
                      sNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                      const st = targetPlan.find(item => item.deskNumber === sNum);
                      if (st) {
                        return `
                          <div class="seat-pod">
                            <span class="seat-num">${sNum}</span>
                            <div class="seat-name">${st.studentName}</div>
                            <div class="seat-meta">
                              <span>No: ${st.studentNo}</span>
                              <span class="seat-class">${st.studentClass}</span>
                            </div>
                          </div>
                        `;
                      } else {
                        return `
                          <div class="seat-pod empty-pod">
                            <span style="position: absolute; top: 3px; left: 3px;" class="seat-num">${sNum}</span>
                            <span>Boş</span>
                          </div>
                        `;
                      }
                    }).join('')}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <div class="footer">
            <span>Tarih: ${new Date().toLocaleDateString('tr-TR')}</span>
            <span>Gözetmen İmza: ____________________</span>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Salondaki öğrenci şubeleri listesi
  const hallPresentClasses = useMemo(() => {
    return Array.from(new Set(seatingPlan.map(s => s.studentClass).filter(Boolean))).sort();
  }, [seatingPlan]);

  // Arama sonucunda eşleşen sıra adedi
  const highlightedSeatCount = useMemo(() => {
    if (!highlightStudentQuery.trim()) return 0;
    const q = highlightStudentQuery.trim().toLowerCase();
    return seatingPlan.filter(s => 
      s.studentName.toLowerCase().includes(q) ||
      String(s.studentNo).includes(q) ||
      (s.studentClass && s.studentClass.toLowerCase().includes(q))
    ).length;
  }, [seatingPlan, highlightStudentQuery]);

  // Salonda mevcut olan ve devamsız olan öğrenci sayıları
  const attendancePresentCount = seatingPlan.length - absentStudentIds.length;
  const attendanceAbsentCount = absentStudentIds.length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#151618] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-white/10 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-1 border-b border-brand-border/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-bold tracking-tight">
            Salonlar & Oturma Planı
          </h2>
          <p className="text-xs sm:text-sm text-brand-ink/60 mt-0.5">
            {isReadOnly 
              ? 'Sınav salonları, günün sınav takvimi ve pratik öğrenci yoklama kontrolü' 
              : 'Sınav salonu yapılandırması, otomatik kelebek dağıtım ve gözetmenlik yönetimi'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {/* Test / Simülasyon Seçici (Takvimde bugün sınav yoksa veya farklı sınav günleri test edilecekse) */}
          <div className="flex items-center gap-1.5 bg-white border border-brand-border/80 px-2.5 py-1.5 rounded-xl shadow-2xs text-xs">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-brand-ink/70">
              {simulationDateStr ? 'Test Tarihi:' : 'Takvim Tarihi:'}
            </span>
            <select
              value={simulationDateStr}
              onChange={(e) => setSimulationDateStr(e.target.value)}
              className="bg-transparent text-xs font-bold text-brand-ink focus:outline-none cursor-pointer"
            >
              <option value="">Bugün ({new Date().toLocaleDateString('tr-TR')})</option>
              {state.exams.map(ex => (
                <option key={ex.id} value={ex.date}>
                  {ex.name} ({ex.date || 'Tarih Yok'})
                </option>
              ))}
            </select>
            {simulationDateStr && (
              <button
                type="button"
                onClick={() => setSimulationDateStr('')}
                className="text-[10px] text-rose-600 hover:underline font-bold ml-1 cursor-pointer"
                title="Bugüne Dön"
              >
                Sıfırla
              </button>
            )}
          </div>

          {!isReadOnly && (
            <button 
              onClick={openNewModal} 
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#151618] hover:bg-black text-white rounded-xl text-xs font-bold active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Yeni Salon Oluştur</span>
            </button>
          )}

          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-50 to-indigo-100/60 text-indigo-900 border border-indigo-200/90 rounded-xl text-xs font-bold shrink-0 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Öğretmen & Yoklama Modu</span>
            </div>
          )}
        </div>
      </header>

      {/* Summary Stats */}
      <section className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-5 animate-fade-in">
        {/* Stat 1: Toplam Salon */}
        <div className="bg-white p-3.5 sm:p-5 border border-brand-border/70 rounded-2xl shadow-2xs hover:shadow-xs flex flex-col justify-between transition-all hover:border-indigo-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
              Toplam Salon
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-xl sm:text-3xl font-bold text-brand-ink leading-none">{summaryStats.totalHalls}</span>
            <span className="text-xs text-brand-ink/50 font-medium">salon</span>
          </div>
        </div>

        {/* Stat 2: Toplam Kapasite */}
        <div className="bg-white p-3.5 sm:p-5 border border-brand-border/70 rounded-2xl shadow-2xs hover:shadow-xs flex flex-col justify-between transition-all hover:border-indigo-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
              Toplam Kapasite
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 group-hover:scale-105 transition-transform">
              <LayoutTemplate className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-xl sm:text-3xl font-bold text-brand-ink leading-none">{summaryStats.totalCapacity}</span>
            <span className="text-xs text-brand-ink/50 font-medium">sıra / koltuk</span>
          </div>
        </div>

        {/* Stat 3: Yerleşen Öğrenci */}
        <div className="bg-white p-3.5 sm:p-5 border border-brand-border/70 rounded-2xl shadow-2xs hover:shadow-xs flex flex-col justify-between transition-all hover:border-emerald-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
              Yerleşen Öğrenci
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-xl sm:text-3xl font-bold text-brand-ink leading-none">{summaryStats.totalSeated}</span>
            <span className="text-xs text-brand-ink/50 font-medium">öğrenci</span>
          </div>
        </div>

        {/* Stat 4: Doluluk Oranı */}
        <div className="bg-white p-3.5 sm:p-5 border border-brand-border/70 rounded-2xl shadow-2xs hover:shadow-xs flex flex-col justify-between transition-all hover:border-amber-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold text-brand-ink/60 uppercase tracking-wider">
              Doluluk Oranı
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-xl sm:text-3xl font-bold text-brand-ink leading-none">%{summaryStats.occupancyRate}</span>
              <span className="text-xs text-brand-ink/50 font-medium">doluluk</span>
            </div>
            <div className="w-full bg-[#FAF9F6] h-1.5 rounded-full overflow-hidden border border-brand-border/40">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, summaryStats.occupancyRate)}%` }} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sınav Günü Bilgilendirme Çubuğu */}
      {examsOnSelectedDate.length > 0 && (
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-emerald-500/10 border border-amber-300 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                  Bugün Sınav Günü!
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                  {examsOnSelectedDate.length} Aktif Sınav
                </span>
              </div>
              <p className="text-xs text-brand-ink font-semibold truncate mt-0.5">
                {examsOnSelectedDate.map(e => e.name).join(', ')}
              </p>
            </div>
          </div>

          <div className="text-xs text-brand-ink/70 font-medium">
            Öğretmenler salon kartlarındaki <strong className="text-indigo-800">"Yoklama Al"</strong> butonuyla salonda bulunmayan öğrencileri işaretleyip idareye anlık bildirim gönderebilir.
          </div>
        </div>
      )}

      {/* Halls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5 overflow-auto pb-10">
        {filteredHalls.map(hall => {
          const usedCapacity = hall.seatingPlan?.length || 0;
          const totalCapacity = hall.capacity || 0;
          const percentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;
          const isFull = percentage >= 100;
          const isEmpty = usedCapacity === 0;

          // Bu salon için takvimde olan günün sınavını tespit et
          const todayExam = findTodayExamForHall(hall, state.exams, effectiveCalendarDate);
          const attendanceKey = todayExam ? `${todayExam.id}_${hall.id}` : '';
          const hallAttendance = todayExam ? (attendances[attendanceKey] || (Object.values(attendances) as HallAttendance[]).find(a => a.hallId === hall.id && a.examId === todayExam.id)) : null;

          return (
            <div 
              key={hall.id} 
              onClick={() => openEditModal(hall)}
              className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs sm:shadow-xs border border-brand-border/70 hover:border-indigo-400 hover:shadow-md flex flex-col justify-between transition-all group relative hover:-translate-y-0.5 cursor-pointer"
            >
              {/* Card Header Row */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-serif text-brand-ink font-bold leading-tight truncate group-hover:text-indigo-900 transition-colors">
                        {hall.name}
                      </h3>
                      {isFull ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Tam Dolu
                        </span>
                      ) : isEmpty ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                          Boş
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          %{percentage.toFixed(0)} Dolu
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[11px] text-brand-ink/60 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-brand-ink">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        {totalCapacity} Kişi Kapasite
                      </span>
                      <span className="text-brand-ink/30">•</span>
                      <span className="font-medium text-brand-ink/60">
                        {hall.columns?.length || 0} Sütun Düzeni
                      </span>
                    </div>
                  </div>

                  {/* Quick actions top-right */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(hall);
                      }} 
                      className="p-2 text-brand-ink/60 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-emerald-200 active:scale-95 shadow-2xs" 
                      title="Yoklama Listesi İndir (Excel)"
                      aria-label="Yoklama Listesi İndir"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintSchematic(hall);
                      }} 
                      className="p-2 text-brand-ink/60 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-200 active:scale-95 shadow-2xs" 
                      title="Oturma Şemasını Yazdır / PDF"
                      aria-label="Şema Yazdır"
                    >
                      <Printer className="w-4 h-4 text-indigo-600" />
                    </button>
                    {!isReadOnly && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingHallId(hall.id);
                        }} 
                        className="p-2 text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 active:scale-95 shadow-2xs" 
                        title="Salonu Sil"
                        aria-label="Salonu Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* 1. ÖZELLİK: SINAV GÜNÜ SALON KARTLARININ ORTASINDA SINAV ROZETİ */}
                {/* ========================================================= */}
                {todayExam ? (
                  <div className="my-2.5 p-3 rounded-2xl bg-gradient-to-br from-amber-50/90 via-indigo-50/40 to-emerald-50/70 border border-amber-300/80 shadow-2xs group-hover:border-indigo-300 transition-all">
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex h-2 w-2 relative shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                          Bugünkü Sınav
                        </span>
                      </div>
                      
                      {hallAttendance ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          hallAttendance.absentCount > 0 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {hallAttendance.absentCount > 0 ? `${hallAttendance.absentCount} Devamsız` : 'Yoklama Tam'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          <Clock className="w-3 h-3 text-amber-700" />
                          Yoklama Bekleniyor
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-brand-ink truncate">
                          {todayExam.name}
                        </h4>
                        <p className="text-[10px] text-brand-ink/60 truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>📅 {todayExam.date || 'Bugün'}</span>
                          <span>•</span>
                          <span>{todayExam.institution || 'Kurumsal Deneme'}</span>
                          {hallAttendance && (hallAttendance.takenByEmail || hallAttendance.takenBy) && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-800 font-semibold truncate" title={`Yoklamayı Gönderen: ${hallAttendance.takenBy}`}>
                                👤 {hallAttendance.takenByEmail || hallAttendance.takenBy}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAttendanceModal(hall, todayExam);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all active:scale-95 shadow-xs cursor-pointer ${
                          hallAttendance
                            ? 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                        }`}
                        title="Bu Salon İçin Yoklama Al / Güncelle"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{hallAttendance ? 'Yoklamayı Güncelle' : 'Yoklama Al'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Takvimde bugün sınav yoksa sade şube görünümü */
                  hall.selectedClasses && hall.selectedClasses.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap my-2.5 py-1.5 border-t border-b border-brand-border/40">
                      <span className="text-[10px] font-bold text-brand-ink/60 mr-0.5">Şubeler:</span>
                      {hall.selectedClasses.slice(0, 5).map(cls => (
                        <span key={cls} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getClassBadgeColor(cls)}`}>
                          {cls}
                        </span>
                      ))}
                      {hall.selectedClasses.length > 5 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          +{hall.selectedClasses.length - 5}
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Occupancy Progress & Primary Action Button */}
              <div className="mt-auto pt-2 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-brand-ink/60 text-[11px]">Yerleşen Öğrenci</span>
                  <span className="font-bold text-brand-ink text-xs">
                    {usedCapacity} <span className="text-brand-ink/40 font-normal">/ {totalCapacity}</span>
                  </span>
                </div>
                <div className="w-full bg-[#FAF9F6] h-2 rounded-full overflow-hidden border border-brand-border/40">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentage >= 100 
                        ? 'bg-emerald-600' 
                        : percentage > 0 
                        ? 'bg-amber-500' 
                        : 'bg-transparent'
                    }`} 
                    style={{ width: `${Math.min(100, percentage)}%` }} 
                  />
                </div>
                
                {/* Main Action Button */}
                <button 
                  onClick={() => openEditModal(hall, todayExam ? 'attendance' : 'layout', todayExam || undefined)} 
                  className={`w-full mt-2.5 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between active:scale-[0.98] cursor-pointer ${
                    isReadOnly 
                      ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/70 border border-indigo-200/90 text-indigo-950 hover:border-indigo-400 hover:shadow-xs' 
                      : 'bg-[#FAF9F6] border border-brand-border/80 text-brand-ink hover:bg-white hover:border-brand-accent hover:text-brand-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 shrink-0 ${isReadOnly ? 'text-indigo-600' : 'text-brand-ink/60 group-hover:text-brand-accent'}`} />
                    <span>
                      {isReadOnly 
                        ? (todayExam ? 'Oturma Planı & Yoklama Ekranı' : 'Oturma Düzenini Görüntüle')
                        : 'Salonu Düzenle & Oturma Planı'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand-ink/40 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
        
        {filteredHalls.length === 0 && (
          <div className="col-span-full text-center p-8 sm:p-14 bg-white rounded-3xl border border-dashed border-[#e6e2d3] text-[#8e8d82] shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
              <Building className="w-7 h-7" />
            </div>
            <h4 className="text-base font-serif font-bold text-brand-ink mb-1">
              Henüz Sınav Salonu Oluşturulmamış
            </h4>
            <p className="text-xs text-brand-ink/60 max-w-sm mx-auto mb-4 leading-relaxed">
              {isReadOnly 
                ? 'Yönetici tarafından henüz aktif bir sınav salonu tanımlanmamış.' 
                : 'Yukarıdaki "Yeni Salon Oluştur" butonuna tıklayarak salon ve otomatik kelebek oturma düzeni oluşturabilirsiniz.'}
            </p>
            {!isReadOnly && (
              <button 
                onClick={openNewModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#151618] hover:bg-black text-white rounded-xl text-xs font-bold active:scale-95 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>İlk Salonu Oluştur</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================= */}
      {/* EXAM HALL & ATTENDANCE MODAL */}
      {/* ========================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-1 sm:p-4 animate-fade-in">
          <div className={`bg-white rounded-2xl sm:rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full ${isReadOnly || modalMode === 'attendance' ? 'max-w-5xl lg:max-w-6xl' : 'max-w-4xl'} h-[98vh] sm:h-[90vh] flex flex-col overflow-hidden animate-slide-up max-h-[98vh] sm:max-h-[90vh]`}>
            
            {/* Modal Header (Selector 5) */}
            <div className="bg-[#FAF9F6] border-b border-brand-border/80 px-3 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${modalMode === 'attendance' ? 'bg-amber-500/15 text-amber-800' : 'bg-indigo-500/15 text-indigo-700'}`}>
                  {modalMode === 'attendance' ? <UserCheck className="h-4.5 w-4.5 sm:h-5 sm:w-5" /> : <MapPin className="h-4.5 w-4.5 sm:h-5 sm:w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-3 flex-wrap">
                    <h3 className="text-sm sm:text-base lg:text-lg font-serif text-brand-ink font-bold leading-tight truncate">
                      {hallName || 'Sınav Salonu'}
                    </h3>
                    
                    {/* Görünüm Sekmeleri: Oturma Planı vs Sınav Yoklaması */}
                    <div className="inline-flex items-center bg-white border border-brand-border/80 p-0.5 rounded-xl shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setModalMode('layout')}
                        className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer touch-manipulation ${
                          modalMode === 'layout' 
                            ? 'bg-[#151618] text-white shadow-xs' 
                            : 'text-brand-ink/60 hover:text-brand-ink'
                        }`}
                      >
                        <LayoutTemplate className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Oturma Planı</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setModalMode('attendance')}
                        className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer touch-manipulation ${
                          modalMode === 'attendance' 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'text-brand-ink/60 hover:text-amber-800'
                        }`}
                      >
                        <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Sınav Yoklaması</span>
                        {attendanceAbsentCount > 0 && (
                          <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 bg-rose-600 text-white rounded-full font-extrabold ml-0.5 animate-pulse">
                            {attendanceAbsentCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={closeModal}
                className="p-1.5 sm:p-2 text-brand-ink/50 hover:text-brand-ink hover:bg-black/5 rounded-xl transition-all cursor-pointer shrink-0 touch-manipulation"
                title="Pencereyi Kapat (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Tab Switcher (Yalnızca İdareci / Admin Düzenleme Modunda Görünür) */}
            {!isReadOnly && modalMode === 'layout' && (
              <div className="md:hidden flex border-b border-brand-border/70 bg-[#FAF9F6] p-1.5 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileModalTab('settings')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileModalTab === 'settings'
                      ? 'bg-[#151618] text-white shadow-xs'
                      : 'text-brand-ink/60 hover:text-brand-ink'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>1. Salon Ayarları</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileModalTab('preview')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileModalTab === 'preview'
                      ? 'bg-[#151618] text-white shadow-xs'
                      : 'text-brand-ink/60 hover:text-brand-ink'
                  }`}
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  <span>2. Oturma Şeması ({seatingPlan.length}/{capacity})</span>
                </button>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#fcfbf7]/40">
              
              {/* Sol Form Paneli (Selector 4) */}
              {!isReadOnly && modalMode === 'layout' && (
                <div className={`w-full md:w-1/3 p-3.5 sm:p-5 border-r border-[#e6e2d3] overflow-y-auto space-y-4 sm:space-y-5 bg-[#FAF9F6] ${
                  mobileModalTab !== 'settings' ? 'hidden md:block' : 'block'
                }`}>
                  <div>
                    <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider mb-2">Salon Adı / Yeri</label>
                    <input 
                      type="text" 
                      value={hallName} 
                      onChange={e => setHallName(e.target.value)} 
                      placeholder="Örn: 8-A Sınıfı, Konferans Salonu"
                      className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3.5 py-2 text-sm text-[#5a5a40] font-bold focus:outline-none focus:border-[#5a5a40] shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider mb-2">Sütun Ayarları</label>
                    <div className="space-y-3">
                      {columns.map((col, idx) => (
                        <div key={col.id} className="p-3 bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <input 
                              type="text" 
                              value={col.name} 
                              onChange={e => {
                                const newCols = [...columns];
                                newCols[idx].name = e.target.value;
                                setColumns(newCols);
                              }}
                              className="font-bold text-xs text-[#5a5a40] bg-transparent border-b border-dashed border-[#8e8d82] focus:outline-none"
                            />
                            {columns.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => setColumns(columns.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Sil
                              </button>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-[#8e8d82] font-semibold mb-1 block">Sıra Sayısı</label>
                              <input 
                                type="number" 
                                value={col.deskCount || ''} 
                                onChange={e => {
                                  const newCols = [...columns];
                                  newCols[idx].deskCount = parseInt(e.target.value) || 0;
                                  setColumns(newCols);
                                }}
                                className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1 text-xs text-[#5a5a40]"
                                min="1"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-[#8e8d82] font-semibold mb-1 block">Sıradaki Koltuk</label>
                              <input 
                                type="number" 
                                value={col.seatsPerDesk || ''} 
                                onChange={e => {
                                  const newCols = [...columns];
                                  newCols[idx].seatsPerDesk = parseInt(e.target.value) || 0;
                                  setColumns(newCols);
                                }}
                                className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1 text-xs text-[#5a5a40]"
                                min="1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={() => setColumns([...columns, { id: generateId(), name: `Sütun ${columns.length + 1}`, deskCount: 5, seatsPerDesk: 2 }])}
                        className="w-full py-2 bg-white border border-dashed border-[#e6e2d3] rounded-xl text-xs font-bold text-[#8e8d82] hover:text-[#5a5a40] hover:border-[#5a5a40] transition-colors"
                      >
                        + Yeni Sütun Ekle
                      </button>
                    </div>
                  </div>

                  {/* Sınav ve Sınıf Seçimleri (Admin) */}
                  <div className="space-y-4 pt-2 border-t border-[#e6e2d3]">
                    {/* Sınıf / Seviye Filtresi */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">1. Kademe / Seviye Seçin</label>
                        <span className="text-[10px] text-[#8e8d82]">
                          {selectedGrades.length > 0 ? `${selectedGrades.length} seviye seçildi` : 'Seçilmedi'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {availableGradeLevels.map(grade => {
                          const isSelected = selectedGrades.includes(grade);
                          return (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => toggleGrade(grade)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                  : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f5f5f0]'
                              }`}
                            >
                              {grade === 'Diğer' ? 'Diğer' : `${grade}. Sınıf`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sınav Seçimi */}
                    {selectedGrades.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">2. İlişkili Sınavlar</label>
                          <span className="text-[10px] text-[#8e8d82]">
                            {selectedExamIds.length > 0 ? `${selectedExamIds.length} sınav seçili` : 'Tümü'}
                          </span>
                        </div>

                        {filteredExams.length === 0 ? (
                          <div className="p-3 bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl text-xs text-[#8e8d82] text-center">
                            Seçilen kademelere ait aktif sınav bulunamadı.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {filteredExams.map(exam => {
                              const isSelected = selectedExamIds.includes(exam.id);
                              return (
                                <label 
                                  key={exam.id} 
                                  className={`flex items-center space-x-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                    isSelected 
                                      ? 'bg-white border-[#d4d19d] text-[#5a5a40] font-bold shadow-2xs' 
                                      : 'bg-[#fcfbf7] border-[#e6e2d3] text-gray-500 hover:bg-[#f5f5f0]'
                                  }`}
                                >
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => {
                                      if (isSelected) {
                                        setSelectedExamIds(selectedExamIds.filter(id => id !== exam.id));
                                      } else {
                                        setSelectedExamIds([...selectedExamIds, exam.id]);
                                      }
                                    }}
                                    className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40]"
                                  />
                                  <span className="truncate flex-1">{exam.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Şubeler */}
                    {selectedGrades.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">3. Katılacak Şubeler</label>
                          <span className="text-[10px] text-[#8e8d82]">
                            {selectedClasses.length > 0 ? `${selectedClasses.length} şube seçili` : 'Seçilmedi'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                          {uniqueClasses
                            .filter(cls => selectedGrades.includes(getGradeLevel(cls)))
                            .map(clsName => {
                              const isSelected = selectedClasses.includes(clsName);
                              return (
                                <button
                                  key={clsName}
                                  type="button"
                                  onClick={() => toggleBranch(clsName)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                    isSelected
                                      ? 'bg-[#5a5a40] text-white border-[#5a5a40] shadow-xs'
                                      : 'bg-[#fcfbf7] text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f5f5f0]'
                                  }`}
                                >
                                  {clsName}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Öğrenci Hariç Tutma Listesi */}
                    {registeredStudentsForSeating.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#e6e2d3]">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">
                            4. Öğrenci Listesi ({activeStudentsForSeating.length}/{registeredStudentsForSeating.length})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (deselectedStudentIds.length > 0) {
                                setDeselectedStudentIds([]);
                              } else {
                                setDeselectedStudentIds(registeredStudentsForSeating.map(s => s.id));
                              }
                            }}
                            className="text-[10px] text-[#5a5a40] hover:underline font-bold"
                          >
                            {deselectedStudentIds.length > 0 ? 'Tümünü Dahil Et' : 'Tümünü Hariç Tut'}
                          </button>
                        </div>
                        
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-[#fcfbf7] p-2 rounded-xl border border-[#e6e2d3]">
                          {registeredStudentsForSeating.map(student => {
                            const isSelected = !deselectedStudentIds.includes(student.id);
                            return (
                              <label 
                                key={student.id} 
                                className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'bg-white border-[#d4d19d]/50 hover:bg-[#fcfbf7]' 
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100/50'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => {
                                      if (isSelected) {
                                        setDeselectedStudentIds([...deselectedStudentIds, student.id]);
                                      } else {
                                        setDeselectedStudentIds(deselectedStudentIds.filter(id => id !== student.id));
                                      }
                                    }}
                                    className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] shrink-0 h-3.5 w-3.5"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className={`font-bold truncate ${isSelected ? 'text-[#5a5a40]' : 'text-gray-400'}`}>
                                      {student.name}
                                    </div>
                                    <div className="text-[10px] text-[#8e8d82] flex items-center gap-1.5 mt-0.5">
                                      <span>No: {student.no}</span>
                                      <span>•</span>
                                      <span className="font-bold text-[#5a5a40]">{student.className}</span>
                                    </div>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleGenerateSeating}
                      className="w-full flex items-center justify-center space-x-2 bg-[#d4d19d] text-[#5a5a40] font-bold text-sm py-3 rounded-xl hover:bg-[#e6e2d3] transition-all shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Oturma Düzeni Oluştur</span>
                    </button>
                    <p className="text-[10px] text-[#8e8d82] text-center mt-2 leading-tight">
                      Seçili sınıflardaki öğrenciler rastgele karıştırılarak belirtilen kapasiteye göre sıralanır.
                    </p>
                  </div>
                </div>
              )}

              {/* Sağ İçerik Alanı: Oturma Planı / Yoklama Önizleme (Selector 1) */}
              <div className={`w-full ${!isReadOnly && modalMode === 'layout' ? 'md:w-2/3' : 'w-full'} p-2 sm:p-4.5 flex flex-col overflow-hidden ${
                !isReadOnly && modalMode === 'layout' && mobileModalTab !== 'preview' ? 'hidden md:flex' : 'flex'
              }`}>
                
                {/* ========================================================= */}
                {/* 2. ÖZELLİK: PRATİK YOKLAMA KONTROL ÇUBUĞU & İDAREYE BİLDİRİM (Selector 2) */}
                {/* ========================================================= */}
                {modalMode === 'attendance' ? (
                  <div className="mb-2.5 p-2 sm:p-3 bg-gradient-to-r from-amber-500/10 via-white to-rose-500/10 border border-amber-300/80 rounded-xl sm:rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3 shrink-0">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[11px] sm:text-xs font-bold text-brand-ink/70">Aktif Sınav:</span>
                        <select
                          value={activeExamForAttendance?.id || ''}
                          onChange={(e) => {
                            const found = state.exams.find(ex => ex.id === e.target.value);
                            if (found) {
                              setActiveExamForAttendance(found);
                              const existing = attendances[`${found.id}_${editingHallId}`];
                              if (existing && existing.absentStudents) {
                                setAbsentStudentIds(existing.absentStudents.map(s => s.studentId));
                              } else {
                                setAbsentStudentIds([]);
                              }
                            }
                          }}
                          className="bg-white border border-brand-border/80 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold text-brand-ink shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer w-full sm:w-auto max-w-full sm:max-w-xs truncate"
                        >
                          {state.exams.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.date || 'Tarih Yok'})</option>
                          ))}
                        </select>
                      </div>

                      {/* Canlı Sayaçlar */}
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-white border border-brand-border/70 text-brand-ink">
                          Toplam: <strong>{seatingPlan.length}</strong>
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ✓ Salonda: <strong>{attendancePresentCount}</strong>
                        </span>
                        <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg border ${
                          attendanceAbsentCount > 0 
                            ? 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse font-extrabold' 
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                          ✗ Salonda Olmayan: <strong>{attendanceAbsentCount}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        onClick={markAllPresent}
                        className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 bg-white border border-brand-border/80 text-xs font-bold text-brand-ink hover:bg-gray-50 rounded-xl transition-all shadow-2xs cursor-pointer text-center touch-manipulation active:scale-95"
                        title="Tüm öğrencileri salonda mevcut işaretle"
                      >
                        Tümünü Salonda Yap
                      </button>

                      <button
                        type="button"
                        disabled={isSendingNotification}
                        onClick={handleSaveAndBroadcastAttendance}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 touch-manipulation"
                      >
                        {isSendingNotification ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Kaydediliyor...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Kaydet & Bildir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2.5 px-2.5 sm:px-3.5 py-1.5 bg-white border border-brand-border/70 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-brand-ink truncate">
                        {hallName || 'Sınav Salonu'}
                      </span>
                      <span className="text-[10px] font-semibold text-brand-ink/70 bg-[#FAF9F6] border border-brand-border/60 px-2 py-0.5 rounded-md">
                        {seatingPlan.length}/{capacity} Öğrenci
                      </span>
                      {seatingPlan.length >= capacity && capacity > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                          %100 Dolu
                        </span>
                      ) : seatingPlan.length > 0 ? (
                        <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                          %{Math.round((seatingPlan.length / (capacity || 1)) * 100)} Dolu
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                      <div className="relative">
                        <Search className="w-3 h-3 text-brand-ink/40 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={highlightStudentQuery}
                          onChange={e => setHighlightStudentQuery(e.target.value)}
                          placeholder="Öğrenci ara..."
                          className="w-28 xs:w-36 sm:w-40 pl-6.5 pr-6 py-1 bg-white border border-brand-border/70 rounded-lg text-xs text-brand-ink placeholder:text-brand-ink/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                        />
                        {highlightStudentQuery && (
                          <button
                            onClick={() => setHighlightStudentQuery('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {highlightStudentQuery && highlightedSeatCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                          {highlightedSeatCount} eşleşme
                        </span>
                      )}

                      {seatingPlan.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => handleExport({ id: editingHallId || '', name: hallName, capacity, columns, seatingPlan } as any)}
                            className="flex items-center px-2 py-1 bg-white border border-brand-border/70 text-brand-ink hover:text-emerald-700 text-xs font-bold rounded-lg hover:border-emerald-300 transition-colors shadow-2xs cursor-pointer touch-manipulation"
                            title="Excel Yoklama Listesi İndir"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600 sm:mr-1" />
                            <span className="hidden sm:inline">Excel</span>
                          </button>
                          <button 
                            onClick={() => handlePrintSchematic()}
                            className="flex items-center px-2 py-1 bg-white border border-brand-border/70 text-brand-ink hover:text-indigo-700 text-xs font-bold rounded-lg hover:border-indigo-300 transition-colors shadow-2xs cursor-pointer touch-manipulation"
                            title="PDF Şema Yazdır / İndir"
                          >
                            <Printer className="w-3 h-3 text-indigo-600 sm:mr-1" />
                            <span className="hidden sm:inline">Yazdır</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Oturma Düzeni & Yoklama Grid Konteyneri (Selector 3) */}
                <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#fcfbf7]/60 border border-[#e6e2d3] rounded-xl sm:rounded-2xl shadow-inner p-2 sm:p-4 print:bg-white print:border-none print:shadow-none print:p-0 print:overflow-visible touch-pan-x overscroll-contain select-none" id="seating-plan-printable">
                  {showSaveToast && (
                    <div className="absolute top-3 right-3 z-50 bg-green-50 text-green-700 px-3 py-1.5 rounded-full shadow-sm border border-green-200 text-xs font-bold flex items-center print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Kaydediliyor...
                    </div>
                  )}

                  {seatingPlan.length > 0 ? (
                    <div className="flex gap-2.5 sm:gap-4 items-start min-w-[300px] sm:min-w-full justify-start sm:justify-center md:justify-start lg:justify-between print:w-full print:justify-center print:gap-8 pb-3">
                      {columns.map((col, colIdx) => (
                        <div key={col.id} className="flex flex-col gap-1.5 sm:gap-2.5 flex-1 min-w-[105px] xs:min-w-[125px] sm:min-w-[135px] md:min-w-0">
                          <div className="text-center font-bold text-brand-ink/70 text-[9px] sm:text-xs uppercase tracking-wider print:text-black truncate px-1 bg-white/90 py-0.5 sm:py-1 rounded-lg border border-brand-border/50 shadow-2xs">
                            {col.name}
                          </div>
                          
                          {Array.from({ length: col.deskCount }).map((_, rowIdx) => (
                            <div key={rowIdx} className="flex gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl bg-white/70 border border-brand-border/60 print:border-black/20 print:bg-transparent shadow-2xs">
                              {Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                                // Calculate global seat number
                                let seatNum = 0;
                                for (let i = 0; i < colIdx; i++) {
                                  seatNum += columns[i].deskCount * columns[i].seatsPerDesk;
                                }
                                seatNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                                
                                const student = seatingPlan.find(s => s.deskNumber === seatNum);
                                const studentId = student?.studentId || (student as any)?.id || '';
                                const isHighlighted = Boolean(
                                  highlightStudentQuery.trim() && student && (
                                    student.studentName.toLowerCase().includes(highlightStudentQuery.trim().toLowerCase()) ||
                                    String(student.studentNo).includes(highlightStudentQuery.trim()) ||
                                    (student.studentClass && student.studentClass.toLowerCase().includes(highlightStudentQuery.trim().toLowerCase()))
                                  )
                                );

                                const isAbsent = Boolean(modalMode === 'attendance' && student && studentId && absentStudentIds.includes(studentId));
                                
                                return (
                                  <div 
                                    key={seatIdx}
                                    draggable={!isReadOnly && modalMode !== 'attendance' && !!student}
                                    onClick={() => {
                                      if (student && studentId && modalMode === 'attendance') {
                                        toggleStudentAbsent(studentId);
                                      } else {
                                        handleSeatClick(seatNum);
                                      }
                                    }}
                                    onDragStart={(e) => {
                                      if (!isReadOnly && student) handleDragStart(e, seatNum);
                                    }}
                                    onDragOver={(e) => !isReadOnly && handleDragOver(e, seatNum)}
                                    onDragLeave={(e) => !isReadOnly && handleDragLeave(e, seatNum)}
                                    onDrop={(e) => !isReadOnly && handleDrop(e, seatNum)}
                                    className={`flex flex-col items-center justify-between p-1 sm:p-2 rounded-xl relative min-h-[4.75rem] sm:min-h-[5.6rem] flex-1 min-w-0 print:h-24 print:w-32 transition-all select-none touch-manipulation cursor-pointer ${
                                      student 
                                        ? modalMode === 'attendance'
                                          ? isAbsent
                                            ? "bg-rose-50/95 border-2 border-rose-600 shadow-md ring-2 ring-rose-400/50 z-10 hover:border-rose-700 hover:bg-rose-100/90 active:scale-95"
                                            : "bg-emerald-50/90 border-2 border-emerald-500 shadow-sm ring-2 ring-emerald-300/40 z-10 hover:border-emerald-600 hover:bg-emerald-100/80 active:scale-95"
                                          : "bg-white border border-brand-border/80 shadow-2xs hover:border-brand-accent/60 hover:shadow-xs hover:scale-[1.01] text-brand-ink print:border-black"
                                        : "bg-[#FAF9F6] border-2 border-dashed border-brand-border/70 print:border-gray-300 cursor-default"
                                    } ${
                                      isHighlighted 
                                        ? "ring-4 ring-indigo-600 bg-indigo-50 font-extrabold scale-105 z-20 shadow-lg border-indigo-500 animate-pulse" 
                                        : ""
                                    }`}
                                  >
                                    <div className="w-full flex items-center justify-between">
                                      <span className={`text-[8.5px] sm:text-[10px] font-bold ${
                                        modalMode === 'attendance'
                                          ? isAbsent 
                                            ? "text-rose-700 font-black" 
                                            : "text-emerald-800 font-black"
                                          : "text-brand-ink/50"
                                      }`}>
                                        {seatNum}
                                      </span>
                                    </div>
                                    
                                    {student ? (
                                      <>
                                        {/* Öğrenci İsmi */}
                                        <span 
                                          onClick={(e) => {
                                            if (modalMode === 'attendance' && studentId) {
                                              e.stopPropagation();
                                              toggleStudentAbsent(studentId);
                                            }
                                          }}
                                          className={`text-[9.5px] sm:text-xs font-bold text-center line-clamp-2 leading-tight px-0.5 my-0.5 sm:my-1 print:text-black break-words cursor-pointer transition-all active:scale-95 ${
                                            modalMode === 'attendance'
                                              ? isAbsent 
                                                ? "text-rose-950 font-black line-through decoration-rose-600 decoration-2 hover:text-rose-800" 
                                                : "text-emerald-950 font-bold hover:text-emerald-800"
                                              : "text-brand-ink hover:text-brand-accent"
                                          }`}
                                          title={modalMode === 'attendance' ? "Öğrenci yoklama durumunu değiştirmek için dokunun" : student.studentName}
                                        >
                                          {student.studentName}
                                        </span>
                                        <div className="mt-auto flex items-center justify-center gap-0.5 sm:gap-1 w-full flex-wrap">
                                          <span className={`text-[7.5px] sm:text-[8.5px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded font-semibold border truncate max-w-full ${
                                            modalMode === 'attendance'
                                              ? isAbsent 
                                                ? "bg-rose-100 text-rose-900 border-rose-300 font-bold" 
                                                : "bg-emerald-100/90 text-emerald-900 border-emerald-300 font-bold"
                                              : "bg-[#FAF9F6] text-brand-ink/70 border-brand-border/70"
                                          }`}>
                                            No: {student.studentNo}
                                          </span>
                                          <span className={`text-[7.5px] sm:text-[8.5px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded font-bold border truncate max-w-full ${
                                            modalMode === 'attendance'
                                              ? isAbsent 
                                                ? "bg-rose-100 text-rose-900 border-rose-300 font-bold" 
                                                : "bg-emerald-100/90 text-emerald-900 border-emerald-300 font-bold"
                                              : getClassBadgeColor(student.studentClass)
                                          }`}>
                                            {student.studentClass}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[8.5px] sm:text-[9.5px] text-brand-ink/40 font-medium my-auto">Boş Sıra</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#8e8d82]">
                      <LayoutTemplate className="w-12 h-12 mb-3 text-[#d4d19d]" />
                      <p className="font-bold text-sm text-[#5a5a40]">Henüz Oturma Düzeni Oluşturulmamış</p>
                      <p className="text-xs max-w-xs mt-1">
                        {isReadOnly 
                          ? 'Bu salon için henüz yerleşim şeması oluşturulmamış.' 
                          : 'Sol paneldeki ayarları tamamlayıp "Oturma Düzeni Oluştur" butonuna basarak öğrencileri otomatik dağıtabilirsiniz.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mobil için sağa-sola kaydırma ipucu */}
                <div className="sm:hidden mt-2 text-center text-[10px] text-brand-ink/50 flex items-center justify-center gap-1 shrink-0">
                  <span>↔️ Sıraları incelemek için parmağınızla sağa-sola kaydırabilirsiniz</span>
                </div>
              </div>
            </div>

            {/* Modal Alt Çubuk (Footer) */}
            <div className="bg-[#FAF9F6] border-t border-brand-border/70 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              {modalMode === 'attendance' ? (
                /* Yoklama Modu Alt Bilgilendirme ve Bildirim Butonu */
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-brand-ink font-medium">
                    {attendanceAbsentCount === 0 ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Salondaki tüm öğrenciler ({seatingPlan.length} kişi) eksiksiz olarak salondadır.
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          Salonda Bulunmayan {attendanceAbsentCount} Öğrenci:
                        </span>
                        {seatingPlan
                          .filter(s => absentStudentIds.includes(s.studentId))
                          .slice(0, 4)
                          .map(s => (
                            <span key={s.studentId} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                              {s.studentNo} - {s.studentName}
                            </span>
                          ))}
                        {attendanceAbsentCount > 4 && (
                          <span className="text-[10px] text-rose-600 font-bold">
                            +{attendanceAbsentCount - 4} diğer
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setModalMode('layout')}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-white border border-brand-border text-brand-ink text-xs font-bold rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      Şemaya Dön
                    </button>

                    <button
                      type="button"
                      disabled={isSendingNotification}
                      onClick={handleSaveAndBroadcastAttendance}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSendingNotification ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Kaydet & Bildir</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Standart Oturma Planı Alt Çubuğu */
                <div className="w-full flex items-center justify-between">
                  <div className="text-xs text-brand-ink/60 font-medium">
                    {isReadOnly 
                      ? `${seatingPlan.length} öğrenci yerleşimi görüntüleniyor`
                      : 'Değişiklikleri kaydetmek için aşağıdaki butonu kullanabilirsiniz.'}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 bg-white border border-brand-border text-brand-ink text-xs font-bold rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      Pencereyi Kapat
                    </button>
                    {!isReadOnly && (
                      <button 
                        type="button"
                        onClick={handleSaveHall}
                        className="px-5 py-2 bg-[#151618] hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        Salonu Kaydet
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      {deletingHallId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-brand-border/70 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-serif font-bold text-brand-ink text-base">Salonu Silmek İstiyor musunuz?</h4>
              <p className="text-xs text-brand-ink/60">
                Bu salon ve içerisindeki oturma planı kalıcı olarak silinecektir.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingHallId(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-brand-ink font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => confirmDeleteHall(deletingHallId)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
