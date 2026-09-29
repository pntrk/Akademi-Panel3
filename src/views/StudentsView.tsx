import React, { useRef, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Student, BudgetIncome } from '../types';
import { exportToExcel, importFromExcel, generateId, normalizeForSearch, formatDateLong, getExamTerm, isExamInTerm1, isExamInTerm2 } from '../lib/utils';
import { 
  Upload, Download, Edit2, Plus, Trash2, X, CheckSquare, Square, 
  Search, Calendar, DollarSign, Users, Award, Sparkles, BookOpen, 
  AlertCircle, SlidersHorizontal, Trash, ChevronDown, ChevronRight,
  TrendingUp, Wallet, Check, UserPlus, Filter, DoorOpen, CheckCircle2,
  XCircle, ArrowUpDown, Layers, Receipt, CreditCard, GraduationCap, Hash, User,
  LayoutGrid, List, Coins
} from 'lucide-react';

export const formatCleanFee = (val: number): string => {
  if (isNaN(val) || val === null || val === undefined) return '0';
  const clean = Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  return clean.toString();
};

export const getDisplayFeeForReg = (
  reg: { examId: string; fee: number; isPaid?: boolean; installment?: string },
  studentRegs: { examId: string; fee: number; isPaid?: boolean; installment?: string }[] = [],
  allExams: { id: string; name?: string; date?: string }[] = []
): number => {
  if (!reg) return 0;
  if (!studentRegs || studentRegs.length <= 1) return Number(reg.fee) || 0;

  const hasInstallment = studentRegs.some(r => r.installment || (r.isPaid && studentRegs.some(sr => !sr.isPaid)));
  if (!hasInstallment) return Number(reg.fee) || 0;

  const totalPkgFee = studentRegs.reduce((sum, r) => sum + (Number(r.fee) || 0), 0);
  if (totalPkgFee <= 0) return Number(reg.fee) || 0;

  const t1Regs = studentRegs.filter(r => isExamInTerm1(allExams.find(e => e.id === r.examId) || {}));
  const t1List = t1Regs.length > 0 ? t1Regs : studentRegs.slice(0, Math.ceil(studentRegs.length / 2));
  const t2List = studentRegs.filter(r => !t1List.some(t1 => t1.examId === r.examId));

  const isT1 = t1List.some(t1 => t1.examId === reg.examId);
  const paidHalf = Math.round((totalPkgFee / 2) * 100) / 100;
  const debtHalf = Math.round((totalPkgFee - paidHalf) * 100) / 100;

  if (isT1 && t1List.length > 0) {
    const idx = t1List.findIndex(t1 => t1.examId === reg.examId);
    const perExam = Math.round((paidHalf / t1List.length) * 100) / 100;
    return idx === t1List.length - 1
      ? Math.max(0, Math.round((paidHalf - (perExam * (t1List.length - 1))) * 100) / 100)
      : perExam;
  } else if (!isT1 && t2List.length > 0) {
    const idx = t2List.findIndex(t2 => t2.examId === reg.examId);
    const perExam = Math.round((debtHalf / t2List.length) * 100) / 100;
    return idx === t2List.length - 1
      ? Math.max(0, Math.round((debtHalf - (perExam * (t2List.length - 1))) * 100) / 100)
      : perExam;
  }

  return Number(reg.fee) || 0;
};

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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Selection states
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Bulk modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedBulkExamIds, setSelectedBulkExamIds] = useState<string[]>([]);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [bulkPaymentMode, setBulkPaymentMode] = useState<'paid' | 'installment' | 'debt'>('debt');

  // New registration states inside student details modal
  const [selectedDetailExamIds, setSelectedDetailExamIds] = useState<string[]>([]);
  const [newRegFee, setNewRegFee] = useState<number>(0);
  const [newRegPaymentMode, setNewRegPaymentMode] = useState<'paid' | 'installment' | 'debt'>('debt');

  // Single student details modal
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Map student IDs to their assigned exam halls
  const studentHallsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    state.examHalls.forEach(h => {
      if (h.seatingPlan) {
        h.seatingPlan.forEach(item => {
          let stId = item.studentId;
          if (!stId && item.studentNo) {
            const found = state.students.find(s => s.no === item.studentNo);
            if (found) stId = found.id;
          }
          if (stId) {
            if (!map[stId]) {
              map[stId] = [];
            }
            if (!map[stId].some(existing => existing.id === h.id)) {
              map[stId].push({ id: h.id, name: h.name });
            }
          }
        });
      }
    });
    return map;
  }, [state.examHalls, state.students]);

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
      const q = normalizeForSearch(searchQuery.trim());
      const matchesSearch = !q || 
                            normalizeForSearch(s.name).includes(q) || 
                            (s.no && s.no.toString().includes(searchQuery.trim()));
      
      const matchesClass = !classFilter || (s.className || '').trim() === classFilter.trim();
      
      let matchesExam = true;
      if (examFilter) {
        matchesExam = (s.examRegistrations || []).some(r => String(r.examId) === String(examFilter));
      }

      let matchesHall = true;
      if (hallFilter) {
        const assignedHalls = studentHallsMap[s.id] || [];
        matchesHall = assignedHalls.some(h => String(h.id) === String(hallFilter)) ||
                      state.examHalls.some(h => String(h.id) === String(hallFilter) && h.seatingPlan?.some(sp => sp.studentId === s.id || (sp.studentNo && s.no && sp.studentNo === s.no)));
      }

      return matchesSearch && matchesClass && matchesExam && matchesHall;
    }).reverse(); // En son eklenen en üstte çıksın
  }, [state.students, searchQuery, classFilter, examFilter, hallFilter, state.examHalls, studentHallsMap]);

  // Overall registration statistics based on active filters
  const stats = useMemo(() => {
    let totalRegisteredStudents = 0;
    let totalFees = 0;
    let totalUnpaidFees = 0;

    const hasActiveFilter = !!(classFilter || examFilter || hallFilter || searchQuery.trim());
    const targetStudents = hasActiveFilter ? filteredStudents : state.students;

    targetStudents.forEach(s => {
      const regs = s.examRegistrations || [];
      const relevantRegs = examFilter ? regs.filter(r => String(r.examId) === String(examFilter)) : regs;
      if (relevantRegs.length > 0) {
        totalRegisteredStudents++;
      }
      relevantRegs.forEach(r => {
        const fee = Number(r.fee) || 0;
        if (r.isPaid) {
          totalFees += fee;
        } else {
          totalUnpaidFees += fee;
        }
      });
    });
    return {
      totalStudents: targetStudents.length,
      totalRegisteredStudents,
      totalRegistrations: totalRegisteredStudents,
      totalFees: Math.round((totalFees + Number.EPSILON) * 100) / 100,
      totalUnpaidFees: Math.round((totalUnpaidFees + Number.EPSILON) * 100) / 100
    };
  }, [state.students, filteredStudents, classFilter, examFilter, hallFilter, searchQuery]);

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

    const totalLumpSumFee = parseFloat(registrationFee.toString()) || 0;
    let updatedStudents = [...state.students];

    if (bulkPaymentMode === 'installment' && totalLumpSumFee > 0) {
      // 1. Taksit Ödendi: 1. Dönem sınavları "Ödendi" (Bütçeye Gelir), 2. Dönem sınavları "Borç" olarak kaydedilir
      const term1Exams = exams.filter(isExamInTerm1);
      const term2Exams = exams.filter(e => !isExamInTerm1(e));

      const hasBothTerms = term1Exams.length > 0 && term2Exams.length > 0;
      const paidHalf = hasBothTerms 
        ? Math.round((totalLumpSumFee / 2) * 100) / 100 
        : (term1Exams.length > 0 ? totalLumpSumFee : Math.round((totalLumpSumFee / 2) * 100) / 100);
      const debtHalf = Math.round((totalLumpSumFee - paidHalf) * 100) / 100;

      const paidExamsList = hasBothTerms ? term1Exams : (term1Exams.length > 0 ? term1Exams : exams.slice(0, Math.ceil(exams.length / 2)));
      const unpaidExamsList = exams.filter(e => !paidExamsList.some(pe => pe.id === e.id));

      const paidFeePerExam = paidExamsList.length > 0 ? Math.round((paidHalf / paidExamsList.length) * 100) / 100 : 0;
      const unpaidFeePerExam = unpaidExamsList.length > 0 ? Math.round((debtHalf / unpaidExamsList.length) * 100) / 100 : 0;

      exams.forEach((exam) => {
        const isPaidPortion = paidExamsList.some(pe => pe.id === exam.id);
        let examFee = 0;
        if (isPaidPortion) {
          const pIdx = paidExamsList.findIndex(pe => pe.id === exam.id);
          examFee = pIdx === paidExamsList.length - 1
            ? Math.max(0, Math.round((paidHalf - (paidFeePerExam * (paidExamsList.length - 1))) * 100) / 100)
            : paidFeePerExam;
        } else {
          const uIdx = unpaidExamsList.findIndex(ue => ue.id === exam.id);
          examFee = uIdx === unpaidExamsList.length - 1
            ? Math.max(0, Math.round((debtHalf - (unpaidFeePerExam * (unpaidExamsList.length - 1))) * 100) / 100)
            : unpaidFeePerExam;
        }

        updatedStudents = updatedStudents.map(s => {
          if (selectedStudentIds.includes(s.id)) {
            const regs = s.examRegistrations || [];
            const filteredRegs = regs.filter(r => r.examId !== exam.id);
            return {
              ...s,
              examRegistrations: [
                ...filteredRegs,
                {
                  examId: exam.id,
                  fee: examFee,
                  isPaid: isPaidPortion,
                  dateRegistered: new Date().toLocaleDateString('tr-TR'),
                  installment: isPaidPortion ? '1. Taksit (Ödendi)' : '2. Taksit (Kalan Borç)'
                }
              ]
            };
          }
          return s;
        });
      });

      setStudents(updatedStudents);

      alert(`Seçilen ${selectedStudentIds.length} öğrenci için sınav kayıtları tamamlandı. Öğrenci başına ₺${paidHalf} (Toplam: ₺${selectedStudentIds.length * paidHalf}) 1. dönem sınavlarına eşit paylaştırılıp bütçe gelirlerine kaydedildi, kalan ₺${debtHalf} ise 2. dönem borcu olarak işlendi.`);
    } else {
      const isPaid = bulkPaymentMode === 'paid';
      const feePerExam = exams.length > 0 ? Math.round((totalLumpSumFee / exams.length) * 100) / 100 : 0;

      exams.forEach((exam, idx) => {
        const examFee = idx === exams.length - 1
          ? Math.max(0, Math.round((totalLumpSumFee - (feePerExam * (exams.length - 1))) * 100) / 100)
          : feePerExam;

        updatedStudents = updatedStudents.map(s => {
          if (selectedStudentIds.includes(s.id)) {
            const regs = s.examRegistrations || [];
            const filteredRegs = regs.filter(r => r.examId !== exam.id);
            return {
              ...s,
              examRegistrations: [
                ...filteredRegs,
                {
                  examId: exam.id,
                  fee: examFee,
                  isPaid: isPaid,
                  dateRegistered: new Date().toLocaleDateString('tr-TR')
                }
              ]
            };
          }
          return s;
        });
      });

      setStudents(updatedStudents);

      alert(`Seçilen ${selectedStudentIds.length} öğrenci için sınav kayıtları tamamlandı${totalLumpSumFee > 0 && isPaid ? ` ve toplam ₺${selectedStudentIds.length * totalLumpSumFee} bütçe gelirlerine kaydedildi` : ''}!`);
    }

    setSelectedStudentIds([]);
    setIsBulkModalOpen(false);
    setSelectedBulkExamIds([]);
    setRegistrationFee(0);
    setBulkPaymentMode('debt');
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

  const handlePayTerm1Registrations = (studentId: string) => {
    const updatedStudents = state.students.map(s => {
      if (s.id === studentId) {
        const regs = s.examRegistrations || [];
        const updatedRegs = regs.map(r => {
          const examObj = state.exams.find(e => e.id === r.examId);
          const isTerm1 = examObj ? isExamInTerm1(examObj) : false;
          if (isTerm1 && !r.isPaid) {
            return {
              ...r,
              isPaid: true,
              installment: '1. Taksit (Ödendi)'
            };
          }
          return r;
        });
        return {
          ...s,
          examRegistrations: updatedRegs
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

  // Add exam registrations to a student from the detail modal with lump-sum fee
  // Add exam registrations to a student from the detail modal with lump-sum fee
  const addDetailRegistrations = (studentId: string) => {
    if (selectedDetailExamIds.length === 0) return;
    
    const exams = state.exams.filter(e => selectedDetailExamIds.includes(e.id));
    if (exams.length === 0) return;

    const totalLumpSumFee = parseFloat(newRegFee.toString()) || 0;
    const student = state.students.find(s => s.id === studentId);
    const studentLabel = student ? `${student.name}${student.no ? ` (No: ${student.no})` : ''}` : 'Öğrenci';

    let updatedStudents = [...state.students];

    if (newRegPaymentMode === 'installment' && totalLumpSumFee > 0) {
      // 1. Taksit Ödendi: 1. Dönem sınavları "Ödendi" (Bütçeye Gelir), 2. Dönem sınavları "Borç" olarak kaydedilir
      const term1Exams = exams.filter(isExamInTerm1);
      const term2Exams = exams.filter(e => !isExamInTerm1(e));

      const hasBothTerms = term1Exams.length > 0 && term2Exams.length > 0;
      const paidHalf = hasBothTerms 
        ? Math.round((totalLumpSumFee / 2) * 100) / 100 
        : (term1Exams.length > 0 ? totalLumpSumFee : Math.round((totalLumpSumFee / 2) * 100) / 100);
      const debtHalf = Math.round((totalLumpSumFee - paidHalf) * 100) / 100;

      const paidExamsList = hasBothTerms ? term1Exams : (term1Exams.length > 0 ? term1Exams : exams.slice(0, Math.ceil(exams.length / 2)));
      const unpaidExamsList = exams.filter(e => !paidExamsList.some(pe => pe.id === e.id));

      const paidFeePerExam = paidExamsList.length > 0 ? Math.round((paidHalf / paidExamsList.length) * 100) / 100 : 0;
      const unpaidFeePerExam = unpaidExamsList.length > 0 ? Math.round((debtHalf / unpaidExamsList.length) * 100) / 100 : 0;

      exams.forEach((exam) => {
        const isPaidPortion = paidExamsList.some(pe => pe.id === exam.id);
        let examFee = 0;
        if (isPaidPortion) {
          const pIdx = paidExamsList.findIndex(pe => pe.id === exam.id);
          examFee = pIdx === paidExamsList.length - 1
            ? Math.max(0, Math.round((paidHalf - (paidFeePerExam * (paidExamsList.length - 1))) * 100) / 100)
            : paidFeePerExam;
        } else {
          const uIdx = unpaidExamsList.findIndex(ue => ue.id === exam.id);
          examFee = uIdx === unpaidExamsList.length - 1
            ? Math.max(0, Math.round((debtHalf - (unpaidFeePerExam * (unpaidExamsList.length - 1))) * 100) / 100)
            : unpaidFeePerExam;
        }

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
                  fee: examFee,
                  isPaid: isPaidPortion,
                  dateRegistered: new Date().toLocaleDateString('tr-TR'),
                  installment: isPaidPortion ? '1. Taksit (Ödendi)' : '2. Taksit (Kalan Borç)'
                }
              ]
            };
          }
          return s;
        });
      });
    } else {
      // 'paid' veya 'debt' modu
      const isPaid = newRegPaymentMode === 'paid';
      const feePerExam = exams.length > 0 ? Math.round((totalLumpSumFee / exams.length) * 100) / 100 : 0;

      exams.forEach((exam, idx) => {
        const examFee = idx === exams.length - 1
          ? Math.max(0, Math.round((totalLumpSumFee - (feePerExam * (exams.length - 1))) * 100) / 100)
          : feePerExam;

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
                  fee: examFee,
                  isPaid: isPaid,
                  dateRegistered: new Date().toLocaleDateString('tr-TR')
                }
              ]
            };
          }
          return s;
        });
      });
    }

    setStudents(updatedStudents);

    // Reset states
    setSelectedDetailExamIds([]);
    setNewRegFee(0);
    setNewRegPaymentMode('debt');
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

        {/* Stat 2: Sınava Kayıtlı Öğrenci */}
        <div className="bg-white px-2.5 py-1.5 sm:p-4 md:p-5 border border-brand-border/70 rounded-xl sm:rounded-2xl shadow-2xs sm:shadow-sm flex items-center sm:flex-col justify-between sm:justify-between gap-1.5 sm:gap-2 transition-all hover:border-brand-accent/50">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-between sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold text-brand-ink/60 uppercase tracking-wider truncate">
              <span className="hidden sm:inline">Sınava </span>Kayıtlı
            </span>
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-brand-ink leading-none">{stats.totalRegisteredStudents}</span>
            <span className="text-[9px] sm:text-xs text-brand-ink/50 font-medium">öğrenci</span>
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
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-emerald-700 leading-none">₺{formatCleanFee(stats.totalFees)}</span>
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
            <span className="font-sans text-sm sm:text-2xl md:text-3xl font-bold tracking-tight text-rose-600 leading-none">₺{formatCleanFee(stats.totalUnpaidFees)}</span>
          </div>
        </div>
      </section>

      {/* Filter Bar - Prominent & Always Visible on Mobile & Desktop */}
      <section className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs sm:shadow-sm flex flex-col gap-2 sm:gap-3 transition-all">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center">
          {/* Search Box - Enhanced Mobile Visibility */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-indigo-600 h-4 w-4 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Öğrenci adı, soyadı veya okul no ile ara..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl pl-9 sm:pl-10 pr-8 sm:pr-9 py-2.5 sm:py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Aramayı Temizle"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns - 3 Columns Single-Row on Mobile, Flex on Desktop */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1 sm:gap-2 w-full sm:w-auto">
            {/* 1. Şube Filtresi */}
            <div className="relative min-w-0 w-full sm:w-auto">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className={`w-full appearance-none pl-1.5 sm:pl-3 pr-4 sm:pr-7 py-1.5 sm:py-2 border text-[10px] sm:text-xs rounded-lg sm:rounded-xl focus:outline-none focus:border-indigo-500 font-bold shadow-2xs cursor-pointer truncate transition-colors ${
                  classFilter 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-1 ring-indigo-200' 
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-800'
                }`}
                aria-label="Şube Filtresi"
              >
                <option value="">Şubeler</option>
                {uniqueClassesForFilter.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
              <ChevronDown className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-slate-400 absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 2. Sınav Filtresi */}
            <div className="relative min-w-0 w-full sm:w-auto">
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className={`w-full appearance-none pl-1.5 sm:pl-3 pr-4 sm:pr-7 py-1.5 sm:py-2 border text-[10px] sm:text-xs rounded-lg sm:rounded-xl focus:outline-none focus:border-indigo-500 font-bold sm:min-w-[125px] sm:max-w-[170px] shadow-2xs cursor-pointer truncate transition-colors ${
                  examFilter 
                    ? 'bg-purple-50 border-purple-200 text-purple-900 ring-1 ring-purple-200' 
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-800'
                }`}
                aria-label="Sınav Filtresi"
              >
                <option value="">Sınavlar</option>
                {state.exams.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <ChevronDown className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-slate-400 absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* 3. Salon Filtresi */}
            <div className="relative min-w-0 w-full sm:w-auto">
              <select
                value={hallFilter}
                onChange={(e) => setHallFilter(e.target.value)}
                className={`w-full appearance-none pl-1.5 sm:pl-3 pr-4 sm:pr-7 py-1.5 sm:py-2 border text-[10px] sm:text-xs rounded-lg sm:rounded-xl focus:outline-none focus:border-indigo-500 font-bold sm:min-w-[115px] sm:max-w-[160px] shadow-2xs cursor-pointer truncate transition-colors ${
                  hallFilter 
                    ? 'bg-amber-50 border-amber-200 text-amber-900 ring-1 ring-amber-200' 
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-800'
                }`}
                aria-label="Salon Filtresi"
              >
                <option value="">Salonlar</option>
                {uniqueHallsForFilter.map(hall => (
                  <option key={hall.id} value={hall.id}>{hall.name}</option>
                ))}
              </select>
              <ChevronDown className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-slate-400 absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {(searchQuery || classFilter || examFilter || hallFilter) && (
              <button 
                type="button"
                onClick={() => { setSearchQuery(''); setClassFilter(''); setExamFilter(''); setHallFilter(''); }}
                className="col-span-3 sm:col-span-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] sm:text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold transition-all shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer mt-0.5 sm:mt-0"
              >
                <X className="w-3 h-3" />
                <span>Filtreleri Temizle</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Student List Container with Card & Compact Table Support */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs flex-1 overflow-hidden flex flex-col min-h-[400px]">
        
        {/* List Header Bar: Quick Stats & View Mode Switcher */}
        <div className="bg-slate-50/80 border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 px-2.5 py-1 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Tümünü Seç / Seçimi Kaldır"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span>Seçimi Kaldır</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Tümünü Seç</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded-lg text-xs font-mono">
                {filteredStudents.length}
              </span>
              <span>öğrenci</span>
            </div>
          </div>

          {/* View Switcher: Kartlar vs Tablo */}
          <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kart / Grid Görünümü"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kartlar</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kompakt Tablo Görünümü"
            >
              <List className="w-3.5 h-3.5" />
              <span>Tablo</span>
            </button>
          </div>
        </div>

        {/* View Mode 1: CARD GRID VIEW (Web & Mobile Optimized) */}
        {viewMode === 'cards' && (
          <div className="flex-1 overflow-auto p-2.5 sm:p-4 bg-slate-50/50">
            {filteredStudents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
                {filteredStudents.map((student, idx) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const studentHalls = studentHallsMap[student.id] || [];
                  const registrations = student.examRegistrations || [];
                  
                  const unpaidTotal = Math.round((registrations.reduce((acc, r) => !r.isPaid ? acc + (Number(r.fee) || 0) : acc, 0) + Number.EPSILON) * 100) / 100;
                  const hasRegistrations = registrations.length > 0;

                  const hasMissingHall = registrations.some(reg => 
                    !state.examHalls.some(h => 
                      (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                      h.seatingPlan?.some(sp => sp.studentId === student.id)
                    )
                  );

                  return (
                    <div 
                      key={student.id ? `card-${student.id}-${idx}` : `card-${student.no}-${idx}`} 
                      className={`bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border transition-all duration-150 shadow-2xs hover:shadow-xs flex flex-col justify-between gap-2 sm:gap-2.5 ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20' 
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Header: Select + No + Class + Name + Quick Actions */}
                      <div>
                        <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 sm:pb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button 
                              type="button"
                              onClick={() => toggleSelectStudent(student.id)} 
                              className="p-0.5 sm:p-1 text-slate-500 hover:text-indigo-600 active:scale-90 transition-transform shrink-0 cursor-pointer"
                              title="Öğrenci Seç"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-indigo-600" />
                              ) : (
                                <Square className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-300 hover:text-slate-500" />
                              )}
                            </button>

                            <span className="bg-slate-100 text-slate-800 border border-slate-200/80 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-mono font-bold shrink-0 shadow-2xs">
                              {student.no || '-'}
                            </span>

                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold truncate">
                              {student.className || '-'}
                            </span>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              type="button"
                              onClick={() => {
                                setEditingStudentId(student.id);
                                setIsStudentModalOpen(true);
                              }}
                              className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95 cursor-pointer"
                              title="Düzenle / Detay"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => removeStudent(student.id)}
                              className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-95 cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Student Name & Status */}
                        <div className="pt-1.5 flex items-center justify-between gap-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setIsStudentModalOpen(true);
                            }}
                            className="text-xs sm:text-sm font-bold text-left text-slate-900 hover:text-indigo-600 transition-colors truncate block"
                          >
                            {student.name || 'İsimsiz Öğrenci'}
                          </button>

                          {hasMissingHall && (
                            <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5 shadow-2xs">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>Salonsuz</span>
                            </span>
                          )}
                        </div>

                        {/* Mid Info Bar: Hall + Debt/Paid Badges */}
                        <div className="pt-1 flex flex-wrap items-center gap-1 sm:gap-1.5">
                          {/* Hall Badge */}
                          <div className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 border shadow-2xs ${
                            studentHalls.length > 0 
                              ? 'bg-slate-50 border-slate-200 text-slate-700' 
                              : registrations.length > 0
                              ? 'bg-rose-50/70 border-rose-200 text-rose-700'
                              : 'bg-slate-50/50 border-slate-200/60 text-slate-400'
                          }`}>
                            <DoorOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 text-indigo-600 opacity-80" />
                            <span className="truncate max-w-[110px] sm:max-w-[130px]">
                              {studentHalls.length > 0 ? studentHalls.map(h => h.name).join(', ') : registrations.length > 0 ? 'Salonsuz' : 'Kayıtsız'}
                            </span>
                          </div>

                          {/* Payment Status Badge */}
                          {hasRegistrations && (
                            unpaidTotal > 0 ? (
                              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                                <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500" />
                                <span>₺{formatCleanFee(unpaidTotal)} Borç</span>
                              </div>
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />
                                <span>Ödendi</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Card Bottom: Registrations Chips & Quick Action Buttons */}
                      <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1 sm:gap-1.5">
                        {registrations.map(reg => {
                          const ex = state.exams.find(e => e.id === reg.examId);
                          if (!ex) return null;
                          return (
                            <div 
                              key={reg.examId} 
                              className={`flex items-center border rounded-lg sm:rounded-xl overflow-hidden pl-1.5 sm:pl-2 pr-0.5 sm:pr-1 py-0.5 gap-1 text-[9px] sm:text-[10px] font-semibold transition-all shadow-2xs ${
                                reg.isPaid 
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
                              }`}
                            >
                              <button 
                                type="button"
                                onClick={() => toggleRegistrationPayment(student.id, reg.examId)}
                                className="flex items-center gap-1 hover:underline cursor-pointer"
                                title={reg.isPaid ? "Ödendi (Değiştirmek için tıkla)" : "Ödenmedi (Ödendi yapmak için tıkla)"}
                              >
                                <span className="truncate max-w-[80px] sm:max-w-[100px]">{ex.name}</span>
                                <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded-full ${
                                  reg.isPaid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                }`}>
                                  {reg.isPaid ? '✓' : '₺'}
                                </span>
                              </button>
                              
                              <button 
                                type="button"
                                onClick={() => removeSingleRegistration(student.id, reg.examId)}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-black/5 transition-colors ml-0.5 cursor-pointer"
                                title="Sınav Kaydını Sil"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Quick Add Exam */}
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedStudentIds([student.id]);
                            setIsBulkModalOpen(true);
                          }}
                          className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-dashed border-slate-300 hover:border-indigo-300 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                          title="Yeni Sınav Ekle"
                        >
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600" />
                          <span>+ Sınav</span>
                        </button>

                        {/* Quick Pay All Unpaid Fees Button */}
                        {unpaidTotal > 0 && (
                          <button 
                            type="button"
                            onClick={() => handlePayAllRegistrations(student.id)}
                            className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-md sm:rounded-lg transition-all shadow-2xs active:scale-95 ml-auto cursor-pointer"
                            title="Öğrencinin tüm sınav borçlarını ödendi yap"
                          >
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span>Tahsil Et</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/80">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-semibold">Arama veya filtre kriterlerine uyan öğrenci bulunamadı.</p>
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: ULTRA-COMPACT TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="overflow-auto flex-1 w-full">
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold text-xs">
                  <th style={{ width: 44 }} className="py-2.5 px-3 uppercase tracking-wider text-center sticky top-0 bg-slate-50">
                    <button 
                      type="button"
                      onClick={handleSelectAll}
                      className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                      title="Hepsini Seç / Bırak"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </th>
                  <th style={{ width: 75 }} className="py-2.5 px-3 uppercase tracking-wider sticky top-0 bg-slate-50 font-bold">NO</th>
                  <th className="py-2.5 px-3 uppercase tracking-wider sticky top-0 bg-slate-50 font-bold">ADI SOYADI</th>
                  <th style={{ width: 95 }} className="py-2.5 px-3 uppercase tracking-wider sticky top-0 bg-slate-50 font-bold">SINIFI</th>
                  <th style={{ width: 150 }} className="py-2.5 px-3 uppercase tracking-wider sticky top-0 bg-slate-50 font-bold">SINAV SALONU</th>
                  <th className="py-2.5 px-3 uppercase tracking-wider sticky top-0 bg-slate-50 font-bold">KAYITLI SINAVLAR</th>
                  <th style={{ width: 80 }} className="py-2.5 px-3 uppercase tracking-wider text-center sticky top-0 bg-slate-50 font-bold">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {filteredStudents.map((student, idx) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  const studentHalls = studentHallsMap[student.id] || [];
                  const registrations = student.examRegistrations || [];
                  const hasMissingHall = registrations.some(reg => 
                    !state.examHalls.some(h => 
                      (h.examId === reg.examId || h.examIds?.includes(reg.examId)) && 
                      h.seatingPlan?.some(sp => sp.studentId === student.id)
                    )
                  );

                  return (
                    <tr 
                      key={student.id ? `table-${student.id}-${idx}` : `table-${student.no}-${idx}`} 
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center">
                        <button 
                          type="button"
                          onClick={() => toggleSelectStudent(student.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Öğrenci Seç"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* No */}
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/80">
                          {student.no || '-'}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setIsStudentModalOpen(true);
                            }}
                            className="font-bold text-slate-800 hover:text-indigo-600 text-left cursor-pointer transition-colors text-xs hover:underline truncate max-w-[200px]"
                          >
                            {student.name || 'İsimsiz Öğrenci'}
                          </button>
                          {hasMissingHall && (
                            <span 
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200 shrink-0" 
                              title="Salonsuz Sınavı Var"
                            >
                              Salonsuz
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-2 px-3">
                        <span className="font-bold text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {student.className || '-'}
                        </span>
                      </td>

                      {/* Hall */}
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1 items-center">
                          {studentHalls.length > 0 ? (
                            studentHalls.map(hall => (
                              <span key={hall.id} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                <DoorOpen className="w-2.5 h-2.5 text-indigo-600" />
                                <span className="truncate max-w-[100px]">{hall.name}</span>
                              </span>
                            ))
                          ) : registrations.length > 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              Salonsuz
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Registered Exams */}
                      <td className="py-2 px-3" id="student-exam-regs-cell">
                        <div className="flex flex-wrap gap-1 items-center">
                          {registrations.map((reg) => {
                            const examObj = state.exams.find(e => e.id === reg.examId);
                            const examName = examObj ? examObj.name : 'Sınav';
                            
                            return (
                              <span 
                                key={reg.examId} 
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  reg.isPaid 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                                    : 'bg-rose-50 border-rose-200 text-rose-900'
                                }`}
                              >
                                <span className="font-bold truncate max-w-[90px]">{examName}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleRegistrationPayment(student.id, reg.examId)}
                                  className={`text-[8px] font-extrabold px-1 rounded-full cursor-pointer ${
                                    reg.isPaid
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600 text-white'
                                  }`}
                                  title={reg.isPaid ? "Ödendi" : "Borç"}
                                >
                                  {reg.isPaid ? '✓' : '₺'}
                                </button>
                              </span>
                            );
                          })}
                          
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentIds([student.id]);
                              setIsBulkModalOpen(true);
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-50 hover:bg-indigo-50 border border-indigo-200 text-indigo-600 rounded text-[10px] font-bold transition-all cursor-pointer"
                            title="Sınav Ekle"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>+</span>
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            type="button"
                            onClick={() => {
                              setEditingStudentId(student.id);
                              setIsStudentModalOpen(true);
                            }}
                            className="p-1 rounded border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => removeStudent(student.id)} 
                            className="p-1 rounded border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium text-xs">
                      {state.students.length === 0 
                        ? "Kayıtlı öğrenci bulunmuyor. Yeni ekleyebilir veya Excel'den aktarabilirsiniz." 
                        : "Arama kriterine uyan öğrenci bulunamadı."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-xs font-bold text-[#5a5a40] uppercase tracking-wider">Deneme Sınavı Seçimi</label>
                  {state.exams.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const t1Ids = state.exams.filter(isExamInTerm1).map(e => e.id);
                          setSelectedBulkExamIds(t1Ids);
                        }}
                        className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded transition-all cursor-pointer"
                        title="1. Dönem (Eylül - Ocak) sınavlarını otomatik seç"
                      >
                        1. Dönem ({state.exams.filter(isExamInTerm1).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const t2Ids = state.exams.filter(isExamInTerm2).map(e => e.id);
                          setSelectedBulkExamIds(t2Ids);
                        }}
                        className="text-[10px] font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded transition-all cursor-pointer"
                        title="2. Dönem (Şubat - Haziran) sınavlarını otomatik seç"
                      >
                        2. Dönem ({state.exams.filter(isExamInTerm2).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBulkExamIds.length === state.exams.length) {
                            setSelectedBulkExamIds([]);
                          } else {
                            setSelectedBulkExamIds(state.exams.map(e => e.id));
                          }
                        }}
                        className="text-[10px] font-bold text-[#5a5a40] bg-[#e6e2d3]/50 hover:bg-[#e6e2d3] px-2 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        {selectedBulkExamIds.length === state.exams.length ? 'Temizle' : 'Tümü'}
                      </button>
                    </div>
                  )}
                </div>
                {state.exams.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto bg-[#fcfbf7] border border-[#e6e2d3] rounded-xl p-3">
                    {state.exams.map(exam => {
                      const term = getExamTerm(exam);
                      return (
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
                          <div className="flex items-center justify-between gap-1 flex-1 min-w-0">
                            <span className="text-sm font-semibold text-[#5a5a40] truncate">
                              {exam.name} {exam.date ? `(${formatDateLong(exam.date)})` : ''}
                            </span>
                            {term === 1 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/60 shrink-0">
                                1. Dönem
                              </span>
                            )}
                            {term === 2 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200/60 shrink-0">
                                2. Dönem
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
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
                  Öğrenci Başına Toplu Katılım Ücreti
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
                  Öğrencinin katıldığı tüm seçili sınavlar için geçerli tek ve toplu ödeme tutarıdır. Sınav başı ücret toplamaya gerek yoktur.
                </p>
              </div>

              {registrationFee > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#5a5a40] uppercase tracking-wider mb-1.5">Ödeme Durumu</label>
                  <div className="grid grid-cols-3 gap-2 bg-[#fcfbf7] p-1 border border-[#e6e2d3] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setBulkPaymentMode('paid')}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                        bulkPaymentMode === 'paid'
                          ? 'bg-[#5a5a40] text-white shadow-sm'
                          : 'text-[#8e8d82] hover:text-[#5a5a40]'
                      }`}
                    >
                      Tamamı Ödendi
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkPaymentMode('installment')}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                        bulkPaymentMode === 'installment'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-[#8e8d82] hover:text-amber-600'
                      }`}
                    >
                      Taksit Ödendi (%50)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkPaymentMode('debt')}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                        bulkPaymentMode === 'debt'
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
                bulkPaymentMode === 'paid' ? (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-emerald-800 space-y-1">
                    <p className="text-xs font-bold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                      Bütçe Geliri Otomatik Eşitlenecek!
                    </p>
                    <p className="text-[10px] text-emerald-700/90 leading-normal">
                      {selectedStudentIds.length} Öğrenci × ₺{registrationFee} = <strong>₺{selectedStudentIds.length * registrationFee}</strong> toplu sınav katılım geliri, her öğrencinin adına ayrı gelir olarak bütçeye otomatik kaydedilecektir.
                    </p>
                  </div>
                ) : bulkPaymentMode === 'installment' ? (
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-amber-900 space-y-1">
                    <p className="text-xs font-bold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                      Taksit ve Bütçe Entegrasyonu!
                    </p>
                    <p className="text-[10px] text-amber-800/90 leading-normal">
                      Öğrenci başına ₺{registrationFee} ücretin yarısı olan <strong>₺{Math.round((registrationFee / 2) * 100) / 100}</strong> (Toplam: <strong>₺{selectedStudentIds.length * Math.round((registrationFee / 2) * 100) / 100}</strong>) bütçeye gelir kaydedilecek, kalan <strong>₺{Math.round((registrationFee - Math.round((registrationFee / 2) * 100) / 100) * 100) / 100}</strong> ise öğrenci borcu olarak işlenecektir.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-red-800 space-y-1">
                    <p className="text-xs font-bold flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-red-600 shrink-0" />
                      Öğrenci Borcu Otomatik Entegre Edilecek!
                    </p>
                    <p className="text-[10px] text-red-700/90 leading-normal">
                      {selectedStudentIds.length} Öğrenci × ₺{registrationFee} = <strong>₺{selectedStudentIds.length * registrationFee}</strong> toplam tutar bütçede ve öğrenci detaylarında borç olarak görünecek, bütçeyle otomatik entegre olacaktır.
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
                      const paidAmount = Math.round((regs.filter(r => r.isPaid).reduce((sum, r) => sum + (Number(r.fee) || 0), 0) + Number.EPSILON) * 100) / 100;
                      const unpaidAmount = Math.round((regs.filter(r => !r.isPaid).reduce((sum, r) => sum + (Number(r.fee) || 0), 0) + Number.EPSILON) * 100) / 100;
                      const totalAmount = Math.round(((paidAmount + unpaidAmount) + Number.EPSILON) * 100) / 100;

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
                              <span className="text-xl sm:text-2xl font-serif font-bold text-[#2d2c25]">₺{formatCleanFee(totalAmount)}</span>
                            </div>
                          </div>
                          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 sm:p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Tahsil Edilen (Gelir)</span>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-xl sm:text-2xl font-serif font-bold text-emerald-700">₺{formatCleanFee(paidAmount)}</span>
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
                                ₺{formatCleanFee(unpaidAmount)}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {student.examRegistrations && student.examRegistrations.some(r => !r.isPaid && isExamInTerm1(state.exams.find(e => e.id === r.examId) || {})) && (
                          <button
                            type="button"
                            onClick={() => handlePayTerm1Registrations(student.id)}
                            className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 px-3 py-1.5 rounded-full shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            title="Öğrencinin sadece 1. Dönem sınav borçlarını tahsil et (1. Taksit Ödendi)"
                          >
                            <Coins className="w-3.5 h-3.5 text-amber-700" />
                            <span>1. Taksit (1. Dönem) Tahsil Et</span>
                          </button>
                        )}
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

                                const eligibleHalls = state.examHalls.filter(h => {
                                  // 1. Öğrenci zaten bu salona yerleştirilmişse daima göster
                                  const isCurrentlySeated = (hall && hall.id === h.id) || h.seatingPlan?.some(sp => sp.studentId === student.id || (sp.studentNo && student.no && sp.studentNo === student.no));
                                  if (isCurrentlySeated) return true;

                                  // 2. Sınav eşleşmesi kontrolü
                                  const isDirectlyInExamHalls = Array.isArray(exam?.assignedHalls) && exam.assignedHalls.includes(h.id);
                                  const isHallLinkedToExam = h.examId === reg.examId || (Array.isArray(h.examIds) && h.examIds.includes(reg.examId));

                                  // Eğer sınavın özel atanmış salonları varsa sadece o salonlar uygundur
                                  if (exam?.assignedHalls && exam.assignedHalls.length > 0) {
                                    if (!isDirectlyInExamHalls && !isHallLinkedToExam) return false;
                                  } else if ((h.examIds && h.examIds.length > 0) || h.examId) {
                                    // Sınavda salon listesi boş ama salon belirli sınavlara kilitlenmişse bu sınavı içermeli
                                    if (!isHallLinkedToExam) return false;
                                  }

                                  // 3. Şube / Kademe / Sınıf Seviyesi Uygunluğu Kontrolü
                                  const studentClass = (student.className || student.classStr || '').trim();
                                  const studentGradeMatch = studentClass.match(/^(\d+)/) || studentClass.match(/(\d+)/);
                                  const studentGrade = studentGradeMatch ? studentGradeMatch[1] : '';

                                  // Salona özel atanmış şubeler/kademeler varsa kontrol et
                                  if (h.selectedClasses && h.selectedClasses.length > 0) {
                                    if (!studentClass) return false;

                                    const isDirectClassMatch = h.selectedClasses.some(sc => sc.trim().toLowerCase() === studentClass.toLowerCase());
                                    const isGradeMatch = h.selectedClasses.some(sc => {
                                      const gMatch = sc.match(/^(\d+)/) || sc.match(/(\d+)/);
                                      return gMatch && studentGrade && gMatch[1] === studentGrade;
                                    });

                                    if (!isDirectClassMatch && !isGradeMatch) {
                                      return false;
                                    }
                                  }

                                  return true;
                                });

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
                                        <span className="font-bold text-[#2d2c25]">
                                          ₺{getDisplayFeeForReg(reg, student.examRegistrations, state.exams)}
                                        </span>
                                        {reg.installment && (
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                            {reg.installment}
                                          </span>
                                        )}
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
                                          const branchInfo = h.selectedClasses && h.selectedClasses.length > 0 ? ` [${h.selectedClasses.join(', ')}]` : '';
                                          
                                          return (
                                            <option key={h.id} value={h.id} disabled={isFull && !isCurrent}>
                                              {h.name}{branchInfo} {isCurrent ? `(Sıra: ${deskNo})` : `(${occupiedCount}/${cap}${isFull ? ' - Dolu' : ''})`}
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

                            const eligibleHalls = state.examHalls.filter(h => {
                              // 1. Öğrenci zaten bu salona yerleştirilmişse daima göster
                              const isCurrentlySeated = (hall && hall.id === h.id) || h.seatingPlan?.some(sp => sp.studentId === student.id || (sp.studentNo && student.no && sp.studentNo === student.no));
                              if (isCurrentlySeated) return true;

                              // 2. Sınav eşleşmesi kontrolü
                              const isDirectlyInExamHalls = Array.isArray(exam?.assignedHalls) && exam.assignedHalls.includes(h.id);
                              const isHallLinkedToExam = h.examId === reg.examId || (Array.isArray(h.examIds) && h.examIds.includes(reg.examId));

                              // Eğer sınavın özel atanmış salonları varsa sadece o salonlar uygundur
                              if (exam?.assignedHalls && exam.assignedHalls.length > 0) {
                                if (!isDirectlyInExamHalls && !isHallLinkedToExam) return false;
                              } else if ((h.examIds && h.examIds.length > 0) || h.examId) {
                                // Sınavda salon listesi boş ama salon belirli sınavlara kilitlenmişse bu sınavı içermeli
                                if (!isHallLinkedToExam) return false;
                              }

                              // 3. Şube / Kademe / Sınıf Seviyesi Uygunluğu Kontrolü
                              const studentClass = (student.className || student.classStr || '').trim();
                              const studentGradeMatch = studentClass.match(/^(\d+)/) || studentClass.match(/(\d+)/);
                              const studentGrade = studentGradeMatch ? studentGradeMatch[1] : '';

                              // Salona özel atanmış şubeler/kademeler varsa kontrol et
                              if (h.selectedClasses && h.selectedClasses.length > 0) {
                                if (!studentClass) return false;

                                const isDirectClassMatch = h.selectedClasses.some(sc => sc.trim().toLowerCase() === studentClass.toLowerCase());
                                const isGradeMatch = h.selectedClasses.some(sc => {
                                  const gMatch = sc.match(/^(\d+)/) || sc.match(/(\d+)/);
                                  return gMatch && studentGrade && gMatch[1] === studentGrade;
                                });

                                if (!isDirectClassMatch && !isGradeMatch) {
                                  return false;
                                }
                              }

                              return true;
                            });

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
                                    <span className="text-xs font-bold text-[#2d2c25]">
                                      ₺{getDisplayFeeForReg(reg, student.examRegistrations, state.exams)}
                                    </span>
                                    {reg.installment && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                        {reg.installment}
                                      </span>
                                    )}
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
                                      const branchInfo = h.selectedClasses && h.selectedClasses.length > 0 ? ` [${h.selectedClasses.join(', ')}]` : '';

                                      return (
                                        <option key={h.id} value={h.id} disabled={isFull && !isCurrent}>
                                          {h.name}{branchInfo} {isCurrent ? `(Sıra: ${deskNo})` : `(${occupiedCount}/${cap}${isFull ? ' - Dolu' : ''})`}
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

                  const allAvailableSelected = availableExamsForReg.length > 0 && selectedDetailExamIds.length === availableExamsForReg.length;
                  const term1AvailableExams = availableExamsForReg.filter(isExamInTerm1);
                  const term2AvailableExams = availableExamsForReg.filter(isExamInTerm2);

                  const isTerm1Selected = term1AvailableExams.length > 0 && 
                    term1AvailableExams.every(e => selectedDetailExamIds.includes(e.id)) &&
                    (selectedDetailExamIds.length === term1AvailableExams.length || !term2AvailableExams.some(e => selectedDetailExamIds.includes(e.id)));

                  const isTerm2Selected = term2AvailableExams.length > 0 && 
                    term2AvailableExams.every(e => selectedDetailExamIds.includes(e.id)) &&
                    (selectedDetailExamIds.length === term2AvailableExams.length || !term1AvailableExams.some(e => selectedDetailExamIds.includes(e.id)));

                  return (
                    <div className="p-4 sm:p-5 bg-[#fcfbf7] border border-[#e6e2d3] rounded-2xl space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#5a5a40]/10 flex items-center justify-center text-[#5a5a40]">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-[#5a5a40] uppercase tracking-wider">
                              Yeni Sınav Kaydı Ekle (Toplu veya Tekli)
                            </h5>
                            <p className="text-[11px] text-[#737265]">Kayıt edilecek sınavları dönem butonlarıyla otomatik seçebilir veya tek tek işaretleyebilirsiniz.</p>
                          </div>
                        </div>

                        {/* Period (Dönem) Filters & Auto-Selection Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 1. Dönem Button (Eylül - Ocak) */}
                          <button
                            type="button"
                            onClick={() => {
                              const t1Ids = term1AvailableExams.map(e => e.id);
                              setSelectedDetailExamIds(t1Ids);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                              isTerm1Selected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                            }`}
                            title="1. Dönem (Eylül ile Ocak ayları arası) sınavlarını otomatik seç"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>1. Dönem</span>
                            <span className="text-[10px] opacity-80 hidden md:inline">(Eyl - Oca)</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                              isTerm1Selected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {term1AvailableExams.length}
                            </span>
                          </button>

                          {/* 2. Dönem Button (Şubat - Haziran) */}
                          <button
                            type="button"
                            onClick={() => {
                              const t2Ids = term2AvailableExams.map(e => e.id);
                              setSelectedDetailExamIds(t2Ids);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                              isTerm2Selected
                                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                : 'bg-white hover:bg-sky-50 text-sky-900 border-sky-300 shadow-2xs'
                            }`}
                            title="2. Dönem (Şubat ile Haziran ayları arası) sınavlarını otomatik seç"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>2. Dönem</span>
                            <span className="text-[10px] opacity-80 hidden md:inline">(Şub - Haz)</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                              isTerm2Selected ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
                            }`}>
                              {term2AvailableExams.length}
                            </span>
                          </button>

                          {/* All / Clear Selection */}
                          <button
                            type="button"
                            onClick={() => {
                              if (allAvailableSelected) {
                                setSelectedDetailExamIds([]);
                              } else {
                                setSelectedDetailExamIds(availableExamsForReg.map(e => e.id));
                              }
                            }}
                            className="text-xs font-bold text-[#5a5a40] hover:text-[#2d2c25] bg-white hover:bg-[#eae7db] border border-[#e6e2d3] px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                          >
                            {allAvailableSelected ? 'Temizle' : 'Tümü'}
                          </button>
                        </div>
                      </div>

                      {/* Exams Selection Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-white border border-[#e6e2d3] rounded-xl">
                        {availableExamsForReg.map(ex => {
                          const isChecked = selectedDetailExamIds.includes(ex.id);
                          const term = getExamTerm(ex);
                          return (
                            <label 
                              key={ex.id} 
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                isChecked 
                                  ? 'bg-[#5a5a40]/5 border-[#5a5a40]/40 ring-1 ring-[#5a5a40]/20' 
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
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="block text-xs font-bold text-[#2d2c25] truncate">{ex.name}</span>
                                  {term === 1 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/60 shrink-0">
                                      1. Dönem
                                    </span>
                                  )}
                                  {term === 2 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200/60 shrink-0">
                                      2. Dönem
                                    </span>
                                  )}
                                </div>
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
                            Toplu Sınav Katılım Ücreti
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737265] text-xs font-bold">₺</span>
                            <input
                              type="number"
                              value={newRegFee || ''}
                              onChange={(e) => setNewRegFee(parseFloat(e.target.value) || 0)}
                              className="w-full bg-white border border-[#e6e2d3] rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40] focus:outline-none transition-all"
                              placeholder="0,00"
                              min="0"
                            />
                          </div>
                          <p className="text-[10px] text-[#737265] mt-1">
                            Seçilen {selectedDetailExamIds.length > 0 ? `${selectedDetailExamIds.length} sınavın tümü` : 'tüm sınavlar'} için geçerli tek ve toplu ödeme tutarıdır.
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-[#737265] uppercase">
                              Ödeme Durumu
                            </label>
                            {newRegPaymentMode === 'installment' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                %50 Gelir / %50 Borç
                              </span>
                            )}
                          </div>
                          <select
                            value={newRegPaymentMode}
                            onChange={(e) => {
                              const val = e.target.value as 'paid' | 'installment' | 'debt';
                              setNewRegPaymentMode(val);
                              if (val === 'installment' && selectedDetailExamIds.length === 0) {
                                setSelectedDetailExamIds(availableExamsForReg.map(ex => ex.id));
                              }
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-xs font-bold focus:outline-none transition-all cursor-pointer shadow-2xs ${
                              newRegPaymentMode === 'installment'
                                ? 'bg-amber-50/40 border-2 border-amber-500 text-amber-950 ring-2 ring-amber-500/20'
                                : newRegPaymentMode === 'paid'
                                ? 'bg-emerald-50/40 border-2 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20'
                                : 'bg-white border border-[#e6e2d3] text-[#2d2c25] focus:ring-2 focus:ring-[#5a5a40]/20 focus:border-[#5a5a40]'
                            }`}
                          >
                            <option value="paid">Tamamı Ödendi (Tüm Sınavlar Katılım & Bütçeye Gelir)</option>
                            <option value="installment">1. Taksit Ödendi (%50 - 1. Dönem Sınavlarına Bölüştür & Gelir Yap / 2. Dönem Borç)</option>
                            <option value="debt">Ödenmedi (Tüm Sınavlar Öğrenciye Borç Olarak Ekle)</option>
                          </select>
                          <p className="text-[10px] text-[#737265] mt-1">
                            {newRegPaymentMode === 'paid' && 'Öğrencinin adı ve tutar bütçeye doğrudan gelir olarak kaydedilir.'}
                            {newRegPaymentMode === 'installment' && 'Toplu sınav ücretinin yarısı (%50) otomatik 1. Dönem sınavlarına eşit bölünerek bütçeye gelir yansıtılır, kalan %50 ise 2. Dönem sınavları için borç olarak kaydedilir.'}
                            {newRegPaymentMode === 'debt' && 'Bütçede öğrencinin borç hanesine aktarılır.'}
                          </p>
                        </div>
                      </div>

                      {/* Calculation & Budget Sync preview */}
                      {selectedDetailExamIds.length > 0 && newRegFee > 0 && (
                        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-fade-in ${
                          newRegPaymentMode === 'paid' 
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-xs' 
                            : newRegPaymentMode === 'installment'
                            ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                            : 'bg-rose-50/90 border-rose-200 text-rose-900 shadow-xs'
                        }`}>
                          <div className="flex items-start gap-3 w-full">
                            <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                            <div className="space-y-1.5 w-full">
                              {newRegPaymentMode === 'paid' && (
                                <p className="text-xs font-medium">
                                  Toplu Ödeme: <strong>₺{newRegFee}</strong> ({selectedDetailExamIds.length} Sınav Paketi). Bütçeye <strong>{student.name}</strong> adına doğrudan sınav gelirleri olarak kaydedilecektir.
                                </p>
                              )}
                              {newRegPaymentMode === 'installment' && (() => {
                                const selectedExamsList = state.exams.filter(e => selectedDetailExamIds.includes(e.id));
                                const t1Exams = selectedExamsList.filter(isExamInTerm1);
                                const t2Exams = selectedExamsList.filter(e => !isExamInTerm1(e));
                                const hasBoth = t1Exams.length > 0 && t2Exams.length > 0;
                                const paidList = hasBoth ? t1Exams : (t1Exams.length > 0 ? t1Exams : selectedExamsList.slice(0, Math.ceil(selectedExamsList.length / 2)));
                                const unpaidList = selectedExamsList.filter(e => !paidList.some(pe => pe.id === e.id));

                                const paidHalf = Math.round((newRegFee / 2) * 100) / 100;
                                const debtHalf = Math.round((newRegFee - paidHalf) * 100) / 100;
                                const paidFeePerExam = paidList.length > 0 ? Math.round((paidHalf / paidList.length) * 100) / 100 : 0;
                                const unpaidFeePerExam = unpaidList.length > 0 ? Math.round((debtHalf / unpaidList.length) * 100) / 100 : 0;

                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                      <p className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                                        <span>1. Taksit Otomatik Bütçe ve Dönem Dağılımı</span>
                                        <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-mono font-bold">
                                          Toplam: ₺{newRegFee}
                                        </span>
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                                      <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-300 shadow-2xs">
                                        <div className="font-bold text-emerald-900 flex items-center justify-between">
                                          <span>✓ 1. Dönem ({paidList.length} Sınav)</span>
                                          <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">ÖDENDİ & GELİR</span>
                                        </div>
                                        <p className="text-emerald-950/90 mt-1">
                                          Toplam <strong>₺{paidHalf}</strong> (%50) 1. dönem sınavlarına eşit bölündü (Sınav başına <strong>₺{paidFeePerExam}</strong>) ve <strong>Bütçe Gelirlerine</strong> entegre edildi.
                                        </p>
                                      </div>
                                      <div className="bg-white/95 p-2.5 rounded-xl border border-rose-300 shadow-2xs">
                                        <div className="font-bold text-rose-900 flex items-center justify-between">
                                          <span>⏳ 2. Dönem ({unpaidList.length} Sınav)</span>
                                          <span className="text-[10px] px-2 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">BORÇ</span>
                                        </div>
                                        <p className="text-rose-950/90 mt-1">
                                          Kalan <strong>₺{debtHalf}</strong> (%50) 2. dönem sınavlarına eşit bölündü (Sınav başına <strong>₺{unpaidFeePerExam}</strong>) ve <strong>Öğrenci Borcu</strong> olarak kaydedildi.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                              {newRegPaymentMode === 'debt' && (
                                <p className="text-xs font-medium">
                                  Toplu Borç: <strong>₺{newRegFee}</strong> ({selectedDetailExamIds.length} Sınav Paketi). Bütçeye <strong>{student.name}</strong> adına öğrenci borcu olarak işlenecektir.
                                </p>
                              )}
                            </div>
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
                          <span>Toplu Ödemeyi Kaydet ve Sınavlara Eşitle ({selectedDetailExamIds.length})</span>
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
