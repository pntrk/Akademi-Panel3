import React, { useRef, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Student } from '../types';
import { exportToExcel, importFromExcel, generateId, normalizeForSearch, formatDateLong } from '../lib/utils';
import { 
  Upload, Download, Edit2, Plus, Trash2, X, CheckSquare, Square, 
  Search, Calendar, DollarSign, Users, Award, Sparkles, BookOpen, 
  AlertCircle, SlidersHorizontal, Trash, ChevronDown, ChevronRight,
  TrendingUp, Wallet, Check, UserPlus, Filter, DoorOpen, CheckCircle2,
  XCircle, ArrowUpDown, Layers, Receipt, CreditCard, GraduationCap, Hash, User
} from 'lucide-react';

export const StudentsView = () => {
  const { state, setStudents, setResults, updateBudget, setExamHalls, userRole } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [hallFilter, setHallFilter] = useState('');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Selection states
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Bulk modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedBulkExamIds, setSelectedBulkExamIds] = useState<string[]>([]);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [registrationPaid, setRegistrationPaid] = useState<boolean>(false);

  // New registration states inside student details modal
  const [selectedDetailExamIds, setSelectedDetailExamIds] = useState<string[]>([]);
  const [newRegFee, setNewRegFee] = useState<number>(0);
  const [newRegPaid, setNewRegPaid] = useState<boolean>(false);

  // Single student details modal
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Map student IDs to their assigned exam halls
  const studentHallsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    state.examHalls.forEach(h => {
      if (h.seatingPlan) {
        h.seatingPlan.forEach(item => {
          if (!map[item.studentId]) {
            map[item.studentId] = [];
          }
          if (!map[item.studentId].some(existing => existing.id === h.id)) {
            map[item.studentId].push({ id: h.id, name: h.name });
          }
        });
      }
    });
    return map;
  }, [state.examHalls]);

  // Compute unique classes for filter dropdown
  const uniqueClassesForFilter = useMemo(() => {
    const classes = new Set<string>();
    state.students.forEach(s => {
      if (s.className) classes.add(s.className.trim());
    });
    return Array.from(classes).sort();
  }, [state.students]);

  // Compute unique halls for filter dropdown
  const uniqueHallsForFilter = useMemo(() => {
    return state.examHalls.map(h => ({ id: h.id, name: h.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.examHalls]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return state.students.filter(s => {
      const matchesSearch = normalizeForSearch(s.name).includes(normalizeForSearch(searchQuery)) || 
                            (s.no && s.no.toString().includes(searchQuery));
      const matchesClass = !classFilter || s.className === classFilter;
      
      let matchesExam = true;
      if (examFilter) {
        const exam = state.exams.find(e => e.id === examFilter);
        if (exam && exam.participatingClasses && exam.participatingClasses.length > 0) {
          const studentGrade = s.className ? (s.className.trim().match(/^(\d+)/)?.[1] || 'Diğer') : 'Diğer';
          matchesExam = exam.participatingClasses.includes(studentGrade);
        } else {
          matchesExam = s.examRegistrations?.some(r => r.examId === examFilter) || false;
        }
      }

      let matchesHall = true;
      if (hallFilter) {
        const assignedHalls = studentHallsMap[s.id] || [];
        matchesHall = assignedHalls.some(h => h.id === hallFilter);
      }

      return matchesSearch && matchesClass && matchesExam && matchesHall;
    }).reverse(); // En son eklenen en üstte çıksın
  }, [state.students, searchQuery, classFilter, examFilter, hallFilter, state.exams, studentHallsMap]);

  // Overall registration statistics
  const stats = useMemo(() => {
    let totalRegistrations = 0;
    let totalFees = 0;
    let totalUnpaidFees = 0;
    state.students.forEach(s => {
      const regs = s.examRegistrations || [];
      totalRegistrations += regs.length;
      regs.forEach(r => {
        if (r.isPaid) {
          totalFees += r.fee;
        } else {
          totalUnpaidFees += r.fee;
        }
      });
    });
    return {
      totalStudents: state.students.length,
      totalRegistrations,
      totalFees,
      totalUnpaidFees
    };
  }, [state.students]);

  // Checkbox functions
  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const allFilteredSelected = useMemo(() => {
    return filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect only filtered students
      const filteredIds = filteredStudents.map(s => s.id);
      setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Add all filtered student ids to selection
      const newIds = new Set([...selectedStudentIds, ...filteredStudents.map(s => s.id)]);
      setSelectedStudentIds(Array.from(newIds));
    }
  };

  // Perform bulk registration
  const handleBulkRegister = () => {
    if (selectedBulkExamIds.length === 0) {
      alert("Lütfen en az bir deneme sınavı seçiniz.");
      return;
    }
    const exams = state.exams.filter(e => selectedBulkExamIds.includes(e.id));
    if (exams.length === 0) return;

    const fee = parseFloat(registrationFee.toString()) || 0;

    // 1. Update students in state with their new exam registrations
    let updatedStudents = [...state.students];
    
    exams.forEach(exam => {
      updatedStudents = updatedStudents.map(s => {
        if (selectedStudentIds.includes(s.id)) {
          const regs = s.examRegistrations || [];
          // Prevent duplicate registrations for the same exam by removing prior entry
          const filteredRegs = regs.filter(r => r.examId !== exam.id);
          return {
            ...s,
            examRegistrations: [
              ...filteredRegs,
              {
                examId: exam.id,
                fee: fee,
                isPaid: registrationPaid,
                dateRegistered: new Date().toLocaleDateString()
              }
            ]
          };
        }
        return s;
      });
    });

    setStudents(updatedStudents);

    alert(`Seçilen ${selectedStudentIds.length} öğrenci seçilen sınavlara başarıyla kaydedildi!`);
    setSelectedStudentIds([]);
    setIsBulkModalOpen(false);
    setSelectedBulkExamIds([]);
    setRegistrationFee(0);
    setRegistrationPaid(false);
  };

  const handleBulkDelete = () => {
    const remainingStudents = state.students.filter(s => !selectedStudentIds.includes(s.id));
    setStudents(remainingStudents);
    
    // Salon oturma planlarından toplu silinen öğrencileri kaldır
    const updatedHalls = state.examHalls.map(h => {
      const sp = h.seatingPlan || [];
      const filtered = sp.filter(item => !selectedStudentIds.includes(item.studentId));
      if (filtered.length !== sp.length) {
        return {
          ...h,
          seatingPlan: filtered
        };
      }
      return h;
    });
    setExamHalls(updatedHalls);

    setSelectedStudentIds([]);
    
    // Sync all exams since we might have removed registered students
    syncAllExamBudgets(remainingStudents);
  };

  const handlePayAllRegistrations = (studentId: string) => {
    const updatedStudents = state.students.map(s => {
      if (s.id === studentId) {
        const regs = s.examRegistrations || [];
        const hasUnpaid = regs.some(r => !r.isPaid);
        if (!hasUnpaid) return s; // Nothing to pay
        return {
          ...s,
          examRegistrations: regs.map(r => ({ ...r, isPaid: true }))
        };
      }
      return s;
    });
    setStudents(updatedStudents);
  };

  // Remove a single registration from a student
  const removeSingleRegistration = (studentId: string, examId: string) => {
    const student = state.students.find(s => s.id === studentId);
    const reg = student?.examRegistrations?.find(r => r.examId === examId);

    const updatedStudents = state.students.map(s => {
      if (s.id === studentId) {
        const regs = s.examRegistrations || [];
        return {
          ...s,
          examRegistrations: regs.filter(r => r.examId !== examId)
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    // Also remove the student from any exam hall seating plan for this exam (Sync info)
    const updatedHalls = state.examHalls.map(h => {
      const isForThisExam = h.examId === examId || h.examIds?.includes(examId);
      if (isForThisExam && h.seatingPlan?.some(sp => sp.studentId === studentId)) {
        return {
          ...h,
          seatingPlan: h.seatingPlan.filter(sp => sp.studentId !== studentId)
        };
      }
      return h;
    });
    setExamHalls(updatedHalls);
  };

  // Add exam registrations to a student from the detail modal
  const addDetailRegistrations = (studentId: string) => {
    if (selectedDetailExamIds.length === 0) return;
    
    const exams = state.exams.filter(e => selectedDetailExamIds.includes(e.id));
    if (exams.length === 0) return;

    const fee = parseFloat(newRegFee.toString()) || 0;

    let updatedStudents = [...state.students];

    exams.forEach(exam => {
      updatedStudents = updatedStudents.map(s => {
        if (s.id === studentId) {
          const regs = s.examRegistrations || [];
          const filteredRegs = regs.filter(r => r.examId !== exam.id);
          return {
            ...s,
            examRegistrations: [
              ...filteredRegs,
              {
                examId: exam.id,
                fee: fee,
                isPaid: newRegPaid,
                dateRegistered: new Date().toLocaleDateString()
              }
            ]
          };
        }
        return s;
      });
    });

    setStudents(updatedStudents);

    // Reset states
    setSelectedDetailExamIds([]);
    setNewRegFee(0);
    setNewRegPaid(false);
  };

  // Toggle single registration payment status
  const toggleRegistrationPayment = (studentId: string, examId: string) => {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    const updatedStudents = state.students.map(s => {
      if (s.id === studentId) {
        const regs = (s.examRegistrations || []).map(r => {
          if (r.examId === examId) {
            const nextPaid = !r.isPaid;
            return { ...r, isPaid: nextPaid };
          }
          return r;
        });
        return { ...s, examRegistrations: regs };
      }
      return s;
    });

    setStudents(updatedStudents);
  };

  // Change student's exam hall seating plan assignment directly (Synchronously synced)
  const handleHallChange = (examId: string, targetHallId: string) => {
    const student = state.students.find(s => s.id === editingStudentId);
    if (!student) return;

    // Clone examHalls so we can modify them
    let updatedHalls = [...state.examHalls];

    // 1. Remove the student from any existing hall seating plan for this exam
    updatedHalls = updatedHalls.map(h => {
      const isForThisExam = h.examId === examId || h.examIds?.includes(examId);
      if (isForThisExam && h.seatingPlan?.some(sp => sp.studentId === student.id)) {
        return {
          ...h,
          seatingPlan: h.seatingPlan.filter(sp => sp.studentId !== student.id)
        };
      }
      return h;
    });

    // 2. If a target hall is selected (not empty / "none")
    if (targetHallId && targetHallId !== 'unassigned') {
      const hallIndex = updatedHalls.findIndex(h => h.id === targetHallId);
      if (hallIndex !== -1) {
        const h = updatedHalls[hallIndex];
        
        // Calculate capacity
        const calculatedCapacity = h.columns?.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0) || h.capacity || 30;
        
        // Find empty desk numbers
        const occupiedDesks = (h.seatingPlan || []).map(sp => sp.deskNumber);
        let targetDesk = -1;
        for (let d = 1; d <= calculatedCapacity; d++) {
          if (!occupiedDesks.includes(d)) {
            targetDesk = d;
            break;
          }
        }

        if (targetDesk === -1) {
          alert(`Seçilen "${h.name}" salonunun tüm sıraları doludur (Kapasite: ${calculatedCapacity}). Lütfen başka bir salon seçin veya salon kapasitesini artırın.`);
          return;
        }

        // Add student to the seating plan of the target hall
        const newSeatingItem = {
          deskNumber: targetDesk,
          studentId: student.id,
          studentNo: student.no,
          studentName: student.name,
          studentClass: student.className
        };

        const updatedSeatingPlan = [...(h.seatingPlan || []), newSeatingItem];
        
        // Ensure the student's class is in the hall's selectedClasses
        let updatedClasses = [...(h.selectedClasses || [])];
        if (student.className && !updatedClasses.includes(student.className)) {
          updatedClasses.push(student.className);
        }

        updatedHalls[hallIndex] = {
          ...h,
          seatingPlan: updatedSeatingPlan,
          selectedClasses: updatedClasses
        };
      }
    }

    // 3. Update the exam halls state
    setExamHalls(updatedHalls);
  };

  // Excel integration helpers
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFromExcel(file, (data) => {
        const currentStudents = [...state.students];
        
        data.forEach((rawRow: any) => {
          const row: any = {};
          Object.keys(rawRow).forEach(k => {
            row[k.toString().trim().toUpperCase()] = rawRow[k];
          });

          let no = parseInt(row['NO'] || row['ÖĞRENCİ NO'] || row['ÖĞR. NO'] || row['ÖĞR.NO'] || row['NUMARA'] || row['ÖĞRENCİ NUMARASI'] || '0');
          const name = (row['ADI SOYADI'] || row['ADI'] || row['SOYADI'] || row['AD SOYAD'] || row['İSİM'] || row['NAME'] || '').toString().trim();
          const className = (row['SINIFI'] || row['SINIF'] || row['ŞUBE'] || row['CLASS'] || '').toString().trim();
          
          if (!name && no === 0) return;
          
          let existing = currentStudents.find(s => s.no === no && no !== 0);
          
          if (!existing && name) {
            existing = currentStudents.find(s => s.name.toLowerCase() === name.toLowerCase());
          }
          
          if (existing) {
            // Update existing
            if (no === 0 && existing.no !== 0) {
                no = existing.no; // use existing number if excel doesn't have it
            }
            existing.no = no !== 0 ? no : existing.no;
            existing.name = name || existing.name;
            existing.className = className || existing.className;
          } else {
            // Create new
            currentStudents.push({
              id: generateId(),
              no,
              name,
              className,
              examRegistrations: []
            });
          }
        });
        
        setStudents(currentStudents);
      });
    }
  };

  const handleExport = () => {
    const dataToExport = state.students.map(s => {
      const regsStr = (s.examRegistrations || [])
        .map(r => {
          const exam = state.exams.find(e => e.id === r.examId);
          return `${exam ? exam.name : 'Sınav'} (₺${r.fee})`;
        })
        .join(', ');

      return {
        NO: s.no,
        'ADI SOYADI': s.name,
        'SINIFI': s.className,
        'KAYITLI SINAVLAR': regsStr || 'Kayıt Yok'
      };
    });
    exportToExcel(dataToExport, 'ogrenciler_ve_sinav_kayitlari');
  };

  const addEmptyStudent = () => {
    setStudents([...state.students, { id: generateId(), no: 0, name: '', className: '', examRegistrations: [] }]);
  };

  const updateStudent = (id: string, field: keyof Student, value: string | number) => {
    const oldStudent = state.students.find(s => s.id === id);
    if (!oldStudent) return;
    
    setStudents(state.students.map(s => s.id === id ? { ...s, [field]: value } : s));
    
    // Eğer öğrenci numarası veya adı güncelleniyorsa, bağlı sonuçlara da yansıt (atardamar mantığı)
    if (field === 'no' && oldStudent.no !== value) {
      setResults(state.results.map(r => {
        if (r.studentNo === oldStudent.no) {
          return { ...r, studentNo: value as number, studentId: id };
        }
        return r;
      }));
    } else if (field === 'name' && oldStudent.name !== value) {
      setResults(state.results.map(r => {
        if (r.studentNo === oldStudent.no) {
          return { ...r, studentName: value as string, studentId: id };
        }
        return r;
      }));
    } else if (field === 'className' && oldStudent.className !== value) {
      setResults(state.results.map(r => {
        if (r.studentNo === oldStudent.no) {
          return { ...r, studentClass: value as string, studentId: id };
        }
        return r;
      }));
    }

    // Salon oturma planlarındaki öğrenci bilgilerini senkronize et
    if (field === 'no' || field === 'name' || field === 'className') {
      const updatedHalls = state.examHalls.map(h => {
        const seatingPlan = h.seatingPlan || [];
        if (seatingPlan.some(sp => sp.studentId === id)) {
          return {
            ...h,
            seatingPlan: seatingPlan.map(sp => {
              if (sp.studentId === id) {
                return {
                  ...sp,
                  studentNo: field === 'no' ? (value as number) : sp.studentNo,
                  studentName: field === 'name' ? (value as string) : sp.studentName,
                  studentClass: field === 'className' ? (value as string) : sp.studentClass,
                };
              }
              return sp;
            })
          };
        }
        return h;
      });
      setExamHalls(updatedHalls);
    }
  };

  const removeStudent = (id: string) => {
    const remainingStudents = state.students.filter(s => s.id !== id);
    setStudents(remainingStudents);
    setSelectedStudentIds(prev => prev.filter(item => item !== id));
    
    // Salon oturma planlarından silinen öğrenciyi kaldır
    const updatedHalls = state.examHalls.map(h => {
      const sp = h.seatingPlan || [];
      if (sp.some(item => item.studentId === id)) {
        return {
          ...h,
          seatingPlan: sp.filter(item => item.studentId !== id)
        };
      }
      return h;
    });
    setExamHalls(updatedHalls);
    
    // Sync all exams
    syncAllExamBudgets(remainingStudents);
  };

  // Helper to sync all exam budgets when students are removed globally
  const syncAllExamBudgets = (currentStudents: Student[]) => {
    // No-op: budget expenses are now decoupled from student count and managed by order quantity in ExamsView
  };

  return (
    <div className="space-y-2.5 sm:space-y-6 md:space-y-8 flex flex-col h-full relative font-sans text-brand-ink">
      {/* Header bar - Ultra-Compact on Mobile, Rich on Desktop */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
        <div className="w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-brand-accent/15 text-brand-accent flex items-center justify-center shrink-0 font-bold">
                <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-serif text-brand-ink font-bold tracking-tight leading-tight">Öğrenci Kayıtları</h2>
            </div>
            <span className="sm:hidden text-xs font-semibold text-brand-ink/70 bg-[#F5F4F0] px-2.5 py-0.5 rounded-full border border-brand-border/60">
              {stats.totalStudents} Öğrenci
            </span>
          </div>
          <p className="hidden sm:block text-brand-ink/60 text-xs sm:text-sm mt-1">Sisteme kayıtlı öğrenciler, salon yerleşimleri ve sınav ücreti yönetimi</p>
        </div>
        
        {/* Action Buttons: Ultra-Compact & Grid-Optimized on Mobile */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto py-0.5">
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
                onClick={handleExport} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-brand-border text-xs font-bold text-brand-ink rounded-xl transition-all hover:bg-[#FAF9F6] active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
                title="Excel'e Dışa Aktar"
              >
                <Download className="w-3.5 h-3.5 text-brand-ink/70 shrink-0" />
                <span className="truncate">Dışa Aktar</span>
              </button>

              <button 
                onClick={addEmptyStudent} 
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-[#151618] border border-[#151618] text-white text-xs font-bold rounded-xl transition-all hover:bg-black active:scale-95 shadow-2xs sm:shadow-xs cursor-pointer min-w-0 w-full sm:w-auto"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">+ Öğrenci</span>
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
          <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>İstatistikler</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileStatsOpen ? 'rotate-180 text-amber-700' : 'text-brand-ink/40'}`} />
        </button>

        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(prev => !prev)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
            isMobileFiltersOpen || searchQuery || classFilter || examFilter || hallFilter
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-950 shadow-2xs' 
              : 'bg-white border-brand-border/80 text-brand-ink/75 hover:text-brand-ink shadow-2xs'
          }`}
        >
          <Filter className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Filtreler</span>
          {(searchQuery || classFilter || examFilter || hallFilter) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileFiltersOpen ? 'rotate-180 text-emerald-700' : 'text-brand-ink/40'}`} />
        </button>
      </div>

      {/* Mobile Active Filter Chips (shows when filters are active and drawer is closed) */}
      {!isMobileFiltersOpen && (searchQuery || classFilter || examFilter || hallFilter) && (
        <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200 shrink-0">
              <span>"{searchQuery.slice(0, 12)}{searchQuery.length > 12 ? '...' : ''}"</span>
              <button onClick={() => setSearchQuery('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {classFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[10px] font-medium border border-indigo-200 shrink-0">
              <span>{classFilter}</span>
              <button onClick={() => setClassFilter('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {examFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-[10px] font-medium border border-purple-200 shrink-0">
              <span>{state.exams.find(e => e.id === examFilter)?.name || 'Sınav'}</span>
              <button onClick={() => setExamFilter('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {hallFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200 shrink-0">
              <span>{state.examHalls.find(h => h.id === hallFilter)?.name || 'Salon'}</span>
              <button onClick={() => setHallFilter('')}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          <button 
            onClick={() => { setSearchQuery(''); setClassFilter(''); setExamFilter(''); setHallFilter(''); }}
            className="text-[10px] text-rose-600 font-bold px-1 py-0.5 shrink-0 underline"
          >
            Sıfırla
          </button>
        </div>
      )}

      {/* Stats Grid - Collapsible on Mobile, 4 Cols on Desktop */}
      <section className={`${isMobileStatsOpen ? 'grid' : 'hidden'} sm:grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-4 md:gap-5`}>
        {/* Stat 1: Toplam Öğrenci */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Toplam </span>Öğrenci
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-brand-ink leading-none">{stats.totalStudents}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">kişi</span>
          </div>
        </div>

        {/* Stat 2: Aktif Sınav Kaydı */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Aktif </span>Kayıt
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-brand-ink leading-none">{stats.totalRegistrations}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">sınav</span>
          </div>
        </div>

        {/* Stat 3: Gelen Gelir */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-emerald-300">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Gelen </span>Gelir
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="shrink-0">
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-emerald-700 leading-none">₺{stats.totalFees}</span>
          </div>
        </div>

        {/* Stat 4: Toplam Borç */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-rose-300">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Toplam </span>Borç
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="shrink-0">
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-rose-600 leading-none">₺{stats.totalUnpaidFees}</span>
          </div>
        </div>
      </section>

      {/* Filter Bar - Collapsible on Mobile, Expanded on Desktop */}
      <section className={`${isMobileFiltersOpen ? 'flex' : 'hidden sm:flex'} bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-brand-border/70 shadow-xs sm:shadow-sm flex-col gap-1.5 sm:gap-3`}>
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2.5 items-stretch sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-brand-ink/40 h-3.5 w-3.5 sm:h-4 sm:w-4 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Öğrenci adı veya numarası ile ara..." 
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

          {/* Filter Dropdowns - Horizontal Scroll on Mobile, Flex on Desktop */}
          <div className="flex flex-nowrap sm:flex-wrap gap-1.5 sm:gap-2 items-center overflow-x-auto no-scrollbar shrink-0 py-0.5 w-full sm:w-auto">
            <div className="relative shrink-0">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[95px] sm:min-w-[105px] shadow-xs cursor-pointer truncate"
              >
                <option value="">Tüm Şubeler</option>
                {uniqueClassesForFilter.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[100px] sm:min-w-[110px] max-w-[140px] sm:max-w-[160px] shadow-xs cursor-pointer truncate"
              >
                <option value="">Tüm Sınavlar</option>
                {state.exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative shrink-0">
              <select
                value={hallFilter}
                onChange={(e) => setHallFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-6 sm:pl-3 sm:pr-7 py-1.5 sm:py-2 border border-brand-border/80 text-[11px] sm:text-xs bg-white rounded-lg sm:rounded-xl text-brand-ink focus:outline-none focus:border-brand-accent font-semibold min-w-[95px] sm:min-w-[105px] max-w-[130px] sm:max-w-[150px] shadow-xs cursor-pointer truncate"
              >
                <option value="">Tüm Salonlar</option>
                {uniqueHallsForFilter.map(hall => (
                  <option key={hall.id} value={hall.id}>{hall.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-ink/40 absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(searchQuery || classFilter || examFilter || hallFilter) && (
              <button 
                onClick={() => { setSearchQuery(''); setClassFilter(''); setExamFilter(''); setHallFilter(''); }}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[11px] sm:text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg sm:rounded-xl font-bold shrink-0 transition-colors shadow-xs active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Temizle</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Student List Container */}
      <div className="bg-white border border-brand-border/70 rounded-2xl shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
        
        {/* Desktop Table View */}
        <div className="overflow-auto flex-1 w-full hidden md:block">
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="bg-[#FAF9F6] border-b-2 border-brand-ink">
                <th style={{ width: 50 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider text-center sticky top-0 bg-[#FAF9F6]">
                  <button 
                    onClick={handleSelectAll}
                    className="p-1 rounded hover:bg-black/5 text-brand-ink transition-colors cursor-pointer"
                    title="Hepsini Seç / Bırak"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-brand-accent" />
                    ) : (
                      <Square className="h-4 w-4 text-brand-ink/40" />
                    )}
                  </button>
                </th>
                <th style={{ width: 90 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">NO</th>
                <th className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">ADI SOYADI</th>
                <th style={{ width: 120 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">SINIFI</th>
                <th style={{ width: 180 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">SINAV SALONU</th>
                <th className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider sticky top-0 bg-[#FAF9F6]">KAYITLI SINAVLAR</th>
                <th style={{ width: 80 }} className="py-3.5 px-4 font-mono text-[0.7rem] text-brand-ink/60 uppercase tracking-wider text-center sticky top-0 bg-[#FAF9F6]">İŞLEM</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredStudents.map((student, idx) => {
                const isSelected = selectedStudentIds.includes(student.id);
                return (
                  <tr 
                    key={student.id ? `student-${student.id}-${idx}` : `student-${student.no}-${idx}`} 
                    className={`border-b border-brand-border/60 transition-all hover:bg-[#FAF9F6] ${
                      isSelected ? 'bg-brand-accent/5' : ''
                    }`}
                  >
                    {/* Checkbox column */}
                    <td className="py-4 px-5 text-center" data-label="SEÇİM">
                      <button 
                        onClick={() => toggleSelectStudent(student.id)}
                        className="p-1 rounded text-brand-ink transition-colors cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-brand-accent" />
                        ) : (
                          <Square className="h-4 w-4 text-brand-ink/30 hover:text-brand-ink" />
                        )}
                      </button>
                    </td>

                    {/* Student Number Input */}
                    <td className="py-4 px-5" data-label="NO">
                      <span className="font-mono font-semibold text-brand-accent">{student.no || ''}</span>
                    </td>

                    {/* Student Name Input */}
                    <td className="py-4 px-5" data-label="ADI SOYADI">
                      <button 
                        onClick={() => {
                          setEditingStudentId(student.id);
                          setIsStudentModalOpen(true);
                        }}
                        className={`font-semibold hover:underline text-left cursor-pointer transition-all ${
                          (student.examRegistrations || []).some(reg => 
                            !state.examHalls.some(h => 
                              (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                              h.seatingPlan?.some(sp => sp.studentId === student.id)
                            )
                          ) ? 'text-red-600' : 'text-brand-ink'
                        }`}
                      >
                        {student.name || 'İsimsiz'}
                      </button>
                    </td>

                    {/* Student Class Input */}
                    <td className="py-4 px-5" data-label="SINIFI">
                      <span className="bg-[#F3F2EE] px-2.5 py-1 text-[0.7rem] font-semibold text-brand-ink rounded">{student.className || '-'}</span>
                    </td>

                    {/* Student Exam Hall */}
                    <td className="py-4 px-5" data-label="SINAV SALONU">
                      <div className="flex flex-col gap-1">
                        {(studentHallsMap[student.id] || []).length > 0 ? (
                          (studentHallsMap[student.id] || []).map(hall => (
                            <span key={hall.id} className="text-[0.75rem] text-brand-ink font-semibold bg-[#151618]/5 px-2 py-0.5 rounded border border-brand-border w-fit">
                              {hall.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-brand-ink/40 font-semibold">-</span>
                        )}
                      </div>
                    </td>

                    {/* Live Exam Registrations Badges with quick-delete / quick-add */}
                    <td className="py-4 px-5" data-label="KAYITLI SINAVLAR" id="student-exam-regs-cell">
                      <div className="flex flex-wrap gap-2 items-center">
                        {(student.examRegistrations || []).map((reg) => {
                          const examObj = state.exams.find(e => e.id === reg.examId);
                          const examName = examObj ? examObj.name : 'Sınav';
                          
                          return (
                            <span 
                              key={reg.examId} 
                              className="inline-flex items-center bg-[#F3F2EE] text-brand-ink border border-brand-border px-3 py-0.5 rounded text-[0.75rem] font-semibold"
                            >
                              {examName}
                            </span>
                          );
                        })}
                        
                        {/* Quick Register Plus Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentIds([student.id]);
                            setIsBulkModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-transparent border border-dashed border-brand-accent text-brand-accent hover:bg-brand-accent/5 rounded text-[0.7rem] font-semibold transition-all cursor-pointer shrink-0"
                          title="Bu Öğrenciyi Sınava Kaydet"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Sınav Ekle</span>
                        </button>
                      </div>
                    </td>

                    {/* Single Actions */}
                    <td className="py-4 px-5 text-center" data-label="SEÇİM">
                      <button 
                        onClick={() => removeStudent(student.id)} 
                        className="w-7 h-7 rounded-full border border-brand-border flex items-center justify-center cursor-pointer transition-all bg-white hover:border-red-500 hover:text-red-500 hover:bg-red-50"
                        title="Öğrenciyi Sil"
                      >
                        <X className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-brand-ink/40 font-medium">
                    {state.students.length === 0 
                      ? "Kayıtlı öğrenci bulunmuyor. Yeni ekleyebilir veya Excel'den aktarabilirsiniz." 
                      : "Arama kriterine uyan öğrenci bulunamadı."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Modern Cards View */}
        <div className="md:hidden flex-1 overflow-auto w-full p-3 flex flex-col gap-2.5 bg-[#F9F8F5]">
          
          {/* Mobile List Quick Control Bar */}
          <div className="flex items-center justify-between px-1 py-1 text-xs text-brand-ink/60 font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-brand-ink">{filteredStudents.length}</span>
              <span>öğrenci listelendi</span>
            </div>
            <button 
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs text-brand-accent font-bold hover:underline cursor-pointer active:scale-95 transition-all"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-brand-accent" />
                  <span>Seçimi Kaldır</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-brand-ink/40" />
                  <span>Tümünü Seç</span>
                </>
              )}
            </button>
          </div>

          {filteredStudents.map((student, idx) => {
            const isSelected = selectedStudentIds.includes(student.id);
            const studentHalls = studentHallsMap[student.id] || [];
            const registrations = student.examRegistrations || [];
            
            const unpaidTotal = registrations.reduce((acc, r) => !r.isPaid ? acc + (r.fee || 0) : acc, 0);
            const paidTotal = registrations.reduce((acc, r) => r.isPaid ? acc + (r.fee || 0) : acc, 0);
            const hasRegistrations = registrations.length > 0;

            const hasMissingHall = registrations.some(reg => 
              !state.examHalls.some(h => 
                (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                h.seatingPlan?.some(sp => sp.studentId === student.id)
              )
            );

            return (
              <div 
                key={student.id ? `mobile-${student.id}-${idx}` : `mobile-${student.no}-${idx}`} 
                className={`bg-white rounded-2xl p-3.5 border transition-all duration-200 shadow-sm flex flex-col gap-2.5 ${
                  isSelected 
                    ? 'border-brand-accent bg-amber-500/[0.04] ring-1 ring-brand-accent/40' 
                    : 'border-brand-border/80 hover:border-brand-border'
                }`}
              >
                {/* Card Top Control Row: Selection Checkbox + Student No + Class Badge + Actions */}
                <div className="flex items-center justify-between gap-2 border-b border-brand-border/40 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button 
                      onClick={() => toggleSelectStudent(student.id)} 
                      className="p-1 text-brand-ink active:scale-90 transition-transform shrink-0 cursor-pointer"
                      title="Öğrenci Seç"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-brand-accent" />
                      ) : (
                        <Square className="h-5 w-5 text-brand-ink/30 hover:text-brand-ink" />
                      )}
                    </button>

                    <div className="bg-amber-100/90 text-amber-950 border border-amber-200/80 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold shrink-0 flex items-center gap-1 shadow-2xs">
                      <span className="text-[10px] text-amber-800/70 font-sans uppercase">No:</span>
                      <span>{student.no || '-'}</span>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100/80 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold truncate">
                      {student.className || '-'}
                    </div>
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => {
                        setEditingStudentId(student.id);
                        setIsStudentModalOpen(true);
                      }}
                      className="w-8 h-8 rounded-xl bg-gray-50 border border-brand-border/70 flex items-center justify-center text-brand-ink/70 hover:text-brand-accent hover:border-brand-accent transition-all active:scale-95 cursor-pointer"
                      title="Öğrenciyi Düzenle / Detay"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => removeStudent(student.id)}
                      className="w-8 h-8 rounded-xl bg-gray-50 border border-brand-border/70 flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-95 cursor-pointer"
                      title="Öğrenciyi Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Student Name Section (Super legible, high hierarchy) */}
                <div className="py-0.5">
                  <button 
                    onClick={() => {
                      setEditingStudentId(student.id);
                      setIsStudentModalOpen(true);
                    }}
                    className={`text-base font-sans font-bold text-left leading-snug hover:text-brand-accent transition-colors block w-full break-words ${
                      hasMissingHall ? 'text-rose-600' : 'text-brand-ink'
                    }`}
                  >
                    {student.name || 'İsimsiz Öğrenci'}
                  </button>
                </div>

                {/* Card Meta Badges (Hall, Payment Status) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Hall Badge */}
                  <div className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border ${
                    studentHalls.length > 0 
                      ? 'bg-amber-50/80 border-amber-200/80 text-amber-900' 
                      : 'bg-gray-100 border-gray-200 text-gray-500'
                  }`}>
                    <DoorOpen className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="truncate max-w-[150px]">
                      {studentHalls.length > 0 ? studentHalls.map(h => h.name).join(', ') : 'Salonsuz'}
                    </span>
                  </div>

                  {/* Payment Status Badge */}
                  {hasRegistrations && (
                    unpaidTotal > 0 ? (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span>₺{unpaidTotal} Borç</span>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Ödendi</span>
                      </div>
                    )
                  )}
                </div>

                {/* Card Bottom: Registrations Chips & Quick Add Button */}
                <div className="pt-2 border-t border-brand-border/40 flex flex-wrap items-center gap-1.5">
                  {registrations.map(reg => {
                    const ex = state.exams.find(e => e.id === reg.examId);
                    if (!ex) return null;
                    return (
                      <div 
                        key={reg.examId} 
                        className={`flex items-center border rounded-xl overflow-hidden pl-2 pr-1 py-1 gap-1 text-[11px] font-semibold transition-all ${
                          reg.isPaid 
                            ? 'bg-emerald-50/50 border-emerald-200/70 text-emerald-900' 
                            : 'bg-rose-50/50 border-rose-200/70 text-rose-900'
                        }`}
                      >
                        <button 
                          onClick={() => toggleRegistrationPayment(student.id, reg.examId)}
                          className="flex items-center gap-1 hover:underline cursor-pointer"
                          title={reg.isPaid ? "Ödendi (Değiştirmek için tıkla)" : "Ödenmedi (Ödendi yapmak için tıkla)"}
                        >
                          <span className="truncate max-w-[110px]">{ex.name}</span>
                          <span className="text-[10px] opacity-75">(₺{reg.fee})</span>
                          {reg.isPaid ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                          )}
                        </button>
                        
                        <button 
                          onClick={() => removeSingleRegistration(student.id, reg.examId)}
                          className="text-gray-400 hover:text-rose-600 p-0.5 rounded hover:bg-black/5 transition-colors ml-0.5"
                          title="Sınav Kaydını Sil"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Quick Add Exam to Student */}
                  <button 
                    onClick={() => {
                      setSelectedStudentIds([student.id]);
                      setIsBulkModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-xl transition-all shadow-xs active:scale-95"
                    title="Yeni Sınav Ekle"
                  >
                    <Plus className="w-3 h-3 text-amber-700" />
                    <span>+ Sınav</span>
                  </button>

                  {/* Quick Pay All Unpaid Fees Button */}
                  {unpaidTotal > 0 && (
                    <button 
                      onClick={() => handlePayAllRegistrations(student.id)}
                      className="flex items-center gap-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-xl transition-all shadow-xs active:scale-95 ml-auto"
                      title="Öğrencinin tüm sınav borçlarını ödendi yap"
                    >
                      <Check className="w-3 h-3" />
                      <span>Tahsil Et</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-brand-border/60">
              <Users className="w-8 h-8 text-brand-ink/20 mx-auto mb-2" />
              <p className="text-xs text-brand-ink/60 font-semibold">Arama veya filtre kriterlerine uyan öğrenci bulunamadı.</p>
            </div>
          )}
        </div>
      </div>

      {/* STICKY FLOATING BULK ACTIONS BAR - Modern Curved Glass on Mobile */}
      {selectedStudentIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-[#151618]/95 backdrop-blur-xl text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-2xl shadow-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 z-40 max-w-2xl w-[92%] animate-slide-up">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <span className="bg-brand-accent/20 border border-brand-accent/40 text-brand-accent px-3 py-1 rounded-xl text-xs font-bold font-mono shrink-0">
              {selectedStudentIds.length} Öğrenci Seçildi
            </span>
            <button 
              onClick={() => setSelectedStudentIds([])}
              className="text-white/60 hover:text-white text-xs underline sm:hidden"
            >
              Vazgeç
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="flex-1 sm:flex-initial bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-black shrink-0" />
              <span>Sınava Toplu Kaydet</span>
            </button>
            <button 
              onClick={handleBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
              title="Seçili Öğrencileri Sil"
            >
              <Trash className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Sil</span>
            </button>
            <button 
              onClick={() => setSelectedStudentIds([])}
              className="text-white/60 hover:text-white px-2 py-2 text-xs transition-colors cursor-pointer hidden sm:inline"
            >
              Temizle
            </button>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* BULK REGISTRATION & FEE INPUT MODAL            */}
      {/* ============================================== */}
      {isBulkModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 transition-opacity animate-fade-in"
          onClick={() => {
            setIsBulkModalOpen(false);
            if (selectedStudentIds.length === 1) setSelectedStudentIds([]); // Clean up if single action
          }}
        >
          <div 
            className="bg-white rounded-t-[28px] sm:rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-slide-up sm:animate-none pb-safe sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#fcfbf7] border-b border-[#e6e2d3] p-4 sm:p-5 flex items-center justify-between rounded-t-[28px] sm:rounded-t-[32px]">
              <div className="flex items-center space-x-2.5">
                <div className="bg-[#5a5a40]/10 p-2 rounded-xl">
                  <Award className="h-5 w-5 text-[#5a5a40]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-serif text-[#5a5a40] font-bold">Kayıtlı Sınavlar ve Ücret Modalı</h3>
                  <p className="text-[10px] text-[#8e8d82] font-semibold">{selectedStudentIds.length} Öğrenci İşleme Alınacak</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsBulkModalOpen(false);
                  if (selectedStudentIds.length === 1) setSelectedStudentIds([]);
                }}
                className="p-2 text-[#8e8d82] hover:text-[#5a5a40] hover:bg-[#f5f5f0] rounded-full transition-all active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#5a5a40] uppercase tracking-wider">Deneme Sınavı Seçimi</label>
                  {state.exams.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBulkExamIds.length === state.exams.length) {
                          setSelectedBulkExamIds([]);
                        } else {
                          setSelectedBulkExamIds(state.exams.map(e => e.id));
                        }
                      }}
                      className="text-[10px] font-bold text-[#5a5a40] bg-[#e6e2d3]/50 hover:bg-[#e6e2d3] px-2 py-0.5 rounded transition-colors"
                    >
                      {selectedBulkExamIds.length === state.exams.length ? 'Tümünü Kaldır' : 'Tümüne Katıl'}
                    </button>
                  )}
                </div>
                {state.exams.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3">
                    {state.exams.map(exam => (
                      <label key={exam.id} className="flex items-center space-x-3 hover:bg-[#f5f5f0] p-1.5 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBulkExamIds.includes(exam.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBulkExamIds([...selectedBulkExamIds, exam.id]);
                            } else {
                              setSelectedBulkExamIds(selectedBulkExamIds.filter(id => id !== exam.id));
                            }
                          }}
                          className="rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40]"
                        />
                        <span className="text-sm font-semibold text-[#5a5a40]">{exam.name} {exam.date ? `(${formatDateLong(exam.date)})` : ''}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex items-start space-x-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Kayıtlı Sınav Bulunamadı!</p>
                      <p className="text-[11px] text-amber-700/90 leading-normal mt-0.5">
                        Öncelikle "Deneme Sınavları" sekmesinden yeni bir sınav oluşturmanız gerekmektedir.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5a5a40] uppercase tracking-wider mb-1.5">
                  Öğrenci Başına Ödenecek Ücret
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8d82] text-sm font-bold">₺</span>
                  <input
                    type="number"
                    value={registrationFee || ''}
                    onChange={(e) => setRegistrationFee(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl pl-8 pr-3 py-2 text-sm font-bold text-[#5a5a40] focus:ring-1 focus:ring-[#5a5a40]"
                    placeholder="0,00"
                    min="0"
                  />
                </div>
                <p className="text-[10px] text-[#8e8d82] leading-normal mt-1 italic">
                  Öğrenci başına sınav kayıt ücreti belirleyebilirsiniz. Bu ücret ödeme durumuna göre bütçeye entegre edilir.
                </p>
              </div>

              {registrationFee > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#5a5a40] uppercase tracking-wider mb-1.5">Ödeme Durumu</label>
                  <div className="grid grid-cols-2 gap-2 bg-[#fcfbf7] p-1 border border-[#e6e2d3] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRegistrationPaid(true)}
                      className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                        registrationPaid
                          ? 'bg-[#5a5a40] text-white shadow-sm'
                          : 'text-[#8e8d82] hover:text-[#5a5a40]'
                      }`}
                    >
                      Ödendi (Gelir)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistrationPaid(false)}
                      className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                        !registrationPaid
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-[#8e8d82] hover:text-red-600'
                      }`}
                    >
                      Ödenmedi (Borç)
                    </button>
                  </div>
                </div>
              )}

              {selectedBulkExamIds.length > 0 && registrationFee > 0 && (
                registrationPaid ? (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-emerald-800 space-y-1">
                    <p className="text-xs font-bold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                      Bütçe Geliri Otomatik Eşitlenecek!
                    </p>
                    <p className="text-[10px] text-emerald-700/90 leading-normal">
                      {selectedStudentIds.length} Öğrenci × {selectedBulkExamIds.length} Sınav × ₺{registrationFee} = <strong>₺{selectedStudentIds.length * selectedBulkExamIds.length * registrationFee}</strong> toplam kayıt geliri bütçenize otomatik olarak gelir kalemi olarak eklenecektir.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-red-800 space-y-1">
                    <p className="text-xs font-bold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-red-600 shrink-0" />
                      Öğrenci Borcu Otomatik Entegre Edilecek!
                    </p>
                    <p className="text-[10px] text-red-700/90 leading-normal">
                      {selectedStudentIds.length} Öğrenci × {selectedBulkExamIds.length} Sınav × ₺{registrationFee} = <strong>₺{selectedStudentIds.length * selectedBulkExamIds.length * registrationFee}</strong> toplam tutar bütçede ve öğrenci detaylarında borç olarak görünecek, bütçede otomatik entegre olacaktır.
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-[#fcfbf7] border-t border-[#e6e2d3] p-4 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setIsBulkModalOpen(false);
                  if (selectedStudentIds.length === 1) setSelectedStudentIds([]);
                }}
                className="px-4 py-2 text-sm text-[#8e8d82] hover:text-[#5a5a40] font-bold rounded-full hover:bg-[#f5f5f0] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleBulkRegister}
                disabled={selectedBulkExamIds.length === 0}
                className={`px-5 py-2 text-sm font-bold rounded-full transition-all shadow-sm ${
                  selectedBulkExamIds.length > 0
                    ? 'bg-[#5a5a40] hover:bg-[#43423b] text-white border border-transparent'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-transparent'
                }`}
              >
                Kaydı Tamamla ve Eşitle
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================== */}
      {/* SINGLE STUDENT DETAILS MODAL                   */}
      {/* ============================================== */}
      {isStudentModalOpen && editingStudentId && (() => {
        const student = state.students.find(s => s.id === editingStudentId);
        if (!student) return null;

        return (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 transition-opacity animate-fade-in"
            onClick={() => {
              setIsStudentModalOpen(false);
              setEditingStudentId(null);
            }}
          >
            <div 
              className="bg-white rounded-t-[28px] sm:rounded-[32px] border border-[#e6e2d3] shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-none pb-safe sm:pb-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-[#fcfbf7] border-b border-[#e6e2d3] px-4 pt-3.5 pb-3 sm:px-6 sm:py-4 shrink-0 rounded-t-[28px] sm:rounded-t-[32px]">
                {/* Mobile Drag Pill */}
                <div className="w-12 h-1.5 bg-[#dcd8c8] rounded-full mx-auto mb-3 sm:hidden" />

                {/* Main Header Content */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    {/* Student Monogram Avatar */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#5a5a40]/10 border border-[#5a5a40]/20 flex items-center justify-center text-[#5a5a40] font-bold text-sm sm:text-base shrink-0 shadow-xs">
                      {student.name ? student.name.trim().slice(0, 2).toUpperCase() : 'ÖG'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-xl font-serif text-[#2d2c25] font-bold truncate max-w-[200px] sm:max-w-md">
                          {student.name || 'İsimsiz Öğrenci'}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#f0eee6] text-[#5a5a40] border border-[#e6e2d3]">
                          #{student.no || '0'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {student.className || 'Sınıfsız'}
                        </span>
                      </div>
                      <p className="text-xs text-[#737265] mt-0.5 flex items-center gap-2">
                        <span>Öğrenci Yönetim & Sınav Katılım Portalı</span>
                        <span className="hidden sm:inline text-[#dcd8c8]">•</span>
                        <span className="hidden sm:inline font-medium text-[#5a5a40]">
                          {(student.examRegistrations || []).length} Kayıtlı Sınav
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Header Action & Close Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const regs = student.examRegistrations || [];
                      const unpaidTotal = regs.filter(r => !r.isPaid).reduce((sum, r) => sum + (r.fee || 0), 0);
                      if (unpaidTotal > 0) {
                        return (
                          <button
                            type="button"
                            onClick={() => handlePayAllRegistrations(student.id)}
                            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all shadow-xs cursor-pointer active:scale-95"
                            title="Öğrencinin tüm borçlarını tahsil et"
                          >
                            <Receipt className="w-3.5 h-3.5 text-rose-600" />
                            <span>₺{unpaidTotal} Borç - Tahsil Et</span>
                          </button>
                        );
                      } else if (regs.length > 0) {
                        return (
                          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Borç Yok</span>
                          </span>
                        );
                      }
                      return null;
                    })()}

                    <button 
                      onClick={() => {
                        setIsStudentModalOpen(false);
                        setEditingStudentId(null);
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[#737265] hover:text-[#2d2c25] hover:bg-[#eae7db] transition-colors cursor-pointer"
                      aria-label="Kapat"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content - All Sections Fully Visible */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Section 1: Basic Info & Financial Summary */}
                <div className="space-y-4">
                  {/* Financial Summary KPIs */}
                    {(() => {
                      const regs = student.examRegistrations || [];
                      const paidCount = regs.filter(r => r.isPaid).length;
                      const unpaidCount = regs.filter(r => !r.isPaid).length;
                      const paidAmount = regs.filter(r => r.isPaid).reduce((sum, r) => sum + (r.fee || 0), 0);
                      const unpaidAmount = regs.filter(r => !r.isPaid).reduce((sum, r) => sum + (r.fee || 0), 0);
                      const totalAmount = paidAmount + unpaidAmount;

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                          <div className="bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl p-3 sm:p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737265] block">Toplam Sınav</span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl sm:text-2xl font-serif font-bold text-[#2d2c25]">{regs.length}</span>
                              <span className="text-xs text-[#737265]">katılım</span>
                            </div>
                          </div>
                          <div className="bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl p-3 sm:p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737265] block">Toplam Kayıt Tutarı</span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl sm:text-2xl font-serif font-bold text-[#2d2c25]">₺{totalAmount}</span>
                            </div>
                          </div>
                          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 sm:p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Tahsil Edilen (Gelir)</span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl sm:text-2xl font-serif font-bold text-emerald-700">₺{paidAmount}</span>
                              <span className="text-[11px] font-semibold text-emerald-600">({paidCount})</span>
                            </div>
                          </div>
                          <div className={`rounded-2xl p-3 sm:p-3.5 border transition-all ${
                            unpaidAmount > 0 
                              ? 'bg-rose-50/70 border-rose-200/80' 
                              : 'bg-[#fcfbf7] border-[#e6e2d3]'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                                unpaidAmount > 0 ? 'text-rose-800' : 'text-[#737265]'
                              }`}>
                                Kalan Borç
                              </span>
                              {unpaidAmount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handlePayAllRegistrations(student.id)}
                                  className="text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                                >
                                  Tahsil Et
                                </button>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className={`text-xl sm:text-2xl font-serif font-bold ${
                                unpaidAmount > 0 ? 'text-rose-700' : 'text-[#737265]'
                              }`}>
                                ₺{unpaidAmount}
                              </span>
                              {unpaidAmount > 0 && (
                                <span className="text-[11px] font-semibold text-rose-600">({unpaidCount})</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Student Identity Inputs */}
                    <div className="bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl p-4 sm:p-5">
                      <h4 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#5a5a40]" />
                        <span>Öğrenci Kimlik & Sınıf Bilgileri</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                            Öğrenci Numarası
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737265] text-xs font-mono font-bold">#</span>
                            <input 
                              type="number" 
                              value={student.no || ''} 
                              onChange={(e) => updateStudent(student.id, 'no', parseInt(e.target.value) || 0)}
                              className="w-full bg-white border border-[#e6e2d3] rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all"
                              placeholder="Örn: 104"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                            Adı Soyadı
                          </label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={student.name} 
                              onChange={(e) => updateStudent(student.id, 'name', e.target.value)}
                              className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all"
                              placeholder="Örn: Ahmet Yılmaz"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#737265] uppercase tracking-wider mb-1.5">
                            Sınıfı / Şubesi
                          </label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={student.className} 
                              onChange={(e) => updateStudent(student.id, 'className', e.target.value)}
                              className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-sm font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all"
                              placeholder="Örn: 12-A veya 8-B"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Section 2: Exam History & Halls */}
                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#5a5a40] uppercase tracking-wider flex items-center">
                          <BookOpen className="w-4 h-4 mr-1.5 text-[#5a5a40]" />
                          Deneme Sınavı Geçmişi ve Salon Bilgileri
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e6e2d3]/60 text-[#5a5a40]">
                          {(student.examRegistrations || []).length} Sınav
                        </span>
                      </div>
                      {student.examRegistrations && student.examRegistrations.some(r => !r.isPaid) && (
                        <button
                          type="button"
                          onClick={() => handlePayAllRegistrations(student.id)}
                          className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-full shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Tüm Borçları Tahsil Et</span>
                        </button>
                      )}
                    </div>
                    
                    {student.examRegistrations && student.examRegistrations.length > 0 ? (
                      <div className="space-y-3">
                        {/* Desktop Table View */}
                        <div className="hidden sm:block bg-white border border-[#e6e2d3] rounded-2xl overflow-hidden shadow-xs">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-[#fcfbf7]">
                              <tr className="text-xs text-[#737265] border-b border-[#e6e2d3]">
                                <th className="py-3 px-4 font-bold">Deneme Sınavı</th>
                                <th className="py-3 px-4 font-bold">Ücret / Durum</th>
                                <th className="py-3 px-4 font-bold">Kayıt Tarihi</th>
                                <th className="py-3 px-4 font-bold">Sınav Salonu / Sıra</th>
                                <th className="py-3 px-4 font-bold w-12 text-center">İşlem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0eee6]">
                              {student.examRegistrations.map((reg) => {
                                const exam = state.exams.find(e => e.id === reg.examId);
                                const examName = exam ? exam.name : 'Silinmiş Sınav';
                                
                                let deskNo = '-';
                                const hall = state.examHalls.find(h => 
                                  (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                                  h.seatingPlan?.some(sp => sp.studentId === student.id)
                                );
                                
                                if (hall) {
                                  const seating = hall.seatingPlan?.find(sp => sp.studentId === student.id);
                                  if (seating) {
                                    deskNo = seating.deskNumber.toString();
                                  }
                                }

                                const eligibleHalls = state.examHalls.filter(h => 
                                  h.examId === reg.examId || h.examIds?.includes(reg.examId)
                                );

                                const isExpanded = expandedExamId === reg.examId;
                                const studentResult = state.results.find(r => (r.studentNo === student.no || r.studentNo === Number(student.no)));
                                const examDetail = studentResult?.details?.[examName];
                                
                                return (
                                  <React.Fragment key={reg.examId}>
                                  <tr className="hover:bg-[#fcfbf7] transition-colors">
                                    <td className="py-3 px-4 font-bold text-[#2d2c25]">
                                      <div 
                                        className="flex items-center gap-2 cursor-pointer group"
                                        onClick={() => setExpandedExamId(isExpanded ? null : reg.examId)}
                                        title="Karne net detaylarını aç/kapat"
                                      >
                                        <div className="p-1 rounded-md group-hover:bg-[#eae7db] transition-colors">
                                          {isExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-emerald-600" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-[#737265]" />
                                          )}
                                        </div>
                                        <div>
                                          <span className="group-hover:text-[#5a5a40] transition-colors">{examName}</span>
                                          {exam?.date && (
                                            <span className="block text-[11px] font-normal text-[#737265]">
                                              {formatDateLong(exam.date)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-bold text-[#2d2c25]">₺{reg.fee}</span>
                                        <button
                                          type="button"
                                          onClick={() => toggleRegistrationPayment(student.id, reg.examId)}
                                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                            reg.isPaid
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                          }`}
                                          title={reg.isPaid ? "Ödeme alındı. Borç yapmak için tıklayın." : "Borç ödenmedi. Tahsil etmek için tıklayın."}
                                        >
                                          {reg.isPaid ? '✓ Ödendi' : 'Borç'}
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-[#737265] text-xs font-medium">
                                      {reg.dateRegistered || '-'}
                                    </td>
                                    <td className="py-3 px-4">
                                      <select
                                        value={hall ? hall.id : 'unassigned'}
                                        onChange={(e) => handleHallChange(reg.examId, e.target.value)}
                                        className={`text-xs font-bold rounded-xl border px-3 py-1.5 bg-white focus:ring-2 focus:ring-[#5a5a40]/20 focus:outline-none transition-all cursor-pointer ${
                                          hall ? 'text-[#2d2c25] border-[#e6e2d3]' : 'text-rose-600 border-rose-200 font-bold bg-rose-50/50'
                                        }`}
                                      >
                                        <option value="unassigned">Yerleştirilmedi (Salonsuz)</option>
                                        {eligibleHalls.map(h => {
                                          const cap = h.columns?.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0) || h.capacity || 30;
                                          const occupiedCount = h.seatingPlan?.length || 0;
                                          const isCurrent = hall?.id === h.id;
                                          const isFull = occupiedCount >= cap;
                                          
                                          return (
                                            <option key={h.id} value={h.id} disabled={isFull && !isCurrent}>
                                              {h.name} {isCurrent ? `(Sıra: ${deskNo})` : `(${occupiedCount}/${cap}${isFull ? ' - Dolu' : ''})`}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <button
                                        type="button"
                                        onClick={() => removeSingleRegistration(student.id, reg.examId)}
                                        className="p-1.5 text-[#737265] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                        title="Kaydı Sil"
                                      >
                                        <Trash2 className="w-4 h-4 mx-auto" />
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Collapsible Net & Karne Summary */}
                                  {isExpanded && (
                                    <tr className="bg-[#fcfbf7]/80">
                                      <td colSpan={5} className="p-4 border-b border-[#e6e2d3]">
                                        {examDetail && examDetail.lessons ? (
                                          <div className="bg-white rounded-xl border border-[#e6e2d3] p-4 shadow-xs">
                                            <div className="flex items-center justify-between mb-3">
                                              <h5 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider flex items-center gap-1.5">
                                                <Award className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Derslere Göre Net ve Karne Özeti</span>
                                              </h5>
                                              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                Toplam Net: {Number((examDetail as any).totalNet || 0).toFixed(2).replace('.', ',')}
                                              </span>
                                            </div>
                                            <table className="w-full text-left text-xs">
                                              <thead>
                                                <tr className="text-[#737265] border-b border-[#e6e2d3]">
                                                  <th className="py-1.5 px-2">Ders</th>
                                                  <th className="py-1.5 px-2 text-center text-emerald-600">D</th>
                                                  <th className="py-1.5 px-2 text-center text-rose-500">Y</th>
                                                  <th className="py-1.5 px-2 text-center text-amber-500">B</th>
                                                  <th className="py-1.5 px-2 text-center text-blue-600 font-bold">Net</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {(() => {
                                                  const lessonsArray = Array.isArray(examDetail.lessons) 
                                                    ? examDetail.lessons 
                                                    : Object.entries(examDetail.lessons).map(([name, data]) => ({ name, ...(data as object) }));
                                                  return lessonsArray.map((l: any, idx) => {
                                                    const stdName = l.name || l.lessonName || '';
                                                    if (!stdName || stdName.toLowerCase().includes('toplam') || stdName.toLowerCase().includes('genel')) return null;
                                                    const nVal = typeof l === 'number' ? l : (l.N ?? l.n ?? l.net ?? (parseFloat(l.N || l.n || l.net || '0') || 0));
                                                    return (
                                                      <tr key={idx} className="border-b border-[#e6e2d3]/30">
                                                        <td className="py-1.5 px-2 font-semibold text-[#2d2c25]">{stdName}</td>
                                                        <td className="py-1.5 px-2 text-center font-bold text-emerald-600">{l.D ?? 0}</td>
                                                        <td className="py-1.5 px-2 text-center font-bold text-rose-500">{l.Y ?? 0}</td>
                                                        <td className="py-1.5 px-2 text-center font-bold text-amber-500">{l.B ?? 0}</td>
                                                        <td className="py-1.5 px-2 text-center font-bold text-blue-600">{nVal.toFixed(2).replace('.', ',')}</td>
                                                      </tr>
                                                    );
                                                  }).filter(Boolean);
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="text-center py-3 text-xs text-[#737265] bg-white rounded-xl border border-[#e6e2d3]">
                                            Bu sınav için henüz yüklenmiş bir sonuç veya net verisi bulunmuyor.
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards View (Optimized for Phones & Touch) */}
                        <div className="block sm:hidden space-y-3">
                          {student.examRegistrations.map((reg) => {
                            const exam = state.exams.find(e => e.id === reg.examId);
                            const examName = exam ? exam.name : 'Silinmiş Sınav';
                            
                            let deskNo = '-';
                            const hall = state.examHalls.find(h => 
                              (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                              h.seatingPlan?.some(sp => sp.studentId === student.id)
                            );
                            if (hall) {
                              const seating = hall.seatingPlan?.find(sp => sp.studentId === student.id);
                              if (seating) deskNo = seating.deskNumber.toString();
                            }

                            const eligibleHalls = state.examHalls.filter(h => 
                              h.examId === reg.examId || h.examIds?.includes(reg.examId)
                            );

                            const isExpanded = expandedExamId === reg.examId;
                            const studentResult = state.results.find(r => (r.studentNo === student.no || r.studentNo === Number(student.no)));
                            const examDetail = studentResult?.details?.[examName];

                            return (
                              <div key={reg.examId} className="bg-white border border-[#e6e2d3] rounded-2xl p-4 shadow-xs space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h5 className="font-bold text-[#2d2c25] text-sm leading-snug">{examName}</h5>
                                    {exam?.date && (
                                      <p className="text-[11px] text-[#737265] mt-0.5">{formatDateLong(exam.date)}</p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeSingleRegistration(student.id, reg.examId)}
                                    className="p-1.5 text-[#737265] hover:text-rose-600 rounded-lg"
                                    title="Kaydı Sil"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-[#f0eee6]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[#2d2c25]">₺{reg.fee}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleRegistrationPayment(student.id, reg.examId)}
                                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                                        reg.isPaid
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-rose-50 text-rose-700 border-rose-200'
                                      }`}
                                    >
                                      {reg.isPaid ? '✓ Ödendi' : 'Borç (Öde)'}
                                    </button>
                                  </div>
                                  <span className="text-[11px] text-[#737265]">Kayıt: {reg.dateRegistered || '-'}</span>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-[#737265] uppercase mb-1">
                                    Sınav Salonu & Sıra
                                  </label>
                                  <select
                                    value={hall ? hall.id : 'unassigned'}
                                    onChange={(e) => handleHallChange(reg.examId, e.target.value)}
                                    className={`w-full text-xs font-bold rounded-xl border p-2 bg-white ${
                                      hall ? 'text-[#2d2c25] border-[#e6e2d3]' : 'text-rose-600 border-rose-200 bg-rose-50/40'
                                    }`}
                                  >
                                    <option value="unassigned">Yerleştirilmedi (Salonsuz)</option>
                                    {eligibleHalls.map(h => {
                                      const cap = h.columns?.reduce((acc, col) => acc + (col.deskCount * col.seatsPerDesk), 0) || h.capacity || 30;
                                      const occupiedCount = h.seatingPlan?.length || 0;
                                      const isCurrent = hall?.id === h.id;
                                      const isFull = occupiedCount >= cap;
                                      return (
                                        <option key={h.id} value={h.id} disabled={isFull && !isCurrent}>
                                          {h.name} {isCurrent ? `(Sıra: ${deskNo})` : `(${occupiedCount}/${cap})`}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>

                                {examDetail && examDetail.lessons && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedExamId(isExpanded ? null : reg.examId)}
                                      className="text-xs font-bold text-[#5a5a40] hover:text-[#2d2c25] flex items-center gap-1"
                                    >
                                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      <span>Karne Net Sonuçlarını {isExpanded ? 'Gizle' : 'Göster'}</span>
                                    </button>
                                    {isExpanded && (
                                      <div className="mt-2 p-2.5 bg-[#fcfbf7] rounded-xl border border-[#e6e2d3] text-xs">
                                        <div className="font-bold text-blue-700 mb-1.5">
                                          Toplam Net: {Number((examDetail as any).totalNet || 0).toFixed(2).replace('.', ',')}
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                                          {Object.entries(examDetail.lessons).map(([name, data]: [string, any]) => (
                                            <div key={name} className="flex justify-between border-b border-[#e6e2d3]/40 py-0.5">
                                              <span className="truncate pr-1 text-[#737265]">{name}:</span>
                                              <span className="font-bold text-[#2d2c25]">
                                                {typeof data === 'number' ? data : (data.net || data.N || 0)} Net
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl p-8 text-center text-[#737265] text-sm space-y-2">
                        <BookOpen className="w-8 h-8 text-[#dcd8c8] mx-auto" />
                        <p className="font-bold text-[#2d2c25]">Henüz Sınav Kaydı Bulunmuyor</p>
                        <p className="text-xs">Aşağıdaki bölümden öğrenciyi açık olan deneme sınavlarına kaydedebilirsiniz.</p>
                      </div>
                    )}
                  </div>

                {/* Section 3: Inline New Exam Registration */}
                {(() => {
                  const studentRegisteredExamIds = (student.examRegistrations || []).map(r => r.examId);
                  const studentGrade = student.className ? (student.className.trim().match(/^(\d+)/)?.[1] || 'Diğer') : 'Diğer';
                  const availableExamsForReg = state.exams.filter(ex => {
                    if (studentRegisteredExamIds.includes(ex.id)) return false;
                    if (!ex.participatingClasses || ex.participatingClasses.length === 0) return true;
                    return ex.participatingClasses.includes(studentGrade);
                  });
                  
                  if (availableExamsForReg.length === 0) {
                    return (
                      <div className="p-4 sm:p-5 bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl text-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-[#2d2c25]">Tüm Uygun Sınavlar Kayıtlı</p>
                        <p className="text-[11px] text-[#737265] mt-0.5">Öğrencinin seviyesine uygun kaydedilebilecek başka aktif sınav bulunmuyor.</p>
                      </div>
                    );
                  }

                  const allAvailableSelected = selectedDetailExamIds.length === availableExamsForReg.length;

                  return (
                    <div className="p-4 sm:p-5 bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#5a5a40]/10 flex items-center justify-center text-[#5a5a40]">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">
                              Yeni Sınav Kaydı Ekle (Toplu veya Tekli)
                            </h5>
                            <p className="text-[11px] text-[#737265]">Kayıt edilecek sınavları seçip ücret ve ödeme durumunu belirleyin.</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (allAvailableSelected) {
                              setSelectedDetailExamIds([]);
                            } else {
                              setSelectedDetailExamIds(availableExamsForReg.map(e => e.id));
                            }
                          }}
                          className="text-xs font-bold text-[#5a5a40] hover:text-[#2d2c25] bg-white hover:bg-[#eae7db] border border-[#e6e2d3] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                        >
                          {allAvailableSelected ? 'Tüm Seçimi Temizle' : 'Tümünü Seç'}
                        </button>
                      </div>

                      {/* Exams Selection Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-white border border-[#e6e2d3] rounded-xl">
                        {availableExamsForReg.map(ex => {
                          const isChecked = selectedDetailExamIds.includes(ex.id);
                          return (
                            <label 
                              key={ex.id} 
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                isChecked 
                                  ? 'bg-[#5a5a40]/5 border-[#5a5a40]/40' 
                                  : 'hover:bg-[#fcfbf7] border-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDetailExamIds([...selectedDetailExamIds, ex.id]);
                                  } else {
                                    setSelectedDetailExamIds(selectedDetailExamIds.filter(id => id !== ex.id));
                                  }
                                }}
                                className="mt-0.5 rounded border-[#e6e2d3] text-[#5a5a40] focus:ring-[#5a5a40] w-4 h-4 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <span className="block text-xs font-bold text-[#2d2c25] truncate">{ex.name}</span>
                                {ex.date && (
                                  <span className="block text-[10px] text-[#737265] mt-0.5">
                                    {formatDateLong(ex.date)}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      
                      {/* Pricing & Payment Status Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-[#737265] uppercase mb-1">
                            Sınav Başına Kayıt Ücreti
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737265] text-xs font-bold">₺</span>
                            <input
                              type="number"
                              value={newRegFee || ''}
                              onChange={(e) => setNewRegFee(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-[#e6e2d3] rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all"
                              placeholder="0"
                              min="0"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#737265] uppercase mb-1">
                            Ödeme Durumu
                          </label>
                          <select
                            value={newRegPaid ? 'paid' : 'debt'}
                            onChange={(e) => setNewRegPaid(e.target.value === 'paid')}
                            className="w-full bg-white border border-[#e6e2d3] rounded-xl px-3 py-2 text-xs text-[#2d2c25] font-bold focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all cursor-pointer"
                          >
                            <option value="debt">Ödenmedi (Borç Olarak Ekle)</option>
                            <option value="paid">Ödendi (Gelir Olarak Ekle)</option>
                          </select>
                        </div>
                      </div>

                      {/* Calculation & Budget Sync preview */}
                      {selectedDetailExamIds.length > 0 && newRegFee > 0 && (
                        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          newRegPaid 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span>
                              {selectedDetailExamIds.length} Sınav × ₺{newRegFee} = <strong>₺{selectedDetailExamIds.length * newRegFee}</strong> ({newRegPaid ? 'Bütçeye Gelir Eklenecek' : 'Öğrenciye Borç Eklenecek'})
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => addDetailRegistrations(student.id)}
                          disabled={selectedDetailExamIds.length === 0}
                          className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-full transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                            selectedDetailExamIds.length > 0
                              ? 'bg-[#5a5a40] hover:bg-[#43423b] text-white hover:shadow'
                              : 'bg-[#e6e2d3] text-[#737265] cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>Öğrenciyi Seçilen Sınavlara Kaydet ({selectedDetailExamIds.length})</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>

              {/* Modal Footer */}
              <div className="bg-[#fcfbf7] border-t border-[#e6e2d3] px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between shrink-0 rounded-b-[28px] sm:rounded-b-[32px]">
                <div className="text-xs text-[#737265] truncate mr-2">
                  <strong className="text-[#2d2c25]">{student.name}</strong>
                  <span className="hidden sm:inline"> • {student.className || 'Sınıf Belirtilmemiş'} • {(student.examRegistrations || []).length} Sınav Kaydı</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsStudentModalOpen(false);
                      setEditingStudentId(null);
                    }}
                    className="px-5 py-2 sm:px-6 sm:py-2.5 bg-[#5a5a40] hover:bg-[#43423b] text-white text-xs sm:text-sm font-bold rounded-full shadow-xs hover:shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Tamamla & Kapat</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
