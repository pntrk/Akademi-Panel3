import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ExamHall, SeatingPlanItem } from '../types';
import { generateId, exportToExcel } from '../lib/utils';
import { 
  Plus, Trash2, Download, LayoutTemplate, X, Users, RefreshCw, 
  AlertCircle, Building, MapPin, Search, ChevronDown, 
  ChevronRight, CheckCircle2, Eye, Printer, FileSpreadsheet, Sparkles, Check
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

  const capacity = columns.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0);

  // Toast bildirim yöneticisi
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3500);
  };

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
      const nextClasses = selectedClasses.filter(c => c !== clsName);
      setSelectedClasses(nextClasses);
      const hasRemainingOfThisGrade = nextClasses.some(c => getGradeLevel(c) === grade);
      if (!hasRemainingOfThisGrade) {
        setSelectedGrades(selectedGrades.filter(g => g !== grade));
      }
    } else {
      setSelectedClasses([...selectedClasses, clsName]);
      if (!selectedGrades.includes(grade)) {
        setSelectedGrades([...selectedGrades, grade]);
      }
    }
  };

  // Filtered exams based on selected grade levels of the hall
  const filteredExams = useMemo(() => {
    if (selectedGrades.length === 0) return [];
    return state.exams.filter(ex => {
      const examGrades = ex.participatingClasses || [];
      return examGrades.some(g => selectedGrades.includes(g));
    });
  }, [state.exams, selectedGrades]);

  const registeredStudentsForSeating = useMemo(() => {
    if (selectedClasses.length === 0) return [];
    return state.students.filter(s => {
      const classMatch = selectedClasses.includes(s.className);
      if (!classMatch) return false;
      if (selectedExamIds.length > 0) {
        return (s.examRegistrations || []).some(reg => selectedExamIds.includes(reg.examId));
      }
      return (s.examRegistrations || []).length > 0;
    });
  }, [state.students, selectedClasses, selectedExamIds]);

  const activeStudentsForSeating = useMemo(() => {
    return registeredStudentsForSeating.filter(s => !deselectedStudentIds.includes(s.id));
  }, [registeredStudentsForSeating, deselectedStudentIds]);

  const openNewModal = () => {
    // Öğretmen yeni salon oluşturamaz
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
    setIsModalOpen(true);
  };

  const openEditModal = (hall: ExamHall) => {
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
    // Öğretmen için doğrudan oturma şeması önizleme açılır
    setMobileModalTab(isReadOnly ? 'preview' : 'settings');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHallId(null);
    setHighlightStudentQuery('');
  };

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

  const handleDragStart = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly) return;
    setDraggedSeatNum(seatNum);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', seatNum.toString());
  };

  const handleDragOver = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSeatNum !== seatNum) {
      setDragOverSeatNum(seatNum);
    }
  };

  const handleDragLeave = (e: React.DragEvent, seatNum: number) => {
    if (isReadOnly) return;
    e.preventDefault();
    if (dragOverSeatNum === seatNum) {
      setDragOverSeatNum(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSeatNum: number) => {
    if (isReadOnly) return;
    e.preventDefault();
    setDragOverSeatNum(null);
    const sourceSeatNum = draggedSeatNum;
    if (sourceSeatNum === null || sourceSeatNum === targetSeatNum) return;

    swapSeats(sourceSeatNum, targetSeatNum);
    setDraggedSeatNum(null);
  };

  const handleSeatClick = (seatNum: number) => {
    if (isReadOnly) return;
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
               gap: 4px;
               padding: 4px;
               border: 1.5px solid #666;
               border-radius: 6px;
               background: #fafafa;
               flex: 1;
               min-height: 0;
            }
            .seat {
               flex: 1;
               min-width: 0;
               border: 1px solid #222;
               border-radius: 4px;
               padding: 4px;
               display: flex;
               flex-direction: column;
               align-items: center;
               justify-content: space-between;
               position: relative;
               background: #fff;
               overflow: hidden;
            }
            .seat.empty {
               border: 1px dashed #999;
               background: #fdfdfd;
               justify-content: center;
            }
            .seat-num {
               position: absolute;
               top: 2px;
               left: 3px;
               font-size: 8.5px;
               font-weight: 800;
               color: #111;
            }
            .student-name {
               font-size: 9.5px;
               font-weight: 700;
               text-align: center;
               margin-top: 10px;
               line-height: 1.15;
               color: #000;
               display: -webkit-box;
               -webkit-line-clamp: 2;
               -webkit-box-orient: vertical;
               overflow: hidden;
               word-break: break-word;
            }
            .student-meta {
               margin-top: auto;
               display: flex;
               flex-wrap: wrap;
               justify-content: center;
               gap: 2px;
            }
            .student-meta span {
               font-size: 8px;
               padding: 1px 3px;
               border: 1px solid #888;
               border-radius: 2px;
               color: #111;
               font-weight: 600;
               white-space: nowrap;
            }
            .footer-info {
              margin-top: 8px;
              padding-top: 4px;
              border-top: 1px solid #ccc;
              font-size: 9px;
              color: #666;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${targetName}</h1>
            <p>Sınav Salonu Oturma Düzeni & Yoklama Şeması</p>
          </div>
          <div class="board-banner">
            👨‍🏫 YAZI TAHTASI / KÜRSÜ (ÖN CEPHE)
          </div>
          <div class="grid-container">
            ${targetCols.map((col, colIdx) => `
              <div class="column">
                <div class="col-title">${col.name}</div>
                ${Array.from({ length: col.deskCount }).map((_, rowIdx) => `
                  <div class="desk-row">
                    ${Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                      let seatNum = 0;
                      for (let i = 0; i < colIdx; i++) {
                        seatNum += targetCols[i].deskCount * targetCols[i].seatsPerDesk;
                      }
                      seatNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                      const student = targetPlan.find(s => s.deskNumber === seatNum);
                      
                      if (student) {
                        return `
                          <div class="seat">
                            <span class="seat-num">${seatNum}</span>
                            <span class="student-name">${student.studentName}</span>
                            <div class="student-meta">
                              <span>No: ${student.studentNo}</span>
                              <span>${student.studentClass}</span>
                            </div>
                          </div>
                        `;
                      } else {
                        return `
                          <div class="seat empty">
                            <span class="seat-num">${seatNum}</span>
                            <span style="color:#888; font-size: 9px; font-weight: 600;">Boş Sıra</span>
                          </div>
                        `;
                      }
                    }).join('')}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <div class="footer-info">
            <span>Toplam Kapasite: ${targetCols.reduce((acc, c) => acc + (c.deskCount * c.seatsPerDesk), 0)} Sıra</span>
            <span>Yerleşen Öğrenci: ${targetPlan.length}</span>
            <span>AkademiPanel Sınav Yönetim Sistemi</span>
          </div>
          <script>
            window.onload = function() {
               setTimeout(function() {
                 window.print();
               }, 400);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    showToast(`✓ "${targetName}" yazdırma sayfası hazırlandı`);
  };

  // Öğrenci arama sorgusu ile eşleşen sıra sayısını hesapla
  const highlightedSeatCount = useMemo(() => {
    if (!highlightStudentQuery.trim() || seatingPlan.length === 0) return 0;
    const q = highlightStudentQuery.trim().toLowerCase();
    return seatingPlan.filter(s => 
      s.studentName.toLowerCase().includes(q) ||
      String(s.studentNo).includes(q) ||
      (s.studentClass && s.studentClass.toLowerCase().includes(q))
    ).length;
  }, [highlightStudentQuery, seatingPlan]);

  // Aktif salondaki tüm şubeleri derle (renk kılavuzu için)
  const hallPresentClasses = useMemo(() => {
    const set = new Set<string>();
    seatingPlan.forEach(s => {
      if (s.studentClass) set.add(s.studentClass);
    });
    return Array.from(set).sort();
  }, [seatingPlan]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-12 flex flex-col h-full relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 z-50 bg-[#151618] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/10 text-xs sm:text-sm font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Delete Confirmation Modal (Admin Only) */}
      {deletingHallId && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-brand-border space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-serif font-bold text-lg text-brand-ink">Salonu Sil</h3>
              <p className="text-xs text-brand-ink/60">
                Bu sınav salonunu ve mevcut oturma düzenini silmek istediğinize emin misiniz?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingHallId(null)}
                className="flex-1 py-2.5 text-xs font-bold text-brand-ink/70 hover:text-brand-ink bg-[#FAF9F6] border border-brand-border rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={() => confirmDeleteHall(deletingHallId)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 bg-white/90 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-brand-border/70 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent text-indigo-700 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-2xs">
            <Building className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-brand-ink font-bold tracking-tight leading-tight">
                {isReadOnly ? 'Sınav Salonları & Oturma Planı' : 'Sınav Salonları & Oturma Düzeni'}
              </h2>
              <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full shrink-0">
                {state.examHalls.length} Salon
              </span>
            </div>
            <p className="text-brand-ink/60 text-xs sm:text-sm mt-0.5">
              {isReadOnly 
                ? 'Sınav salonlarındaki oturma şemalarını inceleyin, öğrenci yerleşimlerini görüntüleyin ve yoklama listelerini indirin' 
                : 'Sınav salonlarını, kapasitelerini ve otomatik kelebek oturma düzenlerini yönetin'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {!isReadOnly ? (
            <button 
              onClick={openNewModal} 
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#151618] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4 text-amber-400" />
              <span>Yeni Salon Oluştur</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-indigo-100/60 text-indigo-900 border border-indigo-200/90 rounded-xl text-xs font-bold shrink-0 shadow-2xs">
              <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Öğretmen İnceleme & Gözetmenlik Modu</span>
            </div>
          )}
        </div>
      </header>

      {/* Summary Stats - Overview on Desktop */}
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

      {/* Halls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5 overflow-auto pb-10">
        {filteredHalls.map(hall => {
          const usedCapacity = hall.seatingPlan?.length || 0;
          const totalCapacity = hall.capacity || 0;
          const percentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;
          const isFull = percentage >= 100;
          const isEmpty = usedCapacity === 0;

          return (
            <div 
              key={hall.id} 
              className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs sm:shadow-xs border border-brand-border/70 hover:border-indigo-400 hover:shadow-md flex flex-col justify-between transition-all group relative hover:-translate-y-0.5"
            >
              {/* Card Header Row */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-serif text-brand-ink font-bold leading-tight truncate">
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
                    
                    <div className="text-[11px] text-brand-ink/60 mt-1.5 flex items-center gap-2 flex-wrap">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleExport(hall)} 
                      className="p-2 text-brand-ink/60 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-emerald-200 active:scale-95 shadow-2xs" 
                      title="Yoklama Listesi İndir (Excel)"
                      aria-label="Yoklama Listesi İndir"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </button>
                    <button 
                      onClick={() => handlePrintSchematic(hall)} 
                      className="p-2 text-brand-ink/60 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-200 active:scale-95 shadow-2xs" 
                      title="Oturma Şemasını Yazdır / PDF"
                      aria-label="Şema Yazdır"
                    >
                      <Printer className="w-4 h-4 text-indigo-600" />
                    </button>
                    {!isReadOnly && (
                      <button 
                        onClick={() => setDeletingHallId(hall.id)} 
                        className="p-2 text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 active:scale-95 shadow-2xs" 
                        title="Salonu Sil"
                        aria-label="Salonu Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Assigned Classes / Badges (Temiz Şık Şube Görünümü) */}
                {hall.selectedClasses && hall.selectedClasses.length > 0 && (
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
                  onClick={() => openEditModal(hall)} 
                  className={`w-full mt-2.5 py-2.5 px-3.5 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-between active:scale-[0.98] cursor-pointer ${
                    isReadOnly 
                      ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/70 border border-indigo-200/90 text-indigo-950 hover:border-indigo-400 hover:shadow-xs' 
                      : 'bg-[#FAF9F6] border border-brand-border/80 text-brand-ink hover:bg-white hover:border-brand-accent hover:text-brand-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 shrink-0 ${isReadOnly ? 'text-indigo-600' : 'text-brand-ink/60 group-hover:text-brand-accent'}`} />
                    <span>{isReadOnly ? 'Oturma Düzenini Görüntüle' : 'Salonu Düzenle & Oturma Planı'}</span>
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
      {/* EXAM HALL MODAL */}
      {/* ========================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fade-in">
          <div className={`bg-white rounded-2xl sm:rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full ${isReadOnly ? 'max-w-5xl lg:max-w-6xl' : 'max-w-4xl'} h-[94vh] sm:h-[88vh] flex flex-col overflow-hidden animate-slide-up max-h-[94vh]`}>
            
            {/* Header */}
            <div className="bg-[#FAF9F6] border-b border-brand-border/70 p-3.5 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                <div className="bg-indigo-500/15 p-2 rounded-xl text-indigo-700 shrink-0">
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-xl font-serif text-brand-ink font-bold leading-tight truncate">
                      {hallName || 'Sınav Salonu'}
                    </h3>
                    {isReadOnly && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0">
                        Oturma Düzeni Önizleme
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-brand-ink/60 mt-0.5 truncate">
                    {isReadOnly 
                      ? 'Sınav salonu oturma planı ve yerleşim şeması (Gözetmenlik & Yoklama Ekranı)' 
                      : (editingHallId ? 'Sınav salonu detayları, kapasite ve otomatik oturma düzeni' : 'Yeni salon detayları, kapasite ve otomatik oturma düzeni')}
                  </p>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 text-brand-ink/50 hover:text-brand-ink hover:bg-black/5 rounded-xl transition-all cursor-pointer shrink-0 ml-2"
                title="Pencereyi Kapat (ESC)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Tab Switcher (Yalnızca İdareci / Admin Düzenleme Modunda Görünür) */}
            {!isReadOnly && (
              <div className="md:hidden flex border-b border-brand-border/70 bg-[#FAF9F6] p-1.5 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileModalTab('settings')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    mobileModalTab === 'settings'
                      ? 'bg-[#151618] text-white shadow-xs'
                      : 'text-brand-ink/60 hover:text-brand-ink'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>1. Salon Ayarları & Öğrenciler</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileModalTab('preview')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
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

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#fcfbf7]/40">
              
              {/* Left Sidebar Form - Yalnızca İdareciler / Adminler İçin (Öğretmenler salon adı veya oturma düzeni oluşturamaz) */}
              {!isReadOnly && (
                <div className={`w-full md:w-1/3 border-r border-[#e6e2d3] p-4 sm:p-6 overflow-y-auto space-y-5 bg-white ${
                  mobileModalTab === 'settings' ? 'block' : 'hidden md:block'
                }`}>
                  
                  <div>
                    <label className="block text-xs font-bold text-[#8e8d82] mb-1.5 uppercase tracking-wider">Salon Adı / Yeri</label>
                    <input 
                      type="text" 
                      value={hallName} 
                      onChange={e => setHallName(e.target.value)}
                      className="w-full bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl px-3 py-2.5 text-sm font-bold text-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40]"
                      placeholder="Örn: 1. Kat - Salon A"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">Oturma Düzeni (Sütunlar)</label>
                      <span className="text-xs font-bold text-[#5a5a40] bg-[#f5f5f0] px-2 py-1 rounded-full border border-[#e6e2d3]">Toplam: {capacity}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {columns.map((col, idx) => (
                        <div key={col.id} className="flex flex-col bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 gap-2 relative group">
                          <button 
                            type="button"
                            onClick={() => setColumns(columns.filter(c => c.id !== col.id))}
                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <input 
                            type="text" 
                            value={col.name} 
                            onChange={e => {
                              const newCols = [...columns];
                              newCols[idx].name = e.target.value;
                              setColumns(newCols);
                            }}
                            className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1.5 text-xs font-bold text-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40]"
                            placeholder="Sütun Adı (örn: Cam Kenarı)"
                          />
                          <div className="flex gap-2">
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
                                    className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] shrink-0"
                                  />
                                  <span className="truncate flex-1">{exam.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Şubeler Seçimi */}
                    {selectedGrades.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">3. Dahil Edilecek Şubeler</label>
                          <button
                            type="button"
                            onClick={() => {
                              const activeGradeClasses = uniqueClasses.filter(c => selectedGrades.includes(getGradeLevel(c)));
                              const allSelected = activeGradeClasses.every(c => selectedClasses.includes(c));
                              if (allSelected) {
                                setSelectedClasses(selectedClasses.filter(c => !activeGradeClasses.includes(c)));
                              } else {
                                const newSet = new Set([...selectedClasses, ...activeGradeClasses]);
                                setSelectedClasses(Array.from(newSet));
                              }
                            }}
                            className="text-[10px] text-[#5a5a40] hover:underline font-bold"
                          >
                            Tümünü Seç / Kaldır
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {uniqueClasses
                            .filter(cls => selectedGrades.includes(getGradeLevel(cls)))
                            .map(clsName => {
                              const isSelected = selectedClasses.includes(clsName);
                              return (
                                <button
                                  key={clsName}
                                  type="button"
                                  onClick={() => toggleBranch(clsName)}
                                  className={`p-1.5 text-xs rounded-lg border font-bold flex items-center justify-between transition-colors ${
                                    isSelected 
                                      ? 'bg-white border-[#d4d19d] text-[#5a5a40] shadow-2xs' 
                                      : 'bg-[#fcfbf7] border-[#e6e2d3] text-gray-400 hover:bg-[#f5f5f0]'
                                  }`}
                                >
                                  <span>{clsName}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-[#5a5a40]" />}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Öğrenci Yoklama & Hariç Tutma Listesi */}
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

              {/* Right Content - Seating Plan Preview (Öğretmenler için Tam Ekran, Ferah ve Optimize Önizleme) */}
              <div className={`w-full ${!isReadOnly ? 'md:w-2/3' : 'w-full'} p-3.5 sm:p-6 flex flex-col overflow-hidden ${
                !isReadOnly && mobileModalTab !== 'preview' ? 'hidden md:flex' : 'flex'
              }`}>
                
                {/* Öğretmen Bilgi ve İşlem Şeridi (Kapasite, Yerleşen, Şubeler, Arama & Export) */}
                {isReadOnly ? (
                  <div className="mb-3 p-3 sm:p-4 bg-gradient-to-r from-indigo-50/90 via-white to-amber-50/70 border border-brand-border/80 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base sm:text-lg font-serif font-bold text-brand-ink truncate">
                          {hallName || 'Sınav Salonu'}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                          Yoklama & Oturma Planı
                        </span>
                        {seatingPlan.length >= capacity && capacity > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            Tam Dolu
                          </span>
                        ) : seatingPlan.length > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            %{Math.round((seatingPlan.length / (capacity || 1)) * 100)} Dolu
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                            Yerleşim Yapılmamış
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-brand-ink/70 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-brand-ink">
                          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Yerleşen: <strong className="text-indigo-900 font-bold">{seatingPlan.length}</strong> / {capacity} Kişi</span>
                        </span>
                        {selectedClasses.length > 0 && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <span className="text-brand-ink/30">•</span>
                            <span className="font-medium text-brand-ink/60">Şubeler:</span>
                            <span className="font-bold text-brand-ink">{selectedClasses.join(', ')}</span>
                          </span>
                        )}
                        {connectedExamNames.length > 0 && (
                          <span className="flex items-center gap-1 text-[11px] truncate max-w-xs sm:max-w-sm">
                            <span className="text-brand-ink/30">•</span>
                            <span className="font-medium text-brand-ink/60">Sınav:</span>
                            <span className="font-bold text-brand-ink truncate">{connectedExamNames.join(' & ')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Öğrenci Hızlı Arama & İndirme Butonları */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 text-brand-ink/40 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={highlightStudentQuery}
                          onChange={e => setHighlightStudentQuery(e.target.value)}
                          placeholder="Öğrenci veya No ara..."
                          className="w-full sm:w-44 pl-8 pr-7 py-1.5 bg-white border border-brand-border/80 rounded-xl text-xs text-brand-ink placeholder:text-brand-ink/40 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                        />
                        {highlightStudentQuery && (
                          <button
                            onClick={() => setHighlightStudentQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {highlightStudentQuery && highlightedSeatCount > 0 && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-100 text-indigo-900 border border-indigo-200">
                          {highlightedSeatCount} eşleşme
                        </span>
                      )}

                      {seatingPlan.length > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button 
                            onClick={() => handleExport({ id: editingHallId || '', name: hallName, capacity, columns, seatingPlan } as any)}
                            className="flex items-center px-2.5 sm:px-3 py-1.5 bg-white border border-brand-border/80 text-brand-ink hover:text-emerald-700 text-xs font-bold rounded-xl hover:border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                            title="Excel Yoklama Listesi İndir"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            <span className="hidden sm:inline">Excel</span>
                          </button>
                          <button 
                            onClick={() => handlePrintSchematic()}
                            className="flex items-center px-2.5 sm:px-3 py-1.5 bg-white border border-brand-border/80 text-brand-ink hover:text-indigo-700 text-xs font-bold rounded-xl hover:border-indigo-300 transition-colors shadow-2xs cursor-pointer"
                            title="PDF Şema Yazdır / İndir"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                            <span className="hidden sm:inline">Yazdır</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Admin Üst Çubuğu */
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <div>
                      <h4 className="text-base sm:text-lg font-serif font-bold text-[#5a5a40]">Oturma Düzeni Önizlemesi</h4>
                      {seatingPlan.length > 0 && (
                        <p className="text-[11px] sm:text-xs font-medium text-amber-700 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>
                            {draggedSeatNum 
                              ? `${draggedSeatNum}. sıra seçildi. Taşımak için hedef sıraya dokunun.`
                              : 'Öğrenciye dokunup ardından hedef sıraya dokunarak kolayca yer değiştirebilirsiniz.'}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {seatingPlan.length > 0 && (
                        <>
                          <button 
                            onClick={() => handleExport({ id: editingHallId || '', name: hallName, capacity, columns, seatingPlan } as any)}
                            className="flex items-center px-3 py-1.5 bg-[#fcfbf7] border border-[#e6e2d3] text-[#5a5a40] text-xs font-bold rounded-full hover:bg-[#f5f5f0] transition-colors cursor-pointer"
                            title="Excel Yoklama Listesi İndir"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Excel
                          </button>
                          <button 
                            onClick={() => handlePrintSchematic()}
                            className="flex items-center px-3 py-1.5 bg-[#fcfbf7] border border-[#e6e2d3] text-[#5a5a40] text-xs font-bold rounded-full hover:bg-[#f5f5f0] transition-colors cursor-pointer"
                            title="PDF Şema Yazdır"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Yazdır
                          </button>
                        </>
                      )}
                      <span className="bg-[#f5f5f0] border border-[#e6e2d3] text-[#5a5a40] px-3 py-1.5 rounded-full text-xs font-bold">
                        Yerleşen: {seatingPlan.length} / {capacity}
                      </span>
                    </div>
                  </div>
                )}

                {/* Salonda bulunan şubelerin renk kılavuzu (Öğretmenler için Kelebek Dağıtım Görselleştirmesi) */}
                {seatingPlan.length > 0 && hallPresentClasses.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mb-1.5 text-[10px] shrink-0">
                    <span className="text-brand-ink/50 font-bold uppercase tracking-wider shrink-0 mr-1">Şube Renkleri:</span>
                    {hallPresentClasses.map(cls => (
                      <span key={cls} className={`px-2 py-0.5 rounded-md border font-bold shrink-0 ${getClassBadgeColor(cls)}`}>
                        {cls}
                      </span>
                    ))}
                  </div>
                )}

                {/* Sınıf Yönü / Yazı Tahtası Göstergesi */}
                {seatingPlan.length > 0 && (
                  <div className="w-full flex items-center justify-center my-1.5 sm:my-2 shrink-0">
                    <div className="px-3.5 py-1 bg-white border border-brand-border/80 rounded-xl text-center shadow-2xs flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[10px] sm:text-xs font-bold text-brand-ink/70 uppercase tracking-wider">
                        👨‍🏫 YAZI TAHTASI / KÜRSÜ (ÖN CEPHE)
                      </span>
                    </div>
                  </div>
                )}

                {/* Oturma Düzeni Grid Konteyneri */}
                <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#fcfbf7]/60 border border-[#e6e2d3] rounded-2xl shadow-inner p-2 sm:p-5 print:bg-white print:border-none print:shadow-none print:p-0 print:overflow-visible touch-pan-x" id="seating-plan-printable">
                  {showSaveToast && (
                    <div className="absolute top-4 right-4 z-50 bg-green-50 text-green-700 px-3 py-1.5 rounded-full shadow-sm border border-green-200 text-xs font-bold flex items-center print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Kaydediliyor...
                    </div>
                  )}
                  {/* Ekran için başlık (yazdırıldığında görünür) */}
                  <div className="hidden print:block mb-8 text-center">
                    <h1 className="text-2xl font-bold">{hallName || 'Sınav Salonu'}</h1>
                    <p className="text-gray-500 mt-2">Oturma Düzeni</p>
                  </div>
                  
                  {seatingPlan.length > 0 ? (
                    <div className="flex gap-2.5 sm:gap-4 items-start min-w-[360px] sm:min-w-full justify-start sm:justify-between print:w-full print:justify-center print:gap-8 pb-4">
                      {columns.map((col, colIdx) => (
                        <div key={col.id} className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-[130px] sm:min-w-0">
                          <div className="text-center font-bold text-brand-ink/70 text-[10px] sm:text-xs uppercase tracking-wider print:text-black truncate px-1 bg-white/70 py-1 rounded-lg border border-brand-border/40 shadow-2xs">
                            {col.name}
                          </div>
                          
                          {Array.from({ length: col.deskCount }).map((_, rowIdx) => (
                            <div key={rowIdx} className="flex gap-1 sm:gap-2 p-1 sm:p-2 rounded-xl bg-white/60 border border-brand-border/70 print:border-black/20 print:bg-transparent shadow-2xs">
                              {Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                                // Calculate global seat number
                                let seatNum = 0;
                                for (let i = 0; i < colIdx; i++) {
                                  seatNum += columns[i].deskCount * columns[i].seatsPerDesk;
                                }
                                seatNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                                
                                const student = seatingPlan.find(s => s.deskNumber === seatNum);
                                const isHighlighted = Boolean(
                                  highlightStudentQuery.trim() && student && (
                                    student.studentName.toLowerCase().includes(highlightStudentQuery.trim().toLowerCase()) ||
                                    String(student.studentNo).includes(highlightStudentQuery.trim()) ||
                                    (student.studentClass && student.studentClass.toLowerCase().includes(highlightStudentQuery.trim().toLowerCase()))
                                  )
                                );
                                
                                return (
                                  <div 
                                    key={seatIdx}
                                    draggable={!isReadOnly && !!student}
                                    onClick={() => !isReadOnly && handleSeatClick(seatNum)}
                                    onDragStart={(e) => {
                                      if (!isReadOnly && student) handleDragStart(e, seatNum);
                                    }}
                                    onDragOver={(e) => !isReadOnly && handleDragOver(e, seatNum)}
                                    onDragLeave={(e) => !isReadOnly && handleDragLeave(e, seatNum)}
                                    onDrop={(e) => !isReadOnly && handleDrop(e, seatNum)}
                                    className={`flex flex-col items-center justify-center p-1 sm:p-2 rounded-lg border relative min-h-[4.5rem] sm:min-h-[5.2rem] flex-1 min-w-0 print:h-24 print:w-32 transition-all ${
                                      !isReadOnly ? 'hover:scale-105 hover:z-10 cursor-pointer' : 'cursor-default'
                                    } ${
                                      student 
                                        ? `bg-white border-brand-border shadow-2xs print:border-black ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}` 
                                        : 'bg-[#FAF9F6] border-dashed border-brand-border/80 print:border-gray-300'
                                    } ${
                                      isHighlighted 
                                        ? 'ring-3 ring-indigo-600 bg-indigo-50 font-extrabold scale-105 z-20 shadow-md border-indigo-400 animate-pulse' 
                                        : ''
                                    } ${draggedSeatNum === seatNum ? 'opacity-90 ring-2 ring-amber-500 bg-amber-50 scale-105 z-20 shadow-md' : ''} ${dragOverSeatNum === seatNum ? 'ring-2 ring-amber-500 bg-amber-50 scale-105' : ''}`}
                                  >
                                    <span className={`absolute top-0.5 left-1 sm:top-1 sm:left-1.5 text-[8px] sm:text-[10px] font-bold print:text-black print:text-xs ${
                                      isHighlighted ? 'text-indigo-800' : 'text-brand-ink/50'
                                    }`}>
                                      {seatNum}
                                    </span>
                                    
                                    {student ? (
                                      <>
                                        <span className={`text-[9.5px] sm:text-[11px] font-bold text-center line-clamp-2 leading-tight px-0.5 mt-2.5 sm:mt-2.5 print:text-black print:text-sm break-words ${
                                          isHighlighted ? 'text-indigo-950 font-extrabold' : 'text-brand-ink'
                                        }`}>
                                          {student.studentName}
                                        </span>
                                        <div className="mt-auto flex items-center justify-center gap-0.5 sm:gap-1 w-full print:mt-1 flex-wrap">
                                          <span className="text-[8px] sm:text-[9px] bg-[#FAF9F6] text-brand-ink/70 px-1 py-0.5 rounded font-semibold border border-brand-border/60 print:bg-transparent print:border print:border-gray-300 print:text-black truncate max-w-full">
                                            No: {student.studentNo}
                                          </span>
                                          <span className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded font-bold border print:bg-transparent print:border print:border-gray-300 print:text-black truncate max-w-full ${getClassBadgeColor(student.studentClass)}`}>
                                            {student.studentClass}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[9px] sm:text-[10px] text-brand-ink/40 font-medium">Boş Sıra</span>
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
                    <div className="h-full flex flex-col items-center justify-center text-brand-ink/50 p-8 text-center space-y-3">
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-full text-indigo-600">
                        <Users className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-medium">
                        {isReadOnly 
                          ? 'Bu sınav salonu için henüz yönetici tarafından bir oturma düzeni oluşturulmamış.' 
                          : <>Henüz oturma düzeni oluşturulmadı.<br/>Sol panelden sınıf seçip <strong>"Oturma Düzeni Oluştur"</strong> butonuna tıklayın.</>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Mobilde Yatay Kaydırma Yönlendirmesi */}
                {seatingPlan.length > 0 && (
                  <div className="sm:hidden text-center text-[10px] text-brand-ink/50 pt-1.5 font-medium flex items-center justify-center gap-1 shrink-0">
                    <span>↔️ Tüm sıraları incelemek için parmağınızla sağa/sola kaydırabilirsiniz</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#FAF9F6] border-t border-brand-border/70 p-3 sm:p-4 flex items-center justify-between shrink-0">
              <div className="text-xs text-brand-ink/60">
                {isReadOnly ? (
                  <span>
                    Sınav Salonu: <strong className="text-brand-ink">{hallName || 'Belirtilmedi'}</strong> ({capacity} Sıra Kapasite, {seatingPlan.length} Öğrenci)
                  </span>
                ) : (
                  <span>
                    Kapasite: <strong className="text-brand-ink">{capacity}</strong> Sıra | Yerleşen: <strong className="text-brand-ink">{seatingPlan.length}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-xs sm:text-sm text-brand-ink/70 hover:text-brand-ink font-bold rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
                >
                  {isReadOnly ? 'Pencereyi Kapat' : 'İptal'}
                </button>
                {!isReadOnly && (
                  <button
                    onClick={handleSaveHall}
                    className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#151618] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    Salonu Kaydet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
