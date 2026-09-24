import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ExamHall, SeatingPlanItem } from '../types';
import { generateId, exportToExcel } from '../lib/utils';
import { Plus, Trash2, Download, LayoutTemplate, X, Users, RefreshCw, AlertCircle, Building, MapPin, Search, Filter, ChevronDown, CheckCircle2, Eye } from 'lucide-react';

export const HallsView = () => {
  const { state, setExamHalls } = useAppContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHallId, setEditingHallId] = useState<string | null>(null);
  const [mobileModalTab, setMobileModalTab] = useState<'settings' | 'preview'>('settings');
  
  // Mobile Quick Toggles & Filters
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'full' | 'partial' | 'empty'>('all');

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

  const capacity = columns.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0);

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
      // Add all classes of this grade to selectedClasses (avoiding duplicates)
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
    
    // Backwards compatibility check
    let initialExamIds = hall.examIds || [];
    if (initialExamIds.length === 0 && hall.examId) {
      initialExamIds = [hall.examId];
    }
    setSelectedExamIds(initialExamIds);
    setSelectedClasses(hall.selectedClasses || []);
    
    // Initialize selectedGrades from selectedClasses
    const initialClasses = hall.selectedClasses || [];
    const initialGrades = Array.from(new Set(initialClasses.map(c => {
      const match = c.trim().match(/^(\d+)/);
      return match ? match[1] : 'Diğer';
    })));
    setSelectedGrades(initialGrades);

    setSeatingPlan(hall.seatingPlan || []);
    
    // Determine which eligible registered students are NOT seated
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
    setMobileModalTab('settings');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHallId(null);
  };

  const handleDragStart = (e: React.DragEvent, seatNum: number) => {
    setDraggedSeatNum(seatNum);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', seatNum.toString());
  };

  const handleDragOver = (e: React.DragEvent, seatNum: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSeatNum !== seatNum) {
      setDragOverSeatNum(seatNum);
    }
  };

  const handleDragLeave = (e: React.DragEvent, seatNum: number) => {
    e.preventDefault();
    if (dragOverSeatNum === seatNum) {
      setDragOverSeatNum(null);
    }
  };

  const handleDrop = (e: React.DragEvent | { preventDefault: () => void; dataTransfer?: any }, targetSeatNum: number) => {
    e.preventDefault();
    setDragOverSeatNum(null);
    
    // Fallback to dataTransfer if state was lost
    const sourceSeatNumStr = (e as any).dataTransfer?.getData ? (e as any).dataTransfer.getData('text/plain') : null;
    const sourceSeatNum = draggedSeatNum !== null ? draggedSeatNum : (sourceSeatNumStr ? parseInt(sourceSeatNumStr, 10) : null);
    
    if (sourceSeatNum === null || sourceSeatNum === targetSeatNum) {
      setDraggedSeatNum(null);
      return;
    }

    setSeatingPlan(prev => {
      const newPlan = [...prev];
      const sourceIndex = newPlan.findIndex(s => s.deskNumber === sourceSeatNum);
      const targetIndex = newPlan.findIndex(s => s.deskNumber === targetSeatNum);

      if (sourceIndex > -1 && targetIndex > -1) {
        // Swap
        const tempDesk = newPlan[sourceIndex].deskNumber;
        newPlan[sourceIndex] = { ...newPlan[sourceIndex], deskNumber: newPlan[targetIndex].deskNumber };
        newPlan[targetIndex] = { ...newPlan[targetIndex], deskNumber: tempDesk };
      } else if (sourceIndex > -1) {
        // Move source to empty target
        newPlan[sourceIndex] = { ...newPlan[sourceIndex], deskNumber: targetSeatNum };
      } else if (targetIndex > -1) {
        // Move target to empty source
        newPlan[targetIndex] = { ...newPlan[targetIndex], deskNumber: sourceSeatNum };
      }

      return newPlan;
    });
    setDraggedSeatNum(null);
    setShowSaveToast(true);
    setTimeout(() => {
      setShowSaveToast(false);
    }, 1500);
  };

  // Touch / Click to swap desks easily on mobile
  const handleSeatClick = (seatNum: number) => {
    if (draggedSeatNum === null) {
      const hasStudent = seatingPlan.some(s => s.deskNumber === seatNum);
      if (hasStudent) {
        setDraggedSeatNum(seatNum);
      }
    } else if (draggedSeatNum === seatNum) {
      setDraggedSeatNum(null);
    } else {
      handleDrop({ preventDefault: () => {} } as any, seatNum);
    }
  };

  const handleGenerateSeating = () => {
    if (selectedClasses.length === 0) {
      alert("Lütfen önce sınıfları seçin.");
      return;
    }
    
    const eligibleStudents = activeStudentsForSeating;
    if (eligibleStudents.length === 0) {
      alert("Seçilen ve sınava katılması onaylanan (seçili) aktif öğrenci bulunmuyor.");
      return;
    }

    // Shuffle students randomly
    const shuffled = [...eligibleStudents].sort(() => 0.5 - Math.random());
    
    const newPlan: SeatingPlanItem[] = [];
    const maxDesks = Math.min(capacity, shuffled.length);
    
    for (let i = 0; i < maxDesks; i++) {
      newPlan.push({
        deskNumber: i + 1,
        studentId: shuffled[i].id,
        studentNo: shuffled[i].no,
        studentName: shuffled[i].name,
        studentClass: shuffled[i].className
      });
    }

    setSeatingPlan(newPlan);
    setMobileModalTab('preview');
  };

  const handleSaveHall = () => {
    if (!hallName.trim()) {
      alert("Lütfen salon adı girin.");
      return;
    }

    const hallData: ExamHall = {
      id: editingHallId || generateId(),
      name: hallName,
      capacity,
      examId: selectedExamIds.length > 0 ? selectedExamIds[0] : undefined, // backwards compatibility
      examIds: selectedExamIds,
      selectedClasses,
      seatingPlan,
      columns
    };

    if (editingHallId) {
      setExamHalls(state.examHalls.map(h => h.id === editingHallId ? hallData : h));
    } else {
      setExamHalls([...state.examHalls, hallData]);
    }
    closeModal();
  };

  const removeHall = (hallId: string) => {
    const hall = state.examHalls.find(h => h.id === hallId);
    const hallName = hall?.name || 'Bu salonu';
    if (window.confirm(`${hallName} silinecektir. Onaylıyor musunuz?`)) {
      setExamHalls(state.examHalls.filter(h => h.id !== hallId));
    }
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

  // Filtered Halls
  const filteredHalls = useMemo(() => {
    return state.examHalls.filter(hall => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = hall.name.toLowerCase().includes(q);
        const classMatch = (hall.selectedClasses || []).some(c => c.toLowerCase().includes(q));
        if (!nameMatch && !classMatch) return false;
      }

      if (occupancyFilter !== 'all') {
        const used = hall.seatingPlan?.length || 0;
        const total = hall.capacity || 0;
        if (occupancyFilter === 'full' && (used < total || total === 0)) return false;
        if (occupancyFilter === 'empty' && used > 0) return false;
        if (occupancyFilter === 'partial' && (used === 0 || used >= total)) return false;
      }

      return true;
    });
  }, [state.examHalls, searchQuery, occupancyFilter]);

  const handleExport = (hall: ExamHall) => {
    if (!hall.seatingPlan || hall.seatingPlan.length === 0) {
      alert("Dışa aktarılacak oturma düzeni bulunmuyor.");
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
  };

  const handlePrintSchematic = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup engelleyiciyi kapatıp tekrar deneyin veya yeni sekmede açın.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>${hallName || 'Sinav Salonu'} - Oturma Duzeni</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              color: #000; 
              margin: 0; 
              padding: 0; 
              width: 190mm;
              height: 277mm;
              display: flex;
              flex-direction: column;
            }
            * { box-sizing: border-box; }
            .header { text-align: center; margin-bottom: 20px; flex-shrink: 0; }
            .header h1 { margin: 0 0 5px 0; font-size: 20px; font-weight: bold; }
            .header p { margin: 0; color: #666; font-size: 12px; }
            
            .grid-container {
               display: flex;
               gap: 15px;
               justify-content: center;
               align-items: stretch;
               flex: 1;
               min-height: 0;
            }
            .column {
               display: flex;
               flex-direction: column;
               gap: 10px;
               flex: 1;
               min-width: 0;
            }
            .col-title {
               text-align: center;
               font-weight: bold;
               text-transform: uppercase;
               color: #333;
               margin-bottom: 2px;
               font-size: 12px;
               flex-shrink: 0;
            }
            .desk-row {
               display: flex;
               gap: 5px;
               padding: 5px;
               border: 1.5px solid #ccc;
               border-radius: 6px;
               background: #f9f9f9;
               flex: 1;
               min-height: 0;
            }
            .seat {
               flex: 1;
               min-width: 0;
               border: 1px solid #000;
               border-radius: 4px;
               padding: 4px;
               display: flex;
               flex-direction: column;
               align-items: center;
               justify-content: center;
               position: relative;
               background: #fff;
               overflow: hidden;
            }
            .seat.empty {
               border: 1px dashed #aaa;
               background: #fafafa;
            }
            .seat-num {
               position: absolute;
               top: 2px;
               left: 4px;
               font-size: 9px;
               font-weight: bold;
               color: #333;
            }
            .student-name {
               font-size: 10px;
               font-weight: bold;
               text-align: center;
               margin-top: 6px;
               line-height: 1.1;
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
               border: 1px solid #ccc;
               border-radius: 2px;
               color: #444;
               white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${hallName || 'Sınav Salonu'}</h1>
            <p>Oturma Düzeni Şeması</p>
          </div>
          <div class="grid-container">
            ${columns.map((col, colIdx) => `
              <div class="column">
                <div class="col-title">${col.name}</div>
                ${Array.from({ length: col.deskCount }).map((_, rowIdx) => `
                  <div class="desk-row">
                    ${Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                      let seatNum = 0;
                      for (let i = 0; i < colIdx; i++) {
                        seatNum += columns[i].deskCount * columns[i].seatsPerDesk;
                      }
                      seatNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                      const student = seatingPlan.find(s => s.deskNumber === seatNum);
                      
                      if (student) {
                        return `
                          <div class="seat">
                            <span class="seat-num">${seatNum}</span>
                            <span class="student-name">${student.studentName}</span>
                            <div class="student-meta">
                              <span>${student.studentNo}</span>
                              <span>${student.studentClass}</span>
                            </div>
                          </div>
                        `;
                      } else {
                        return `
                          <div class="seat empty">
                            <span class="seat-num">${seatNum}</span>
                            <span style="color:#aaa; font-size: 12px; margin-top: 10px;">Boş</span>
                          </div>
                        `;
                      }
                    }).join('')}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
               setTimeout(function() {
                 window.print();
                 window.close();
               }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-3 sm:space-y-6 pb-20 md:pb-12 flex flex-col h-full relative">
      {/* Header */}
      <header className="flex flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-500/15 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
            <Building className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-serif text-brand-ink font-bold tracking-tight leading-tight">
                Sınav Salonları
              </h2>
              <span className="sm:hidden text-xs font-bold text-brand-ink/70 bg-[#F5F4F0] px-2 py-0.5 rounded-md border border-brand-border">
                {state.examHalls.length} Salon
              </span>
            </div>
            <p className="hidden sm:block text-brand-ink/60 text-xs sm:text-sm mt-1">
              Sınav salonlarını, kapasitelerini ve otomatik oturma düzenlerini yönetin
            </p>
          </div>
        </div>

        <button 
          onClick={openNewModal} 
          className="flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#151618] border border-[#151618] text-white text-xs font-bold rounded-xl transition-all hover:bg-black active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
          <span className="hidden sm:inline">Yeni Salon Oluştur</span>
          <span className="sm:hidden">Yeni Salon</span>
        </button>
      </header>

      {/* Mobile Quick Toggles */}
      <div className="flex sm:hidden items-center gap-1.5 px-0.5">
        <button
          type="button"
          onClick={() => setIsMobileStatsOpen(prev => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
            isMobileStatsOpen 
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-900' 
              : 'bg-white border-brand-border/80 text-brand-ink/70 hover:text-brand-ink shadow-2xs'
          }`}
        >
          <Building className="w-3 h-3 text-amber-600 shrink-0" />
          <span>İstatistikler</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isMobileStatsOpen ? 'rotate-180 text-amber-700' : 'text-brand-ink/40'}`} />
        </button>

        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(prev => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
            isMobileFiltersOpen || searchQuery || occupancyFilter !== 'all'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900' 
              : 'bg-white border-brand-border/80 text-brand-ink/70 hover:text-brand-ink shadow-2xs'
          }`}
        >
          <Filter className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Filtreler</span>
          {(searchQuery || occupancyFilter !== 'all') && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${isMobileFiltersOpen ? 'rotate-180 text-emerald-700' : 'text-brand-ink/40'}`} />
        </button>
      </div>

      {/* Mobile Active Filter Chips */}
      {!isMobileFiltersOpen && (searchQuery || occupancyFilter !== 'all') && (
        <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200 shrink-0">
              <span>"{searchQuery}"</span>
              <button onClick={() => setSearchQuery('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {occupancyFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-medium border border-blue-200 shrink-0">
              <span>
                {occupancyFilter === 'full' ? 'Tam Dolu' : occupancyFilter === 'partial' ? 'Kısmi Dolu' : 'Boş'}
              </span>
              <button onClick={() => setOccupancyFilter('all')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          <button 
            onClick={() => { setSearchQuery(''); setOccupancyFilter('all'); }}
            className="text-[10px] text-rose-600 font-bold px-1 py-0.5 shrink-0 underline cursor-pointer"
          >
            Sıfırla
          </button>
        </div>
      )}

      {/* Summary Stats - Collapsible on Mobile */}
      <section className={`${isMobileStatsOpen ? 'grid' : 'hidden'} sm:grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-4 md:gap-5`}>
        {/* Stat 1: Toplam Salon */}
        <div className="bg-white px-2.5 py-2 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              Toplam Salon
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-brand-ink leading-none">{summaryStats.totalHalls}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">salon</span>
          </div>
        </div>

        {/* Stat 2: Toplam Kapasite */}
        <div className="bg-white px-2.5 py-2 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              Toplam Kapasite
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <LayoutTemplate className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-brand-ink leading-none">{summaryStats.totalCapacity}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">sıra/kişi</span>
          </div>
        </div>

        {/* Stat 3: Yerleşen Öğrenci */}
        <div className="bg-white px-2.5 py-2 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              Yerleşen Öğrenci
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-emerald-700 leading-none">{summaryStats.totalSeated}</span>
            <span className="text-[9px] sm:text-xs text-emerald-600/70 font-medium">öğrenci</span>
          </div>
        </div>

        {/* Stat 4: Ortalama Doluluk */}
        <div className="bg-white px-2.5 py-2 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-amber-300">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              Ortalama Doluluk
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-serif text-sm sm:text-2xl md:text-3xl font-bold text-amber-700 leading-none">%{summaryStats.occupancyRate}</span>
            <span className="text-[9px] sm:text-xs text-amber-600/70 font-medium">oran</span>
          </div>
        </div>
      </section>

      {/* Filter / Search Controls - Collapsible on Mobile */}
      <div className={`${isMobileFiltersOpen ? 'flex' : 'hidden'} sm:flex p-2.5 sm:p-4 bg-white rounded-2xl border border-brand-border/70 shadow-2xs sm:shadow-sm flex-col sm:flex-row justify-between gap-2 sm:gap-2.5`}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/40 h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Salon adı veya atanmış şube ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAF9F6] border border-brand-border/80 rounded-xl pl-9 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm text-brand-ink placeholder-brand-ink/40 font-medium focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 focus:bg-white focus:outline-none transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-ink p-1 rounded-md"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={occupancyFilter}
              onChange={(e) => setOccupancyFilter(e.target.value as any)}
              className="w-full sm:w-auto appearance-none pl-3 pr-7 py-1.5 sm:py-2 bg-white border border-brand-border/80 rounded-xl text-xs text-brand-ink font-semibold focus:outline-none focus:border-brand-accent min-w-[130px] shadow-xs cursor-pointer"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="full">Tam Dolu Salonlar</option>
              <option value="partial">Kısmi Dolu Salonlar</option>
              <option value="empty">Boş Salonlar</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40 h-3.5 w-3.5 pointer-events-none" />
          </div>

          {(searchQuery || occupancyFilter !== 'all') && (
            <button 
              onClick={() => { setSearchQuery(''); setOccupancyFilter('all'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold shrink-0 transition-colors shadow-xs active:scale-95 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Temizle</span>
            </button>
          )}
        </div>
      </div>

      {/* Halls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 overflow-auto pb-10">
        {filteredHalls.map(hall => {
          const usedCapacity = hall.seatingPlan?.length || 0;
          const totalCapacity = hall.capacity || 0;
          const percentage = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;
          const isFull = percentage >= 100;
          const isEmpty = usedCapacity === 0;
          
          return (
            <div 
              key={hall.id} 
              className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs sm:shadow-sm border border-brand-border/70 hover:border-brand-accent/50 flex flex-col justify-between transition-all group relative"
            >
              {/* Card Header Row */}
              <div className="flex items-start justify-between gap-2 mb-2">
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
                  <div className="text-[11px] text-brand-ink/60 mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <Building className="w-3 h-3 text-brand-ink/50" />
                      {totalCapacity} Kişi Kapasite
                    </span>
                    <span>•</span>
                    <span className="font-medium text-brand-ink/60">
                      {hall.columns?.length || 0} Sütun
                    </span>
                  </div>
                </div>

                {/* Quick actions top-right */}
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => handleExport(hall)} 
                    className="p-1.5 sm:p-2 text-brand-ink/60 hover:text-brand-ink hover:bg-[#FAF9F6] rounded-xl transition-all cursor-pointer border border-transparent hover:border-brand-border/80 active:scale-95 shadow-2xs" 
                    title="Yoklama Listesi İndir"
                    aria-label="Yoklama Listesi İndir"
                  >
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button 
                    onClick={() => removeHall(hall.id)} 
                    className="p-1.5 sm:p-2 text-brand-ink/50 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-200 active:scale-95 shadow-2xs" 
                    title="Salonu Sil"
                    aria-label="Salonu Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* Assigned Classes / Badges */}
              {hall.selectedClasses && hall.selectedClasses.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap my-2 py-1.5 border-t border-b border-brand-border/40">
                  <span className="text-[10px] font-semibold text-brand-ink/60 mr-0.5">Şubeler:</span>
                  {hall.selectedClasses.slice(0, 4).map(cls => (
                    <span key={cls} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FAF9F6] text-brand-ink border border-brand-border/80">
                      {cls}
                    </span>
                  ))}
                  {hall.selectedClasses.length > 4 && (
                    <span className="text-[10px] font-bold text-brand-ink/50">
                      +{hall.selectedClasses.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Occupancy Progress */}
              <div className="mt-auto pt-2 space-y-1.5 sm:space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-brand-ink/60 text-[11px]">Yerleşen Öğrenci</span>
                  <span className="font-bold text-brand-ink text-xs">
                    {usedCapacity} <span className="text-brand-ink/40 font-normal">/ {totalCapacity}</span>
                  </span>
                </div>
                <div className="w-full bg-[#F5F4F0] h-2 rounded-full overflow-hidden border border-brand-border/40">
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
                  className="w-full mt-2.5 py-2.5 px-3 bg-[#FAF9F6] border border-brand-border/80 text-brand-ink hover:bg-white hover:border-brand-accent hover:text-brand-accent font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-brand-ink/60 group-hover:text-brand-accent shrink-0" />
                  <span>Detayları ve Oturma Düzenini Gör</span>
                </button>
              </div>
            </div>
          );
        })}
        
        {filteredHalls.length === 0 && (
          <div className="col-span-full text-center p-8 sm:p-12 bg-white rounded-2xl border border-dashed border-[#e6e2d3] text-[#8e8d82]">
            <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-[#8e8d82]/40" />
            <h4 className="text-sm font-bold text-[#5a5a40] mb-1">
              {state.examHalls.length === 0 ? 'Henüz sınav salonu oluşturmadınız' : 'Aramanızla eşleşen sınav salonu bulunamadı'}
            </h4>
            <p className="text-xs text-[#8e8d82] max-w-sm mx-auto mb-4">
              {state.examHalls.length === 0 
                ? 'Yukarıdaki "Yeni Salon Oluştur" butonuna tıklayarak salon ve otomatik oturma düzeni oluşturabilirsiniz.' 
                : 'Farklı bir arama terimi deneyin veya filtreleri temizleyin.'}
            </p>
            {state.examHalls.length === 0 ? (
              <button 
                onClick={openNewModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5a5a40] text-white rounded-xl text-xs font-bold hover:bg-[#43423b] active:scale-95 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>İlk Salonu Oluştur</span>
              </button>
            ) : (
              <button 
                onClick={() => { setSearchQuery(''); setOccupancyFilter('all'); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f5f5f0] text-[#5a5a40] rounded-xl text-xs font-bold hover:bg-[#e6e2d3] transition-all cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Filtreleri Sıfırla</span>
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
          <div className="bg-white rounded-2xl sm:rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full max-w-4xl h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden animate-slide-up max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-[#FAF9F6] border-b border-brand-border/70 p-3.5 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <div className="bg-indigo-500/15 p-2 rounded-xl text-indigo-700">
                  <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-serif text-brand-ink font-bold leading-tight">
                    {editingHallId ? 'Sınav Salonu Düzenle' : 'Yeni Sınav Salonu Oluştur'}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-brand-ink/60">
                    Salon detayları, kapasite ve otomatik oturma düzeni
                  </p>
                </div>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 text-brand-ink/50 hover:text-brand-ink hover:bg-black/5 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Tab Switcher */}
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

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#fcfbf7]/40">
              
              {/* Left Sidebar Form */}
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
                              className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1.5 text-xs font-bold text-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40]"
                              min="1"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-[#8e8d82] font-semibold mb-1 block">Sıra Tipi</label>
                            <select 
                              value={col.seatsPerDesk}
                              onChange={e => {
                                const newCols = [...columns];
                                newCols[idx].seatsPerDesk = parseInt(e.target.value);
                                setColumns(newCols);
                              }}
                              className="w-full bg-white border border-[#e6e2d3] rounded-lg px-2 py-1.5 text-xs font-bold text-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40]"
                            >
                              <option value={1}>Tekli</option>
                              <option value={2}>İkili</option>
                              <option value={3}>Üçlü</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setColumns([...columns, { id: generateId(), name: `Sütun ${columns.length + 1}`, deskCount: 5, seatsPerDesk: 2 }])}
                    className="w-full py-2 border-2 border-dashed border-[#d4d19d] text-[#5a5a40] text-xs font-bold rounded-xl hover:bg-[#f5f5f0] transition-colors flex items-center justify-center"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Sütun Ekle
                  </button>
                </div>

                {/* Katılacak Sınıf Seviyeleri */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">
                    Katılacak Sınıf Seviyeleri
                  </label>
                  <p className="text-[11px] text-[#8e8d82] leading-tight">
                    Salonun atanacağı sınıf seviyelerini seçin.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableGradeLevels.map(lvl => {
                      const isChecked = selectedGrades.includes(lvl);
                      const classesOfThisGrade = uniqueClasses.filter(c => getGradeLevel(c) === lvl);
                      const selectedCount = classesOfThisGrade.filter(c => selectedClasses.includes(c)).length;
                      
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => toggleGrade(lvl)}
                          className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center flex flex-col justify-center items-center ${
                            isChecked 
                              ? 'bg-[#5a5a40] text-white border-transparent shadow-sm' 
                              : 'bg-white text-[#5a5a40] border-[#e6e2d3] hover:bg-[#f5f5f0]'
                          }`}
                        >
                          <span>{lvl === 'Diğer' ? 'Diğer Sınıflar' : `${lvl}. Sınıflar`}</span>
                          {classesOfThisGrade.length > 0 && (
                            <span className={`text-[9px] mt-0.5 font-normal ${isChecked ? 'text-gray-200' : 'text-[#8e8d82]'}`}>
                              ({selectedCount}/{classesOfThisGrade.length} Şube)
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {availableGradeLevels.length === 0 && (
                    <div className="text-xs text-[#8e8d82] italic">Sistemde henüz sınıf tanımlanmamış.</div>
                  )}
                </div>

                {/* Sınıf Şubeleri Filtreleme */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">
                      Şube Filtreleme / Seçimi
                    </label>
                    {selectedClasses.length > 0 && (
                      <span className="text-[10px] font-bold text-[#5a5a40] bg-[#f5f5f0] px-2 py-0.5 rounded-full border border-[#e6e2d3]">
                        {selectedClasses.length} Şube Seçili
                      </span>
                    )}
                  </div>
                  
                  {selectedGrades.length === 0 ? (
                    <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic">
                      Yukarıdan sınıf seviyesi seçtiğinizde şubeler burada listelenir.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {uniqueClasses
                        .filter(c => selectedGrades.includes(getGradeLevel(c)))
                        .map(clsName => {
                          const isChecked = selectedClasses.includes(clsName);
                          return (
                            <button
                              key={clsName}
                              type="button"
                              onClick={() => toggleBranch(clsName)}
                              className={`p-1.5 rounded-lg text-xs font-bold border transition-all text-center ${
                                isChecked 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm font-bold' 
                                  : 'bg-white text-[#5a5a40] border-[#e6e2d3] hover:bg-gray-50'
                              }`}
                            >
                              {clsName}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Bağlantılı Deneme Sınavları */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#8e8d82] mb-1 uppercase tracking-wider">
                    Bağlantılı Deneme Sınavları
                  </label>
                  <p className="text-[11px] text-[#8e8d82] leading-tight mb-2">
                    Bu sınav salonunda uygulanacak olan ve seçili sınıf seviyelerine uygun deneme sınavlarını seçin.
                  </p>
                  <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {selectedGrades.length === 0 ? (
                      <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic">
                        Bağlantılı sınavları görebilmek için önce katılacak sınıf seviyelerini seçin.
                      </div>
                    ) : filteredExams.length > 0 ? (
                      filteredExams.map(ex => {
                        const isChecked = selectedExamIds.includes(ex.id);
                        return (
                          <label key={ex.id} className="flex items-start space-x-2 cursor-pointer p-2 rounded-xl hover:bg-[#f5f5f0] border border-transparent hover:border-[#e6e2d3] transition-all bg-white shadow-sm">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedExamIds(selectedExamIds.filter(id => id !== ex.id));
                                } else {
                                  setSelectedExamIds([...selectedExamIds, ex.id]);
                                }
                              }}
                              className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] mt-1 shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#5a5a40] truncate">{ex.name}</span>
                              <span className="text-[9px] text-[#8e8d82] mt-0.5">
                                Sınıf Seviyeleri: {ex.participatingClasses?.map(g => `${g}. Sınıf`).join(', ') || 'Belirtilmemiş'}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic leading-normal">
                        Seçili sınıf seviyelerine ({selectedGrades.map(g => `${g === 'Diğer' ? 'Diğer' : `${g}. Sınıf`}`).join(', ')}) uygun tanımlanmış aktif deneme sınavı bulunamadı.
                      </div>
                    )}
                  </div>
                </div>

                {/* Sınava Kayıtlı Öğrenciler ve Toplu Seçim */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#8e8d82] uppercase tracking-wider">
                      Sınava Kayıtlı Öğrenciler
                    </label>
                    {registeredStudentsForSeating.length > 0 && (
                      <span className="text-[10px] font-bold text-[#5a5a40] bg-[#f5f5f0] px-2 py-0.5 rounded-full border border-[#e6e2d3]">
                        {activeStudentsForSeating.length} / {registeredStudentsForSeating.length} Seçili
                      </span>
                    )}
                  </div>
                  
                  {selectedClasses.length === 0 ? (
                    <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic">
                      Katılacak sınıfları seçtiğinizde kayıtlı öğrenciler burada listelenir.
                    </div>
                  ) : selectedExamIds.length === 0 ? (
                    <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic">
                      Lütfen önce yukarıdan deneme sınavı seçin.
                    </div>
                  ) : registeredStudentsForSeating.length === 0 ? (
                    <div className="text-xs text-[#8e8d82] bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3 italic">
                      Seçilen sınıflarda bu sınava kayıtlı öğrenci bulunamadı.
                    </div>
                  ) : (
                    <div className="border border-[#e6e2d3] rounded-xl bg-[#fcfbf7] overflow-hidden">
                      {/* Toplu Seçim Başlığı */}
                      <div className="flex items-center justify-between px-3 py-2 bg-[#f5f5f0] border-b border-[#e6e2d3]">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={registeredStudentsForSeating.length > 0 && deselectedStudentIds.length === 0}
                            ref={el => {
                              if (el) {
                                el.indeterminate = deselectedStudentIds.length > 0 && deselectedStudentIds.length < registeredStudentsForSeating.length;
                              }
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDeselectedStudentIds([]);
                              } else {
                                setDeselectedStudentIds(registeredStudentsForSeating.map(s => s.id));
                              }
                            }}
                            className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] h-3.5 w-3.5"
                          />
                          <span className="text-xs font-bold text-[#5a5a40]">Tümünü Seç</span>
                        </label>
                      </div>
                      
                      {/* Öğrenci Listesi */}
                      <div className="max-h-[160px] overflow-y-auto p-1.5 space-y-1">
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
                    className="w-full flex items-center justify-center space-x-2 bg-[#d4d19d] text-[#5a5a40] font-bold text-sm py-3 rounded-xl hover:bg-[#e6e2d3] transition-all shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Oturma Düzeni Oluştur</span>
                  </button>
                  <p className="text-[10px] text-[#8e8d82] text-center mt-2 leading-tight">
                    Seçili sınıflardaki öğrenciler rastgele karıştırılarak belirtilen kapasiteye göre sıralanır.
                  </p>
                </div>
              </div>

              {/* Right Content - Seating Plan Preview */}
              <div className={`w-full md:w-2/3 p-4 sm:p-6 flex-col overflow-hidden ${
                mobileModalTab === 'preview' ? 'flex' : 'hidden md:flex'
              }`}>
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
                      <button 
                        onClick={handlePrintSchematic}
                        className="flex items-center px-3 py-1.5 bg-[#fcfbf7] border border-[#e6e2d3] text-[#5a5a40] text-xs font-bold rounded-full hover:bg-[#f5f5f0] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> PDF İndir
                      </button>
                    )}
                    <span className="bg-[#f5f5f0] border border-[#e6e2d3] text-[#5a5a40] px-3 py-1.5 rounded-full text-xs font-bold">
                      Yerleşen: {seatingPlan.length} / {capacity}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#fcfbf7]/50 border border-[#e6e2d3] rounded-2xl shadow-inner p-2 sm:p-4 print:bg-white print:border-none print:shadow-none print:p-0 print:overflow-visible" id="seating-plan-printable">
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
                    <div className="flex gap-2 sm:gap-4 items-start min-w-[340px] sm:min-w-full justify-start sm:justify-between print:w-full print:justify-center print:gap-8 pb-4">
                      {columns.map((col, colIdx) => (
                        <div key={col.id} className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="text-center font-bold text-[#8e8d82] text-[10px] sm:text-xs uppercase tracking-wider print:text-black truncate px-1">
                            {col.name}
                          </div>
                          
                          {Array.from({ length: col.deskCount }).map((_, rowIdx) => (
                            <div key={rowIdx} className="flex gap-1 sm:gap-2 p-1 sm:p-2 rounded-xl bg-[#f5f5f0]/50 border-2 border-[#e6e2d3]/50 print:border-black/20 print:bg-transparent">
                              {Array.from({ length: col.seatsPerDesk }).map((_, seatIdx) => {
                                // Calculate global seat number
                                let seatNum = 0;
                                for (let i = 0; i < colIdx; i++) {
                                  seatNum += columns[i].deskCount * columns[i].seatsPerDesk;
                                }
                                seatNum += (rowIdx * col.seatsPerDesk) + seatIdx + 1;
                                
                                const student = seatingPlan.find(s => s.deskNumber === seatNum);
                                
                                return (
                                  <div 
                                    key={seatIdx}
                                    draggable={!!student}
                                    onClick={() => handleSeatClick(seatNum)}
                                    onDragStart={(e) => {
                                      if (student) handleDragStart(e, seatNum);
                                    }}
                                    onDragOver={(e) => handleDragOver(e, seatNum)}
                                    onDragLeave={(e) => handleDragLeave(e, seatNum)}
                                    onDrop={(e) => handleDrop(e, seatNum)}
                                    className={`flex flex-col items-center justify-center p-1 sm:p-2 rounded-lg border relative min-h-[4.5rem] sm:min-h-[5rem] flex-1 min-w-0 print:h-24 print:w-32 transition-transform hover:scale-105 hover:z-10 cursor-pointer ${
                                      student 
                                        ? 'bg-white border-[#d4d19d] shadow-2xs print:border-black cursor-grab active:cursor-grabbing' 
                                        : 'bg-[#fcfbf7] border-dashed border-[#e6e2d3] print:border-gray-300'
                                    } ${draggedSeatNum === seatNum ? 'opacity-90 ring-2 ring-amber-500 bg-amber-50 scale-105 z-20 shadow-md' : ''} ${dragOverSeatNum === seatNum ? 'ring-2 ring-amber-500 bg-amber-50 scale-105' : ''}`}
                                  >
                                    <span className="absolute top-0.5 left-1 sm:top-1 sm:left-1.5 text-[8px] sm:text-[10px] font-bold text-[#8e8d82] print:text-black print:text-xs">
                                      {seatNum}
                                    </span>
                                    
                                    {student ? (
                                      <>
                                        <span className="text-[9px] sm:text-[11px] font-bold text-[#5a5a40] text-center line-clamp-2 leading-tight px-0.5 mt-2 sm:mt-2 print:text-black print:text-sm break-words">
                                          {student.studentName}
                                        </span>
                                        <div className="mt-auto flex items-center justify-center gap-0.5 sm:gap-1 w-full print:mt-1 flex-wrap">
                                          <span className="text-[8px] sm:text-[9px] bg-[#f5f5f0] text-[#8e8d82] px-1 py-0.5 rounded font-semibold print:bg-transparent print:border print:border-gray-300 print:text-black truncate max-w-full">
                                            {student.studentNo}
                                          </span>
                                          <span className="text-[8px] sm:text-[9px] bg-[#d4d19d]/20 text-[#5a5a40] px-1 py-0.5 rounded font-bold print:bg-transparent print:border print:border-gray-300 print:text-black truncate max-w-full">
                                            {student.studentClass}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[9px] sm:text-[10px] text-[#8e8d82]/50 font-medium">Boş</span>
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
                    <div className="h-full flex flex-col items-center justify-center text-[#8e8d82] p-8 text-center space-y-3">
                      <div className="bg-[#f5f5f0] p-4 rounded-full">
                        <Users className="w-8 h-8 text-[#d6d2c3]" />
                      </div>
                      <p className="text-sm">
                        Henüz oturma düzeni oluşturulmadı.<br/>Sınıf seçip <strong>"Oturma Düzeni Oluştur"</strong> butonuna tıklayın.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#FAF9F6] border-t border-brand-border/70 p-3 sm:p-4 flex items-center justify-end space-x-2 sm:space-x-3 shrink-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-xs sm:text-sm text-brand-ink/70 hover:text-brand-ink font-bold rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSaveHall}
                className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#151618] hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Salonu Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
